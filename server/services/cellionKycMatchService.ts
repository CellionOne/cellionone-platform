/**
 * Cellion KYC Match Service
 *
 * Provides a Cellion-platform-first lookup for BVN and NIN identifiers.
 * When an external party calls /api/v1/kyc/lookup/bvn or /lookup/nin,
 * this service is checked BEFORE any Smile ID call is made.
 *
 * If the identifier belongs to a founder who has already been verified on the
 * Cellion platform, we return a synthetic IdLookupResult derived from our own
 * records.  This means:
 *   - No Smile ID credit is consumed.
 *   - No kycVerificationRequest row is inserted.
 *   - The response is instant and deterministic.
 *
 * PII (fullName, DOB, phone) is ONLY included when a valid, active, in-scope
 * consent token is provided in the X-Consent-Token request header and the
 * dataSharingConsents record authorises the requested field(s).
 *
 * Security: BVN/NIN values are stored as HMAC-SHA256 hashes in the database.
 * The hash key is ENCRYPTION_KEY (same key used for field-level encryption).
 * Raw identifiers are NEVER stored — only their deterministic HMAC digest.
 */

import { db } from "../db";
import { eq, and } from "drizzle-orm";
import {
  founderProfiles,
  identityVerifications,
  dataSharingConsents,
  dataSharingAccessLogs,
  type DataSharingConsent,
} from "@shared/schema";
import type { IdLookupResult } from "./smileIdService";
import { hmacField } from "./encryptionService";

export type VerificationLevel = "bvn_nin_only" | "bvn_nin_document" | "full_kyc";

export interface CellionMatchResult {
  /** Whether a verified Cellion founder record was found for this identifier. */
  matched: boolean;
  /** Populated only when matched === true */
  idLookupResult?: IdLookupResult;
  /** Human-readable description of the verification level */
  verificationLevel?: VerificationLevel;
  /** ISO timestamp of when the identity was verified */
  verifiedAt?: string;
  /** ISO timestamp of when the verification expires (1 year from verifiedAt) */
  expiresAt?: string;
}

/**
 * Derive the verification level from the identity_verifications record.
 */
function deriveVerificationLevel(iv: {
  status: string;
  bvnNinVerified: boolean | null;
  idDocFileId: number | null;
  selfieFileId: number | null;
}): VerificationLevel {
  const hasBvnNin = iv.bvnNinVerified === true;
  const hasDoc = !!iv.idDocFileId;
  const hasSelfie = !!iv.selfieFileId;
  const isVerified = iv.status === "verified";

  if (isVerified && hasBvnNin && hasDoc && hasSelfie) return "full_kyc";
  if (isVerified && hasBvnNin && (hasDoc || hasSelfie)) return "bvn_nin_document";
  return "bvn_nin_only";
}

/**
 * Resolve a consent token against the data_sharing_consents table.
 * Returns the full consent row if the token is active, not expired, and
 * the founderId matches the expected founder.  Returns null otherwise.
 */
async function resolveConsent(
  token: string,
  founderId: string,
): Promise<DataSharingConsent | null> {
  const now = new Date();
  const [consent] = await db
    .select()
    .from(dataSharingConsents)
    .where(
      and(
        eq(dataSharingConsents.consentToken, token),
        eq(dataSharingConsents.status, "active"),
        eq(dataSharingConsents.founderId, founderId),
      ),
    )
    .limit(1);

  if (!consent) return null;
  if (new Date(consent.expiresAt) < now) return null;
  return consent;
}

/**
 * Check whether a consent record's dataScope authorises personal data fields.
 *
 * The platform stores category-level scopes, not field-level keys.
 * Schema: { personal: boolean, verification: boolean, company: boolean,
 *            documents: boolean, proofOfAddress: boolean }
 *
 * `fullName`, `dateOfBirth`, and `phone` all fall under the "personal" category.
 */
function consentAllowsPersonal(scope: unknown): boolean {
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) return false;
  const obj = scope as Record<string, unknown>;
  return obj["personal"] === true || obj["all"] === true;
}

/**
 * Log a data sharing access event (non-blocking — errors are swallowed).
 *
 * `dataReturned` is stored as `{ fields: string[] }` — a typed JSONB object
 * that avoids any double-cast workaround while remaining queryable.
 */
function logConsentAccess(
  consentId: number,
  fields: string[],
  accessedBy: string,
  ip?: string,
  ua?: string,
): void {
  const dataReturned: { fields: string[] } = { fields };
  db.insert(dataSharingAccessLogs).values({
    consentId,
    accessType: "kyc_api_lookup",
    accessedBy,
    ipAddress: ip || null,
    userAgent: ua || null,
    dataReturned,
  }).catch((err: unknown) => {
    console.error("[CellionKycMatch] Consent access log error (non-blocking):", err);
  });
}

/**
 * Main entry-point.
 *
 * @param idType         "BVN" or "NIN"
 * @param idNumber       Raw 11-digit identifier from the API caller
 * @param consentToken   Optional value of the X-Consent-Token request header
 * @param callerOrgLabel Label used in audit logging (e.g. orgId.toString())
 * @param ip             Request IP for audit logging
 * @param ua             Request User-Agent for audit logging
 */
export async function findCellionMatch(
  idType: "BVN" | "NIN",
  idNumber: string,
  consentToken?: string,
  callerOrgLabel?: string,
  ip?: string,
  ua?: string,
): Promise<CellionMatchResult> {
  try {
    const hash = hmacField(idNumber.trim());
    const hashColumn = idType === "BVN" ? founderProfiles.bvnHash : founderProfiles.ninHash;

    // Single join query: only returns a row when BOTH conditions hold simultaneously —
    //   (A) the HMAC hash matches a founder_profiles row, AND
    //   (B) that founder has a verified IV with bvnNinVerified === true.
    //
    // This is more robust than two sequential queries because:
    //   - It avoids false negatives in the edge case of duplicate hash rows
    //     (the join will correctly surface the one with a verified IV).
    //   - It requires both conditions atomically — no window between queries
    //     where a concurrent update could cause a mismatch.
    const [row] = await db
      .select({ profile: founderProfiles, iv: identityVerifications })
      .from(founderProfiles)
      .innerJoin(
        identityVerifications,
        and(
          eq(identityVerifications.founderUserId, founderProfiles.userId),
          eq(identityVerifications.status, "verified"),
          eq(identityVerifications.bvnNinVerified, true),
        ),
      )
      .where(eq(hashColumn, hash))
      .limit(1);

    if (!row) return { matched: false };

    const { profile, iv } = row;

    const level = deriveVerificationLevel(iv);
    // Use the stored verifiedAt timestamp; fall back to createdAt (always set via defaultNow).
    // Never fabricate the time with new Date() — that would misrepresent when verification occurred.
    const verifiedAt = (iv.verifiedAt ?? iv.createdAt).toISOString();
    const expiresAt = iv.expiresAt ? iv.expiresAt.toISOString() : undefined;

    // Build base result — no PII by default
    const result: IdLookupResult = { verified: true };

    // Attempt to expose personal data fields if a valid consent token was given.
    // The platform stores category scopes (personal / verification / company / documents /
    // proofOfAddress).  fullName, dateOfBirth and phone are all in the "personal" category.
    if (consentToken) {
      const consent = await resolveConsent(consentToken, profile.userId);
      if (consent && consentAllowsPersonal(consent.dataScope)) {
        const dataReturned: string[] = [];

        if (profile.fullName) {
          result.fullName = profile.fullName;
          dataReturned.push("fullName");
        }
        if (profile.dateOfBirth) {
          result.dob = profile.dateOfBirth;
          dataReturned.push("dateOfBirth");
        }
        if (profile.phone) {
          result.phone = profile.phone;
          dataReturned.push("phone");
        }

        if (dataReturned.length > 0) {
          logConsentAccess(consent.id, dataReturned, callerOrgLabel || "api", ip, ua);
        }
      }
    }

    return {
      matched: true,
      idLookupResult: result,
      verificationLevel: level,
      verifiedAt,
      expiresAt,
    };
  } catch (err) {
    // Any error (e.g. ENCRYPTION_KEY not set, DB error) must not block the
    // caller — we simply fall through to the normal Smile ID path.
    console.error("[CellionKycMatch] Error during platform match (falling through to Smile ID):", err);
    return { matched: false };
  }
}
