import { db } from "../db";
import { eq, and, lt, lte, gte, or, isNull, sql } from "drizzle-orm";
import {
  kycVerificationRequests,
  kycSubmittedDocuments,
  kycOrganisations,
  kycOrgMembers,
  kycBillingAccounts,
  kycSessions,
  kycSanctionsLogs,
  featureFlags,
  identityVerifications,
  notifications,
  users,
} from "@shared/schema";
import { getResendClient } from "./emailService";
import * as webhookService from "./kycWebhookService";
import * as billingService from "./kycBillingService";

async function sendKycEmail(to: string, subject: string, html: string) {
  try {
    const { client, fromEmail } = await getResendClient();
    await client.emails.send({ from: fromEmail, to, subject, html });
  } catch (error) {
    console.error("[KYCScheduler] Email send failed:", error);
  }
}

export async function runKycExpiryCheck() {
  console.log("[KYCScheduler] Running document expiry check...");

  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  let alertsSent = 0;
  let statusesUpdated = 0;

  const expiringDocs = await db.select({
    doc: kycSubmittedDocuments,
    request: kycVerificationRequests,
    org: kycOrganisations,
  })
    .from(kycSubmittedDocuments)
    .innerJoin(kycVerificationRequests, eq(kycSubmittedDocuments.verificationRequestId, kycVerificationRequests.id))
    .innerJoin(kycOrganisations, eq(kycVerificationRequests.orgId, kycOrganisations.id))
    .where(and(
      sql`${kycSubmittedDocuments.expiryDate} IS NOT NULL`,
      lte(kycSubmittedDocuments.expiryDate, thirtyDays),
      eq(kycSubmittedDocuments.status, "accepted"),
      eq(kycVerificationRequests.status, "verified")
    ));

  const orgAlerts = new Map<number, { orgName: string; expired: string[]; expiringSoon: string[]; reviewerEmails: string[] }>();

  for (const row of expiringDocs) {
    const expiryDate = new Date(row.doc.expiryDate!);
    const isExpired = expiryDate < now;
    const isUrgent = expiryDate < sevenDays;

    if (!orgAlerts.has(row.request.orgId)) {
      const reviewers = await db.select().from(kycOrgMembers)
        .where(and(
          eq(kycOrgMembers.orgId, row.request.orgId),
          eq(kycOrgMembers.inviteStatus, "accepted"),
          or(eq(kycOrgMembers.role, "org_admin"), eq(kycOrgMembers.role, "org_reviewer"))
        ));
      orgAlerts.set(row.request.orgId, {
        orgName: row.org.name,
        expired: [],
        expiringSoon: [],
        reviewerEmails: reviewers.map(r => r.inviteEmail).filter(Boolean),
      });
    }

    const alert = orgAlerts.get(row.request.orgId)!;
    const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const label = `${row.request.subjectName}'s "${row.doc.fileName}" (expires ${expiryDate.toLocaleDateString("en-NG")})`;

    if (isExpired) {
      alert.expired.push(label);

      await db.update(kycVerificationRequests)
        .set({ riskScore: "red", updatedAt: new Date() })
        .where(eq(kycVerificationRequests.id, row.request.id));
      statusesUpdated++;

      webhookService.deliverWebhook(row.request.orgId, "document.expired", {
        requestId: row.request.id,
        subjectName: row.request.subjectName,
        documentName: row.doc.fileName,
        expiryDate: expiryDate.toISOString(),
      }).catch(err => console.error("[KYCScheduler] Webhook delivery error:", err));
    } else {
      alert.expiringSoon.push(`${label} — ${daysLeft} days remaining`);

      if (row.request.riskScore !== "red") {
        await db.update(kycVerificationRequests)
          .set({ riskScore: "amber", updatedAt: new Date() })
          .where(eq(kycVerificationRequests.id, row.request.id));
        statusesUpdated++;
      }

      if (daysLeft <= 30) {
        webhookService.deliverWebhook(row.request.orgId, "document.expiring", {
          requestId: row.request.id,
          subjectName: row.request.subjectName,
          documentName: row.doc.fileName,
          expiryDate: expiryDate.toISOString(),
          daysRemaining: daysLeft,
        }).catch(err => console.error("[KYCScheduler] Webhook delivery error:", err));
      }
    }
  }

  for (const [orgId, alert] of orgAlerts) {
    if (alert.expired.length === 0 && alert.expiringSoon.length === 0) continue;

    const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#0d9668;">${alert.orgName} — Document Expiry Alert</h2>
      ${alert.expired.length > 0 ? `
        <h3 style="color:#dc2626;">Expired Documents</h3>
        <ul>${alert.expired.map(e => `<li>${e}</li>`).join("")}</ul>
      ` : ""}
      ${alert.expiringSoon.length > 0 ? `
        <h3 style="color:#f59e0b;">Expiring Soon</h3>
        <ul>${alert.expiringSoon.map(e => `<li>${e}</li>`).join("")}</ul>
      ` : ""}
      <p>Please review these documents in your KYC dashboard on Cellion One.</p>
    </div>`;

    for (const email of alert.reviewerEmails) {
      await sendKycEmail(email, `[${alert.orgName}] Document Expiry Alert`, html);
      alertsSent++;
    }
  }

  const expiredRequests = await db.select().from(kycVerificationRequests)
    .where(and(
      lt(kycVerificationRequests.expiresAt, now),
      sql`${kycVerificationRequests.status} NOT IN ('verified', 'rejected', 'expired')`,
    ));

  for (const req of expiredRequests) {
    await db.update(kycVerificationRequests)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(kycVerificationRequests.id, req.id));
    statusesUpdated++;
  }

  // Also expire pending/in_progress hosted sessions that have passed their expiry and fire webhooks
  try {
    const now = new Date();
    const staleSessions = await db.select().from(kycSessions)
      .where(and(
        sql`${kycSessions.status} IN ('pending', 'in_progress')`,
        lt(kycSessions.expiresAt, now)
      ));

    for (const session of staleSessions) {
      await db.update(kycSessions)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(kycSessions.id, session.id));

      webhookService.deliverWebhook(session.orgId, "session.expired", {
        sessionId: session.id,
        sessionToken: session.sessionToken,
        type: session.type,
        subjectEmail: session.subjectEmail,
        subjectName: session.subjectName,
        expiredAt: now.toISOString(),
        metadata: session.metadata,
      }).catch(err => console.error(`[KYCScheduler] session.expired webhook error (session ${session.id}):`, err));
    }

    if (staleSessions.length > 0) {
      console.log(`[KYCScheduler] Expired ${staleSessions.length} hosted session(s)`);
    }
  } catch (err) {
    console.error("[KYCScheduler] Session expiry error:", err);
  }

  console.log(`[KYCScheduler] Updated ${statusesUpdated} statuses, sent ${alertsSent} alerts`);

  try {
    await webhookService.retryFailedWebhooks();
  } catch (err) {
    console.error("[KYCScheduler] Webhook retry error:", err);
  }

  const today = new Date();
  if (today.getDate() === 1) {
    try {
      const invoicedAccounts = await db.select().from(kycBillingAccounts)
        .where(and(
          eq(kycBillingAccounts.billingMode, "invoiced"),
          eq(kycBillingAccounts.isActive, true)
        ));

      const periodEnd = new Date(today.getFullYear(), today.getMonth(), 1);
      const periodStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);

      for (const account of invoicedAccounts) {
        try {
          await billingService.generateInvoice(account.organisationId, periodStart, periodEnd);
          console.log(`[KYCScheduler] Generated invoice for org ${account.organisationId}`);
        } catch (err) {
          console.error(`[KYCScheduler] Invoice generation error for org ${account.organisationId}:`, err);
        }
      }
    } catch (err) {
      console.error("[KYCScheduler] Monthly invoice generation error:", err);
    }
  }
}

export async function runSanctionsMonitoring() {
  console.log("[KYCScheduler] Checking sanctions monitoring feature flag...");

  const [flag] = await db.select().from(featureFlags)
    .where(eq(featureFlags.key, "enable_sanctions_monitoring"));

  if (!flag?.isEnabled) {
    console.log("[KYCScheduler] Sanctions monitoring disabled — skipping");
    return;
  }

  console.log("[KYCScheduler] Running weekly sanctions/AML re-screening...");

  const verifiedRequests = await db.select({
    request: kycVerificationRequests,
    org: kycOrganisations,
  })
    .from(kycVerificationRequests)
    .innerJoin(kycOrganisations, eq(kycVerificationRequests.orgId, kycOrganisations.id))
    .where(and(
      eq(kycVerificationRequests.status, "verified"),
      eq(kycVerificationRequests.type, "individual")
    ));

  let screened = 0;
  let alerts = 0;

  for (const row of verifiedRequests) {
    try {
      // Simulated AML screening result (production: call smileId AML API)
      const screeningResult: "clear" | "alert" = "clear";
      const previousRiskScore = row.request.riskScore;
      const newRiskScore = screeningResult === "alert" ? "red" : (previousRiskScore ?? "green");

      await db.insert(kycSanctionsLogs).values({
        verificationRequestId: row.request.id,
        orgId: row.request.orgId,
        subjectName: row.request.subjectName,
        previousRiskScore: previousRiskScore || null,
        newRiskScore,
        screeningResult,
        matchDetails: null,
        alertSentAt: screeningResult === "alert" ? new Date() : null,
      });

      if (screeningResult === "alert") {
        await db.update(kycVerificationRequests)
          .set({ riskScore: "red", updatedAt: new Date() })
          .where(eq(kycVerificationRequests.id, row.request.id));

        webhookService.deliverWebhook(row.request.orgId, "sanctions.alert", {
          requestId: row.request.id,
          subjectName: row.request.subjectName,
          subjectEmail: row.request.subjectEmail,
          previousRiskScore,
          newRiskScore: "red",
          screenedAt: new Date().toISOString(),
        }).catch(err => console.error("[KYCScheduler] Sanctions webhook error:", err));

        // Email org admins
        const reviewers = await db.select().from(kycOrgMembers)
          .where(and(
            eq(kycOrgMembers.orgId, row.request.orgId),
            eq(kycOrgMembers.inviteStatus, "accepted"),
            eq(kycOrgMembers.role, "org_admin")
          ));

        const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#dc2626;">${row.org.name} — Sanctions Alert</h2>
          <p><strong>${row.request.subjectName}</strong> has been flagged during routine AML/sanctions re-screening.</p>
          <p>Previous risk score: <strong>${previousRiskScore || "N/A"}</strong> → New: <strong>RED</strong></p>
          <p>Please review this individual immediately in your KYC dashboard.</p>
        </div>`;

        for (const reviewer of reviewers) {
          await sendKycEmail(reviewer.inviteEmail, `[URGENT] Sanctions Alert — ${row.request.subjectName}`, html);
        }

        alerts++;
      }

      screened++;
    } catch (err) {
      console.error(`[KYCScheduler] Sanctions screening error for request ${row.request.id}:`, err);
    }
  }

  console.log(`[KYCScheduler] Sanctions monitoring complete: ${screened} screened, ${alerts} alerts raised`);
}

/**
 * Check platform user identity_verifications for upcoming/past expiry.
 * Sends in-app notification + email at 30-day, 7-day and 0-day (expired) thresholds.
 * Skips users who already received a notification at the same threshold recently.
 */
export async function runIndividualExpiryCheck() {
  console.log("[KYCScheduler] Running individual identity expiry check...");

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Fetch verified identity verifications that expire within 30 days or are already expired
  const expiringVerifications = await db.select({
    iv: identityVerifications,
    user: users,
  })
    .from(identityVerifications)
    .innerJoin(users, eq(identityVerifications.founderUserId, users.id))
    .where(and(
      eq(identityVerifications.status, "verified"),
      lt(identityVerifications.expiresAt, in30Days),
      sql`${identityVerifications.expiresAt} IS NOT NULL`,
    ));

  let notified = 0;

  for (const row of expiringVerifications) {
    try {
      const expiresAt = new Date(row.iv.expiresAt!);
      const msLeft = expiresAt.getTime() - now.getTime();
      const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
      const isExpired = daysLeft <= 0;

      let title: string;
      let message: string;
      let urgency: "warning" | "error";

      if (isExpired) {
        title = "Identity Verification Expired";
        message = "Your identity verification has expired. Please re-verify your identity to continue using Cellion One services.";
        urgency = "error";
      } else if (daysLeft <= 7) {
        title = "Identity Verification Expiring Soon";
        message = `Your identity verification expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Please renew it before it expires.`;
        urgency = "warning";
      } else {
        title = "Identity Verification Expiring in 30 Days";
        message = "Your identity verification will expire in 30 days. Please plan to renew it soon.";
        urgency = "warning";
      }

      // Check if we already sent this type of notification within the past 24 hours to avoid duplicates
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const existing = await db.select({ id: notifications.id })
        .from(notifications)
        .where(and(
          eq(notifications.userId, row.iv.founderUserId),
          sql`${notifications.title} = ${title}`,
          sql`${notifications.createdAt} > ${oneDayAgo}`,
        ))
        .limit(1);

      if (existing.length > 0) continue;

      // Create in-app notification
      await db.insert(notifications).values({
        userId: row.iv.founderUserId,
        title,
        message,
        type: urgency,
        isRead: false,
        linkUrl: "/profile",
      });

      // Send email if user has an email address
      if (row.user.email) {
        const emailHtml = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:${urgency === "error" ? "#dc2626" : "#d97706"};">${title}</h2>
          <p>${message}</p>
          <p>Please visit your <a href="https://cellionone.com/profile">profile page</a> to renew your identity verification.</p>
          <p style="color:#6b7280;font-size:0.85em;">If you have already renewed, please ignore this message.</p>
        </div>`;

        await sendKycEmail(row.user.email, title, emailHtml);
      }

      notified++;
    } catch (err) {
      console.error(`[KYCScheduler] Individual expiry check error for verification ${row.iv.id}:`, err);
    }
  }

  // Mark expired verifications as expired status
  await db.update(identityVerifications)
    .set({ status: "expired", updatedAt: new Date() })
    .where(and(
      eq(identityVerifications.status, "verified"),
      lt(identityVerifications.expiresAt, now),
      sql`${identityVerifications.expiresAt} IS NOT NULL`,
    ));

  console.log(`[KYCScheduler] Individual expiry check complete: ${notified} user(s) notified`);
}
