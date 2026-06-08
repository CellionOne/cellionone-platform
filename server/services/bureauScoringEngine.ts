/**
 * ClearLedger Bureau Scoring Engine
 * Calculates composite credit scores from bureau events.
 * Called by the debounced recalculation queue in bureauProfileService.
 */

import { db } from "../db";
import { eq, and, gte, sql } from "drizzle-orm";
import {
  bureauProfiles,
  bureauEvents,
  bureauScoreHistory,
  type BureauEvent,
  type BureauProfile,
} from "@shared/schema";

// ─── Band helper ──────────────────────────────────────────────────────────────

function getBand(score: number): string {
  if (score >= 80) return "PRIME";
  if (score >= 65) return "NEAR_PRIME";
  if (score >= 50) return "DEVELOPING";
  if (score >= 35) return "THIN_FILE";
  return "RESTRICTED";
}

function getCreditLimit(band: string): number {
  switch (band) {
    case "PRIME": return 5_000_000;
    case "NEAR_PRIME": return 1_500_000;
    case "DEVELOPING": return 500_000;
    case "THIN_FILE": return 100_000;
    default: return 0;
  }
}

function getDecision(band: string): string {
  switch (band) {
    case "PRIME": return "APPROVE";
    case "NEAR_PRIME": return "APPROVE_WITH_CONDITIONS";
    case "DEVELOPING": return "REFER";
    default: return "DECLINE";
  }
}

// ─── Coefficient of variation helper ─────────────────────────────────────────

function coefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 1;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 1;
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance) / mean;
}

// ─── Main score calculation ───────────────────────────────────────────────────

export async function calculateScore(profileId: number): Promise<void> {
  const [profile] = await db.select().from(bureauProfiles).where(eq(bureauProfiles.id, profileId)).limit(1);
  if (!profile) {
    console.warn(`[BureauScoringEngine] Profile ${profileId} not found`);
    return;
  }

  const events = await db.select().from(bureauEvents)
    .where(eq(bureauEvents.profileId, profileId));

  const now = new Date();
  const d180 = new Date(now.getTime() - 180 * 86400_000);
  const d90 = new Date(now.getTime() - 90 * 86400_000);
  const d365 = new Date(now.getTime() - 365 * 86400_000);

  // ── IDENTITY SUB-SCORE (max 20) ─────────────────────────────────────────────
  const identityEvents = events.filter(e => e.eventCategory === "identity");
  let scoreIdentity = 0;
  const hasBvnVerified = identityEvents.some(e => e.eventType === "bvn_verified");
  const hasNinVerified = identityEvents.some(e => e.eventType === "nin_verified");
  const hasLiveness = identityEvents.some(e => e.eventType === "liveness_passed");
  const hasCrossPlatform = identityEvents.some(e => e.eventType === "cross_platform_confirmed");
  if (hasBvnVerified) scoreIdentity += 8;
  if (hasNinVerified) scoreIdentity += 6;
  if (hasLiveness) scoreIdentity += 4;
  if (hasCrossPlatform) scoreIdentity += 2;
  scoreIdentity = Math.min(20, scoreIdentity);

  // ── CASH FLOW SUB-SCORE (max 25) ────────────────────────────────────────────
  let scoreCashFlow = 0;
  if (profile.hasBankData) {
    const cfEvents = events.filter(e =>
      e.eventCategory === "cash_flow" && new Date(e.occurredAt!) >= d180
    );

    // Income consistency: CV of monthly inflow amounts
    const inflows: Record<string, number[]> = {};
    cfEvents.forEach(e => {
      const p = e.payload as Record<string, unknown>;
      if (typeof p.amount === "number" && p.type === "inflow") {
        const month = new Date(e.occurredAt!).toISOString().substring(0, 7); // YYYY-MM
        if (!inflows[month]) inflows[month] = [];
        inflows[month].push(p.amount as number);
      }
    });
    const monthlyTotals = Object.values(inflows).map(arr => arr.reduce((a, b) => a + b, 0));
    const cv = coefficientOfVariation(monthlyTotals);
    if (cv < 0.2) scoreCashFlow += 10;
    else if (cv < 0.4) scoreCashFlow += 7;
    else if (cv < 0.6) scoreCashFlow += 4;
    else scoreCashFlow += 1;

    // Distinct income categories
    const incomeCategories = new Set(cfEvents
      .filter(e => {
        const p = e.payload as Record<string, unknown>;
        return p.type === "inflow" && p.category;
      })
      .map(e => (e.payload as Record<string, unknown>).category as string)
    );
    const nCats = incomeCategories.size;
    if (nCats >= 3) scoreCashFlow += 5;
    else if (nCats >= 2) scoreCashFlow += 3;
    else if (nCats >= 1) scoreCashFlow += 1;

    // Savings transfer
    if (cfEvents.some(e => e.eventType === "savings_transfer")) scoreCashFlow += 5;

    // Bounced payments in last 90 days
    const bounced = cfEvents.filter(e =>
      e.eventType === "bounced_payment" && new Date(e.occurredAt!) >= d90
    ).length;
    if (bounced === 0) scoreCashFlow += 5;
    else if (bounced === 1) scoreCashFlow += 3;

    scoreCashFlow = Math.min(25, scoreCashFlow);
  }

  // ── INVESTMENT SUB-SCORE (max 25) ───────────────────────────────────────────
  let scoreInvestment = 0;
  if (profile.hasCapitalMarkets) {
    const cmEvents = events.filter(e =>
      e.eventCategory === "capital_markets" && new Date(e.occurredAt!) >= d365
    );

    // Distinct months with trade_settled
    const tradeMonths = new Set(
      cmEvents
        .filter(e => e.eventType === "trade_settled")
        .map(e => new Date(e.occurredAt!).toISOString().substring(0, 7))
    );
    if (tradeMonths.size >= 6) scoreInvestment += 10;
    else if (tradeMonths.size >= 3) scoreInvestment += 6;
    else if (tradeMonths.size >= 1) scoreInvestment += 2;

    // Distinct instruments
    const instruments = new Set(
      cmEvents
        .filter(e => {
          const p = e.payload as Record<string, unknown>;
          return p.instrument;
        })
        .map(e => (e.payload as Record<string, unknown>).instrument as string)
    );
    if (instruments.size >= 5) scoreInvestment += 6;
    else if (instruments.size >= 3) scoreInvestment += 4;
    else if (instruments.size >= 1) scoreInvestment += 2;

    // Average hold period: days between matching buy/sell events
    const buys = cmEvents.filter(e => e.eventType === "trade_executed" &&
      (e.payload as Record<string, unknown>).side === "buy");
    const sells = cmEvents.filter(e => e.eventType === "trade_settled" &&
      (e.payload as Record<string, unknown>).side === "sell");
    if (buys.length > 0 && sells.length > 0) {
      const avgBuy = buys.reduce((a, e) => a + new Date(e.occurredAt!).getTime(), 0) / buys.length;
      const avgSell = sells.reduce((a, e) => a + new Date(e.occurredAt!).getTime(), 0) / sells.length;
      const avgHoldDays = (avgSell - avgBuy) / 86400_000;
      if (avgHoldDays >= 30) scoreInvestment += 5;
      else if (avgHoldDays >= 7) scoreInvestment += 3;
      else scoreInvestment += 1;
    }

    if (cmEvents.some(e => e.eventType === "dividend_received")) scoreInvestment += 4;

    scoreInvestment = Math.min(25, scoreInvestment);
  }

  // ── OBLIGATION SUB-SCORE (max 20) ───────────────────────────────────────────
  let scoreObligation = 0;
  if (profile.hasObligationData) {
    const obEvents = events.filter(e => e.eventCategory === "obligation");

    const hasDefault = obEvents.some(e => e.eventType === "default_recorded");
    const missed90 = obEvents.filter(e =>
      e.eventType === "missed_payment" && new Date(e.occurredAt!) >= d90
    ).length;
    const closedLoans = obEvents.filter(e => e.eventType === "loan_closed").length;

    if (!hasDefault) scoreObligation += 10;
    if (!hasDefault && missed90 === 0) scoreObligation += 8;
    scoreObligation += Math.min(4, closedLoans * 2);
    scoreObligation -= missed90 * 3;
    if (hasDefault) scoreObligation -= 10;
    scoreObligation = Math.max(0, Math.min(20, scoreObligation));
  }

  // ── STABILITY SUB-SCORE (max 10) ────────────────────────────────────────────
  let scoreStability = 0;

  // Profile age
  const profileAgeDays = (now.getTime() - new Date(profile.createdAt!).getTime()) / 86400_000;
  if (profileAgeDays >= 365) scoreStability += 4;
  else if (profileAgeDays >= 180) scoreStability += 2;
  else if (profileAgeDays >= 90) scoreStability += 1;

  // Data source flags
  const flagCount = [
    profile.hasKycVerified, profile.hasBankData,
    profile.hasCapitalMarkets, profile.hasObligationData, profile.hasCacVerified,
  ].filter(Boolean).length;
  if (flagCount >= 4) scoreStability += 4;
  else if (flagCount >= 3) scoreStability += 3;
  else if (flagCount >= 2) scoreStability += 2;
  else if (flagCount >= 1) scoreStability += 1;

  // Events from 2+ distinct API keys
  const distinctKeys = new Set(events.map(e => e.sourceApiKeyId).filter(Boolean));
  if (distinctKeys.size >= 2) scoreStability += 2;

  scoreStability = Math.min(10, scoreStability);

  // ── TOTAL + BAND ─────────────────────────────────────────────────────────────
  const totalScore = scoreIdentity + scoreCashFlow + scoreInvestment + scoreObligation + scoreStability;
  const scoreBand = getBand(totalScore);

  // ── DATA GAPS + RECOMMENDATION ────────────────────────────────────────────────
  const dataGaps: string[] = [];
  if (!profile.hasBankData) dataGaps.push("cash_flow_data_missing");
  if (!profile.hasCapitalMarkets) dataGaps.push("capital_markets_data_missing");
  if (!profile.hasObligationData) dataGaps.push("obligation_data_missing");
  if (!profile.hasKycVerified) dataGaps.push("kyc_verification_missing");

  const riskFlags: string[] = [];
  const obEventsAll = events.filter(e => e.eventCategory === "obligation");
  if (obEventsAll.some(e => e.eventType === "default_recorded")) riskFlags.push("default_on_record");
  if (obEventsAll.filter(e => e.eventType === "missed_payment" && new Date(e.occurredAt!) >= d90).length >= 2) {
    riskFlags.push("multiple_missed_payments_90d");
  }
  const bouncedAll = events.filter(e => e.eventType === "bounced_payment" && new Date(e.occurredAt!) >= d90);
  if (bouncedAll.length >= 2) riskFlags.push("multiple_bounced_payments_90d");

  const recommendation = {
    decision: getDecision(scoreBand),
    suggested_limit_ngn: getCreditLimit(scoreBand),
    risk_flags: riskFlags,
    data_gaps: dataGaps,
  };

  // ── DATA RICHNESS ─────────────────────────────────────────────────────────────
  let dataRichness: string;
  if (flagCount >= 4) dataRichness = "HIGH";
  else if (flagCount >= 2) dataRichness = "MID";
  else dataRichness = "LOW";

  const dataSources = [
    profile.hasKycVerified ? "kyc" : null,
    profile.hasBankData ? "bank" : null,
    profile.hasCapitalMarkets ? "capital_markets" : null,
    profile.hasObligationData ? "obligation" : null,
    profile.hasCacVerified ? "cac" : null,
  ].filter(Boolean) as string[];

  const calculatedAt = new Date();

  // ── PERSIST ───────────────────────────────────────────────────────────────────
  await db.update(bureauProfiles).set({
    score: totalScore,
    scoreBand,
    scoreCalculatedAt: calculatedAt,
    scoreIdentity,
    scoreCashFlow,
    scoreInvestment,
    scoreObligation,
    scoreStability,
    dataRichness,
    profileStage: flagCount >= 3 ? "ENRICHED" : flagCount >= 1 ? "ACTIVE" : "CREATED",
    recommendation,
    updatedAt: calculatedAt,
  }).where(eq(bureauProfiles.id, profileId));

  await db.insert(bureauScoreHistory).values({
    profileId,
    score: totalScore,
    scoreBand,
    scoreIdentity,
    scoreCashFlow,
    scoreInvestment,
    scoreObligation,
    scoreStability,
    dataSources,
    calculatedAt,
  });

  console.log(`[BureauScoringEngine] Profile ${profileId} (${profile.clearledgerId}): score=${totalScore} band=${scoreBand}`);
}
