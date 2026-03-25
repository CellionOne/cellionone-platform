import type { Express, Response } from "express";
import { db } from "../db";
import { eq, and, desc, or, ilike, isNull, count, asc } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import {
  kycOrganisations, kycVerificationTemplates,
  kycDocumentRequirements, kycVerificationRequests,
  kycSupplierProfiles, kycSubmittedDocuments, kycSupplierPeople,
  kycSessions,
  type KycVerificationRequest, type KycSupplierProfile, type KycSupplierPerson,
  type KycDocumentRequirement, type KycSubmittedDocument,
} from "@shared/schema";
import { authenticateApiKey, type ApiKeyRequest } from "../middleware/apiKeyAuth";
import * as billingService from "../services/kycBillingService";
import * as webhookService from "../services/kycWebhookService";

function generateToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

function calculateRiskScore(docs: KycSubmittedDocument[], requirements: KycDocumentRequirement[], people?: KycSupplierPerson[]): string {
  const mandatoryReqs = requirements.filter(r => r.isMandatory && r.isActive);
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

export function registerKycApiRoutes(app: Express) {

  // POST /api/v1/kyc/verify/individual
  app.post("/api/v1/kyc/verify/individual", authenticateApiKey("verify:individual"), async (req: ApiKeyRequest, res: Response) => {
    try {
      const orgId = req.apiKeyContext!.orgId;

      const schema = z.object({
        subjectEmail: z.string().email(),
        subjectName: z.string().min(1).max(255),
        templateId: z.number().optional(),
        checks: z.array(z.string()).optional(),
        requiredDocuments: z.array(z.string()).optional(),
        expiresInDays: z.number().min(1).max(365).default(30),
        notes: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      });
      const data = schema.parse(req.body);

      const hasCredits = await billingService.hasCredits(orgId, "individual");
      if (!hasCredits) {
        return res.status(402).json({
          error: "Insufficient credits. Please purchase more individual verification credits to continue.",
          type: "insufficient_credits",
          verificationType: "individual",
        });
      }

      if (data.templateId) {
        const [template] = await db.select().from(kycVerificationTemplates)
          .where(and(eq(kycVerificationTemplates.id, data.templateId), eq(kycVerificationTemplates.orgId, orgId)));
        if (!template) {
          return res.status(400).json({ error: "Template not found or does not belong to this organisation" });
        }
        if (template.type !== "individual") {
          return res.status(400).json({ error: "Template is not for individual verification" });
        }
      }

      const inviteToken = generateToken();
      const expiresAt = new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000);

      const [request] = await db.insert(kycVerificationRequests).values({
        orgId,
        templateId: data.templateId || null,
        requestedByUserId: null,
        type: "individual",
        status: "pending_invite",
        subjectEmail: data.subjectEmail,
        subjectName: data.subjectName,
        notes: data.notes || null,
        paymentResponsibility: "organisation",
        paymentStatus: "not_required",
        inviteToken,
        expiresAt,
      }).returning();

      await billingService.deductCredit(orgId, "individual", request.id);

      await webhookService.deliverWebhook(orgId, "verification.created", {
        requestId: request.id,
        type: "individual",
        subjectEmail: data.subjectEmail,
        subjectName: data.subjectName,
        status: request.status,
      }, request.id);

      res.status(201).json({
        id: request.id,
        type: request.type,
        status: request.status,
        subjectEmail: request.subjectEmail,
        subjectName: request.subjectName,
        templateId: request.templateId,
        expiresAt: request.expiresAt,
        createdAt: request.createdAt,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      if (error.message === "Insufficient credits") {
        return res.status(402).json({ error: error.message, type: "insufficient_credits" });
      }
      console.error("[KYC API] Create individual verification error:", error);
      res.status(500).json({ error: "Failed to create verification request" });
    }
  });

  // POST /api/v1/kyc/verify/supplier
  app.post("/api/v1/kyc/verify/supplier", authenticateApiKey("verify:supplier"), async (req: ApiKeyRequest, res: Response) => {
    try {
      const orgId = req.apiKeyContext!.orgId;

      const schema = z.object({
        subjectEmail: z.string().email(),
        subjectName: z.string().min(1).max(255),
        templateId: z.number().optional(),
        checks: z.array(z.string()).optional(),
        requiredDocuments: z.array(z.string()).optional(),
        expiresInDays: z.number().min(1).max(365).default(30),
        notes: z.string().optional(),
        companyDetails: z.object({
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
        }).optional(),
        directors: z.array(z.object({
          fullName: z.string().min(1),
          email: z.string().email(),
          role: z.string().default("director"),
          requiresVerification: z.boolean().default(true),
        })).optional(),
        metadata: z.record(z.unknown()).optional(),
      });
      const data = schema.parse(req.body);

      const hasCredits = await billingService.hasCredits(orgId, "supplier");
      if (!hasCredits) {
        return res.status(402).json({
          error: "Insufficient credits. Please purchase more supplier verification credits to continue.",
          type: "insufficient_credits",
          verificationType: "supplier",
        });
      }

      if (data.templateId) {
        const [template] = await db.select().from(kycVerificationTemplates)
          .where(and(eq(kycVerificationTemplates.id, data.templateId), eq(kycVerificationTemplates.orgId, orgId)));
        if (!template) {
          return res.status(400).json({ error: "Template not found or does not belong to this organisation" });
        }
        if (template.type !== "supplier") {
          return res.status(400).json({ error: "Template is not for supplier verification" });
        }
      }

      const inviteToken = generateToken();
      const expiresAt = new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000);

      const [request] = await db.insert(kycVerificationRequests).values({
        orgId,
        templateId: data.templateId || null,
        requestedByUserId: null,
        type: "supplier",
        status: "pending_invite",
        subjectEmail: data.subjectEmail,
        subjectName: data.subjectName,
        notes: data.notes || null,
        paymentResponsibility: "organisation",
        paymentStatus: "not_required",
        inviteToken,
        expiresAt,
      }).returning();

      await billingService.deductCredit(orgId, "supplier", request.id);

      if (data.companyDetails) {
        const [profile] = await db.insert(kycSupplierProfiles).values({
          verificationRequestId: request.id,
          companyName: data.companyDetails.companyName,
          rcNumber: data.companyDetails.rcNumber || null,
          tinNumber: data.companyDetails.tinNumber || null,
          vatRegistered: data.companyDetails.vatRegistered,
          yearEstablished: data.companyDetails.yearEstablished || null,
          industryCategory: data.companyDetails.industryCategory || null,
          headOfficeAddress: data.companyDetails.headOfficeAddress || null,
          websiteUrl: data.companyDetails.websiteUrl || null,
          contactPersonName: data.companyDetails.contactPersonName,
          contactPersonEmail: data.companyDetails.contactPersonEmail,
          contactPersonPhone: data.companyDetails.contactPersonPhone || null,
          contactPersonRole: data.companyDetails.contactPersonRole || null,
        }).returning();

        if (data.directors && data.directors.length > 0) {
          for (const director of data.directors) {
            const dirInviteToken = generateToken();
            await db.insert(kycSupplierPeople).values({
              supplierProfileId: profile.id,
              verificationRequestId: request.id,
              fullName: director.fullName,
              email: director.email,
              role: director.role,
              requiresVerification: director.requiresVerification,
              verificationStatus: director.requiresVerification ? "pending" : "not_required",
              inviteToken: dirInviteToken,
            });
          }
        }
      }

      await webhookService.deliverWebhook(orgId, "verification.created", {
        requestId: request.id,
        type: "supplier",
        subjectEmail: data.subjectEmail,
        subjectName: data.subjectName,
        status: request.status,
      }, request.id);

      res.status(201).json({
        id: request.id,
        type: request.type,
        status: request.status,
        subjectEmail: request.subjectEmail,
        subjectName: request.subjectName,
        templateId: request.templateId,
        expiresAt: request.expiresAt,
        createdAt: request.createdAt,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      if (error.message === "Insufficient credits") {
        return res.status(402).json({ error: error.message, type: "insufficient_credits" });
      }
      console.error("[KYC API] Create supplier verification error:", error);
      res.status(500).json({ error: "Failed to create verification request" });
    }
  });

  // GET /api/v1/kyc/requests/:requestId
  app.get("/api/v1/kyc/requests/:requestId", authenticateApiKey(), async (req: ApiKeyRequest, res: Response) => {
    try {
      const orgId = req.apiKeyContext!.orgId;
      const requestId = parseInt(req.params.requestId as string);
      if (isNaN(requestId)) return res.status(400).json({ error: "Invalid request ID" });

      const [request] = await db.select().from(kycVerificationRequests)
        .where(and(eq(kycVerificationRequests.id, requestId), eq(kycVerificationRequests.orgId, orgId)));
      if (!request) return res.status(404).json({ error: "Verification request not found" });

      const documents = await db.select().from(kycSubmittedDocuments)
        .where(eq(kycSubmittedDocuments.verificationRequestId, requestId));

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
          .where(eq(kycSupplierProfiles.verificationRequestId, requestId));
        supplierProfile = profile;
        if (profile) {
          people = await db.select().from(kycSupplierPeople)
            .where(eq(kycSupplierPeople.supplierProfileId, profile.id));
        }
      }

      const riskScore = calculateRiskScore(documents, requirements, people);

      const docsSummary = documents.map(d => ({
        id: d.id,
        requirementId: d.requirementId,
        fileName: d.fileName,
        status: d.status,
        expiryDate: d.expiryDate,
        uploadedAt: d.uploadedAt,
      }));

      res.json({
        id: request.id,
        type: request.type,
        status: request.status,
        subjectEmail: request.subjectEmail,
        subjectName: request.subjectName,
        templateId: request.templateId,
        riskScore: request.riskScore || riskScore,
        reviewedAt: request.reviewedAt,
        reviewNotes: request.reviewNotes,
        expiresAt: request.expiresAt,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        documents: docsSummary,
        supplierProfile: supplierProfile ? {
          companyName: supplierProfile.companyName,
          rcNumber: supplierProfile.rcNumber,
          tinNumber: supplierProfile.tinNumber,
          industryCategory: supplierProfile.industryCategory,
        } : undefined,
        people: people.length > 0 ? people.map(p => ({
          fullName: p.fullName,
          email: p.email,
          role: p.role,
          verificationStatus: p.verificationStatus,
        })) : undefined,
      });
    } catch (error: any) {
      console.error("[KYC API] Get request error:", error);
      res.status(500).json({ error: "Failed to get verification request" });
    }
  });

  // GET /api/v1/kyc/requests
  app.get("/api/v1/kyc/requests", authenticateApiKey(), async (req: ApiKeyRequest, res: Response) => {
    try {
      const orgId = req.apiKeyContext!.orgId;
      const { status, type, page = "1", limit = "20" } = req.query as Record<string, string>;

      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
      const offset = (pageNum - 1) * limitNum;

      const conditions: any[] = [eq(kycVerificationRequests.orgId, orgId)];
      if (status) conditions.push(eq(kycVerificationRequests.status, status));
      if (type) conditions.push(eq(kycVerificationRequests.type, type));

      const requests = await db.select().from(kycVerificationRequests)
        .where(and(...conditions))
        .orderBy(desc(kycVerificationRequests.createdAt))
        .limit(limitNum)
        .offset(offset);

      const [countResult] = await db.select({ total: count() })
        .from(kycVerificationRequests)
        .where(and(...conditions));

      const total = Number(countResult?.total || 0);

      res.json({
        data: requests.map(r => ({
          id: r.id,
          type: r.type,
          status: r.status,
          subjectEmail: r.subjectEmail,
          subjectName: r.subjectName,
          templateId: r.templateId,
          riskScore: r.riskScore,
          expiresAt: r.expiresAt,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error: any) {
      console.error("[KYC API] List requests error:", error);
      res.status(500).json({ error: "Failed to list verification requests" });
    }
  });

  // GET /api/v1/kyc/requests/:requestId/certificate
  app.get("/api/v1/kyc/requests/:requestId/certificate", authenticateApiKey(), async (req: ApiKeyRequest, res: Response) => {
    try {
      const orgId = req.apiKeyContext!.orgId;
      const requestId = parseInt(req.params.requestId as string);
      if (isNaN(requestId)) return res.status(400).json({ error: "Invalid request ID" });

      const [request] = await db.select().from(kycVerificationRequests)
        .where(and(eq(kycVerificationRequests.id, requestId), eq(kycVerificationRequests.orgId, orgId)));
      if (!request) return res.status(404).json({ error: "Verification request not found" });

      if (request.status !== "verified") {
        return res.status(400).json({ error: "Certificate is only available for verified requests" });
      }

      const [org] = await db.select().from(kycOrganisations).where(eq(kycOrganisations.id, orgId));

      const documents = await db.select().from(kycSubmittedDocuments)
        .where(eq(kycSubmittedDocuments.verificationRequestId, requestId));
      const hasAcceptedDocs = documents.some(d => d.status === "accepted");

      let supplierProfile: KycSupplierProfile | undefined;
      if (request.type === "supplier") {
        const [profile] = await db.select().from(kycSupplierProfiles)
          .where(eq(kycSupplierProfiles.verificationRequestId, requestId));
        supplierProfile = profile;
      }

      const format = req.query.format as string || "html";

      const certificateData = {
        certificateNumber: `CERT-${requestId}-${Date.now().toString(36).toUpperCase()}`,
        subjectName: request.subjectName,
        subjectEmail: request.subjectEmail,
        verificationDate: request.reviewedAt ? new Date(request.reviewedAt).toISOString() : new Date().toISOString(),
        expiryDate: new Date(request.expiresAt).toISOString(),
        consentDate: request.termsAcceptedAt ? new Date(request.termsAcceptedAt).toISOString() : "",
        partnerName: org?.name || "Unknown Organisation",
        checks: {
          bvnValidation: hasAcceptedDocs,
          ninValidation: hasAcceptedDocs,
          documentVerification: hasAcceptedDocs,
          biometricMatch: false,
          amlScreening: hasAcceptedDocs,
        },
        smileIdJobId: null,
        livenessScore: null,
        company: supplierProfile ? {
          name: supplierProfile.companyName,
          rcNumber: supplierProfile.rcNumber,
          type: supplierProfile.industryCategory,
          shareCapital: null,
          incorporationDate: supplierProfile.yearEstablished ? `${supplierProfile.yearEstablished}-01-01` : null,
          directors: [],
        } : null,
        verificationUrl: "",
      };

      if (format === "json") {
        return res.json(certificateData);
      }

      const { generateVerificationCertificateHTML } = await import("../templates/verification-certificate");
      const html = generateVerificationCertificateHTML(certificateData);

      if (format === "pdf") {
        try {
          const { generatePdf } = await import("../services/pdfService");
          const pdfBuffer = await generatePdf(html, {
            format: "A4",
            margin: { top: "40px", right: "50px", bottom: "40px", left: "50px" },
          });
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", `attachment; filename="certificate-${requestId}.pdf"`);
          return res.send(pdfBuffer);
        } catch {
          return res.status(500).json({ error: "PDF generation failed. Use format=html instead." });
        }
      }

      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (error: any) {
      console.error("[KYC API] Certificate error:", error);
      res.status(500).json({ error: "Failed to generate certificate" });
    }
  });

  // GET /api/v1/kyc/templates
  app.get("/api/v1/kyc/templates", authenticateApiKey(), async (req: ApiKeyRequest, res: Response) => {
    try {
      const orgId = req.apiKeyContext!.orgId;

      const templates = await db.select().from(kycVerificationTemplates)
        .where(eq(kycVerificationTemplates.orgId, orgId))
        .orderBy(asc(kycVerificationTemplates.name));

      res.json({
        data: templates.map(t => ({
          id: t.id,
          name: t.name,
          type: t.type,
          description: t.description,
          requireDirectorVerification: t.requireDirectorVerification,
          documentRequirementIds: t.documentRequirementIds,
          isDefault: t.isDefault,
          createdAt: t.createdAt,
        })),
      });
    } catch (error: any) {
      console.error("[KYC API] List templates error:", error);
      res.status(500).json({ error: "Failed to list templates" });
    }
  });

  // GET /api/v1/kyc/document-requirements/:templateId
  app.get("/api/v1/kyc/document-requirements/:templateId", authenticateApiKey(), async (req: ApiKeyRequest, res: Response) => {
    try {
      const orgId = req.apiKeyContext!.orgId;
      const templateId = parseInt(req.params.templateId as string);
      if (isNaN(templateId)) return res.status(400).json({ error: "Invalid template ID" });

      const [template] = await db.select().from(kycVerificationTemplates)
        .where(and(eq(kycVerificationTemplates.id, templateId), eq(kycVerificationTemplates.orgId, orgId)));
      if (!template) return res.status(404).json({ error: "Template not found" });

      const requirementIds = (template.documentRequirementIds as number[]) || [];

      let requirements: KycDocumentRequirement[];
      if (requirementIds.length > 0) {
        const allRequirements = await db.select().from(kycDocumentRequirements)
          .where(and(
            or(eq(kycDocumentRequirements.orgId, orgId), isNull(kycDocumentRequirements.orgId)),
            eq(kycDocumentRequirements.type, template.type),
            eq(kycDocumentRequirements.isActive, true)
          ));
        requirements = allRequirements.filter(r => requirementIds.includes(r.id));
      } else {
        requirements = await db.select().from(kycDocumentRequirements)
          .where(and(
            or(eq(kycDocumentRequirements.orgId, orgId), isNull(kycDocumentRequirements.orgId)),
            eq(kycDocumentRequirements.type, template.type),
            eq(kycDocumentRequirements.isActive, true)
          ));
      }

      res.json({
        templateId: template.id,
        templateName: template.name,
        type: template.type,
        requirements: requirements.map(r => ({
          id: r.id,
          documentName: r.documentName,
          documentDescription: r.documentDescription,
          documentCategory: r.documentCategory,
          isMandatory: r.isMandatory,
          hasExpiry: r.hasExpiry,
        })),
      });
    } catch (error: any) {
      console.error("[KYC API] Get document requirements error:", error);
      res.status(500).json({ error: "Failed to get document requirements" });
    }
  });

  // ============== HOSTED SESSIONS ==============

  // POST /api/v1/kyc/sessions — create a hosted verification session
  app.post("/api/v1/kyc/sessions", authenticateApiKey("verify:individual"), async (req: ApiKeyRequest, res: Response) => {
    try {
      const orgId = req.apiKeyContext!.orgId;

      const prefillSchema = z.object({
        firstName: z.string().max(100).optional(),
        lastName: z.string().max(100).optional(),
        dateOfBirth: z.string().optional(),
        idNumber: z.string().max(50).optional(),
        documentType: z.enum(["national_id", "passport", "drivers_license"]).optional(),
        idDocumentUrl: z.string().url().optional(),
      }).optional();

      const schema = z.object({
        type: z.enum(["individual"]).default("individual"),
        subjectEmail: z.string().email(),
        subjectName: z.string().min(1).max(255),
        returnUrl: z.string().url().optional(),
        expiresInHours: z.number().min(1).max(168).default(48),
        metadata: z.record(z.unknown()).optional(),
        prefill: prefillSchema,
        requiredSteps: z.array(z.enum(["identity", "documents", "selfie"])).optional(),
      });
      const data = schema.parse(req.body);

      const [org] = await db.select().from(kycOrganisations).where(eq(kycOrganisations.id, orgId));
      if (!org) return res.status(404).json({ error: "Organisation not found" });

      // Derive requiredSteps from org integrationProfile if not explicitly provided
      let resolvedSteps: string[] | null = data.requiredSteps || null;
      if (!resolvedSteps && org.integrationProfile) {
        const mode = org.integrationProfile.mode;
        if (mode === "selfie_only") {
          resolvedSteps = ["selfie"];
        } else if (mode === "prefill_selfie") {
          resolvedSteps = ["documents", "selfie"];
        } else if (mode === "data_collection") {
          resolvedSteps = ["identity", "documents"];
        } else {
          resolvedSteps = ["identity", "documents", "selfie"];
        }
      }

      // Auto-remove steps already covered by prefill data
      if (data.prefill && resolvedSteps) {
        const p = data.prefill;
        const hasIdentityPrefill = !!(p.firstName && p.lastName && p.dateOfBirth);
        const hasDocumentPrefill = !!(p.idDocumentUrl); // only skip doc step when actual document image is prefilled
        if (hasIdentityPrefill) resolvedSteps = resolvedSteps.filter(s => s !== "identity");
        if (hasDocumentPrefill) resolvedSteps = resolvedSteps.filter(s => s !== "documents");
        // Keep as [] (not null) so the wizard knows "no steps needed" vs "unspecified"
      }

      // Determine result timing: "webhook" only when a selfie is involved (biometric processing);
      // "instant" for identity and document-only flows (data_collection profile or identity-only)
      const hasAsyncStep = !resolvedSteps || resolvedSteps.some(s => s === "selfie");
      const resultTiming = hasAsyncStep ? "webhook" : "instant";

      const sessionToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + data.expiresInHours * 60 * 60 * 1000);

      const [session] = await db.insert(kycSessions).values({
        orgId,
        sessionToken,
        type: data.type,
        subjectEmail: data.subjectEmail,
        subjectName: data.subjectName,
        returnUrl: data.returnUrl || null,
        status: "pending",
        metadata: data.metadata || null,
        prefillData: data.prefill || null,
        requiredSteps: resolvedSteps,
        expiresAt,
      }).returning();

      const baseUrl = process.env.NODE_ENV === "production"
        ? "https://cellionone.com"
        : `http://localhost:${process.env.PORT || 5000}`;

      const sessionUrl = `${baseUrl}/verify/${sessionToken}`;

      await webhookService.deliverWebhook(orgId, "session.created", {
        sessionId: session.id,
        sessionToken,
        sessionUrl,
        type: session.type,
        subjectEmail: session.subjectEmail,
        subjectName: session.subjectName,
        expiresAt: session.expiresAt,
        resultTiming,
      });

      res.status(201).json({
        sessionId: session.id,
        sessionToken,
        sessionUrl,
        type: session.type,
        status: session.status,
        subjectEmail: session.subjectEmail,
        subjectName: session.subjectName,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
        resultTiming,
        requiredSteps: resolvedSteps,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("[KYC API] Create session error:", error);
      res.status(500).json({ error: "Failed to create hosted session" });
    }
  });

  // GET /api/v1/kyc/sessions — list sessions for the org
  app.get("/api/v1/kyc/sessions", authenticateApiKey("verify:individual"), async (req: ApiKeyRequest, res: Response) => {
    try {
      const orgId = req.apiKeyContext!.orgId;
      const sessions = await db.select().from(kycSessions)
        .where(eq(kycSessions.orgId, orgId))
        .orderBy(desc(kycSessions.createdAt))
        .limit(50);

      res.json({ sessions });
    } catch (error: any) {
      console.error("[KYC API] List sessions error:", error);
      res.status(500).json({ error: "Failed to list sessions" });
    }
  });
}
