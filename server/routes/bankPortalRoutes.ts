import type { Express, Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { getResendClient, ADMIN_NOTIFICATION_EMAIL, getSiteBaseUrl } from "../services/emailService";
import { db } from "../db";
import { eq, desc, and, inArray, isNotNull } from "drizzle-orm";
import { bankPartners, bankCompanyDispatches, bankDocumentRequests, companyProfiles, profileChecklistItems, identityVerifications, documentFiles, founderProfiles, companyPeople, users } from "@shared/schema";
import { ObjectStorageService } from "../replit_integrations/object_storage";

const SALT_ROUNDS = 10;
const INVITE_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const RESET_TOKEN_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours

function generateToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

// Exported helpers for use by escrowApiRoutes
export { generateToken };
export const INVITE_TOKEN_EXPIRY_MS_EXPORT = 7 * 24 * 60 * 60 * 1000;

export async function createBankPortalUserAndSendInvite(
  email: string,
  bankPartnerId: number,
  bankName: string,
  baseUrl: string
): Promise<void> {
  const token = generateToken();
  const expiry = new Date(Date.now() + INVITE_TOKEN_EXPIRY_MS_EXPORT);
  const existing = await storage.getBankPortalUserByEmail(email.toLowerCase());
  if (existing) {
    await storage.updateBankPortalUser(existing.id, { bankPartnerId, inviteToken: token, inviteTokenExpiry: expiry, isActive: true });
  } else {
    await storage.createBankPortalUser({ email: email.toLowerCase(), bankPartnerId, inviteToken: token, inviteTokenExpiry: expiry, isActive: true });
  }
  await sendBankInviteEmail(email, bankName, token, baseUrl);
}

async function isAdmin(req: Request): Promise<boolean> {
  const userId = (req as any).user?.claims?.sub;
  if (!userId) return false;
  const roles = await storage.getUserRoles(userId);
  return roles.includes("admin");
}

async function getFounderUserId(req: Request): Promise<string | null> {
  const userId = (req as any).user?.claims?.sub;
  if (!userId) return null;
  const roles = await storage.getUserRoles(userId);
  return roles.includes("founder") ? userId : null;
}

async function getBankPortalSession(req: Request): Promise<{ email: string; bankPartnerId: number } | null> {
  const session = (req as any).session;
  if (!session?.bankPortalEmail || !session?.bankPortalPartnerId) return null;
  // Re-validate that the portal user is still active on every request
  const user = await storage.getBankPortalUserByEmail(session.bankPortalEmail);
  if (!user || !user.isActive) {
    // Invalidate the session immediately
    session.bankPortalEmail = null;
    session.bankPortalPartnerId = null;
    return null;
  }
  return { email: session.bankPortalEmail, bankPartnerId: session.bankPortalPartnerId };
}

async function sendBankInviteEmail(email: string, bankName: string, token: string, baseUrl: string) {
  try {
    const { client, fromEmail } = await getResendClient();
    const link = `${baseUrl}/bank/set-password?token=${token}`;
    await client.emails.send({
      from: fromEmail,
      to: email,
      subject: `You're invited to the ${bankName} portal on Cellion One`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">Welcome to the Cellion One Bank Portal</h2>
          <p>You have been registered as a bank staff member for <strong>${bankName}</strong> on Cellion One.</p>
          <p>Click the button below to set your password and access company dossiers:</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${link}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Set Your Password
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">This link expires in 7 days. If you did not expect this invitation, you can ignore this email.</p>
          <p style="color: #666; font-size: 14px;">Or copy this link: ${link}</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[BankPortal] Failed to send invite email:", err);
  }
}

export async function sendBankPasswordResetEmail(email: string, token: string, baseUrl: string) {
  const { client, fromEmail } = await getResendClient();
  const link = `${baseUrl}/bank/reset-password?token=${token}`;
  await client.emails.send({
    from: fromEmail,
    to: email,
    subject: "Reset your Cellion One Bank Portal password",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Password Reset Request</h2>
        <p>We received a request to reset your Cellion One Bank Portal password.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${link}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Reset Password
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">This link expires in 2 hours. If you did not request this, please ignore this email.</p>
      </div>
    `,
  });
}

type DispatchCompanyProfile = {
  companyName?: string | null;
  companyType?: string | null;
  rcNumber?: string | null;
  tinNumber?: string | null;
  shareCapital?: string | null;
  incorporationDate?: Date | string | null;
  businessActivities?: string[] | null;
  registeredAddress?: { line1?: string; city?: string; state?: string } | null;
  operatingAddress?: { line1?: string; city?: string; state?: string } | null;
  directors?: { name: string; role?: string; ninVerified?: boolean; bvnVerified?: boolean; biometricStatus?: string; amlIsHit?: boolean }[] | null;
  shareholders?: { name: string; shares?: number; percentage?: number }[] | null;
  smileKybResult?: Record<string, unknown> | null;
  existingCompanyStatus?: string | null;
  checklistItems?: { label: string; required: boolean; status?: string | null }[];
  founderIdentityVerifiedAt?: Date | string | null;
  founderIdentitySource?: string | null;
  founderSelfieUrl?: string | null;
};

async function sendDispatchEmail(
  emails: { label: string; address: string }[],
  bankName: string,
  company: DispatchCompanyProfile,
  baseUrl: string
) {
  try {
    const { client, fromEmail } = await getResendClient();
    const addresses = emails.map(e => e.address).filter(Boolean);
    if (addresses.length === 0) return;

    const directors = Array.isArray(company.directors) ? company.directors : [];
    const registeredAddr = company.registeredAddress
      ? [company.registeredAddress.line1, company.registeredAddress.city, company.registeredAddress.state]
          .filter(Boolean).join(", ")
      : "—";
    const operatingAddr = company.operatingAddress
      ? [company.operatingAddress.line1, company.operatingAddress.city, company.operatingAddress.state]
          .filter(Boolean).join(", ")
      : "—";

    const directorsHtml = directors.map((d) => `
      <tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${d.name || "—"}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${d.role || "Director"}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">
          ${d.ninVerified === true ? "NIN Verified" : d.bvnVerified === true ? "BVN Verified" : "Pending"}
        </td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">
          ${d.biometricStatus === "completed" ? "✓ Match" : d.biometricStatus === "failed" ? "✗ Failed" : "Pending"}
        </td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">
          ${d.amlIsHit === false ? "✓ Clear" : d.amlIsHit === true ? "✗ HIT" : "Pending"}
        </td>
      </tr>
    `).join("");

    const kybHtml = company.smileKybResult
      ? Object.entries(company.smileKybResult as Record<string, unknown>)
          .map(([k, v]) => `<tr><td style="padding:4px 8px;color:#666;">${k.replace(/_/g, " ")}</td><td style="padding:4px 8px;">${String(v)}</td></tr>`)
          .join("")
      : "<tr><td colspan='2' style='padding:4px 8px;color:#999;'>Not available</td></tr>";

    const checklistItems = Array.isArray(company.checklistItems) ? company.checklistItems : [];
    const docsHtml = checklistItems.map(item => `
      <tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${item.label}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${item.required ? "Required" : "Optional"}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${item.status || "Missing"}</td>
      </tr>
    `).join("");
    const shareholders = Array.isArray(company.shareholders) ? company.shareholders : [];
    const shareholdersHtml = shareholders.map(s => `
      <tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${s.name || "—"}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${s.shares != null ? s.shares.toLocaleString() : "—"}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${s.percentage != null ? s.percentage.toFixed(2) + "%" : "—"}</td>
      </tr>
    `).join("");

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
        <div style="background: #1e3a5f; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 22px;">Company Dossier</h1>
          <p style="margin: 4px 0 0; opacity: 0.85;">Prepared for ${bankName} by Cellion One</p>
        </div>

        <div style="background: #f8fafc; padding: 16px 20px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="margin: 0; color: #555; font-size: 13px;">
            Sent: ${new Date().toLocaleDateString("en-GB", { dateStyle: "full" })} &bull;
            Overall Status: <strong style="color: ${company.existingCompanyStatus === "verified" ? "#16a34a" : "#d97706"};">
              ${company.existingCompanyStatus === "verified" ? "VERIFIED" : (company.existingCompanyStatus || "").toUpperCase().replace(/_/g, " ")}
            </strong>
          </p>
        </div>

        <!-- Company Profile -->
        <div style="border: 1px solid #e2e8f0; border-top: none; padding: 20px;">
          <h2 style="color: #1e3a5f; font-size: 17px; margin-top: 0;">Company Profile</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="width:40%;padding:4px 0;color:#666;">Company Name</td><td style="padding:4px 0;font-weight:bold;">${company.companyName || "—"}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">Company Type</td><td style="padding:4px 0;">${company.companyType || "—"}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">RC Number</td><td style="padding:4px 0;">${company.rcNumber || "—"}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">TIN</td><td style="padding:4px 0;">${company.tinNumber || "—"}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">Incorporation Date</td><td style="padding:4px 0;">${company.incorporationDate ? new Date(company.incorporationDate).toLocaleDateString("en-GB") : "—"}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">Share Capital</td><td style="padding:4px 0;">${company.shareCapital || "—"}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">Business Activities</td><td style="padding:4px 0;">${Array.isArray(company.businessActivities) ? company.businessActivities.join(", ") : (company.businessActivities || "—")}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">Registered Address</td><td style="padding:4px 0;">${registeredAddr}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">Operating Address</td><td style="padding:4px 0;">${operatingAddr}</td></tr>
          </table>
        </div>

        <!-- KYB Result -->
        <div style="border: 1px solid #e2e8f0; border-top: none; padding: 20px;">
          <h2 style="color: #1e3a5f; font-size: 17px; margin-top: 0;">KYB Verification Result (Smile ID)</h2>
          <table style="width: 100%; border-collapse: collapse;">
            ${kybHtml}
          </table>
        </div>

        <!-- Shareholders -->
        <div style="border: 1px solid #e2e8f0; border-top: none; padding: 20px;">
          <h2 style="color: #1e3a5f; font-size: 17px; margin-top: 0;">Shareholders</h2>
          ${shareholders.length > 0 ? `
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="padding:6px 8px;text-align:left;font-size:12px;color:#555;">Name</th>
                <th style="padding:6px 8px;text-align:left;font-size:12px;color:#555;">Shares</th>
                <th style="padding:6px 8px;text-align:left;font-size:12px;color:#555;">Ownership %</th>
              </tr>
            </thead>
            <tbody>${shareholdersHtml}</tbody>
          </table>` : "<p style='color:#999;'>No shareholder information available.</p>"}
        </div>

        <!-- Directors KYC -->
        <div style="border: 1px solid #e2e8f0; border-top: none; padding: 20px;">
          <h2 style="color: #1e3a5f; font-size: 17px; margin-top: 0;">Director / Officer KYC Summary</h2>
          ${directors.length > 0 ? `
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="padding:6px 8px;text-align:left;font-size:12px;color:#555;">Name</th>
                <th style="padding:6px 8px;text-align:left;font-size:12px;color:#555;">Role</th>
                <th style="padding:6px 8px;text-align:left;font-size:12px;color:#555;">Identity</th>
                <th style="padding:6px 8px;text-align:left;font-size:12px;color:#555;">Biometric</th>
                <th style="padding:6px 8px;text-align:left;font-size:12px;color:#555;">AML</th>
              </tr>
            </thead>
            <tbody>${directorsHtml}</tbody>
          </table>` : "<p style='color:#999;'>No director information available.</p>"}
        </div>

        <!-- Document Audit -->
        <div style="border: 1px solid #e2e8f0; border-top: none; padding: 20px;">
          <h2 style="color: #1e3a5f; font-size: 17px; margin-top: 0;">Document Audit</h2>
          ${checklistItems.length > 0 ? `
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="padding:6px 8px;text-align:left;font-size:12px;color:#555;">Document</th>
                <th style="padding:6px 8px;text-align:left;font-size:12px;color:#555;">Requirement</th>
                <th style="padding:6px 8px;text-align:left;font-size:12px;color:#555;">Status</th>
              </tr>
            </thead>
            <tbody>${docsHtml}</tbody>
          </table>` : "<p style='color:#999;'>No document records available.</p>"}
        </div>

        <!-- Founder Identity Verification -->
        ${(company.founderIdentityVerifiedAt || company.founderIdentitySource) ? `
        <div style="border: 1px solid #e2e8f0; border-top: none; padding: 20px;">
          <h2 style="color: #1e3a5f; font-size: 17px; margin-top: 0;">Founder Identity Verification</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="width:40%;padding:4px 0;color:#666;">Verification Status</td><td style="padding:4px 0;"><strong style="color:#16a34a;">Verified ✓</strong></td></tr>
            <tr><td style="padding:4px 0;color:#666;">Verified At</td><td style="padding:4px 0;">${company.founderIdentityVerifiedAt ? new Date(company.founderIdentityVerifiedAt).toLocaleDateString("en-GB", { dateStyle: "full" }) : "—"}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">Verification Source</td><td style="padding:4px 0;">${company.founderIdentitySource === "kyb_pipeline" ? "KYB Pipeline (BVN/NIN + Biometric)" : (company.founderIdentitySource || "—")}</td></tr>
            ${company.founderSelfieUrl ? `<tr><td style="padding:4px 0;color:#666;">Biometric Selfie</td><td style="padding:4px 0;"><a href="${company.founderSelfieUrl}" style="color:#1e3a5f;">View Photo ↗</a></td></tr>` : ""}
          </table>
        </div>` : ""}

        <!-- Certificate Reference -->
        ${company.cellionCertRef ? `
        <div style="border: 1px solid #e2e8f0; border-top: none; padding: 20px;">
          <h2 style="color: #1e3a5f; font-size: 17px; margin-top: 0;">Attestation</h2>
          <p><strong>Certificate Reference:</strong> ${company.cellionCertRef}</p>
        </div>` : ""}

        <!-- Portal CTA -->
        <div style="border: 1px solid #e2e8f0; border-top: none; background: #f0f7ff; padding: 24px 20px; text-align: center;">
          <p style="margin: 0 0 6px; font-size: 15px; font-weight: 600; color: #1e3a5f;">View Full Profile in the Bank Portal</p>
          <p style="margin: 0 0 16px; font-size: 13px; color: #555;">
            Log in with your registered email address to access the company's verified documents, compliance readiness scores, and to submit document requests directly to Cellion One.
          </p>
          <a href="${baseUrl}/bank/login"
             style="display: inline-block; background: #1e3a5f; color: white; text-decoration: none; padding: 10px 28px; border-radius: 6px; font-size: 14px; font-weight: 600; letter-spacing: 0.02em;">
            Open Bank Portal →
          </a>
          <p style="margin: 12px 0 0; font-size: 11px; color: #888;">
            Portal URL: ${baseUrl}/bank/login &nbsp;&bull;&nbsp; Log in with: your registered email
          </p>
        </div>

        <div style="padding: 16px 0; color: #888; font-size: 12px; text-align: center;">
          This dossier was generated by Cellion One. The information is provided for bank due diligence purposes only.
        </div>
      </body>
      </html>
    `;

    // Send one email to all bank addresses, with super admin CC'd for confirmation.
    // Using a single send avoids the super admin receiving duplicate copies when
    // a bank has multiple registered addresses.
    await client.emails.send({
      from: fromEmail,
      to: addresses,
      cc: [ADMIN_NOTIFICATION_EMAIL],
      subject: `Company Dossier: ${company.companyName || "Unknown Company"} — ${bankName}`,
      html,
    });
    console.log(`[BankPortal] Dossier dispatched to ${addresses.length} bank address(es), CC: ${ADMIN_NOTIFICATION_EMAIL}`);
  } catch (err) {
    console.error("[BankPortal] Failed to send dispatch email:", err);
    throw err;
  }
}

async function sendDocRequestFounderEmail(
  request: any,
  companyName: string,
  bankName: string,
  founderEmail: string,
  baseUrl: string
) {
  try {
    const { client, fromEmail } = await getResendClient();
    await client.emails.send({
      from: fromEmail,
      to: founderEmail,
      subject: `Action Required: ${bankName} has requested documents for ${companyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">Bank Document Request</h2>
          <p>Hello,</p>
          <p><strong>${bankName}</strong> has reviewed your company dossier for <strong>${companyName}</strong> and has requested the following additional documents:</p>
          <blockquote style="border-left: 3px solid #16a34a; padding-left: 12px; color: #444; margin: 16px 0;">${request.documentsRequested}</blockquote>
          ${request.reason ? `<p><strong>Reason given:</strong> ${request.reason}</p>` : ""}
          <p>To fulfil this request, please visit your <strong>Document Vault</strong> and toggle "Share with bank" on the relevant documents. The bank will be automatically notified when you share a document.</p>
          <p style="margin: 24px 0;">
            <a href="${baseUrl}/founder/vault" style="background-color: #16a34a; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Go to Document Vault</a>
          </p>
          <p style="color: #666; font-size: 13px;">If you have any questions, please contact support at service@cellionone.com.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[BankPortal] Failed to send doc request founder email:", err);
  }
}

async function sendDocsFulfilledBankEmail(bankEmails: string[], bankName: string, companyName: string, bankPortalUrl: string) {
  try {
    const { client, fromEmail } = await getResendClient();
    for (const email of bankEmails) {
      await client.emails.send({
        from: fromEmail,
        to: email,
        subject: `Documents Now Available: ${companyName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a1a;">Documents Available</h2>
            <p>Hello ${bankName} team,</p>
            <p>New documents have been shared by the founder of <strong>${companyName}</strong> in your Cellion One bank portal. You can now download them from the company dossier page.</p>
            <p style="margin: 24px 0;">
              <a href="${bankPortalUrl}" style="background-color: #16a34a; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">View in Bank Portal</a>
            </p>
            <p style="color: #666; font-size: 13px;">This is an automated notification from Cellion One.</p>
          </div>
        `,
      });
    }
  } catch (err) {
    console.error("[BankPortal] Failed to send docs fulfilled email to bank:", err);
  }
}

async function sendDocRequestAdminEmail(request: any, companyName: string, bankName: string) {
  try {
    const { client, fromEmail } = await getResendClient();
    await client.emails.send({
      from: fromEmail,
      to: ADMIN_NOTIFICATION_EMAIL,
      subject: `Bank Document Request: ${bankName} — ${companyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">New Bank Document Request</h2>
          <p><strong>Bank:</strong> ${bankName}</p>
          <p><strong>Company:</strong> ${companyName}</p>
          <p><strong>Requested by:</strong> ${request.requestedByEmail}</p>
          <p><strong>Documents requested:</strong></p>
          <blockquote style="border-left: 3px solid #2563eb; padding-left: 12px; color: #444;">${request.documentsRequested}</blockquote>
          ${request.reason ? `<p><strong>Reason:</strong> ${request.reason}</p>` : ""}
          <p style="color: #666; font-size: 14px;">Please review this request in the admin panel under Banking Partners → Document Requests.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[BankPortal] Failed to send doc request admin email:", err);
  }
}

export function registerBankPortalRoutes(app: Express): void {
  // ─── Bank Portal Auth Routes ──────────────────────────────────────────────────

  // POST /api/bank-portal/login
  app.post("/api/bank-portal/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }).parse(req.body);

      const user = await storage.getBankPortalUserByEmail(email.toLowerCase());
      if (!user || !user.isActive) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      if (!user.passwordHash) {
        return res.status(401).json({ error: "Password not yet set. Please check your invite email." });
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      await storage.updateBankPortalUser(user.id, { lastLoginAt: new Date() });

      (req as any).session.bankPortalEmail = user.email;
      (req as any).session.bankPortalPartnerId = user.bankPartnerId;

      const partner = await storage.getBankPartner(user.bankPartnerId);
      res.json({ email: user.email, bankPartnerId: user.bankPartnerId, bankName: partner?.name });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/bank-portal/logout
  app.post("/api/bank-portal/logout", async (req: Request, res: Response) => {
    const session = (req as any).session;
    if (session) {
      session.bankPortalEmail = null;
      session.bankPortalPartnerId = null;
    }
    res.json({ ok: true });
  });

  // GET /api/bank-portal/me
  app.get("/api/bank-portal/me", async (req: Request, res: Response) => {
    const session = await getBankPortalSession(req);
    if (!session) return res.status(401).json({ error: "Not authenticated" });
    const partner = await storage.getBankPartner(session.bankPartnerId);
    res.json({ email: session.email, bankPartnerId: session.bankPartnerId, bankName: partner?.name });
  });

  // POST /api/bank-portal/set-password
  app.post("/api/bank-portal/set-password", async (req: Request, res: Response) => {
    try {
      const { token, password } = z.object({
        token: z.string().min(1),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }).parse(req.body);

      const user = await storage.getBankPortalUserByInviteToken(token);
      if (!user) return res.status(400).json({ error: "Invalid or expired invite token" });
      if (user.inviteTokenExpiry && new Date(user.inviteTokenExpiry) < new Date()) {
        return res.status(400).json({ error: "Invite link has expired. Please request a new one." });
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      await storage.updateBankPortalUser(user.id, {
        passwordHash,
        inviteToken: null,
        inviteTokenExpiry: null,
      });

      res.json({ ok: true, message: "Password set successfully. You can now log in." });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/bank-portal/forgot-password
  app.post("/api/bank-portal/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      const user = await storage.getBankPortalUserByEmail(email.toLowerCase());

      if (user && user.isActive) {
        const token = generateToken();
        const expiry = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
        await storage.updateBankPortalUser(user.id, { resetToken: token, resetTokenExpiry: expiry });
        const baseUrl = getSiteBaseUrl(req);
        try {
          await sendBankPasswordResetEmail(email, token, baseUrl);
        } catch (emailErr: any) {
          console.error("[BankPortal] Failed to send password reset email:", emailErr);
          return res.status(500).json({ error: "Failed to send reset email. Please try again shortly." });
        }
      }

      res.json({ ok: true, message: "If that email is registered, a reset link has been sent." });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/bank-portal/reset-password
  app.post("/api/bank-portal/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, password } = z.object({
        token: z.string().min(1),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }).parse(req.body);

      const user = await storage.getBankPortalUserByResetToken(token);
      if (!user) return res.status(400).json({ error: "Invalid or expired reset token" });
      if (user.resetTokenExpiry && new Date(user.resetTokenExpiry) < new Date()) {
        return res.status(400).json({ error: "Reset link has expired. Please request a new one." });
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      await storage.updateBankPortalUser(user.id, {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      });

      res.json({ ok: true, message: "Password reset successfully. You can now log in." });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/bank-portal/change-password
  app.post("/api/bank-portal/change-password", async (req: Request, res: Response) => {
    try {
      const session = await getBankPortalSession(req);
      if (!session) return res.status(401).json({ error: "Not authenticated" });

      const { currentPassword, newPassword } = z.object({
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: z.string().min(8, "New password must be at least 8 characters"),
      }).parse(req.body);

      const user = await storage.getBankPortalUserByEmail(session.email);
      if (!user || !user.isActive) return res.status(401).json({ error: "Account not found" });
      if (!user.passwordHash) return res.status(400).json({ error: "No password set. Please use the forgot password flow." });

      const matches = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!matches) return res.status(400).json({ error: "Current password is incorrect" });

      const sameAsOld = await bcrypt.compare(newPassword, user.passwordHash);
      if (sameAsOld) return res.status(400).json({ error: "New password must be different from your current password" });

      const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      await storage.updateBankPortalUser(user.id, { passwordHash });

      res.json({ ok: true, message: "Password changed successfully." });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Bank Portal Company Routes ───────────────────────────────────────────────

  // GET /api/bank-portal/companies
  app.get("/api/bank-portal/companies", async (req: Request, res: Response) => {
    try {
      const session = await getBankPortalSession(req);
      if (!session) return res.status(401).json({ error: "Not authenticated" });

      const dispatches = await storage.listBankCompanyDispatches({ bankPartnerId: session.bankPartnerId });

      if (dispatches.length === 0) return res.json([]);

      const search = req.query.search as string | undefined;
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;

      // Apply date filter on dispatches first
      let filteredDispatches = dispatches;
      if (dateFrom) {
        const from = new Date(dateFrom);
        filteredDispatches = filteredDispatches.filter(d => d.sentAt && new Date(d.sentAt) >= from);
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        filteredDispatches = filteredDispatches.filter(d => d.sentAt && new Date(d.sentAt) <= to);
      }

      const filteredCompanyIds = [...new Set(filteredDispatches.map(d => d.companyProfileId))];
      if (filteredCompanyIds.length === 0) return res.json([]);

      const profiles = await Promise.all(filteredCompanyIds.map(async (id) => {
        const [profile] = await db.select().from(companyProfiles).where(eq(companyProfiles.id, id));
        return profile;
      }));

      let result = profiles.filter(Boolean);
      if (search) {
        const s = search.toLowerCase();
        result = result.filter(p => p.companyName?.toLowerCase().includes(s));
      }

      // Enrich with dispatch date
      const enriched = result.map(p => {
        const dispatch = filteredDispatches.find(d => d.companyProfileId === p.id);
        return { ...p, dispatchedAt: dispatch?.sentAt };
      });

      res.json(enriched);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/bank-portal/companies/:id
  app.get("/api/bank-portal/companies/:id", async (req: Request, res: Response) => {
    try {
      const session = await getBankPortalSession(req);
      if (!session) return res.status(401).json({ error: "Not authenticated" });

      const companyProfileId = parseInt(req.params.id);

      // Verify this company was dispatched to this bank
      const dispatches = await storage.listBankCompanyDispatches({
        companyProfileId,
        bankPartnerId: session.bankPartnerId,
      });
      if (dispatches.length === 0) {
        return res.status(404).json({ error: "Company not found or not dispatched to your bank" });
      }

      const [profile] = await db.select().from(companyProfiles)
        .where(eq(companyProfiles.id, companyProfileId));

      if (!profile) return res.status(404).json({ error: "Company profile not found" });

      // Enrich with checklist items
      const checklistRows = await db.select().from(profileChecklistItems)
        .where(eq(profileChecklistItems.companyProfileId, companyProfileId));

      // Fetch documents the founder has flagged as shareable with banks (document_files table)
      const vaultDocs = profile.founderId
        ? await db.select({
            id: documentFiles.id,
            filename: documentFiles.filename,
            docType: documentFiles.docType,
            category: documentFiles.category,
            mimeType: documentFiles.mimeType,
            sizeBytes: documentFiles.sizeBytes,
            shareWithBank: documentFiles.shareWithBank,
          }).from(documentFiles)
          .where(eq(documentFiles.ownerUserId, profile.founderId))
          .then(rows => rows.filter(r => r.shareWithBank === true))
        : [];

      // Also include profileChecklistItems the founder has flagged as shareable with banks
      const sharedChecklistItems = await db.select({
        id: profileChecklistItems.id,
        label: profileChecklistItems.label,
        key: profileChecklistItems.key,
        filePath: profileChecklistItems.filePath,
        shareWithBank: profileChecklistItems.shareWithBank,
      }).from(profileChecklistItems)
        .where(and(
          eq(profileChecklistItems.companyProfileId, companyProfileId),
          eq(profileChecklistItems.shareWithBank, true),
          isNotNull(profileChecklistItems.filePath),
        ));

      const bankDocuments = [
        ...vaultDocs.map(d => ({ ...d, source: "vault" as const })),
        ...sharedChecklistItems.map(ci => ({
          id: ci.id,
          filename: ci.label,
          docType: ci.key,
          category: "checklist",
          mimeType: undefined as string | undefined,
          sizeBytes: undefined as number | undefined,
          shareWithBank: true,
          source: "checklist" as const,
        })),
      ];

      // Enrich with platform-registered people linked to this company
      const peopleRows = await db.select({
        id: companyPeople.id,
        inviteEmail: companyPeople.inviteEmail,
        role: companyPeople.role,
        sharesAllocated: companyPeople.sharesAllocated,
        shareClass: companyPeople.shareClass,
        sharePercentage: companyPeople.sharePercentage,
        personUserId: companyPeople.personUserId,
        // Founder profile fields (non-sensitive)
        fpFullName: founderProfiles.fullName,
        fpPhone: founderProfiles.phone,
        fpDateOfBirth: founderProfiles.dateOfBirth,
        fpNationality: founderProfiles.nationality,
        fpOccupation: founderProfiles.occupation,
        fpAddressLine1: founderProfiles.addressLine1,
        fpCity: founderProfiles.city,
        fpState: founderProfiles.state,
        fpIdType: founderProfiles.idType,
        fpHasSignature: founderProfiles.signaturePath,
        // User identity verification
        isIdentityVerified: users.isIdentityVerified,
      })
        .from(companyPeople)
        .leftJoin(founderProfiles, eq(founderProfiles.userId, companyPeople.personUserId as any))
        .leftJoin(users, eq(users.id, companyPeople.personUserId as any))
        .where(eq(companyPeople.companyProfileId, companyProfileId));

      const platformPeople = peopleRows.map(p => ({
        id: p.id,
        inviteEmail: p.inviteEmail,
        role: p.role,
        sharesAllocated: p.sharesAllocated,
        shareClass: p.shareClass,
        sharePercentage: p.sharePercentage ? parseFloat(p.sharePercentage) : null,
        personUserId: p.personUserId,
        profile: p.fpFullName ? {
          fullName: p.fpFullName,
          phone: p.fpPhone,
          dateOfBirth: p.fpDateOfBirth,
          nationality: p.fpNationality,
          occupation: p.fpOccupation,
          addressLine1: p.fpAddressLine1,
          city: p.fpCity,
          state: p.fpState,
          idType: p.fpIdType,
          hasSignature: !!p.fpHasSignature,
        } : null,
        isIdentityVerified: p.isIdentityVerified,
      }));

      // Fetch founder profile (non-sensitive fields only)
      let founderProfile = null;
      if (profile.founderId) {
        const [fp] = await db.select({
          fullName: founderProfiles.fullName,
          phone: founderProfiles.phone,
          dateOfBirth: founderProfiles.dateOfBirth,
          nationality: founderProfiles.nationality,
          occupation: founderProfiles.occupation,
          addressLine1: founderProfiles.addressLine1,
          city: founderProfiles.city,
          state: founderProfiles.state,
          idType: founderProfiles.idType,
          signaturePath: founderProfiles.signaturePath,
        }).from(founderProfiles).where(eq(founderProfiles.userId, profile.founderId));

        const [founderUser] = await db.select({ isIdentityVerified: users.isIdentityVerified })
          .from(users).where(eq(users.id, profile.founderId));

        if (fp) {
          founderProfile = {
            fullName: fp.fullName,
            phone: fp.phone,
            dateOfBirth: fp.dateOfBirth,
            nationality: fp.nationality,
            occupation: fp.occupation,
            addressLine1: fp.addressLine1,
            city: fp.city,
            state: fp.state,
            idType: fp.idType,
            hasSignature: !!fp.signaturePath,
            isIdentityVerified: founderUser?.isIdentityVerified ?? false,
          };
        }
      }

      // Compute kybVerified from verificationReport (existing company pipeline) or smileKybResult fallback.
      // Support both top-level kybPassed (actual pipeline) and kybCheck.passed (legacy/alternate shape).
      const vr = profile.verificationReport as Record<string, unknown> | null | undefined;
      const vrKybCheck = vr?.kybCheck as Record<string, unknown> | undefined;
      const kybVerified: boolean =
        vr?.kybPassed === true ||
        vrKybCheck?.passed === true ||
        (profile.smileKybResult as Record<string, unknown> | null | undefined)?.ResultCode === "1012";

      // Enrich CAC-sourced directors with verification results from verificationReport.
      // Support both directorsReport (actual pipeline key) and directors (alternate key).
      const rawDirectors = Array.isArray(profile.directors) ? (profile.directors as Record<string, unknown>[]) : [];
      const vrDirectors = (
        Array.isArray(vr?.directorsReport) ? vr!.directorsReport :
        Array.isArray(vr?.directors) ? vr!.directors : []
      ) as Record<string, unknown>[];
      const enrichedDirectors = rawDirectors.map(dir => {
        const match = vrDirectors.find(dr => {
          const drName = String(dr.name || "").toLowerCase();
          const dirName = String(dir.name || "").toLowerCase();
          return drName && dirName && drName === dirName;
        });
        if (!match) return dir;
        // Support both ninPassed/bvnPassed (actual) and ninKyc/bvnKyc (alternate) naming
        const ninVerified = match.ninPassed === true || match.ninKyc === true;
        const bvnVerified = match.bvnPassed === true || match.bvnKyc === true;
        const amlIsHit = match.amlClear === true ? false : match.amlClear === false ? true : undefined;
        // biometricStatus: prefer report value, fall back to raw director value
        const biometricStatus = match.biometricStatus !== undefined ? match.biometricStatus : dir.biometricStatus;
        return {
          ...dir,
          ninVerified,
          bvnVerified,
          amlIsHit,
          biometricStatus,
        };
      });

      res.json({
        ...profile,
        directors: enrichedDirectors,
        checklistItems: checklistRows,
        dispatchedAt: dispatches[0]?.sentAt,
        bankDocuments,
        platformPeople,
        founderProfile,
        kybVerified,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/bank-portal/companies/:id/checklist-documents/:itemId/download
  app.get("/api/bank-portal/companies/:id/checklist-documents/:itemId/download", async (req: Request, res: Response) => {
    try {
      const session = await getBankPortalSession(req);
      if (!session) return res.status(401).json({ error: "Not authenticated" });

      const companyProfileId = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);

      const dispatches = await storage.listBankCompanyDispatches({
        companyProfileId,
        bankPartnerId: session.bankPartnerId,
      });
      if (dispatches.length === 0) {
        return res.status(404).json({ error: "Company not dispatched to your bank" });
      }

      const [item] = await db.select().from(profileChecklistItems)
        .where(and(
          eq(profileChecklistItems.id, itemId),
          eq(profileChecklistItems.companyProfileId, companyProfileId),
        ));
      if (!item) return res.status(404).json({ error: "Document not found" });
      if (!item.shareWithBank) return res.status(403).json({ error: "Document is not shared with banks" });
      if (!item.filePath) return res.status(404).json({ error: "Document file not available" });

      const objectStorage = new ObjectStorageService();
      let downloadUrl: string | null = null;
      const path = item.filePath;
      if (path.startsWith("/objects/") || path.startsWith("http")) {
        downloadUrl = path.startsWith("http") ? path : await objectStorage.getObjectEntityDownloadURL(path, 900);
      } else {
        try {
          downloadUrl = await objectStorage.getObjectEntityDownloadURL(path, 900);
        } catch {
          downloadUrl = null;
        }
      }
      if (!downloadUrl) return res.status(404).json({ error: "Document file not available" });

      await storage.createAuditLog({
        actorUserId: `bank:${session.email}`,
        action: "bank_portal_checklist_document_download",
        entityType: "profile_checklist_item",
        entityId: String(itemId),
        details: { bankPartnerId: session.bankPartnerId, companyProfileId, label: item.label },
      });

      res.json({ downloadUrl, filename: item.label });
    } catch (e: any) {
      console.error("[BankPortal] Checklist document download error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/bank-portal/companies/:id/documents/:docId/download
  app.get("/api/bank-portal/companies/:id/documents/:docId/download", async (req: Request, res: Response) => {
    try {
      const session = await getBankPortalSession(req);
      if (!session) return res.status(401).json({ error: "Not authenticated" });

      const companyProfileId = parseInt(req.params.id);
      const docId = parseInt(req.params.docId);

      // Verify this company was dispatched to this bank
      const dispatches = await storage.listBankCompanyDispatches({
        companyProfileId,
        bankPartnerId: session.bankPartnerId,
      });
      if (dispatches.length === 0) {
        return res.status(404).json({ error: "Company not dispatched to your bank" });
      }

      // Get the company profile to find the founderId
      const [profile] = await db.select({ founderId: companyProfiles.founderId })
        .from(companyProfiles)
        .where(eq(companyProfiles.id, companyProfileId));
      if (!profile?.founderId) return res.status(404).json({ error: "Company profile not found" });

      // Get the document and verify it belongs to this company's founder and is bank-shared
      const [doc] = await db.select().from(documentFiles)
        .where(eq(documentFiles.id, docId));
      if (!doc) return res.status(404).json({ error: "Document not found" });
      if (doc.ownerUserId !== profile.founderId) return res.status(403).json({ error: "Access denied" });
      if (!doc.shareWithBank) return res.status(403).json({ error: "Document is not shared with banks" });

      // Generate a 15-minute pre-signed URL
      let downloadUrl: string | null = null;
      if (doc.storagePath?.startsWith("/objects/")) {
        const objectStorage = new ObjectStorageService();
        downloadUrl = await objectStorage.getObjectEntityDownloadURL(doc.storagePath, 900);
      } else if (doc.storagePath?.startsWith("http")) {
        downloadUrl = doc.storagePath;
      }

      if (!downloadUrl) return res.status(404).json({ error: "Document file not available" });

      // Audit log the access
      await storage.createAuditLog({
        actorUserId: `bank:${session.email}`,
        action: "bank_portal_document_download",
        entityType: "document_file",
        entityId: String(docId),
        details: { bankPartnerId: session.bankPartnerId, companyProfileId, filename: doc.filename },
      });

      res.json({ downloadUrl, filename: doc.filename, mimeType: doc.mimeType });
    } catch (e: any) {
      console.error("[BankPortal] Document download error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/bank-portal/companies/:id/founder/signature — 15-min pre-signed URL for founder signature
  app.get("/api/bank-portal/companies/:id/founder/signature", async (req: Request, res: Response) => {
    try {
      const session = await getBankPortalSession(req);
      if (!session) return res.status(401).json({ error: "Not authenticated" });

      const companyProfileId = parseInt(req.params.id);
      const dispatches = await storage.listBankCompanyDispatches({ companyProfileId, bankPartnerId: session.bankPartnerId });
      if (dispatches.length === 0) return res.status(404).json({ error: "Company not dispatched to your bank" });

      const [profile] = await db.select({ founderId: companyProfiles.founderId }).from(companyProfiles).where(eq(companyProfiles.id, companyProfileId));
      if (!profile?.founderId) return res.status(404).json({ error: "Company profile not found" });

      const [fp] = await db.select({ signaturePath: founderProfiles.signaturePath }).from(founderProfiles).where(eq(founderProfiles.userId, profile.founderId));
      if (!fp?.signaturePath) return res.status(404).json({ error: "No signature on file" });

      let signatureUrl: string | null = null;
      const sigPath = fp.signaturePath;
      if (sigPath.startsWith("http")) {
        signatureUrl = sigPath;
      } else {
        try {
          const objectStorage = new ObjectStorageService();
          signatureUrl = await objectStorage.getObjectEntityDownloadURL(sigPath, 900);
        } catch {
          signatureUrl = null;
        }
      }

      if (!signatureUrl) return res.status(404).json({ error: "Signature path format not supported — please re-upload signature." });

      await storage.createAuditLog({
        actorUserId: `bank:${session.email}`,
        action: "bank_portal_signature_view",
        entityType: "founder_profile",
        entityId: profile.founderId,
        details: { bankPartnerId: session.bankPartnerId, companyProfileId },
      });

      res.json({ signatureUrl });
    } catch (e: any) {
      console.error("[BankPortal] Signature fetch error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/bank-portal/companies/:id/people/:personId/signature — 15-min pre-signed URL for a person's signature
  app.get("/api/bank-portal/companies/:id/people/:personId/signature", async (req: Request, res: Response) => {
    try {
      const session = await getBankPortalSession(req);
      if (!session) return res.status(401).json({ error: "Not authenticated" });

      const companyProfileId = parseInt(req.params.id);
      const personId = req.params.personId;

      const dispatches = await storage.listBankCompanyDispatches({ companyProfileId, bankPartnerId: session.bankPartnerId });
      if (dispatches.length === 0) return res.status(404).json({ error: "Company not dispatched to your bank" });

      // Verify the person is linked to this company via companyPeople
      const [person] = await db.select({ personUserId: companyPeople.personUserId })
        .from(companyPeople)
        .where(and(
          eq(companyPeople.companyProfileId, companyProfileId),
          eq(companyPeople.personUserId as any, personId),
        ));
      if (!person) return res.status(404).json({ error: "Person not linked to this company" });

      const [fp] = await db.select({ signaturePath: founderProfiles.signaturePath })
        .from(founderProfiles)
        .where(eq(founderProfiles.userId, personId));
      if (!fp?.signaturePath) return res.status(404).json({ error: "No signature on file" });

      let signatureUrl: string | null = null;
      const sigPath = fp.signaturePath;
      if (sigPath.startsWith("http")) {
        signatureUrl = sigPath;
      } else {
        try {
          const objectStorage = new ObjectStorageService();
          signatureUrl = await objectStorage.getObjectEntityDownloadURL(sigPath, 900);
        } catch {
          signatureUrl = null;
        }
      }

      if (!signatureUrl) return res.status(404).json({ error: "Signature path format not supported — please re-upload signature." });

      await storage.createAuditLog({
        actorUserId: `bank:${session.email}`,
        action: "bank_portal_person_signature_view",
        entityType: "founder_profile",
        entityId: personId,
        details: { bankPartnerId: session.bankPartnerId, companyProfileId },
      });

      res.json({ signatureUrl });
    } catch (e: any) {
      console.error("[BankPortal] Person signature fetch error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/bank-portal/companies/:id/doc-requests
  app.post("/api/bank-portal/companies/:id/doc-requests", async (req: Request, res: Response) => {
    try {
      const session = await getBankPortalSession(req);
      if (!session) return res.status(401).json({ error: "Not authenticated" });

      const companyProfileId = parseInt(req.params.id);

      // Verify dispatch access
      const dispatches = await storage.listBankCompanyDispatches({
        companyProfileId,
        bankPartnerId: session.bankPartnerId,
      });
      if (dispatches.length === 0) {
        return res.status(404).json({ error: "Company not dispatched to your bank" });
      }

      const { documentsRequested, reason } = z.object({
        documentsRequested: z.string().min(5, "Please describe the documents needed"),
        reason: z.string().optional(),
      }).parse(req.body);

      const docRequest = await storage.createBankDocumentRequest({
        companyProfileId,
        bankPartnerId: session.bankPartnerId,
        requestedByEmail: session.email,
        documentsRequested,
        reason: reason || null,
        status: "open",
      });

      // Get company and bank info for the admin notification
      const [profile] = await db.select().from(companyProfiles)
        .where(eq(companyProfiles.id, companyProfileId));
      const partner = await storage.getBankPartner(session.bankPartnerId);

      // Send email to admin
      await sendDocRequestAdminEmail(
        docRequest,
        profile?.companyName || `Company #${companyProfileId}`,
        partner?.name || `Bank #${session.bankPartnerId}`
      );

      // Send email to founder + create in-platform notification for founder
      if (profile?.founderId) {
        const [founderUser] = await db.select({ email: users.email })
          .from(users).where(eq(users.id, profile.founderId));
        if (founderUser?.email) {
          await sendDocRequestFounderEmail(
            docRequest,
            profile.companyName || `Company #${companyProfileId}`,
            partner?.name || `Bank #${session.bankPartnerId}`,
            founderUser.email,
            getSiteBaseUrl(req)
          );
        }
        await storage.createNotification({
          userId: profile.founderId,
          title: "Bank Document Request",
          message: `${partner?.name || "A bank"} has requested additional documents for ${profile.companyName || `Company #${companyProfileId}`}. Visit your vault to share them.`,
          type: "warning",
          linkUrl: "/founder/vault",
        });
      }

      // Create in-platform admin notification
      const adminUsers = await storage.getAllUsers();
      const admins = await Promise.all(adminUsers.map(async u => {
        const roles = await storage.getUserRoles(u.id);
        return roles.includes("admin") ? u : null;
      }));
      for (const admin of admins.filter(Boolean)) {
        await storage.createNotification({
          userId: admin!.id,
          title: "Bank Document Request",
          message: `${partner?.name || "A bank"} has requested documents for ${profile?.companyName || `Company #${companyProfileId}`}`,
          type: "info",
          linkUrl: "/admin/banking-partners",
        });
      }

      res.status(201).json(docRequest);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/bank-portal/companies/:id/doc-requests — list all requests this bank submitted for this company
  app.get("/api/bank-portal/companies/:id/doc-requests", async (req: Request, res: Response) => {
    try {
      const session = await getBankPortalSession(req);
      if (!session) return res.status(401).json({ error: "Not authenticated" });

      const companyProfileId = parseInt(req.params.id);

      // Verify dispatch access
      const dispatches = await storage.listBankCompanyDispatches({
        companyProfileId,
        bankPartnerId: session.bankPartnerId,
      });
      if (dispatches.length === 0) {
        return res.status(404).json({ error: "Company not dispatched to your bank" });
      }

      const requests = await db.select().from(bankDocumentRequests)
        .where(
          and(
            eq(bankDocumentRequests.companyProfileId, companyProfileId),
            eq(bankDocumentRequests.bankPartnerId, session.bankPartnerId)
          )
        )
        .orderBy(desc(bankDocumentRequests.createdAt));

      res.json(requests);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Admin Banking Partner Extensions ────────────────────────────────────────

  // POST /api/admin/banking-partners/:id/emails
  // Add an email to a bank partner and send invite
  app.post("/api/admin/banking-partners/:id/emails", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const id = parseInt(req.params.id);
      const { label, address } = z.object({
        label: z.string().min(1).max(100),
        address: z.string().email(),
      }).parse(req.body);

      const partner = await storage.getBankPartner(id);
      if (!partner) return res.status(404).json({ error: "Partner not found" });

      const currentEmails: { label: string; address: string }[] = Array.isArray(partner.emails) ? partner.emails : [];
      if (currentEmails.some(e => e.address.toLowerCase() === address.toLowerCase())) {
        return res.status(400).json({ error: "This email address is already registered for this partner" });
      }

      const newEmails = [...currentEmails, { label, address }];
      await storage.updateBankPartner(id, { emails: newEmails });

      // Create or update bank portal user for this email
      // Always ensure bankPartnerId and isActive are set correctly
      let portalUser = await storage.getBankPortalUserByEmail(address.toLowerCase());
      const token = generateToken();
      const expiry = new Date(Date.now() + INVITE_TOKEN_EXPIRY_MS);

      if (portalUser) {
        await storage.updateBankPortalUser(portalUser.id, {
          inviteToken: token,
          inviteTokenExpiry: expiry,
          bankPartnerId: id,
          isActive: true,
        });
      } else {
        await storage.createBankPortalUser({
          email: address.toLowerCase(),
          bankPartnerId: id,
          inviteToken: token,
          inviteTokenExpiry: expiry,
          isActive: true,
        });
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      await sendBankInviteEmail(address, partner.name, token, baseUrl);

      res.status(201).json({ ok: true, emails: newEmails });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE /api/admin/banking-partners/:id/emails/:email
  app.delete("/api/admin/banking-partners/:id/emails/:emailAddr", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const id = parseInt(req.params.id);
      const emailAddr = decodeURIComponent(req.params.emailAddr);
      const partner = await storage.getBankPartner(id);
      if (!partner) return res.status(404).json({ error: "Partner not found" });

      const currentEmails: { label: string; address: string }[] = Array.isArray(partner.emails) ? partner.emails : [];
      const newEmails = currentEmails.filter(e => e.address.toLowerCase() !== emailAddr.toLowerCase());
      await storage.updateBankPartner(id, { emails: newEmails });

      // Deactivate the portal user
      const portalUser = await storage.getBankPortalUserByEmail(emailAddr.toLowerCase());
      if (portalUser) {
        await storage.updateBankPortalUser(portalUser.id, { isActive: false });
      }

      res.json({ ok: true, emails: newEmails });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/banking-partners/:id/emails/:emailAddr/resend-invite
  app.post("/api/admin/banking-partners/:id/emails/:emailAddr/resend-invite", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const id = parseInt(req.params.id);
      const emailAddr = decodeURIComponent(req.params.emailAddr);
      const partner = await storage.getBankPartner(id);
      if (!partner) return res.status(404).json({ error: "Partner not found" });

      let portalUser = await storage.getBankPortalUserByEmail(emailAddr.toLowerCase());
      const token = generateToken();
      const expiry = new Date(Date.now() + INVITE_TOKEN_EXPIRY_MS);

      if (portalUser) {
        // Always ensure bankPartnerId and isActive are correct on resend
        await storage.updateBankPortalUser(portalUser.id, {
          inviteToken: token,
          inviteTokenExpiry: expiry,
          bankPartnerId: id,
          isActive: true,
        });
      } else {
        await storage.createBankPortalUser({
          email: emailAddr.toLowerCase(),
          bankPartnerId: id,
          inviteToken: token,
          inviteTokenExpiry: expiry,
          isActive: true,
        });
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      await sendBankInviteEmail(emailAddr, partner.name, token, baseUrl);

      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // PATCH /api/admin/banking-partners/:id/emails/:emailAddr — update email label
  app.patch("/api/admin/banking-partners/:id/emails/:emailAddr", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const id = parseInt(req.params.id);
      const emailAddr = decodeURIComponent(req.params.emailAddr);
      const { label } = z.object({ label: z.string().min(1) }).parse(req.body);

      const partner = await storage.getBankPartner(id);
      if (!partner) return res.status(404).json({ error: "Partner not found" });

      const currentEmails: { label: string; address: string }[] = Array.isArray(partner.emails) ? (partner.emails as { label: string; address: string }[]) : [];
      const idx = currentEmails.findIndex(e => e.address.toLowerCase() === emailAddr.toLowerCase());
      if (idx === -1) return res.status(404).json({ error: "Email not found" });

      const updatedEmails = currentEmails.map((e, i) => i === idx ? { label, address: e.address } : e);
      const updated = await storage.updateBankPartner(id, { emails: updatedEmails });
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Admin Dispatch Routes ────────────────────────────────────────────────────

  // GET /api/admin/applications/:id/company-profile — resolve companyProfile from applicationId
  app.get("/api/admin/applications/:id/company-profile", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const applicationId = parseInt(req.params.id);
      const [profile] = await db.select({ id: companyProfiles.id, companyName: companyProfiles.companyName, existingCompanyStatus: companyProfiles.existingCompanyStatus })
        .from(companyProfiles)
        .where(eq(companyProfiles.applicationId, applicationId));
      if (!profile) return res.status(404).json({ error: "No company profile found for this application" });
      res.json(profile);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/admin/company-profiles/:id/bank-preview — summary for dispatch dialog preview
  app.get("/api/admin/company-profiles/:id/bank-preview", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const id = parseInt(req.params.id);
      const [profile] = await db.select().from(companyProfiles).where(eq(companyProfiles.id, id));
      if (!profile) return res.status(404).json({ error: "Company profile not found" });
      const checklistRows = await db.select().from(profileChecklistItems)
        .where(eq(profileChecklistItems.companyProfileId, id));
      const submitted = checklistRows.filter(c => c.status === "submitted" || c.status === "approved").length;
      type DirectorEntry = { name: string; role?: string; email?: string; bvn?: string; nin?: string; bvnVerified?: boolean; ninVerified?: boolean };
      const directors: DirectorEntry[] = Array.isArray(profile.directors) ? (profile.directors as DirectorEntry[]) : [];
      const kybResult = profile.smileKybResult as Record<string, unknown> | null | undefined;
      const kybStatus = kybResult?.ResultCode === "1012" ? "VERIFIED" : kybResult ? "CHECKED" : "PENDING";
      res.json({
        companyName: profile.companyName,
        rcNumber: profile.rcNumber,
        companyType: profile.companyType,
        existingCompanyStatus: profile.existingCompanyStatus,
        tinNumber: profile.tinNumber,
        incorporationDate: profile.incorporationDate,
        directorCount: directors.length,
        verifiedDirectors: directors.filter(d => d.ninVerified || d.bvnVerified).length,
        checklistTotal: checklistRows.length,
        checklistSubmitted: submitted,
        kybStatus,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/bank-dispatches
  app.post("/api/admin/bank-dispatches", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const { companyProfileId, bankPartnerId } = z.object({
        companyProfileId: z.number().int().positive(),
        bankPartnerId: z.number().int().positive(),
      }).parse(req.body);

      const adminUserId = (req as any).user?.claims?.sub;
      const partner = await storage.getBankPartner(bankPartnerId);
      if (!partner) return res.status(404).json({ error: "Bank partner not found" });

      const emails: { label: string; address: string }[] = Array.isArray(partner.emails) ? partner.emails : [];
      if (emails.length === 0 && !partner.contactEmail) {
        return res.status(400).json({ error: "This bank has no registered email addresses. Add emails first." });
      }

      // Get company profile from company_profiles (primary table for existing/verified companies)
      const [profile] = await db.select().from(companyProfiles)
        .where(eq(companyProfiles.id, companyProfileId));
      if (!profile) return res.status(404).json({ error: "Company profile not found" });

      // Enrich with checklist items for document audit section in dossier email
      const checklistRows = await db.select().from(profileChecklistItems)
        .where(eq(profileChecklistItems.companyProfileId, companyProfileId));

      // Fetch founder identity verification metadata for bank trust signal
      let founderIdentityVerifiedAt: Date | null = null;
      let founderIdentitySource: string | null = null;
      let founderSelfieUrl: string | null = null;
      if (profile.founderId) {
        const [idVRecord] = await db.select({
          status: identityVerifications.status,
          verifiedAt: identityVerifications.verifiedAt,
          identitySource: identityVerifications.identitySource,
          selfieUrl: identityVerifications.selfieUrl,
        }).from(identityVerifications).where(eq(identityVerifications.founderUserId, profile.founderId));
        if (idVRecord?.status === 'verified') {
          founderIdentityVerifiedAt = idVRecord.verifiedAt;
          founderIdentitySource = idVRecord.identitySource;
          founderSelfieUrl = idVRecord.selfieUrl ?? null;
        }
      }

      const profileWithChecklist = { ...profile, checklistItems: checklistRows, founderIdentityVerifiedAt, founderIdentitySource, founderSelfieUrl };

      // If no emails array but has legacy contactEmail, use that
      const emailsToSend = emails.length > 0 ? emails : (partner.contactEmail ? [{ label: "Contact", address: partner.contactEmail }] : []);

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      await sendDispatchEmail(emailsToSend, partner.name, profileWithChecklist, baseUrl);

      const dispatch = await storage.createBankCompanyDispatch({
        companyProfileId,
        bankPartnerId,
        sentByUserId: adminUserId,
      });

      await storage.createAuditLog({
        actorUserId: adminUserId,
        action: "admin_bank_dispatch_sent",
        entityType: "bank_company_dispatch",
        entityId: String(dispatch.id),
        details: { companyProfileId, bankPartnerId, bankName: partner.name, companyName: profile.companyName },
      });

      res.status(201).json(dispatch);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/admin/bank-dispatches
  app.get("/api/admin/bank-dispatches", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const companyProfileId = req.query.companyProfileId ? parseInt(req.query.companyProfileId as string) : undefined;
      const bankPartnerId = req.query.bankPartnerId ? parseInt(req.query.bankPartnerId as string) : undefined;

      const dispatches = await storage.listBankCompanyDispatches({ companyProfileId, bankPartnerId });

      // Enrich with bank names and company names
      const enriched = await Promise.all(dispatches.map(async d => {
        const [partner, company] = await Promise.all([
          storage.getBankPartner(d.bankPartnerId),
          db.select({ id: companyProfiles.id, companyName: companyProfiles.companyName })
            .from(companyProfiles)
            .where(eq(companyProfiles.id, d.companyProfileId))
            .then(rows => rows[0]),
        ]);
        const sentByUser = d.sentByUserId ? await storage.getUser(d.sentByUserId) : null;
        return {
          ...d,
          bankName: partner?.name || `Bank #${d.bankPartnerId}`,
          companyName: company?.companyName || `Company #${d.companyProfileId}`,
          sentByName: sentByUser ? `${sentByUser.firstName || ""} ${sentByUser.lastName || ""}`.trim() : d.sentByUserId,
        };
      }));

      res.json(enriched);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Admin Bank Document Requests ────────────────────────────────────────────

  // GET /api/admin/bank-doc-requests
  app.get("/api/admin/bank-doc-requests", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const status = req.query.status as string | undefined;
      const bankPartnerId = req.query.bankPartnerId ? parseInt(req.query.bankPartnerId as string) : undefined;

      const requests = await storage.listBankDocumentRequests({ status, bankPartnerId });

      const enriched = await Promise.all(requests.map(async r => {
        const [partner, company] = await Promise.all([
          storage.getBankPartner(r.bankPartnerId),
          db.select({ id: companyProfiles.id, companyName: companyProfiles.companyName })
            .from(companyProfiles)
            .where(eq(companyProfiles.id, r.companyProfileId))
            .then(rows => rows[0]),
        ]);
        return {
          ...r,
          bankName: partner?.name || `Bank #${r.bankPartnerId}`,
          companyName: company?.companyName || `Company #${r.companyProfileId}`,
        };
      }));

      res.json(enriched);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // PATCH /api/admin/bank-doc-requests/:id/action
  app.patch("/api/admin/bank-doc-requests/:id/action", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const id = parseInt(req.params.id);
      const adminUserId = (req as any).user?.claims?.sub;
      const request = await storage.getBankDocumentRequest(id);
      if (!request) return res.status(404).json({ error: "Document request not found" });

      const updated = await storage.updateBankDocumentRequest(id, {
        status: "actioned",
        actionedAt: new Date(),
        actionedByUserId: adminUserId,
      });

      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Founder Bank Dispatch Endpoints ─────────────────────────────────────────

  // GET /api/founder/bank-partners — returns active bank partner list for the bank dispatch dialog
  app.get("/api/founder/bank-partners", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getFounderUserId(req);
      if (!userId) return res.status(403).json({ error: "Forbidden" });

      const all = await storage.listBankPartners();
      const partners = all.filter(p => p.isActive).map(p => ({ id: p.id, name: p.name }));
      res.json(partners);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/founder/company-profiles/:id/bank-dispatch — founder-initiated dossier dispatch
  app.post("/api/founder/company-profiles/:id/bank-dispatch", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getFounderUserId(req);
      if (!userId) return res.status(403).json({ error: "Forbidden" });

      const profileId = parseInt(req.params.id, 10);
      if (isNaN(profileId)) return res.status(400).json({ error: "Invalid profile ID" });

      const { bankPartnerId } = z.object({
        bankPartnerId: z.number().int().positive(),
      }).parse(req.body);

      const [profile] = await db.select().from(companyProfiles).where(eq(companyProfiles.id, profileId));
      if (!profile) return res.status(404).json({ error: "Company profile not found" });
      if (profile.founderId !== userId) return res.status(403).json({ error: "Forbidden" });
      if (profile.existingCompanyStatus !== "verified") {
        return res.status(400).json({ error: "Only verified companies can be dispatched to a bank" });
      }

      const partner = await storage.getBankPartner(bankPartnerId);
      if (!partner || !partner.isActive) return res.status(404).json({ error: "Bank partner not found or no longer active" });

      const emails: { label: string; address: string }[] = Array.isArray(partner.emails) ? partner.emails : [];
      if (emails.length === 0 && !partner.contactEmail) {
        return res.status(400).json({ error: "This bank has no registered email addresses. Contact Cellion support." });
      }

      const checklistRows = await db.select().from(profileChecklistItems).where(eq(profileChecklistItems.companyProfileId, profileId));

      let founderIdentityVerifiedAt: Date | null = null;
      let founderIdentitySource: string | null = null;
      let founderSelfieUrl: string | null = null;
      const [idVRecord] = await db.select({
        status: identityVerifications.status,
        verifiedAt: identityVerifications.verifiedAt,
        identitySource: identityVerifications.identitySource,
        selfieUrl: identityVerifications.selfieUrl,
      }).from(identityVerifications).where(eq(identityVerifications.founderUserId, userId));
      if (idVRecord?.status === "verified") {
        founderIdentityVerifiedAt = idVRecord.verifiedAt;
        founderIdentitySource = idVRecord.identitySource;
        founderSelfieUrl = idVRecord.selfieUrl ?? null;
      }

      const profileWithChecklist = { ...profile, checklistItems: checklistRows, founderIdentityVerifiedAt, founderIdentitySource, founderSelfieUrl };
      const emailsToSend = emails.length > 0 ? emails : (partner.contactEmail ? [{ label: "Contact", address: partner.contactEmail }] : []);

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      await sendDispatchEmail(emailsToSend, partner.name, profileWithChecklist, baseUrl);

      const dispatch = await storage.createBankCompanyDispatch({
        companyProfileId: profileId,
        bankPartnerId,
        sentByUserId: userId,
      });

      await storage.createAuditLog({
        actorUserId: userId,
        action: "founder_bank_dispatch_sent",
        entityType: "bank_company_dispatch",
        entityId: String(dispatch.id),
        details: { companyProfileId: profileId, bankPartnerId, bankName: partner.name, companyName: profile.companyName },
      });

      res.status(201).json({ ...dispatch, bankName: partner.name });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/founder/company-profiles/:id/dispatches — dispatch history for a verified company profile
  app.get("/api/founder/company-profiles/:id/dispatches", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = await getFounderUserId(req);
      if (!userId) return res.status(403).json({ error: "Forbidden" });

      const profileId = parseInt(req.params.id, 10);
      if (isNaN(profileId)) return res.status(400).json({ error: "Invalid profile ID" });

      const [profile] = await db.select({ id: companyProfiles.id, founderId: companyProfiles.founderId })
        .from(companyProfiles).where(eq(companyProfiles.id, profileId));
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      if (profile.founderId !== userId) return res.status(403).json({ error: "Forbidden" });

      const dispatches = await storage.listBankCompanyDispatches({ companyProfileId: profileId });

      const enriched = await Promise.all(dispatches.map(async d => {
        const partner = await storage.getBankPartner(d.bankPartnerId);
        return {
          id: d.id,
          bankPartnerId: d.bankPartnerId,
          bankName: partner?.name || `Bank #${d.bankPartnerId}`,
          sentAt: d.sentAt,
        };
      }));

      res.json(enriched);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
