/**
 * CIE Data Ingestion Service
 *
 * Parses price data from three formats:
 *   CSV   — standard OHLCV (Symbol, Date, Open, High, Low, Close, Volume)
 *   Excel — .xlsx, same column structure
 *   PDF   — NGX daily official list, extracted via GPT-4o vision
 *
 * Two-step flow:
 *   1. preview() — parse & validate, return rows + counts, NO DB write
 *   2. commit()  — write accepted rows, create ingestion log, trigger score recomputation
 */

import * as XLSX from "xlsx";
import { storage } from "../storage";

let openaiClient: any = null;
async function getOpenAI(): Promise<any> {
  if (!openaiClient) {
    const { OpenAI } = await import("openai");
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export interface PriceRow {
  symbol: string;
  date: string;        // YYYY-MM-DD
  open?: number;       // Naira
  high?: number;
  low?: number;
  close: number;       // Naira (required)
  volume?: number;
  error?: string;      // set if row was rejected
}

export interface IngestPreviewResult {
  format: "csv" | "xlsx" | "pdf";
  rowsExtracted: number;
  rowsAccepted: number;
  rowsRejected: number;
  rowsFlagged: number;
  acceptedRows: PriceRow[];
  rejectedRows: PriceRow[];
  flaggedSymbols: string[];  // symbols not in the securities master list
  preview: PriceRow[];       // first 20 accepted rows for UI preview
}

/** Parse a date string in various formats → YYYY-MM-DD */
function normaliseDate(raw: string | number): string | null {
  if (!raw) return null;

  // Handle Excel serial date number
  if (typeof raw === "number") {
    const date = XLSX.SSF.parse_date_code(raw);
    if (date) {
      const y = date.y;
      const m = String(date.m).padStart(2, "0");
      const d = String(date.d).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return null;
  }

  const s = String(raw).trim();

  // Try ISO format first (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{4})$/);
  if (mdy) {
    const [, m, d, y] = mdy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Try native Date parse for strings like "April 03, 2026"
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

/** Convert Naira decimal to kobo integer */
function nairaToKobo(val: number): number {
  return Math.round(val * 100);
}

/** Parse a numeric value from a cell (handles strings with commas) */
function parseNumber(val: any): number | undefined {
  if (val === undefined || val === null || val === "") return undefined;
  const n = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, ""));
  return isNaN(n) ? undefined : n;
}

/** Detect column headers case-insensitively */
function findCol(headers: string[], ...candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex(h => h.toLowerCase().includes(c.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseSheetRows(sheet: XLSX.WorkSheet): PriceRow[] {
  const json = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
  if (json.length < 2) return [];

  const rawHeaders = (json[0] as string[]).map(h => String(h ?? "").trim());
  const symCol    = findCol(rawHeaders, "symbol", "ticker", "stock");
  const dateCol   = findCol(rawHeaders, "date", "trade date", "trading date");
  const closeCol  = findCol(rawHeaders, "close", "closing", "last price");
  const openCol   = findCol(rawHeaders, "open", "opening");
  const highCol   = findCol(rawHeaders, "high");
  const lowCol    = findCol(rawHeaders, "low");
  const volCol    = findCol(rawHeaders, "volume", "vol");

  const rows: PriceRow[] = [];

  for (let i = 1; i < json.length; i++) {
    const row = json[i] as any[];

    if (!row || row.every(c => c === "" || c === null || c === undefined)) continue;

    const symbol = symCol >= 0 ? String(row[symCol] ?? "").trim().toUpperCase() : "";
    const rawDate = dateCol >= 0 ? row[dateCol] : "";
    const rawClose = closeCol >= 0 ? row[closeCol] : "";

    if (!symbol) { rows.push({ symbol: "", date: "", close: 0, error: `Row ${i + 1}: missing symbol` }); continue; }
    if (!rawDate) { rows.push({ symbol, date: "", close: 0, error: `Row ${i + 1}: missing date` }); continue; }

    const date = normaliseDate(rawDate);
    if (!date) { rows.push({ symbol, date: "", close: 0, error: `Row ${i + 1}: invalid date '${rawDate}'` }); continue; }

    const close = parseNumber(rawClose);
    if (close === undefined || close <= 0) { rows.push({ symbol, date, close: 0, error: `Row ${i + 1}: invalid close price '${rawClose}'` }); continue; }

    rows.push({
      symbol,
      date,
      close,
      open:   openCol  >= 0 ? parseNumber(row[openCol])  : undefined,
      high:   highCol  >= 0 ? parseNumber(row[highCol])  : undefined,
      low:    lowCol   >= 0 ? parseNumber(row[lowCol])   : undefined,
      volume: volCol   >= 0 ? parseNumber(row[volCol])   : undefined,
    });
  }

  return rows;
}

/** Parse CSV buffer */
export function parseCsvBuffer(buffer: Buffer): PriceRow[] {
  const wb = XLSX.read(buffer, { type: "buffer", raw: false, cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return parseSheetRows(sheet);
}

/** Parse Excel buffer */
export function parseXlsxBuffer(buffer: Buffer): PriceRow[] {
  const wb = XLSX.read(buffer, { type: "buffer", raw: false, cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return parseSheetRows(sheet);
}

/** Extract price data from PDF using GPT-4o vision */
export async function parsePdfBuffer(buffer: Buffer, filename?: string): Promise<PriceRow[]> {
  const base64 = buffer.toString("base64");

  const systemPrompt = `You are a financial data extraction engine. 
Extract NGX (Nigerian Exchange Group) equity price data from the provided document image.
Return ONLY a JSON array of objects with these fields:
  symbol (string, NGX ticker),
  date (string, YYYY-MM-DD),
  open (number, Naira, optional),
  high (number, Naira, optional),
  low (number, Naira, optional),
  close (number, Naira, required),
  volume (integer, number of shares, optional)
Return [] if no price data found. No markdown, no explanation — pure JSON array.`;

  try {
    const openai = await getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: systemPrompt },
            {
              type: "image_url",
              image_url: {
                url: `data:application/pdf;base64,${base64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("[CIEIngest] GPT-4o returned invalid JSON for PDF");
      return [];
    }

    // GPT may return { rows: [...] } or { data: [...] } or just an array wrapped in an object
    const arr: any[] = Array.isArray(parsed) ? parsed : (parsed.rows ?? parsed.data ?? parsed.prices ?? []);

    return arr.filter(Boolean).map((r: any) => {
      const symbol = String(r.symbol ?? "").trim().toUpperCase();
      const date = normaliseDate(r.date ?? "") ?? "";
      const close = parseNumber(r.close);

      if (!symbol || !date || close === undefined || close <= 0) {
        return { symbol, date, close: 0, error: `GPT row invalid: ${JSON.stringify(r)}` };
      }

      return {
        symbol,
        date,
        close,
        open:   parseNumber(r.open),
        high:   parseNumber(r.high),
        low:    parseNumber(r.low),
        volume: r.volume !== undefined ? Math.round(parseNumber(r.volume) ?? 0) : undefined,
      };
    });
  } catch (err: any) {
    console.error("[CIEIngest] PDF extraction failed:", err.message);
    return [];
  }
}

/**
 * Build a preview result from parsed rows.
 * Validates dates, checks symbols against master list, deduplicates.
 */
export async function buildPreview(
  format: "csv" | "xlsx" | "pdf",
  rows: PriceRow[]
): Promise<IngestPreviewResult> {
  // Load master securities list for symbol validation
  const securities = await storage.listCieSecurities(false);
  const knownSymbols = new Set(securities.map(s => s.symbol));

  const acceptedRows: PriceRow[] = [];
  const rejectedRows: PriceRow[] = [];
  const flaggedSymbols = new Set<string>();

  // Deduplicate by symbol+date (latest row wins)
  const seen = new Map<string, PriceRow>();

  for (const row of rows) {
    if (row.error) {
      rejectedRows.push(row);
      continue;
    }

    if (!row.symbol || !row.date || row.close <= 0) {
      rejectedRows.push({ ...row, error: "Missing required fields (symbol, date, or close price)" });
      continue;
    }

    // Flag unknown symbols but still accept (admin may want to add security)
    if (!knownSymbols.has(row.symbol)) {
      flaggedSymbols.add(row.symbol);
    }

    const key = `${row.symbol}::${row.date}`;
    seen.set(key, row); // last occurrence wins for same symbol+date
  }

  acceptedRows.push(...seen.values());

  return {
    format,
    rowsExtracted: rows.length,
    rowsAccepted: acceptedRows.length,
    rowsRejected: rejectedRows.length,
    rowsFlagged: flaggedSymbols.size,
    acceptedRows,
    rejectedRows,
    flaggedSymbols: [...flaggedSymbols],
    preview: acceptedRows.slice(0, 20),
  };
}

/**
 * Commit accepted rows to the database.
 * Only writes rows for known symbols (flags are informational).
 * Returns the ingestion log ID.
 */
export async function commitRows(
  preview: IngestPreviewResult,
  uploadedByUserId: string,
  filename?: string
): Promise<{ logId: number; committed: number; skipped: number }> {
  // Create ingestion log (pending → committed)
  const log = await storage.createCieIngestionLog({
    format: preview.format,
    dataType: "prices",
    filename: filename ?? null,
    rowsExtracted: preview.rowsExtracted,
    rowsAccepted: preview.rowsAccepted,
    rowsRejected: preview.rowsRejected,
    rowsFlagged: preview.rowsFlagged,
    status: "committing",
    uploadedByUserId,
  });

  const securities = await storage.listCieSecurities(false);
  const symbolToId = new Map(securities.map(s => [s.symbol, s.id]));

  let committed = 0;
  let skipped = 0;

  for (const row of preview.acceptedRows) {
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
    } catch (err: any) {
      console.error(`[CIEIngest] Error committing row ${row.symbol} ${row.date}:`, err.message);
      skipped++;
    }
  }

  await storage.updateCieIngestionLog(log.id, {
    status: "committed",
    rowsAccepted: committed,
    rowsRejected: preview.rowsRejected + skipped,
    committedAt: new Date(),
    triggeredRecomputation: true,
  });

  return { logId: log.id, committed, skipped };
}
