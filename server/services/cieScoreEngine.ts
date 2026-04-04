/**
 * CIE Score Engine — Cellion Intelligence Engine
 *
 * Computes three scores per equity per day:
 *   IAS  — Investment Attractiveness Score (0–100)  — weighted cross-sectional composite
 *   RS   — Risk Score (0–100, higher = riskier)
 *   CS   — Confidence Score (0–100, higher = better data quality/recency)
 *
 * IAS pillar weights (default model):
 *   Momentum          15%
 *   Liquidity         10%
 *   Valuation         20%
 *   Quality           20%
 *   Growth            20%
 *   Financial Strength 15%
 *
 * Scores are cross-sectionally normalised per sector (rank transform → 0–100).
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
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const scores = new Array(n).fill(0);
  indexed.forEach((item, rank) => {
    scores[item.i] = n === 1 ? 50 : Math.round((rank / (n - 1)) * 100);
  });
  return scores;
}

/** Clamp a number to [0, 100] */
function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** Map IAS to a recommendation label */
function getRecommendation(ias: number, rs: number): string {
  if (ias >= 85 && rs <= 35) return "Strong Buy";
  if (ias >= 70) return "Accumulate";
  if (ias >= 50) return "Hold";
  if (ias >= 35) return "Reduce";
  return "Sell";
}

/**
 * Compute raw pillar scores from price data only (the scores we can compute from OHLCV).
 * Returns raw values used for cross-sectional normalisation.
 */
interface RawPillars {
  securityId: number;
  momentum20d: number;      // 20-day price momentum (% return)
  momentum5d: number;       // 5-day momentum
  avgDailyVolume: number;   // average daily kobo volume (price × volume)
  volatility20d: number;    // annualised 20-day price volatility (lower = better quality)
  maxDrawdown: number;      // max 20-day drawdown (lower = better)
  turnover5d: number;       // avg 5-day value turnover (kobo)
  dataPoints: number;       // number of price data points available
}

async function computeRawPillars(securityId: number): Promise<RawPillars | null> {
  const prices = await storage.listCiePrices(securityId, 90);

  if (prices.length < 5) {
    return null; // insufficient data
  }

  // Sort ascending by date
  const sorted = [...prices].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  const closes = sorted.map(p => p.closeKobo);
  const volumes = sorted.map(p => p.volume ?? 0);
  const n = closes.length;

  // Momentum: return over last 20 and 5 days
  const latest = closes[n - 1];
  const prev20 = closes[Math.max(0, n - 21)];
  const prev5 = closes[Math.max(0, n - 6)];
  const momentum20d = prev20 > 0 ? ((latest - prev20) / prev20) * 100 : 0;
  const momentum5d = prev5 > 0 ? ((latest - prev5) / prev5) * 100 : 0;

  // Liquidity: average daily value turnover (price × volume in kobo²)
  const window5 = sorted.slice(-5);
  const turnover5d = window5.reduce((sum, p, i) => sum + (p.closeKobo * (volumes[n - window5.length + i] || 0)), 0) / window5.length;

  const window20 = sorted.slice(-20);
  const avgDailyVolume = window20.reduce((sum, p, i) => sum + (p.closeKobo * (volumes[n - window20.length + i] || 0)), 0) / window20.length;

  // Volatility: std dev of daily returns (annualised)
  const dailyReturns: number[] = [];
  for (let i = 1; i < window20.length; i++) {
    const prev = window20[i - 1].closeKobo;
    const curr = window20[i].closeKobo;
    if (prev > 0) dailyReturns.push((curr - prev) / prev);
  }
  const avgReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
  const variance = dailyReturns.length > 1
    ? dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (dailyReturns.length - 1)
    : 0;
  const volatility20d = Math.sqrt(variance) * Math.sqrt(252) * 100; // annualised %

  // Max drawdown over 20 days
  let peak = -Infinity;
  let maxDrawdown = 0;
  for (const p of window20) {
    if (p.closeKobo > peak) peak = p.closeKobo;
    const dd = peak > 0 ? ((peak - p.closeKobo) / peak) * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  return {
    securityId,
    momentum20d,
    momentum5d,
    avgDailyVolume,
    volatility20d,
    maxDrawdown,
    turnover5d,
    dataPoints: n,
  };
}

/**
 * Compute cross-sectional scores for all active securities in a given sector.
 * Returns a map of securityId → scores.
 */
async function scoreSector(
  sectorSecurities: { id: number; sector: string }[],
  weights: typeof DEFAULT_WEIGHTS
): Promise<Map<number, SecurityScore>> {
  const rawList: (RawPillars & { secId: number })[] = [];

  for (const sec of sectorSecurities) {
    const raw = await computeRawPillars(sec.id);
    if (raw) {
      rawList.push({ ...raw, secId: sec.id });
    }
  }

  const result = new Map<number, SecurityScore>();

  if (rawList.length === 0) return result;
  if (rawList.length === 1) {
    // Only one security in sector — assign median scores
    const r = rawList[0];
    const cs = Math.min(100, Math.round((r.dataPoints / 20) * 100));
    result.set(r.secId, {
      securityId: r.secId,
      ias: 50,
      rs: 50,
      cs,
      recommendation: "Hold",
      pillarBreakdown: {
        momentum: 50, liquidity: 50, valuation: 50,
        quality: 50, growth: 50, financialStrength: 50,
        rawMomentum: r.momentum20d, rawLiquidity: r.avgDailyVolume,
      },
      dataPointsUsed: r.dataPoints,
    });
    return result;
  }

  // Cross-sectional rank transforms (all positive = higher is better)
  const momentum20dScores  = rankTransform(rawList.map(r => r.momentum20d));
  const momentum5dScores   = rankTransform(rawList.map(r => r.momentum5d));
  const liquidityScores    = rankTransform(rawList.map(r => r.avgDailyVolume));
  const turnoverScores     = rankTransform(rawList.map(r => r.turnover5d));
  // Lower volatility = better (invert)
  const qualityScores      = rankTransform(rawList.map(r => -r.volatility20d));
  // Lower drawdown = better (invert)
  const growthScores       = rankTransform(rawList.map(r => r.momentum20d)); // proxy: use 20d momentum for growth
  const finStrengthScores  = rankTransform(rawList.map(r => -r.maxDrawdown));

  // Risk: volatility (40%) + drawdown (40%) + inverted turnover (20%)
  // Lower turnover = higher risk (illiquid = riskier)
  // We invert turnover ranks so that low-turnover stocks get HIGH risk contribution
  const invertedTurnoverRank = rankTransform(rawList.map(r => -r.turnover5d)); // negative = inverted
  const riskRaw = rawList.map((r, i) =>
    r.volatility20d * 0.40 +
    r.maxDrawdown   * 0.40 +
    (invertedTurnoverRank[i] / 100) * 0.20   // normalise 0-100 rank to 0-1, then scale
  );
  const riskScores = rankTransform(riskRaw);

  for (let i = 0; i < rawList.length; i++) {
    const r = rawList[i];

    // IAS = weighted combination of pillar scores
    const momentum    = Math.round((momentum20dScores[i] * 0.7) + (momentum5dScores[i] * 0.3));
    const liquidity   = Math.round((liquidityScores[i] * 0.6) + (turnoverScores[i] * 0.4));
    const valuation   = 50; // placeholder — no PE/PB data from prices only
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

    const rs = clamp(riskScores[i]);

    // Confidence score (CS):
    //   40% — data completeness: min(dataPoints, 20) / 20
    //   30% — recency freshness: penalise if latest price is stale (>5 business days)
    //   30% — anomaly rate: penalise rows where daily return > 3 stddev from mean
    const completeness = Math.min(r.dataPoints, 20) / 20;

    // Recency: we don't have the actual date easily from rawList — use dataPoints as proxy
    // If we have ≥20 points we assume recent; penalise if <10 points (sparse/stale data)
    const recencyFreshness = r.dataPoints >= 10 ? 1.0 : r.dataPoints / 10;

    // Anomaly rate: estimate from volatility — very high volatility (>80% annualised) = anomaly flag
    // Normal NGX volatility: 20–50% annualised. >80% = likely data quality issue
    const anomalyRate = r.volatility20d > 80 ? 0.4 : r.volatility20d > 60 ? 0.7 : 1.0;

    const cs = clamp(Math.round(
      (completeness    * 0.40 +
       recencyFreshness * 0.30 +
       anomalyRate      * 0.30) * 100
    ));

    result.set(r.secId, {
      securityId: r.secId,
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
        rawLiquidity: r.avgDailyVolume,
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
  const weights = activeModel?.weights ?? DEFAULT_WEIGHTS;
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

  console.log(`[CIEScoreEngine] Score run complete for ${today}: ${scored} scored, ${skipped} skipped`);
  return { scored, skipped };
}
