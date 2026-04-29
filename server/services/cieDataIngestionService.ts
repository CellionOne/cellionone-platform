/**
 * CIE Data Ingestion Service — Cellion Intelligence Engine
 *
 * Parses price data from five formats:
 *   CSV   — standard OHLCV (Symbol, Date, Open, High, Low, Close, Volume)
 *   Excel — .xlsx, same column structure
 *   PDF   — any Nigerian equity/dividend document, extracted via GPT-4o
 *   DOCX  — Word documents, text extracted via mammoth then sent to GPT-4o
 *   Text  — raw pasted text, sent directly to GPT-4o
 *
 * Also supports AI dividend parsing from PDF/DOCX/text via parseDividendDocument().
 *
 * Strict two-step analyst flow:
 *   1. buildPreview()        — parse & validate, return rows + counts + previewToken, NO DB write
 *   2. commitFromToken()     — analyst submits {previewToken, acceptedRowIndices}, ONLY those rows committed
 *
 * Preview tokens expire after 30 minutes. The in-memory store is cleaned lazily.
 */

import * as XLSX from "xlsx";
import { randomUUID } from "crypto";
import { storage } from "../storage";
import type { OpenAI as OpenAIClient } from "openai";

// ============================================================
// OpenAI lazy initialisation
// ============================================================
let openaiClient: OpenAIClient | null = null;
async function getOpenAI(): Promise<OpenAIClient> {
  if (!openaiClient) {
    const { OpenAI } = await import("openai");
    openaiClient = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY,
      ...(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ? { baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL } : {}),
    });
  }
  return openaiClient;
}

// ============================================================
// Preview token store (in-memory, 30-minute TTL)
// ============================================================
interface StoredPreview {
  result: IngestPreviewResult;
  expiresAt: number; // Unix ms
}

const previewStore = new Map<string, StoredPreview>();
const PREVIEW_TTL_MS = 30 * 60 * 1000;

// Dividend preview store (same TTL)
interface StoredDividendPreview {
  result: DividendPreviewResult;
  expiresAt: number;
}
const dividendPreviewStore = new Map<string, StoredDividendPreview>();

export function storeDividendPreview(result: DividendPreviewResult): string {
  const token = randomUUID();
  const now = Date.now();
  for (const [k, v] of dividendPreviewStore) {
    if (v.expiresAt < now) dividendPreviewStore.delete(k);
  }
  dividendPreviewStore.set(token, { result, expiresAt: now + PREVIEW_TTL_MS });
  return token;
}

export function getStoredDividendPreview(token: string): DividendPreviewResult | null {
  const entry = dividendPreviewStore.get(token);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) { dividendPreviewStore.delete(token); return null; }
  return entry.result;
}

export function deleteStoredDividendPreview(token: string): void {
  dividendPreviewStore.delete(token);
}

function storePreview(result: IngestPreviewResult): string {
  const token = randomUUID();
  // Lazy cleanup of expired entries
  const now = Date.now();
  for (const [k, v] of previewStore) {
    if (v.expiresAt < now) previewStore.delete(k);
  }
  previewStore.set(token, { result, expiresAt: now + PREVIEW_TTL_MS });
  return token;
}

export function getStoredPreview(token: string): IngestPreviewResult | null {
  const entry = previewStore.get(token);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    previewStore.delete(token);
    return null;
  }
  return entry.result;
}

export function deleteStoredPreview(token: string): void {
  previewStore.delete(token);
}

// ============================================================
// Types
// ============================================================

export type IngestFormat = "csv" | "xlsx" | "pdf" | "docx" | "text";

export interface PriceRow {
  rowIndex: number;    // 0-based index within acceptedRows list (for analyst selection)
  symbol: string;
  date: string;        // YYYY-MM-DD
  open?: number;       // Naira
  high?: number;
  low?: number;
  close: number;       // Naira (required)
  volume?: number;
  confidence: number;  // 0–1: data extraction confidence (1.0 for CSV/XLSX, GPT-assigned for PDF/docx/text)
  lowConfidence: boolean; // true when confidence < 0.7
  source: IngestFormat;
  error?: string;      // set if row was rejected during parsing
}

export interface RejectedRow {
  rawSymbol: string;
  rawDate: string;
  rawClose: string;
  reason: string;
  source: IngestFormat;
}

// ============================================================
// Dividend types (for AI-extracted dividend previews)
// ============================================================

export interface DividendRow {
  rowIndex: number;
  ticker: string;
  exDividendDate: string;  // YYYY-MM-DD
  paymentDate: string | null;
  amountPerShareNaira: number;
  confidence: number;
  lowConfidence: boolean;
  error?: string;
}

export interface DividendPreviewResult {
  previewToken: string;
  format: IngestFormat;
  filename: string;
  rowsExtracted: number;
  rowsAccepted: number;
  rowsRejected: number;
  acceptedRows: DividendRow[];
  rejectedRows: Array<{ raw: string; reason: string }>;
  previewRows: DividendRow[];
  expiresAt: string;
}

export interface IngestPreviewResult {
  previewToken: string;
  format: IngestFormat;
  filename: string;
  rowsExtracted: number;
  rowsAccepted: number;
  rowsRejected: number;
  rowsFlagged: number;
  lowConfidenceCount: number;
  acceptedRows: PriceRow[];
  rejectedRows: RejectedRow[];
  flaggedSymbols: string[];  // symbols not in the securities master list
  previewRows: PriceRow[];   // first 20 accepted rows for UI preview
  expiresAt: string;         // ISO timestamp when preview token expires
}

// ============================================================
// Date / number parsing helpers
// ============================================================

function normaliseDate(raw: string | number): string | null {
  if (!raw && raw !== 0) return null;

  if (typeof raw === "number") {
    try {
      const date = XLSX.SSF.parse_date_code(raw);
      if (date) {
        const y = date.y;
        const m = String(date.m).padStart(2, "0");
        const d = String(date.d).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
    } catch { /* ignore */ }
    return null;
  }

  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const mdy = s.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{4})$/);
  if (mdy) {
    const [, m, d, y] = mdy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  return null;
}

function nairaToKobo(val: number): number {
  return Math.round(val * 100);
}

function parseNumber(val: unknown): number | undefined {
  if (val === undefined || val === null || val === "") return undefined;
  const n = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, ""));
  return isNaN(n) ? undefined : n;
}

/**
 * Extract a trade date from a filename — for NGX daily price list files that
 * embed the date in the name rather than in a per-row column.
 *
 * Recognised patterns (case-insensitive):
 *   10042026         → DDMMYYYY → "2026-04-10"
 *   2026-04-10       → ISO       → "2026-04-10"
 *   2026 04 10       → ISO-ish   → "2026-04-10"
 *   24March2026      → DMmmYYYY → "2026-03-24"
 *   March 24 2026    → Mdd YYYY  → "2026-03-24"
 */
const MONTH_NAMES: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
  jan: "01", feb: "02", mar: "03", apr: "04",
  jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

export function parseDateFromFilename(filename: string): string | null {
  if (!filename) return null;
  const base = filename.replace(/\.[^.]+$/, ""); // strip extension

  // ISO with separators: 2026-04-10 or 2026/04/10 or 2026 04 10 or 2026_04_10
  const isoMatch = base.match(/(\d{4})[\s\-\/\_](\d{2})[\s\-\/\_](\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m}-${d}`;
  }

  // Month-name pattern: 24March2026 or March24 2026 or 24 March 2026
  const monthNameMatch = base.match(/(\d{1,2})\s*([A-Za-z]+)\s*(\d{4})/);
  if (monthNameMatch) {
    const [, d, mon, y] = monthNameMatch;
    const m = MONTH_NAMES[mon.toLowerCase()];
    if (m) return `${y}-${m}-${d.padStart(2, "0")}`;
  }
  const monthNameMatchReverse = base.match(/([A-Za-z]+)\s*(\d{1,2})[,\s]+(\d{4})/);
  if (monthNameMatchReverse) {
    const [, mon, d, y] = monthNameMatchReverse;
    const m = MONTH_NAMES[mon.toLowerCase()];
    if (m) return `${y}-${m}-${d.padStart(2, "0")}`;
  }

  // 8-digit run DDMMYYYY (e.g. 10042026)
  const ddmmyyyy = base.match(/(\d{2})(\d{2})(\d{4})(?!\d)/);
  if (ddmmyyyy) {
    const [, d, mo, y] = ddmmyyyy;
    const di = parseInt(d, 10);
    const mi = parseInt(mo, 10);
    if (di >= 1 && di <= 31 && mi >= 1 && mi <= 12) {
      return `${y}-${mo}-${d}`;
    }
  }

  return null;
}

function findCol(headers: string[], ...candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex(h => h.toLowerCase().includes(c.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Locate the symbol/ticker column, applying a fallback heuristic for NGX reports
 * that use "Company" or "Name" for the full company name but have an adjacent short
 * code column ("Code", "Sym", "RIC", "ID", "Symbol Code" etc.).
 *
 * Priority:
 *   1. Standard unambiguous candidates (symbol, ticker, stock, security, scrip)
 *   2. Adjacent code-column heuristic: find "company"/"name" header, then look for a
 *      nearby column whose header contains "code", "sym", "ric", "id" — prefer that
 *      column because it holds the short ticker, not the full company name.
 *   3. Raw "company" or "name" column as last resort (full names will likely end up
 *      flagged as unknown symbols but at least data isn't silently dropped).
 */
function findSymbolCol(headers: string[]): number {
  // Step 1: unambiguous ticker candidates
  const primary = findCol(headers, "symbol", "ticker", "stock", "security", "scrip");
  if (primary >= 0) return primary;

  // Step 2: look for "company" / "name" + adjacent short-code column
  const lc = headers.map(h => h.toLowerCase().trim());
  const companyIdx = lc.findIndex(h => h === "company" || h === "name" || h.includes("company name") || h.includes("security name"));
  if (companyIdx >= 0) {
    // Scan nearby columns (up to 2 positions either side) for a code-like header
    const codeTerms = ["code", "sym", "ric", "id", "ticker", "symbol"];
    for (let offset = -2; offset <= 2; offset++) {
      if (offset === 0) continue;
      const idx = companyIdx + offset;
      if (idx < 0 || idx >= lc.length) continue;
      if (codeTerms.some(t => lc[idx].includes(t))) return idx;
    }
    // No adjacent code column found — fall back to the company/name column itself
    return companyIdx;
  }

  return -1;
}

// ============================================================
// Sheet detection: find the best sheet by expected column headers
// ============================================================

const PRICE_HEADER_CANDIDATES = ["symbol", "ticker", "stock", "close", "closing", "last price", "date"];

/**
 * Select the worksheet that most likely contains price data by scoring each sheet
 * against the set of expected column headers. Falls back to the first sheet.
 */
function detectPriceSheet(wb: XLSX.WorkBook): XLSX.WorkSheet {
  let bestSheet = wb.Sheets[wb.SheetNames[0]];
  let bestScore = -1;

  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const json = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", range: 0 });
    const headerRow: string[] = (json[0] as string[] ?? []).map(h => String(h ?? "").trim().toLowerCase());

    let score = 0;
    for (const candidate of PRICE_HEADER_CANDIDATES) {
      if (headerRow.some(h => h.includes(candidate))) score++;
    }

    // Bonus for sheets with data rows (>1 row)
    if (json.length > 2) score += 1;
    // Bonus for sheet names that suggest price data
    const lName = name.toLowerCase();
    if (lName.includes("price") || lName.includes("equity") || lName.includes("ngx") || lName.includes("data")) score += 2;

    if (score > bestScore) {
      bestScore = score;
      bestSheet = sheet;
    }
  }

  return bestSheet;
}

// ============================================================
// CSV / Excel parsing
// ============================================================

function parseSheetRows(sheet: XLSX.WorkSheet, source: "csv" | "xlsx", fallbackDate?: string | null): PriceRow[] {
  const json = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  if (json.length < 2) return [];

  const rawHeaders = (json[0] as string[]).map(h => String(h ?? "").trim());
  const symCol    = findSymbolCol(rawHeaders);
  const dateCol   = findCol(rawHeaders, "date", "trade date", "trading date", "trade_date");
  const closeCol  = findCol(rawHeaders, "close", "closing", "last price", "market price", "current price", "price", "last");
  const openCol   = findCol(rawHeaders, "open", "opening");
  const highCol   = findCol(rawHeaders, "high");
  const lowCol    = findCol(rawHeaders, "low");
  const volCol    = findCol(rawHeaders, "volume", "vol", "qty", "quantity");

  // When there is no date column, scan the first few header rows for a date value
  // (common in NGX reports that put the trade date in the sheet header area)
  let sheetHeaderDate: string | null = null;
  if (dateCol === -1) {
    for (let r = 0; r < Math.min(5, json.length); r++) {
      const cells = json[r] as unknown[];
      for (const cell of cells) {
        if (!cell) continue;
        const candidate = normaliseDate(cell);
        if (candidate) { sheetHeaderDate = candidate; break; }
      }
      if (sheetHeaderDate) break;
    }
  }

  // Effective fallback: sheet-header date takes priority over filename-derived date
  const effectiveFallbackDate = sheetHeaderDate ?? fallbackDate ?? null;

  const rows: PriceRow[] = [];

  for (let i = 1; i < json.length; i++) {
    const row = json[i] as unknown[];
    if (!row || row.every(c => c === "" || c === null || c === undefined)) continue;

    const symbol   = symCol >= 0 ? String(row[symCol] ?? "").trim().toUpperCase() : "";
    const rawDate  = dateCol >= 0 ? row[dateCol] : "";
    const rawClose = closeCol >= 0 ? row[closeCol] : "";

    if (!symbol) {
      rows.push({ rowIndex: -1, symbol: "", date: "", close: 0, confidence: 0, lowConfidence: true, source, error: `Row ${i + 1}: missing symbol` });
      continue;
    }

    // Resolve date: column value → sheet header scan → filename fallback
    let date: string | null = null;
    if (rawDate) {
      date = normaliseDate(rawDate);
      if (!date) {
        rows.push({ rowIndex: -1, symbol, date: "", close: 0, confidence: 0, lowConfidence: true, source, error: `Row ${i + 1}: invalid date '${rawDate}'` });
        continue;
      }
    } else if (effectiveFallbackDate) {
      date = effectiveFallbackDate;
    } else {
      rows.push({ rowIndex: -1, symbol, date: "", close: 0, confidence: 0, lowConfidence: true, source, error: `Row ${i + 1}: missing date` });
      continue;
    }

    const close = parseNumber(rawClose);
    if (close === undefined || close <= 0) {
      rows.push({ rowIndex: -1, symbol, date, close: 0, confidence: 0, lowConfidence: true, source, error: `Row ${i + 1}: invalid close price '${rawClose}'` });
      continue;
    }

    rows.push({
      rowIndex: -1, // set later in buildPreview
      symbol,
      date,
      close,
      open:   openCol  >= 0 ? parseNumber(row[openCol])  : undefined,
      high:   highCol  >= 0 ? parseNumber(row[highCol])  : undefined,
      low:    lowCol   >= 0 ? parseNumber(row[lowCol])   : undefined,
      volume: volCol   >= 0 ? parseNumber(row[volCol])   : undefined,
      confidence: 1.0,   // Structured file: full confidence
      lowConfidence: false,
      source,
    });
  }

  return rows;
}

export function parseCsvBuffer(buffer: Buffer, filename?: string): PriceRow[] {
  const wb = XLSX.read(buffer, { type: "buffer", raw: false, cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const fallbackDate = filename ? parseDateFromFilename(filename) : null;
  return parseSheetRows(sheet, "csv", fallbackDate);
}

export function parseXlsxBuffer(buffer: Buffer, filename?: string): PriceRow[] {
  const wb = XLSX.read(buffer, { type: "buffer", raw: false, cellDates: false });
  const sheet = detectPriceSheet(wb); // smart sheet detection by header scoring
  const fallbackDate = filename ? parseDateFromFilename(filename) : null;
  return parseSheetRows(sheet, "xlsx", fallbackDate);
}

// ============================================================
// PDF extraction: text via pdf-parse → structured via GPT-4o
// Mirrors the existing document extraction pipeline pattern:
//   extract raw text → send as text prompt → parse JSON response
// ============================================================

// GPT response payload shape (unvalidated JSON from the model)
interface GptPriceRow {
  symbol?: unknown;
  date?: unknown;
  open?: unknown;
  high?: unknown;
  low?: unknown;
  close?: unknown;
  volume?: unknown;
  confidence?: unknown;
}
interface GptResponsePayload {
  rows?: GptPriceRow[];
  data?: GptPriceRow[];
  prices?: GptPriceRow[];
}

// ============================================================
// Shared helper: map raw GPT rows → validated PriceRow[]
// ============================================================
function gptRowsToPriceRows(raw: GptResponsePayload | GptPriceRow[], fallbackDate?: string): PriceRow[] {
  const arr: GptPriceRow[] = Array.isArray(raw)
    ? (raw as GptPriceRow[])
    : ((raw as GptResponsePayload).rows ?? (raw as GptResponsePayload).data ?? (raw as GptResponsePayload).prices ?? []);

  return arr.filter(Boolean).map((r: GptPriceRow): PriceRow => {
    const symbol = String(r.symbol ?? "").trim().toUpperCase();
    // Use GPT-provided date; fall back to the known trade date from the filename when absent.
    const date = normaliseDate(r.date ?? "") ?? (fallbackDate ?? "");
    const close = parseNumber(r.close);
    const rawConfidence = typeof r.confidence === "number" ? Math.min(1, Math.max(0, r.confidence)) : 0.7;

    if (!symbol || !date || close === undefined || close <= 0) {
      return {
        rowIndex: -1,
        symbol,
        date,
        close: 0,
        confidence: rawConfidence,
        lowConfidence: true,
        source: "pdf",
        error: "GPT row invalid: missing symbol/date/close",
      };
    }

    const lowConfidence = rawConfidence < 0.7;
    return {
      rowIndex: -1,
      symbol,
      date,
      close,
      open:   parseNumber(r.open),
      high:   parseNumber(r.high),
      low:    parseNumber(r.low),
      volume: r.volume !== undefined ? Math.round(parseNumber(r.volume) ?? 0) : undefined,
      confidence: rawConfidence,
      lowConfidence,
      source: "pdf",
    };
  });
}

// ============================================================
// Deterministic NGX daily price list parser
//
// Handles the Zenith / NGX "Full Price List" column format:
//   Symbol | PClose | Open | High | Low | Close | Sign | Change |
//   Volume | Value | %Change | WeekHigh52 | WeekLow52
//
// The "Sign" column (index 6) is always exactly "+" or "-", which
// makes column positions fixed and parseable without any AI call.
// Trade date is obtained from the filename via parseDateFromFilename().
// ============================================================

const NGX_HEADER_SIGNALS = ["symbol", "open", "high", "low", "close", "volume"] as const;

/**
 * Attempt to parse an NGX/Zenith daily equity price list from extracted PDF text.
 *
 * Returns a non-empty PriceRow[] if the text matches the NGX column layout;
 * returns [] if the format is not recognised (caller should fall back to GPT-4o).
 */
function parseNgxPriceText(rawText: string, tradeDate: string | null): PriceRow[] {
  const lines = rawText.split(/\r?\n/);
  const rows: PriceRow[] = [];
  let headerFound = false;
  let hasPClose = false; // true when format has PClose (previous close) column before Open
  let prevLine = "";     // rolling 1-line buffer for 2-line header detection

  for (const line of lines) {
    const lc = line.toLowerCase();

    if (!headerFound) {
      // Support both single-line headers (all 6 signals on one line) AND
      // 2-line headers (e.g. Atlass Portfolios format where OHLCV column names appear
      // on line 1 and "S/N Symbol" appears on line 2).
      // Combine the current line with the previous line to detect split headers.
      const combined = prevLine.toLowerCase() + " " + lc;
      const hits = NGX_HEADER_SIGNALS.filter(s => combined.includes(s)).length;
      if (hits === NGX_HEADER_SIGNALS.length) {
        headerFound = true;
        // Detect PClose (previous-close) column — shifts all subsequent column indices by 1.
        hasPClose = combined.includes("pclose") || combined.includes("p.close") || combined.includes("prev close") || combined.includes("previous close");
      }
      prevLine = line;
      continue; // skip header rows (and all pre-header lines)
    }

    // Skip blank / whitespace-only lines
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Tokenise by whitespace
    const tokens = trimmed.split(/\s+/);

    const symbolIndex = tokens.findIndex(t => /^[A-Z][A-Z0-9]{1,19}$/.test(t.toUpperCase()));
    if (symbolIndex < 0) continue;
    const symbol = tokens[symbolIndex].toUpperCase();
    if (!/^[A-Z0-9]+$/.test(symbol) || symbol.length > 20) continue;

    // Helper: strip thousand-separator commas then parse float
    const pn = (t: string): number | undefined => {
      const v = parseFloat(t.replace(/,/g, ""));
      return isNaN(v) ? undefined : v;
    };

    const numericTokens = tokens
      .slice(symbolIndex + 1)
      .map(t => t.replace(/[%(),]/g, ""))
      .filter(t => t.length > 0)
      .map(t => ({ raw: t, value: pn(t) }))
      .filter(t => t.value !== undefined);

    // PClose format needs 5+ tokens; standard format needs 4+
    const minTokens = hasPClose ? 5 : 4;
    if (numericTokens.length < minTokens) continue;

    // Column mapping depends on whether PClose is present:
    //   Standard:  [0]=Open [1]=High [2]=Low [3]=Close  …
    //   PClose:    [0]=PClose [1]=Open [2]=High [3]=Low [4]=Close  …
    const oIdx = hasPClose ? 1 : 0;
    const hIdx = hasPClose ? 2 : 1;
    const lIdx = hasPClose ? 3 : 2;
    const cIdx = hasPClose ? 4 : 3;

    const open  = numericTokens[oIdx]?.value;
    const high  = numericTokens[hIdx]?.value;
    const low   = numericTokens[lIdx]?.value;
    const close = numericTokens[cIdx]?.value;

    // Volume: first token beyond the close column that is >= 1,000 shares
    const volumeCandidate = numericTokens.slice(cIdx + 1).find(t => (t.value ?? 0) >= 1_000);
    const rawVol = volumeCandidate?.value ?? numericTokens[cIdx + 1]?.value;
    const volume = rawVol !== undefined ? Math.round(rawVol) : undefined;

    // close must be a positive number
    if (close === undefined || close <= 0) continue;

    // A valid trade date is required — comes from the filename
    if (!tradeDate) continue;

    rows.push({
      rowIndex:     -1,
      symbol,
      date:         tradeDate,
      open,
      high,
      low,
      close,
      volume,
      confidence:   1.0,
      lowConfidence: false,
      source:       "pdf",
    });
  }

  return rows;
}

// ============================================================
// Vision fallback: convert PDF pages to images via pdftoppm
// then send to GPT-4o as base64 image_url content blocks
// ============================================================
const PDF_SCANNED_THRESHOLD = 50; // characters — below this we treat it as a scanned image PDF
const PDF_VISION_MAX_PAGES  = 5;  // cap to avoid excessive token usage

async function pdfToBase64Images(buffer: Buffer): Promise<string[]> {
  const { execFile }  = await import("child_process");
  const { promisify } = await import("util");
  const { tmpdir }    = await import("os");
  const path          = await import("path");
  const fs            = await import("fs");
  const execFileAsync = promisify(execFile);

  const tmpDir   = tmpdir();
  const pdfPath  = path.join(tmpDir, `cie_pdf_${Date.now()}.pdf`);
  const outPrefix = path.join(tmpDir, `cie_pdf_${Date.now()}_page`);

  try {
    await fs.promises.writeFile(pdfPath, buffer);

    // Convert first N pages to PNG at 150 dpi (good for text OCR, reasonable size)
    await execFileAsync("pdftoppm", [
      "-r", "150",
      "-f", "1",
      "-l", String(PDF_VISION_MAX_PAGES),
      "-png",
      pdfPath,
      outPrefix,
    ]);

    // pdftoppm names files as <prefix>-1.png, <prefix>-2.png, etc.
    const files = (await fs.promises.readdir(tmpDir))
      .filter(f => f.startsWith(path.basename(outPrefix)) && f.endsWith(".png"))
      .sort()
      .map(f => path.join(tmpDir, f));

    const images: string[] = [];
    for (const file of files) {
      const data = await fs.promises.readFile(file);
      images.push(`data:image/png;base64,${data.toString("base64")}`);
      await fs.promises.unlink(file).catch(() => undefined);
    }

    return images;
  } finally {
    await fs.promises.unlink(pdfPath).catch(() => undefined);
  }
}

async function parsePdfViaVision(buffer: Buffer, knownDate?: string | null): Promise<PriceRow[]> {
  let images: string[];
  try {
    images = await pdfToBase64Images(buffer);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[CIEIngest] pdftoppm image conversion failed:", errMsg);
    console.warn("[CIEIngest] Scanned PDF detected — text extraction not possible (pdftoppm unavailable)");
    return [];
  }

  if (images.length === 0) {
    console.warn("[CIEIngest] Scanned PDF detected — text extraction not possible (pdftoppm produced no images)");
    return [];
  }

  console.info(`[CIEIngest] Scanned PDF detected — sending ${images.length} page image(s) to GPT-4o Vision`);

  const visionSystemPrompt = `You are a financial data extraction engine specialising in Nigerian equity markets.
You will be shown images of pages from a Nigerian financial document — this may be any of:
  - NGX (Nigerian Exchange Group) official daily price list
  - Nairametrics or BusinessDay price/market tables
  - Stockbroker or investment research morning notes
  - NSE (Nigerian Stock Exchange) equity summary sheets
  - Any other Nigerian market report containing stock price data

Extract ALL stock price rows visible in the images regardless of layout.
Return ONLY a JSON object with a "rows" array. Each item must have:
  symbol    (string, NGX ticker code e.g. DANGCEM GTCO ZENITHBANK MTNN, required — do NOT use the full company name)
  date      (string, YYYY-MM-DD, required${knownDate ? ` — use "${knownDate}" for all rows` : " — infer from document headers, page titles, or captions if not in each row"})
  open      (number, Naira, optional)
  high      (number, Naira, optional)
  low       (number, Naira, optional)
  close     (number, Naira, required — labelled "closing price", "close", "last", or "market price")
  volume    (integer, shares traded, optional)
  confidence (number 0-1: 1.0 = clearly readable, 0.5 = partially inferred, 0.2 = uncertain)

IMPORTANT: If the document shows company names instead of ticker codes, map them to their NGX ticker.
Common mappings: "Dangote Cement"→DANGCEM, "Guaranty Trust"→GTCO, "Zenith Bank"→ZENITHBANK,
"MTN Nigeria"→MTNN, "Airtel Africa"→AIRTELAFRI, "Access Holdings"→ACCESSCORP, "UBA"→UBA,
"First Bank"→FBNH, "Stanbic IBTC"→STANBIC, "Nestle"→NESTLE, "Lafarge"→WAPCO,
"Seplat"→SEPLAT, "Okomu Oil"→OKOMUOIL, "Presco"→PRESCO, "Fidelity Bank"→FIDELITYBK,
"Ecobank"→ETI, "Flour Mills"→FLOURMILL, "Cadbury"→CADBURY, "Nigerian Breweries"→NB.
If you cannot determine the ticker, include the company name as-is (the system will flag it).
Return {"rows":[]} if no price data is found. Pure JSON only — no markdown.${knownDate ? `\n\nCRITICAL DATE OVERRIDE: Every row MUST use date "${knownDate}" (YYYY-MM-DD). Do NOT infer or guess a different date — use this value exactly for all rows.` : ""}`;

  const imageContent = images.map(url => ({
    type: "image_url" as const,
    image_url: { url, detail: "high" as const },
  }));

  try {
    const openai = await getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: visionSystemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract all NGX price rows from these PDF page images." },
            ...imageContent,
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 16384,
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    let parsed: GptResponsePayload | GptPriceRow[];
    try {
      parsed = JSON.parse(content) as GptResponsePayload | GptPriceRow[];
    } catch {
      console.error("[CIEIngest] GPT-4o Vision returned invalid JSON for scanned PDF");
      return [];
    }

    return gptRowsToPriceRows(parsed, knownDate ?? undefined);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[CIEIngest] GPT-4o Vision extraction failed:", errMsg);
    return [];
  }
}

export async function parsePdfBuffer(buffer: Buffer, filename?: string): Promise<PriceRow[]> {
  // Extract trade date from filename up front — needed by all code paths including vision.
  const tradeDate = filename ? parseDateFromFilename(filename) : null;

  // Step 1: Extract raw text from the PDF using pdf-parse
  let rawText = "";
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    rawText = result.text ?? "";
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[CIEIngest] pdf-parse text extraction failed:", errMsg);
    return [];
  }

  // Step 2: Detect scanned (image-based) PDFs — fall back to GPT-4o Vision
  // Pass the known trade date so the vision prompt can use it as a hard override.
  if (rawText.trim().length < PDF_SCANNED_THRESHOLD) {
    console.warn("[CIEIngest] Scanned PDF detected (text < 50 chars) — falling back to vision extraction");
    return parsePdfViaVision(buffer, tradeDate);
  }

  // Step 3: Try deterministic NGX price list parser (fast, no AI, handles Zenith/NGX daily format)
  const ngxRows = parseNgxPriceText(rawText, tradeDate);
  if (ngxRows.length > 0) {
    console.info(`[CIEIngest] NGX deterministic parser extracted ${ngxRows.length} rows (date: ${tradeDate ?? "unknown"})`);
    return ngxRows;
  }

  console.info("[CIEIngest] NGX deterministic parser found 0 rows — falling back to GPT-4o text extraction");

  return gptExtractPriceRows(rawText, "pdf", tradeDate);
}

// ============================================================
// Shared GPT-4o price extraction from raw text
// ============================================================

const PRICE_EXTRACTION_SYSTEM_PROMPT = `You are a financial data extraction engine specialising in Nigerian equity markets.
Extract ALL stock price rows from the text below. The document may be any of:
  - NGX (Nigerian Exchange Group) official daily price list
  - Nairametrics, BusinessDay, or Punch market summary/table
  - Stockbroker or investment firm morning note / research
  - NSE or SEC equity summary sheet
  - Any other Nigerian market report, newsletter, or announcement

Return ONLY a JSON object with a "rows" array. Each item must have:
  symbol    (string, NGX ticker code e.g. DANGCEM GTCO ZENITHBANK MTNN, required)
  date      (string, YYYY-MM-DD, required — infer from document headers or date mentions if not per-row)
  open      (number, Naira, optional)
  high      (number, Naira, optional)
  low       (number, Naira, optional)
  close     (number, Naira, required — may be labelled "closing price", "close", "last price", "market price", or just a price column)
  volume    (integer, shares traded, optional)
  confidence (number 0-1: 1.0 = exact match, 0.7 = confident, 0.5 = partially inferred, 0.2 = uncertain)

IMPORTANT RULES:
- Map company names to NGX tickers. Common mappings:
  "Dangote Cement"→DANGCEM, "Dangote Sugar"→DANGSUGAR, "Guaranty Trust"→GTCO,
  "Zenith Bank"→ZENITHBANK, "MTN Nigeria"→MTNN, "Airtel Africa"→AIRTELAFRI,
  "Access Holdings"→ACCESSCORP, "UBA"/"United Bank for Africa"→UBA,
  "First Bank"/"FBN Holdings"→FBNH, "Stanbic IBTC"→STANBIC,
  "Nestle Nigeria"→NESTLE, "Lafarge Africa"→WAPCO, "Seplat Energy"→SEPLAT,
  "Okomu Oil"→OKOMUOIL, "Presco"→PRESCO, "Fidelity Bank"→FIDELITYBK,
  "Ecobank"→ETI, "Flour Mills"→FLOURMILL, "Cadbury Nigeria"→CADBURY,
  "Nigerian Breweries"→NB, "Transcorp"→TRANSCORP, "Vitafoam"→VITAFOAM,
  "Unilever Nigeria"→UNILEVER, "Total Energies"→TOTAL, "Conoil"→CONOIL.
- If a ticker cannot be determined, use the company name as-is — the system will flag it.
- Numbers may use comma as thousands separator (e.g. "1,200,000") — parse as integers/decimals.
- Percentage change columns (% chg) are NOT prices — ignore them.
- If the text contains no price data at all, return {"rows":[]}.
Pure JSON only — no markdown, no explanation.`;

async function gptExtractPriceRows(text: string, source: IngestFormat, knownDate?: string | null): Promise<PriceRow[]> {
  // When the trade date is already known (e.g. from the filename), inject it as a hard
  // constraint into the system prompt so rows never fail date validation.
  let systemPrompt = PRICE_EXTRACTION_SYSTEM_PROMPT;
  if (knownDate) {
    systemPrompt += `\n\nCRITICAL DATE OVERRIDE: Every row MUST use date "${knownDate}" (YYYY-MM-DD). Do NOT infer or guess a different date — use this value exactly for all rows.`;
  }

  try {
    const openai = await getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text.slice(0, 48_000) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 16384,
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    let parsed: GptResponsePayload | GptPriceRow[];
    try {
      parsed = JSON.parse(content) as GptResponsePayload | GptPriceRow[];
    } catch {
      console.error(`[CIEIngest] GPT-4o returned invalid JSON for ${source} extraction`);
      return [];
    }

    // Pass knownDate as fallback so rows GPT omits a date on still resolve correctly.
    return gptRowsToPriceRows(parsed, knownDate ?? undefined).map(r => ({ ...r, source }));
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[CIEIngest] GPT-4o text extraction failed (${source}):`, errMsg);
    return [];
  }
}

// ============================================================
// DOCX extraction via mammoth → GPT-4o
// ============================================================

export async function parseDocxBuffer(buffer: Buffer, filename?: string): Promise<PriceRow[]> {
  let rawText = "";
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    rawText = result.value ?? "";
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[CIEIngest] mammoth docx extraction failed:", errMsg);
    return [];
  }

  if (rawText.trim().length < 20) {
    console.warn("[CIEIngest] DOCX appears to have no extractable text");
    return [];
  }

  console.info(`[CIEIngest] DOCX text extracted (${rawText.length} chars) — sending to GPT-4o${filename ? ` (${filename})` : ""}`);

  // Try deterministic NGX parser first (it handles NGX-format text from any source)
  const tradeDate = filename ? parseDateFromFilename(filename) : null;
  const ngxRows = parseNgxPriceText(rawText, tradeDate);
  if (ngxRows.length > 0) {
    console.info(`[CIEIngest] NGX deterministic parser extracted ${ngxRows.length} rows from DOCX`);
    return ngxRows.map(r => ({ ...r, source: "docx" as IngestFormat }));
  }

  return gptExtractPriceRows(rawText, "docx", tradeDate);
}

// ============================================================
// Paste-text extraction — raw string → GPT-4o
// ============================================================

export async function parseTextContent(text: string): Promise<PriceRow[]> {
  if (!text || text.trim().length < 10) return [];
  console.info(`[CIEIngest] Paste-text extraction (${text.length} chars) — sending to GPT-4o`);

  // Try deterministic NGX parser on pasted text too
  const ngxRows = parseNgxPriceText(text, null);
  if (ngxRows.length > 0) {
    console.info(`[CIEIngest] NGX deterministic parser extracted ${ngxRows.length} rows from pasted text`);
    return ngxRows.map(r => ({ ...r, source: "text" as IngestFormat }));
  }

  return gptExtractPriceRows(text, "text");
}

// ============================================================
// Dividend extraction prompt + parser
// ============================================================

const DIVIDEND_EXTRACTION_SYSTEM_PROMPT = `You are a financial data extraction engine specialising in Nigerian equity markets.
Extract ALL dividend announcements from the text below. The document may be any of:
  - NGX or NSE official dividend announcement
  - Nairametrics, BusinessDay, or Punch dividend news article
  - Company annual report dividend section
  - Stockbroker research note with dividend summary table
  - Any other Nigerian market communication mentioning dividends

Return ONLY a JSON object with a "dividends" array. Each item must have:
  ticker         (string, NGX ticker code e.g. DANGCEM GTCO ZENITHBANK MTNN, required)
  ex_date        (string, YYYY-MM-DD, required — the ex-dividend date)
  payment_date   (string, YYYY-MM-DD, optional — the payment/payment date)
  amount_naira   (number, Naira per share, required — e.g. 3.50 means ₦3.50 per share)
  confidence     (number 0-1: 1.0 = exact, 0.7 = confident, 0.5 = inferred, 0.2 = uncertain)

IMPORTANT RULES:
- Map company names to NGX tickers using the same mappings as for price data.
- "Ex-dividend date" and "ex-date" and "qualification date" all mean the same thing.
- Amounts: if stated as kobo (e.g. "350k" or "350 kobo"), convert to naira (350k → 3.50).
- If multiple dividends appear (interim + final), extract each as a separate row.
- If no dividend data is present, return {"dividends":[]}.
Pure JSON only — no markdown, no explanation.`;

interface GptDividendRow {
  ticker?: unknown;
  ex_date?: unknown;
  payment_date?: unknown;
  amount_naira?: unknown;
  confidence?: unknown;
}

function gptDividendsToDividendRows(raw: unknown): DividendRow[] {
  const payload = raw as { dividends?: GptDividendRow[] };
  const arr: GptDividendRow[] = Array.isArray(raw) ? (raw as GptDividendRow[]) : (payload.dividends ?? []);

  return arr.filter(Boolean).map((r, i): DividendRow => {
    const ticker = String(r.ticker ?? "").trim().toUpperCase();
    const exDate = normaliseDate(r.ex_date ?? "") ?? "";
    const payDate = r.payment_date ? (normaliseDate(r.payment_date) ?? null) : null;
    const amount = typeof r.amount_naira === "number" ? r.amount_naira : parseFloat(String(r.amount_naira ?? ""));
    const rawConf = typeof r.confidence === "number" ? Math.min(1, Math.max(0, r.confidence)) : 0.7;

    if (!ticker || !exDate || isNaN(amount) || amount <= 0) {
      return {
        rowIndex: i,
        ticker,
        exDividendDate: exDate,
        paymentDate: payDate,
        amountPerShareNaira: 0,
        confidence: rawConf,
        lowConfidence: true,
        error: "Missing or invalid ticker/ex-date/amount",
      };
    }

    return {
      rowIndex: i,
      ticker,
      exDividendDate: exDate,
      paymentDate: payDate,
      amountPerShareNaira: amount,
      confidence: rawConf,
      lowConfidence: rawConf < 0.7,
    };
  });
}

async function gptExtractDividendRows(text: string): Promise<DividendRow[]> {
  try {
    const openai = await getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: DIVIDEND_EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: text.slice(0, 48_000) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 4096,
    });
    const content = response.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try { parsed = JSON.parse(content); } catch {
      console.error("[CIEIngest] GPT-4o returned invalid JSON for dividend extraction");
      return [];
    }
    return gptDividendsToDividendRows(parsed);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[CIEIngest] GPT-4o dividend extraction failed:", errMsg);
    return [];
  }
}

/**
 * Parse dividend data from a PDF buffer, DOCX buffer, or raw pasted text.
 * Returns DividendRow[] for analyst review before committing.
 */
export async function parseDividendDocument(
  input: { type: "pdf"; buffer: Buffer; filename?: string }
       | { type: "docx"; buffer: Buffer; filename?: string }
       | { type: "text"; text: string }
): Promise<DividendRow[]> {
  let text = "";

  if (input.type === "pdf") {
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const result = await pdfParse(input.buffer);
      text = result.text ?? "";
    } catch (err: unknown) {
      console.error("[CIEIngest] pdf-parse failed for dividend extraction:", err instanceof Error ? err.message : err);
      return [];
    }
    if (text.trim().length < 20) {
      console.warn("[CIEIngest] PDF for dividend extraction has little text — trying vision fallback");
      // Vision fallback: send to GPT-4o with image content
      const images = await pdfToBase64Images(input.buffer).catch(() => [] as string[]);
      if (images.length === 0) return [];
      try {
        const openai = await getOpenAI();
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: DIVIDEND_EXTRACTION_SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: "Extract all dividend announcements from these document images." },
                ...images.map(url => ({ type: "image_url" as const, image_url: { url, detail: "high" as const } })),
              ],
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 4096,
        });
        const content = response.choices[0]?.message?.content ?? "{}";
        let parsed: unknown;
        try { parsed = JSON.parse(content); } catch { return []; }
        return gptDividendsToDividendRows(parsed);
      } catch { return []; }
    }
  } else if (input.type === "docx") {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: input.buffer });
      text = result.value ?? "";
    } catch (err: unknown) {
      console.error("[CIEIngest] mammoth failed for dividend extraction:", err instanceof Error ? err.message : err);
      return [];
    }
  } else {
    text = input.text;
  }

  if (text.trim().length < 10) return [];
  console.info(`[CIEIngest] Dividend extraction from ${input.type} (${text.length} chars)`);
  return gptExtractDividendRows(text);
}

/**
 * Build a dividend preview result for analyst review.
 */
export async function buildDividendPreview(
  rows: DividendRow[],
  format: IngestFormat,
  filename: string
): Promise<DividendPreviewResult> {
  const acceptedRows: DividendRow[] = [];
  const rejectedRows: Array<{ raw: string; reason: string }> = [];

  for (const row of rows) {
    if (row.error || !row.ticker || !row.exDividendDate || row.amountPerShareNaira <= 0) {
      rejectedRows.push({
        raw: `${row.ticker || "?"} ex:${row.exDividendDate || "?"} ₦${row.amountPerShareNaira}`,
        reason: row.error ?? "Missing required fields",
      });
    } else {
      acceptedRows.push(row);
    }
  }

  // Re-index
  acceptedRows.forEach((r, i) => { r.rowIndex = i; });

  const expiresAt = new Date(Date.now() + PREVIEW_TTL_MS).toISOString();
  const result: DividendPreviewResult = {
    previewToken: "",
    format,
    filename,
    rowsExtracted: rows.length,
    rowsAccepted: acceptedRows.length,
    rowsRejected: rejectedRows.length,
    acceptedRows,
    rejectedRows: rejectedRows.slice(0, 20),
    previewRows: acceptedRows.slice(0, 20),
    expiresAt,
  };

  const token = storeDividendPreview(result);
  result.previewToken = token;
  return result;
}

// ============================================================
// Build preview (step 1) — stores in memory, returns token
// ============================================================

export async function buildPreview(
  format: IngestFormat,
  rows: PriceRow[],
  filename: string
): Promise<IngestPreviewResult> {
  const securities = await storage.listCieSecurities(false);
  const knownSymbols = new Set(securities.map(s => s.symbol));

  const acceptedRows: PriceRow[] = [];
  const rejectedRows: RejectedRow[] = [];
  const flaggedSymbols = new Set<string>();

  // Deduplicate by symbol+date (latest row wins)
  const seen = new Map<string, PriceRow>();

  for (const row of rows) {
    if (row.error) {
      rejectedRows.push({
        rawSymbol: row.symbol,
        rawDate: row.date,
        rawClose: String(row.close),
        reason: row.error,
        source: row.source,
      });
      continue;
    }

    if (!row.symbol || !row.date || row.close <= 0) {
      rejectedRows.push({
        rawSymbol: row.symbol,
        rawDate: row.date,
        rawClose: String(row.close),
        reason: "Missing required fields (symbol, date, or close price)",
        source: row.source,
      });
      continue;
    }

    if (!knownSymbols.has(row.symbol)) {
      flaggedSymbols.add(row.symbol);
    }

    const key = `${row.symbol}::${row.date}`;
    seen.set(key, row);
  }

  let rowIndex = 0;
  for (const [, row] of seen) {
    row.rowIndex = rowIndex++;
    acceptedRows.push(row);
  }

  const lowConfidenceCount = acceptedRows.filter(r => r.lowConfidence).length;
  const expiresAt = new Date(Date.now() + PREVIEW_TTL_MS).toISOString();

  const result: IngestPreviewResult = {
    previewToken: "", // will be set after storing
    format,
    filename,
    rowsExtracted: rows.length,
    rowsAccepted: acceptedRows.length,
    rowsRejected: rejectedRows.length,
    rowsFlagged: flaggedSymbols.size,
    lowConfidenceCount,
    acceptedRows,
    rejectedRows,
    flaggedSymbols: [...flaggedSymbols],
    previewRows: acceptedRows.slice(0, 20),
    expiresAt,
  };

  const token = storePreview(result);
  result.previewToken = token;

  return result;
}

// ============================================================
// Commit from token (step 2) — analyst supplies approved indices
// ============================================================

export async function commitFromToken(
  previewToken: string,
  acceptedRowIndices: number[] | null, // null = accept all
  uploadedByUserId: string,
  confirmedByUserId: string
): Promise<{
  logId: number;
  committed: number;
  skipped: number;
  uploadId: string;
}> {
  const preview = getStoredPreview(previewToken);
  if (!preview) {
    throw new Error("Preview token not found or expired. Please re-upload the file.");
  }

  // Determine which rows the analyst approved
  const rowsToCommit = acceptedRowIndices !== null
    ? preview.acceptedRows.filter(r => acceptedRowIndices.includes(r.rowIndex))
    : preview.acceptedRows;

  const analystApproved = rowsToCommit.length;

  const log = await storage.createCieIngestionLog({
    uploadId: previewToken, // use the preview token as the upload session ID
    format: preview.format,
    dataType: "prices",
    filename: preview.filename ?? null,
    rowsExtracted: preview.rowsExtracted,
    rowsAccepted: preview.rowsAccepted,
    rowsRejected: preview.rowsRejected,
    rowsFlagged: preview.rowsFlagged,
    rowsAnalystApproved: analystApproved,
    status: "committing",
    uploadedByUserId,
    confirmedByUserId,
    previewedAt: new Date(),
  });

  const securities = await storage.listCieSecurities(false);
  const symbolToId = new Map(securities.map(s => [s.symbol, s.id]));

  let committed = 0;
  let skipped = 0;

  for (const row of rowsToCommit) {
    const secId = symbolToId.get(row.symbol);
    if (!secId) {
      skipped++;
      continue;
    }

    try {
      await storage.upsertCiePrice({
        securityId: secId,
        tradeDate: row.date,
        closeKobo: nairaToKobo(row.close),
        openKobo: row.open !== undefined ? nairaToKobo(row.open) : null,
        highKobo: row.high !== undefined ? nairaToKobo(row.high) : null,
        lowKobo: row.low !== undefined ? nairaToKobo(row.low) : null,
        volume: row.volume !== undefined ? Math.round(row.volume) : null,
      });
      committed++;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[CIEIngest] Error committing row ${row.symbol} ${row.date}:`, errMsg);
      skipped++;
    }
  }

  await storage.updateCieIngestionLog(log.id, {
    status: "committed",
    rowsAccepted: committed,
    rowsRejected: preview.rowsRejected + skipped,
    rowsAnalystApproved: analystApproved,
    committedAt: new Date(),
    triggeredRecomputation: true,
  });

  // Invalidate the preview token after a successful commit
  deleteStoredPreview(previewToken);

  return { logId: log.id, committed, skipped, uploadId: previewToken };
}

// ============================================================
// Template data (shared between CSV and XLSX generators)
// ============================================================

const PRICES_TEMPLATE_DATA = [
  ["Symbol", "Date", "Open", "High", "Low", "Close", "Volume"],
  ["DANGCEM", "2026-04-03", 620.00, 625.00, 618.00, 622.00, 1500000],
  ["GTCO", "2026-04-03", 47.50, 48.00, 47.00, 47.80, 3200000],
  ["ZENITHBANK", "2026-04-03", 35.00, 35.50, 34.80, 35.20, 2800000],
];

const DIVIDENDS_TEMPLATE_DATA = [
  ["Symbol", "ExDividendDate", "PaymentDate", "AmountPerShare"],
  ["DANGCEM", "2026-04-10", "2026-04-25", 10.00],
  ["GTCO", "2026-04-15", "2026-04-30", 1.50],
];

const SIGNALS_TEMPLATE_DATA = [
  ["Symbol", "Type", "Sentiment", "Credibility", "Content", "Tags"],
  ["MTNN", "news", "bullish", 4, "MTN Nigeria reports 22% growth in data subscribers", "telecom;earnings"],
  ["SEPLAT", "sector_rotation", "neutral", 3, "Oil sector rotation on crude price recovery", "oil;macro"],
];

// ============================================================
// CSV templates
// ============================================================

export function generatePricesTemplate(): string {
  return PRICES_TEMPLATE_DATA.map(row => row.join(",")).join("\r\n");
}

export function generateDividendsTemplate(): string {
  return DIVIDENDS_TEMPLATE_DATA.map(row => row.join(",")).join("\r\n");
}

export function generateSignalsTemplate(): string {
  // Wrap content in quotes to handle commas/semicolons
  return SIGNALS_TEMPLATE_DATA.map((row, i) =>
    i === 0 ? row.join(",") : `${row.slice(0, 4).join(",")},${JSON.stringify(row[4])},${JSON.stringify(row[5])}`
  ).join("\r\n");
}

// ============================================================
// XLSX templates
// ============================================================

function buildXlsxTemplate(data: (string | number)[][], sheetName: string): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Auto-fit column widths based on max content length per column
  const colWidths = data[0].map((_, colIdx) => {
    const maxLen = Math.max(...data.map(row => String(row[colIdx] ?? "").length));
    return { wch: Math.min(Math.max(maxLen + 2, 10), 50) };
  });
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function generatePricesXlsxTemplate(): Buffer {
  return buildXlsxTemplate(PRICES_TEMPLATE_DATA, "Prices");
}

export function generateDividendsXlsxTemplate(): Buffer {
  return buildXlsxTemplate(DIVIDENDS_TEMPLATE_DATA, "Dividends");
}

export function generateSignalsXlsxTemplate(): Buffer {
  return buildXlsxTemplate(SIGNALS_TEMPLATE_DATA, "Signals");
}

export function generateDataEntryGuide(): object {
  return {
    version: "1.0",
    updatedAt: new Date().toISOString().slice(0, 10),
    templates: {
      prices: {
        urlCsv: "/api/admin/cie/templates/prices",
        urlXlsx: "/api/admin/cie/templates/prices?format=xlsx",
        format: "CSV or XLSX",
        requiredColumns: ["Symbol", "Date", "Close"],
        optionalColumns: ["Open", "High", "Low", "Volume"],
        notes: [
          "Symbol must match an existing NGX security ticker (e.g. DANGCEM, GTCO).",
          "Date accepts: YYYY-MM-DD, DD/MM/YYYY, or Excel serial dates.",
          "Close, Open, High, Low are in Nigerian Naira (decimal). e.g. 622.00",
          "Volume is the number of shares traded (integer).",
          "Duplicate symbol+date rows: last occurrence is kept.",
          "Rows with unknown symbols are flagged but NOT rejected — analyst reviews them.",
        ],
      },
      dividends: {
        urlCsv: "/api/admin/cie/templates/dividends",
        urlXlsx: "/api/admin/cie/templates/dividends?format=xlsx",
        format: "CSV or XLSX",
        requiredColumns: ["Symbol", "ExDividendDate", "AmountPerShare"],
        optionalColumns: ["PaymentDate"],
        notes: [
          "AmountPerShare is in Naira (decimal). Internally stored in Kobo.",
          "ExDividendDate format: YYYY-MM-DD.",
        ],
      },
      signals: {
        urlCsv: "/api/admin/cie/templates/signals",
        urlXlsx: "/api/admin/cie/templates/signals?format=xlsx",
        format: "CSV or XLSX",
        requiredColumns: ["Symbol", "Type", "Content"],
        optionalColumns: ["Sentiment", "Credibility", "Tags"],
        notes: [
          "Type: rumour | news | trade_call | sector_rotation",
          "Sentiment: bullish | bearish | neutral",
          "Credibility: 1 (low) to 5 (high)",
          "Tags: semicolon-separated list",
        ],
      },
    },
    pdfIngestion: {
      description: "PDF uploads use GPT-4o vision to extract price data.",
      confidenceThreshold: 0.7,
      notes: [
        "Rows with confidence < 0.70 are flagged as low-confidence and highlighted in the preview.",
        "Analyst should manually verify low-confidence rows before confirming.",
        "Best results: NGX daily official price list PDFs (not scanned/image-only).",
        "Multi-page PDFs are fully supported.",
      ],
    },
    twoStepWorkflow: {
      step1: "POST /api/admin/cie/ingest/preview — Upload file. Returns previewToken + all accepted rows with rowIndex.",
      step2: "POST /api/admin/cie/ingest/confirm — Submit previewToken + acceptedRowIndices (or omit to accept all). Only selected rows are written to the database.",
      tokenTTL: "30 minutes",
    },
  };
}
