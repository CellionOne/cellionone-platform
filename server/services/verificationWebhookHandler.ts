/**
 * Verification Webhook Handler
 * 
 * Handles incoming webhooks from external identity verification services.
 * This is a placeholder implementation that can be adapted for various providers
 * like Smile ID, Onfido, Jumio, etc.
 */

import { db } from "../db";
import { companyApplications } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import * as verificationService from "./verificationService";
import { storage } from "../storage";
import type { IncomingHttpHeaders } from "http";

interface WebhookResult {
  success: boolean;
  error?: string;
  userId?: string;
}

interface VerificationWebhookPayload {
  event: string;
  data: {
    sessionId: string;
    userId?: string;
    status: "approved" | "declined" | "pending" | "error";
    result?: {
      selfieUrl?: string;
      livenessScore?: number;
      documentVerified?: boolean;
      notes?: string;
    };
    provider?: string;
    timestamp?: string;
  };
}

export async function processVerificationWebhook(
  payload: string,
  headers: IncomingHttpHeaders
): Promise<WebhookResult> {
  try {
    const data: VerificationWebhookPayload = JSON.parse(payload);
    
    console.log(`[Verification Webhook] Received event: ${data.event}`);
    
    switch (data.event) {
      case "verification.completed":
      case "verification.approved":
        return await handleVerificationApproved(data.data);
        
      case "verification.declined":
      case "verification.failed":
        return await handleVerificationDeclined(data.data);
        
      case "verification.pending":
        return await handleVerificationPending(data.data);
        
      default:
        console.log(`[Verification Webhook] Unhandled event type: ${data.event}`);
        return { success: true };
    }
  } catch (error: any) {
    console.error("[Verification Webhook] Parse error:", error.message);
    return { success: false, error: "Invalid payload" };
  }
}

async function handleVerificationApproved(
  data: VerificationWebhookPayload["data"]
): Promise<WebhookResult> {
  try {
    const verification = await verificationService.getVerificationByExternalSession(data.sessionId);
    
    if (!verification) {
      console.error(`[Verification Webhook] No verification found for session: ${data.sessionId}`);
      return { success: false, error: "Verification session not found" };
    }
    
    const userId = verification.founderUserId;
    
    await verificationService.markUserVerified(userId, {
      method: "external",
      externalProvider: data.provider,
      externalSessionId: data.sessionId,
      selfieUrl: data.result?.selfieUrl,
      livenessScore: data.result?.livenessScore,
      notes: data.result?.notes || "Verified via external provider",
    });
    
    await updatePendingApplications(userId);
    
    await storage.createAuditLog({
      actorUserId: userId,
      action: "identity_verified",
      entityType: "identity_verification",
      entityId: verification.id.toString(),
      details: {
        method: "external",
        provider: data.provider,
        sessionId: data.sessionId,
      },
    });
    
    console.log(`[Verification Webhook] User ${userId} verified successfully`);
    return { success: true, userId };
  } catch (error: any) {
    console.error("[Verification Webhook] Error handling approval:", error.message);
    return { success: false, error: error.message };
  }
}

async function handleVerificationDeclined(
  data: VerificationWebhookPayload["data"]
): Promise<WebhookResult> {
  try {
    const verification = await verificationService.getVerificationByExternalSession(data.sessionId);
    
    if (!verification) {
      return { success: false, error: "Verification session not found" };
    }
    
    const { identityVerifications } = await import("@shared/schema");
    
    await db
      .update(identityVerifications)
      .set({
        status: "rejected",
        notes: data.result?.notes || "Verification declined by provider",
        updatedAt: new Date(),
      })
      .where(eq(identityVerifications.id, verification.id));
    
    await storage.createAuditLog({
      actorUserId: verification.founderUserId,
      action: "identity_verification_failed",
      entityType: "identity_verification",
      entityId: verification.id.toString(),
      details: {
        reason: data.result?.notes,
        provider: data.provider,
      },
    });
    
    console.log(`[Verification Webhook] Verification declined for user ${verification.founderUserId}`);
    return { success: true, userId: verification.founderUserId };
  } catch (error: any) {
    console.error("[Verification Webhook] Error handling decline:", error.message);
    return { success: false, error: error.message };
  }
}

async function handleVerificationPending(
  data: VerificationWebhookPayload["data"]
): Promise<WebhookResult> {
  console.log(`[Verification Webhook] Verification still pending for session: ${data.sessionId}`);
  return { success: true };
}

async function updatePendingApplications(userId: string): Promise<void> {
  const pendingApps = await db
    .select()
    .from(companyApplications)
    .where(
      and(
        eq(companyApplications.founderUserId, userId),
        eq(companyApplications.status, "pending_verification")
      )
    );
  
  for (const app of pendingApps) {
    await db
      .update(companyApplications)
      .set({
        status: "submitted",
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(companyApplications.id, app.id));
    
    await storage.createAuditLog({
      actorUserId: userId,
      action: "application_auto_submitted",
      entityType: "company_application",
      entityId: app.id.toString(),
      details: {
        previousStatus: "pending_verification",
        newStatus: "submitted",
        reason: "User identity verified",
      },
    });
    
    console.log(`[Verification Webhook] Application ${app.id} auto-submitted after verification`);
  }
}
