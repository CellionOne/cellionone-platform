/**
 * Formation API Routes — CAC company formation lookup
 * Base path: /api/v1/formation
 * Authentication: X-API-Key (formation:read scope)
 * Reuses existing kybLookups table and smileIdService.verifyBusiness
 */

import type { Express, Response } from "express";
import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { kybLookups } from "@shared/schema";
import { authenticateApiKey, type ApiKeyRequest } from "../middleware/apiKeyAuth";
import * as billingService from "../services/kycBillingService";
import * as smileId from "../services/smileIdService";
import { storage } from "../storage";

const formationAuth = authenticateApiKey("formation:read");

const rcLookupSchema = z.object({
  rcNumber: z.string()
    .min(1, "rcNumber is required")
    .max(20, "rcNumber must not exceed 20 characters")
    .regex(/^\d+$|^RC\d+$/i, "rcNumber must be numeric digits or start with RC followed by digits"),
  businessType: z.enum(["co", "bn", "it"]).optional().default("co"),
});

function buildFormationResponse(lookup: typeof kybLookups.$inferSelect) {
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

async function performFormationLookup(
  orgId: number,
  rcNumber: string,
  businessType: "co" | "bn" | "it",
  res: Response,
) {
  const hasCred = await billingService.hasCredits(orgId, "kyb");
  if (!hasCred) {
    return res.status(402).json({
      error: "Insufficient credits. Please purchase kyb credits to use the Formation lookup API.",
      code: "INSUFFICIENT_CREDITS",
      verificationType: "kyb",
    });
  }

  const reference = `formation_${orgId}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const cleanRc = rcNumber.replace(/^rc/i, "").trim();

  const [lookup] = await db.insert(kybLookups).values({
    orgId,
    reference,
    rcNumber: cleanRc,
    businessType,
    status: "pending",
    creditDeducted: false,
  }).returning();

  const userId = `formation_api_org_${orgId}`;
  let result: smileId.KybResult;

  try {
    result = await smileId.verifyBusiness(cleanRc, userId, reference, businessType);
  } catch (unexpectedErr: any) {
    await db.update(kybLookups)
      .set({ status: "error", errorMessage: unexpectedErr?.message || "Verification service error", updatedAt: new Date() })
      .where(eq(kybLookups.id, lookup.id));
    return res.status(502).json({ error: "Company registry lookup failed", code: "REGISTRY_SERVICE_ERROR", reference });
  }

  if (result.error) {
    await db.update(kybLookups)
      .set({ status: "error", errorMessage: String(result.error), updatedAt: new Date() })
      .where(eq(kybLookups.id, lookup.id));
    return res.status(502).json({ error: "Company registry lookup failed", code: "REGISTRY_SERVICE_ERROR", reference });
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

  await billingService.deductCredit(orgId, "kyb", lookup.id);
  await db.update(kybLookups)
    .set({ creditDeducted: true, updatedAt: new Date() })
    .where(eq(kybLookups.id, lookup.id));
  updated.creditDeducted = true;

  storage.createAuditLog({
    actorUserId: null,
    action: "formation_api_lookup",
    entityType: "kyb_lookup",
    entityId: String(lookup.id),
    details: { orgId, rcNumber: cleanRc, status, found: result.found, reference },
  }).catch((e: any) => console.error("[Formation API] Audit log error:", e));

  const responseBody = buildFormationResponse(updated);
  if (status === "not_found") {
    return res.status(404).json({ ...responseBody, code: "RC_NOT_FOUND" });
  }
  return res.status(200).json(responseBody);
}

export function registerFormationApiRoutes(app: Express): void {

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/v1/formation/lookup?rcNumber=&businessType=
  // Read-only CAC registry lookup — checks cache first, then live call
  // ──────────────────────────────────────────────────────────────────────────
  app.get("/api/v1/formation/lookup", formationAuth, async (req: ApiKeyRequest, res: Response) => {
    try {
      const body = rcLookupSchema.parse({
        rcNumber: req.query.rcNumber,
        businessType: req.query.businessType ?? "co",
      });

      const orgId = req.apiKeyContext!.orgId!;

      // Return cached result if available (any terminal status from this org)
      const cleanRc = body.rcNumber.replace(/^rc/i, "").trim();
      const [cached] = await db.select().from(kybLookups)
        .where(and(
          eq(kybLookups.orgId, orgId),
          eq(kybLookups.rcNumber, cleanRc),
          eq(kybLookups.businessType, body.businessType),
        ))
        .orderBy(desc(kybLookups.createdAt))
        .limit(1);

      if (cached && (cached.status === "found" || cached.status === "not_found")) {
        return res.json({ ...buildFormationResponse(cached), cached: true });
      }

      return performFormationLookup(orgId, body.rcNumber, body.businessType, res);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", code: "INVALID_RC_FORMAT", details: err.errors });
      }
      console.error("[Formation API] GET lookup error:", err);
      return res.status(500).json({ error: "Formation lookup failed" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/v1/formation/lookup
  // Live CAC registry lookup — always performs a fresh call
  // ──────────────────────────────────────────────────────────────────────────
  app.post("/api/v1/formation/lookup", formationAuth, async (req: ApiKeyRequest, res: Response) => {
    try {
      const body = rcLookupSchema.parse(req.body);
      const orgId = req.apiKeyContext!.orgId!;
      return performFormationLookup(orgId, body.rcNumber, body.businessType, res);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", code: "INVALID_RC_FORMAT", details: err.errors });
      }
      console.error("[Formation API] POST lookup error:", err);
      return res.status(500).json({ error: "Formation lookup failed" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/v1/formation/lookups
  // List all formation lookups for the authenticated organisation
  // ──────────────────────────────────────────────────────────────────────────
  app.get("/api/v1/formation/lookups", formationAuth, async (req: ApiKeyRequest, res: Response) => {
    try {
      const orgId = req.apiKeyContext!.orgId!;
      const limitParam = Math.min(Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1), 200);
      const offsetParam = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);

      const rows = await db.select().from(kybLookups)
        .where(eq(kybLookups.orgId, orgId))
        .orderBy(desc(kybLookups.createdAt))
        .limit(limitParam)
        .offset(offsetParam);

      return res.json({
        data: rows.map(buildFormationResponse),
        limit: limitParam,
        offset: offsetParam,
        returnedCount: rows.length,
      });
    } catch (err: any) {
      console.error("[Formation API] List lookups error:", err);
      return res.status(500).json({ error: "Failed to retrieve lookups" });
    }
  });
}
