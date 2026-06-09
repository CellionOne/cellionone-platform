/**
 * CIE Processing Service
 *
 * Processes incoming CIE events from Icon eTrade and other sources.
 * Updates cie_securities with real-time price/signal data.
 * Provides sector aggregation for the new intelligence endpoints.
 */

import { db } from "../db";
import { cieEvents, cieSecurities, ngxDividends } from "@shared/schema";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import type { CieEvent } from "@shared/schema";

// ── Debounce queues ─────────────────────────────────────────────────────────
// 30-second debounce per ticker to batch rapid event streams
const recalcTimers = new Map<string, ReturnType<typeof setTimeout>>();
const RECALC_DEBOUNCE_MS = 30_000;

function scheduleSignalRecalc(ticker: string): void {
  const existing = recalcTimers.get(ticker);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(async () => {
    recalcTimers.delete(ticker);
    try {
      await recalcSignalsForTicker(ticker);
    } catch (err) {
      console.error(`[CIEProcessing] Signal recalc error for ${ticker}:`, err);
    }
  }, RECALC_DEBOUNCE_MS);
  recalcTimers.set(ticker, timer);
}

// ── Price signal helpers ─────────────────────────────────────────────────────

function computeSignal(dayChangePct: number): string {
  if (dayChangePct > 0.5) return "↑";
  if (dayChangePct < -0.5) return "↓";
  return "─";
}

function computeMomentum(dayChangePct: number): string {
  if (dayChangePct > 0.5) return "bullish";
  if (dayChangePct < -0.5) return "bearish";
  return "neutral";
}

function computeRecommendation(rsi: number, signal: string): string {
  if (rsi < 30 && signal === "↑") return "BUY";
  if (rsi > 70 && signal === "↓") return "REDUCE";
  return "HOLD";
}

function buildInvestmentIntel(rec: string, rsi: number, signal: string, closePriceNaira: number): string {
  const momentum = signal === "↑" ? "positive" : signal === "↓" ? "negative" : "neutral";
  return `${rec} · RSI ${rsi.toFixed(0)}. Momentum ${momentum}. Close ₦${closePriceNaira.toFixed(2)}.`;
}

// ── Simplified RSI(14) from last 14 price_update events for the ticker ───────
async function computeRsiFromEvents(ticker: string): Promise<number | null> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // last 30 days
  const rows = await db
    .select({ payload: cieEvents.payload, occurredAt: cieEvents.occurredAt })
    .from(cieEvents)
    .where(
      and(
        eq(cieEvents.ticker, ticker),
        eq(cieEvents.eventType, "price_update"),
        gte(cieEvents.occurredAt, since),
      )
    )
    .orderBy(desc(cieEvents.occurredAt))
    .limit(15);

  if (rows.length < 2) return null;

  // Extract close prices from payloads
  const prices: number[] = [];
  for (const r of rows) {
    const payload = r.payload as Record<string, unknown>;
    const price = typeof payload.price === "number" ? payload.price : null;
    if (price != null) prices.push(price);
  }

  if (prices.length < 2) return null;

  // Compute gains/losses from price series (oldest first)
  const reversed = [...prices].reverse();
  const changes = reversed.slice(1).map((p, i) => p - reversed[i]);
  const gains = changes.map(c => (c > 0 ? c : 0));
  const losses = changes.map(c => (c < 0 ? -c : 0));

  const avgGain = gains.reduce((a, b) => a + b, 0) / gains.length;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round(100 - 100 / (1 + rs));
}

// ── Core: recalculate signals for a ticker after debounce ────────────────────
async function recalcSignalsForTicker(ticker: string): Promise<void> {
  const [sec] = await db
    .select()
    .from(cieSecurities)
    .where(eq(cieSecurities.symbol, ticker))
    .limit(1);

  if (!sec || sec.lastPriceKobo == null) return;

  const rsiValue = await computeRsiFromEvents(ticker);
  const dayChangePctNum = sec.dayChangePct != null ? parseFloat(String(sec.dayChangePct)) : 0;
  const signal = computeSignal(dayChangePctNum);
  const momentum = computeMomentum(dayChangePctNum);
  const rsi = rsiValue ?? 50;
  const recommendation = computeRecommendation(rsi, signal);
  const closePriceNaira = sec.lastPriceKobo / 100;
  const intel = buildInvestmentIntel(recommendation, rsi, signal, closePriceNaira);

  await db
    .update(cieSecurities)
    .set({
      signal,
      momentum,
      rsi: String(rsi),
      recommendation,
      investmentIntel: intel,
      lastUpdatedAt: new Date(),
    })
    .where(eq(cieSecurities.symbol, ticker));
}

// ── Process a price_update event ─────────────────────────────────────────────
async function processPriceUpdate(event: CieEvent): Promise<void> {
  if (!event.ticker) return;

  const payload = event.payload as Record<string, unknown>;
  const priceKobo = typeof payload.price === "number" ? Math.round(payload.price * 100) : null;
  const volume = typeof payload.volume === "number" ? payload.volume : null;

  if (priceKobo == null) return;

  const [existing] = await db
    .select({ lastPriceKobo: cieSecurities.lastPriceKobo })
    .from(cieSecurities)
    .where(eq(cieSecurities.symbol, event.ticker))
    .limit(1);

  if (!existing) return; // ticker not in our universe

  const prevClose = existing.lastPriceKobo ?? priceKobo;
  const dayChangePct = prevClose !== 0
    ? parseFloat(((priceKobo - prevClose) / prevClose * 100).toFixed(2))
    : 0;

  const signal = computeSignal(dayChangePct);
  const momentum = computeMomentum(dayChangePct);

  await db
    .update(cieSecurities)
    .set({
      previousCloseKobo: prevClose,
      lastPriceKobo: priceKobo,
      dayChangePct: String(dayChangePct),
      signal,
      momentum,
      ...(volume != null ? { latestVolume: volume } : {}),
      lastUpdatedAt: new Date(),
    })
    .where(eq(cieSecurities.symbol, event.ticker));

  // Mark event processed
  await db
    .update(cieEvents)
    .set({ isProcessed: true, processedAt: new Date() })
    .where(eq(cieEvents.id, event.id));

  // Debounce full signal recalc (RSI requires DB query)
  scheduleSignalRecalc(event.ticker);
}

// ── Process a trade_volume event ─────────────────────────────────────────────
async function processTradeVolume(event: CieEvent): Promise<void> {
  if (!event.ticker) return;

  const payload = event.payload as Record<string, unknown>;
  const volume = typeof payload.volume === "number" ? payload.volume : null;

  if (volume == null) return;

  await db
    .update(cieSecurities)
    .set({ latestVolume: volume, lastUpdatedAt: new Date() })
    .where(eq(cieSecurities.symbol, event.ticker));

  await db
    .update(cieEvents)
    .set({ isProcessed: true, processedAt: new Date() })
    .where(eq(cieEvents.id, event.id));
}

// ── Process a dividend_declared event ────────────────────────────────────────
async function processDividendDeclared(event: CieEvent): Promise<void> {
  if (!event.ticker) return;

  const payload = event.payload as Record<string, unknown>;
  const amountKobo = typeof payload.amount_kobo === "number" ? payload.amount_kobo : null;
  const qualDate = typeof payload.qual_date === "string" ? payload.qual_date : null;
  const paymentDate = typeof payload.payment_date === "string" ? payload.payment_date : null;

  if (amountKobo == null || qualDate == null) {
    await db
      .update(cieEvents)
      .set({ isProcessed: true, processedAt: new Date() })
      .where(eq(cieEvents.id, event.id));
    return;
  }

  // Look up company name from securities table
  const [sec] = await db
    .select({ name: cieSecurities.name })
    .from(cieSecurities)
    .where(eq(cieSecurities.symbol, event.ticker))
    .limit(1);

  await db.insert(ngxDividends).values({
    ticker: event.ticker,
    companyName: sec?.name ?? event.ticker,
    dividendAmountKobo: amountKobo,
    qualificationDate: qualDate,
    paymentDate: paymentDate ?? null,
    declaredAt: event.occurredAt,
    source: event.sourceApp === "icon_etrade" ? "naya_corporate_action" : "manual_admin",
    isActive: true,
  });

  await db
    .update(cieEvents)
    .set({ isProcessed: true, processedAt: new Date() })
    .where(eq(cieEvents.id, event.id));
}

// ── Main dispatcher ──────────────────────────────────────────────────────────

export async function processIncomingEvent(event: CieEvent): Promise<void> {
  switch (event.eventType) {
    case "price_update":
      await processPriceUpdate(event);
      break;
    case "trade_volume":
      await processTradeVolume(event);
      break;
    case "dividend_declared":
      await processDividendDeclared(event);
      break;
    default:
      // Mark other event types as processed without action
      await db
        .update(cieEvents)
        .set({ isProcessed: true, processedAt: new Date() })
        .where(eq(cieEvents.id, event.id));
  }
}

// ── Daily score update (called by scheduler) ─────────────────────────────────

export async function runDailyScoreUpdate(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Find all tickers that received data today
  const activeEvents = await db
    .selectDistinct({ ticker: cieEvents.ticker })
    .from(cieEvents)
    .where(
      and(
        gte(cieEvents.occurredAt, since),
        eq(cieEvents.isProcessed, true),
      )
    );

  const updatedTickers = new Set(
    activeEvents.map(e => e.ticker).filter(Boolean) as string[]
  );

  // For securities with no data today, reset to neutral
  const allActive = await db
    .select({ symbol: cieSecurities.symbol, lastUpdatedAt: cieSecurities.lastUpdatedAt })
    .from(cieSecurities)
    .where(eq(cieSecurities.isActive, true));

  for (const sec of allActive) {
    if (!updatedTickers.has(sec.symbol)) {
      const lastUpdate = sec.lastUpdatedAt;
      const isStale = !lastUpdate || lastUpdate < since;
      if (isStale) {
        await db
          .update(cieSecurities)
          .set({
            signal: "─",
            momentum: "neutral",
            recommendation: "HOLD",
            investmentIntel: "No data received today.",
          })
          .where(eq(cieSecurities.symbol, sec.symbol));
      }
    }
  }

  console.log(`[CIEProcessing] Daily score update: ${updatedTickers.size} tickers updated, ${allActive.length - updatedTickers.size} set to neutral`);
}

// ── Sector summary ─────────────────────────────────────────────────────────

export interface SectorSummary {
  name: string;
  stockCount: number;
  avgDayChangePct: number;
  avgWeekChangePct: number;
  topPerformer: { ticker: string; dayChangePct: number } | null;
  bottomPerformer: { ticker: string; dayChangePct: number } | null;
  bullishCount: number;
  bearishCount: number;
  analystNote: string;
}

export async function getSectorSummary(): Promise<SectorSummary[]> {
  const securities = await db
    .select({
      symbol: cieSecurities.symbol,
      sector: cieSecurities.sector,
      dayChangePct: cieSecurities.dayChangePct,
      weekChangePct: cieSecurities.weekChangePct,
      momentum: cieSecurities.momentum,
    })
    .from(cieSecurities)
    .where(eq(cieSecurities.isActive, true));

  const bySector = new Map<string, typeof securities>();
  for (const sec of securities) {
    const list = bySector.get(sec.sector) ?? [];
    list.push(sec);
    bySector.set(sec.sector, list);
  }

  type SecRow = typeof securities[0];
  const summaries: SectorSummary[] = [];
  for (const [sector, secs] of Array.from(bySector.entries())) {
    const withData = secs.filter((s: SecRow) => s.dayChangePct != null);
    const dayChanges = withData.map((s: SecRow) => parseFloat(String(s.dayChangePct)));
    const weekChanges = secs
      .filter((s: SecRow) => s.weekChangePct != null)
      .map((s: SecRow) => parseFloat(String(s.weekChangePct)));

    const avgDayChangePct = dayChanges.length > 0
      ? dayChanges.reduce((a: number, b: number) => a + b, 0) / dayChanges.length
      : 0;
    const avgWeekChangePct = weekChanges.length > 0
      ? weekChanges.reduce((a: number, b: number) => a + b, 0) / weekChanges.length
      : 0;

    const sorted = withData.slice().sort((a: SecRow, b: SecRow) =>
      parseFloat(String(b.dayChangePct)) - parseFloat(String(a.dayChangePct))
    );

    const topPerformer = sorted[0]
      ? { ticker: sorted[0].symbol, dayChangePct: parseFloat(String(sorted[0].dayChangePct)) }
      : null;
    const bottomPerformer = sorted[sorted.length - 1] && sorted.length > 1
      ? { ticker: sorted[sorted.length - 1].symbol, dayChangePct: parseFloat(String(sorted[sorted.length - 1].dayChangePct)) }
      : null;

    const bullishCount = secs.filter((s: SecRow) => s.momentum === "bullish").length;
    const bearishCount = secs.filter((s: SecRow) => s.momentum === "bearish").length;

    let analystNote: string;
    if (avgDayChangePct > 1) analystNote = "Sector showing strength today";
    else if (avgDayChangePct < -1) analystNote = "Sector under selling pressure";
    else analystNote = "Mixed performance across the sector";

    summaries.push({
      name: sector,
      stockCount: secs.length,
      avgDayChangePct: parseFloat(avgDayChangePct.toFixed(2)),
      avgWeekChangePct: parseFloat(avgWeekChangePct.toFixed(2)),
      topPerformer,
      bottomPerformer,
      bullishCount,
      bearishCount,
      analystNote,
    });
  }

  return summaries.sort((a, b) => b.avgDayChangePct - a.avgDayChangePct);
}
