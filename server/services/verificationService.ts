import { db } from "../db";
import { identityVerifications } from "@shared/schema";
import { eq, and, gt } from "drizzle-orm";

const VERIFICATION_VALIDITY_DAYS = 365;

export interface VerificationStatus {
  isVerified: boolean;
  status: string;
  verifiedAt: Date | null;
  expiresAt: Date | null;
  daysUntilExpiry: number | null;
  requiresVerification: boolean;
  verificationId: number | null;
}

export async function getVerificationStatus(userId: string): Promise<VerificationStatus> {
  const now = new Date();
  
  const verification = await db
    .select()
    .from(identityVerifications)
    .where(eq(identityVerifications.founderUserId, userId))
    .orderBy(identityVerifications.createdAt)
    .limit(1);

  if (!verification.length) {
    return {
      isVerified: false,
      status: "not_started",
      verifiedAt: null,
      expiresAt: null,
      daysUntilExpiry: null,
      requiresVerification: true,
      verificationId: null,
    };
  }

  const record = verification[0];
  
  if (record.status === "verified" && record.expiresAt) {
    const expiresAt = new Date(record.expiresAt);
    if (expiresAt > now) {
      const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        isVerified: true,
        status: "verified",
        verifiedAt: record.verifiedAt,
        expiresAt: record.expiresAt,
        daysUntilExpiry,
        requiresVerification: false,
        verificationId: record.id,
      };
    } else {
      return {
        isVerified: false,
        status: "expired",
        verifiedAt: record.verifiedAt,
        expiresAt: record.expiresAt,
        daysUntilExpiry: 0,
        requiresVerification: true,
        verificationId: record.id,
      };
    }
  }

  return {
    isVerified: false,
    status: record.status || "not_started",
    verifiedAt: record.verifiedAt,
    expiresAt: record.expiresAt,
    daysUntilExpiry: null,
    requiresVerification: true,
    verificationId: record.id,
  };
}

export async function isUserVerified(userId: string): Promise<boolean> {
  const status = await getVerificationStatus(userId);
  return status.isVerified;
}

export async function markUserVerified(
  userId: string,
  options?: {
    method?: string;
    externalProvider?: string;
    externalSessionId?: string;
    selfieUrl?: string;
    livenessScore?: number;
    notes?: string;
  }
): Promise<{ success: boolean; verificationId: number }> {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + VERIFICATION_VALIDITY_DAYS);

  const existingVerification = await db
    .select()
    .from(identityVerifications)
    .where(eq(identityVerifications.founderUserId, userId))
    .limit(1);

  if (existingVerification.length) {
    const [updated] = await db
      .update(identityVerifications)
      .set({
        status: "verified",
        verifiedAt: now,
        expiresAt,
        method: options?.method || "external",
        externalProvider: options?.externalProvider,
        externalSessionId: options?.externalSessionId,
        selfieUrl: options?.selfieUrl,
        livenessScore: options?.livenessScore,
        notes: options?.notes,
        updatedAt: now,
      })
      .where(eq(identityVerifications.id, existingVerification[0].id))
      .returning();

    return { success: true, verificationId: updated.id };
  } else {
    const [created] = await db
      .insert(identityVerifications)
      .values({
        founderUserId: userId,
        status: "verified",
        verifiedAt: now,
        expiresAt,
        method: options?.method || "external",
        externalProvider: options?.externalProvider,
        externalSessionId: options?.externalSessionId,
        selfieUrl: options?.selfieUrl,
        livenessScore: options?.livenessScore,
        notes: options?.notes,
      })
      .returning();

    return { success: true, verificationId: created.id };
  }
}

export async function startVerificationSession(
  userId: string,
  provider: string,
  externalSessionId: string
): Promise<{ verificationId: number }> {
  const now = new Date();

  const existingVerification = await db
    .select()
    .from(identityVerifications)
    .where(eq(identityVerifications.founderUserId, userId))
    .limit(1);

  if (existingVerification.length) {
    const [updated] = await db
      .update(identityVerifications)
      .set({
        status: "in_progress",
        method: "external",
        externalProvider: provider,
        externalSessionId,
        updatedAt: now,
      })
      .where(eq(identityVerifications.id, existingVerification[0].id))
      .returning();

    return { verificationId: updated.id };
  } else {
    const [created] = await db
      .insert(identityVerifications)
      .values({
        founderUserId: userId,
        status: "in_progress",
        method: "external",
        externalProvider: provider,
        externalSessionId,
      })
      .returning();

    return { verificationId: created.id };
  }
}

export async function getVerificationByExternalSession(
  externalSessionId: string
): Promise<typeof identityVerifications.$inferSelect | null> {
  const [result] = await db
    .select()
    .from(identityVerifications)
    .where(eq(identityVerifications.externalSessionId, externalSessionId))
    .limit(1);

  return result || null;
}
