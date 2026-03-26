/**
 * Verification Webhook Handler
 * 
 * Handles incoming webhooks from external identity verification services.
 * This is a placeholder implementation that can be adapted for various providers
 * like Smile ID, Onfido, Jumio, etc.
 * 
 * SECURITY: Includes signature verification and idempotency handling.
 */

import { db } from "../db";
import { companyApplications, identityVerifications, addDirectorRequests, serviceRequests, users, founderProfiles } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import * as verificationService from "./verificationService";
import { upsertVerifiedIndividualByUserId } from "./verifiedEntityService";
import { getResendClient } from "./emailService";
import { storage } from "../storage";
import type { IncomingHttpHeaders } from "http";
import crypto from "crypto";

// In-memory set for idempotency (in production, use Redis or database)
const processedWebhooks = new Set<string>();
const PROCESSED_WEBHOOK_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface WebhookResult {
  success: boolean;
  error?: string;
  userId?: string;
  alreadyProcessed?: boolean;
}

interface VerificationWebhookPayload {
  event: string;
  eventId?: string;
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

function verifyWebhookSignature(
  payload: string,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature) {
    return false;
  }

  // Support multiple signature formats (HMAC-SHA256 is common)
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    // Buffer length mismatch - signatures don't match
    return false;
  }
}

function getIdempotencyKey(payload: VerificationWebhookPayload): string {
  // Use eventId if available, otherwise combine event + sessionId + timestamp
  if (payload.eventId) {
    return payload.eventId;
  }
  return `${payload.event}:${payload.data.sessionId}:${payload.data.timestamp || Date.now()}`;
}

function isWebhookAlreadyProcessed(idempotencyKey: string): boolean {
  return processedWebhooks.has(idempotencyKey);
}

function markWebhookProcessed(idempotencyKey: string): void {
  processedWebhooks.add(idempotencyKey);
  
  // Clean up old entries after TTL (simple implementation)
  setTimeout(() => {
    processedWebhooks.delete(idempotencyKey);
  }, PROCESSED_WEBHOOK_TTL);
}

export async function processVerificationWebhook(
  payload: string,
  headers: IncomingHttpHeaders
): Promise<WebhookResult> {
  // Get webhook secret from environment
  const webhookSecret = process.env.VERIFICATION_WEBHOOK_SECRET;
  
  // SECURITY: Verify webhook signature if secret is configured
  if (webhookSecret) {
    const signature = 
      headers["x-verification-signature"] || 
      headers["x-webhook-signature"] ||
      headers["x-signature"];
    
    const signatureStr = Array.isArray(signature) ? signature[0] : signature;
    
    if (!verifyWebhookSignature(payload, signatureStr, webhookSecret)) {
      console.error("[Verification Webhook] Invalid signature - rejecting webhook");
      return { success: false, error: "Invalid webhook signature" };
    }
    console.log("[Verification Webhook] Signature verified successfully");
  } else {
    console.warn("[Verification Webhook] No VERIFICATION_WEBHOOK_SECRET configured - skipping signature verification (NOT RECOMMENDED FOR PRODUCTION)");
  }

  try {
    const data: VerificationWebhookPayload = JSON.parse(payload);
    
    // Idempotency check - prevent duplicate processing
    const idempotencyKey = getIdempotencyKey(data);
    if (isWebhookAlreadyProcessed(idempotencyKey)) {
      console.log(`[Verification Webhook] Duplicate webhook detected, skipping: ${idempotencyKey}`);
      return { success: true, alreadyProcessed: true };
    }
    
    console.log(`[Verification Webhook] Processing event: ${data.event} (key: ${idempotencyKey})`);
    
    let result: WebhookResult;
    
    switch (data.event) {
      case "verification.completed":
      case "verification.approved":
        result = await handleVerificationApproved(data.data);
        break;
        
      case "verification.declined":
      case "verification.failed":
        result = await handleVerificationDeclined(data.data);
        break;
        
      case "verification.pending":
        result = await handleVerificationPending(data.data);
        break;
        
      default:
        console.log(`[Verification Webhook] Unhandled event type: ${data.event}`);
        result = { success: true };
    }
    
    // Mark as processed only on success
    if (result.success) {
      markWebhookProcessed(idempotencyKey);
    }
    
    return result;
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
    
    // Check if already verified (additional idempotency at data level)
    if (verification.status === "verified") {
      console.log(`[Verification Webhook] User ${verification.founderUserId} already verified, skipping`);
      return { success: true, userId: verification.founderUserId, alreadyProcessed: true };
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
    await updatePendingDirectorSRs(userId);

    // Auto-populate verified entities registry for the individual
    await upsertVerifiedIndividualByUserId(userId);
    
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
    
    // Check if already processed
    if (verification.status === "rejected") {
      console.log(`[Verification Webhook] Verification ${verification.id} already rejected, skipping`);
      return { success: true, userId: verification.founderUserId, alreadyProcessed: true };
    }
    
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

async function sendFounderNotificationEmail(
  founderUserId: string,
  subject: string,
  bodyHtml: string,
): Promise<void> {
  try {
    const [founderUser] = await db.select().from(users).where(eq(users.id, founderUserId)).limit(1);
    if (!founderUser?.email) return;
    const { client, fromEmail } = await getResendClient();
    await client.emails.send({ from: fromEmail, to: founderUser.email, subject, html: bodyHtml });
  } catch (e) {
    console.error('[VerificationWebhook] Failed to send founder notification email:', e);
  }
}

async function updatePendingDirectorSRs(verifiedUserId: string): Promise<void> {
  try {
    const [verifiedUser] = await db.select().from(users).where(eq(users.id, verifiedUserId)).limit(1);
    if (!verifiedUser?.email) return;

    const pendingADRs = await db.select().from(addDirectorRequests)
      .where(and(
        eq(addDirectorRequests.newDirectorEmail, verifiedUser.email),
        eq(addDirectorRequests.directorVerificationStatus, 'invited'),
      ));

    for (const adr of pendingADRs) {
      await db.update(addDirectorRequests)
        .set({ directorVerifiedAt: new Date(), directorVerificationStatus: 'verified', updatedAt: new Date() })
        .where(eq(addDirectorRequests.id, adr.id));

      await db.update(serviceRequests)
        .set({ status: 'ready_for_filing', updatedAt: new Date() })
        .where(and(
          eq(serviceRequests.id, adr.serviceRequestId),
          eq(serviceRequests.status, 'awaiting_director_verification'),
        ));

      await storage.createAuditLog({
        actorUserId: verifiedUserId,
        action: 'director_verified_auto_transition',
        entityType: 'service_request',
        entityId: String(adr.serviceRequestId),
        details: {
          directorEmail: verifiedUser.email,
          newStatus: 'ready_for_filing',
          trigger: 'identity_verification_complete',
        },
      });

      await sendFounderNotificationEmail(
        adr.founderId,
        `Director Verified — Service Request Ready for Filing`,
        `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f4f4f5;padding:20px;">
        <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:40px;">
          <h2 style="color:#18181b">Director Identity Verified</h2>
          <p>The new director you appointed for <strong>${adr.companyName || 'your company'}</strong> (${adr.newDirectorFirstName || ''} ${adr.newDirectorLastName || ''}) has successfully completed their identity verification on Cellion One.</p>
          <p>Your service request has automatically been updated to <strong>Ready for Filing</strong>. Our legal team will proceed with the CAC filing.</p>
          <p>Log in to your dashboard to track progress.</p>
          <a href="https://cellionone.com/founder/service-requests" style="display:inline-block;background:#059669;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">View Service Request</a>
        </div></body></html>`
      );

      console.log(`[VerificationWebhook] ADD_DIR SR #${adr.serviceRequestId} auto-transitioned to ready_for_filing`);
    }
  } catch (e) {
    console.error('[VerificationWebhook] Error auto-transitioning director SRs:', e);
  }
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
    // Additional idempotency: check if already submitted
    if (app.status !== "pending_verification") {
      console.log(`[Verification Webhook] Application ${app.id} already processed, skipping`);
      continue;
    }
    
    await db
      .update(companyApplications)
      .set({
        status: "submitted",
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(companyApplications.id, app.id),
          eq(companyApplications.status, "pending_verification") // Ensure we only update if still pending
        )
      );
    
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

