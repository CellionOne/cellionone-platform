/**
 * ClearLedger Bureau Profile Service
 * Manages bureau profiles, events, and query logging.
 * NEVER stores raw BVN or NIN — SHA-256 only.
 */

import crypto from "crypto";
import { db } from "../db";
import { eq, sql } from "drizzle-orm";
import {
  bureauProfiles,
  bureauEvents,
  bureauQueries,
  type BureauProfile,
} from "@shared/schema";
import { trackApiUsage } from "../middleware/apiUsageTracker";

// ─── Debounce queue — replaces pg-boss for score recalculation ───────────────
// Uses a per-profileId timeout: any new event within 5 seconds resets the timer.
// On fire, launches calculateScore fire-and-forget.

const recalcTimers = new Map<number, ReturnType<typeof setTimeout>>();
const RECALC_DEBOUNCE_MS = 5_000;

function scheduleRecalculation(profileId: number): void {
  const existing = recalcTimers.get(profileId);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(async () => {
    recalcTimers.delete(profileId);
    try {
      // Lazy import to avoid circular dependency at module load time
      const { calculateScore } = await import("./bureauScoringEngine");
      await calculateScore(profileId);
    } catch (err) {
      console.error(`[Bureau] Score recalculation failed for profile ${profileId}:`, err);
    }
  }, RECALC_DEBOUNCE_MS);
  recalcTimers.set(profileId, timer);
}

// ─── Identifier hashing ───────────────────────────────────────────────────────

export function hashIdentifier(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

// ─── CLR ID generation ────────────────────────────────────────────────────────

export async function generateClearLedgerId(): Promise<string> {
  const result = await db.execute<{ nextval: string }>(
    sql`SELECT nextval('bureau_profile_id_seq') AS nextval`
  );
  const n = parseInt(String(result.rows[0].nextval), 10);
  return `CLR-${String(n).padStart(5, "0")}`;
}

// ─── Create or get profile ────────────────────────────────────────────────────

export async function createOrGetProfile(
  identifierType: "bvn" | "nin",
  identifierValue: string,
): Promise<BureauProfile> {
  const hash = hashIdentifier(identifierValue);
  return createOrGetProfileByHash(identifierType, hash);
}

export async function createOrGetProfileByHash(
  identifierType: "bvn" | "nin",
  identifierHash: string,
): Promise<BureauProfile> {
  const whereClause = identifierType === "bvn"
    ? eq(bureauProfiles.bvnHash, identifierHash)
    : eq(bureauProfiles.ninHash, identifierHash);

  const [existing] = await db.select().from(bureauProfiles).where(whereClause).limit(1);
  if (existing) return existing;

  const clearledgerId = await generateClearLedgerId();
  const [created] = await db.insert(bureauProfiles).values({
    clearledgerId,
    bvnHash: identifierType === "bvn" ? identifierHash : null,
    ninHash: identifierType === "nin" ? identifierHash : null,
    profileStage: "CREATED",
    dataRichness: "LOW",
  }).returning();
  return created;
}

// ─── Record an event ─────────────────────────────────────────────────────────

const CATEGORY_TO_FLAG: Record<string, keyof Pick<BureauProfile,
  "hasKycVerified" | "hasBankData" | "hasCapitalMarkets" | "hasObligationData" | "hasCacVerified"
>> = {
  identity: "hasKycVerified",
  cash_flow: "hasBankData",
  capital_markets: "hasCapitalMarkets",
  obligation: "hasObligationData",
  formation: "hasCacVerified",
};

export async function recordEvent(
  profileId: number,
  eventCategory: string,
  eventType: string,
  payload: Record<string, unknown>,
  occurredAt: Date,
  sourceApiKeyId?: number,
): Promise<void> {
  await db.insert(bureauEvents).values({
    profileId,
    eventType,
    eventCategory,
    payload,
    occurredAt,
    sourceApiKeyId: sourceApiKeyId ?? null,
  });

  // Update relevant data source flag
  const flagField = CATEGORY_TO_FLAG[eventCategory];
  if (flagField) {
    await db.update(bureauProfiles)
      .set({ [flagField]: true, updatedAt: new Date() })
      .where(eq(bureauProfiles.id, profileId));
  }

  // Queue score recalculation (debounced, fire-and-forget)
  scheduleRecalculation(profileId);
}

// ─── Query a profile ─────────────────────────────────────────────────────────

interface ProfileQueryOptions {
  apiKeyId: number;
  queryType?: string;
  consumerReference?: string;
  environment?: string;
}

export async function queryProfile(
  identifierType: "bvn" | "nin" | "clr",
  identifierValue: string,
  options: ProfileQueryOptions,
): Promise<{ found: false; cost_ngn: number } | (ReturnType<typeof buildProfileResponse> & { found: true; cost_ngn: number })> {
  const { apiKeyId, queryType = "profile_query", consumerReference, environment = "live" } = options;

  let profile: BureauProfile | undefined;
  let identifierHash: string;

  if (identifierType === "clr") {
    identifierHash = hashIdentifier(identifierValue);
    const [p] = await db.select().from(bureauProfiles)
      .where(eq(bureauProfiles.clearledgerId, identifierValue.toUpperCase()))
      .limit(1);
    profile = p;
  } else {
    identifierHash = hashIdentifier(identifierValue);
    const whereClause = identifierType === "bvn"
      ? eq(bureauProfiles.bvnHash, identifierHash)
      : eq(bureauProfiles.ninHash, identifierHash);
    const [p] = await db.select().from(bureauProfiles).where(whereClause).limit(1);
    profile = p;
  }

  const profileFound = !!profile;
  const costNgn = profileFound ? 900 : 200;

  // Log query for audit + billing
  await db.insert(bureauQueries).values({
    apiKeyId,
    environment,
    queryType,
    identifierHash: identifierType === "clr" ? identifierValue.toUpperCase() : identifierHash,
    profileFound,
    scoreReturned: profile?.score ?? null,
    bandReturned: profile?.scoreBand ?? null,
    billable: true,
    unitCostNgn: costNgn,
    consumerReference: consumerReference ?? null,
  });

  // Track API usage
  trackApiUsage(apiKeyId, "/api/v1/bureau/profile", 200).catch(() => {});

  if (!profile) {
    return { found: false, cost_ngn: costNgn };
  }

  return { ...buildProfileResponse(profile), found: true, cost_ngn: costNgn };
}

// ─── Build safe public-facing profile ────────────────────────────────────────

export function buildProfileResponse(profile: BureauProfile) {
  return {
    clearledger_id: profile.clearledgerId,
    score: profile.score,
    score_band: profile.scoreBand,
    score_calculated_at: profile.scoreCalculatedAt,
    sub_scores: {
      identity: profile.scoreIdentity,
      cash_flow: profile.scoreCashFlow,
      investment: profile.scoreInvestment,
      obligation: profile.scoreObligation,
      stability: profile.scoreStability,
    },
    profile_stage: profile.profileStage,
    data_richness: profile.dataRichness,
    data_sources: {
      kyc_verified: profile.hasKycVerified,
      bank_data: profile.hasBankData,
      capital_markets: profile.hasCapitalMarkets,
      obligation_data: profile.hasObligationData,
      cac_verified: profile.hasCacVerified,
    },
    positive_flags: profile.positiveFlags ?? [],
    negative_flags: profile.negativeFlags ?? [],
    recommendation: profile.recommendation ?? null,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}
