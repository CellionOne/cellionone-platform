/**
 * Youverify Webhook Handler
 * Handles 'address.completed' events from Youverify field agent visits.
 */

import { db } from "../db";
import { eq } from "drizzle-orm";
import { addressVerificationJobs, companyApplications } from "../../shared/schema";
import { storage } from "../storage";
import { getJobResult } from "./youverifyService";

export async function processYouverifyWebhook(
  payload: string,
  headers: Record<string, string | string[] | undefined>
): Promise<{ success: boolean; error?: string }> {
  let event: any;

  try {
    event = JSON.parse(payload);
  } catch {
    return { success: false, error: "Invalid JSON payload" };
  }

  const eventType: string = event.event || event.type || "";
  console.log(`[Youverify Webhook] Received event: ${eventType}`);

  if (eventType !== "address.completed") {
    console.log(`[Youverify Webhook] Ignoring unhandled event: ${eventType}`);
    return { success: true };
  }

  const referenceId: string | undefined =
    event.data?.id || event.data?.referenceId || event.referenceId;

  if (!referenceId) {
    console.error("[Youverify Webhook] No referenceId in payload:", JSON.stringify(event));
    return { success: false, error: "Missing referenceId" };
  }

  const [job] = await db
    .select()
    .from(addressVerificationJobs)
    .where(eq(addressVerificationJobs.youverifyReferenceId, referenceId));

  if (!job) {
    console.warn(`[Youverify Webhook] No job found for referenceId: ${referenceId}`);
    return { success: false, error: "Job not found" };
  }

  // Pull full result from Youverify to get GPS, photos, etc.
  const jobResult = await getJobResult(referenceId);
  const taskStatus: string = jobResult?.taskStatus || event.data?.taskStatus || "UNKNOWN";
  const verdict = taskStatus === "VERIFIED" ? "verified" : "not_verified";
  const newStatus = "completed";

  const findings = {
    taskStatus,
    gpsCoordinates: jobResult?.gpsCoordinates || event.data?.gpsCoordinates,
    buildingType: jobResult?.buildingType || event.data?.buildingType,
    buildingColor: jobResult?.buildingColor || event.data?.buildingColor,
    submissionDistanceInMeters:
      jobResult?.submissionDistanceInMeters ?? event.data?.submissionDistanceInMeters,
    agentPhotoUrl: jobResult?.agentPhoto || event.data?.agentPhoto,
    agentSignatureUrl: jobResult?.agentSignature || event.data?.agentSignature,
    summary: jobResult?.summary || event.data?.summary,
    rawPayload: event.data,
  };

  await db
    .update(addressVerificationJobs)
    .set({
      status: newStatus,
      verdict,
      findingsJson: findings,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(addressVerificationJobs.id, job.id));

  // Update the application's address verification status
  const appStatus = verdict === "verified" ? "verified" : "not_verified";
  await db
    .update(companyApplications)
    .set({
      addressVerificationStatus: appStatus,
      updatedAt: new Date(),
    })
    .where(eq(companyApplications.id, job.applicationId));

  // Notify the founder
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
