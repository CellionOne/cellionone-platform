/**
 * CIE Report Generator — APRISYS NGX100 Daily Excel Report
 *
 * Generates a 4-sheet workbook following the APRISYS NGX100 spec:
 *   Sheet 1 — NGX Performance (all securities with signals/recommendations)
 *   Sheet 2 — Market Movers & Alerts (top/bottom 5, volume leaders)
 *   Sheet 3 — Sector Summary
 *   Sheet 4 — Dividend Calendar
 *
 * Uses xlsx library (already installed).
 */

import * as XLSX from "xlsx";
import { db } from "../db";
import { cieSecurities, ngxDividends, cieReports } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { getSectorSummary } from "./cieProcessingService";

// ── In-memory report cache (keyed by report date string) ─────────────────────
const reportCache = new Map<string, Buffer>();

function koboToNaira(kobo: number | null | undefined): number | null {
  if (kobo == null) return null;
  return kobo / 100;
}

function fmtNaira(val: number | null | undefined): string {
  if (val == null) return "N/A";
  return `₦${val.toFixed(2)}`;
}

function fmtPct(val: number | string | null | undefined): string {
  if (val == null) return "N/A";
  return `${parseFloat(String(val)).toFixed(2)}%`;
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function dividendStrategy(daysLeft: number): string {
  if (daysLeft < 0) return "Passed";
  if (daysLeft <= 7) return "Accumulate before qual";
  return "Monitor";
}

// ── Sheet 1: NGX Performance ─────────────────────────────────────────────────
function buildPerformanceSheet(securities: any[], dateStr: string): XLSX.WorkSheet {
  const headers = [
    "Ticker", "Company", "Sector", "Close ₦", "Day%", "Wk%",
    "Mo%", "YTD%", "D-Sig", "Rec", "RSI", "Investment Intel",
  ];

  // Gainers / losers summary
  const withDay = securities.filter(s => s.dayChangePct != null);
  const gainers = withDay.filter(s => parseFloat(String(s.dayChangePct)) > 0).length;
  const losers = withDay.filter(s => parseFloat(String(s.dayChangePct)) < 0).length;
  const unchanged = securities.length - gainers - losers;
  const totalVolume = securities.reduce((sum, s) => sum + (s.latestVolume ?? 0), 0);

  const rows: (string | number)[][] = [];

  // Row 1: merged header
  rows.push([`APRISYS NGX100 DAILY REPORT — ${dateStr}`, "", "", "", "", "", "", "", "", "", "", ""]);
  // Row 2: market summary
  rows.push([
    `Gainers: ${gainers} | Losers: ${losers} | Unchanged: ${unchanged} | Total Volume: ${totalVolume.toLocaleString()}`,
    "", "", "", "", "", "", "", "", "", "", "",
  ]);
  // Row 3: spacer
  rows.push(["", "", "", "", "", "", "", "", "", "", "", ""]);
  // Row 4: column headers
  rows.push(headers);

  for (const s of securities) {
    rows.push([
      s.symbol,
      s.name,
      s.sector,
      s.lastPriceKobo != null ? s.lastPriceKobo / 100 : "N/A",
      s.dayChangePct != null ? parseFloat(String(s.dayChangePct)) : "N/A",
      s.weekChangePct != null ? parseFloat(String(s.weekChangePct)) : "N/A",
      s.monthChangePct != null ? parseFloat(String(s.monthChangePct)) : "N/A",
      s.ytdChangePct != null ? parseFloat(String(s.ytdChangePct)) : "N/A",
      s.signal ?? "─",
      s.recommendation ?? "N/A",
      s.rsi != null ? parseFloat(String(s.rsi)) : "N/A",
      s.investmentIntel ?? "N/A",
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 10 }, { wch: 30 }, { wch: 20 }, { wch: 10 },
    { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
    { wch: 7 }, { wch: 8 }, { wch: 7 }, { wch: 55 },
  ];

  // Style header row (row 1, index 0) — dark navy
  applyRowStyle(ws, 0, securities.length + 4, { fill: "1A3A5C", font: "FFFFFF", bold: true });
  // Style summary bar (row 2, index 1) — amber
  applyRowStyle(ws, 1, securities.length + 4, { fill: "FFF3CD", font: "333333", bold: false });
  // Style column headers (row 4, index 3) — dark
  applyRowStyle(ws, 3, securities.length + 4, { fill: "2C3E50", font: "FFFFFF", bold: true });

  // Alternating row colours starting at row 5 (index 4)
  for (let i = 0; i < securities.length; i++) {
    const rowIdx = 4 + i;
    const fill = i % 2 === 0 ? "D6F0E0" : "FFF9E6";
    applyRowStyle(ws, rowIdx, securities.length + 4, { fill, font: "333333", bold: false });
  }

  // Merge title row
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } }];

  return ws;
}

// ── Sheet 2: Market Movers & Alerts ──────────────────────────────────────────
function buildMoversSheet(securities: any[]): XLSX.WorkSheet {
  const withDay = securities
    .filter(s => s.dayChangePct != null)
    .map(s => ({ ...s, day: parseFloat(String(s.dayChangePct)) }));

  const sorted = [...withDay].sort((a, b) => b.day - a.day);
  const top5 = sorted.slice(0, 5);
  const bottom5 = sorted.slice(-5).reverse();
  const byVolume = [...securities]
    .filter(s => s.latestVolume != null)
    .sort((a, b) => (b.latestVolume ?? 0) - (a.latestVolume ?? 0))
    .slice(0, 5);

  const rows: (string | number)[][] = [];
  rows.push(["TOP 5 GAINERS", "", ""]);
  rows.push(["Ticker", "Company", "Day Change %"]);
  for (const s of top5) {
    rows.push([s.symbol, s.name, s.day]);
  }
  rows.push(["", "", ""]);
  rows.push(["TOP 5 LOSERS", "", ""]);
  rows.push(["Ticker", "Company", "Day Change %"]);
  for (const s of bottom5) {
    rows.push([s.symbol, s.name, s.day]);
  }
  rows.push(["", "", ""]);
  rows.push(["VOLUME LEADERS", "", ""]);
  rows.push(["Ticker", "Company", "Volume"]);
  for (const s of byVolume) {
    rows.push([s.symbol, s.name, s.latestVolume ?? 0]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, { wch: 35 }, { wch: 15 }];
  return ws;
}

// ── Sheet 3: Sector Summary ───────────────────────────────────────────────────
async function buildSectorSheet(): Promise<XLSX.WorkSheet> {
  const sectors = await getSectorSummary();
  const rows: (string | number)[][] = [];
  rows.push(["Sector", "Stock Count", "Avg Day%", "Avg Wk%", "Top Performer", "Analyst Note"]);
  for (const s of sectors) {
    rows.push([
      s.name,
      s.stockCount,
      s.avgDayChangePct,
      s.avgWeekChangePct,
      s.topPerformer ? `${s.topPerformer.ticker} +${s.topPerformer.dayChangePct.toFixed(2)}%` : "N/A",
      s.analystNote,
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 40 }];
  applyRowStyle(ws, 0, sectors.length + 1, { fill: "2C3E50", font: "FFFFFF", bold: true });
  return ws;
}

// ── Sheet 4: Dividend Calendar ────────────────────────────────────────────────
async function buildDividendSheet(): Promise<XLSX.WorkSheet> {
  const today = new Date().toISOString().slice(0, 10);
  const allDivs = await db
    .select()
    .from(ngxDividends)
    .where(eq(ngxDividends.isActive, true));

  const upcoming = allDivs.filter(d => d.qualificationDate >= today);

  const rows: (string | number)[][] = [];

  if (upcoming.length === 0) {
    rows.push(["No dividend data available for this period. Data will appear when corporate actions are received from the NGX feed."]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 90 }];
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
    return ws;
  }

  rows.push(["Ticker", "Company", "Dividend ₦", "Qual Date", "Days Left", "Payment Date", "Strategy"]);
  for (const d of upcoming) {
    const days = daysUntil(d.qualificationDate);
    rows.push([
      d.ticker,
      d.companyName,
      d.dividendAmountKobo / 100,
      d.qualificationDate,
      days,
      d.paymentDate ?? "N/A",
      dividendStrategy(days),
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 10 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 25 }];
  applyRowStyle(ws, 0, upcoming.length + 1, { fill: "2C3E50", font: "FFFFFF", bold: true });
  return ws;
}

// ── Style helper (minimal, compatible with xlsx) ──────────────────────────────
function applyRowStyle(ws: XLSX.WorkSheet, rowIdx: number, _totalRows: number, style: { fill: string; font: string; bold: boolean }): void {
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cellAddr = XLSX.utils.encode_cell({ r: rowIdx, c });
    if (!ws[cellAddr]) ws[cellAddr] = { t: "z", v: "" };
    ws[cellAddr].s = {
      fill: { fgColor: { rgb: style.fill }, patternType: "solid" },
      font: { bold: style.bold, color: { rgb: style.font } },
      alignment: { horizontal: "left", wrapText: true },
    };
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateAprisysReport(date: Date): Promise<Buffer> {
  const dateStr = date.toISOString().slice(0, 10);

  // Check cache
  const cached = reportCache.get(dateStr);
  if (cached) return cached;

  const securities = await db
    .select()
    .from(cieSecurities)
    .where(eq(cieSecurities.isActive, true));

  const wb = XLSX.utils.book_new();

  // Sheet 1
  const ws1 = buildPerformanceSheet(securities, dateStr);
  XLSX.utils.book_append_sheet(wb, ws1, "NGX Performance");

  // Sheet 2
  const ws2 = buildMoversSheet(securities);
  XLSX.utils.book_append_sheet(wb, ws2, "Market Movers");

  // Sheet 3
  const ws3 = await buildSectorSheet();
  XLSX.utils.book_append_sheet(wb, ws3, "Sector Summary");

  // Sheet 4
  const ws4 = await buildDividendSheet();
  XLSX.utils.book_append_sheet(wb, ws4, "Dividend Calendar");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  // Cache and return
  reportCache.set(dateStr, buf);

  // Update or insert report record
  const existing = await db
    .select({ id: cieReports.id })
    .from(cieReports)
    .where(eq(cieReports.reportDate, dateStr))
    .limit(1);

  if (existing[0]) {
    await db.update(cieReports).set({
      status: "complete",
      fileSize: buf.length,
      securitiesCount: securities.length,
      generatedAt: new Date(),
      errorMessage: null,
    }).where(eq(cieReports.id, existing[0].id));
  } else {
    await db.insert(cieReports).values({
      reportDate: dateStr,
      status: "complete",
      fileSize: buf.length,
      securitiesCount: securities.length,
    });
  }

  return buf;
}

export function invalidateReportCache(dateStr: string): void {
  reportCache.delete(dateStr);
}
