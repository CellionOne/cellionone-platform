/**
 * CIE Report Service — generates the Alpha Intel NGX 5-tab Excel report.
 *
 * Tab 1 — NGX Performance       : All securities with technical indicators + AI Intel text
 * Tab 2 — Investment Recommendations : Grouped by category with entry zone, target, AI thesis
 * Tab 3 — Market Movers & Key Alerts : Top/bottom 8 by day change + macro context + AI alerts
 * Tab 4 — Sector Summary        : Sector-level aggregation with AI notes
 * Tab 5 — Dividend Intelligence : Active dividends with behaviour pattern, entry/exit signals
 */

import * as XLSX from "xlsx";
import { storage } from "../storage";
import { isOpenAIAvailable } from "./aiService";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function koboToNaira(kobo: number | null | undefined): number | null {
  if (kobo == null) return null;
  return kobo / 100;
}

function bpsToPercent(bps: number | null | undefined): string {
  if (bps == null) return "N/A";
  return (bps / 100).toFixed(2) + "%";
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function divUrgencyAction(daysLeft: number): string {
  if (daysLeft < 0) return "PASSED";
  if (daysLeft <= 3) return "BUY NOW";
  if (daysLeft <= 7) return "URGENT BUY";
  if (daysLeft <= 14) return "ACCUMULATE";
  if (daysLeft <= 21) return "WATCH";
  return "MONITOR";
}

function sectorTrend(avgDayReturnBps: number): string {
  if (avgDayReturnBps > 100) return "Bullish";
  if (avgDayReturnBps < -100) return "Bearish";
  return "Neutral";
}

/** Apply simple cell styling using comment convention — used for header rows */
function applyHeaderStyle(ws: XLSX.WorkSheet, range: string, bgColor: string) {
  // XLSX.utils style — basic approach for compatibility
  const ref = XLSX.utils.decode_range(range);
  for (let r = ref.s.r; r <= ref.e.r; r++) {
    for (let c = ref.s.c; c <= ref.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell) {
        cell.s = {
          fill: { fgColor: { rgb: bgColor }, patternType: "solid" },
          font: { bold: true, color: { rgb: "FFFFFF" } },
          alignment: { horizontal: "center", wrapText: true },
        };
      }
    }
  }
}

// ─── AI text generation (with graceful fallback) ──────────────────────────────

interface SecurityForAI {
  ticker: string;
  name: string;
  sector: string;
  ias: number;
  rs: number;
  recommendation: string;
  closeNaira: number | null;
  rsi14: number | null;
  weekReturnBps: number | null;
  monthReturnBps: number | null;
  entryLow: number | null;
  entryHigh: number | null;
  targetPrice: number | null;
  divDaysLeft: number | null;
  divAmountNaira: number | null;
}

type AITextResult = { intelText: string; thesisText: string };

async function generateBatchAIText(
  securities: SecurityForAI[]
): Promise<Map<string, AITextResult>> {
  const results = new Map<string, AITextResult>();

  if (!isOpenAIAvailable() || securities.length === 0) {
    for (const s of securities) {
      results.set(s.ticker, {
        intelText: buildFallbackIntel(s),
        thesisText: buildFallbackThesis(s),
      });
    }
    return results;
  }

  // Batch up to 15 securities per request to avoid timeout
  const BATCH_SIZE = 15;
  for (let i = 0; i < securities.length; i += BATCH_SIZE) {
    const batch = securities.slice(i, i + BATCH_SIZE);
    try {
      const { OpenAI } = await import("openai");
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY,
        ...(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ? { baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL } : {}),
      });

      const prompt = `You are a Nigerian equities research analyst. For each of the following NGX securities, provide:
1. "intelText": A concise 1-2 sentence market intelligence note (max 200 chars) summarising price momentum, risk posture, and near-term outlook.
2. "thesisText": A concise investment thesis (max 250 chars) highlighting valuation, catalysts, and recommendation rationale.

Respond ONLY with a JSON object mapping ticker to { intelText, thesisText }.

Securities:
${batch.map(s => `
Ticker: ${s.ticker} | Name: ${s.name} | Sector: ${s.sector}
IAS: ${s.ias} | RS: ${s.rs} | Rec: ${s.recommendation}
Close: ₦${s.closeNaira?.toFixed(2) ?? "N/A"} | RSI: ${s.rsi14 ?? "N/A"}
Week%: ${bpsToPercent(s.weekReturnBps)} | Month%: ${bpsToPercent(s.monthReturnBps)}
${s.divDaysLeft !== null ? `Div ex-date: ${s.divDaysLeft} days | Div: ₦${s.divAmountNaira?.toFixed(4) ?? "N/A"}` : ""}
${s.entryLow !== null ? `Entry Zone: ₦${s.entryLow?.toFixed(2)}-₦${s.entryHigh?.toFixed(2)} | Target: ₦${s.targetPrice?.toFixed(2) ?? "N/A"}` : ""}
`).join("\n---\n")}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.4,
        max_tokens: 2000,
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}");
      for (const s of batch) {
        const entry = parsed[s.ticker];
        results.set(s.ticker, {
          intelText: entry?.intelText ?? buildFallbackIntel(s),
          thesisText: entry?.thesisText ?? buildFallbackThesis(s),
        });
      }
    } catch {
      for (const s of batch) {
        results.set(s.ticker, {
          intelText: buildFallbackIntel(s),
          thesisText: buildFallbackThesis(s),
        });
      }
    }
  }

  return results;
}

export async function generateSectorAINote(
  sector: string,
  avgIas: number,
  trend: string,
  topMovers: string,
  divAngle: string
): Promise<string> {
  if (!isOpenAIAvailable()) {
    return `${sector}: IAS ${avgIas} (${trend}). Key movers: ${topMovers}. ${divAngle}`;
  }
  try {
    const { OpenAI } = await import("openai");
    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY,
      ...(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ? { baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL } : {}),
    });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `Write a 1-sentence Alpha Intel sector note (max 200 chars) for the NGX ${sector} sector.
Avg IAS: ${avgIas}, Trend: ${trend}, Key movers: ${topMovers}, Dividend angle: ${divAngle}.
Be specific, professional, and data-driven.`,
      }],
      temperature: 0.4,
      max_tokens: 100,
    });
    return response.choices[0]?.message?.content?.trim() ?? `${sector}: ${trend} momentum, IAS ${avgIas}.`;
  } catch {
    return `${sector}: ${trend} momentum, avg IAS ${avgIas}. Key movers: ${topMovers}.`;
  }
}

async function generateKeyAlerts(
  marketContextSummary: string,
  topGainers: string,
  topLosers: string,
  divUrgent: string,
  rsiExtremes: string,
  recChanges: string
): Promise<string> {
  if (!isOpenAIAvailable()) {
    return `Key alerts: Top gainers: ${topGainers}. Top losers: ${topLosers}. Dividend urgency: ${divUrgent}.`;
  }
  try {
    const { OpenAI } = await import("openai");
    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY,
      ...(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ? { baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL } : {}),
    });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `Generate 3 concise market key alerts for NGX today (each max 150 chars, bullet format).
Market context: ${marketContextSummary}
Top gainers: ${topGainers}
Top losers: ${topLosers}
Dividend urgency: ${divUrgent}
RSI extremes: ${rsiExtremes}
Recommendation changes: ${recChanges}
Return only the 3 bullet points as plain text, one per line.`,
      }],
      temperature: 0.5,
      max_tokens: 200,
    });
    return response.choices[0]?.message?.content?.trim() ?? "";
  } catch {
    return `• ${topGainers}\n• ${topLosers}\n• ${divUrgent}`;
  }
}

function buildFallbackIntel(s: SecurityForAI): string {
  const rsiNote = s.rsi14 !== null
    ? (s.rsi14 > 70 ? "Overbought territory." : s.rsi14 < 30 ? "Oversold — potential reversal." : `RSI at ${s.rsi14}.`)
    : "";
  return `${s.recommendation} — IAS ${s.ias}. Week: ${bpsToPercent(s.weekReturnBps)}. ${rsiNote}`.slice(0, 200);
}

function buildFallbackThesis(s: SecurityForAI): string {
  const entryNote = s.entryLow !== null
    ? ` Entry zone ₦${s.entryLow?.toFixed(2)}–₦${s.entryHigh?.toFixed(2)}.`
    : "";
  return `${s.name} rated ${s.recommendation} with IAS ${s.ias}/100.${entryNote} Target: ₦${s.targetPrice?.toFixed(2) ?? "analyst TBD"}.`.slice(0, 250);
}

// ─── Report Cache ─────────────────────────────────────────────────────────────
// Holds the last successfully generated report buffer so that the admin download
// endpoint can serve a cached version immediately after an ingest + score run.

let _cachedReportBuf: Buffer | null = null;
let _cachedReportDate: string | null = null;

export function getCachedAlphaIntelReport(): { buf: Buffer; date: string } | null {
  if (_cachedReportBuf && _cachedReportDate) {
    return { buf: _cachedReportBuf, date: _cachedReportDate };
  }
  return null;
}

export function setCachedAlphaIntelReport(buf: Buffer): void {
  _cachedReportBuf = buf;
  _cachedReportDate = new Date().toISOString().slice(0, 10);
}

// ─── Main Report Generator ────────────────────────────────────────────────────

export async function generateAlphaIntelReport(): Promise<Buffer> {
  const today = new Date().toISOString().slice(0, 10);

  // Load all data in parallel
  const [allScores, allSecurities, allDividends, marketCtx] = await Promise.all([
    storage.getLatestCieScores(),
    storage.listCieSecurities(false),
    storage.listCieDividends(true), // upcoming only — exclude historical/stale rows
    storage.getLatestCieMarketContext(),
  ]);

  // Build a map of securityId → security for quick lookup
  const secById = new Map(allSecurities.map(s => [s.id, s]));

  // Build a map of securityId → nearest upcoming dividend (smallest future ex-date)
  const divBySecId = new Map<number, (typeof allDividends)[0]>();
  for (const d of allDividends) {
    const existing = divBySecId.get(d.securityId);
    if (!existing || d.exDividendDate < existing.exDividendDate) {
      divBySecId.set(d.securityId, d);
    }
  }

  // Fetch latest prices for all active securities in ONE query
  const allLatestPrices = await storage.listLatestCiePricesAllActive();
  // Map securityId → { closeKobo, openKobo } for Day% computation
  const priceDetailBySecId = new Map(allLatestPrices.map(p => [p.securityId, p]));

  // Enrich scores with security extra fields
  type EnrichedScore = (typeof allScores)[0] & {
    divBehaviourPattern: string | null;
    entryZoneLowKobo: number | null;
    entryZoneHighKobo: number | null;
    targetPriceKobo: number | null;
    divDaysLeft: number | null;
    divAmountKobo: number | null;
    divExDate: string | null;
    divPayDate: string | null;
  };

  const enriched: EnrichedScore[] = allScores.map(score => {
    const sec = secById.get(score.securityId);
    const div = divBySecId.get(score.securityId);
    const divDaysLeft = div ? daysUntil(div.exDividendDate) : null;
    return {
      ...score,
      divBehaviourPattern: sec?.divBehaviourPattern ?? null,
      entryZoneLowKobo: sec?.entryZoneLowKobo ?? null,
      entryZoneHighKobo: sec?.entryZoneHighKobo ?? null,
      targetPriceKobo: sec?.targetPriceKobo ?? null,
      divDaysLeft,
      divAmountKobo: div?.amountPerShareKobo ?? null,
      divExDate: div?.exDividendDate ?? null,
      divPayDate: div?.paymentDate ?? null,
    };
  });

  // Convenience map for legacy use (closeKobo only)
  const priceBySecId = new Map<number, number>(
    allLatestPrices.map(p => [p.securityId, p.closeKobo])
  );

  /** Compute Day% from actual open/close. Returns "N/A" if data unavailable. */
  function dayPctStr(securityId: number): string {
    const pd = priceDetailBySecId.get(securityId);
    if (!pd || !pd.openKobo || pd.openKobo === 0) {
      // Fallback: use directional signal only (no magnitude)
      return "N/A";
    }
    const pct = ((pd.closeKobo - pd.openKobo) / pd.openKobo) * 100;
    return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
  }

  /** Numeric day% for sorting (null if unavailable). */
  function dayPctNum(securityId: number): number | null {
    const pd = priceDetailBySecId.get(securityId);
    if (!pd || !pd.openKobo || pd.openKobo === 0) return null;
    return ((pd.closeKobo - pd.openKobo) / pd.openKobo) * 100;
  }

  // Build AI input list
  const aiInputs: SecurityForAI[] = enriched.map(s => ({
    ticker: s.symbol,
    name: s.name,
    sector: s.sector,
    ias: s.ias ?? 0,
    rs: s.rs ?? 0,
    recommendation: s.recommendation ?? "Hold",
    closeNaira: koboToNaira(priceBySecId.get(s.securityId)),
    rsi14: s.rsi14 ?? null,
    weekReturnBps: s.weekReturn ?? null,
    monthReturnBps: s.monthReturn ?? null,
    entryLow: koboToNaira(s.entryZoneLowKobo),
    entryHigh: koboToNaira(s.entryZoneHighKobo),
    targetPrice: koboToNaira(s.targetPriceKobo),
    divDaysLeft: s.divDaysLeft,
    divAmountNaira: koboToNaira(s.divAmountKobo),
  }));

  // Generate all AI texts
  const aiTexts = await generateBatchAIText(aiInputs);

  // ─── Create workbook ──────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 1 — NGX Performance
  // ═══════════════════════════════════════════════════════════════════════════

  // Sort: by sector, then IAS descending within sector
  const tab1Data = [...enriched].sort((a, b) => {
    const sc = a.sector.localeCompare(b.sector);
    if (sc !== 0) return sc;
    return (b.ias ?? 0) - (a.ias ?? 0);
  });

  const tab1Headers = [
    "#", "Ticker", "Company", "Sector", "Close (₦)", "Day%", "Wk%", "Mo%", "YTD%",
    "D-Sig", "W-Sig", "M-Sig", "Y-Sig", "Stars", "Rec", "RSI",
    "50MA (₦)", "vs MA50", "Intel / Commentary",
  ];

  const tab1Rows = tab1Data.map((s, idx) => {
    const closeN = koboToNaira(priceBySecId.get(s.securityId));
    const ma50N = koboToNaira(s.ma50Kobo);
    const intel = aiTexts.get(s.symbol)?.intelText ?? buildFallbackIntel({
      ticker: s.symbol, name: s.name, sector: s.sector,
      ias: s.ias ?? 0, rs: s.rs ?? 0, recommendation: s.recommendation ?? "Hold",
      closeNaira: closeN, rsi14: s.rsi14 ?? null,
      weekReturnBps: s.weekReturn ?? null, monthReturnBps: s.monthReturn ?? null,
      entryLow: null, entryHigh: null, targetPrice: null, divDaysLeft: null, divAmountNaira: null,
    });
    const starsStr = s.stars ? "⭐".repeat(s.stars) : "-";
    return [
      idx + 1,
      s.symbol,
      s.name,
      s.sector,
      closeN?.toFixed(2) ?? "N/A",
      dayPctStr(s.securityId),
      bpsToPercent(s.weekReturn),
      bpsToPercent(s.monthReturn),
      bpsToPercent(s.ytdReturn),
      s.dSig ?? "─",
      s.wSig ?? "─",
      s.mSig ?? "─",
      s.ySig ?? "─",
      starsStr,
      s.recommendation ?? "Hold",
      s.rsi14 ?? "N/A",
      ma50N?.toFixed(2) ?? "N/A",
      s.aboveMa50 === true ? "ABOVE" : s.aboveMa50 === false ? "BELOW" : "N/A",
      intel,
    ];
  });

  const tab1WS = XLSX.utils.aoa_to_sheet([
    [`Alpha Intel — NGX Performance Report | Generated: ${today}`],
    [],
    tab1Headers,
    ...tab1Rows,
  ]);

  // Column widths
  tab1WS["!cols"] = [
    { wch: 4 }, { wch: 8 }, { wch: 30 }, { wch: 20 },
    { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
    { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 },
    { wch: 8 }, { wch: 12 }, { wch: 6 }, { wch: 10 }, { wch: 8 }, { wch: 50 },
  ];
  XLSX.utils.book_append_sheet(wb, tab1WS, "NGX Performance");

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 2 — Investment Recommendations
  // ═══════════════════════════════════════════════════════════════════════════

  const categories = [
    { label: "🔴 STRONG BUY", filter: (s: EnrichedScore) => s.recommendation === "Strong Buy" },
    {
      label: "💰 DIVIDEND URGENCY",
      filter: (s: EnrichedScore) => s.divDaysLeft !== null && s.divDaysLeft >= 0 && s.divDaysLeft <= 14,
    },
    { label: "🟢 ACCUMULATE", filter: (s: EnrichedScore) => s.recommendation === "Accumulate" },
    { label: "🟡 MONITOR / HOLD", filter: (s: EnrichedScore) => s.recommendation === "Hold" },
    { label: "🔵 REDUCE / AVOID", filter: (s: EnrichedScore) => s.recommendation === "Reduce" || s.recommendation === "Sell" },
  ];

  const tab2Rows: (string | number | null)[][] = [
    [`Alpha Intel — Investment Recommendations | ${today}`],
    [],
  ];
  const recHeaders = ["Ticker", "Company", "Sector", "Close (₦)", "Entry Low (₦)", "Entry High (₦)", "Target (₦)", "Stars", "Div Days", "Investment Thesis"];

  for (const cat of categories) {
    const items = enriched.filter(cat.filter);
    if (items.length === 0) continue;
    tab2Rows.push([cat.label]);
    tab2Rows.push(recHeaders);
    for (const s of items) {
      const closeN = koboToNaira(priceBySecId.get(s.securityId));
      const thesis = aiTexts.get(s.symbol)?.thesisText ?? buildFallbackThesis({
        ticker: s.symbol, name: s.name, sector: s.sector,
        ias: s.ias ?? 0, rs: s.rs ?? 0, recommendation: s.recommendation ?? "Hold",
        closeNaira: closeN, rsi14: s.rsi14 ?? null,
        weekReturnBps: s.weekReturn ?? null, monthReturnBps: s.monthReturn ?? null,
        entryLow: koboToNaira(s.entryZoneLowKobo), entryHigh: koboToNaira(s.entryZoneHighKobo),
        targetPrice: koboToNaira(s.targetPriceKobo), divDaysLeft: s.divDaysLeft, divAmountNaira: koboToNaira(s.divAmountKobo),
      });
      tab2Rows.push([
        s.symbol,
        s.name,
        s.sector,
        closeN?.toFixed(2) ?? "N/A",
        koboToNaira(s.entryZoneLowKobo)?.toFixed(2) ?? "N/A",
        koboToNaira(s.entryZoneHighKobo)?.toFixed(2) ?? "N/A",
        koboToNaira(s.targetPriceKobo)?.toFixed(2) ?? "N/A",
        s.stars ? "⭐".repeat(s.stars) : "-",
        s.divDaysLeft !== null ? String(s.divDaysLeft) : "N/A",
        thesis,
      ]);
    }
    tab2Rows.push([]);
  }

  const tab2WS = XLSX.utils.aoa_to_sheet(tab2Rows);
  tab2WS["!cols"] = [
    { wch: 8 }, { wch: 30 }, { wch: 20 }, { wch: 10 },
    { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 60 },
  ];
  XLSX.utils.book_append_sheet(wb, tab2WS, "Investment Recommendations");

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 3 — Market Movers & Key Alerts
  // ═══════════════════════════════════════════════════════════════════════════

  // Sort by actual Day% (close vs open) for gainers/losers; fall back to weekReturn if no open data
  const withDayPct = enriched.map(s => ({ ...s, _dayPct: dayPctNum(s.securityId) ?? (s.weekReturn ?? 0) / 100 }));
  const sortedByDay = [...withDayPct].sort((a, b) => b._dayPct - a._dayPct);
  const top8Gainers = sortedByDay.slice(0, 8);
  const top8Losers = sortedByDay.slice(-8).reverse();

  // Macro context
  const asiClose = marketCtx ? (marketCtx.asiCloseKobo ? (marketCtx.asiCloseKobo / 100).toFixed(2) : "N/A") : "N/A";
  const asiChangePct = marketCtx ? bpsToPercent(marketCtx.asiChangePctBps) : "N/A";
  const brentUsd = marketCtx ? (marketCtx.brentUsdCents ? (marketCtx.brentUsdCents / 100).toFixed(2) : "N/A") : "N/A";
  const ngnUsd = marketCtx ? (marketCtx.ngnPerUsd ? (marketCtx.ngnPerUsd / 100).toFixed(2) : "N/A") : "N/A";
  const cbnMpr = marketCtx ? (marketCtx.cbnMprBps ? (marketCtx.cbnMprBps / 100).toFixed(2) + "%" : "N/A") : "N/A";
  const gainers = marketCtx?.gainersCount ?? enriched.filter(s => dayPctNum(s.securityId) !== null ? (dayPctNum(s.securityId)! > 0) : (s.weekReturn ?? 0) > 0).length;
  const losers = marketCtx?.losersCount ?? enriched.filter(s => dayPctNum(s.securityId) !== null ? (dayPctNum(s.securityId)! < 0) : (s.weekReturn ?? 0) < 0).length;

  // Notable recommendations: Strong Buy / Strong Sell / highest-star securities
  const strongBuys = enriched.filter(s => s.recommendation === "Strong Buy").slice(0, 3);
  const strongSells = enriched.filter(s => s.recommendation === "Strong Sell").slice(0, 3);
  const notableRecs = [
    ...strongBuys.map(s => `${s.symbol} Strong Buy (IAS ${s.ias}★${s.stars ?? ""})`),
    ...strongSells.map(s => `${s.symbol} Strong Sell (IAS ${s.ias})`),
  ].join(", ") || enriched
    .filter(s => (s.stars ?? 0) >= 4)
    .slice(0, 3)
    .map(s => `${s.symbol} ${s.recommendation} ★${s.stars}`)
    .join(", ") || "None";

  // AI alerts
  const alertsText = await generateKeyAlerts(
    `ASI: ${asiClose} (${asiChangePct}), Brent: $${brentUsd}, NGN/USD: ${ngnUsd}`,
    top8Gainers.slice(0, 3).map(s => `${s.symbol} ${dayPctStr(s.securityId)}`).join(", "),
    top8Losers.slice(0, 3).map(s => `${s.symbol} ${dayPctStr(s.securityId)}`).join(", "),
    enriched.filter(s => s.divDaysLeft !== null && s.divDaysLeft >= 0 && s.divDaysLeft <= 7)
      .map(s => `${s.symbol} (${s.divDaysLeft}d)`).join(", ") || "None",
    enriched.filter(s => s.rsi14 !== null && (s.rsi14 > 70 || s.rsi14 < 30))
      .map(s => `${s.symbol} RSI${s.rsi14}`).join(", ") || "None",
    notableRecs
  );

  const moverHeaders = ["#", "Ticker", "Company", "Sector", "Close (₦)", "Day%", "Wk%", "Mo%", "RSI", "Rec"];
  const tab3Rows: (string | number | null)[][] = [
    [`Alpha Intel — Market Movers & Key Alerts | ${today}`],
    [],
    ["📊 MARKET CONTEXT"],
    ["ASI Close", asiClose, "ASI Change", asiChangePct, "Gainers", String(gainers), "Losers", String(losers)],
    ["Brent Crude (USD)", `$${brentUsd}`, "NGN/USD", ngnUsd, "CBN MPR", cbnMpr],
    [],
    ["📈 TOP 8 GAINERS (Day%)"],
    moverHeaders,
    ...top8Gainers.map((s, i) => [
      i + 1, s.symbol, s.name, s.sector,
      koboToNaira(priceBySecId.get(s.securityId))?.toFixed(2) ?? "N/A",
      dayPctStr(s.securityId), bpsToPercent(s.weekReturn), bpsToPercent(s.monthReturn),
      s.rsi14 ?? "N/A", s.recommendation ?? "Hold",
    ]),
    [],
    ["📉 TOP 8 LOSERS (Day%)"],
    moverHeaders,
    ...top8Losers.map((s, i) => [
      i + 1, s.symbol, s.name, s.sector,
      koboToNaira(priceBySecId.get(s.securityId))?.toFixed(2) ?? "N/A",
      dayPctStr(s.securityId), bpsToPercent(s.weekReturn), bpsToPercent(s.monthReturn),
      s.rsi14 ?? "N/A", s.recommendation ?? "Hold",
    ]),
    [],
    ["🔔 KEY ALERTS & ANALYST NOTES"],
    ...alertsText.split("\n").map(line => [line]),
  ];

  const tab3WS = XLSX.utils.aoa_to_sheet(tab3Rows);
  tab3WS["!cols"] = [
    { wch: 4 }, { wch: 8 }, { wch: 30 }, { wch: 20 },
    { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 6 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, tab3WS, "Market Movers");

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 4 — Sector Summary
  // ═══════════════════════════════════════════════════════════════════════════

  const sectorMap = new Map<string, EnrichedScore[]>();
  for (const s of enriched) {
    if (!sectorMap.has(s.sector)) sectorMap.set(s.sector, []);
    sectorMap.get(s.sector)!.push(s);
  }

  const tab4Headers = ["Sector", "Active", "Trend", "Avg IAS", "Outlook", "Key Movers", "Div Angle", "AI Alpha Intel Notes"];
  const tab4Rows: (string | number | null)[][] = [
    [`Alpha Intel — Sector Summary | ${today}`],
    [],
    tab4Headers,
  ];

  for (const [sector, items] of Array.from(sectorMap.entries()).sort((a, b) => {
    const avgA = a[1].reduce((s, i) => s + (i.ias ?? 0), 0) / a[1].length;
    const avgB = b[1].reduce((s, i) => s + (i.ias ?? 0), 0) / b[1].length;
    return avgB - avgA;
  })) {
    const avgIas = Math.round(items.reduce((s, i) => s + (i.ias ?? 0), 0) / items.length);
    // Use actual Day% for trend when available; fall back to weekReturn
    const avgDayPct = items.length > 0
      ? items.reduce((acc, i) => acc + (dayPctNum(i.securityId) ?? (i.weekReturn ?? 0) / 100), 0) / items.length
      : 0;
    const trend = sectorTrend(Math.round(avgDayPct * 100)); // convert to bps for sectorTrend

    const topMovers = [...items]
      .sort((a, b) => Math.abs(dayPctNum(b.securityId) ?? (b.weekReturn ?? 0) / 100) - Math.abs(dayPctNum(a.securityId) ?? (a.weekReturn ?? 0) / 100))
      .slice(0, 2)
      .map(s => `${s.symbol} (${dayPctStr(s.securityId)})`)
      .join(", ") || "N/A";

    const sectorDivs = items.filter(s => s.divDaysLeft !== null && s.divDaysLeft >= 0 && s.divDaysLeft <= 30);
    const divAngle = sectorDivs.length > 0
      ? sectorDivs.map(s => `${s.symbol} ex ${s.divDaysLeft}d`).join(", ")
      : "No active dividends";

    const aiNote = await generateSectorAINote(sector, avgIas, trend, topMovers, divAngle);

    // Outlook: combine IAS threshold with trend direction
    const outlook =
      avgIas >= 65 && trend === "↑" ? "Strong Bullish" :
      avgIas >= 50 && trend !== "↓" ? "Bullish" :
      avgIas >= 40 ? "Neutral" :
      avgIas >= 25 && trend !== "↑" ? "Bearish" :
      "Strong Bearish";

    tab4Rows.push([sector, items.length, trend, avgIas, outlook, topMovers, divAngle, aiNote]);
  }

  const tab4WS = XLSX.utils.aoa_to_sheet(tab4Rows);
  tab4WS["!cols"] = [
    { wch: 25 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 16 },
    { wch: 30 }, { wch: 30 }, { wch: 60 },
  ];
  XLSX.utils.book_append_sheet(wb, tab4WS, "Sector Summary");

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 5 — Dividend Intelligence
  // ═══════════════════════════════════════════════════════════════════════════

  const divSecurities = enriched.filter(s => s.divExDate !== null);
  divSecurities.sort((a, b) => {
    if (a.divDaysLeft === null) return 1;
    if (b.divDaysLeft === null) return -1;
    return a.divDaysLeft - b.divDaysLeft;
  });

  const tab5Headers = [
    "Ticker", "Company", "Sector", "Close (₦)", "Div (₦/sh)", "Yield%",
    "Div Type", "Status", "Qual Date", "Pay Date", "Days Left",
    "Action", "Behaviour", "Entry Low (₦)", "Entry High (₦)", "Exit Signal", "AI Notes",
  ];

  const tab5Rows: (string | number | null)[][] = [
    [`Alpha Intel — Dividend Intelligence | ${today}`],
    [],
    tab5Headers,
  ];

  for (const s of divSecurities) {
    const closeKobo = priceBySecId.get(s.securityId) ?? null;
    const closeN = koboToNaira(closeKobo);
    const divN = koboToNaira(s.divAmountKobo);
    const yieldPct = closeKobo && s.divAmountKobo
      ? ((s.divAmountKobo / closeKobo) * 100).toFixed(2) + "%"
      : "N/A";
    const daysLeft = s.divDaysLeft;
    const action = daysLeft !== null ? divUrgencyAction(daysLeft) : "N/A";
    const exitSignal = s.rsi14 !== null && s.rsi14 > 68 ? "SELL POST-DIV" : "HOLD";
    const aiNote = aiTexts.get(s.symbol)?.intelText ?? "";

    tab5Rows.push([
      s.symbol,
      s.name,
      s.sector,
      closeN?.toFixed(2) ?? "N/A",
      divN?.toFixed(4) ?? "N/A",
      yieldPct,
      "CASH",               // NGX dividends are cash unless notes indicate otherwise
      daysLeft !== null && daysLeft <= 0 ? "Ex-Div" : daysLeft !== null && daysLeft <= 7 ? "Urgent" : "Upcoming",
      s.divExDate ?? "N/A",
      s.divPayDate ?? "N/A",
      daysLeft !== null ? String(daysLeft) : "N/A",
      action,
      s.divBehaviourPattern ?? "UNKNOWN",
      koboToNaira(s.entryZoneLowKobo)?.toFixed(2) ?? "N/A",
      koboToNaira(s.entryZoneHighKobo)?.toFixed(2) ?? "N/A",
      exitSignal,
      aiNote,
    ]);
  }

  const tab5WS = XLSX.utils.aoa_to_sheet(tab5Rows);
  tab5WS["!cols"] = [
    { wch: 8 }, { wch: 28 }, { wch: 18 }, { wch: 10 },
    { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
    { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 50 },
  ];
  XLSX.utils.book_append_sheet(wb, tab5WS, "Dividend Intelligence");

  // ─── Write workbook to buffer ─────────────────────────────────────────────
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return buf as Buffer;
}
