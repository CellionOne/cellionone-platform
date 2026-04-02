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
  type KycDocumentRequirement, type KycSubmittedDocument, type KycVerifiedSnapshot,
} from "@shared/schema";
import { authenticateApiKey, type ApiKeyRequest } from "../middleware/apiKeyAuth";
import * as billingService from "../services/kycBillingService";
import * as webhookService from "../services/kycWebhookService";
import * as smileId from "../services/smileIdService";
import { storage } from "../storage";
import { captureVerifiedIdentityProfile, getIdentityProfile } from "../services/identityProfileService";

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

// ─── Shared helper for sync ID lookups ────────────────────────────────────────

/** Returns a masked identifier string showing only the last 4 characters */
function maskId(id: string): string {
  if (id.length <= 4) return "****";
  return `****${id.slice(-4)}`;
}

async function handleIdLookup(
  req: ApiKeyRequest,
  res: Response,
  idType: string,
  idNumber: string,
  lookupFn: (id: string, ref: string) => Promise<smileId.IdLookupResult>,
) {
  const orgId = req.apiKeyContext!.orgId;

  const hasCred = await billingService.hasCredits(orgId, "identity_only");
  if (!hasCred) {
    return res.status(402).json({
      error: "Insufficient credits. Please purchase identity_only credits to use instant lookups.",
      code: "INSUFFICIENT_CREDITS",
      verificationType: "identity_only",
    });
  }

  const ref = `id_lookup_${orgId}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const maskedId = maskId(idNumber);

  const result = await lookupFn(idNumber, ref);

  // Store only the masked ID — never persist the full identifier in our records
  const [insertedRow] = await db.insert(kycVerificationRequests).values({
    orgId,
    templateId: null,
    requestedByUserId: null,
    type: "individual",
    status: result.verified ? "verified" : "rejected",
    subjectEmail: `lookup_${ref}@cellionone.internal`,
    subjectName: result.fullName || `${idType} ${maskedId}`,
    notes: `Instant ${idType} lookup (${maskedId})`,
    paymentResponsibility: "organisation",
    paymentStatus: "not_required",
    inviteToken: ref,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    reviewedAt: new Date(),
  }).returning();

  await billingService.deductCredit(orgId, "identity_only", insertedRow.id);

  // Explicit audit log — ID stored masked only
  try {
    await storage.createAuditLog({
      actorUserId: null,
      action: "kyc_api_instant_id_lookup",
      entityType: "kyc_verification_request",
      entityId: String(insertedRow.id),
      details: {
        orgId,
        idType,
        maskedId,
        verified: result.verified,
        referenceId: ref,
        apiKeyId: req.apiKeyContext!.apiKeyId,
      },
    });
  } catch (auditErr) {
    console.error("[KYC API] Audit log error (non-blocking):", auditErr);
  }

  // Capture verified identity profile (including government photo if available)
  if (result.verified) {
    captureVerifiedIdentityProfile({
      verificationRequestId: insertedRow.id,
      orgId,
      fullName: result.fullName || null,
      dateOfBirth: result.dob || null,
      gender: result.gender || null,
      address: result.address || null,
      idTypesVerified: [idType],
      dataSource: "instant_id_lookup",
      governmentPhotoBase64: result.photo || null,
    }).catch(err => console.error("[KYC API] Identity profile capture error:", err));
  }

  const responseBody: Record<string, unknown> = {
    verified: result.verified,
    idType,
    referenceId: ref,
    requestId: insertedRow.id,
  };
  if (result.fullName) responseBody.fullName = result.fullName;
  if (result.dob) responseBody.dob = result.dob;
  if (result.gender) responseBody.gender = result.gender;
  if (result.address) responseBody.address = result.address;
  if (!result.verified && result.reason) responseBody.reason = result.reason;

  return res.json(responseBody);
}

export function registerKycApiRoutes(app: Express) {

  // ─── Synchronous ID Lookup Endpoints ─────────────────────────────────────

  // POST /api/v1/kyc/lookup/bvn
  app.post("/api/v1/kyc/lookup/bvn", authenticateApiKey("verify:identity"), async (req: ApiKeyRequest, res: Response) => {
    try {
      const body = z.object({
        idNumber: z.string().length(11).regex(/^\d+$/, "BVN must be 11 digits"),
        firstName: z.string().max(100).optional(),
        lastName: z.string().max(100).optional(),
        dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD").optional(),
      }).parse(req.body);
      const enrichment = body.firstName || body.lastName || body.dateOfBirth
        ? { firstName: body.firstName, lastName: body.lastName, dob: body.dateOfBirth }
        : undefined;
      return handleIdLookup(req, res, "BVN", body.idNumber, (id, ref) => smileId.lookupBvn(id, ref, enrichment));
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: err.errors });
      console.error("[KYC API] BVN lookup error:", err);
      res.status(500).json({ error: "BVN lookup failed" });
    }
  });

  // POST /api/v1/kyc/lookup/nin
  app.post("/api/v1/kyc/lookup/nin", authenticateApiKey("verify:identity"), async (req: ApiKeyRequest, res: Response) => {
    try {
      const body = z.object({
        idNumber: z.string().length(11).regex(/^\d+$/, "NIN must be 11 digits"),
        firstName: z.string().max(100).optional(),
        lastName: z.string().max(100).optional(),
        dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD").optional(),
      }).parse(req.body);
      const enrichment = body.firstName || body.lastName || body.dateOfBirth
        ? { firstName: body.firstName, lastName: body.lastName, dob: body.dateOfBirth }
        : undefined;
      return handleIdLookup(req, res, "NIN", body.idNumber, (id, ref) => smileId.lookupNin(id, ref, enrichment));
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: err.errors });
      console.error("[KYC API] NIN lookup error:", err);
      res.status(500).json({ error: "NIN lookup failed" });
    }
  });

  // POST /api/v1/kyc/lookup/drivers-licence
  app.post("/api/v1/kyc/lookup/drivers-licence", authenticateApiKey("verify:identity"), async (req: ApiKeyRequest, res: Response) => {
    try {
      const body = z.object({
        idNumber: z.string().min(3).max(30, "Licence number must not exceed 30 characters"),
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD"),
      }).parse(req.body);
      const enrichment = { firstName: body.firstName, lastName: body.lastName, dob: body.dateOfBirth };
      return handleIdLookup(req, res, "DRIVERS_LICENSE", body.idNumber, (id, ref) => smileId.lookupDriversLicence(id, ref, enrichment));
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: err.errors });
      console.error("[KYC API] Driver's licence lookup error:", err);
      res.status(500).json({ error: "Driver's licence lookup failed" });
    }
  });

  // POST /api/v1/kyc/lookup/voter-id
  app.post("/api/v1/kyc/lookup/voter-id", authenticateApiKey("verify:identity"), async (req: ApiKeyRequest, res: Response) => {
    try {
      const body = z.object({
        idNumber: z.string().min(3).max(30, "Voter ID must not exceed 30 characters"),
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD"),
      }).parse(req.body);
      const enrichment = { firstName: body.firstName, lastName: body.lastName, dob: body.dateOfBirth };
      return handleIdLookup(req, res, "VOTER_ID", body.idNumber, (id, ref) => smileId.lookupVoterId(id, ref, enrichment));
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: err.errors });
      console.error("[KYC API] Voter ID lookup error:", err);
      res.status(500).json({ error: "Voter ID lookup failed" });
    }
  });

  // POST /api/v1/kyc/lookup/passport
  app.post("/api/v1/kyc/lookup/passport", authenticateApiKey("verify:identity"), async (req: ApiKeyRequest, res: Response) => {
    try {
      const body = z.object({
        idNumber: z.string().min(3).max(20, "Passport number must not exceed 20 characters"),
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD"),
        expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expiryDate must be YYYY-MM-DD"),
      }).parse(req.body);
      return handleIdLookup(req, res, "INTERNATIONAL_PASSPORT", body.idNumber, (id, ref) => smileId.lookupPassport(id, ref, body.expiryDate, { firstName: body.firstName, lastName: body.lastName, dob: body.dateOfBirth }));
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: err.errors });
      console.error("[KYC API] Passport lookup error:", err);
      res.status(500).json({ error: "Passport lookup failed" });
    }
  });

  // POST /api/v1/kyc/lookup/aml
  app.post("/api/v1/kyc/lookup/aml", authenticateApiKey("verify:identity"), async (req: ApiKeyRequest, res: Response) => {
    try {
      const body = z.object({
        fullName: z.string().min(2).max(255),
        dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD").optional(),
        nationality: z.string().max(3).optional(),
      }).parse(req.body);
      const orgId = req.apiKeyContext!.orgId;

      const hasCred = await billingService.hasCredits(orgId, "identity_only");
      if (!hasCred) {
        return res.status(402).json({
          error: "Insufficient credits. Please purchase identity_only credits to use instant lookups.",
          code: "INSUFFICIENT_CREDITS",
          verificationType: "identity_only",
        });
      }

      const ref = `aml_${orgId}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const result = await smileId.performAmlCheck(body.fullName, ref, {
        dateOfBirth: body.dateOfBirth,
        nationality: body.nationality,
      });

      const [insertedRow] = await db.insert(kycVerificationRequests).values({
        orgId,
        templateId: null,
        requestedByUserId: null,
        type: "individual",
        status: result.isHit ? "rejected" : "verified",
        subjectEmail: `aml_${ref}@cellionone.internal`,
        subjectName: body.fullName,
        notes: `Instant AML lookup${result.isHit ? " — HIT" : " — clear"}`,
        paymentResponsibility: "organisation",
        paymentStatus: "not_required",
        inviteToken: ref,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        reviewedAt: new Date(),
      }).returning();

      await billingService.deductCredit(orgId, "identity_only", insertedRow.id);

      // Explicit audit log for AML checks
      try {
        await storage.createAuditLog({
          actorUserId: null,
          action: "kyc_api_aml_lookup",
          entityType: "kyc_verification_request",
          entityId: String(insertedRow.id),
          details: {
            orgId,
            isHit: result.isHit,
            hitTypes: result.hitTypes,
            referenceId: ref,
            apiKeyId: req.apiKeyContext!.apiKeyId,
          },
        });
      } catch (auditErr) {
        console.error("[KYC API] AML audit log error (non-blocking):", auditErr);
      }

      return res.json({
        isHit: result.isHit,
        hitTypes: result.hitTypes,
        details: result.matchDetails ?? [],
        referenceId: ref,
        requestId: insertedRow.id,
        ...(result.error ? { warning: "AML service returned an error — results may be incomplete." } : {}),
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: err.errors });
      console.error("[KYC API] AML lookup error:", err);
      res.status(500).json({ error: "AML lookup failed" });
    }
  });

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

      // Include verified identity profile if captured (no photo URL — use dedicated endpoint)
      const identityProfile = await getIdentityProfile(requestId);
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
        verifiedIdentity,
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

      const baseUrl = process.env.NODE_ENV === "production"
        ? "https://cellionone.com"
        : `http://localhost:${process.env.PORT || 5000}`;

      const attestationUrl = request.certificateRef
        ? `${baseUrl}/api/v1/kyc/attest/${request.certificateRef}`
        : "";

      const snapshot = request.verifiedDataSnapshot as KycVerifiedSnapshot | null;

      const certificateData = {
        certificateNumber: request.certificateRef || `CERT-${requestId}-${Date.now().toString(36).toUpperCase()}`,
        certificateRef: request.certificateRef || null,
        attestationUrl,
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
          biometricMatch: snapshot?.biometricVerified ?? false,
          amlScreening: snapshot?.amlScreened ?? hasAcceptedDocs,
        },
        verifiedData: snapshot ? {
          verificationType: snapshot.verificationType,
          riskScore: snapshot.riskScore,
          verificationMethod: snapshot.verificationMethod,
          dataSource: snapshot.dataSource,
          documentsVerified: snapshot.documentsVerified,
          documentCount: snapshot.documentCount,
          biometricVerified: snapshot.biometricVerified,
          ...(snapshot.faceMatchConfidence !== undefined ? { faceMatchConfidence: snapshot.faceMatchConfidence } : {}),
          amlScreened: snapshot.amlScreened,
          ...(snapshot.amlClear !== undefined ? { amlClear: snapshot.amlClear } : {}),
          verifiedAt: snapshot.verifiedAt,
        } : null,
        verificationReference: request.certificateRef || null,
        livenessScore: null,
        company: supplierProfile ? {
          name: supplierProfile.companyName,
          rcNumber: supplierProfile.rcNumber,
          type: supplierProfile.industryCategory,
          shareCapital: null,
          incorporationDate: supplierProfile.yearEstablished ? `${supplierProfile.yearEstablished}-01-01` : null,
          directors: [],
        } : null,
        verificationUrl: attestationUrl,
      };

      if (format === "json") {
        // Return a structured attestation JSON — sourced strictly from independently-verified data
        const attestationJson: Record<string, any> = {
          certificateRef: request.certificateRef || null,
          verificationId: request.id,
          verificationType: request.type,
          issuedAt: request.reviewedAt ? new Date(request.reviewedAt).toISOString() : null,
          expiresAt: new Date(request.expiresAt).toISOString(),
          status: request.status,
          attestationUrl,
          issuedBy: {
            name: org?.name || "Unknown Organisation",
            certificationBody: "Cellion One",
          },
          verifiedData: snapshot ? {
            riskScore: snapshot.riskScore,
            verificationMethod: snapshot.verificationMethod,
            dataSource: snapshot.dataSource,
            documentsVerified: snapshot.documentsVerified,
            documentCount: snapshot.documentCount,
            biometricVerified: snapshot.biometricVerified,
            livenessConfirmed: snapshot.livenessConfirmed,
            ...(snapshot.faceMatchConfidence !== undefined ? { faceMatchConfidence: snapshot.faceMatchConfidence } : {}),
            amlScreened: snapshot.amlScreened,
            ...(snapshot.amlClear !== undefined ? { amlClear: snapshot.amlClear } : {}),
            verifiedAt: snapshot.verifiedAt,
          } : null,
        };

        if (supplierProfile) {
          attestationJson.company = {
            name: supplierProfile.companyName,
            rcNumber: supplierProfile.rcNumber,
            type: supplierProfile.industryCategory,
            incorporationDate: supplierProfile.yearEstablished ? `${supplierProfile.yearEstablished}-01-01` : null,
          };
        }

        return res.json(attestationJson);
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

      // When prefill is supplied but no profile/requiredSteps exist, default to full steps
      // so the prefill removal loop can correctly eliminate covered steps
      if (data.prefill && !resolvedSteps) {
        resolvedSteps = ["identity", "documents", "selfie"];
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

  // ============== PUBLIC ATTESTATION ENDPOINT (no auth required) ==============

  // GET /api/v1/kyc/attest/:token — public, no PII, verifies a certificate reference
  app.get("/api/v1/kyc/attest/:token", async (req, res: Response) => {
    try {
      const token = req.params.token as string;
      if (!token || !/^CO-KYC-\d{4}-[A-F0-9]{8}$/.test(token)) {
        return res.status(400).json({
          valid: false,
          error: "Invalid certificate reference format",
        });
      }

      const [request] = await db.select().from(kycVerificationRequests)
        .where(eq(kycVerificationRequests.certificateRef, token));

      if (!request) {
        return res.status(404).json({
          valid: false,
          error: "Certificate not found",
        });
      }

      const isExpired = new Date(request.expiresAt) < new Date();

      return res.json({
        valid: request.status === "verified" && !isExpired,
        verificationType: request.type,
        status: request.status,
        issuedAt: request.reviewedAt ? new Date(request.reviewedAt).toISOString() : null,
        expiresAt: new Date(request.expiresAt).toISOString(),
        certificationBody: "Cellion One",
      });
    } catch (error: any) {
      console.error("[KYC] Attestation error:", error);
      res.status(500).json({ valid: false, error: "Failed to verify attestation" });
    }
  });
}
