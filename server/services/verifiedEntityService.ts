import { db } from "../db";
import { eq, or, and, sql } from "drizzle-orm";
import {
  verifiedEntities,
  kycSupplierProfiles,
  kycSubmittedDocuments,
  founderProfiles,
  users,
  type KycVerificationRequest,
} from "@shared/schema";
import crypto from "crypto";
import { decryptField, isEncryptedField } from "./encryptionService";

function hashValue(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function tryDecryptAndHash(encryptedValue: string): string | null {
  try {
    if (isEncryptedField(encryptedValue)) {
      const decrypted = decryptField(encryptedValue);
      return hashValue(decrypted);
    }
    return hashValue(encryptedValue);
  } catch {
    return null;
  }
}

function extractIdFromDocuments(documents: any[]): { bvn?: string; nin?: string } {
  const result: { bvn?: string; nin?: string } = {};
  for (const doc of documents) {
    if (!doc.extractedData) continue;
    const data = typeof doc.extractedData === "string"
      ? JSON.parse(doc.extractedData)
      : doc.extractedData;

    if (data.bvn && !result.bvn) result.bvn = String(data.bvn).trim();
    if (data.nin && !result.nin) result.nin = String(data.nin).trim();
    if (data.BVN && !result.bvn) result.bvn = String(data.BVN).trim();
    if (data.NIN && !result.nin) result.nin = String(data.NIN).trim();
    if (data.id_number && !result.nin && !result.bvn) {
      const docType = (doc.detectedDocumentType || "").toLowerCase();
      if (docType.includes("bvn")) result.bvn = String(data.id_number).trim();
      else if (docType.includes("nin") || docType.includes("national")) result.nin = String(data.id_number).trim();
    }
  }
  return result;
}

interface UpsertVerifiedEntityData {
  request: KycVerificationRequest;
  orgId: number;
  riskScore?: string | null;
  amlScreeningStatus?: string | null;
}

interface UpsertVerifiedCompanyDirectData {
  companyName: string;
  rcNumber?: string | null;
  tinNumber?: string | null;
  email?: string | null;
  country?: string;
}

export async function upsertVerifiedCompanyDirect(data: UpsertVerifiedCompanyDirectData): Promise<void> {
  try {
    const { companyName, rcNumber, tinNumber, email, country } = data;
    const now = new Date();

    let existing = null;
    if (rcNumber) {
      const [found] = await db
        .select()
        .from(verifiedEntities)
        .where(and(eq(verifiedEntities.entityType, "company"), eq(verifiedEntities.rcNumber, rcNumber)));
      existing = found;
    }

    if (!existing && email) {
      const [foundByEmail] = await db
        .select()
        .from(verifiedEntities)
        .where(and(eq(verifiedEntities.entityType, "company"), eq(verifiedEntities.email, email)));
      existing = foundByEmail;
    }

    if (existing) {
      await db
        .update(verifiedEntities)
        .set({
          verificationCount: sql`${verifiedEntities.verificationCount} + 1`,
          lastVerifiedAt: now,
          fullName: companyName,
          email: email || existing.email,
          rcNumber: rcNumber || existing.rcNumber,
          tinNumber: tinNumber || existing.tinNumber,
          updatedAt: now,
        })
        .where(eq(verifiedEntities.id, existing.id));
    } else {
      await db.insert(verifiedEntities).values({
        entityType: "company",
        fullName: companyName,
        email: email || "",
        rcNumber: rcNumber || undefined,
        tinNumber: tinNumber || undefined,
        country: country || "NG",
        verificationCount: 1,
        lastVerifiedAt: now,
        firstVerifiedAt: now,
      });
    }
  } catch (error) {
    console.error("[VerifiedEntityService] Error upserting company from application:", error);
  }
}

export async function upsertVerifiedEntity(data: UpsertVerifiedEntityData): Promise<void> {
  try {
    const { request, orgId, riskScore, amlScreeningStatus } = data;
    const now = new Date();

    if (request.type === "individual") {
      await upsertIndividual(request, orgId, riskScore, amlScreeningStatus, now);
    } else if (request.type === "supplier") {
      await upsertCompany(request, orgId, riskScore, amlScreeningStatus, now);
    }
  } catch (error) {
    console.error("[VerifiedEntityService] Error upserting verified entity:", error);
  }
}

async function upsertIndividual(
  request: KycVerificationRequest,
  orgId: number,
  riskScore: string | null | undefined,
  amlScreeningStatus: string | null | undefined,
  now: Date,
) {
  let bvnHash: string | null = null;
  let ninHash: string | null = null;

  if (request.subjectUserId) {
    const [profile] = await db
      .select()
      .from(founderProfiles)
      .where(eq(founderProfiles.userId, request.subjectUserId));

    if (profile) {
      if (profile.bvnEncrypted) {
        bvnHash = tryDecryptAndHash(profile.bvnEncrypted);
      }
      if (profile.ninEncrypted) {
        ninHash = tryDecryptAndHash(profile.ninEncrypted);
      }
    }
  }

  if (!bvnHash || !ninHash) {
    const documents = await db
      .select()
      .from(kycSubmittedDocuments)
      .where(eq(kycSubmittedDocuments.verificationRequestId, request.id));

    const extracted = extractIdFromDocuments(documents);
    if (!bvnHash && extracted.bvn) bvnHash = hashValue(extracted.bvn);
    if (!ninHash && extracted.nin) ninHash = hashValue(extracted.nin);
  }

  const matchConditions: any[] = [];
  if (bvnHash) matchConditions.push(eq(verifiedEntities.bvnHash, bvnHash));
  if (ninHash) matchConditions.push(eq(verifiedEntities.ninHash, ninHash));

  let existing = null;
  if (matchConditions.length > 0) {
    const [found] = await db
      .select()
      .from(verifiedEntities)
      .where(and(eq(verifiedEntities.entityType, "individual"), or(...matchConditions)));
    existing = found;
  }

  if (!existing) {
    const [foundByEmail] = await db
      .select()
      .from(verifiedEntities)
      .where(and(eq(verifiedEntities.entityType, "individual"), eq(verifiedEntities.email, request.subjectEmail)));
    existing = foundByEmail;
  }

  if (existing) {
    await db
      .update(verifiedEntities)
      .set({
        verificationCount: sql`${verifiedEntities.verificationCount} + 1`,
        lastVerifiedAt: now,
        lastVerifiedByOrgId: orgId,
        lastVerificationRequestId: request.id,
        riskScore: riskScore || existing.riskScore,
        amlScreeningStatus: amlScreeningStatus || existing.amlScreeningStatus,
        fullName: request.subjectName,
        email: request.subjectEmail,
        bvnHash: bvnHash || existing.bvnHash,
        ninHash: ninHash || existing.ninHash,
        updatedAt: now,
      })
      .where(eq(verifiedEntities.id, existing.id));
  } else {
    await db.insert(verifiedEntities).values({
      entityType: "individual",
      fullName: request.subjectName,
      email: request.subjectEmail,
      bvnHash,
      ninHash,
      country: "NG",
      verificationCount: 1,
      lastVerifiedAt: now,
      lastVerifiedByOrgId: orgId,
      lastVerificationRequestId: request.id,
      riskScore: riskScore || null,
      amlScreeningStatus: amlScreeningStatus || null,
      firstVerifiedAt: now,
    });
  }
}

async function upsertCompany(
  request: KycVerificationRequest,
  orgId: number,
  riskScore: string | null | undefined,
  amlScreeningStatus: string | null | undefined,
  now: Date,
) {
  const [supplierProfile] = await db
    .select()
    .from(kycSupplierProfiles)
    .where(eq(kycSupplierProfiles.verificationRequestId, request.id));

  const rcNumber = supplierProfile?.rcNumber || null;
  const tinNumber = supplierProfile?.tinNumber || null;
  const companyName = supplierProfile?.companyName || request.subjectName;

  let existing = null;
  if (rcNumber) {
    const [found] = await db
      .select()
      .from(verifiedEntities)
      .where(and(eq(verifiedEntities.entityType, "company"), eq(verifiedEntities.rcNumber, rcNumber)));
    existing = found;
  }

  if (!existing) {
    const [foundByEmail] = await db
      .select()
      .from(verifiedEntities)
      .where(and(eq(verifiedEntities.entityType, "company"), eq(verifiedEntities.email, request.subjectEmail)));
    existing = foundByEmail;
  }

  if (existing) {
    await db
      .update(verifiedEntities)
      .set({
        verificationCount: sql`${verifiedEntities.verificationCount} + 1`,
        lastVerifiedAt: now,
        lastVerifiedByOrgId: orgId,
        lastVerificationRequestId: request.id,
        riskScore: riskScore || existing.riskScore,
        amlScreeningStatus: amlScreeningStatus || existing.amlScreeningStatus,
        fullName: companyName,
        email: request.subjectEmail,
        rcNumber: rcNumber || existing.rcNumber,
        tinNumber: tinNumber || existing.tinNumber,
        updatedAt: now,
      })
      .where(eq(verifiedEntities.id, existing.id));
  } else {
    await db.insert(verifiedEntities).values({
      entityType: "company",
      fullName: companyName,
      email: request.subjectEmail,
      rcNumber,
      tinNumber,
      country: "NG",
      verificationCount: 1,
      lastVerifiedAt: now,
      lastVerifiedByOrgId: orgId,
      lastVerificationRequestId: request.id,
      riskScore: riskScore || null,
      amlScreeningStatus: amlScreeningStatus || null,
      firstVerifiedAt: now,
    });
  }
}

/**
 * Upsert a verified individual directly from a user ID (Smile ID / platform verification flow).
 * Called by the verification webhook handler when a founder's identity verification reaches "verified".
 */
export async function upsertVerifiedIndividualByUserId(userId: string): Promise<void> {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const [profile] = await db.select().from(founderProfiles).where(eq(founderProfiles.userId, userId)).limit(1);
    if (!user) return;

    const bvnRaw = profile?.bvnEncrypted || null;
    const ninRaw = profile?.ninEncrypted || null;
    const bvnHash = bvnRaw ? tryDecryptAndHash(bvnRaw) : null;
    const ninHash = ninRaw ? tryDecryptAndHash(ninRaw) : null;
    const now = new Date();
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Unknown";

    const matchConditions: ReturnType<typeof eq>[] = [];
    if (bvnHash) matchConditions.push(eq(verifiedEntities.bvnHash, bvnHash));
    if (ninHash) matchConditions.push(eq(verifiedEntities.ninHash, ninHash));

    let existing = null;
    if (matchConditions.length > 0) {
      const [found] = await db.select().from(verifiedEntities)
        .where(and(eq(verifiedEntities.entityType, "individual"), or(...matchConditions)));
      existing = found;
    }
    if (!existing && user.email) {
      const [found] = await db.select().from(verifiedEntities)
        .where(and(eq(verifiedEntities.entityType, "individual"), eq(verifiedEntities.email, user.email)));
      existing = found;
    }

    if (existing) {
      await db.update(verifiedEntities).set({
        verificationCount: sql`${verifiedEntities.verificationCount} + 1`,
        lastVerifiedAt: now,
        fullName,
        email: user.email || existing.email,
        bvnHash: bvnHash || existing.bvnHash,
        ninHash: ninHash || existing.ninHash,
        updatedAt: now,
      }).where(eq(verifiedEntities.id, existing.id));
    } else {
      await db.insert(verifiedEntities).values({
        entityType: "individual",
        fullName,
        email: user.email || "",
        bvnHash,
        ninHash,
        country: "NG",
        verificationCount: 1,
        lastVerifiedAt: now,
        firstVerifiedAt: now,
      });
    }
    console.log(`[VerifiedEntityService] Individual ${userId} added to Verified Entities Registry`);
  } catch (err) {
    console.error("[VerifiedEntityService] Failed to add individual to verified registry:", err);
  }
}
