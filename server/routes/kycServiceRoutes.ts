import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { eq, and, desc, asc, or, ilike, sql, count, isNull, inArray } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import {
  kycOrganisations, kycOrgMembers, kycVerificationTemplates,
  kycDocumentRequirements, kycVerificationRequests,
  kycSupplierProfiles, kycSubmittedDocuments, kycSupplierPeople,
  kycApiKeys, kycApiUsageLogs, kycBillingAccounts, kycBillingRequests, kycCreditTransactions, kycInvoices,
  kycSessions, kycSanctionsLogs, kycStrReports, kycVerifiedIdentityData,
  kycRescreeningBatches, kycRescreeningBatchItems,
  sensitiveDataAccessLogs, identityVerifications,
  users, userRoles,
  type KycOrganisation, type KycOrgMember, type KycVerificationRequest,
  type KycSupplierProfile, type KycSubmittedDocument, type KycSupplierPerson,
  type KycDocumentRequirement, type KycVerificationTemplate,
  type KycVerifiedSnapshot,
  KYC_BILLING_MODES,
} from "@shared/schema";
import * as kycApiKeyService from "../services/kycApiKeyService";
import * as billingService from "../services/kycBillingService";
import * as webhookService from "../services/kycWebhookService";
import * as smileIdService from "../services/smileIdService";
import { isAuthenticated } from "../replit_integrations/auth";
import { ObjectStorageService } from "../replit_integrations/object_storage";
import { getResendClient } from "../services/emailService";
import { getPaystackPrice } from "../config/priceBook";
import { upsertVerifiedEntity } from "../services/verifiedEntityService";
import {
  captureVerifiedIdentityProfile,
  getIdentityProfile,
  getGovernmentPhotoUrl,
} from "../services/identityProfileService";
import { executeRescreeningItem } from "../services/kycSchedulerService";

const TERMS_VERSION = "1.0";
const objectStorageService = new ObjectStorageService();

function getUserId(req: any): string {
  return req.user?.claims?.sub;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

function generateToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

async function getOrgMembership(orgId: number, userId: string): Promise<KycOrgMember | undefined> {
  const [member] = await db
    .select()
    .from(kycOrgMembers)
    .where(and(eq(kycOrgMembers.orgId, orgId), eq(kycOrgMembers.userId, userId), eq(kycOrgMembers.inviteStatus, "accepted")));
  return member;
}

function requireOrgMember(allowedRoles?: string[]) {
  return async (req: any, res: Response, next: NextFunction) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const orgId = parseInt(req.params.id);
    if (isNaN(orgId)) return res.status(400).json({ message: "Invalid org ID" });

    // Platform admins and super admins bypass org membership — they can access any org's data
    const userRoles: string[] = req.user?.roles ?? [];
    const isPlatformAdmin = userRoles.includes("admin") || userRoles.includes("super_admin");
    if (isPlatformAdmin) {
      (req as any).orgMember = { role: "org_admin", orgId, userId, isPlatformAdminOverride: true };
      return next();
    }

    const member = await getOrgMembership(orgId, userId);
    if (!member) return res.status(403).json({ message: "Not a member of this organisation" });

    if (allowedRoles && !allowedRoles.includes(member.role)) {
      return res.status(403).json({ message: `Requires one of: ${allowedRoles.join(", ")}` });
    }

    (req as any).orgMember = member;
    next();
  };
}

function requireActiveOrg() {
  return async (req: any, res: Response, next: NextFunction) => {
    const orgId = parseInt(req.params.id);
    if (isNaN(orgId)) return res.status(400).json({ message: "Invalid org ID" });

    const [org] = await db
      .select({ status: kycOrganisations.status })
      .from(kycOrganisations)
      .where(eq(kycOrganisations.id, orgId))
      .limit(1);

    if (!org) return res.status(404).json({ message: "Organisation not found" });

    if (org.status === "pending_review") {
      return res.status(403).json({
        message: "Organisation is pending admin review. Operational features will be available once your account is approved.",
        code: "ORG_PENDING_REVIEW",
      });
    }
    if (org.status === "suspended") {
      return res.status(403).json({
        message: "Organisation has been suspended. Please contact support for assistance.",
        code: "ORG_SUSPENDED",
      });
    }
    next();
  };
}

function calculateRiskScore(docs: KycSubmittedDocument[], requirements: KycDocumentRequirement[], people?: KycSupplierPerson[]): string {
  const mandatoryReqs = requirements.filter(r => r.isMandatory && r.isActive);
  const mandatoryReqIds = new Set(mandatoryReqs.map(r => r.id));

  const submittedForMandatory = docs.filter(d => mandatoryReqIds.has(d.requirementId));
  const allMandatorySubmitted = mandatoryReqs.every(r => docs.some(d => d.requirementId === r.id));
  const allMandatoryAccepted = mandatoryReqs.every(r => docs.some(d => d.requirementId === r.id && d.status === "accepted"));

  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const hasExpired = docs.some(d => d.expiryDate && new Date(d.expiryDate) < now);
  const hasExpiringSoon = docs.some(d => d.expiryDate && new Date(d.expiryDate) < thirtyDays && new Date(d.expiryDate) >= now);

  const peopleFailed = people?.some(p => p.verificationStatus === "failed");
  const peopleAllVerified = !people?.length || people.filter(p => p.requiresVerification).every(p => p.verificationStatus === "verified");

  if (!allMandatorySubmitted || hasExpired || peopleFailed) return "red";
  if (!allMandatoryAccepted || hasExpiringSoon || !peopleAllVerified) return "amber";
  return "green";
}

/**
 * Maps a detected ID sub-type string to a Smile ID lookup call.
 * Returns null when the sub-type is unrecognised or no ID number is present.
 */
interface SmileIdLookupOutcome {
  result: smileIdService.IdLookupResult;
  smileIdType: string;
  dataSource: string;
}

async function attemptSmileIdLookupForApproval(
  docs: Array<{ extractedData: unknown; detectedDocumentType: string | null }>,
  orgId: number,
): Promise<SmileIdLookupOutcome | null> {
  for (const doc of docs) {
    const raw = doc.extractedData;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const ext = raw as Record<string, unknown>;

    // Extract idSubType and idNumber from ExtractionField objects
    const idSubTypeField = ext.idSubType as { value?: unknown } | null | undefined;
    const idNumberField = ext.idNumber as { value?: unknown } | null | undefined;
    const idSubType = typeof idSubTypeField?.value === "string" ? idSubTypeField.value.toLowerCase() : "";
    const idNumber = typeof idNumberField?.value === "string" ? idNumberField.value.trim() : "";

    // Also check for flat bvn/nin fields stored by older extractors
    const flatBvn = typeof ext.bvn === "string" ? ext.bvn.trim() : "";
    const flatNin = typeof ext.nin === "string" ? ext.nin.trim() : "";

    const ref = `org_approval_lookup_${orgId}_${Date.now()}`;

    if ((idSubType.includes("bvn") || doc.detectedDocumentType?.toLowerCase().includes("bvn")) && (idNumber || flatBvn)) {
      const num = idNumber || flatBvn;
      if (num.length < 10) continue;
      const result = await smileIdService.lookupBvn(num, ref);
      return { result, smileIdType: "BVN", dataSource: "NIBSS BVN Database" };
    }

    if ((idSubType.includes("nin") || idSubType.includes("national_id") || doc.detectedDocumentType?.toLowerCase().includes("nin")) && (idNumber || flatNin)) {
      const num = idNumber || flatNin;
      if (num.length < 10) continue;
      const result = await smileIdService.lookupNin(num, ref);
      return { result, smileIdType: "NIN", dataSource: "NIMC National ID Database" };
    }

    if (idSubType.includes("drivers_licence") && idNumber && idNumber.length >= 10) {
      const result = await smileIdService.lookupDriversLicence(idNumber, ref);
      return { result, smileIdType: "DRIVERS_LICENSE", dataSource: "Nigeria FRSC Driver Database" };
    }

    if (idSubType.includes("voters_card") && idNumber && idNumber.length >= 10) {
      const result = await smileIdService.lookupVoterId(idNumber, ref);
      return { result, smileIdType: "VOTER_ID", dataSource: "INEC Voter Register" };
    }

    // Passport — idSubType often contains "passport" or detectedDocumentType may say "international_passport"
    const passportSubType = idSubType.includes("passport");
    const passportDocType = doc.detectedDocumentType?.toLowerCase().includes("passport");
    if ((passportSubType || passportDocType) && idNumber && idNumber.length >= 5) {
      // Optional enrichment: expiry date and name fields from extraction
      const expiryField = ext.expiryDate as { value?: unknown } | null | undefined;
      const firstNameField = ext.firstName as { value?: unknown } | null | undefined;
      const lastNameField = ext.lastName as { value?: unknown } | null | undefined;
      const dobField = ext.dateOfBirth as { value?: unknown } | null | undefined;
      const expiryDate = typeof expiryField?.value === "string" ? expiryField.value : undefined;
      const firstName = typeof firstNameField?.value === "string" ? firstNameField.value : undefined;
      const lastName = typeof lastNameField?.value === "string" ? lastNameField.value : undefined;
      const dob = typeof dobField?.value === "string" ? dobField.value : undefined;
      const result = await smileIdService.lookupPassport(
        idNumber, ref, expiryDate,
        (firstName || lastName || dob) ? { firstName, lastName, dob } : undefined,
      );
      return { result, smileIdType: "PASSPORT", dataSource: "NIS Passport Database" };
    }
  }
  return null;
}

async function sendKycEmail(to: string, subject: string, html: string) {
  try {
    const { client, fromEmail } = await getResendClient();
    await client.emails.send({ from: fromEmail, to, subject, html });
  } catch (error) {
    console.error("[KYC Email] Failed to send:", error);
  }
}

export function registerKycServiceRoutes(app: Express) {

  // ==================== ORGANISATION MANAGEMENT (T002) ====================

  app.post("/api/kyc-service/organisations", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const integrationProfileSchema = z.object({
        mode: z.enum(["full_hosted", "prefill_selfie", "selfie_only", "data_collection"]),
        verificationLocation: z.enum(["hosted", "embedded", "headless"]),
        requiresBiometric: z.boolean(),
        resultTiming: z.enum(["instant", "webhook"]),
        configuredAt: z.string().optional(),
      }).optional();

      const schema = z.object({
        name: z.string().min(2).max(255),
        category: z.enum(["corporate", "government", "ngo", "educational"]),
        contactEmail: z.string().email(),
        contactPhone: z.string().optional(),
        address: z.string().optional(),
        termsAccepted: z.literal(true, { errorMap: () => ({ message: "You must accept the KYC Service Agreement" }) }),
        integrationProfile: integrationProfileSchema,
      });

      const data = schema.parse(req.body);
      let slug = slugify(data.name);

      const [existing] = await db.select().from(kycOrganisations).where(eq(kycOrganisations.slug, slug));
      if (existing) slug = `${slug}-${Date.now().toString(36)}`;

      const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "unknown";

      const [org] = await db.insert(kycOrganisations).values({
        name: data.name,
        slug,
        category: data.category,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone || null,
        address: data.address || null,
        createdByUserId: userId,
        status: "pending_review",
        settings: {},
        employeePortalEnabled: true,
        supplierPortalEnabled: true,
        termsAcceptedAt: new Date(),
        termsVersion: TERMS_VERSION,
        termsAcceptedByUserId: userId,
        termsAcceptedIp: clientIp,
        integrationProfile: data.integrationProfile
          ? {
              mode: data.integrationProfile.mode,
              verificationLocation: data.integrationProfile.verificationLocation,
              requiresBiometric: data.integrationProfile.requiresBiometric,
              resultTiming: data.integrationProfile.resultTiming,
              configuredAt: data.integrationProfile.configuredAt || new Date().toISOString(),
            }
          : null,
      }).returning();

      await db.insert(kycOrgMembers).values({
        orgId: org.id,
        userId,
        role: "org_admin",
        inviteEmail: data.contactEmail,
        inviteStatus: "accepted",
      });

      // Notify admin that a new KYC org is awaiting review
      try {
        const { client: emailClient, fromEmail } = await getResendClient();
        await emailClient.emails.send({
          from: fromEmail,
          to: "service@cellionone.com",
          subject: `[KYC] New Organisation Awaiting Review: ${data.name}`,
          html: `<p>A new KYC Service organisation has been created and is pending review.</p>
            <ul>
              <li><strong>Name:</strong> ${data.name}</li>
              <li><strong>Category:</strong> ${data.category}</li>
              <li><strong>Contact Email:</strong> ${data.contactEmail}</li>
              <li><strong>Org ID:</strong> ${org.id}</li>
            </ul>
            <p>Please review and approve or reject this organisation in the <a href="https://cellionone.com/admin/kyc">Admin KYC Dashboard</a>.</p>`,
        });
      } catch (emailErr) {
        console.error("[KYC] Failed to send admin notification email:", emailErr);
      }

      res.status(201).json({ ...org, pendingReview: true });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC] Create org error:", error);
      res.status(500).json({ message: "Failed to create organisation" });
    }
  });

  app.get("/api/kyc-service/organisations", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const memberships = await db.select().from(kycOrgMembers)
        .where(and(eq(kycOrgMembers.userId, userId), eq(kycOrgMembers.inviteStatus, "accepted")));

      if (!memberships.length) return res.json([]);

      const orgIds = memberships.map(m => m.orgId);
      const orgs = await db.select().from(kycOrganisations)
        .where(sql`${kycOrganisations.id} IN (${sql.join(orgIds.map(id => sql`${id}`), sql`, `)})`);

      const orgsWithRole = orgs.map(org => ({
        ...org,
        memberRole: memberships.find(m => m.orgId === org.id)?.role,
      }));

      res.json(orgsWithRole);
    } catch (error: any) {
      console.error("[KYC] List orgs error:", error);
      res.status(500).json({ message: "Failed to list organisations" });
    }
  });

  app.get("/api/kyc-service/organisations/:id", isAuthenticated, requireOrgMember(), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const [org] = await db.select().from(kycOrganisations).where(eq(kycOrganisations.id, orgId));
      if (!org) return res.status(404).json({ message: "Organisation not found" });

      const members = await db.select().from(kycOrgMembers).where(eq(kycOrgMembers.orgId, orgId));

      const [stats] = await db.select({
        total: count(),
        pending: sql<number>`COUNT(*) FILTER (WHERE ${kycVerificationRequests.status} IN ('pending_invite', 'pending_payment', 'in_progress', 'documents_submitted'))`,
        underReview: sql<number>`COUNT(*) FILTER (WHERE ${kycVerificationRequests.status} = 'under_review')`,
        verified: sql<number>`COUNT(*) FILTER (WHERE ${kycVerificationRequests.status} = 'verified')`,
        rejected: sql<number>`COUNT(*) FILTER (WHERE ${kycVerificationRequests.status} = 'rejected')`,
        expired: sql<number>`COUNT(*) FILTER (WHERE ${kycVerificationRequests.status} = 'expired')`,
        riskGreen: sql<number>`COUNT(*) FILTER (WHERE ${kycVerificationRequests.riskScore} = 'green')`,
        riskAmber: sql<number>`COUNT(*) FILTER (WHERE ${kycVerificationRequests.riskScore} = 'amber')`,
        riskRed: sql<number>`COUNT(*) FILTER (WHERE ${kycVerificationRequests.riskScore} = 'red')`,
      }).from(kycVerificationRequests).where(eq(kycVerificationRequests.orgId, orgId));

      res.json({ ...org, members, stats });
    } catch (error: any) {
      console.error("[KYC] Get org error:", error);
      res.status(500).json({ message: "Failed to get organisation" });
    }
  });

  app.patch("/api/kyc-service/organisations/:id", isAuthenticated, requireOrgMember(["org_admin"]), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const integrationProfileSchema = z.object({
        mode: z.enum(["full_hosted", "prefill_selfie", "selfie_only", "data_collection"]),
        verificationLocation: z.enum(["hosted", "embedded", "headless"]),
        requiresBiometric: z.boolean(),
        resultTiming: z.enum(["instant", "webhook"]),
        configuredAt: z.string().optional(),
      }).optional();

      const schema = z.object({
        name: z.string().min(2).max(255).optional(),
        contactEmail: z.string().email().optional(),
        contactPhone: z.string().optional(),
        address: z.string().optional(),
        logoPath: z.string().optional(),
        settings: z.record(z.unknown()).optional(),
        employeePortalEnabled: z.boolean().optional(),
        supplierPortalEnabled: z.boolean().optional(),
        integrationProfile: integrationProfileSchema,
      });

      const data = schema.parse(req.body);
      const [updated] = await db.update(kycOrganisations)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(kycOrganisations.id, orgId))
        .returning();

      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC] Update org error:", error);
      res.status(500).json({ message: "Failed to update organisation" });
    }
  });

  // ---- Org Members ----

  app.post("/api/kyc-service/organisations/:id/members", isAuthenticated, requireOrgMember(["org_admin"]), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const schema = z.object({
        email: z.string().email(),
        role: z.enum(["org_admin", "org_reviewer", "org_viewer"]),
      });
      const data = schema.parse(req.body);

      const [existingMember] = await db.select().from(kycOrgMembers)
        .where(and(eq(kycOrgMembers.orgId, orgId), eq(kycOrgMembers.inviteEmail, data.email)));
      if (existingMember) return res.status(409).json({ message: "Member already invited" });

      const inviteToken = generateToken();
      const [member] = await db.insert(kycOrgMembers).values({
        orgId,
        role: data.role,
        inviteEmail: data.email,
        inviteStatus: "pending",
        inviteToken,
      }).returning();

      const [org] = await db.select().from(kycOrganisations).where(eq(kycOrganisations.id, orgId));
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      await sendKycEmail(data.email, `You've been invited to ${org?.name || "an organisation"} on Cellion One`,
        `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#0d9668;">You've Been Invited</h2>
          <p>${org?.name || "An organisation"} has invited you to join their KYC verification team on Cellion One as a <strong>${data.role.replace("org_", "")}</strong>.</p>
          <a href="${baseUrl}/kyc/org-invite/${inviteToken}" style="display:inline-block;padding:12px 24px;background:#0d9668;color:white;text-decoration:none;border-radius:6px;margin:16px 0;">Accept Invitation</a>
          <p style="color:#666;font-size:12px;">If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>`
      );

      res.status(201).json(member);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC] Invite member error:", error);
      res.status(500).json({ message: "Failed to invite member" });
    }
  });

  app.get("/api/kyc-service/org-invite/:token", async (req: any, res: Response) => {
    try {
      const [member] = await db.select().from(kycOrgMembers)
        .where(eq(kycOrgMembers.inviteToken, req.params.token));
      if (!member) return res.status(404).json({ message: "Invite not found or already accepted" });

      const [org] = await db.select().from(kycOrganisations).where(eq(kycOrganisations.id, member.orgId));

      res.json({
        id: member.id,
        orgId: member.orgId,
        orgName: org?.name || "Unknown Organisation",
        role: member.role,
        inviteEmail: member.inviteEmail,
        inviteStatus: member.inviteStatus,
      });
    } catch (error: any) {
      console.error("[KYC] Get invite info error:", error);
      res.status(500).json({ message: "Failed to get invite info" });
    }
  });

  app.post("/api/kyc-service/org-invite/:token/accept", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const [member] = await db.select().from(kycOrgMembers)
        .where(and(eq(kycOrgMembers.inviteToken, req.params.token), eq(kycOrgMembers.inviteStatus, "pending")));
      if (!member) return res.status(404).json({ message: "Invite not found or already accepted" });

      const [updated] = await db.update(kycOrgMembers)
        .set({ userId, inviteStatus: "accepted", inviteToken: null })
        .where(eq(kycOrgMembers.id, member.id))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("[KYC] Accept invite error:", error);
      res.status(500).json({ message: "Failed to accept invite" });
    }
  });

  app.delete("/api/kyc-service/organisations/:id/members/:memberId", isAuthenticated, requireOrgMember(["org_admin"]), async (req: any, res: Response) => {
    try {
      const memberId = parseInt(req.params.memberId);
      const orgId = parseInt(req.params.id);

      const [member] = await db.select().from(kycOrgMembers)
        .where(and(eq(kycOrgMembers.id, memberId), eq(kycOrgMembers.orgId, orgId)));
      if (!member) return res.status(404).json({ message: "Member not found" });

      const [org] = await db.select().from(kycOrganisations).where(eq(kycOrganisations.id, orgId));
      if (org && member.userId === org.createdByUserId) {
        return res.status(400).json({ message: "Cannot remove the organisation creator" });
      }

      await db.delete(kycOrgMembers).where(eq(kycOrgMembers.id, memberId));
      res.json({ message: "Member removed" });
    } catch (error: any) {
      console.error("[KYC] Remove member error:", error);
      res.status(500).json({ message: "Failed to remove member" });
    }
  });

  // ---- Document Requirements ----

  app.get("/api/kyc-service/organisations/:id/document-requirements", isAuthenticated, requireOrgMember(), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const typeFilter = req.query.type as string | undefined;

      let query = db.select().from(kycDocumentRequirements)
        .where(
          and(
            or(eq(kycDocumentRequirements.orgId, orgId), isNull(kycDocumentRequirements.orgId)),
            eq(kycDocumentRequirements.isActive, true),
            typeFilter ? eq(kycDocumentRequirements.type, typeFilter) : undefined
          )
        )
        .orderBy(asc(kycDocumentRequirements.documentCategory), asc(kycDocumentRequirements.documentName));

      const requirements = await query;
      res.json(requirements);
    } catch (error: any) {
      console.error("[KYC] List requirements error:", error);
      res.status(500).json({ message: "Failed to list requirements" });
    }
  });

  app.post("/api/kyc-service/organisations/:id/document-requirements", isAuthenticated, requireOrgMember(["org_admin"]), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const schema = z.object({
        type: z.enum(["individual", "supplier"]),
        documentName: z.string().min(2).max(255),
        documentDescription: z.string().optional(),
        documentCategory: z.enum(["registration", "tax", "financial", "identity", "compliance", "other"]),
        isMandatory: z.boolean().default(true),
        hasExpiry: z.boolean().default(false),
      });
      const data = schema.parse(req.body);

      const [requirement] = await db.insert(kycDocumentRequirements).values({
        orgId,
        ...data,
        documentDescription: data.documentDescription || null,
        isStandard: false,
        isActive: true,
      }).returning();

      res.status(201).json(requirement);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC] Create requirement error:", error);
      res.status(500).json({ message: "Failed to create requirement" });
    }
  });

  app.patch("/api/kyc-service/organisations/:id/document-requirements/:reqId", isAuthenticated, requireOrgMember(["org_admin"]), async (req: any, res: Response) => {
    try {
      const reqId = parseInt(req.params.reqId);
      const orgId = parseInt(req.params.id);

      const [existing] = await db.select().from(kycDocumentRequirements).where(eq(kycDocumentRequirements.id, reqId));
      if (!existing) return res.status(404).json({ message: "Requirement not found" });
      if (existing.isStandard && existing.orgId === null) {
        return res.status(400).json({ message: "Cannot modify standard platform requirements" });
      }

      const schema = z.object({
        isMandatory: z.boolean().optional(),
        isActive: z.boolean().optional(),
        hasExpiry: z.boolean().optional(),
      });
      const data = schema.parse(req.body);

      const [updated] = await db.update(kycDocumentRequirements).set(data).where(eq(kycDocumentRequirements.id, reqId)).returning();
      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC] Update requirement error:", error);
      res.status(500).json({ message: "Failed to update requirement" });
    }
  });

  app.delete("/api/kyc-service/organisations/:id/document-requirements/:reqId", isAuthenticated, requireOrgMember(["org_admin"]), async (req: any, res: Response) => {
    try {
      const reqId = parseInt(req.params.reqId);
      const [existing] = await db.select().from(kycDocumentRequirements).where(eq(kycDocumentRequirements.id, reqId));
      if (!existing) return res.status(404).json({ message: "Requirement not found" });
      if (existing.isStandard) return res.status(400).json({ message: "Cannot delete standard requirements" });

      await db.delete(kycDocumentRequirements).where(eq(kycDocumentRequirements.id, reqId));
      res.json({ message: "Requirement deleted" });
    } catch (error: any) {
      console.error("[KYC] Delete requirement error:", error);
      res.status(500).json({ message: "Failed to delete requirement" });
    }
  });

  // ---- Verification Templates ----

  app.get("/api/kyc-service/organisations/:id/templates", isAuthenticated, requireOrgMember(), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const templates = await db.select().from(kycVerificationTemplates)
        .where(eq(kycVerificationTemplates.orgId, orgId))
        .orderBy(asc(kycVerificationTemplates.name));
      res.json(templates);
    } catch (error: any) {
      console.error("[KYC] List templates error:", error);
      res.status(500).json({ message: "Failed to list templates" });
    }
  });

  app.post("/api/kyc-service/organisations/:id/templates", isAuthenticated, requireOrgMember(["org_admin"]), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const schema = z.object({
        name: z.string().min(2).max(255),
        type: z.enum(["individual", "supplier"]),
        description: z.string().optional(),
        requireDirectorVerification: z.boolean().default(false),
        documentRequirementIds: z.array(z.number()).default([]),
        isDefault: z.boolean().default(false),
      });
      const data = schema.parse(req.body);

      if (data.isDefault) {
        await db.update(kycVerificationTemplates)
          .set({ isDefault: false })
          .where(and(eq(kycVerificationTemplates.orgId, orgId), eq(kycVerificationTemplates.type, data.type)));
      }

      const [template] = await db.insert(kycVerificationTemplates).values({
        orgId,
        ...data,
        description: data.description || null,
      }).returning();

      res.status(201).json(template);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC] Create template error:", error);
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  app.patch("/api/kyc-service/organisations/:id/templates/:tid", isAuthenticated, requireOrgMember(["org_admin"]), async (req: any, res: Response) => {
    try {
      const tid = parseInt(req.params.tid);
      const orgId = parseInt(req.params.id);

      const schema = z.object({
        name: z.string().min(2).max(255).optional(),
        description: z.string().optional(),
        requireDirectorVerification: z.boolean().optional(),
        documentRequirementIds: z.array(z.number()).optional(),
        isDefault: z.boolean().optional(),
      });
      const data = schema.parse(req.body);

      if (data.isDefault) {
        const [existing] = await db.select().from(kycVerificationTemplates).where(eq(kycVerificationTemplates.id, tid));
        if (existing) {
          await db.update(kycVerificationTemplates)
            .set({ isDefault: false })
            .where(and(eq(kycVerificationTemplates.orgId, orgId), eq(kycVerificationTemplates.type, existing.type)));
        }
      }

      const [updated] = await db.update(kycVerificationTemplates)
        .set(data)
        .where(and(eq(kycVerificationTemplates.id, tid), eq(kycVerificationTemplates.orgId, orgId)))
        .returning();

      if (!updated) return res.status(404).json({ message: "Template not found" });
      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC] Update template error:", error);
      res.status(500).json({ message: "Failed to update template" });
    }
  });

  app.delete("/api/kyc-service/organisations/:id/templates/:tid", isAuthenticated, requireOrgMember(["org_admin"]), async (req: any, res: Response) => {
    try {
      const tid = parseInt(req.params.tid);
      const orgId = parseInt(req.params.id);
      const result = await db.delete(kycVerificationTemplates)
        .where(and(eq(kycVerificationTemplates.id, tid), eq(kycVerificationTemplates.orgId, orgId)));
      res.json({ message: "Template deleted" });
    } catch (error: any) {
      console.error("[KYC] Delete template error:", error);
      res.status(500).json({ message: "Failed to delete template" });
    }
  });

  // ==================== VERIFICATION REQUESTS (T003) ====================

  app.post("/api/kyc-service/organisations/:id/verification-requests", isAuthenticated, requireOrgMember(["org_admin", "org_reviewer"]), requireActiveOrg(), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const userId = getUserId(req);

      const schema = z.object({
        type: z.enum(["individual", "supplier"]),
        subjectEmail: z.string().email(),
        subjectName: z.string().min(1).max(255),
        templateId: z.number().optional(),
        expiresInDays: z.number().min(1).max(365).default(30),
        notes: z.string().optional(),
        paymentResponsibility: z.enum(["organisation", "subject"]).default("organisation"),
      });
      const data = schema.parse(req.body);

      const inviteToken = generateToken();
      const expiresAt = new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000);

      const paymentStatus = data.paymentResponsibility === "organisation" ? "not_required" : "pending";

      const [request] = await db.insert(kycVerificationRequests).values({
        orgId,
        templateId: data.templateId || null,
        requestedByUserId: userId,
        type: data.type,
        status: "pending_invite",
        subjectEmail: data.subjectEmail,
        subjectName: data.subjectName,
        notes: data.notes || null,
        paymentResponsibility: data.paymentResponsibility,
        paymentStatus,
        inviteToken,
        expiresAt,
      }).returning();

      const [org] = await db.select().from(kycOrganisations).where(eq(kycOrganisations.id, orgId));
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const typeLabel = data.type === "individual" ? "employee identity verification" : "supplier due diligence verification";

      await sendKycEmail(data.subjectEmail, `${org?.name || "An organisation"} has requested you to complete verification via Cellion One`,
        `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#0d9668;">Verification Request</h2>
          <p><strong>${org?.name || "An organisation"}</strong> has requested you to complete ${typeLabel} via Cellion One.</p>
          <p>Please click the link below to begin the verification process. This link expires on <strong>${expiresAt.toLocaleDateString("en-NG", { dateStyle: "long" })}</strong>.</p>
          <a href="${baseUrl}/kyc/verify/${inviteToken}" style="display:inline-block;padding:12px 24px;background:#0d9668;color:white;text-decoration:none;border-radius:6px;margin:16px 0;">Begin Verification</a>
          <p style="color:#666;font-size:12px;">If you didn't expect this request, please contact ${org?.contactEmail || "the requesting organisation"}.</p>
        </div>`
      );

      res.status(201).json(request);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC] Create request error:", error);
      res.status(500).json({ message: "Failed to create verification request" });
    }
  });

  app.post("/api/kyc-service/organisations/:id/verification-requests/bulk", isAuthenticated, requireOrgMember(["org_admin"]), requireActiveOrg(), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const userId = getUserId(req);

      const schema = z.object({
        entries: z.array(z.object({
          name: z.string().min(1),
          email: z.string().email(),
        })).min(1).max(500),
        type: z.enum(["individual", "supplier"]),
        templateId: z.number().optional(),
        paymentResponsibility: z.enum(["organisation", "subject"]).default("organisation"),
        expiresInDays: z.number().min(1).max(365).default(30),
      });
      const data = schema.parse(req.body);

      const expiresAt = new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000);
      const paymentStatus = data.paymentResponsibility === "organisation" ? "not_required" : "pending";
      const [org] = await db.select().from(kycOrganisations).where(eq(kycOrganisations.id, orgId));
      const baseUrl = `${req.protocol}://${req.get("host")}`;

      const created: KycVerificationRequest[] = [];

      for (const entry of data.entries) {
        const inviteToken = generateToken();
        const [request] = await db.insert(kycVerificationRequests).values({
          orgId,
          templateId: data.templateId || null,
          requestedByUserId: userId,
          type: data.type,
          status: "pending_invite",
          subjectEmail: entry.email,
          subjectName: entry.name,
          paymentResponsibility: data.paymentResponsibility,
          paymentStatus,
          inviteToken,
          expiresAt,
        }).returning();
        created.push(request);

        await sendKycEmail(entry.email, `${org?.name || "An organisation"} has requested you to complete verification via Cellion One`,
          `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#0d9668;">Verification Request</h2>
            <p><strong>${org?.name || "An organisation"}</strong> has requested you to complete verification via Cellion One.</p>
            <a href="${baseUrl}/kyc/verify/${inviteToken}" style="display:inline-block;padding:12px 24px;background:#0d9668;color:white;text-decoration:none;border-radius:6px;margin:16px 0;">Begin Verification</a>
          </div>`
        );
      }

      res.status(201).json({ created: created.length, requests: created });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC] Bulk create error:", error);
      res.status(500).json({ message: "Failed to create bulk requests" });
    }
  });

  app.get("/api/kyc-service/organisations/:id/verification-requests", isAuthenticated, requireOrgMember(), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const { type, status, riskScore, search, page = "1", limit = "20" } = req.query as Record<string, string>;

      const conditions = [eq(kycVerificationRequests.orgId, orgId)];
      if (type) conditions.push(eq(kycVerificationRequests.type, type));
      if (status) conditions.push(eq(kycVerificationRequests.status, status));
      if (riskScore) conditions.push(eq(kycVerificationRequests.riskScore, riskScore));
      if (search) {
        conditions.push(
          or(
            ilike(kycVerificationRequests.subjectName, `%${search}%`),
            ilike(kycVerificationRequests.subjectEmail, `%${search}%`)
          )!
        );
      }

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const requests = await db.select().from(kycVerificationRequests)
        .where(and(...conditions))
        .orderBy(desc(kycVerificationRequests.createdAt))
        .limit(parseInt(limit))
        .offset(offset);

      const [countResult] = await db.select({ total: count() }).from(kycVerificationRequests).where(and(...conditions));

      // Attach identity profile summaries for verified requests (single batch query)
      const verifiedIds = requests.filter(r => r.status === "verified").map(r => r.id);
      const identityProfiles = verifiedIds.length > 0
        ? await db.select({
            verificationRequestId: kycVerifiedIdentityData.verificationRequestId,
            fullName: kycVerifiedIdentityData.fullName,
            dateOfBirth: kycVerifiedIdentityData.dateOfBirth,
            idTypesVerified: kycVerifiedIdentityData.idTypesVerified,
            hasGovernmentPhoto: kycVerifiedIdentityData.governmentPhotoPath,
          }).from(kycVerifiedIdentityData)
            .where(inArray(kycVerifiedIdentityData.verificationRequestId, verifiedIds))
        : [];
      const identityMap = new Map(identityProfiles.map(p => [p.verificationRequestId, {
        fullName: p.fullName,
        dateOfBirth: p.dateOfBirth,
        idTypesVerified: p.idTypesVerified,
        hasGovernmentPhoto: !!p.hasGovernmentPhoto,
      }]));

      const requestsWithIdentity = requests.map(r => ({
        ...r,
        identitySummary: identityMap.get(r.id) || null,
      }));

      res.json({ requests: requestsWithIdentity, total: countResult?.total || 0, page: parseInt(page), limit: parseInt(limit) });
    } catch (error: any) {
      console.error("[KYC] List requests error:", error);
      res.status(500).json({ message: "Failed to list verification requests" });
    }
  });

  app.get("/api/kyc-service/organisations/:id/verification-requests/:reqId", isAuthenticated, requireOrgMember(), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const reqId = parseInt(req.params.reqId);

      const [request] = await db.select().from(kycVerificationRequests)
        .where(and(eq(kycVerificationRequests.id, reqId), eq(kycVerificationRequests.orgId, orgId)));
      if (!request) return res.status(404).json({ message: "Request not found" });

      const documents = await db.select().from(kycSubmittedDocuments)
        .where(eq(kycSubmittedDocuments.verificationRequestId, reqId));

      const requirements = await db.select().from(kycDocumentRequirements)
        .where(and(
          or(eq(kycDocumentRequirements.orgId, orgId), isNull(kycDocumentRequirements.orgId)),
          eq(kycDocumentRequirements.type, request.type),
          eq(kycDocumentRequirements.isActive, true)
        ));

      let supplierProfile: KycSupplierProfile | undefined;
      let people: KycSupplierPerson[] = [];

      if (request.type === "supplier") {
        const [profile] = await db.select().from(kycSupplierProfiles)
          .where(eq(kycSupplierProfiles.verificationRequestId, reqId));
        supplierProfile = profile;

        if (profile) {
          people = await db.select().from(kycSupplierPeople)
            .where(eq(kycSupplierPeople.supplierProfileId, profile.id));
        }
      }

      const docsWithUrls = await Promise.all(documents.map(async (doc) => {
        try {
          const downloadUrl = await objectStorageService.getObjectEntityDownloadURL(doc.filePath);
          return { ...doc, downloadUrl };
        } catch {
          return { ...doc, downloadUrl: null };
        }
      }));

      // Attach verified identity profile if available (access is org-scoped)
      const identityProfile = await getIdentityProfile(reqId);
      const verifiedIdentity = identityProfile
        ? {
            fullName: identityProfile.fullName,
            dateOfBirth: identityProfile.dateOfBirth,
            phone: identityProfile.phone,
            gender: identityProfile.gender,
            address: identityProfile.address,
            idTypesVerified: identityProfile.idTypesVerified,
            dataSource: identityProfile.dataSource,
            hasGovernmentPhoto: !!identityProfile.governmentPhotoPath,
            capturedAt: identityProfile.capturedAt,
          }
        : null;

      res.json({ ...request, documents: docsWithUrls, requirements, supplierProfile, people, verifiedIdentity });
    } catch (error: any) {
      console.error("[KYC] Get request detail error:", error);
      res.status(500).json({ message: "Failed to get verification request" });
    }
  });

  app.patch("/api/kyc-service/organisations/:id/verification-requests/:reqId/review", isAuthenticated, requireOrgMember(["org_admin", "org_reviewer"]), requireActiveOrg(), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const reqId = parseInt(req.params.reqId);
      const userId = getUserId(req);

      const schema = z.object({
        action: z.enum(["approve", "reject"]),
        reviewNotes: z.string().optional(),
        documentReviews: z.array(z.object({
          documentId: z.number(),
          status: z.enum(["accepted", "rejected"]),
          reviewNote: z.string().optional(),
        })).optional(),
      });
      const data = schema.parse(req.body);

      const [request] = await db.select().from(kycVerificationRequests)
        .where(and(eq(kycVerificationRequests.id, reqId), eq(kycVerificationRequests.orgId, orgId)));
      if (!request) return res.status(404).json({ message: "Request not found" });

      if (data.documentReviews) {
        for (const review of data.documentReviews) {
          await db.update(kycSubmittedDocuments)
            .set({
              status: review.status,
              reviewNote: review.reviewNote || null,
              reviewedByUserId: userId,
              reviewedAt: new Date(),
            })
            .where(and(
              eq(kycSubmittedDocuments.id, review.documentId),
              eq(kycSubmittedDocuments.verificationRequestId, reqId)
            ));
        }
      }

      const newStatus = data.action === "approve" ? "verified" : "rejected";

      const documents = await db.select().from(kycSubmittedDocuments)
        .where(eq(kycSubmittedDocuments.verificationRequestId, reqId));
      const requirements = await db.select().from(kycDocumentRequirements)
        .where(and(
          or(eq(kycDocumentRequirements.orgId, orgId), isNull(kycDocumentRequirements.orgId)),
          eq(kycDocumentRequirements.type, request.type),
          eq(kycDocumentRequirements.isActive, true)
        ));

      let people: KycSupplierPerson[] = [];
      if (request.type === "supplier") {
        const [profile] = await db.select().from(kycSupplierProfiles)
          .where(eq(kycSupplierProfiles.verificationRequestId, reqId));
        if (profile) {
          people = await db.select().from(kycSupplierPeople).where(eq(kycSupplierPeople.supplierProfileId, profile.id));
        }
      }

      const riskScore = calculateRiskScore(documents, requirements, people);

      const reviewedAt = new Date();

      // Generate certificate reference and data snapshot on approval
      let certificateRef: string | null = null;
      let verifiedDataSnapshot: KycVerifiedSnapshot | null = null;
      if (newStatus === "verified") {
        const year = reviewedAt.getFullYear();
        const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        certificateRef = `CO-KYC-${year}-${suffix}`;

        const acceptedDocObjs = documents.filter(d => d.status === "accepted");

        // Parse Smile ID / session pipeline results stored in request notes
        let parsedNotes: Record<string, any> = {};
        try {
          if (request.notes) {
            parsedNotes = typeof request.notes === "string" ? JSON.parse(request.notes) : (request.notes as any);
          }
        } catch { /* ignore parse errors */ }

        const faceVerification = parsedNotes.faceVerification as { matched?: boolean; confidence?: number; documentVerified?: boolean } | undefined;
        const amlNotes = parsedNotes.aml as { isHit?: boolean; hitTypes?: string[] } | undefined;

        const biometricVerified = faceVerification?.matched === true;
        const faceMatchConfidence = faceVerification?.confidence ?? undefined;
        const amlScreened = !!amlNotes;
        const amlClear = amlNotes ? !amlNotes.isHit : undefined;

        verifiedDataSnapshot = {
          verificationType: request.type as "individual" | "supplier",
          riskScore: riskScore as "green" | "amber" | "red",
          verificationMethod: biometricVerified ? "biometric_document_review" : "document_review",
          dataSource: "cellionone_kyc_review",
          verifiedAt: reviewedAt.toISOString(),
          documentsVerified: acceptedDocObjs.map(d => {
            const req = requirements.find(r => r.id === d.requirementId);
            const extracted = d.extractedData as Record<string, any> | null;
            const expiryDate = d.expiryDate ? new Date(d.expiryDate) : null;
            return {
              documentName: req?.documentName || d.detectedDocumentType || "Unknown Document",
              documentCategory: req?.documentCategory || "identity",
              documentType: d.detectedDocumentType || req?.documentCategory || "unknown",
              status: "accepted" as const,
              ...(extracted?.name ? { extractedName: String(extracted.name) } : {}),
              ...(extracted?.dateOfBirth || extracted?.dob ? { extractedDateOfBirth: String(extracted.dateOfBirth || extracted.dob) } : {}),
              documentValidity: expiryDate
                ? (expiryDate < new Date() ? "expired" as const : "valid" as const)
                : ("unknown" as const),
            };
          }),
          documentCount: acceptedDocObjs.length,
          biometricVerified,
          livenessConfirmed: biometricVerified, // liveness is confirmed when face comparison succeeds (selfie was live)
          ...(faceMatchConfidence !== undefined ? { faceMatchConfidence } : {}),
          amlScreened,
          ...(amlClear !== undefined ? { amlClear } : {}),
        };
      }

      const [updated] = await db.update(kycVerificationRequests)
        .set({
          status: newStatus,
          reviewedByUserId: userId,
          reviewedAt,
          reviewNotes: data.reviewNotes || null,
          riskScore,
          ...(certificateRef ? { certificateRef, verifiedDataSnapshot } : {}),
          updatedAt: new Date(),
        })
        .where(eq(kycVerificationRequests.id, reqId))
        .returning();

      const [org] = await db.select().from(kycOrganisations).where(eq(kycOrganisations.id, orgId));
      const statusLabel = data.action === "approve" ? "approved" : "requires attention";
      await sendKycEmail(request.subjectEmail,
        data.action === "approve"
          ? `Your verification has been approved by ${org?.name || "the organisation"}`
          : `Your verification for ${org?.name || "the organisation"} requires attention`,
        `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:${data.action === "approve" ? "#0d9668" : "#dc2626"};">Verification ${data.action === "approve" ? "Approved" : "Needs Attention"}</h2>
          <p>Your verification with <strong>${org?.name || "the organisation"}</strong> has been ${statusLabel}.</p>
          ${data.reviewNotes ? `<p><strong>Reviewer notes:</strong> ${data.reviewNotes}</p>` : ""}
        </div>`
      );

      const baseUrl = process.env.NODE_ENV === "production"
        ? "https://cellionone.com"
        : `http://localhost:${process.env.PORT || 5000}`;

      // Build identity summary from accepted documents and notes
      let capturedFullName: string | null = null;
      let capturedDob: string | null = null;
      let capturedPhone: string | null = null;
      let capturedGender: string | null = null;
      let capturedAddress: string | null = null;
      const idTypesVerified: string[] = [];

      let approvalSmileIdOutcome: SmileIdLookupOutcome | null = null;

      if (newStatus === "verified") {
        const identityDocs = documents.filter(d => d.status === "accepted");
        for (const doc of identityDocs) {
          const rawExt = doc.extractedData;
          const ext = (rawExt && typeof rawExt === "object" && !Array.isArray(rawExt))
            ? (rawExt as Record<string, unknown>)
            : null;
          if (ext) {
            const sv = (v: unknown) => (v ? String(v) : undefined);
            if (!capturedFullName && (ext.name || ext.fullName)) capturedFullName = sv(ext.name ?? ext.fullName) || null;
            if (!capturedDob && (ext.dateOfBirth || ext.dob || ext.DOB)) capturedDob = sv(ext.dateOfBirth ?? ext.dob ?? ext.DOB) || null;
            if (!capturedPhone && (ext.phone || ext.phoneNumber || ext.PhoneNumber)) capturedPhone = sv(ext.phone ?? ext.phoneNumber ?? ext.PhoneNumber) || null;
            if (!capturedGender && (ext.gender || ext.Gender)) capturedGender = sv(ext.gender ?? ext.Gender) || null;
            if (!capturedAddress && (ext.address || ext.Address)) capturedAddress = sv(ext.address ?? ext.Address) || null;
          }
          if (doc.detectedDocumentType) idTypesVerified.push(doc.detectedDocumentType);
        }
        if (!capturedFullName) capturedFullName = request.subjectName || null;
        if (!capturedDob && parsedNotes.dateOfBirth) capturedDob = String(parsedNotes.dateOfBirth);
        if (!capturedPhone && parsedNotes.phoneNumber) capturedPhone = String(parsedNotes.phoneNumber);
        if (!capturedGender && parsedNotes.gender) capturedGender = String(parsedNotes.gender);
        if (!capturedAddress && parsedNotes.address) capturedAddress = String(parsedNotes.address);

        // Attempt Smile ID lookup to get canonical government identity data and photo.
        // Smile ID data takes precedence over extracted document data where it differs.
        try {
          approvalSmileIdOutcome = await attemptSmileIdLookupForApproval(identityDocs, orgId);
          if (approvalSmileIdOutcome?.result.verified) {
            const r = approvalSmileIdOutcome.result;
            if (r.fullName) capturedFullName = r.fullName;
            if (r.dob) capturedDob = r.dob;
            if (r.phone) capturedPhone = r.phone;
            if (r.gender) capturedGender = r.gender;
            if (r.address) capturedAddress = r.address;
            if (approvalSmileIdOutcome.smileIdType && !idTypesVerified.includes(approvalSmileIdOutcome.smileIdType)) {
              idTypesVerified.push(approvalSmileIdOutcome.smileIdType);
            }
          }
        } catch (smileErr) {
          console.warn("[KYC Review] Smile ID lookup during approval failed (non-blocking):", smileErr);
          approvalSmileIdOutcome = null;
        }
      }

      // Upsert verified entity registry FIRST (awaited) so the row exists before enrichment
      if (newStatus === "verified") {
        try {
          await upsertVerifiedEntity({
            request: updated,
            orgId,
            riskScore,
            amlScreeningStatus: null,
          });
        } catch (entityErr) {
          console.error("[VerifiedEntity] Upsert error (non-blocking):", entityErr);
        }
      }

      // Capture identity profile AFTER entity upsert so enrichVerifiedEntityRegistry can update the existing row.
      // Use Smile ID government photo base64 when available (canonical source); fall back to document-review label.
      const captureDataSource = approvalSmileIdOutcome?.dataSource ?? "document_review";
      const capturePhotoBase64 = (approvalSmileIdOutcome?.result.verified && approvalSmileIdOutcome.result.photo)
        ? approvalSmileIdOutcome.result.photo
        : null;

      let capturedIdentityProfile: (typeof kycVerifiedIdentityData.$inferSelect) | null = null;
      if (newStatus === "verified") {
        await captureVerifiedIdentityProfile({
          verificationRequestId: reqId,
          orgId,
          fullName: capturedFullName,
          dateOfBirth: capturedDob,
          phone: capturedPhone,
          gender: capturedGender,
          address: capturedAddress,
          idTypesVerified: idTypesVerified.length ? idTypesVerified : undefined,
          dataSource: captureDataSource,
          governmentPhotoBase64: capturePhotoBase64,
        }).catch(err => console.error("[IdentityProfile] Capture error:", err));
        // Fetch back for hasGovernmentPhoto / capturedAt
        const [idp] = await db.select().from(kycVerifiedIdentityData)
          .where(eq(kycVerifiedIdentityData.verificationRequestId, reqId));
        capturedIdentityProfile = idp || null;
      }

      const webhookPayload: Record<string, any> = {
        requestId: reqId,
        type: request.type,
        status: newStatus,
        riskScore,
        subjectName: request.subjectName,
        subjectEmail: request.subjectEmail,
        reviewedAt: reviewedAt.toISOString(),
      };
      if (certificateRef) {
        webhookPayload.certificateRef = certificateRef;
        webhookPayload.certificateUrl = `${baseUrl}/api/v1/kyc/attest/${certificateRef}`;
      }
      // Source verifiedIdentity from the persisted profile so webhook payload matches GET response exactly
      if (newStatus === "verified" && (capturedIdentityProfile || capturedFullName)) {
        webhookPayload.verifiedIdentity = {
          fullName: capturedIdentityProfile?.fullName ?? capturedFullName ?? null,
          dateOfBirth: capturedIdentityProfile?.dateOfBirth ?? capturedDob ?? null,
          phone: capturedIdentityProfile?.phone ?? capturedPhone ?? null,
          gender: capturedIdentityProfile?.gender ?? capturedGender ?? null,
          address: capturedIdentityProfile?.address ?? capturedAddress ?? null,
          idTypesVerified: capturedIdentityProfile?.idTypesVerified ?? (idTypesVerified.length ? idTypesVerified : []),
          dataSource: capturedIdentityProfile?.dataSource ?? captureDataSource,
          hasGovernmentPhoto: !!capturedIdentityProfile?.governmentPhotoPath,
          capturedAt: capturedIdentityProfile?.capturedAt?.toISOString() ?? null,
        };
      }

      webhookService.deliverWebhook(orgId,
        newStatus === "verified" ? "verification.completed" : "verification.failed",
        webhookPayload
      ).catch(err => console.error("[KYC Webhook] Delivery error:", err));

      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC] Review request error:", error);
      res.status(500).json({ message: "Failed to review request" });
    }
  });

  app.post("/api/kyc-service/organisations/:id/verification-requests/:reqId/resend-invite", isAuthenticated, requireOrgMember(["org_admin", "org_reviewer"]), requireActiveOrg(), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const reqId = parseInt(req.params.reqId);

      const [request] = await db.select().from(kycVerificationRequests)
        .where(and(eq(kycVerificationRequests.id, reqId), eq(kycVerificationRequests.orgId, orgId)));
      if (!request) return res.status(404).json({ message: "Request not found" });

      const [org] = await db.select().from(kycOrganisations).where(eq(kycOrganisations.id, orgId));
      const baseUrl = `${req.protocol}://${req.get("host")}`;

      await sendKycEmail(request.subjectEmail, `Reminder: ${org?.name || "An organisation"} needs you to complete verification`,
        `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#0d9668;">Verification Reminder</h2>
          <p><strong>${org?.name || "An organisation"}</strong> is waiting for you to complete your verification on Cellion One.</p>
          <a href="${baseUrl}/kyc/verify/${request.inviteToken}" style="display:inline-block;padding:12px 24px;background:#0d9668;color:white;text-decoration:none;border-radius:6px;margin:16px 0;">Complete Verification</a>
        </div>`
      );

      res.json({ message: "Invite resent" });
    } catch (error: any) {
      console.error("[KYC] Resend invite error:", error);
      res.status(500).json({ message: "Failed to resend invite" });
    }
  });

  // ==================== SUBJECT-FACING ENDPOINTS ====================

  app.get("/api/kyc-service/verify-request/:token", async (req: any, res: Response) => {
    try {
      const [request] = await db.select().from(kycVerificationRequests)
        .where(eq(kycVerificationRequests.inviteToken, req.params.token));
      if (!request) return res.status(404).json({ message: "Verification request not found" });

      if (new Date(request.expiresAt) < new Date()) {
        return res.status(410).json({ message: "This verification request has expired" });
      }

      const [org] = await db.select().from(kycOrganisations).where(eq(kycOrganisations.id, request.orgId));

      const requirements = await db.select().from(kycDocumentRequirements)
        .where(and(
          or(eq(kycDocumentRequirements.orgId, request.orgId), isNull(kycDocumentRequirements.orgId)),
          eq(kycDocumentRequirements.type, request.type),
          eq(kycDocumentRequirements.isActive, true)
        ));

      const documents = await db.select().from(kycSubmittedDocuments)
        .where(eq(kycSubmittedDocuments.verificationRequestId, request.id));

      let supplierProfile: KycSupplierProfile | undefined;
      let people: KycSupplierPerson[] = [];

      if (request.type === "supplier") {
        const [profile] = await db.select().from(kycSupplierProfiles)
          .where(eq(kycSupplierProfiles.verificationRequestId, request.id));
        supplierProfile = profile;
        if (profile) {
          people = await db.select().from(kycSupplierPeople)
            .where(eq(kycSupplierPeople.supplierProfileId, profile.id));
        }
      }

      res.json({
        request: {
          id: request.id,
          type: request.type,
          status: request.status,
          subjectName: request.subjectName,
          subjectEmail: request.subjectEmail,
          paymentResponsibility: request.paymentResponsibility,
          paymentStatus: request.paymentStatus,
          termsAcceptedAt: request.termsAcceptedAt,
          expiresAt: request.expiresAt,
          selfRegistered: request.selfRegistered,
        },
        organisation: org ? {
          id: org.id,
          name: org.name,
          logoPath: org.logoPath,
          contactEmail: org.contactEmail,
        } : null,
        requirements,
        documents,
        supplierProfile,
        people,
      });
    } catch (error: any) {
      console.error("[KYC] Get verify request error:", error);
      res.status(500).json({ message: "Failed to get verification request" });
    }
  });

  app.post("/api/kyc-service/verify-request/:token/accept", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const schema = z.object({
        termsAccepted: z.literal(true, { errorMap: () => ({ message: "You must accept the Verification Consent & Terms" }) }),
      });
      schema.parse(req.body);

      const [request] = await db.select().from(kycVerificationRequests)
        .where(eq(kycVerificationRequests.inviteToken, req.params.token));
      if (!request) return res.status(404).json({ message: "Verification request not found" });

      if (new Date(request.expiresAt) < new Date()) {
        return res.status(410).json({ message: "This verification request has expired" });
      }

      if (request.subjectUserId && request.subjectUserId !== userId) {
        return res.status(403).json({ message: "This request is linked to a different user" });
      }

      const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "unknown";

      const newStatus = request.paymentStatus === "pending" ? "pending_payment" : "in_progress";

      const [updated] = await db.update(kycVerificationRequests)
        .set({
          subjectUserId: userId,
          status: newStatus,
          termsAcceptedAt: new Date(),
          termsVersion: TERMS_VERSION,
          termsAcceptedIp: clientIp,
          updatedAt: new Date(),
        })
        .where(eq(kycVerificationRequests.id, request.id))
        .returning();

      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC] Accept request error:", error);
      res.status(500).json({ message: "Failed to accept request" });
    }
  });

  app.post("/api/kyc-service/verify-request/:token/supplier-profile", async (req: any, res: Response) => {
    try {
      const [request] = await db.select().from(kycVerificationRequests)
        .where(eq(kycVerificationRequests.inviteToken, req.params.token));
      if (!request) return res.status(404).json({ message: "Request not found" });
      if (request.type !== "supplier") return res.status(400).json({ message: "Not a supplier verification" });
      if (!request.termsAcceptedAt) return res.status(403).json({ message: "Terms must be accepted first" });

      const schema = z.object({
        companyName: z.string().min(1).max(255),
        rcNumber: z.string().optional(),
        tinNumber: z.string().optional(),
        vatRegistered: z.boolean().default(false),
        yearEstablished: z.number().optional(),
        industryCategory: z.string().optional(),
        headOfficeAddress: z.string().optional(),
        websiteUrl: z.string().optional(),
        contactPersonName: z.string().min(1).max(255),
        contactPersonEmail: z.string().email(),
        contactPersonPhone: z.string().optional(),
        contactPersonRole: z.string().optional(),
        bankName: z.string().optional(),
        bankAccountNumber: z.string().optional(),
        bankAccountName: z.string().optional(),
      });
      const data = schema.parse(req.body);

      const [existing] = await db.select().from(kycSupplierProfiles)
        .where(eq(kycSupplierProfiles.verificationRequestId, request.id));

      let profile: KycSupplierProfile;
      if (existing) {
        const [updated] = await db.update(kycSupplierProfiles)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(kycSupplierProfiles.id, existing.id))
          .returning();
        profile = updated;
      } else {
        const [created] = await db.insert(kycSupplierProfiles)
          .values({ verificationRequestId: request.id, ...data })
          .returning();
        profile = created;
      }

      res.json(profile);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC] Supplier profile error:", error);
      res.status(500).json({ message: "Failed to save supplier profile" });
    }
  });

  app.post("/api/kyc-service/verify-request/:token/documents", async (req: any, res: Response) => {
    try {
      const [request] = await db.select().from(kycVerificationRequests)
        .where(eq(kycVerificationRequests.inviteToken, req.params.token));
      if (!request) return res.status(404).json({ message: "Request not found" });
      if (!request.termsAcceptedAt) return res.status(403).json({ message: "Terms must be accepted first" });

      const schema = z.object({
        requirementId: z.number(),
        fileName: z.string().min(1),
        filePath: z.string().min(1),
        fileSize: z.number().optional(),
        mimeType: z.string().optional(),
        expiryDate: z.string().optional(),
      });
      const data = schema.parse(req.body);

      const [requirement] = await db.select().from(kycDocumentRequirements)
        .where(eq(kycDocumentRequirements.id, data.requirementId));
      if (!requirement) return res.status(404).json({ message: "Document requirement not found" });

      const [doc] = await db.insert(kycSubmittedDocuments).values({
        verificationRequestId: request.id,
        requirementId: data.requirementId,
        fileName: data.fileName,
        filePath: data.filePath,
        fileSize: data.fileSize || null,
        mimeType: data.mimeType || null,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        status: "uploaded",
      }).returning();

      // Trigger async extraction
      try {
        const { processDocumentExtraction } = await import("../services/documentExtractionService");
        processDocumentExtraction(doc.id).catch(err =>
          console.error("[KYC] Background extraction failed for doc", doc.id, err)
        );
      } catch (err) {
        console.error("[KYC] Could not start extraction:", err);
      }

      // Update request status
      if (request.status === "pending_invite" || request.status === "in_progress") {
        await db.update(kycVerificationRequests)
          .set({ status: "in_progress", updatedAt: new Date() })
          .where(eq(kycVerificationRequests.id, request.id));
      }

      // Notify org reviewers
      const [org] = await db.select().from(kycOrganisations).where(eq(kycOrganisations.id, request.orgId));
      const reviewers = await db.select().from(kycOrgMembers)
        .where(and(
          eq(kycOrgMembers.orgId, request.orgId),
          eq(kycOrgMembers.inviteStatus, "accepted"),
          or(eq(kycOrgMembers.role, "org_admin"), eq(kycOrgMembers.role, "org_reviewer"))
        ));

      for (const reviewer of reviewers) {
        if (reviewer.inviteEmail) {
          await sendKycEmail(reviewer.inviteEmail,
            `New document uploaded: ${request.subjectName}`,
            `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
              <h2 style="color:#0d9668;">New Document Uploaded</h2>
              <p><strong>${request.subjectName}</strong> has uploaded a new document: <strong>${data.fileName}</strong> for their ${request.type} verification.</p>
            </div>`
          );
        }
      }

      res.status(201).json(doc);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC] Upload document error:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  app.post("/api/kyc-service/verify-request/:token/documents/:docId/confirm-extraction", async (req: any, res: Response) => {
    try {
      const docId = parseInt(req.params.docId);
      const [request] = await db.select().from(kycVerificationRequests)
        .where(eq(kycVerificationRequests.inviteToken, req.params.token));
      if (!request) return res.status(404).json({ message: "Request not found" });

      const [doc] = await db.select().from(kycSubmittedDocuments)
        .where(and(eq(kycSubmittedDocuments.id, docId), eq(kycSubmittedDocuments.verificationRequestId, request.id)));
      if (!doc) return res.status(404).json({ message: "Document not found" });

      const [updated] = await db.update(kycSubmittedDocuments)
        .set({ extractionConfirmed: true })
        .where(eq(kycSubmittedDocuments.id, docId))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("[KYC] Confirm extraction error:", error);
      res.status(500).json({ message: "Failed to confirm extraction" });
    }
  });

  app.delete("/api/kyc-service/verify-request/:token/documents/:docId", async (req: any, res: Response) => {
    try {
      const docId = parseInt(req.params.docId);
      const [request] = await db.select().from(kycVerificationRequests)
        .where(eq(kycVerificationRequests.inviteToken, req.params.token));
      if (!request) return res.status(404).json({ message: "Request not found" });

      const [doc] = await db.select().from(kycSubmittedDocuments)
        .where(and(eq(kycSubmittedDocuments.id, docId), eq(kycSubmittedDocuments.verificationRequestId, request.id)));
      if (!doc) return res.status(404).json({ message: "Document not found" });

      await db.delete(kycSubmittedDocuments).where(eq(kycSubmittedDocuments.id, docId));
      res.json({ message: "Document deleted" });
    } catch (error: any) {
      console.error("[KYC] Delete document error:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  app.post("/api/kyc-service/verify-request/:token/submit", async (req: any, res: Response) => {
    try {
      const [request] = await db.select().from(kycVerificationRequests)
        .where(eq(kycVerificationRequests.inviteToken, req.params.token));
      if (!request) return res.status(404).json({ message: "Request not found" });
      if (!request.termsAcceptedAt) return res.status(403).json({ message: "Terms must be accepted first" });

      if (request.paymentResponsibility === "subject" && request.paymentStatus !== "paid") {
        return res.status(400).json({ message: "Payment is required before submission" });
      }

      const requirements = await db.select().from(kycDocumentRequirements)
        .where(and(
          or(eq(kycDocumentRequirements.orgId, request.orgId), isNull(kycDocumentRequirements.orgId)),
          eq(kycDocumentRequirements.type, request.type),
          eq(kycDocumentRequirements.isActive, true),
          eq(kycDocumentRequirements.isMandatory, true)
        ));

      const documents = await db.select().from(kycSubmittedDocuments)
        .where(eq(kycSubmittedDocuments.verificationRequestId, request.id));

      const mandatoryReqIds = requirements.map(r => r.id);
      const submittedReqIds = new Set(documents.map(d => d.requirementId));
      const missing = mandatoryReqIds.filter(id => !submittedReqIds.has(id));

      if (missing.length > 0) {
        const missingNames = requirements.filter(r => missing.includes(r.id)).map(r => r.documentName);
        return res.status(400).json({
          message: "Missing mandatory documents",
          missingDocuments: missingNames,
        });
      }

      if (request.type === "supplier") {
        const [profile] = await db.select().from(kycSupplierProfiles)
          .where(eq(kycSupplierProfiles.verificationRequestId, request.id));
        if (!profile) {
          return res.status(400).json({ message: "Supplier profile must be completed before submission" });
        }
      }

      const allRequirements = await db.select().from(kycDocumentRequirements)
        .where(and(
          or(eq(kycDocumentRequirements.orgId, request.orgId), isNull(kycDocumentRequirements.orgId)),
          eq(kycDocumentRequirements.type, request.type),
          eq(kycDocumentRequirements.isActive, true)
        ));

      let people: KycSupplierPerson[] = [];
      if (request.type === "supplier") {
        const [profile] = await db.select().from(kycSupplierProfiles)
          .where(eq(kycSupplierProfiles.verificationRequestId, request.id));
        if (profile) {
          people = await db.select().from(kycSupplierPeople).where(eq(kycSupplierPeople.supplierProfileId, profile.id));
        }
      }

      const riskScore = calculateRiskScore(documents, allRequirements, people);

      const [updated] = await db.update(kycVerificationRequests)
        .set({ status: "documents_submitted", riskScore, updatedAt: new Date() })
        .where(eq(kycVerificationRequests.id, request.id))
        .returning();

      const [org] = await db.select().from(kycOrganisations).where(eq(kycOrganisations.id, request.orgId));
      const reviewers = await db.select().from(kycOrgMembers)
        .where(and(
          eq(kycOrgMembers.orgId, request.orgId),
          eq(kycOrgMembers.inviteStatus, "accepted"),
          or(eq(kycOrgMembers.role, "org_admin"), eq(kycOrgMembers.role, "org_reviewer"))
        ));

      for (const reviewer of reviewers) {
        if (reviewer.inviteEmail) {
          await sendKycEmail(reviewer.inviteEmail,
            `${request.subjectName} has submitted all documents and is ready for review`,
            `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
              <h2 style="color:#0d9668;">Ready for Review</h2>
              <p><strong>${request.subjectName}</strong> has submitted all required documents for their ${request.type} verification and is ready for your review.</p>
            </div>`
          );
        }
      }

      res.json(updated);
    } catch (error: any) {
      console.error("[KYC] Submit request error:", error);
      res.status(500).json({ message: "Failed to submit verification" });
    }
  });

  // ---- Supplier People ----

  app.get("/api/kyc-service/verify-request/:token/people", async (req: any, res: Response) => {
    try {
      const [request] = await db.select().from(kycVerificationRequests)
        .where(eq(kycVerificationRequests.inviteToken, req.params.token));
      if (!request) return res.status(404).json({ message: "Request not found" });

      const [profile] = await db.select().from(kycSupplierProfiles)
        .where(eq(kycSupplierProfiles.verificationRequestId, request.id));
      if (!profile) return res.json([]);

      const people = await db.select().from(kycSupplierPeople)
        .where(eq(kycSupplierPeople.supplierProfileId, profile.id));
      res.json(people);
    } catch (error: any) {
      console.error("[KYC] List people error:", error);
      res.status(500).json({ message: "Failed to list people" });
    }
  });

  app.post("/api/kyc-service/verify-request/:token/people", async (req: any, res: Response) => {
    try {
      const [request] = await db.select().from(kycVerificationRequests)
        .where(eq(kycVerificationRequests.inviteToken, req.params.token));
      if (!request) return res.status(404).json({ message: "Request not found" });
      if (request.type !== "supplier") return res.status(400).json({ message: "Only supplier verifications have people" });
      if (!request.termsAcceptedAt) return res.status(403).json({ message: "Terms must be accepted first" });

      const [profile] = await db.select().from(kycSupplierProfiles)
        .where(eq(kycSupplierProfiles.verificationRequestId, request.id));
      if (!profile) return res.status(400).json({ message: "Create supplier profile first" });

      const schema = z.object({
        fullName: z.string().min(1).max(255),
        email: z.string().email(),
        role: z.enum(["director", "shareholder", "signatory", "beneficial_owner"]),
        requiresVerification: z.boolean().default(false),
      });
      const data = schema.parse(req.body);

      const [person] = await db.insert(kycSupplierPeople).values({
        supplierProfileId: profile.id,
        verificationRequestId: request.id,
        fullName: data.fullName,
        email: data.email,
        role: data.role,
        requiresVerification: data.requiresVerification,
        verificationStatus: data.requiresVerification ? "pending" : "not_required",
      }).returning();

      res.status(201).json(person);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC] Add person error:", error);
      res.status(500).json({ message: "Failed to add person" });
    }
  });

  app.delete("/api/kyc-service/verify-request/:token/people/:personId", async (req: any, res: Response) => {
    try {
      const personId = parseInt(req.params.personId);
      const [request] = await db.select().from(kycVerificationRequests)
        .where(eq(kycVerificationRequests.inviteToken, req.params.token));
      if (!request) return res.status(404).json({ message: "Request not found" });

      await db.delete(kycSupplierPeople).where(and(
        eq(kycSupplierPeople.id, personId),
        eq(kycSupplierPeople.verificationRequestId, request.id)
      ));
      res.json({ message: "Person removed" });
    } catch (error: any) {
      console.error("[KYC] Delete person error:", error);
      res.status(500).json({ message: "Failed to remove person" });
    }
  });

  app.post("/api/kyc-service/verify-request/:token/people/:personId/send-verification", async (req: any, res: Response) => {
    try {
      const personId = parseInt(req.params.personId);
      const [request] = await db.select().from(kycVerificationRequests)
        .where(eq(kycVerificationRequests.inviteToken, req.params.token));
      if (!request) return res.status(404).json({ message: "Request not found" });

      const [person] = await db.select().from(kycSupplierPeople)
        .where(and(eq(kycSupplierPeople.id, personId), eq(kycSupplierPeople.verificationRequestId, request.id)));
      if (!person) return res.status(404).json({ message: "Person not found" });

      if (person.individualRequestId) {
        return res.status(400).json({ message: "Verification already sent for this person" });
      }

      const [org] = await db.select().from(kycOrganisations).where(eq(kycOrganisations.id, request.orgId));

      const directorInviteToken = generateToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const [individualRequest] = await db.insert(kycVerificationRequests).values({
        orgId: request.orgId,
        requestedByUserId: request.requestedByUserId,
        type: "individual",
        status: "pending_invite",
        subjectEmail: person.email,
        subjectName: person.fullName,
        paymentResponsibility: request.paymentResponsibility,
        paymentStatus: request.paymentResponsibility === "organisation" ? "not_required" : "pending",
        inviteToken: directorInviteToken,
        expiresAt,
      }).returning();

      await db.update(kycSupplierPeople)
        .set({
          individualRequestId: individualRequest.id,
          verificationStatus: "in_progress",
          inviteToken: directorInviteToken,
          inviteSentAt: new Date(),
        })
        .where(eq(kycSupplierPeople.id, personId));

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      await sendKycEmail(person.email,
        `${org?.name || "An organisation"} requires you to verify your identity`,
        `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#0d9668;">Director Verification Required</h2>
          <p>You have been listed as a <strong>${person.role}</strong> of a company undergoing verification with <strong>${org?.name || "an organisation"}</strong>.</p>
          <p>Please complete your individual identity verification by clicking the link below.</p>
          <a href="${baseUrl}/kyc/verify/${directorInviteToken}" style="display:inline-block;padding:12px 24px;background:#0d9668;color:white;text-decoration:none;border-radius:6px;margin:16px 0;">Verify Your Identity</a>
        </div>`
      );

      res.json({ message: "Verification sent", individualRequestId: individualRequest.id });
    } catch (error: any) {
      console.error("[KYC] Send person verification error:", error);
      res.status(500).json({ message: "Failed to send verification" });
    }
  });

  // ==================== SELF-REGISTRATION PORTALS ====================

  app.get("/api/kyc-service/portal/:slug/employees", async (req: any, res: Response) => {
    try {
      const [org] = await db.select().from(kycOrganisations)
        .where(and(eq(kycOrganisations.slug, req.params.slug), eq(kycOrganisations.status, "active")));
      if (!org) return res.status(404).json({ message: "Organisation not found" });
      if (!org.employeePortalEnabled) return res.status(403).json({ message: "Employee portal is not enabled" });

      const requirements = await db.select().from(kycDocumentRequirements)
        .where(and(
          or(eq(kycDocumentRequirements.orgId, org.id), isNull(kycDocumentRequirements.orgId)),
          eq(kycDocumentRequirements.type, "individual"),
          eq(kycDocumentRequirements.isActive, true)
        ));

      res.json({
        organisation: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          logoPath: org.logoPath,
          contactEmail: org.contactEmail,
        },
        requirements,
      });
    } catch (error: any) {
      console.error("[KYC] Employee portal error:", error);
      res.status(500).json({ message: "Failed to load employee portal" });
    }
  });

  app.post("/api/kyc-service/portal/:slug/employees", async (req: any, res: Response) => {
    try {
      const [org] = await db.select().from(kycOrganisations)
        .where(and(eq(kycOrganisations.slug, req.params.slug), eq(kycOrganisations.status, "active")));
      if (!org) return res.status(404).json({ message: "Organisation not found" });
      if (!org.employeePortalEnabled) return res.status(403).json({ message: "Employee portal is not enabled" });

      const schema = z.object({
        name: z.string().min(1).max(255),
        email: z.string().email(),
      });
      const data = schema.parse(req.body);

      const settings = (org.settings as any) || {};
      const paymentResponsibility = settings.defaultPaymentResponsibility || "organisation";
      const expiresInDays = settings.defaultExpiryDays || 30;

      const inviteToken = generateToken();
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

      const [request] = await db.insert(kycVerificationRequests).values({
        orgId: org.id,
        type: "individual",
        status: "pending_invite",
        subjectEmail: data.email,
        subjectName: data.name,
        paymentResponsibility,
        paymentStatus: paymentResponsibility === "organisation" ? "not_required" : "pending",
        inviteToken,
        selfRegistered: true,
        expiresAt,
      }).returning();

      await sendKycEmail(data.email,
        `Your verification request for ${org.name} has been received`,
        `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#0d9668;">Verification Request Received</h2>
          <p>Your verification request for <strong>${org.name}</strong> has been received. Please click below to begin.</p>
          <a href="${req.protocol}://${req.get("host")}/kyc/verify/${inviteToken}" style="display:inline-block;padding:12px 24px;background:#0d9668;color:white;text-decoration:none;border-radius:6px;margin:16px 0;">Begin Verification</a>
        </div>`
      );

      res.status(201).json({ inviteToken, requestId: request.id });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC] Employee self-register error:", error);
      res.status(500).json({ message: "Failed to register" });
    }
  });

  app.get("/api/kyc-service/portal/:slug/suppliers", async (req: any, res: Response) => {
    try {
      const [org] = await db.select().from(kycOrganisations)
        .where(and(eq(kycOrganisations.slug, req.params.slug), eq(kycOrganisations.status, "active")));
      if (!org) return res.status(404).json({ message: "Organisation not found" });
      if (!org.supplierPortalEnabled) return res.status(403).json({ message: "Supplier portal is not enabled" });

      const requirements = await db.select().from(kycDocumentRequirements)
        .where(and(
          or(eq(kycDocumentRequirements.orgId, org.id), isNull(kycDocumentRequirements.orgId)),
          eq(kycDocumentRequirements.type, "supplier"),
          eq(kycDocumentRequirements.isActive, true)
        ));

      res.json({
        organisation: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          logoPath: org.logoPath,
          contactEmail: org.contactEmail,
        },
        requirements,
      });
    } catch (error: any) {
      console.error("[KYC] Supplier portal error:", error);
      res.status(500).json({ message: "Failed to load supplier portal" });
    }
  });

  app.post("/api/kyc-service/portal/:slug/suppliers", async (req: any, res: Response) => {
    try {
      const [org] = await db.select().from(kycOrganisations)
        .where(and(eq(kycOrganisations.slug, req.params.slug), eq(kycOrganisations.status, "active")));
      if (!org) return res.status(404).json({ message: "Organisation not found" });
      if (!org.supplierPortalEnabled) return res.status(403).json({ message: "Supplier portal is not enabled" });

      const schema = z.object({
        companyName: z.string().min(1).max(255),
        contactName: z.string().min(1).max(255),
        contactEmail: z.string().email(),
      });
      const data = schema.parse(req.body);

      const settings = (org.settings as any) || {};
      const paymentResponsibility = settings.defaultPaymentResponsibility || "organisation";
      const expiresInDays = settings.defaultExpiryDays || 30;

      const inviteToken = generateToken();
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

      const [request] = await db.insert(kycVerificationRequests).values({
        orgId: org.id,
        type: "supplier",
        status: "pending_invite",
        subjectEmail: data.contactEmail,
        subjectName: data.companyName,
        paymentResponsibility,
        paymentStatus: paymentResponsibility === "organisation" ? "not_required" : "pending",
        inviteToken,
        selfRegistered: true,
        expiresAt,
      }).returning();

      await sendKycEmail(data.contactEmail,
        `Your verification request for ${org.name} has been received`,
        `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#0d9668;">Supplier Verification Request Received</h2>
          <p>Your supplier verification request for <strong>${org.name}</strong> has been received. Please click below to begin.</p>
          <a href="${req.protocol}://${req.get("host")}/kyc/verify/${inviteToken}" style="display:inline-block;padding:12px 24px;background:#0d9668;color:white;text-decoration:none;border-radius:6px;margin:16px 0;">Begin Verification</a>
        </div>`
      );

      res.status(201).json({ inviteToken, requestId: request.id });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC] Supplier self-register error:", error);
      res.status(500).json({ message: "Failed to register" });
    }
  });

  // ==================== PAYMENT ENDPOINTS ====================

  app.post("/api/kyc-service/verify-request/:token/initialize-payment", async (req: any, res: Response) => {
    try {
      const [request] = await db.select().from(kycVerificationRequests)
        .where(eq(kycVerificationRequests.inviteToken, req.params.token));
      if (!request) return res.status(404).json({ message: "Request not found" });

      if (request.paymentResponsibility !== "subject") {
        return res.status(400).json({ message: "Payment is not required from the subject" });
      }
      if (request.paymentStatus === "paid") {
        return res.status(400).json({ message: "Payment already completed" });
      }

      const sku = request.type === "individual" ? "kyc_individual" : "kyc_corporate";
      const priceEntry = getPaystackPrice(sku as any);
      if (!priceEntry) return res.status(500).json({ message: "Price configuration not found" });

      const paystackSecret = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_TEST_SECRET_KEY;
      if (!paystackSecret) return res.status(500).json({ message: "Payment not configured" });

      const reference = `kyc_${request.id}_${Date.now()}`;
      const baseUrl = `${req.protocol}://${req.get("host")}`;

      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: request.subjectEmail,
          amount: priceEntry.amount,
          reference,
          callback_url: `${baseUrl}/kyc/verify/${request.inviteToken}?payment=success`,
          metadata: {
            type: "kyc_verification",
            verificationRequestId: request.id,
            verificationType: request.type,
            sku,
          },
        }),
      });

      const result = await response.json() as any;
      if (!result.status) {
        return res.status(500).json({ message: "Failed to initialize payment" });
      }

      await db.update(kycVerificationRequests)
        .set({ paymentReference: reference, updatedAt: new Date() })
        .where(eq(kycVerificationRequests.id, request.id));

      res.json({
        authorizationUrl: result.data.authorization_url,
        reference: result.data.reference,
        accessCode: result.data.access_code,
      });
    } catch (error: any) {
      console.error("[KYC] Initialize payment error:", error);
      res.status(500).json({ message: "Failed to initialize payment" });
    }
  });

  // KYC Paystack webhook is now handled by the main webhook handler in paystackWebhookHandler.ts
  // References starting with 'kyc_' are routed to handleKycPaymentSuccess()

  // ==================== AUDIT CERTIFICATE ENDPOINT (T009) ====================

  app.get("/api/kyc-service/organisations/:id/verification-requests/:reqId/audit-certificate", isAuthenticated, requireOrgMember(), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const reqId = parseInt(req.params.reqId);

      const [request] = await db.select().from(kycVerificationRequests)
        .where(and(eq(kycVerificationRequests.id, reqId), eq(kycVerificationRequests.orgId, orgId)));
      if (!request) return res.status(404).json({ message: "Verification request not found" });

      if (request.status !== "verified") {
        return res.status(400).json({ message: "Audit certificate is only available for verified requests" });
      }

      const [org] = await db.select().from(kycOrganisations).where(eq(kycOrganisations.id, orgId));
      if (!org) return res.status(404).json({ message: "Organisation not found" });

      const documents = await db.select().from(kycSubmittedDocuments)
        .where(eq(kycSubmittedDocuments.verificationRequestId, reqId));

      const requirementIdSet = new Set(documents.map(d => d.requirementId));
      const requirementIds = Array.from(requirementIdSet);
      let requirementsMap: Record<number, typeof kycDocumentRequirements.$inferSelect> = {};
      if (requirementIds.length > 0) {
        const requirements = await db.select().from(kycDocumentRequirements)
          .where(sql`${kycDocumentRequirements.id} IN (${sql.join(requirementIds.map(id => sql`${id}`), sql`, `)})`);
        for (const r of requirements) {
          requirementsMap[r.id] = r;
        }
      }

      const certificateNumber = `KYC-${org.slug.toUpperCase().slice(0, 8)}-${reqId.toString().padStart(6, "0")}`;
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const verificationUrl = `${baseUrl}/kyc/org/${orgId}/requests/${reqId}`;

      const verificationDate = request.reviewedAt
        ? new Date(request.reviewedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
        : new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      const issuedDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

      const docsList = documents.map(doc => {
        const req = requirementsMap[doc.requirementId];
        return {
          name: req?.documentName || doc.fileName,
          category: req?.documentCategory || "other",
          status: doc.status,
          expiryDate: doc.expiryDate
            ? new Date(doc.expiryDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
            : null,
          reviewedAt: doc.reviewedAt
            ? new Date(doc.reviewedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
            : null,
        };
      });

      let supplierData: any = undefined;
      let directorsData: any[] | undefined = undefined;

      if (request.type === "supplier") {
        const [profile] = await db.select().from(kycSupplierProfiles)
          .where(eq(kycSupplierProfiles.verificationRequestId, reqId));
        if (profile) {
          supplierData = {
            companyName: profile.companyName,
            rcNumber: profile.rcNumber,
            tinNumber: profile.tinNumber,
            vatRegistered: profile.vatRegistered,
            yearEstablished: profile.yearEstablished,
            industryCategory: profile.industryCategory,
            headOfficeAddress: profile.headOfficeAddress,
            contactPersonName: profile.contactPersonName,
            contactPersonEmail: profile.contactPersonEmail,
          };

          const people = await db.select().from(kycSupplierPeople)
            .where(eq(kycSupplierPeople.supplierProfileId, profile.id));
          if (people.length > 0) {
            directorsData = people.map(p => ({
              fullName: p.fullName,
              role: p.role,
              verificationStatus: p.verificationStatus,
            }));
          }
        }
      }

      let individualData: any = undefined;
      if (request.type === "individual") {
        const auditSnapshot = request.verifiedDataSnapshot as import("@shared/schema").KycVerifiedSnapshot | null;
        individualData = {
          subjectName: request.subjectName,
          subjectEmail: request.subjectEmail,
          verificationChecks: {
            bvnValidation: hasAcceptedDocs,
            ninValidation: hasAcceptedDocs,
            documentVerification: hasAcceptedDocs,
            biometricMatch: auditSnapshot?.biometricVerified ?? false,
            amlScreening: auditSnapshot?.amlScreened ?? hasAcceptedDocs,
          },
          verificationReference: request.certificateRef || null,
          livenessScore: null,
        };
      }

      const { generateKycAuditCertificateHTML } = await import("../templates/kyc-audit-certificate");
      const html = generateKycAuditCertificateHTML({
        certificateNumber,
        type: request.type as "individual" | "supplier",
        orgName: org.name,
        orgCategory: org.category,
        verificationDate,
        issuedDate,
        verificationUrl,
        individual: individualData,
        supplier: supplierData,
        documents: docsList,
        directors: directorsData,
        riskScore: request.riskScore,
        reviewNotes: request.reviewNotes,
        reviewedBy: request.reviewedByUserId,
      });

      const format = req.query.format;
      if (format === "html") {
        res.setHeader("Content-Type", "text/html");
        return res.send(html);
      }

      try {
        const { generatePdf } = await import("../services/pdfService");
        const pdfBuffer = await generatePdf(html);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="kyc-certificate-${certificateNumber}.pdf"`);
        return res.send(pdfBuffer);
      } catch (puppeteerError: any) {
        console.error("[KYC] Puppeteer PDF generation failed:", puppeteerError.message);
        const htmlUrl = `/api/kyc-service/organisations/${orgId}/verification-requests/${reqId}/audit-certificate?format=html`;
        return res.status(500).json({ message: "Failed to generate PDF. You can view the certificate as HTML instead.", htmlUrl });
      }
    } catch (error: any) {
      console.error("[KYC] Audit certificate error:", error);
      res.status(500).json({ message: "Failed to generate audit certificate" });
    }
  });

  // ==================== UPLOAD URL ENDPOINT ====================

  // ── Government ID Photo endpoint (access-logged, streams bytes) ──────────────
  // Route: /api/kyc-service/identity-data/:verificationRequestId/photo
  // Auth: authenticated + must be an org member of the request's organisation
  app.get("/api/kyc-service/identity-data/:verificationRequestId/photo", isAuthenticated, async (req: any, res: Response) => {
    try {
      const verificationRequestId = parseInt(req.params.verificationRequestId);
      const userId = getUserId(req);

      const [request] = await db.select().from(kycVerificationRequests)
        .where(eq(kycVerificationRequests.id, verificationRequestId));
      if (!request) return res.status(404).json({ message: "Request not found" });
      if (request.status !== "verified") return res.status(403).json({ message: "Photo only available for verified requests" });

      // Verify the caller is either a member of the request's org OR a platform admin
      const orgId = request.orgId;
      const isAdmin = req.user?.roles?.includes("admin") || req.user?.roles?.includes("super_admin");
      if (!isAdmin) {
        const [membership] = await db.select().from(kycOrgMembers)
          .where(and(eq(kycOrgMembers.orgId, orgId), eq(kycOrgMembers.userId, userId)));
        if (!membership) return res.status(403).json({ message: "Access denied" });
      }

      const [identityProfile] = await db.select().from(kycVerifiedIdentityData)
        .where(eq(kycVerifiedIdentityData.verificationRequestId, verificationRequestId));
      if (!identityProfile?.governmentPhotoPath) {
        return res.status(404).json({ message: "No government photo available for this verification" });
      }

      const photoUrl = await getGovernmentPhotoUrl(identityProfile.governmentPhotoPath);
      if (!photoUrl) return res.status(404).json({ message: "Photo file could not be retrieved" });

      // Durable audit log — persisted to DB, not just console
      await db.insert(sensitiveDataAccessLogs).values({
        accessorUserId: userId,
        targetUserId: request.subjectExternalId || userId,
        dataType: "government_id_photo",
        action: "view",
        entityType: "kyc_verification_request",
        entityId: String(verificationRequestId),
        ipAddress: req.ip || null,
        userAgent: req.get("User-Agent") || null,
      }).catch(err => console.error("[IdentityPhoto] Audit log write error:", err));

      // Stream actual photo bytes to caller (no redirect to signed URL)
      const upstream = await fetch(photoUrl);
      if (!upstream.ok || !upstream.body) {
        return res.status(502).json({ message: "Could not fetch photo from storage" });
      }
      const photoBuffer = await upstream.arrayBuffer();
      res.setHeader("Content-Type", upstream.headers.get("content-type") || "image/jpeg");
      res.setHeader("Content-Length", photoBuffer.byteLength);
      res.setHeader("Content-Disposition", "inline; filename=\"identity-photo.jpg\"");
      res.setHeader("Cache-Control", "private, no-store");
      res.end(Buffer.from(photoBuffer));
    } catch (error: any) {
      console.error("[KYC] Identity photo error:", error);
      res.status(500).json({ message: "Failed to retrieve identity photo" });
    }
  });

  app.post("/api/kyc-service/upload-url", isAuthenticated, async (req: any, res: Response) => {
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error: any) {
      console.error("[KYC] Upload URL error:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  // ==================== MY VERIFICATIONS (T005) ====================

  app.get("/api/kyc-service/my-verifications", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const user = await db.select().from(users).where(eq(users.id, userId)).then(r => r[0]);
      if (!user) return res.status(404).json({ message: "User not found" });

      const requests = await db.select({
        id: kycVerificationRequests.id,
        orgId: kycVerificationRequests.orgId,
        type: kycVerificationRequests.type,
        status: kycVerificationRequests.status,
        subjectName: kycVerificationRequests.subjectName,
        subjectEmail: kycVerificationRequests.subjectEmail,
        paymentStatus: kycVerificationRequests.paymentStatus,
        paymentResponsibility: kycVerificationRequests.paymentResponsibility,
        inviteToken: kycVerificationRequests.inviteToken,
        riskScore: kycVerificationRequests.riskScore,
        createdAt: kycVerificationRequests.createdAt,
        updatedAt: kycVerificationRequests.updatedAt,
        orgName: kycOrganisations.name,
      })
        .from(kycVerificationRequests)
        .leftJoin(kycOrganisations, eq(kycVerificationRequests.orgId, kycOrganisations.id))
        .where(
          or(
            eq(kycVerificationRequests.subjectUserId, userId),
            eq(kycVerificationRequests.subjectEmail, user.email)
          )
        )
        .orderBy(desc(kycVerificationRequests.createdAt));

      res.json(requests);
    } catch (error: any) {
      console.error("[KYC] My verifications error:", error);
      res.status(500).json({ message: "Failed to fetch verifications" });
    }
  });

  // ==================== ADMIN KYC OVERSIGHT (T003) ====================

  async function requireAdmin(req: any, res: Response, next: NextFunction) {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
    const isAdmin = roles.some(r => r.role === "admin");
    if (!isAdmin) return res.status(403).json({ message: "Admin access required" });
    next();
  }

  app.get("/api/admin/kyc/stats", isAuthenticated, requireAdmin, async (_req: any, res: Response) => {
    try {
      const [orgStats] = await db.select({
        totalOrgs: count(),
        activeOrgs: sql<number>`COUNT(*) FILTER (WHERE ${kycOrganisations.status} = 'active')`,
      }).from(kycOrganisations);

      const [reqStats] = await db.select({
        totalRequests: count(),
        verified: sql<number>`COUNT(*) FILTER (WHERE ${kycVerificationRequests.status} = 'verified')`,
        pending: sql<number>`COUNT(*) FILTER (WHERE ${kycVerificationRequests.status} IN ('pending_invite','pending_payment','in_progress','documents_submitted','under_review'))`,
        rejected: sql<number>`COUNT(*) FILTER (WHERE ${kycVerificationRequests.status} = 'rejected')`,
      }).from(kycVerificationRequests);

      const [revenueResult] = await db.select({
        totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${kycVerificationRequests.paymentStatus} = 'paid' THEN 1 ELSE 0 END), 0)`,
      }).from(kycVerificationRequests);

      res.json({
        totalOrgs: orgStats.totalOrgs,
        activeOrgs: orgStats.activeOrgs,
        totalRequests: reqStats.totalRequests,
        verified: reqStats.verified,
        pending: reqStats.pending,
        rejected: reqStats.rejected,
        paidVerifications: revenueResult.totalRevenue,
      });
    } catch (error: any) {
      console.error("[KYC Admin] Stats error:", error);
      res.status(500).json({ message: "Failed to fetch KYC stats" });
    }
  });

  app.get("/api/admin/kyc/organisations", isAuthenticated, requireAdmin, async (req: any, res: Response) => {
    try {
      const orgs = await db.select().from(kycOrganisations).orderBy(desc(kycOrganisations.createdAt));

      const orgsWithStats = await Promise.all(orgs.map(async (org) => {
        const [stats] = await db.select({
          totalRequests: count(),
          verified: sql<number>`COUNT(*) FILTER (WHERE ${kycVerificationRequests.status} = 'verified')`,
          pending: sql<number>`COUNT(*) FILTER (WHERE ${kycVerificationRequests.status} IN ('pending_invite','pending_payment','in_progress','documents_submitted','under_review'))`,
        }).from(kycVerificationRequests).where(eq(kycVerificationRequests.orgId, org.id));

        const [memberCount] = await db.select({
          total: count(),
        }).from(kycOrgMembers).where(and(eq(kycOrgMembers.orgId, org.id), eq(kycOrgMembers.inviteStatus, "accepted")));

        return {
          ...org,
          totalRequests: stats.totalRequests,
          verifiedRequests: stats.verified,
          pendingRequests: stats.pending,
          memberCount: memberCount.total,
        };
      }));

      res.json(orgsWithStats);
    } catch (error: any) {
      console.error("[KYC Admin] List orgs error:", error);
      res.status(500).json({ message: "Failed to list KYC organisations" });
    }
  });

  app.get("/api/admin/kyc/organisations/:id", isAuthenticated, requireAdmin, async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      if (isNaN(orgId)) return res.status(400).json({ message: "Invalid org ID" });

      const [org] = await db.select().from(kycOrganisations).where(eq(kycOrganisations.id, orgId));
      if (!org) return res.status(404).json({ message: "Organisation not found" });

      const members = await db.select().from(kycOrgMembers).where(eq(kycOrgMembers.orgId, orgId));

      const [stats] = await db.select({
        total: count(),
        pending: sql<number>`COUNT(*) FILTER (WHERE ${kycVerificationRequests.status} IN ('pending_invite','pending_payment','in_progress','documents_submitted'))`,
        underReview: sql<number>`COUNT(*) FILTER (WHERE ${kycVerificationRequests.status} = 'under_review')`,
        verified: sql<number>`COUNT(*) FILTER (WHERE ${kycVerificationRequests.status} = 'verified')`,
        rejected: sql<number>`COUNT(*) FILTER (WHERE ${kycVerificationRequests.status} = 'rejected')`,
        expired: sql<number>`COUNT(*) FILTER (WHERE ${kycVerificationRequests.status} = 'expired')`,
      }).from(kycVerificationRequests).where(eq(kycVerificationRequests.orgId, orgId));

      const recentRequests = await db.select().from(kycVerificationRequests)
        .where(eq(kycVerificationRequests.orgId, orgId))
        .orderBy(desc(kycVerificationRequests.createdAt))
        .limit(20);

      res.json({ ...org, members, stats, recentRequests });
    } catch (error: any) {
      console.error("[KYC Admin] Get org detail error:", error);
      res.status(500).json({ message: "Failed to get organisation details" });
    }
  });

  app.patch("/api/admin/kyc/organisations/:id/status", isAuthenticated, requireAdmin, async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      if (isNaN(orgId)) return res.status(400).json({ message: "Invalid org ID" });

      const schema = z.object({
        status: z.enum(["pending_review", "active", "suspended"]),
        reviewNotes: z.string().optional(),
      });
      const data = schema.parse(req.body);

      const [updated] = await db.update(kycOrganisations)
        .set({ status: data.status, updatedAt: new Date() })
        .where(eq(kycOrganisations.id, orgId))
        .returning();

      if (!updated) return res.status(404).json({ message: "Organisation not found" });

      // Notify the org creator of the review decision
      if (data.status === "active" || data.status === "suspended") {
        try {
          const { client: emailClient, fromEmail } = await getResendClient();
          const isApproved = data.status === "active";
          await emailClient.emails.send({
            from: fromEmail,
            to: updated.contactEmail,
            subject: isApproved
              ? "Your KYC Organisation Has Been Approved"
              : "Update on Your KYC Organisation Application",
            html: isApproved
              ? `<p>Your organisation <strong>${updated.name}</strong> has been approved on Cellion One. You can now access all KYC Service features.</p><p><a href="https://cellionone.com/kyc">Open your KYC dashboard</a></p>`
              : `<p>Your organisation <strong>${updated.name}</strong> has been suspended. ${data.reviewNotes ? `<br>Reason: ${data.reviewNotes}` : ""}</p><p>Please contact <a href="mailto:service@cellionone.com">service@cellionone.com</a> for assistance.</p>`,
          });
        } catch (emailErr) {
          console.error("[KYC Admin] Failed to send review decision email:", emailErr);
        }
      }

      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC Admin] Update status error:", error);
      res.status(500).json({ message: "Failed to update organisation status" });
    }
  });

  // Admin provision API client — skip self-service form, terms, and review queue
  app.post("/api/admin/kyc/provision-client", isAuthenticated, requireAdmin, async (req: any, res: Response) => {
    try {
      const adminUserId = getUserId(req);
      if (!adminUserId) return res.status(401).json({ message: "Unauthorized" });

      // Fetch admin email for membership record metadata
      const [adminUser] = await db.select({ email: users.email }).from(users).where(eq(users.id, adminUserId));
      const adminEmail = adminUser?.email ?? "";

      const ALLOWED_PERMISSIONS = ["verify:identity", "verify:individual", "verify:supplier", "verify:business", "escrow:read", "escrow:write"] as const;
      const schema = z.object({
        name: z.string().min(2).max(255),
        clientType: z.enum(["organisation", "application"]),
        contactEmail: z.string().email(),
        billingMode: z.enum(["prepaid", "exempt", "invoiced"]).optional(),
        permissions: z.array(z.enum(ALLOWED_PERMISSIONS)).min(1),
        keyName: z.string().min(1).max(255).optional(),
      });
      const data = schema.parse(req.body);

      // Default billing mode: application → exempt, organisation → prepaid
      const resolvedBillingMode = data.billingMode ?? (data.clientType === "application" ? "exempt" : "prepaid");
      const keyName = data.keyName || `${data.clientType === "application" ? "App" : "Default"} Key`;

      // Generate a unique slug with retry on collision
      let slug = slugify(data.name);
      const [existing] = await db.select({ id: kycOrganisations.id }).from(kycOrganisations).where(eq(kycOrganisations.slug, slug));
      if (existing) slug = `${slug}-${Date.now().toString(36)}-${crypto.randomBytes(2).toString("hex")}`;

      // Wrap all 4 writes in a single transaction — partial failure rolls back everything
      const { org, billingAccount, key, apiKey } = await db.transaction(async (tx) => {
        // 1. Create org with status "active" — no review needed
        const [newOrg] = await tx.insert(kycOrganisations).values({
          name: data.name,
          slug,
          clientType: data.clientType,
          category: "corporate",
          contactEmail: data.contactEmail,
          createdByUserId: adminUserId,
          status: "active",
          settings: {},
          // Admin-provisioned clients are API-only — portals are for self-service orgs
          employeePortalEnabled: false,
          supplierPortalEnabled: false,
          termsAcceptedAt: new Date(),
          termsVersion: TERMS_VERSION,
          termsAcceptedByUserId: adminUserId,
          termsAcceptedIp: "admin-provisioned",
        }).returning();

        // 2. Add admin as org_admin member (inviteEmail = admin's email; fallback to contactEmail)
        await tx.insert(kycOrgMembers).values({
          orgId: newOrg.id,
          userId: adminUserId,
          role: "org_admin",
          inviteEmail: adminEmail || data.contactEmail,
          inviteStatus: "accepted",
        });

        // 3. Create billing account with the chosen mode
        const [newBillingAccount] = await tx.insert(kycBillingAccounts).values({
          organisationId: newOrg.id,
          billingMode: resolvedBillingMode,
          creditBalance: 0,
          isActive: true,
        }).returning();

        // 4. Generate API key via shared service (passes tx for atomicity)
        const { key: fullKey, apiKey: newApiKey } = await kycApiKeyService.generateApiKey(
          newOrg.id, keyName, data.permissions, tx
        );

        return { org: newOrg, billingAccount: newBillingAccount, key: fullKey, apiKey: newApiKey };
      });

      res.status(201).json({
        org,
        billingAccount: {
          id: billingAccount.id,
          billingMode: billingAccount.billingMode,
        },
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          keyPrefix: apiKey.keyPrefix,
          permissions: apiKey.permissions,
          createdAt: apiKey.createdAt,
        },
        key,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC Admin] Provision client error:", error);
      res.status(500).json({ message: "Failed to provision API client" });
    }
  });

  // Admin review endpoint — action-based contract: POST /api/admin/kyc-orgs/:id/review
  app.post("/api/admin/kyc-orgs/:id/review", isAuthenticated, requireAdmin, async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      if (isNaN(orgId)) return res.status(400).json({ message: "Invalid org ID" });

      const { action, notes } = z.object({
        action: z.enum(["approve", "reject"]),
        notes: z.string().optional(),
      }).parse(req.body);

      const newStatus = action === "approve" ? "active" : "suspended";

      const [updated] = await db.update(kycOrganisations)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(kycOrganisations.id, orgId))
        .returning();

      if (!updated) return res.status(404).json({ message: "Organisation not found" });

      // Send decision email to org creator
      try {
        const { client: emailClient, fromEmail } = await getResendClient();
        const isApproved = action === "approve";
        await emailClient.emails.send({
          from: fromEmail,
          to: updated.contactEmail,
          subject: isApproved
            ? "Your KYC Organisation Has Been Approved"
            : "Update on Your KYC Organisation Application",
          html: isApproved
            ? `<p>Your organisation <strong>${updated.name}</strong> has been approved on Cellion One. You can now access all KYC Service features.</p><p><a href="https://cellionone.com/kyc/orgs">Open your KYC dashboard</a></p>`
            : `<p>Your organisation <strong>${updated.name}</strong> application was not approved. ${notes ? `<br>Reason: ${notes}` : ""}</p><p>Please contact <a href="mailto:service@cellionone.com">service@cellionone.com</a> for assistance.</p>`,
        });
      } catch (emailErr) {
        console.error("[KYC Admin] Failed to send review decision email:", emailErr);
      }

      res.json({ ...updated, action, notes });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC Admin] Review error:", error);
      res.status(500).json({ message: "Failed to review organisation" });
    }
  });

  // ==================== API KEY MANAGEMENT ====================

  app.post("/api/kyc-service/organisations/:id/api-keys", isAuthenticated, requireOrgMember(["org_admin"]), requireActiveOrg(), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);

      const [billingAccount] = await db.select().from(kycBillingAccounts)
        .where(and(eq(kycBillingAccounts.organisationId, orgId), eq(kycBillingAccounts.isActive, true)));

      if (!billingAccount) {
        return res.status(400).json({ message: "A billing account must be set up before generating API keys" });
      }

      const schema = z.object({
        name: z.string().min(1).max(255),
        permissions: z.array(z.string()).min(1),
      });
      const data = schema.parse(req.body);

      const { key, apiKey } = await kycApiKeyService.generateApiKey(orgId, data.name, data.permissions);

      res.status(201).json({
        key,
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          keyPrefix: apiKey.keyPrefix,
          permissions: apiKey.permissions,
          rateLimitPerMinute: apiKey.rateLimitPerMinute,
          isActive: apiKey.isActive,
          createdAt: apiKey.createdAt,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC] Generate API key error:", error);
      res.status(500).json({ message: "Failed to generate API key" });
    }
  });

  app.get("/api/kyc-service/organisations/:id/api-keys", isAuthenticated, requireOrgMember(["org_admin"]), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const keys = await kycApiKeyService.listApiKeys(orgId);

      const safeKeys = keys.map(k => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        permissions: k.permissions,
        rateLimitPerMinute: k.rateLimitPerMinute,
        isActive: k.isActive,
        lastUsedAt: k.lastUsedAt,
        expiresAt: k.expiresAt,
        createdAt: k.createdAt,
      }));

      res.json(safeKeys);
    } catch (error: any) {
      console.error("[KYC] List API keys error:", error);
      res.status(500).json({ message: "Failed to list API keys" });
    }
  });

  app.delete("/api/kyc-service/organisations/:id/api-keys/:keyId", isAuthenticated, requireOrgMember(["org_admin"]), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const keyId = parseInt(req.params.keyId);
      if (isNaN(keyId)) return res.status(400).json({ message: "Invalid key ID" });

      const revoked = await kycApiKeyService.revokeApiKey(keyId, orgId);
      if (!revoked) return res.status(404).json({ message: "API key not found" });

      res.json({ message: "API key revoked" });
    } catch (error: any) {
      console.error("[KYC] Revoke API key error:", error);
      res.status(500).json({ message: "Failed to revoke API key" });
    }
  });

  app.get("/api/kyc-service/organisations/:id/api-usage", isAuthenticated, requireOrgMember(["org_admin"]), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const stats = await kycApiKeyService.getApiUsageStats(orgId);
      res.json(stats);
    } catch (error: any) {
      console.error("[KYC] API usage stats error:", error);
      res.status(500).json({ message: "Failed to get API usage stats" });
    }
  });

  // ==================== WEBHOOK MANAGEMENT ====================

  app.post("/api/kyc-service/organisations/:id/webhooks", isAuthenticated, requireOrgMember(["org_admin"]), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const schema = z.object({
        url: z.string().url().max(1000),
        secret: z.string().optional(),
        events: z.array(z.string()).min(1, "At least one event is required"),
      });
      const data = schema.parse(req.body);

      const { registerWebhook } = await import("../services/kycWebhookService");
      const webhook = await registerWebhook(orgId, data.url, data.secret, data.events);

      res.status(201).json(webhook);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC] Register webhook error:", error);
      res.status(500).json({ message: "Failed to register webhook" });
    }
  });

  app.get("/api/kyc-service/organisations/:id/webhooks", isAuthenticated, requireOrgMember(), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const { listWebhooks } = await import("../services/kycWebhookService");
      const webhooks = await listWebhooks(orgId);
      const safeWebhooks = webhooks.map(wh => ({
        ...wh,
        secret: wh.secret.substring(0, 8) + "..." ,
      }));
      res.json(safeWebhooks);
    } catch (error: any) {
      console.error("[KYC] List webhooks error:", error);
      res.status(500).json({ message: "Failed to list webhooks" });
    }
  });

  app.patch("/api/kyc-service/organisations/:id/webhooks/:whId", isAuthenticated, requireOrgMember(["org_admin"]), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const whId = parseInt(req.params.whId);

      const { getWebhook, updateWebhook } = await import("../services/kycWebhookService");
      const existing = await getWebhook(whId);
      if (!existing || existing.organisationId !== orgId) {
        return res.status(404).json({ message: "Webhook not found" });
      }

      const schema = z.object({
        url: z.string().url().max(1000).optional(),
        events: z.array(z.string()).min(1).optional(),
        isActive: z.boolean().optional(),
      });
      const data = schema.parse(req.body);

      const updated = await updateWebhook(whId, data);
      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC] Update webhook error:", error);
      res.status(500).json({ message: "Failed to update webhook" });
    }
  });

  app.post("/api/kyc-service/organisations/:id/webhooks/:whId/rotate-secret", isAuthenticated, requireOrgMember(["org_admin"]), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const whId = parseInt(req.params.whId);

      const { getWebhook, rotateWebhookSecret } = await import("../services/kycWebhookService");
      const existing = await getWebhook(whId);
      if (!existing || existing.organisationId !== orgId) {
        return res.status(404).json({ message: "Webhook not found" });
      }

      const updated = await rotateWebhookSecret(whId);
      res.json({ id: updated!.id, secret: updated!.secret });
    } catch (error: any) {
      console.error("[KYC] Rotate webhook secret error:", error);
      res.status(500).json({ message: "Failed to rotate webhook secret" });
    }
  });

  app.delete("/api/kyc-service/organisations/:id/webhooks/:whId", isAuthenticated, requireOrgMember(["org_admin"]), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const whId = parseInt(req.params.whId);

      const { getWebhook, deleteWebhook } = await import("../services/kycWebhookService");
      const existing = await getWebhook(whId);
      if (!existing || existing.organisationId !== orgId) {
        return res.status(404).json({ message: "Webhook not found" });
      }

      await deleteWebhook(whId);
      res.json({ message: "Webhook deleted" });
    } catch (error: any) {
      console.error("[KYC] Delete webhook error:", error);
      res.status(500).json({ message: "Failed to delete webhook" });
    }
  });

  app.get("/api/kyc-service/organisations/:id/webhooks/:whId/deliveries", isAuthenticated, requireOrgMember(), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const whId = parseInt(req.params.whId);

      const { getWebhook, getDeliveryLogs } = await import("../services/kycWebhookService");
      const existing = await getWebhook(whId);
      if (!existing || existing.organisationId !== orgId) {
        return res.status(404).json({ message: "Webhook not found" });
      }

      const logs = await getDeliveryLogs(whId);
      res.json(logs);
    } catch (error: any) {
      console.error("[KYC] Get delivery logs error:", error);
      res.status(500).json({ message: "Failed to get delivery logs" });
    }
  });

  app.post("/api/kyc-service/organisations/:id/webhooks/:whId/test", isAuthenticated, requireOrgMember(["org_admin"]), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const whId = parseInt(req.params.whId);

      const { getWebhook, sendTestEvent } = await import("../services/kycWebhookService");
      const existing = await getWebhook(whId);
      if (!existing || existing.organisationId !== orgId) {
        return res.status(404).json({ message: "Webhook not found" });
      }

      const deliveryLog = await sendTestEvent(whId);
      res.json(deliveryLog);
    } catch (error: any) {
      console.error("[KYC] Test webhook error:", error);
      res.status(500).json({ message: "Failed to send test event" });
    }
  });

  // ==================== BILLING ROUTES (T003) ====================

  app.get("/api/kyc-service/organisations/:id/billing", isAuthenticated, requireOrgMember(), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      let account = await billingService.getBillingAccount(orgId);
      if (!account) {
        account = await billingService.createBillingAccount(orgId);
      }

      const [pendingRequest] = await db.select().from(kycBillingRequests)
        .where(and(
          eq(kycBillingRequests.organisationId, orgId),
          eq(kycBillingRequests.status, "pending")
        ));

      res.json({ ...account, pendingInvoicedRequest: pendingRequest || null });
    } catch (error: any) {
      console.error("[KYC Billing] Get billing error:", error);
      res.status(500).json({ message: "Failed to get billing account" });
    }
  });

  app.post("/api/kyc-service/organisations/:id/billing/purchase-credits", isAuthenticated, requireOrgMember(["org_admin"]), requireActiveOrg(), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const userId = getUserId(req);

      const schema = z.object({
        quantity: z.number().int().min(10, "Minimum purchase is 10 credits"),
        verificationType: z.enum(["identity_only", "individual", "supplier", "kyb"]),
      });
      const data = schema.parse(req.body);

      const [org] = await db.select().from(kycOrganisations).where(eq(kycOrganisations.id, orgId));
      if (!org) return res.status(404).json({ message: "Organisation not found" });

      let account = await billingService.getBillingAccount(orgId);
      if (!account) {
        account = await billingService.createBillingAccount(orgId);
      }

      const result = await billingService.purchaseCredits(
        orgId,
        data.quantity,
        data.verificationType,
        org.contactEmail
      );

      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC Billing] Purchase credits error:", error);
      res.status(500).json({ message: error.message || "Failed to purchase credits" });
    }
  });

  app.post("/api/kyc-service/organisations/:id/billing/request-invoiced", isAuthenticated, requireOrgMember(["org_admin"]), requireActiveOrg(), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const userId = getUserId(req);

      const schema = z.object({
        companyName: z.string().min(2).max(255),
        companyEmail: z.string().email(),
        estimatedMonthlyVolume: z.string().min(1),
        message: z.string().optional(),
      });
      const data = schema.parse(req.body);

      const request = await billingService.requestInvoicedBilling(
        orgId,
        userId,
        data.companyName,
        data.companyEmail,
        data.estimatedMonthlyVolume,
        data.message || ""
      );

      res.status(201).json(request);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC Billing] Request invoiced error:", error);
      res.status(400).json({ message: error.message || "Failed to submit request" });
    }
  });

  app.get("/api/kyc-service/organisations/:id/billing/transactions", isAuthenticated, requireOrgMember(), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const limit = parseInt(req.query.limit as string) || 50;
      const transactions = await billingService.getTransactions(orgId, limit);
      res.json(transactions);
    } catch (error: any) {
      console.error("[KYC Billing] Get transactions error:", error);
      res.status(500).json({ message: "Failed to get transactions" });
    }
  });

  app.get("/api/kyc-service/organisations/:id/billing/invoices", isAuthenticated, requireOrgMember(), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const invoices = await billingService.getInvoices(orgId);
      res.json(invoices);
    } catch (error: any) {
      console.error("[KYC Billing] Get invoices error:", error);
      res.status(500).json({ message: "Failed to get invoices" });
    }
  });

  // ==================== ADMIN BILLING ROUTES (T003) ====================

  app.get("/api/admin/kyc/billing-requests", isAuthenticated, requireAdmin, async (_req: any, res: Response) => {
    try {
      const requests = await billingService.getPendingBillingRequests();
      res.json(requests);
    } catch (error: any) {
      console.error("[KYC Admin] List billing requests error:", error);
      res.status(500).json({ message: "Failed to list billing requests" });
    }
  });

  app.patch("/api/admin/kyc/billing-requests/:reqId", isAuthenticated, requireAdmin, async (req: any, res: Response) => {
    try {
      const reqId = parseInt(req.params.reqId);
      const userId = getUserId(req);

      const schema = z.object({
        action: z.enum(["approve", "reject"]),
        creditLimit: z.number().int().min(0).optional(),
        notes: z.string().optional(),
      });
      const data = schema.parse(req.body);

      if (data.action === "approve") {
        const result = await billingService.approveInvoicedBilling(
          reqId,
          userId,
          data.creditLimit || 1000
        );
        res.json(result);
      } else {
        const result = await billingService.rejectInvoicedBilling(
          reqId,
          userId,
          data.notes || "Request rejected by admin"
        );
        res.json(result);
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC Admin] Billing request action error:", error);
      res.status(400).json({ message: error.message || "Failed to process billing request" });
    }
  });

  app.patch("/api/admin/kyc/organisations/:id/billing", isAuthenticated, requireAdmin, async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const userId = getUserId(req);

      const schema = z.object({
        creditLimit: z.number().int().min(0).optional(),
        creditAdjustment: z.number().int().optional(),
        adjustmentReason: z.string().optional(),
        isActive: z.boolean().optional(),
        billingMode: z.enum(KYC_BILLING_MODES).optional(),
      });
      const data = schema.parse(req.body);

      let account = await billingService.getBillingAccount(orgId);
      if (!account) return res.status(404).json({ message: "Billing account not found" });

      if (data.creditLimit !== undefined) {
        await db.update(kycBillingAccounts)
          .set({ creditLimit: data.creditLimit, updatedAt: new Date() })
          .where(eq(kycBillingAccounts.organisationId, orgId));
      }

      if (data.isActive !== undefined) {
        await db.update(kycBillingAccounts)
          .set({ isActive: data.isActive, updatedAt: new Date() })
          .where(eq(kycBillingAccounts.organisationId, orgId));
      }

      if (data.billingMode !== undefined) {
        await db.update(kycBillingAccounts)
          .set({ billingMode: data.billingMode, updatedAt: new Date() })
          .where(eq(kycBillingAccounts.organisationId, orgId));
      }

      let transaction = null;
      if (data.creditAdjustment && data.adjustmentReason) {
        transaction = await billingService.adjustCredits(
          orgId,
          data.creditAdjustment,
          data.adjustmentReason,
          userId
        );
      }

      account = await billingService.getBillingAccount(orgId);
      res.json({ account, transaction });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC Admin] Update billing error:", error);
      res.status(400).json({ message: error.message || "Failed to update billing" });
    }
  });

  app.get("/api/admin/kyc/billing-accounts", isAuthenticated, requireAdmin, async (_req: any, res: Response) => {
    try {
      const accounts = await db.select({
        id: kycBillingAccounts.id,
        organisationId: kycBillingAccounts.organisationId,
        billingMode: kycBillingAccounts.billingMode,
        creditBalance: kycBillingAccounts.creditBalance,
        invoiceEmail: kycBillingAccounts.invoiceEmail,
        invoiceCompanyName: kycBillingAccounts.invoiceCompanyName,
        invoiceAddress: kycBillingAccounts.invoiceAddress,
        paymentTermsDays: kycBillingAccounts.paymentTermsDays,
        creditLimit: kycBillingAccounts.creditLimit,
        isActive: kycBillingAccounts.isActive,
        approvedAt: kycBillingAccounts.approvedAt,
        approvedBy: kycBillingAccounts.approvedBy,
        createdAt: kycBillingAccounts.createdAt,
        updatedAt: kycBillingAccounts.updatedAt,
        orgName: kycOrganisations.name,
        clientType: kycOrganisations.clientType,
      })
        .from(kycBillingAccounts)
        .leftJoin(kycOrganisations, eq(kycBillingAccounts.organisationId, kycOrganisations.id))
        .orderBy(desc(kycBillingAccounts.createdAt));
      res.json(accounts);
    } catch (error: any) {
      console.error("[KYC Admin] List billing accounts error:", error);
      res.status(500).json({ message: "Failed to list billing accounts" });
    }
  });

  app.get("/api/admin/kyc/invoices", isAuthenticated, requireAdmin, async (_req: any, res: Response) => {
    try {
      const invoices = await db.select({
        id: kycInvoices.id,
        billingAccountId: kycInvoices.billingAccountId,
        invoiceNumber: kycInvoices.invoiceNumber,
        periodStart: kycInvoices.periodStart,
        periodEnd: kycInvoices.periodEnd,
        lineItems: kycInvoices.lineItems,
        subtotal: kycInvoices.subtotal,
        total: kycInvoices.total,
        currency: kycInvoices.currency,
        status: kycInvoices.status,
        dueDate: kycInvoices.dueDate,
        paidAt: kycInvoices.paidAt,
        paystackReference: kycInvoices.paystackReference,
        sentAt: kycInvoices.sentAt,
        createdAt: kycInvoices.createdAt,
        orgName: kycOrganisations.name,
      })
        .from(kycInvoices)
        .leftJoin(kycBillingAccounts, eq(kycInvoices.billingAccountId, kycBillingAccounts.id))
        .leftJoin(kycOrganisations, eq(kycBillingAccounts.organisationId, kycOrganisations.id))
        .orderBy(desc(kycInvoices.createdAt));

      res.json(invoices);
    } catch (error: any) {
      console.error("[KYC Admin] List invoices error:", error);
      res.status(500).json({ message: "Failed to list invoices" });
    }
  });

  app.patch("/api/admin/kyc/invoices/:invoiceId/mark-paid", isAuthenticated, requireAdmin, async (req: any, res: Response) => {
    try {
      const invoiceId = parseInt(req.params.invoiceId);
      const schema = z.object({
        paystackReference: z.string().optional(),
      });
      const data = schema.parse(req.body);

      const invoice = await billingService.markInvoicePaid(invoiceId, data.paystackReference);
      res.json(invoice);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC Admin] Mark invoice paid error:", error);
      res.status(400).json({ message: error.message || "Failed to mark invoice as paid" });
    }
  });

  // ============== HOSTED SESSION PUBLIC ROUTES ==============

  // GET /api/kyc-service/sessions/:token — public, no auth, for the hosted session wizard
  app.get("/api/kyc-service/sessions/:token", async (req: any, res: Response) => {
    try {
      const { token } = req.params;
      const [session] = await db.select().from(kycSessions).where(eq(kycSessions.sessionToken, token));
      if (!session) return res.status(404).json({ message: "Session not found" });

      const now = new Date();
      // Expire any non-completed, non-already-expired session that has passed its expiresAt
      if (session.expiresAt && session.expiresAt < now && session.status !== "expired" && session.status !== "completed") {
        await db.update(kycSessions).set({ status: "expired", updatedAt: new Date() }).where(eq(kycSessions.id, session.id));
        webhookService.deliverWebhook(session.orgId, "session.expired", {
          sessionId: session.id,
          sessionToken: session.sessionToken,
          subjectEmail: session.subjectEmail,
          subjectName: session.subjectName,
          metadata: session.metadata,
          expiredAt: new Date().toISOString(),
        }).catch((err: any) => console.error("[KYC Session] Failed to deliver session.expired webhook:", err));
        return res.status(410).json({ message: "Session expired", status: "expired" });
      }
      if (session.status === "expired") return res.status(410).json({ message: "Session expired", status: "expired" });
      if (session.status === "completed") {
        let enrichedReturnUrl = session.returnUrl;
        if (enrichedReturnUrl && session.verificationRequestId) {
          const separator = enrichedReturnUrl.includes("?") ? "&" : "?";
          enrichedReturnUrl = `${enrichedReturnUrl}${separator}session_id=${session.id}&status=completed&request_id=${session.verificationRequestId}`;
        }
        return res.json({
          status: "completed",
          sessionId: session.id,
          verificationRequestId: session.verificationRequestId,
          returnUrl: enrichedReturnUrl || session.returnUrl,
        });
      }

      const [org] = await db.select({ name: kycOrganisations.name, logoPath: kycOrganisations.logoPath })
        .from(kycOrganisations).where(eq(kycOrganisations.id, session.orgId));

      res.json({
        sessionId: session.id,
        status: session.status,
        type: session.type,
        subjectEmail: session.subjectEmail,
        subjectName: session.subjectName,
        expiresAt: session.expiresAt,
        metadata: session.metadata,
        prefillData: session.prefillData || null,
        requiredSteps: session.requiredSteps || null,
        organisation: org || null,
      });
    } catch (error: any) {
      console.error("[KYC Session] Get session error:", error);
      res.status(500).json({ message: "Failed to get session" });
    }
  });

  // POST /api/kyc-service/sessions/:token/upload-url — get a presigned upload URL for ID document (no auth, session token validates)
  app.post("/api/kyc-service/sessions/:token/upload-url", async (req: any, res: Response) => {
    try {
      const { token } = req.params;
      const [session] = await db.select({ id: kycSessions.id, status: kycSessions.status, expiresAt: kycSessions.expiresAt })
        .from(kycSessions).where(eq(kycSessions.sessionToken, token));
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.status === "expired" || session.status === "completed") {
        return res.status(410).json({ message: `Session is ${session.status}` });
      }
      if (new Date() > session.expiresAt) {
        return res.status(410).json({ message: "Session expired" });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      res.json({ uploadURL, objectPath });
    } catch (error: any) {
      console.error("[KYC Session] Upload URL error:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  // POST /api/kyc-service/sessions/:token/start — subject accepts consent
  app.post("/api/kyc-service/sessions/:token/start", async (req: any, res: Response) => {
    try {
      const { token } = req.params;
      const [session] = await db.select().from(kycSessions).where(eq(kycSessions.sessionToken, token));
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.status === "expired" || session.status === "completed") {
        return res.status(410).json({ message: `Session is ${session.status}` });
      }
      if (new Date() > session.expiresAt) {
        await db.update(kycSessions).set({ status: "expired", updatedAt: new Date() }).where(eq(kycSessions.id, session.id));
        return res.status(410).json({ message: "Session expired" });
      }

      await db.update(kycSessions)
        .set({ status: "in_progress", updatedAt: new Date() })
        .where(eq(kycSessions.id, session.id));

      res.json({ status: "in_progress" });
    } catch (error: any) {
      console.error("[KYC Session] Start session error:", error);
      res.status(500).json({ message: "Failed to start session" });
    }
  });

  // POST /api/kyc-service/sessions/:token/complete — subject completes session
  app.post("/api/kyc-service/sessions/:token/complete", async (req: any, res: Response) => {
    try {
      const { token } = req.params;
      const [session] = await db.select().from(kycSessions).where(eq(kycSessions.sessionToken, token));
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.status === "expired") return res.status(410).json({ message: "Session expired" });
      if (session.status === "completed") return res.json({ status: "completed", returnUrl: session.returnUrl, verificationRequestId: session.verificationRequestId });
      if (new Date() > session.expiresAt) {
        await db.update(kycSessions).set({ status: "expired", updatedAt: new Date() }).where(eq(kycSessions.id, session.id));
        return res.status(410).json({ message: "Session expired" });
      }

      const { firstName, lastName, dateOfBirth, selfieBase64, documentObjectPath, documentType } = req.body;

      // Determine which steps are actually required for this session
      const sessionRequiredSteps = session.requiredSteps as string[] | null;
      const prefillData = session.prefillData as Record<string, any> | null;

      // null → all steps required; [] → no steps required; explicit list → those steps
      const selfieRequired = !sessionRequiredSteps || sessionRequiredSteps.includes("selfie");
      const documentRequired = !sessionRequiredSteps || sessionRequiredSteps.includes("documents");
      const identityRequired = !sessionRequiredSteps || sessionRequiredSteps.includes("identity");

      // Accept prefilled document URL as a substitute for document upload
      const effectiveDocumentPath = documentObjectPath || prefillData?.idDocumentUrl || null;

      // Validate only steps that are required and not covered by prefill
      if (identityRequired) {
        const hasFirstName = !!(firstName || prefillData?.firstName);
        const hasLastName = !!(lastName || prefillData?.lastName);
        if (!hasFirstName || !hasLastName) {
          return res.status(422).json({ message: "First name and last name are required to complete verification." });
        }
      }
      if (documentRequired && !effectiveDocumentPath) {
        return res.status(422).json({ message: "A government-issued ID document is required to complete verification." });
      }
      if (selfieRequired && !selfieBase64) {
        return res.status(422).json({ message: "A selfie photograph is required to complete verification." });
      }

      // Build effective subject identity, merging prefill where submission is absent
      const effectiveFirstName = firstName || prefillData?.firstName || null;
      const effectiveLastName = lastName || prefillData?.lastName || null;

      // Build enriched subject name from personal details if provided
      const subjectName = (effectiveFirstName && effectiveLastName)
        ? `${effectiveFirstName} ${effectiveLastName}`.trim()
        : session.subjectName;

      // ── Determine billing tier based on what was collected ─────────────────
      // supplier sessions → supplier tier regardless of steps
      // sessions requiring a selfie → individual tier (full KYC)
      // document/identity only (no selfie) → identity_only tier
      const verificationType: billingService.VerificationType =
        session.type === "supplier" ? "supplier" :
        selfieRequired ? "individual" : "identity_only";

      // ── Shortcut: if subject is a platform user with verified identity, return immediately ──
      // No new Smile checks, no credit deduction — the existing verified identity is the trust signal.
      if (session.subjectEmail) {
        const [subjectUser] = await db.select({ id: users.id })
          .from(users)
          .where(eq(users.email, session.subjectEmail))
          .limit(1);
        if (subjectUser?.id) {
          const [idV] = await db.select({
            status: identityVerifications.status,
            identitySource: identityVerifications.identitySource,
            verifiedAt: identityVerifications.verifiedAt,
          }).from(identityVerifications)
            .where(eq(identityVerifications.founderUserId, subjectUser.id))
            .limit(1);
          if (idV?.status === 'verified') {
            console.log(`[KYC Session] Subject ${session.subjectEmail} is platform-verified — returning shortcut response, no Smile run`);
            // Mark session completed with a shortcut request record so the org sees a result
            const shortcutInviteToken = generateToken();
            const shortcutExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const subjectName = session.subjectName || session.subjectEmail;
            // Shortcut billing: deduct at reduced "identity_only" tier (data retrieval, no Smile run)
            const shortcutBillingType: billingService.VerificationType = "identity_only";
            const shortcutCreditOk = await billingService.hasCredits(session.orgId, shortcutBillingType);
            if (!shortcutCreditOk) {
              return res.status(402).json({
                message: "Insufficient verification credits.",
                code: "INSUFFICIENT_CREDITS",
                verificationType: shortcutBillingType,
              });
            }
            const [shortcutRequest] = await db.insert(kycVerificationRequests).values({
              orgId: session.orgId,
              type: session.type,
              status: "verified",
              subjectEmail: session.subjectEmail,
              subjectName,
              paymentResponsibility: "organisation",
              paymentStatus: "not_required",
              inviteToken: shortcutInviteToken,
              expiresAt: shortcutExpiresAt,
              notes: JSON.stringify({
                source: "platform_identity_shortcut",
                sessionId: session.id,
                identitySource: idV.identitySource,
                verifiedAt: idV.verifiedAt,
                billingType: shortcutBillingType,
              }),
            }).returning();
            await db.update(kycSessions).set({
              status: "completed",
              updatedAt: new Date(),
              verificationRequestId: shortcutRequest.id,
            }).where(eq(kycSessions.id, session.id));
            // Deduct reduced rate credit
            try {
              await billingService.deductCredit(session.orgId, shortcutBillingType, shortcutRequest.id);
            } catch (creditErr) {
              console.error("[KYC Session] Shortcut credit deduction error (non-blocking):", creditErr);
            }
            return res.json({
              status: "verified",
              verificationRequestId: shortcutRequest.id,
              returnUrl: session.returnUrl,
              platformVerifiedShortcut: true,
              identitySource: idV.identitySource,
              verifiedAt: idV.verifiedAt,
            });
          }
        }
      }

      // ── Credit check — gate session before storing anything ────────────────
      const creditOk = await billingService.hasCredits(session.orgId, verificationType);
      if (!creditOk) {
        console.warn(`[KYC Session] Org ${session.orgId} has insufficient credits for ${verificationType} verification`);
        return res.status(402).json({
          message: "Insufficient verification credits. Please top up your account to continue.",
          code: "INSUFFICIENT_CREDITS",
          verificationType,
        });
      }

      // Create a verification request for this session
      const inviteToken = generateToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const notesData: Record<string, any> = { source: "hosted_session", sessionId: session.id, verificationType };
      if (dateOfBirth || prefillData?.dateOfBirth) notesData.dateOfBirth = dateOfBirth || prefillData?.dateOfBirth;
      if (selfieBase64) notesData.selfieSubmitted = true;
      if (prefillData?.idDocumentUrl && !documentObjectPath) notesData.documentPrefilled = true;

      const [request] = await db.insert(kycVerificationRequests).values({
        orgId: session.orgId,
        type: session.type,
        status: "documents_submitted",
        subjectEmail: session.subjectEmail,
        subjectName,
        paymentResponsibility: "organisation",
        paymentStatus: "not_required",
        inviteToken,
        expiresAt,
        notes: JSON.stringify(notesData),
      }).returning();

      // ── Persist documents into kycSubmittedDocuments ──────────────────────
      const allReqs = await db.select().from(kycDocumentRequirements).where(
        and(
          eq(kycDocumentRequirements.type, "individual"),
          eq(kycDocumentRequirements.isStandard, true),
          eq(kycDocumentRequirements.isActive, true),
        )
      );
      const idDocReq = allReqs.find(r => r.documentName === "Government-Issued ID");
      const selfieReq = allReqs.find(r => r.documentName === "Passport Photograph");

      if (effectiveDocumentPath && idDocReq) {
        const fileName = effectiveDocumentPath.split("/").pop() || "id-document";
        await db.insert(kycSubmittedDocuments).values({
          verificationRequestId: request.id,
          requirementId: idDocReq.id,
          fileName,
          filePath: effectiveDocumentPath,
          mimeType: "application/octet-stream",
          status: "uploaded",
          detectedDocumentType: documentType || null,
        });
      }

      // Store selfie to object storage (non-blocking; we keep base64 for biometric check)
      let storedSelfiePath: string | null = null;
      if (selfieBase64 && selfieReq) {
        try {
          const base64Data = selfieBase64.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, "base64");
          const selfieUploadURL = await objectStorageService.getObjectEntityUploadURL();
          storedSelfiePath = objectStorageService.normalizeObjectEntityPath(selfieUploadURL);
          await fetch(selfieUploadURL, {
            method: "PUT",
            body: buffer,
            headers: { "Content-Type": "image/jpeg" },
          });
          await db.insert(kycSubmittedDocuments).values({
            verificationRequestId: request.id,
            requirementId: selfieReq.id,
            fileName: "selfie.jpg",
            filePath: storedSelfiePath,
            mimeType: "image/jpeg",
            status: "uploaded",
            detectedDocumentType: "selfie",
          });
        } catch (selfieErr) {
          console.error("[KYC Session] Selfie storage error (non-blocking):", selfieErr);
        }
      }

      // ── Run verification pipeline ──────────────────────────────────────────
      // These checks run in parallel where possible. Results determine final status.
      const smileRef = `session_${session.id}_${Date.now()}`;

      let faceMatchResult: smileIdService.PhotoCompareResult | null = null;
      let amlResult: smileIdService.AmlCheckResult | null = null;

      const verificationChecks: Promise<void>[] = [];

      // Photo verification — when both a selfie and ID document are available,
      // run document+portrait face comparison (Job Type 6). This is preferred over
      // a selfie-only liveness check because it validates the selfie matches the ID.
      if (selfieRequired && selfieBase64) {
        let documentBase64ForComparison: string | null = null;

        // Attempt to fetch ID document from storage for face comparison
        if (effectiveDocumentPath) {
          try {
            const downloadURL = await objectStorageService.getObjectEntityDownloadURL(effectiveDocumentPath);
            const docResponse = await fetch(downloadURL);
            if (docResponse.ok) {
              const docBuffer = Buffer.from(await docResponse.arrayBuffer());
              documentBase64ForComparison = docBuffer.toString("base64");
            }
          } catch (fetchErr) {
            console.warn("[KYC Session] Could not fetch document for face comparison:", fetchErr);
          }
        }

        // Normalize selfie: strip Data URL prefix if present, keep only raw base64
        const normalizedSelfieBase64 = selfieBase64.replace(/^data:image\/\w+;base64,/, "");

        if (documentBase64ForComparison) {
          // Compare selfie against ID document photo (Job Type 6 — document + portrait)
          const normalizedDocBase64 = documentBase64ForComparison.replace(/^data:image\/\w+;base64,/, "");
          verificationChecks.push(
            smileIdService.compareDocumentToPortrait(normalizedDocBase64, normalizedSelfieBase64, smileRef)
              .then(r => { faceMatchResult = r; })
              .catch(err => {
                console.error("[KYC Session] Face comparison error:", err);
                faceMatchResult = { matched: false, reason: String(err?.message || err) };
              })
          );
        } else {
          // Document retrieval failed — cannot perform face comparison.
          // Mark as a service error so the session goes to in_review for manual processing.
          console.warn(`[KYC Session] Document not available for face comparison (session ${session.id}) — will require manual review`);
          faceMatchResult = { matched: false, reason: "ID document unavailable for face comparison — manual review required" };
        }
      }

      // AML/sanctions screening — always run when we have a full name
      if (subjectName && subjectName.trim().split(" ").length >= 2) {
        verificationChecks.push(
          smileIdService.performAmlCheck(subjectName, smileRef)
            .then(r => { amlResult = r; })
            .catch(err => {
              console.error("[KYC Session] AML check error:", err);
              amlResult = { isHit: false, hitTypes: [], matchDetails: null, error: String(err?.message || err) };
            })
        );
      }

      // Wait for all checks to complete
      await Promise.all(verificationChecks);

      // ── Determine final verification status ───────────────────────────────
      // AML hit → rejected immediately. Face mismatch → in_review. All clear → verified.
      let finalStatus: "verified" | "rejected" | "in_review" = "verified";
      let outcomeNote = "All checks passed";

      if (amlResult && (amlResult as smileIdService.AmlCheckResult).isHit && !(amlResult as smileIdService.AmlCheckResult).error) {
        finalStatus = "rejected";
        outcomeNote = `AML/sanctions match — hit types: ${(amlResult as smileIdService.AmlCheckResult).hitTypes.join(", ") || "unspecified"}`;
      } else if (faceMatchResult && !(faceMatchResult as smileIdService.PhotoCompareResult).matched && !(faceMatchResult as smileIdService.PhotoCompareResult).reason?.includes("unavailable")) {
        // Definitive face mismatch (not a config/network error) → flag for review
        finalStatus = "in_review";
        outcomeNote = `Photo verification failed — ${(faceMatchResult as smileIdService.PhotoCompareResult).reason || "face did not match document"}`;
      } else if ((faceMatchResult as smileIdService.PhotoCompareResult)?.reason?.includes("unavailable") || (amlResult as smileIdService.AmlCheckResult)?.error) {
        // Infrastructure error during checks → keep in_review for manual processing
        finalStatus = "in_review";
        outcomeNote = "Verification checks encountered an error — manual review required";
      }

      // Augment notes with outcome (never expose third-party provider branding externally)
      const updatedNotes: Record<string, any> = { ...notesData, outcome: outcomeNote, status: finalStatus };
      if (faceMatchResult) {
        updatedNotes.faceVerification = {
          matched: (faceMatchResult as smileIdService.PhotoCompareResult).matched,
          confidence: (faceMatchResult as smileIdService.PhotoCompareResult).confidence,
          documentVerified: effectiveDocumentPath ? true : false,
        };
      }
      if (amlResult) {
        updatedNotes.aml = {
          isHit: (amlResult as smileIdService.AmlCheckResult).isHit,
          hitTypes: (amlResult as smileIdService.AmlCheckResult).hitTypes,
        };
      }

      // Generate attestation certificate when session resolves to "verified"
      let sessionCertificateRef: string | null = null;
      let sessionVerifiedSnapshot: KycVerifiedSnapshot | null = null;

      if (finalStatus === "verified") {
        const sessionReviewedAt = new Date();
        const certYear = sessionReviewedAt.getFullYear();
        const certSuffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        sessionCertificateRef = `CO-KYC-${certYear}-${certSuffix}`;

        // Build verified snapshot from session pipeline results
        const faceVerNotes = updatedNotes.faceVerification as { matched?: boolean; confidence?: number; documentVerified?: boolean } | undefined;
        const amlNotes = updatedNotes.aml as { isHit?: boolean; hitTypes?: string[] } | undefined;

        const sessionBiometricVerified = faceVerNotes?.matched === true;
        const sessionFaceMatchConfidence = faceVerNotes?.confidence ?? undefined;
        const sessionAmlScreened = !!amlNotes;
        const sessionAmlClear = amlNotes ? !amlNotes.isHit : undefined;

        // Fetch submitted documents for this session's verification request
        const sessionDocs = await db.select({
          requirementId: kycSubmittedDocuments.requirementId,
          detectedDocumentType: kycSubmittedDocuments.detectedDocumentType,
          extractedData: kycSubmittedDocuments.extractedData,
          expiryDate: kycSubmittedDocuments.expiryDate,
          status: kycSubmittedDocuments.status,
        }).from(kycSubmittedDocuments)
          .where(eq(kycSubmittedDocuments.verificationRequestId, request.id));

        const acceptedSessionDocs = sessionDocs.filter(d => d.status === "accepted" || d.status === "uploaded");
        const sessionRequirements = await db.select().from(kycDocumentRequirements)
          .where(eq(kycDocumentRequirements.isActive, true));

        sessionVerifiedSnapshot = {
          verificationType: request.type as "individual" | "supplier",
          riskScore: "green",
          verificationMethod: sessionBiometricVerified ? "biometric_document_review" : "document_review",
          dataSource: "cellionone_kyc_review",
          verifiedAt: sessionReviewedAt.toISOString(),
          documentsVerified: acceptedSessionDocs.map(d => {
            const req = sessionRequirements.find(r => r.id === d.requirementId);
            const extracted = d.extractedData as Record<string, any> | null;
            const expiryDate = d.expiryDate ? new Date(d.expiryDate) : null;
            return {
              documentName: req?.documentName || d.detectedDocumentType || "Government-Issued ID",
              documentCategory: req?.documentCategory || "identity",
              documentType: d.detectedDocumentType || "identity_document",
              status: "accepted" as const,
              ...(extracted?.name ? { extractedName: String(extracted.name) } : {}),
              ...(extracted?.dateOfBirth || extracted?.dob ? { extractedDateOfBirth: String(extracted.dateOfBirth || extracted.dob) } : {}),
              documentValidity: expiryDate
                ? (expiryDate < new Date() ? "expired" as const : "valid" as const)
                : ("unknown" as const),
            };
          }),
          documentCount: acceptedSessionDocs.length,
          biometricVerified: sessionBiometricVerified,
          livenessConfirmed: sessionBiometricVerified,
          ...(sessionFaceMatchConfidence !== undefined ? { faceMatchConfidence: sessionFaceMatchConfidence } : {}),
          amlScreened: sessionAmlScreened,
          ...(sessionAmlClear !== undefined ? { amlClear: sessionAmlClear } : {}),
        };
      }

      // Update verification request with final status, enriched notes, and certificate if issued
      const sessionUpdatePayload: Record<string, any> = {
        status: finalStatus,
        notes: JSON.stringify(updatedNotes),
        updatedAt: new Date(),
        ...(finalStatus === "verified" ? { reviewedAt: new Date() } : {}),
        ...(sessionCertificateRef ? { certificateRef: sessionCertificateRef } : {}),
        ...(sessionVerifiedSnapshot ? { verifiedDataSnapshot: sessionVerifiedSnapshot } : {}),
      };
      await db.update(kycVerificationRequests)
        .set(sessionUpdatePayload)
        .where(eq(kycVerificationRequests.id, request.id));

      // ── Deduct credit (always — checks were run regardless of outcome) ─────
      try {
        await billingService.deductCredit(session.orgId, verificationType, request.id);
      } catch (creditErr) {
        // Log but don't roll back — the verification was already processed
        console.error("[KYC Session] Credit deduction error (non-blocking):", creditErr);
      }

      // Mark session completed
      await db.update(kycSessions).set({
        status: "completed",
        completedAt: new Date(),
        verificationRequestId: request.id,
        updatedAt: new Date(),
      }).where(eq(kycSessions.id, session.id));

      // Session identity capture variables — declared here so they're in scope for webhook
      let sessionCapturedName: string | null = null;
      let sessionCapturedDob: string | null = null;
      let sessionCapturedPhone: string | null = null;
      let sessionCapturedGender: string | null = null;
      let sessionCapturedAddress: string | null = null;
      const sessionIdTypesForProfile: string[] = [];
      let sessionIdentityProfile: typeof kycVerifiedIdentityData.$inferSelect | null = null;

      // Upsert verified entity registry if the subject was approved
      if (finalStatus === "verified") {
        try {
          const amlStatus = amlResult ? ((amlResult as smileIdService.AmlCheckResult).isHit ? "hit" : "clear") : null;
          const requestForRegistry: KycVerificationRequest = { ...request, status: finalStatus, updatedAt: new Date() };
          await upsertVerifiedEntity({
            request: requestForRegistry,
            orgId: session.orgId,
            amlScreeningStatus: amlStatus,
          });
        } catch (registryErr) {
          console.error("[KYC Session] Registry upsert error (non-blocking):", registryErr);
        }

        // Extract identity fields from session submission data
        const sessionDobForProfile = notesData.dateOfBirth as string | undefined;
        sessionCapturedDob = sessionDobForProfile || null;
        const sessionDocRows = await db.select({
          detectedDocumentType: kycSubmittedDocuments.detectedDocumentType,
          extractedData: kycSubmittedDocuments.extractedData,
        }).from(kycSubmittedDocuments).where(eq(kycSubmittedDocuments.verificationRequestId, request.id));
        for (const doc of sessionDocRows) {
          const rawExt = doc.extractedData;
          const ext = (rawExt && typeof rawExt === "object" && !Array.isArray(rawExt))
            ? (rawExt as Record<string, unknown>)
            : null;
          if (ext) {
            const sv = (v: unknown) => (v ? String(v) : undefined);
            if (!sessionCapturedName && (ext.name || ext.fullName)) sessionCapturedName = sv(ext.name ?? ext.fullName) || null;
            if (!sessionCapturedDob && (ext.dateOfBirth || ext.dob)) sessionCapturedDob = sv(ext.dateOfBirth ?? ext.dob) || null;
            if (!sessionCapturedPhone && (ext.phone || ext.phoneNumber || ext.PhoneNumber)) sessionCapturedPhone = sv(ext.phone ?? ext.phoneNumber ?? ext.PhoneNumber) || null;
            if (!sessionCapturedGender && (ext.gender || ext.Gender)) sessionCapturedGender = sv(ext.gender ?? ext.Gender) || null;
            if (!sessionCapturedAddress && (ext.address || ext.Address)) sessionCapturedAddress = sv(ext.address ?? ext.Address) || null;
          }
          if (doc.detectedDocumentType) sessionIdTypesForProfile.push(doc.detectedDocumentType);
        }
        if (!sessionCapturedName) sessionCapturedName = subjectName || null;
        if (!sessionCapturedPhone && notesData.phoneNumber) sessionCapturedPhone = String(notesData.phoneNumber);
        if (!sessionCapturedGender && notesData.gender) sessionCapturedGender = String(notesData.gender);
        if (!sessionCapturedAddress && notesData.address) sessionCapturedAddress = String(notesData.address);

        // Await capture so hasGovernmentPhoto is known before firing webhook.
        // Government photo is only captured when returned by Smile ID ID lookup — not substituted with selfie.
        await captureVerifiedIdentityProfile({
          verificationRequestId: request.id,
          orgId: session.orgId,
          fullName: sessionCapturedName,
          dateOfBirth: sessionCapturedDob,
          phone: sessionCapturedPhone,
          gender: sessionCapturedGender,
          address: sessionCapturedAddress,
          idTypesVerified: sessionIdTypesForProfile.length ? sessionIdTypesForProfile : undefined,
          dataSource: "hosted_session",
        }).catch(err => console.error("[IdentityProfile] Session capture error:", err));

        // Fetch back to get hasGovernmentPhoto / capturedAt for webhook
        const [idp] = await db.select().from(kycVerifiedIdentityData)
          .where(eq(kycVerifiedIdentityData.verificationRequestId, request.id));
        sessionIdentityProfile = idp || null;
      }

      // Build return URL with session params appended
      let returnUrlWithParams = session.returnUrl;
      if (returnUrlWithParams) {
        const separator = returnUrlWithParams.includes("?") ? "&" : "?";
        returnUrlWithParams = `${returnUrlWithParams}${separator}session_id=${session.id}&status=${finalStatus}`;
      }

      // Compute clean face check result fields for webhook.
      // documentVerified reflects whether a document was supplied and used in the comparison attempt,
      // independent of the face-match outcome (faceMatch captures that separately).
      const typedFaceResult = faceMatchResult as smileIdService.PhotoCompareResult | null;
      const webhookFaceMatch = typedFaceResult ? typedFaceResult.matched : null;
      const webhookDocumentVerified = !!(selfieRequired && selfieBase64 && effectiveDocumentPath);

      // Build attestation URL if certificate was issued
      const sessionBaseUrl = process.env.NODE_ENV === "production"
        ? "https://cellionone.com"
        : `http://localhost:${process.env.PORT || 5000}`;
      const sessionCertificateUrl = sessionCertificateRef
        ? `${sessionBaseUrl}/api/v1/kyc/attest/${sessionCertificateRef}`
        : null;

      // Fire webhook — "verification.completed" with outcome (NO third-party branding)
      const sessionWebhookBody: Record<string, any> = {
        sessionId: session.id,
        sessionToken: token,
        verificationRequestId: request.id,
        subjectEmail: session.subjectEmail,
        subjectName,
        verificationType,
        status: finalStatus,
        outcome: outcomeNote,
        faceMatch: webhookFaceMatch,
        documentVerified: webhookDocumentVerified,
        faceMatchConfidence: typedFaceResult?.confidence ?? null,
        amlScreened: !!(subjectName && subjectName.trim().split(" ").length >= 2),
        metadata: session.metadata,
        ...(sessionCertificateRef ? { certificateRef: sessionCertificateRef } : {}),
        ...(sessionCertificateUrl ? { certificateUrl: sessionCertificateUrl } : {}),
      };
      if (finalStatus === "verified" && sessionCapturedName) {
        sessionWebhookBody.verifiedIdentity = {
          fullName: sessionCapturedName,
          dateOfBirth: sessionCapturedDob || null,
          phone: sessionCapturedPhone || null,
          gender: sessionCapturedGender || null,
          address: sessionCapturedAddress || null,
          idTypesVerified: sessionIdTypesForProfile.length ? sessionIdTypesForProfile : [],
          dataSource: "hosted_session",
          hasGovernmentPhoto: !!sessionIdentityProfile?.governmentPhotoPath,
          capturedAt: sessionIdentityProfile?.capturedAt?.toISOString() || null,
        };
      }
      await webhookService.deliverWebhook(session.orgId, "verification.completed", sessionWebhookBody);

      res.json({
        status: "completed",
        verificationStatus: finalStatus,
        returnUrl: returnUrlWithParams,
        verificationRequestId: request.id,
      });
    } catch (error: any) {
      console.error("[KYC Session] Complete session error:", error);
      res.status(500).json({ message: "Failed to complete session" });
    }
  });

  // ============== ORG SESSION MANAGEMENT (authenticated) ==============

  // GET /api/kyc-service/orgs/:id/sessions
  app.get("/api/kyc-service/orgs/:id/sessions", isAuthenticated, requireOrgMember(), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const sessions = await db.select().from(kycSessions)
        .where(eq(kycSessions.orgId, orgId))
        .orderBy(desc(kycSessions.createdAt))
        .limit(100);

      // Mark expired sessions — any non-completed, non-already-expired session past expiresAt
      const now = new Date();
      for (const s of sessions) {
        if (s.expiresAt < now && s.status !== "expired" && s.status !== "completed") {
          await db.update(kycSessions).set({ status: "expired", updatedAt: new Date() }).where(eq(kycSessions.id, s.id));
          s.status = "expired";
        }
      }

      res.json({ sessions });
    } catch (error: any) {
      console.error("[KYC Sessions] List error:", error);
      res.status(500).json({ message: "Failed to list sessions" });
    }
  });

  // ============== ORG SANCTIONS MONITORING (authenticated) ==============

  // GET /api/kyc-service/orgs/:id/sanctions-logs
  app.get("/api/kyc-service/orgs/:id/sanctions-logs", isAuthenticated, requireOrgMember(), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const logs = await db.select().from(kycSanctionsLogs)
        .where(eq(kycSanctionsLogs.orgId, orgId))
        .orderBy(desc(kycSanctionsLogs.createdAt))
        .limit(100);

      res.json({ logs });
    } catch (error: any) {
      console.error("[KYC Sanctions] List logs error:", error);
      res.status(500).json({ message: "Failed to list sanctions logs" });
    }
  });

  // GET /api/kyc-service/orgs/:id/expiry-alerts — upcoming document expiry for the org's verified individuals
  app.get("/api/kyc-service/orgs/:id/expiry-alerts", isAuthenticated, requireOrgMember(), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const now = new Date();
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const expiringDocs = await db.select({
        docId: kycSubmittedDocuments.id,
        docFileName: kycSubmittedDocuments.fileName,
        docExpiryDate: kycSubmittedDocuments.expiryDate,
        docStatus: kycSubmittedDocuments.status,
        requestId: kycVerificationRequests.id,
        requestStatus: kycVerificationRequests.status,
        subjectName: kycVerificationRequests.subjectName,
        subjectEmail: kycVerificationRequests.subjectEmail,
        riskScore: kycVerificationRequests.riskScore,
      })
        .from(kycSubmittedDocuments)
        .innerJoin(kycVerificationRequests, eq(kycSubmittedDocuments.verificationRequestId, kycVerificationRequests.id))
        .where(and(
          eq(kycVerificationRequests.orgId, orgId),
          sql`${kycSubmittedDocuments.expiryDate} IS NOT NULL`,
          sql`${kycSubmittedDocuments.expiryDate} <= ${thirtyDays}`,
          eq(kycSubmittedDocuments.status, "accepted"),
        ))
        .orderBy(kycSubmittedDocuments.expiryDate);

      const result = expiringDocs.map(row => {
        const expiry = new Date(row.docExpiryDate!);
        const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        return {
          docId: row.docId,
          docFileName: row.docFileName,
          expiryDate: row.docExpiryDate,
          daysLeft,
          isExpired: expiry < now,
          isUrgent: daysLeft <= 7 && daysLeft >= 0,
          requestId: row.requestId,
          requestStatus: row.requestStatus,
          subjectName: row.subjectName,
          subjectEmail: row.subjectEmail,
          riskScore: row.riskScore,
        };
      });

      res.json({ alerts: result, count: result.length });
    } catch (error: any) {
      console.error("[KYC Expiry] List alerts error:", error);
      res.status(500).json({ message: "Failed to get expiry alerts" });
    }
  });

  // ============== SANCTIONS LOG HIT REVIEW ==============

  // PATCH /api/kyc-service/orgs/:id/sanctions-logs/:logId/review
  app.patch("/api/kyc-service/orgs/:id/sanctions-logs/:logId/review", isAuthenticated, requireOrgMember(["org_admin", "org_reviewer"]), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const logId = parseInt(req.params.logId);
      const { reviewStatus, reviewNote } = req.body;

      if (!reviewStatus || !["cleared", "escalated"].includes(reviewStatus)) {
        return res.status(400).json({ message: "reviewStatus must be 'cleared' or 'escalated'" });
      }
      if (!reviewNote || String(reviewNote).trim().length < 10) {
        return res.status(400).json({ message: "A review note (minimum 10 characters) is required" });
      }

      const [log] = await db.select().from(kycSanctionsLogs)
        .where(and(eq(kycSanctionsLogs.id, logId), eq(kycSanctionsLogs.orgId, orgId)));
      if (!log) return res.status(404).json({ message: "Sanctions log not found" });

      const [updated] = await db.update(kycSanctionsLogs)
        .set({
          reviewStatus,
          reviewNote: reviewNote.trim(),
          reviewedByUserId: req.user?.id,
          reviewedAt: new Date(),
        })
        .where(eq(kycSanctionsLogs.id, logId))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("[KYC Sanctions] Review error:", error);
      res.status(500).json({ message: "Failed to update review" });
    }
  });

  // Admin: GET /api/kyc-service/admin/sanctions-overview — orgs with open hits
  app.get("/api/kyc-service/admin/sanctions-overview", isAuthenticated, async (req: any, res: Response) => {
    try {
      if (!req.user?.roles?.includes("admin")) return res.status(403).json({ message: "Admin only" });

      const openHits = await db.select({
        orgId: kycSanctionsLogs.orgId,
        orgName: kycOrganisations.name,
        openCount: count(kycSanctionsLogs.id),
        mostRecentAt: sql<string>`MAX(${kycSanctionsLogs.createdAt})`,
      })
        .from(kycSanctionsLogs)
        .innerJoin(kycOrganisations, eq(kycSanctionsLogs.orgId, kycOrganisations.id))
        .where(and(
          eq(kycSanctionsLogs.screeningResult, "alert"),
          eq(kycSanctionsLogs.reviewStatus, "open"),
        ))
        .groupBy(kycSanctionsLogs.orgId, kycOrganisations.name)
        .orderBy(desc(sql`MAX(${kycSanctionsLogs.createdAt})`));

      res.json({ orgs: openHits });
    } catch (error: any) {
      console.error("[KYC Sanctions] Admin overview error:", error);
      res.status(500).json({ message: "Failed to get sanctions overview" });
    }
  });

  // ============== STR REPORTS ==============

  const strReportCreateSchema = z.object({
    verificationRequestId: z.number().optional().nullable(),
    subjectName: z.string().min(2),
    subjectCertificateRef: z.string().optional().nullable(),
    suspiciousActivityDescription: z.string().min(20),
    transactionAmountKobo: z.number().optional().nullable(),
    activityDateFrom: z.string().optional().nullable(),
    activityDateTo: z.string().optional().nullable(),
    reporterName: z.string().min(2),
    reporterRole: z.string().min(2),
    notes: z.string().optional().nullable(),
  });

  const strReportUpdateSchema = z.object({
    status: z.enum(["draft", "internally_reviewed", "filed"]).optional(),
    suspiciousActivityDescription: z.string().min(20).optional(),
    transactionAmountKobo: z.number().optional().nullable(),
    activityDateFrom: z.string().optional().nullable(),
    activityDateTo: z.string().optional().nullable(),
    reporterName: z.string().min(2).optional(),
    reporterRole: z.string().min(2).optional(),
    notes: z.string().optional().nullable(),
    nfiuReference: z.string().optional().nullable(),
  });

  // POST /api/kyc-service/orgs/:id/str-reports
  app.post("/api/kyc-service/orgs/:id/str-reports", isAuthenticated, requireOrgMember(["org_admin", "org_reviewer"]), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const data = strReportCreateSchema.parse(req.body);

      const [created] = await db.insert(kycStrReports).values({
        orgId,
        ...data,
        status: "draft",
        createdByUserId: req.user!.id,
      }).returning();

      res.status(201).json(created);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC STR] Create error:", error);
      res.status(500).json({ message: "Failed to create STR report" });
    }
  });

  // GET /api/kyc-service/orgs/:id/str-reports
  app.get("/api/kyc-service/orgs/:id/str-reports", isAuthenticated, requireOrgMember(), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const reports = await db.select().from(kycStrReports)
        .where(eq(kycStrReports.orgId, orgId))
        .orderBy(desc(kycStrReports.createdAt));

      res.json({ reports });
    } catch (error: any) {
      console.error("[KYC STR] List error:", error);
      res.status(500).json({ message: "Failed to list STR reports" });
    }
  });

  // GET /api/kyc-service/orgs/:id/str-reports/:reportId
  app.get("/api/kyc-service/orgs/:id/str-reports/:reportId", isAuthenticated, requireOrgMember(), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const reportId = parseInt(req.params.reportId);

      const [report] = await db.select().from(kycStrReports)
        .where(and(eq(kycStrReports.id, reportId), eq(kycStrReports.orgId, orgId)));
      if (!report) return res.status(404).json({ message: "Report not found" });

      res.json(report);
    } catch (error: any) {
      console.error("[KYC STR] Get error:", error);
      res.status(500).json({ message: "Failed to get STR report" });
    }
  });

  // PATCH /api/kyc-service/orgs/:id/str-reports/:reportId
  app.patch("/api/kyc-service/orgs/:id/str-reports/:reportId", isAuthenticated, requireOrgMember(["org_admin", "org_reviewer"]), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const reportId = parseInt(req.params.reportId);
      const data = strReportUpdateSchema.parse(req.body);

      const [report] = await db.select().from(kycStrReports)
        .where(and(eq(kycStrReports.id, reportId), eq(kycStrReports.orgId, orgId)));
      if (!report) return res.status(404).json({ message: "Report not found" });
      if (report.status === "filed") return res.status(400).json({ message: "Filed reports cannot be edited" });

      // Status transition validations
      if (data.status === "filed") {
        if (!data.nfiuReference && !report.nfiuReference) {
          return res.status(400).json({ message: "NFIU reference number is required to mark as filed" });
        }
      }

      const updateData: Record<string, any> = { ...data, updatedAt: new Date() };
      if (data.status === "internally_reviewed" && report.status === "draft") {
        updateData.reviewedByUserId = req.user!.id;
        updateData.reviewedAt = new Date();
      }
      if (data.status === "filed") {
        updateData.filedAt = new Date();
      }

      const [updated] = await db.update(kycStrReports)
        .set(updateData)
        .where(and(eq(kycStrReports.id, reportId), eq(kycStrReports.orgId, orgId)))
        .returning();

      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC STR] Update error:", error);
      res.status(500).json({ message: "Failed to update STR report" });
    }
  });

  // Admin: GET /api/kyc-service/admin/str-reports — cross-org view
  app.get("/api/kyc-service/admin/str-reports", isAuthenticated, async (req: any, res: Response) => {
    try {
      if (!req.user?.roles?.includes("admin")) return res.status(403).json({ message: "Admin only" });

      const statusFilter = req.query.status as string | undefined;
      const orgFilter = req.query.orgId ? parseInt(req.query.orgId as string) : undefined;

      let query = db.select({
        id: kycStrReports.id,
        orgId: kycStrReports.orgId,
        orgName: kycOrganisations.name,
        subjectName: kycStrReports.subjectName,
        subjectCertificateRef: kycStrReports.subjectCertificateRef,
        status: kycStrReports.status,
        reporterName: kycStrReports.reporterName,
        createdAt: kycStrReports.createdAt,
        updatedAt: kycStrReports.updatedAt,
        filedAt: kycStrReports.filedAt,
        nfiuReference: kycStrReports.nfiuReference,
      })
        .from(kycStrReports)
        .innerJoin(kycOrganisations, eq(kycStrReports.orgId, kycOrganisations.id))
        .$dynamic();

      const conditions: Parameters<typeof and>[0][] = [];
      if (statusFilter) conditions.push(eq(kycStrReports.status, statusFilter));
      if (orgFilter) conditions.push(eq(kycStrReports.orgId, orgFilter));
      const strQuery = conditions.length > 0
        ? query.where(and(...conditions)).orderBy(desc(kycStrReports.createdAt)).limit(200)
        : query.orderBy(desc(kycStrReports.createdAt)).limit(200);

      const reports = await strQuery;
      res.json({ reports });
    } catch (error: any) {
      console.error("[KYC STR] Admin list error:", error);
      res.status(500).json({ message: "Failed to list STR reports" });
    }
  });

  // Admin: GET /api/kyc-service/admin/identity-records — cross-org verified identity profiles
  app.get("/api/kyc-service/admin/identity-records", isAuthenticated, requireAdmin, async (req: any, res: Response) => {
    try {

      const rows = await db
        .select({
          id: kycVerifiedIdentityData.id,
          verificationRequestId: kycVerifiedIdentityData.verificationRequestId,
          fullName: kycVerifiedIdentityData.fullName,
          dateOfBirth: kycVerifiedIdentityData.dateOfBirth,
          phone: kycVerifiedIdentityData.phone,
          gender: kycVerifiedIdentityData.gender,
          idTypesVerified: kycVerifiedIdentityData.idTypesVerified,
          governmentPhotoPath: kycVerifiedIdentityData.governmentPhotoPath,
          capturedAt: kycVerifiedIdentityData.capturedAt,
          orgId: kycVerificationRequests.orgId,
          orgName: kycOrganisations.name,
          subjectName: kycVerificationRequests.subjectName,
          subjectEmail: kycVerificationRequests.subjectEmail,
          requestType: kycVerificationRequests.type,
          certificateRef: kycVerificationRequests.certificateRef,
        })
        .from(kycVerifiedIdentityData)
        .innerJoin(kycVerificationRequests, eq(kycVerifiedIdentityData.verificationRequestId, kycVerificationRequests.id))
        .innerJoin(kycOrganisations, eq(kycVerificationRequests.orgId, kycOrganisations.id))
        .orderBy(desc(kycVerifiedIdentityData.capturedAt))
        .limit(500);

      const records = rows.map(r => ({ ...r, hasGovernmentPhoto: !!r.governmentPhotoPath, governmentPhotoPath: undefined }));
      res.json({ records });
    } catch (error: any) {
      console.error("[KYC Identity] Admin list error:", error);
      res.status(500).json({ message: "Failed to list identity records" });
    }
  });

  // ============ ADMIN: RESCREENING BATCHES ============

  // GET /api/admin/kyc/rescreening-batches — list all batches (newest first)
  app.get("/api/admin/kyc/rescreening-batches", isAuthenticated, requireAdmin, async (_req: any, res: Response) => {
    try {
      const batches = await db.select().from(kycRescreeningBatches)
        .orderBy(desc(kycRescreeningBatches.createdAt))
        .limit(50);

      const batchIds = batches.map(b => b.id);
      const allItems = batchIds.length
        ? await db.select().from(kycRescreeningBatchItems)
            .where(inArray(kycRescreeningBatchItems.batchId, batchIds))
            .orderBy(asc(kycRescreeningBatchItems.id))
        : [];

      const itemsByBatch = new Map<number, typeof allItems>();
      for (const item of allItems) {
        if (!itemsByBatch.has(item.batchId)) itemsByBatch.set(item.batchId, []);
        itemsByBatch.get(item.batchId)!.push(item);
      }

      const result = batches.map(b => ({
        ...b,
        items: itemsByBatch.get(b.id) ?? [],
      }));

      res.json({ batches: result });
    } catch (err: any) {
      console.error("[Rescreening] List error:", err);
      res.status(500).json({ message: "Failed to list rescreening batches" });
    }
  });

  // POST /api/admin/kyc/rescreening-batches/:batchId/approve
  // Body: { itemIds?: number[] } — if omitted, approves all pending items in the batch
  app.post("/api/admin/kyc/rescreening-batches/:batchId/approve", isAuthenticated, requireAdmin, async (req: any, res: Response) => {
    const batchId = parseInt(req.params.batchId, 10);
    if (isNaN(batchId)) return res.status(400).json({ message: "Invalid batch ID" });

    const { itemIds } = req.body as { itemIds?: number[] };

    try {
      const [batch] = await db.select().from(kycRescreeningBatches)
        .where(eq(kycRescreeningBatches.id, batchId));

      if (!batch) return res.status(404).json({ message: "Batch not found" });
      if (batch.status !== "pending") return res.status(400).json({ message: "Batch is not in pending status" });

      // Determine which items to process
      const allItems = await db.select().from(kycRescreeningBatchItems)
        .where(eq(kycRescreeningBatchItems.batchId, batchId));

      const toApprove = allItems.filter(i =>
        !i.skipped &&
        !i.screeningResult &&
        (!itemIds || itemIds.includes(i.id))
      );

      const results: { itemId: number; subjectName: string; result?: string; error?: string }[] = [];

      for (const item of toApprove) {
        const outcome = await executeRescreeningItem(item.id, batchId);
        results.push({ itemId: item.id, subjectName: item.subjectName, ...outcome });
      }

      // Recalculate batch counters
      const refreshedItems = await db.select().from(kycRescreeningBatchItems)
        .where(eq(kycRescreeningBatchItems.batchId, batchId));

      const approvedCount = refreshedItems.filter(i => !!i.screeningResult && !i.skipped).length;
      const skippedCount = refreshedItems.filter(i => i.skipped).length;
      const pendingCount = refreshedItems.filter(i => !i.screeningResult && !i.skipped).length;
      const newStatus = pendingCount === 0 ? "approved" : "pending";

      await db.update(kycRescreeningBatches)
        .set({
          approvedItems: approvedCount,
          skippedItems: skippedCount,
          status: newStatus,
          resolvedAt: newStatus === "approved" ? new Date() : null,
          resolvedByUserId: newStatus === "approved" ? req.user?.claims?.sub : null,
        })
        .where(eq(kycRescreeningBatches.id, batchId));

      await req.storage?.createAuditLog?.({
        actorUserId: req.user?.claims?.sub,
        action: "kyc_rescreening_batch_approved",
        entityType: "kyc_rescreening_batch",
        entityId: String(batchId),
        details: { approvedCount: toApprove.length, results },
        ipAddress: req.ip,
      });

      res.json({ message: "Screening complete", results, batchStatus: newStatus });
    } catch (err: any) {
      console.error("[Rescreening] Approve error:", err);
      res.status(500).json({ message: "Failed to process rescreening batch" });
    }
  });

  // POST /api/admin/kyc/rescreening-batches/:batchId/items/:itemId/skip
  app.post("/api/admin/kyc/rescreening-batches/:batchId/items/:itemId/skip", isAuthenticated, requireAdmin, async (req: any, res: Response) => {
    const batchId = parseInt(req.params.batchId, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(batchId) || isNaN(itemId)) return res.status(400).json({ message: "Invalid ID" });

    const { note } = req.body as { note?: string };

    try {
      const [item] = await db.select().from(kycRescreeningBatchItems)
        .where(and(
          eq(kycRescreeningBatchItems.id, itemId),
          eq(kycRescreeningBatchItems.batchId, batchId),
        ));

      if (!item) return res.status(404).json({ message: "Item not found" });
      if (item.screeningResult) return res.status(400).json({ message: "Item already screened" });

      await db.update(kycRescreeningBatchItems)
        .set({ skipped: true, skipNote: note || null })
        .where(eq(kycRescreeningBatchItems.id, itemId));

      // Recalculate batch counters and check if all items are resolved
      const allAfterSkip = await db.select().from(kycRescreeningBatchItems)
        .where(eq(kycRescreeningBatchItems.batchId, batchId));

      const skippedTotal = allAfterSkip.filter(i => i.skipped).length;
      const screenedTotal = allAfterSkip.filter(i => !!i.screeningResult && !i.skipped).length;
      const stillPending = allAfterSkip.filter(i => !i.screeningResult && !i.skipped).length;

      // If nothing is left pending, resolve the batch to avoid permanent pending deadlock
      const resolvedStatus = stillPending === 0
        ? (screenedTotal > 0 ? "approved" : "dismissed")
        : "pending";

      await db.update(kycRescreeningBatches)
        .set({
          skippedItems: skippedTotal,
          approvedItems: screenedTotal,
          status: resolvedStatus,
          resolvedAt: stillPending === 0 ? new Date() : null,
          resolvedByUserId: stillPending === 0 ? (req.user?.claims?.sub ?? null) : null,
        })
        .where(eq(kycRescreeningBatches.id, batchId));

      res.json({ message: "Item skipped", batchStatus: resolvedStatus });
    } catch (err: any) {
      console.error("[Rescreening] Skip error:", err);
      res.status(500).json({ message: "Failed to skip item" });
    }
  });

  console.log("[KYC Service] Routes registered");
}
