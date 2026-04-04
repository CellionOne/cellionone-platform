/**
 * CIE Score Engine — Cellion Intelligence Engine
 *
 * Computes three scores per equity per day:
 *   IAS  — Investment Attractiveness Score (0–100, higher = more attractive)
 *   RS   — Risk Score (0–100, higher = riskier) — 90-day window
 *   CS   — Confidence Score (0–100, higher = better data quality/recency) — cross-sectional
 *
 * IAS pillar weights (default model):
 *   Momentum          15%
 *   Liquidity         10%
 *   Valuation         20%
 *   Quality           20%
 *   Growth            20%
 *   Financial Strength 15%
 *
 * RS composition (90-day): volatility 40% + max-drawdown 40% + inverted-turnover 20%
 * CS composition: data-completeness 40% + recency-freshness 30% + anomaly-rate 30%
 *   CS is cross-sectionally rank-normalised within each sector.
 *
 * All IAS, RS, CS are cross-sectionally normalised per sector (rank transform → 0–100).
 * Recommendation thresholds (IAS, high CS, low RS):
 *   85+ Strong Buy | 70+ Accumulate | 50+ Hold | 35+ Reduce | < 35 Sell
 */

import { storage } from "../storage";

export interface PillarBreakdown {
  momentum: number;
  liquidity: number;
  valuation: number;
  quality: number;
  growth: number;
  financialStrength: number;
  rawMomentum?: number;
  rawLiquidity?: number;
}

export interface SecurityScore {
  securityId: number;
  ias: number;
  rs: number;
  cs: number;
  recommendation: string;
  pillarBreakdown: PillarBreakdown;
  dataPointsUsed: number;
}

const DEFAULT_WEIGHTS = {
  momentum: 0.15,
  liquidity: 0.10,
  valuation: 0.20,
  quality: 0.20,
  growth: 0.20,
  financialStrength: 0.15,
};

/** Convert a ranked array to 0–100 score (percentile rank) */
function rankTransform(values: number[]): number[] {
  if (values.length === 0) return [];
  const n = values.length;
  if (n === 1) return [50];
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const scores = new Array(n).fill(0);
  indexed.forEach((item, rank) => {
    scores[item.i] = Math.round((rank / (n - 1)) * 100);
  });
  return scores;
}

/** Clamp a number to [0, 100] */
function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** Map IAS/RS to a recommendation label */
function getRecommendation(ias: number, rs: number): string {
  if (ias >= 85 && rs <= 35) return "Strong Buy";
  if (ias >= 70) return "Accumulate";
  if (ias >= 50) return "Hold";
  if (ias >= 35) return "Reduce";
  return "Sell";
}

/** Days between two YYYY-MM-DD strings */
function daysBetween(dateA: string, dateB: string): number {
  const msA = new Date(dateA).getTime();
  const msB = new Date(dateB).getTime();
  return Math.round(Math.abs(msA - msB) / 86400000);
}

/**
 * Raw pillars computed from price data.
 * All window measurements specified in days (20d or 90d) are used consistently.
 */
interface RawPillars {
  securityId: number;
  // Momentum (20-day for IAS)
  momentum20d: number;      // 20-day price return (%)
  momentum5d: number;       // 5-day price return (%)
  // Liquidity (20-day avg for IAS)
  avgDailyValue20d: number; // avg daily kobo × volume over 20 days
  turnover5d: number;       // avg 5-day value turnover (kobo × shares)
  // Risk (90-day for RS — full window)
  volatility90d: number;    // annualised daily-return std dev over all available data (up to 90d)
  maxDrawdown90d: number;   // max peak-to-trough % loss over full window
  // Confidence ingredients
  dataPoints: number;       // total available price points
  latestTradeDate: string;  // YYYY-MM-DD of most recent price point (for recency-gap)
}

async function computeRawPillars(securityId: number): Promise<RawPillars | null> {
  // Fetch up to 90 days of history for full-window RS metrics
  const prices = await storage.listCiePrices(securityId, 90);

  if (prices.length < 5) return null; // insufficient data minimum

  // Sort ascending by date
  const sorted = [...prices].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  const closes = sorted.map(p => p.closeKobo);
  const volumes = sorted.map(p => p.volume ?? 0);
  const n = closes.length;
  const latestTradeDate = sorted[n - 1].tradeDate;

  // ── Momentum (IAS: 20-day window) ─────────────────────────────────────────
  const latest = closes[n - 1];
  const prev20 = closes[Math.max(0, n - 21)];
  const prev5  = closes[Math.max(0, n - 6)];
  const momentum20d = prev20 > 0 ? ((latest - prev20) / prev20) * 100 : 0;
  const momentum5d  = prev5  > 0 ? ((latest - prev5)  / prev5)  * 100 : 0;

  // ── Liquidity (IAS: 20-day window) ────────────────────────────────────────
  const window20 = sorted.slice(-20);
  const avgDailyValue20d = window20.reduce(
    (sum, p, i) => sum + p.closeKobo * (volumes[n - window20.length + i] || 0), 0
  ) / window20.length;

  const window5 = sorted.slice(-5);
  const turnover5d = window5.reduce(
    (sum, p, i) => sum + p.closeKobo * (volumes[n - window5.length + i] || 0), 0
  ) / window5.length;

  // ── Volatility & Drawdown (RS: FULL window — up to 90 days) ───────────────
  const dailyReturns: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].closeKobo;
    const curr = sorted[i].closeKobo;
    if (prev > 0) dailyReturns.push((curr - prev) / prev);
  }

  const avgReturn = dailyReturns.length > 0
    ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
    : 0;

  const variance = dailyReturns.length > 1
    ? dailyReturns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / (dailyReturns.length - 1)
    : 0;

  // Annualise: σ_annual = σ_daily × √252
  const volatility90d = Math.sqrt(variance) * Math.sqrt(252) * 100;

  // Max peak-to-trough drawdown over full available window
  let peak = -Infinity;
  let maxDrawdown90d = 0;
  for (const p of sorted) {
    if (p.closeKobo > peak) peak = p.closeKobo;
    const dd = peak > 0 ? ((peak - p.closeKobo) / peak) * 100 : 0;
    if (dd > maxDrawdown90d) maxDrawdown90d = dd;
  }

  return {
    securityId,
    momentum20d,
    momentum5d,
    avgDailyValue20d,
    turnover5d,
    volatility90d,
    maxDrawdown90d,
    dataPoints: n,
    latestTradeDate,
  };
}

/**
 * Compute cross-sectional scores for all active securities in a given sector.
 * IAS, RS, and CS are all rank-normalised within sector.
 */
async function scoreSector(
  sectorSecurities: { id: number; sector: string }[],
  weights: typeof DEFAULT_WEIGHTS
): Promise<Map<number, SecurityScore>> {
  const rawList: RawPillars[] = [];

  for (const sec of sectorSecurities) {
    const raw = await computeRawPillars(sec.id);
    if (raw) rawList.push(raw);
  }

  const result = new Map<number, SecurityScore>();
  if (rawList.length === 0) return result;

  const todayStr = new Date().toISOString().slice(0, 10);

  // ── Single-security sector: assign median scores ───────────────────────────
  if (rawList.length === 1) {
    const r = rawList[0];
    const daySinceLatest = daysBetween(r.latestTradeDate, todayStr);
    const recencyFreshness = daySinceLatest <= 1 ? 1.0 : daySinceLatest <= 5 ? 0.8 : daySinceLatest <= 10 ? 0.5 : 0.2;
    const completeness = Math.min(r.dataPoints, 20) / 20;
    const anomalyRate = r.volatility90d > 80 ? 0.4 : r.volatility90d > 60 ? 0.7 : 1.0;
    const csRaw = completeness * 0.40 + recencyFreshness * 0.30 + anomalyRate * 0.30;
    const cs = clamp(Math.round(csRaw * 100));

    result.set(r.securityId, {
      securityId: r.securityId,
      ias: 50,
      rs: 50,
      cs,
      recommendation: "Hold",
      pillarBreakdown: {
        momentum: 50, liquidity: 50, valuation: 50,
        quality: 50, growth: 50, financialStrength: 50,
        rawMomentum: r.momentum20d, rawLiquidity: r.avgDailyValue20d,
      },
      dataPointsUsed: r.dataPoints,
    });
    return result;
  }

  // ── Cross-sectional rank transforms ───────────────────────────────────────
  // IAS pillars (20-day focus)
  const momentum20dScores = rankTransform(rawList.map(r => r.momentum20d));
  const momentum5dScores  = rankTransform(rawList.map(r => r.momentum5d));
  const liquidityScores   = rankTransform(rawList.map(r => r.avgDailyValue20d));
  const turnoverScores    = rankTransform(rawList.map(r => r.turnover5d));
  const qualityScores     = rankTransform(rawList.map(r => -r.volatility90d)); // invert: lower vol = better quality
  const growthScores      = rankTransform(rawList.map(r => r.momentum20d));    // proxy: 20d momentum for growth
  const finStrengthScores = rankTransform(rawList.map(r => -r.maxDrawdown90d)); // invert: lower drawdown = stronger

  // RS: 90-day volatility (40%) + 90-day drawdown (40%) + inverted turnover (20%)
  // Low-turnover stocks are illiquid and score higher risk
  const invertedTurnoverRanks = rankTransform(rawList.map(r => -r.turnover5d));
  const riskRaw = rawList.map((r, i) =>
    r.volatility90d * 0.40 +
    r.maxDrawdown90d * 0.40 +
    (invertedTurnoverRanks[i] / 100) * 20  // normalise rank(0-100) → scale contribution
  );
  const rsRanks = rankTransform(riskRaw);

  // CS raw components (before cross-sectional normalisation)
  const csRawValues = rawList.map(r => {
    const daySinceLatest = daysBetween(r.latestTradeDate, todayStr);
    const recencyFreshness =
      daySinceLatest <= 1  ? 1.0 :
      daySinceLatest <= 5  ? 0.8 :
      daySinceLatest <= 10 ? 0.5 : 0.2;

    const completeness = Math.min(r.dataPoints, 20) / 20;

    // Anomaly flag: very high annualised volatility implies data quality issues
    const anomalyRate = r.volatility90d > 80 ? 0.4 : r.volatility90d > 60 ? 0.7 : 1.0;

    return completeness * 0.40 + recencyFreshness * 0.30 + anomalyRate * 0.30;
  });
  // Cross-sectionally normalise CS within sector (rank transform)
  const csRanks = rankTransform(csRawValues);

  // ── Assemble results ───────────────────────────────────────────────────────
  for (let i = 0; i < rawList.length; i++) {
    const r = rawList[i];

    const momentum    = Math.round(momentum20dScores[i] * 0.7 + momentum5dScores[i] * 0.3);
    const liquidity   = Math.round(liquidityScores[i] * 0.6 + turnoverScores[i] * 0.4);
    const valuation   = 50; // placeholder — no PE/PB available from price feeds alone
    const quality     = qualityScores[i];
    const growth      = growthScores[i];
    const finStrength = finStrengthScores[i];

    const ias = clamp(
      momentum    * weights.momentum +
      liquidity   * weights.liquidity +
      valuation   * weights.valuation +
      quality     * weights.quality +
      growth      * weights.growth +
      finStrength * weights.financialStrength
    );

    const rs = clamp(rsRanks[i]);
    const cs = clamp(csRanks[i]);

    result.set(r.securityId, {
      securityId: r.securityId,
      ias,
      rs,
      cs,
      recommendation: getRecommendation(ias, rs),
      pillarBreakdown: {
        momentum,
        liquidity,
        valuation,
        quality,
        growth,
        financialStrength: finStrength,
        rawMomentum: r.momentum20d,
        rawLiquidity: r.avgDailyValue20d,
      },
      dataPointsUsed: r.dataPoints,
    });
  }

  return result;
}

/**
 * Main entry point: compute and persist scores for all active securities.
 */
export async function computeAndPersistScores(): Promise<{ scored: number; skipped: number }> {
  const today = new Date().toISOString().slice(0, 10);

  const activeModel = await storage.getActiveCieModelVersion();
  const weights = (activeModel?.weights as typeof DEFAULT_WEIGHTS | null) ?? DEFAULT_WEIGHTS;
  const modelVersionId = activeModel?.id ?? null;

  const securities = await storage.listCieSecurities(true);
  if (securities.length === 0) {
    console.log("[CIEScoreEngine] No active securities to score");
    return { scored: 0, skipped: 0 };
  }

  // Group by sector for cross-sectional normalisation
  const bySector = new Map<string, typeof securities>();
  for (const sec of securities) {
    const group = bySector.get(sec.sector) ?? [];
    group.push(sec);
    bySector.set(sec.sector, group);
  }

  let scored = 0;
  let skipped = 0;

  for (const [sector, secs] of bySector) {
    const scoreMap = await scoreSector(secs, weights);

    for (const sec of secs) {
      const score = scoreMap.get(sec.id);
      if (!score) {
        skipped++;
        continue;
      }

      await storage.upsertCieScore({
        securityId: sec.id,
        scoreDate: today,
        ias: score.ias,
        rs: score.rs,
        cs: score.cs,
        recommendation: score.recommendation,
        pillarBreakdown: score.pillarBreakdown,
        modelVersionId,
        dataPointsUsed: score.dataPointsUsed,
      });
      scored++;
    }

    console.log(`[CIEScoreEngine] Sector '${sector}': ${scoreMap.size}/${secs.length} scored`);
  }

  console.log(`[CIEScoreEngine] Score run for ${today}: ${scored} scored, ${skipped} skipped`);
  return { scored, skipped };
}
