/**
 * BVN/NIN Hash Backfill Service
 *
 * One-time-idempotent startup task that iterates over `founder_profiles` rows
 * where `bvn_encrypted` or `nin_encrypted` is set but the corresponding HMAC
 * hash column is NULL, decrypts each value, computes the hash, and persists it.
 *
 * This is necessary for founders who verified their identity before Task #248
 * introduced the hash columns — without the backfill, the Cellion-first KYC
 * API match would fall through to Smile ID and consume credits unnecessarily.
 *
 * Safe to call on every startup — it only touches rows that still need work.
 * All errors are caught and logged; the function never throws.
 */

import { db } from "../db";
import { eq, or, isNotNull, isNull, and } from "drizzle-orm";
import { founderProfiles } from "@shared/schema";
import { decryptField, hmacField, isEncryptedField } from "./encryptionService";

export async function backfillBvnNinHashes(): Promise<void> {
  try {
    // Fetch rows that have an encrypted BVN or NIN but are missing the hash
    const rows = await db
      .select({
        id: founderProfiles.id,
        ninEncrypted: founderProfiles.ninEncrypted,
        bvnEncrypted: founderProfiles.bvnEncrypted,
        ninHash: founderProfiles.ninHash,
        bvnHash: founderProfiles.bvnHash,
      })
      .from(founderProfiles)
      .where(
        or(
          and(isNotNull(founderProfiles.ninEncrypted), isNull(founderProfiles.ninHash)),
          and(isNotNull(founderProfiles.bvnEncrypted), isNull(founderProfiles.bvnHash)),
        ),
      );

    if (rows.length === 0) {
      console.log("[BvnNinHashBackfill] No rows need backfill — all up to date.");
      return;
    }

    console.log(`[BvnNinHashBackfill] Starting backfill for ${rows.length} founder_profiles row(s)...`);

    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const patch: { ninHash?: string; bvnHash?: string } = {};

      if (row.ninEncrypted && !row.ninHash) {
        try {
          if (isEncryptedField(row.ninEncrypted)) {
            const plain = decryptField(row.ninEncrypted);
            if (plain && /^\d{11}$/.test(plain)) {
              patch.ninHash = hmacField(plain);
            }
          }
        } catch (e) {
          console.warn(`[BvnNinHashBackfill] NIN decrypt/hash failed for profile ${row.id} (skipping):`, (e as Error).message);
        }
      }

      if (row.bvnEncrypted && !row.bvnHash) {
        try {
          if (isEncryptedField(row.bvnEncrypted)) {
            const plain = decryptField(row.bvnEncrypted);
            if (plain && /^\d{11}$/.test(plain)) {
              patch.bvnHash = hmacField(plain);
            }
          }
        } catch (e) {
          console.warn(`[BvnNinHashBackfill] BVN decrypt/hash failed for profile ${row.id} (skipping):`, (e as Error).message);
        }
      }

      if (Object.keys(patch).length > 0) {
        await db.update(founderProfiles).set(patch).where(eq(founderProfiles.id, row.id));
        updated++;
      } else {
        skipped++;
      }
    }

    console.log(`[BvnNinHashBackfill] Complete — updated ${updated} row(s), skipped ${skipped} row(s).`);
  } catch (err) {
    console.error("[BvnNinHashBackfill] Backfill failed (non-fatal, will retry next startup):", err);
  }
}
