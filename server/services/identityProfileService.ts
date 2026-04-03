/**
 * Identity Profile Service
 *
 * Captures and persists structured identity data returned by the verification
 * pipeline into `kycVerifiedIdentityData`. Government ID photos (base64) are
 * decoded and stored in private object storage — the base64 payload is NEVER
 * surfaced in any API response or log.
 *
 * IMPORTANT: Smile ID branding must never appear in customer-facing responses.
 */
import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";
import {
  kycVerifiedIdentityData,
  verifiedEntities,
  sensitiveDataAccessLogs,
  type InsertKycVerifiedIdentityData,
} from "@shared/schema";
import { ObjectStorageService } from "../replit_integrations/object_storage";

const objectStorageService = new ObjectStorageService();

export interface IdentityProfileInput {
  verificationRequestId: number;
  orgId: number;
  fullName?: string | null;
  dateOfBirth?: string | null;
  phone?: string | null;
  gender?: string | null;
  address?: string | null;
  idTypesVerified?: string[];
  dataSource: string;
  /** Raw base64-encoded government ID photo — will be uploaded to private storage. */
  governmentPhotoBase64?: string | null;
  /** Already-stored object storage path for a government ID photo — used directly without re-upload. */
  governmentPhotoStoredPath?: string | null;
  actorUserId?: string | null;
}

/**
 * Upload a raw base64 government ID photo to private object storage.
 * Returns the storage path, or null on failure (non-blocking).
 * Validates the HTTP PUT response status before persisting the path.
 */
async function storeGovernmentPhoto(base64: string): Promise<string | null> {
  try {
    const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");
    if (buffer.length < 100) {
      console.warn("[IdentityProfile] Government photo too small, skipping upload");
      return null;
    }
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    const putResponse = await fetch(uploadURL, {
      method: "PUT",
      body: buffer,
      headers: { "Content-Type": "image/jpeg" },
    });
    if (!putResponse.ok) {
      console.error(`[IdentityProfile] Government photo PUT failed: ${putResponse.status} ${putResponse.statusText}`);
      return null;
    }
    return objectPath;
  } catch (err) {
    console.error("[IdentityProfile] Government photo storage error:", err);
    return null;
  }
}

/**
 * Capture and persist verified identity data for a completed KYC request.
 * Uses upsert (ON CONFLICT DO UPDATE) on verificationRequestId to ensure
 * exactly one profile row per request regardless of retries.
 * Safe to call asynchronously — all errors are caught and logged.
 */
export async function captureVerifiedIdentityProfile(input: IdentityProfileInput): Promise<void> {
  try {
    const {
      verificationRequestId, orgId, fullName, dateOfBirth,
      phone, gender, address, idTypesVerified, dataSource,
      governmentPhotoBase64, governmentPhotoStoredPath,
      actorUserId,
    } = input;

    let governmentPhotoPath: string | null = governmentPhotoStoredPath || null;

    if (!governmentPhotoPath && governmentPhotoBase64) {
      governmentPhotoPath = await storeGovernmentPhoto(governmentPhotoBase64);
    }

    // Durable audit log whenever a government photo path is captured
    if (governmentPhotoPath) {
      db.insert(sensitiveDataAccessLogs).values({
        accessorUserId: actorUserId || "system",
        targetUserId: actorUserId || "system",
        dataType: "government_id_photo",
        action: "upload",
        entityType: "kyc_verification_request",
        entityId: String(verificationRequestId),
      }).catch(err => console.error("[IdentityProfile] Photo audit log error:", err));
    }

    const row: InsertKycVerifiedIdentityData = {
      verificationRequestId,
      orgId,
      fullName: fullName || null,
      dateOfBirth: dateOfBirth || null,
      phone: phone || null,
      gender: gender || null,
      address: address || null,
      idTypesVerified: idTypesVerified?.length ? idTypesVerified : null,
      dataSource,
      governmentPhotoPath: governmentPhotoPath || null,
      capturedAt: new Date(),
    };

    // Upsert — unique constraint on verificationRequestId ensures one profile row per request.
    // On conflict, update all mutable fields so re-captures (e.g. after Smile ID lookup succeeds
    // on retry) always reflect the most recent and canonical identity data.
    await db.insert(kycVerifiedIdentityData)
      .values(row)
      .onConflictDoUpdate({
        target: kycVerifiedIdentityData.verificationRequestId,
        set: {
          fullName: row.fullName,
          dateOfBirth: row.dateOfBirth,
          phone: row.phone,
          gender: row.gender,
          address: row.address,
          idTypesVerified: row.idTypesVerified,
          dataSource: row.dataSource,
          governmentPhotoPath: row.governmentPhotoPath,
          capturedAt: row.capturedAt,
        },
      });

    console.log(`[IdentityProfile] Upserted identity profile for request ${verificationRequestId} (source: ${dataSource})`);

    if (governmentPhotoPath || dateOfBirth) {
      await enrichVerifiedEntityRegistry(verificationRequestId, dateOfBirth || null, governmentPhotoPath);
    }
  } catch (err) {
    console.error("[IdentityProfile] Error capturing identity profile:", err);
  }
}

/**
 * Back-fill `dateOfBirth` and `governmentPhotoPath` onto the verified entity
 * record linked to this verification request, if fields are not already set.
 */
async function enrichVerifiedEntityRegistry(
  verificationRequestId: number,
  dateOfBirth: string | null,
  governmentPhotoPath: string | null
): Promise<void> {
  try {
    const setClause: Record<string, unknown> = { updatedAt: new Date() };
    if (dateOfBirth) setClause.dateOfBirth = dateOfBirth;
    if (governmentPhotoPath) setClause.governmentPhotoPath = governmentPhotoPath;

    await db
      .update(verifiedEntities)
      .set(setClause)
      .where(
        and(
          eq(verifiedEntities.lastVerificationRequestId, verificationRequestId),
          eq(verifiedEntities.entityType, "individual")
        )
      );
  } catch (err) {
    console.error("[IdentityProfile] Failed to enrich verified entity registry:", err);
  }
}

/**
 * Retrieve the stored identity profile for a verification request.
 * Returns null if not yet captured.
 * Orders by capturedAt DESC for determinism even if multiple rows exist.
 */
export async function getIdentityProfile(
  verificationRequestId: number
): Promise<typeof kycVerifiedIdentityData.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(kycVerifiedIdentityData)
    .where(eq(kycVerifiedIdentityData.verificationRequestId, verificationRequestId))
    .orderBy(desc(kycVerifiedIdentityData.capturedAt))
    .limit(1);
  return row || null;
}

/**
 * Get a signed download URL for a government photo.
 * Returns null if no photo is stored or the path is invalid.
 */
export async function getGovernmentPhotoUrl(photoPath: string): Promise<string | null> {
  try {
    return await objectStorageService.getObjectEntityDownloadURL(photoPath);
  } catch {
    return null;
  }
}
