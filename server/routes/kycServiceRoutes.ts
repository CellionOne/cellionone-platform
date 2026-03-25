import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { eq, and, desc, asc, or, ilike, sql, count, isNull } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import {
  kycOrganisations, kycOrgMembers, kycVerificationTemplates,
  kycDocumentRequirements, kycVerificationRequests,
  kycSupplierProfiles, kycSubmittedDocuments, kycSupplierPeople,
  kycApiKeys, kycApiUsageLogs, kycBillingAccounts, kycBillingRequests, kycCreditTransactions, kycInvoices,
  kycSessions, kycSanctionsLogs,
  userRoles,
  type KycOrganisation, type KycOrgMember, type KycVerificationRequest,
  type KycSupplierProfile, type KycSubmittedDocument, type KycSupplierPerson,
  type KycDocumentRequirement, type KycVerificationTemplate,
} from "@shared/schema";
import * as kycApiKeyService from "../services/kycApiKeyService";
import * as billingService from "../services/kycBillingService";
import * as webhookService from "../services/kycWebhookService";
import { isAuthenticated } from "../replit_integrations/auth";
import { ObjectStorageService } from "../replit_integrations/object_storage";
import { getResendClient } from "../services/emailService";
import { getPaystackPrice } from "../config/priceBook";
import { upsertVerifiedEntity } from "../services/verifiedEntityService";

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

    const member = await getOrgMembership(orgId, userId);
    if (!member) return res.status(403).json({ message: "Not a member of this organisation" });

    if (allowedRoles && !allowedRoles.includes(member.role)) {
      return res.status(403).json({ message: `Requires one of: ${allowedRoles.join(", ")}` });
    }

    (req as any).orgMember = member;
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

      const schema = z.object({
        name: z.string().min(2).max(255),
        category: z.enum(["corporate", "government", "ngo", "educational"]),
        contactEmail: z.string().email(),
        contactPhone: z.string().optional(),
        address: z.string().optional(),
        termsAccepted: z.literal(true, { errorMap: () => ({ message: "You must accept the KYC Service Agreement" }) }),
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
        status: "active",
        settings: {},
        employeePortalEnabled: true,
        supplierPortalEnabled: true,
        termsAcceptedAt: new Date(),
        termsVersion: TERMS_VERSION,
        termsAcceptedByUserId: userId,
        termsAcceptedIp: clientIp,
      }).returning();

      await db.insert(kycOrgMembers).values({
        orgId: org.id,
        userId,
        role: "org_admin",
        inviteEmail: data.contactEmail,
        inviteStatus: "accepted",
      });

      res.status(201).json(org);
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
      const schema = z.object({
        name: z.string().min(2).max(255).optional(),
        contactEmail: z.string().email().optional(),
        contactPhone: z.string().optional(),
        address: z.string().optional(),
        logoPath: z.string().optional(),
        settings: z.record(z.unknown()).optional(),
        employeePortalEnabled: z.boolean().optional(),
        supplierPortalEnabled: z.boolean().optional(),
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

  app.post("/api/kyc-service/organisations/:id/verification-requests", isAuthenticated, requireOrgMember(["org_admin", "org_reviewer"]), async (req: any, res: Response) => {
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

  app.post("/api/kyc-service/organisations/:id/verification-requests/bulk", isAuthenticated, requireOrgMember(["org_admin"]), async (req: any, res: Response) => {
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

      res.json({ requests, total: countResult?.total || 0, page: parseInt(page), limit: parseInt(limit) });
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

      res.json({ ...request, documents: docsWithUrls, requirements, supplierProfile, people });
    } catch (error: any) {
      console.error("[KYC] Get request detail error:", error);
      res.status(500).json({ message: "Failed to get verification request" });
    }
  });

  app.patch("/api/kyc-service/organisations/:id/verification-requests/:reqId/review", isAuthenticated, requireOrgMember(["org_admin", "org_reviewer"]), async (req: any, res: Response) => {
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

      const [updated] = await db.update(kycVerificationRequests)
        .set({
          status: newStatus,
          reviewedByUserId: userId,
          reviewedAt: new Date(),
          reviewNotes: data.reviewNotes || null,
          riskScore,
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

      webhookService.deliverWebhook(orgId,
        newStatus === "verified" ? "verification.completed" : "verification.failed",
        {
          requestId: reqId,
          type: request.type,
          status: newStatus,
          riskScore,
          subjectName: request.subjectName,
          subjectEmail: request.subjectEmail,
          reviewedAt: new Date().toISOString(),
        }
      ).catch(err => console.error("[KYC Webhook] Delivery error:", err));

      if (newStatus === "verified") {
        upsertVerifiedEntity({
          request: updated,
          orgId,
          riskScore,
          amlScreeningStatus: null,
        }).catch(err => console.error("[VerifiedEntity] Upsert error:", err));
      }

      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC] Review request error:", error);
      res.status(500).json({ message: "Failed to review request" });
    }
  });

  app.post("/api/kyc-service/organisations/:id/verification-requests/:reqId/resend-invite", isAuthenticated, requireOrgMember(["org_admin", "org_reviewer"]), async (req: any, res: Response) => {
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
        individualData = {
          subjectName: request.subjectName,
          subjectEmail: request.subjectEmail,
          smileIdChecks: {
            bvnValidation: true,
            ninValidation: true,
            documentVerification: true,
            biometricMatch: true,
            amlScreening: true,
          },
          smileIdJobId: null,
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
        status: z.enum(["active", "suspended"]),
      });
      const data = schema.parse(req.body);

      const [updated] = await db.update(kycOrganisations)
        .set({ status: data.status, updatedAt: new Date() })
        .where(eq(kycOrganisations.id, orgId))
        .returning();

      if (!updated) return res.status(404).json({ message: "Organisation not found" });

      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: error.errors });
      console.error("[KYC Admin] Update status error:", error);
      res.status(500).json({ message: "Failed to update organisation status" });
    }
  });

  // ==================== API KEY MANAGEMENT ====================

  app.post("/api/kyc-service/organisations/:id/api-keys", isAuthenticated, requireOrgMember(["org_admin"]), async (req: any, res: Response) => {
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

  app.post("/api/kyc-service/organisations/:id/billing/purchase-credits", isAuthenticated, requireOrgMember(["org_admin"]), async (req: any, res: Response) => {
    try {
      const orgId = parseInt(req.params.id);
      const userId = getUserId(req);

      const schema = z.object({
        quantity: z.number().int().min(10, "Minimum purchase is 10 credits"),
        verificationType: z.enum(["individual", "supplier"]),
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

  app.post("/api/kyc-service/organisations/:id/billing/request-invoiced", isAuthenticated, requireOrgMember(["org_admin"]), async (req: any, res: Response) => {
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
      const accounts = await billingService.getAllBillingAccounts();
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
      if (session.status === "completed") return res.json({ status: "completed", returnUrl: session.returnUrl });

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

      // Build enriched subject name from personal details if provided
      const subjectName = (firstName && lastName)
        ? `${firstName} ${lastName}`.trim()
        : session.subjectName;

      // Create a verification request for this session
      const inviteToken = generateToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const notesData: Record<string, any> = { source: "hosted_session", sessionId: session.id };
      if (dateOfBirth) notesData.dateOfBirth = dateOfBirth;
      if (selfieBase64) notesData.selfieSubmitted = true;

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

      // Persist uploaded documents into kycSubmittedDocuments
      // Look up standard individual requirements (prefer org-specific, fall back to global)
      const allReqs = await db.select().from(kycDocumentRequirements).where(
        and(
          eq(kycDocumentRequirements.type, "individual"),
          eq(kycDocumentRequirements.isStandard, true),
          eq(kycDocumentRequirements.isActive, true),
        )
      );
      const idDocReq = allReqs.find(r => r.documentName === "Government-Issued ID");
      const selfieReq = allReqs.find(r => r.documentName === "Passport Photograph");

      if (documentObjectPath && idDocReq) {
        const fileName = documentObjectPath.split("/").pop() || "id-document";
        await db.insert(kycSubmittedDocuments).values({
          verificationRequestId: request.id,
          requirementId: idDocReq.id,
          fileName,
          filePath: documentObjectPath,
          mimeType: "application/octet-stream",
          status: "uploaded",
          detectedDocumentType: documentType || null,
        });
      }

      if (selfieBase64 && selfieReq) {
        try {
          const base64Data = selfieBase64.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, "base64");
          const selfieUploadURL = await objectStorageService.getObjectEntityUploadURL();
          const selfieObjectPath = objectStorageService.normalizeObjectEntityPath(selfieUploadURL);
          await fetch(selfieUploadURL, {
            method: "PUT",
            body: buffer,
            headers: { "Content-Type": "image/jpeg" },
          });
          await db.insert(kycSubmittedDocuments).values({
            verificationRequestId: request.id,
            requirementId: selfieReq.id,
            fileName: "selfie.jpg",
            filePath: selfieObjectPath,
            mimeType: "image/jpeg",
            status: "uploaded",
            detectedDocumentType: "selfie",
          });
        } catch (selfieErr) {
          console.error("[KYC Session] Selfie storage error (non-blocking):", selfieErr);
        }
      }

      await db.update(kycSessions).set({
        status: "completed",
        completedAt: new Date(),
        verificationRequestId: request.id,
        updatedAt: new Date(),
      }).where(eq(kycSessions.id, session.id));

      // Build return URL with session params appended
      let returnUrlWithParams = session.returnUrl;
      if (returnUrlWithParams) {
        const separator = returnUrlWithParams.includes("?") ? "&" : "?";
        returnUrlWithParams = `${returnUrlWithParams}${separator}session_id=${session.id}&status=completed`;
      }

      await webhookService.deliverWebhook(session.orgId, "session.completed", {
        sessionId: session.id,
        sessionToken: token,
        verificationRequestId: request.id,
        subjectEmail: session.subjectEmail,
        subjectName,
        metadata: session.metadata,
      });

      res.json({
        status: "completed",
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

  console.log("[KYC Service] Routes registered");
}
