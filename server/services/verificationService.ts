import { db } from "../db";
import { identityVerifications } from "@shared/schema";
import { eq, and, gt, desc } from "drizzle-orm";

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
  
  // Always get the most recent verification record (order by createdAt DESC)
  const verification = await db
    .select()
    .from(identityVerifications)
    .where(eq(identityVerifications.founderUserId, userId))
    .orderBy(desc(identityVerifications.createdAt))
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

  // KYB pipeline founders: BVN/NIN was verified as part of company onboarding.
  // Their record has identitySource = 'kyb_pipeline' and bvnNinVerified = true
  // but status may remain 'in_progress' / 'pending'. Treat them as fully verified.
  if (record.identitySource === 'kyb_pipeline' && record.bvnNinVerified === true) {
    const verifiedAt = record.verifiedAt ?? record.createdAt ?? now;
    const expiresAt = new Date(new Date(verifiedAt).getTime() + VERIFICATION_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
    if (expiresAt > now) {
      const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        isVerified: true,
        status: "verified",
        verifiedAt: record.verifiedAt ?? record.createdAt,
        expiresAt,
        daysUntilExpiry,
        requiresVerification: false,
        verificationId: record.id,
      };
    }
  }

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

  // Get the most recent verification record (order by createdAt DESC)
  const existingVerification = await db
    .select()
    .from(identityVerifications)
    .where(eq(identityVerifications.founderUserId, userId))
    .orderBy(desc(identityVerifications.createdAt))
    .limit(1);

  if (existingVerification.length) {
    // Update the most recent record
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

  // Get the most recent verification record
  const existingVerification = await db
    .select()
    .from(identityVerifications)
    .where(eq(identityVerifications.founderUserId, userId))
    .orderBy(desc(identityVerifications.createdAt))
    .limit(1);

  if (existingVerification.length) {
    // Update the most recent record
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
