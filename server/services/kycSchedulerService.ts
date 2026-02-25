import { db } from "../db";
import { eq, and, lt, lte, gte, or, isNull, sql } from "drizzle-orm";
import {
  kycVerificationRequests,
  kycSubmittedDocuments,
  kycOrganisations,
  kycOrgMembers,
} from "@shared/schema";
import { getResendClient } from "./emailService";

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
    } else {
      alert.expiringSoon.push(`${label} — ${daysLeft} days remaining`);

      if (row.request.riskScore !== "red") {
        await db.update(kycVerificationRequests)
          .set({ riskScore: "amber", updatedAt: new Date() })
          .where(eq(kycVerificationRequests.id, row.request.id));
        statusesUpdated++;
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

  console.log(`[KYCScheduler] Updated ${statusesUpdated} statuses, sent ${alertsSent} alerts`);
}
