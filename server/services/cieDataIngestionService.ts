/**
 * CIE Data Ingestion Service — Cellion Intelligence Engine
 *
 * Parses price data from three formats:
 *   CSV   — standard OHLCV (Symbol, Date, Open, High, Low, Close, Volume)
 *   Excel — .xlsx, same column structure
 *   PDF   — NGX daily official list, extracted via GPT-4o vision with per-row confidence
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

export interface PriceRow {
  rowIndex: number;    // 0-based index within acceptedRows list (for analyst selection)
  symbol: string;
  date: string;        // YYYY-MM-DD
  open?: number;       // Naira
  high?: number;
  low?: number;
  close: number;       // Naira (required)
  volume?: number;
  confidence: number;  // 0–1: data extraction confidence (1.0 for CSV/XLSX, GPT-assigned for PDF)
  lowConfidence: boolean; // true when confidence < 0.7
  source: "csv" | "xlsx" | "pdf";
  error?: string;      // set if row was rejected during parsing
}

export interface RejectedRow {
  rawSymbol: string;
  rawDate: string;
  rawClose: string;
  reason: string;
  source: "csv" | "xlsx" | "pdf";
}

export interface IngestPreviewResult {
  previewToken: string;
  format: "csv" | "xlsx" | "pdf";
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
function gptRowsToPriceRows(raw: GptResponsePayload | GptPriceRow[]): PriceRow[] {
  const arr: GptPriceRow[] = Array.isArray(raw)
    ? (raw as GptPriceRow[])
    : ((raw as GptResponsePayload).rows ?? (raw as GptResponsePayload).data ?? (raw as GptResponsePayload).prices ?? []);

  return arr.filter(Boolean).map((r: GptPriceRow): PriceRow => {
    const symbol = String(r.symbol ?? "").trim().toUpperCase();
    const date = normaliseDate(r.date ?? "") ?? "";
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

  for (const line of lines) {
    const lc = line.toLowerCase();

    // Detect the header line: must contain ALL six required column signals
    // (symbol, open, high, low, close, volume) — tight match to avoid false positives
    if (!headerFound) {
      const hits = NGX_HEADER_SIGNALS.filter(s => lc.includes(s)).length;
      if (hits === NGX_HEADER_SIGNALS.length) {
        headerFound = true;
      }
      continue; // skip header row itself (and all pre-header lines)
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

    if (numericTokens.length < 4) continue;

    const open = numericTokens[0]?.value;
    const high = numericTokens[1]?.value;
    const low = numericTokens[2]?.value;
    const close = numericTokens[3]?.value;
    const volumeCandidate = numericTokens.find(t => (t.value ?? 0) >= 1_000);
    const rawVol = volumeCandidate?.value ?? numericTokens[4]?.value;
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

async function parsePdfViaVision(buffer: Buffer): Promise<PriceRow[]> {
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

  const visionSystemPrompt = `You are a financial data extraction engine.
You will be shown images of pages from an NGX (Nigerian Exchange Group) equity price list.
Extract ALL stock price rows visible in the images.
Return ONLY a JSON object with a "rows" array. Each item must have:
  symbol    (string, NGX ticker code, required)
  date      (string, YYYY-MM-DD, required)
  open      (number, Naira, optional)
  high      (number, Naira, optional)
  low       (number, Naira, optional)
  close     (number, Naira, required)
  volume    (integer, shares, optional)
  confidence (number 0-1: 1.0 = clearly readable, 0.5 = inferred/partial, 0.2 = uncertain/guess)
Return {"rows":[]} if no price data is found. Pure JSON only — no markdown.`;

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

    return gptRowsToPriceRows(parsed);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[CIEIngest] GPT-4o Vision extraction failed:", errMsg);
    return [];
  }
}

export async function parsePdfBuffer(buffer: Buffer, filename?: string): Promise<PriceRow[]> {
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
  if (rawText.trim().length < PDF_SCANNED_THRESHOLD) {
    console.warn("[CIEIngest] Scanned PDF detected (text < 50 chars) — falling back to vision extraction");
    return parsePdfViaVision(buffer);
  }

  // Step 3: Try deterministic NGX price list parser (fast, no AI, handles Zenith/NGX daily format)
  const tradeDate = filename ? parseDateFromFilename(filename) : null;
  const ngxRows = parseNgxPriceText(rawText, tradeDate);
  if (ngxRows.length > 0) {
    console.info(`[CIEIngest] NGX deterministic parser extracted ${ngxRows.length} rows (date: ${tradeDate ?? "unknown"})`);
    return ngxRows;
  }

  console.info("[CIEIngest] NGX deterministic parser found 0 rows — falling back to GPT-4o text extraction");

  const systemPrompt = `You are a financial data extraction engine.
Extract NGX (Nigerian Exchange Group) equity price data from the text below.
Return ONLY a JSON object with a "rows" array. Each item must have:
  symbol    (string, NGX ticker code, required)
  date      (string, YYYY-MM-DD, required)
  open      (number, Naira, optional)
  high      (number, Naira, optional)
  low       (number, Naira, optional)
  close     (number, Naira, required)
  volume    (integer, shares, optional)
  confidence (number 0-1: 1.0 = clearly readable, 0.5 = inferred/partial, 0.2 = uncertain/guess)
Return {"rows":[]} if no price data is found. Pure JSON only — no markdown.`;

  // Step 4: Send extracted text to GPT-4o as a text prompt (fallback for unrecognised formats)
  try {
    const openai = await getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: rawText.slice(0, 48_000) }, // respect context window
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
      console.error("[CIEIngest] GPT-4o returned invalid JSON for PDF");
      return [];
    }

    return gptRowsToPriceRows(parsed);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[CIEIngest] PDF extraction failed:", errMsg);
    return [];
  }
}

// ============================================================
// Build preview (step 1) — stores in memory, returns token
// ============================================================

export async function buildPreview(
  format: "csv" | "xlsx" | "pdf",
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
