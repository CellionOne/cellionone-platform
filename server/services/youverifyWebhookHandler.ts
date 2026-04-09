/**
 * Youverify Webhook Handler
 * Handles 'address.completed' events from Youverify field agent visits.
 *
 * Authentication: validates the 'token' header matches YOUVERIFY_API_TOKEN
 * (Youverify includes this header in every webhook delivery).
 */

import { db } from "../db";
import { eq } from "drizzle-orm";
import { addressVerificationJobs, companyApplications, userRoles } from "../../shared/schema";
import { storage } from "../storage";
import { getJobResult } from "./youverifyService";
import { sendNewOrderNotificationEmail, ADMIN_NOTIFICATION_EMAIL } from "./emailService";

interface YouverifyGpsCoordinates {
  latitude: number;
  longitude: number;
}

interface YouverifyWebhookData {
  id?: string;
  referenceId?: string;
  taskStatus?: string;
  gpsCoordinates?: YouverifyGpsCoordinates;
  buildingType?: string;
  buildingColor?: string;
  submissionDistanceInMeters?: number;
  agentPhoto?: string;
  agentSignature?: string;
  summary?: string;
}

interface YouverifyWebhookPayload {
  event?: string;
  type?: string;
  referenceId?: string;
  data?: YouverifyWebhookData;
}

function validateWebhookToken(
  headers: Record<string, string | string[] | undefined>
): boolean {
  const apiToken = process.env.YOUVERIFY_API_TOKEN;
  if (!apiToken) {
    // Token not configured — allow through with a warning (dev/staging mode).
    // In production this will never happen because YOUVERIFY_API_TOKEN is required.
    console.warn("[Youverify Webhook] YOUVERIFY_API_TOKEN not set — skipping token validation");
    return true;
  }

  const headerToken =
    headers["token"] ||
    headers["x-youverify-token"] ||
    headers["authorization"];

  const headerValue = Array.isArray(headerToken) ? headerToken[0] : headerToken;
  if (!headerValue) {
    console.error("[Youverify Webhook] Missing authentication token header");
    return false;
  }

  // Strip 'Bearer ' prefix if present
  const providedToken = headerValue.replace(/^Bearer\s+/i, "").trim();
  return providedToken === apiToken;
}

export async function processYouverifyWebhook(
  payload: string,
  headers: Record<string, string | string[] | undefined>
): Promise<{ success: boolean; error?: string }> {
  // 1. Validate webhook authenticity
  if (!validateWebhookToken(headers)) {
    return { success: false, error: "Unauthorized: invalid webhook token" };
  }

  // 2. Parse payload
  let event: YouverifyWebhookPayload;
  try {
    event = JSON.parse(payload) as YouverifyWebhookPayload;
  } catch {
    return { success: false, error: "Invalid JSON payload" };
  }

  const eventType: string = event.event || event.type || "";
  console.log(`[Youverify Webhook] Received event: ${eventType}`);

  if (eventType !== "address.completed") {
    console.log(`[Youverify Webhook] Ignoring unhandled event: ${eventType}`);
    return { success: true };
  }

  // 3. Extract reference ID
  const referenceId: string | undefined =
    event.data?.id || event.data?.referenceId || event.referenceId;

  if (!referenceId) {
    console.error("[Youverify Webhook] No referenceId in payload:", JSON.stringify(event));
    return { success: false, error: "Missing referenceId" };
  }

  // 4. Find the job
  const [job] = await db
    .select()
    .from(addressVerificationJobs)
    .where(eq(addressVerificationJobs.youverifyReferenceId, referenceId));

  if (!job) {
    console.warn(`[Youverify Webhook] No job found for referenceId: ${referenceId}`);
    return { success: false, error: "Job not found" };
  }

  // 5. Pull full result from Youverify API (source of truth)
  const jobResult = await getJobResult(referenceId) as YouverifyWebhookData | null;
  const taskStatus: string =
    jobResult?.taskStatus ?? event.data?.taskStatus ?? "UNKNOWN";
  const verdict = taskStatus === "VERIFIED" ? "verified" : "not_verified";

  const findings = {
    taskStatus,
    gpsCoordinates: jobResult?.gpsCoordinates ?? event.data?.gpsCoordinates,
    buildingType: jobResult?.buildingType ?? event.data?.buildingType,
    buildingColor: jobResult?.buildingColor ?? event.data?.buildingColor,
    submissionDistanceInMeters:
      jobResult?.submissionDistanceInMeters ??
      event.data?.submissionDistanceInMeters,
    agentPhotoUrl: jobResult?.agentPhoto ?? event.data?.agentPhoto,
    agentSignatureUrl: jobResult?.agentSignature ?? event.data?.agentSignature,
    summary: jobResult?.summary ?? event.data?.summary,
    rawPayload: event.data,
  };

  // 6. Update job record
  await db
    .update(addressVerificationJobs)
    .set({
      status: "completed",
      verdict,
      findingsJson: findings,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(addressVerificationJobs.id, job.id));

  // 7. Update application address verification status
  const appStatus = verdict === "verified" ? "verified" : "not_verified";
  await db
    .update(companyApplications)
    .set({
      addressVerificationStatus: appStatus,
      updatedAt: new Date(),
    })
    .where(eq(companyApplications.id, job.applicationId));

  // 8. Notify founder
  await storage.createNotification({
    userId: job.founderId,
    title:
      verdict === "verified"
        ? "Operating Address Verified"
        : "Operating Address — Verification Incomplete",
    message:
      verdict === "verified"
        ? "A field agent has visited and confirmed your operating address. Your application is progressing."
        : "A field agent visited your operating address but could not complete verification. An admin will review and contact you.",
    type: verdict === "verified" ? "success" : "warning",
    linkUrl: `/applications/${job.applicationId}`,
  });

  // 9. Notify all admin users (in-app)
  try {
    const adminUsers = await db
      .select({ id: userRoles.userId })
      .from(userRoles)
      .where(eq(userRoles.role, "admin"));

    for (const admin of adminUsers) {
      await storage.createNotification({
        userId: admin.id,
        title: `Field Verification ${verdict === "verified" ? "Passed" : "Failed"} — Job #${job.id}`,
        message: `Youverify field agent ${verdict === "verified" ? "confirmed" : "could not confirm"} the operating address for application #${job.applicationId}. Review findings in the Field Verifications panel.`,
        type: verdict === "verified" ? "success" : "warning",
        linkUrl: "/admin/field-verifications",
      });
    }
  } catch (notifyErr: unknown) {
    const msg = notifyErr instanceof Error ? notifyErr.message : String(notifyErr);
    console.error("[Youverify Webhook] Failed to notify admin users:", msg);
  }

  // 10. Send admin email notification
  try {
    const [app] = await db
      .select({ companyName: companyApplications.companyName })
      .from(companyApplications)
      .where(eq(companyApplications.id, job.applicationId));

    await sendNewOrderNotificationEmail(ADMIN_NOTIFICATION_EMAIL, {
      orderId: job.applicationId,
      founderName: `Application #${job.applicationId}${app?.companyName ? ` — ${app.companyName}` : ""}`,
      founderEmail: `Job #${job.id} | Verdict: ${verdict.toUpperCase()}`,
      totalAmount: 0,
      items: [
        {
          sku: "FIELD_VERIFICATION",
          name: `Youverify Address Verification — ${verdict === "verified" ? "PASSED" : "FAILED"} (${taskStatus})`,
          unitPrice: 0,
        },
      ],
    });
  } catch (emailErr: unknown) {
    const msg = emailErr instanceof Error ? emailErr.message : String(emailErr);
    console.error("[Youverify Webhook] Failed to send admin email notification:", msg);
  }

  // 11. Audit log
  await storage.createAuditLog({
    actorUserId: "system",
    action: "youverify_address_completed",
    entityType: "address_verification_job",
    entityId: String(job.id),
    details: {
      referenceId,
      verdict,
      taskStatus,
      applicationId: job.applicationId,
      founderId: job.founderId,
    },
  });

  console.log(
    `[Youverify Webhook] Job #${job.id} completed — verdict: ${verdict}, referenceId: ${referenceId}`
  );

  return { success: true };
}
