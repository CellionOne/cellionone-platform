/**
 * Youverify Webhook Handler
 * Handles events from Youverify field agent visits.
 *
 * Supported events:
 *   address.completed      — terminal: agent visit done, VERIFIED or NOT_VERIFIED
 *   address.agentAssigned  — intermediate: agent has been dispatched
 *   address.inProgress     — intermediate: agent visit is in progress (alias)
 *
 * Authentication: validates the 'token' header against YOUVERIFY_API_TOKEN.
 * FAIL-CLOSED: rejects ALL requests if YOUVERIFY_API_TOKEN is not configured.
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

/** Known terminal task statuses from Youverify. */
const VERIFIED_STATUS = "VERIFIED";
const NOT_VERIFIED_STATUS = "NOT_VERIFIED";

/**
 * Validates the webhook request is genuinely from Youverify.
 * FAIL-CLOSED: if the configured secret is absent, all requests are rejected.
 */
function validateWebhookToken(
  headers: Record<string, string | string[] | undefined>
): { valid: boolean; reason?: string } {
  const apiToken = process.env.YOUVERIFY_API_TOKEN;

  if (!apiToken) {
    // FAIL-CLOSED: we cannot authenticate without the token; reject all requests.
    console.error(
      "[Youverify Webhook] YOUVERIFY_API_TOKEN is not configured — rejecting all webhook requests (fail-closed)"
    );
    return { valid: false, reason: "Webhook authentication not configured" };
  }

  const rawHeader =
    headers["token"] ||
    headers["x-youverify-token"] ||
    headers["authorization"];

  const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

  if (!headerValue) {
    console.error("[Youverify Webhook] Missing authentication token header");
    return { valid: false, reason: "Missing authentication header" };
  }

  // Strip 'Bearer ' prefix if present
  const providedToken = headerValue.replace(/^Bearer\s+/i, "").trim();

  if (providedToken !== apiToken) {
    console.error("[Youverify Webhook] Token mismatch — rejecting request");
    return { valid: false, reason: "Invalid webhook token" };
  }

  return { valid: true };
}

/**
 * Resolves the job/app status for intermediate events (agent assigned/in progress).
 */
async function handleIntermediateEvent(
  referenceId: string,
  eventType: string
): Promise<{ success: boolean; error?: string }> {
  const [job] = await db
    .select()
    .from(addressVerificationJobs)
    .where(eq(addressVerificationJobs.youverifyReferenceId, referenceId));

  if (!job) {
    console.warn(`[Youverify Webhook] No job found for referenceId: ${referenceId} (event: ${eventType})`);
    return { success: false, error: "Job not found" };
  }

  // Only progress forward — don't regress a completed job
  if (job.status === "completed") {
    console.log(`[Youverify Webhook] Job #${job.id} already completed — ignoring intermediate event ${eventType}`);
    return { success: true };
  }

  await db
    .update(addressVerificationJobs)
    .set({ status: "agent_assigned", updatedAt: new Date() })
    .where(eq(addressVerificationJobs.id, job.id));

  await db
    .update(companyApplications)
    .set({ addressVerificationStatus: "agent_assigned", updatedAt: new Date() })
    .where(eq(companyApplications.id, job.applicationId));

  await storage.createAuditLog({
    actorUserId: "system",
    action: "youverify_agent_assigned",
    entityType: "address_verification_job",
    entityId: String(job.id),
    details: { referenceId, eventType, applicationId: job.applicationId },
  });

  console.log(`[Youverify Webhook] Job #${job.id} updated to agent_assigned (event: ${eventType})`);
  return { success: true };
}

export async function processYouverifyWebhook(
  payload: string,
  headers: Record<string, string | string[] | undefined>
): Promise<{ success: boolean; error?: string }> {
  // 1. Validate webhook authenticity — FAIL-CLOSED
  const auth = validateWebhookToken(headers);
  if (!auth.valid) {
    return { success: false, error: auth.reason ?? "Unauthorized" };
  }

  // 2. Parse payload
  let event: YouverifyWebhookPayload;
  try {
    event = JSON.parse(payload) as YouverifyWebhookPayload;
  } catch {
    return { success: false, error: "Invalid JSON payload" };
  }

  const eventType: string = (event.event ?? event.type ?? "").toLowerCase();
  console.log(`[Youverify Webhook] Received event: ${eventType}`);

  // 3. Route intermediate events
  const AGENT_ASSIGNED_EVENTS = ["address.agentassigned", "address.agent_assigned", "address.inprogress", "address.in_progress"];
  if (AGENT_ASSIGNED_EVENTS.includes(eventType)) {
    const referenceId = event.data?.id ?? event.data?.referenceId ?? event.referenceId;
    if (!referenceId) return { success: false, error: "Missing referenceId" };
    return handleIntermediateEvent(referenceId, eventType);
  }

  // 4. Handle terminal completion event
  if (eventType !== "address.completed") {
    console.log(`[Youverify Webhook] Ignoring unhandled event: ${eventType}`);
    return { success: true };
  }

  // 5. Extract reference ID
  const referenceId: string | undefined =
    event.data?.id ?? event.data?.referenceId ?? event.referenceId;

  if (!referenceId) {
    console.error("[Youverify Webhook] No referenceId in payload:", JSON.stringify(event));
    return { success: false, error: "Missing referenceId" };
  }

  // 6. Find the job
  const [job] = await db
    .select()
    .from(addressVerificationJobs)
    .where(eq(addressVerificationJobs.youverifyReferenceId, referenceId));

  if (!job) {
    console.warn(`[Youverify Webhook] No job found for referenceId: ${referenceId}`);
    return { success: false, error: "Job not found" };
  }

  // 7. Pull authoritative result from Youverify API (source of truth)
  const jobResult = await getJobResult(referenceId) as YouverifyWebhookData | null;
  const taskStatus: string | undefined =
    jobResult?.taskStatus ?? event.data?.taskStatus;

  // 8. Harden verdict resolution — only set for explicit known terminal statuses
  let verdict: string | null = null;
  let terminalStatus: string;

  if (taskStatus === VERIFIED_STATUS) {
    verdict = "verified";
    terminalStatus = "completed";
  } else if (taskStatus === NOT_VERIFIED_STATUS) {
    verdict = "not_verified";
    terminalStatus = "completed";
  } else {
    // Non-terminal or unrecognised status — record as failed without setting verdict;
    // an admin can override once the situation is clarified.
    verdict = null;
    terminalStatus = "failed";
    console.warn(
      `[Youverify Webhook] Unexpected/missing taskStatus "${taskStatus}" for referenceId ${referenceId}` +
      ` — marking job as failed without verdict (admin can override)`
    );
  }

  const findings = {
    taskStatus: taskStatus ?? "UNKNOWN",
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

  // 9. Update job record
  await db
    .update(addressVerificationJobs)
    .set({
      status: terminalStatus,
      verdict,
      findingsJson: findings,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(addressVerificationJobs.id, job.id));

  // 10. Update application address verification status
  const appStatus =
    verdict === "verified" ? "verified" :
    verdict === "not_verified" ? "not_verified" :
    "failed";

  await db
    .update(companyApplications)
    .set({ addressVerificationStatus: appStatus, updatedAt: new Date() })
    .where(eq(companyApplications.id, job.applicationId));

  // 11. Notify founder (only for terminal verdicts, not failed-unknown)
  if (verdict !== null) {
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
  }

  // 12. Notify all admin users (in-app)
  try {
    const adminUsers = await db
      .select({ id: userRoles.userId })
      .from(userRoles)
      .where(eq(userRoles.role, "admin"));

    const adminTitle = verdict !== null
      ? `Field Verification ${verdict === "verified" ? "Passed" : "Failed"} — Job #${job.id}`
      : `Field Verification Inconclusive — Job #${job.id}`;
    const adminMsg = verdict !== null
      ? `Youverify agent ${verdict === "verified" ? "confirmed" : "could not confirm"} the operating address for application #${job.applicationId}.`
      : `Youverify returned an unrecognised status ("${taskStatus}") for application #${job.applicationId}. Manual review required.`;

    for (const admin of adminUsers) {
      await storage.createNotification({
        userId: admin.id,
        title: adminTitle,
        message: `${adminMsg} Review findings in the Field Verifications panel.`,
        type: verdict === "verified" ? "success" : "warning",
        linkUrl: "/admin/field-verifications",
      });
    }
  } catch (notifyErr: unknown) {
    const msg = notifyErr instanceof Error ? notifyErr.message : String(notifyErr);
    console.error("[Youverify Webhook] Failed to notify admin users:", msg);
  }

  // 13. Send admin email notification
  try {
    const [app] = await db
      .select({ companyName: companyApplications.companyName })
      .from(companyApplications)
      .where(eq(companyApplications.id, job.applicationId));

    const statusLabel =
      verdict === "verified" ? "VERIFIED" :
      verdict === "not_verified" ? "NOT_VERIFIED" :
      `INCONCLUSIVE (${taskStatus})`;

    await sendNewOrderNotificationEmail(ADMIN_NOTIFICATION_EMAIL, {
      orderId: job.applicationId,
      founderName: `Application #${job.applicationId}${app?.companyName ? ` — ${app.companyName}` : ""}`,
      founderEmail: `Job #${job.id} | Verdict: ${statusLabel}`,
      totalAmount: 0,
      items: [
        {
          sku: "FIELD_VERIFICATION",
          name: `Youverify Address Verification — ${statusLabel}`,
          unitPrice: 0,
        },
      ],
    });
  } catch (emailErr: unknown) {
    const msg = emailErr instanceof Error ? emailErr.message : String(emailErr);
    console.error("[Youverify Webhook] Failed to send admin email notification:", msg);
  }

  // 14. Audit log
  await storage.createAuditLog({
    actorUserId: "system",
    action: "youverify_address_completed",
    entityType: "address_verification_job",
    entityId: String(job.id),
    details: {
      referenceId,
      verdict,
      taskStatus,
      terminalStatus,
      applicationId: job.applicationId,
      founderId: job.founderId,
    },
  });

  console.log(
    `[Youverify Webhook] Job #${job.id} — terminalStatus: ${terminalStatus}, verdict: ${verdict ?? "none"}, referenceId: ${referenceId}`
  );

  return { success: true };
}
