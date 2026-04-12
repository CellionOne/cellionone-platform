import type { Express, Response } from "express";
import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import {
  kybLookups,
  type KybLookup,
} from "@shared/schema";
import { authenticateApiKey, type ApiKeyRequest } from "../middleware/apiKeyAuth";
import * as billingService from "../services/kycBillingService";
import * as smileId from "../services/smileIdService";
import { storage } from "../storage";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildLookupResponse(lookup: KybLookup) {
  return {
    reference: lookup.reference,
    status: lookup.status,
    rcNumber: lookup.rcNumber,
    businessType: lookup.businessType,
    companyName: lookup.companyName,
    registrationDate: lookup.registrationDate,
    companyStatus: lookup.companyStatus,
    companyType: lookup.companyType,
    address: lookup.address,
    shareCapital: lookup.shareCapital,
    tinNumber: lookup.tinNumber,
    directors: lookup.directors,
    creditDeducted: lookup.creditDeducted,
    errorMessage: lookup.status === "error" ? lookup.errorMessage : undefined,
    createdAt: lookup.createdAt,
  };
}

export function registerKybApiRoutes(app: Express) {

  // ─── POST /api/v1/kyb/lookup ───────────────────────────────────────────────
  // Accepts an RC number and returns a CAC registry result.
  // Deducts one "kyb" credit from the organisation's billing account.

  app.post("/api/v1/kyb/lookup", authenticateApiKey("verify:business"), async (req: ApiKeyRequest, res: Response) => {
    try {
      const body = z.object({
        rcNumber: z.string()
          .min(1, "rcNumber is required")
          .max(20, "rcNumber must not exceed 20 characters")
          .regex(/^\d+$|^RC\d+$/i, "rcNumber must be numeric digits or start with RC followed by digits (e.g. '1234567' or 'RC1234567')"),
        businessType: z.enum(["co", "bn", "it"])
          .optional()
          .default("co"),
      }).parse(req.body);

      const orgId = req.apiKeyContext!.orgId!;

      // Check credits
      const hasCred = await billingService.hasCredits(orgId, "kyb");
      if (!hasCred) {
        return res.status(402).json({
          error: "Insufficient credits. Please purchase kyb credits to use the KYB lookup API.",
          code: "INSUFFICIENT_CREDITS",
          verificationType: "kyb",
        });
      }

      const reference = `kyb_${orgId}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const cleanRc = body.rcNumber.replace(/^rc/i, "").trim();

      // Insert initial pending record
      const [lookup] = await db.insert(kybLookups).values({
        orgId,
        reference,
        rcNumber: cleanRc,
        businessType: body.businessType,
        status: "pending",
        creditDeducted: false,
      }).returning();

      // Call Smile ID KYB
      // NOTE: verifyBusiness() catches all errors internally and returns
      // { found: false, error: string } rather than throwing. We must inspect
      // result.error to distinguish a genuine "not found" from a service failure.
      const userId = `kyb_api_org_${orgId}`;
      const jobId = reference;
      let result: smileId.KybResult;

      try {
        result = await smileId.verifyBusiness(cleanRc, userId, jobId, body.businessType);
      } catch (unexpectedErr: any) {
        // This branch is a last-resort safety net for unexpected synchronous throws.
        await db.update(kybLookups)
          .set({
            status: "error",
            errorMessage: unexpectedErr?.message || "Verification service error",
            updatedAt: new Date(),
          })
          .where(eq(kybLookups.id, lookup.id));

        return res.status(502).json({
          error: "Company registry lookup failed",
          code: "REGISTRY_SERVICE_ERROR",
          reference,
        });
      }

      // Any result.error (including NOT_CONFIGURED) means the registry service
      // could not complete the lookup — treat as service error, no credit deduction.
      if (result.error) {
        await db.update(kybLookups)
          .set({ status: "error", errorMessage: String(result.error), updatedAt: new Date() })
          .where(eq(kybLookups.id, lookup.id));

        return res.status(502).json({
          error: "Company registry lookup failed",
          code: "REGISTRY_SERVICE_ERROR",
          reference,
        });
      }

      const status = result.found ? "found" : "not_found";

      const [updated] = await db.update(kybLookups)
        .set({
          status,
          companyName: result.companyName || null,
          registrationDate: result.registrationDate || null,
          companyStatus: result.status || null,
          companyType: result.companyType || null,
          address: result.address || null,
          shareCapital: result.shareCapital || null,
          tinNumber: result.tinNumber || null,
          directors: result.directors && result.directors.length > 0 ? result.directors : null,
          rawResult: result.rawResult || null,
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(kybLookups.id, lookup.id))
        .returning();

      // Deduct credit — mandatory for found/not_found. If deduction fails, return error.
      await billingService.deductCredit(orgId, "kyb", lookup.id);
      await db.update(kybLookups)
        .set({ creditDeducted: true, updatedAt: new Date() })
        .where(eq(kybLookups.id, lookup.id));
      updated.creditDeducted = true;

      // Audit log (non-blocking — failure does not affect response).
      storage.createAuditLog({
        actorUserId: null,
        action: "kyb_api_lookup",
        entityType: "kyb_lookup",
        entityId: String(lookup.id),
        details: { orgId, rcNumber: cleanRc, status, found: result.found, reference },
      }).catch((auditErr: any) => console.error("[KYB API] Audit log error:", auditErr));

      const responseBody = buildLookupResponse(updated);
      if (status === "not_found") {
        return res.status(404).json({ ...responseBody, code: "RC_NOT_FOUND" });
      }
      return res.status(200).json(responseBody);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", code: "INVALID_RC_FORMAT", details: err.errors });
      }
      console.error("[KYB API] Lookup error:", err);
      return res.status(500).json({ error: "KYB lookup failed" });
    }
  });

  // ─── GET /api/v1/kyb/lookups ───────────────────────────────────────────────
  // Lists all KYB lookups for the authenticated organisation, newest first.

  app.get("/api/v1/kyb/lookups", authenticateApiKey("verify:business"), async (req: ApiKeyRequest, res: Response) => {
    try {
      const orgId = req.apiKeyContext!.orgId!;
      const limitParam = Math.min(parseInt(String(req.query.limit || "50"), 10) || 50, 200);
      const offsetParam = Math.max(parseInt(String(req.query.offset || "0"), 10) || 0, 0);

      const rows = await db.select().from(kybLookups)
        .where(eq(kybLookups.orgId, orgId))
        .orderBy(desc(kybLookups.createdAt))
        .limit(limitParam)
        .offset(offsetParam);

      return res.json({
        data: rows.map(buildLookupResponse),
        limit: limitParam,
        offset: offsetParam,
        returnedCount: rows.length,
      });
    } catch (err: any) {
      console.error("[KYB API] List lookups error:", err);
      return res.status(500).json({ error: "Failed to retrieve lookups" });
    }
  });

  // ─── GET /api/v1/kyb/lookups/:reference ───────────────────────────────────
  // Retrieves a single lookup record by its reference string.

  app.get("/api/v1/kyb/lookups/:reference", authenticateApiKey("verify:business"), async (req: ApiKeyRequest, res: Response) => {
    try {
      const orgId = req.apiKeyContext!.orgId!;
      const { reference } = req.params;

      const [lookup] = await db.select().from(kybLookups)
        .where(and(
          eq(kybLookups.reference, reference),
          eq(kybLookups.orgId, orgId),
        ))
        .limit(1);

      if (!lookup) {
        return res.status(404).json({ error: "Lookup not found", code: "LOOKUP_NOT_FOUND" });
      }

      return res.json(buildLookupResponse(lookup));
    } catch (err: any) {
      console.error("[KYB API] Get lookup error:", err);
      return res.status(500).json({ error: "Failed to retrieve lookup" });
    }
  });
}
