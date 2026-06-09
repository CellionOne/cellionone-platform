/**
 * Bureau / ClearLedger API Routes
 * Public: /api/v1/bureau/* (bureau:read | bureau:write scope)
 * Internal: /api/internal/bureau/* (co1_internal_ prefix key)
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { authenticateApiKey, type ApiKeyRequest } from "../middleware/apiKeyAuth";
import * as bureauProfileService from "../services/bureauProfileService";

const bureauReadAuth = authenticateApiKey("bureau:read");
const bureauWriteAuth = authenticateApiKey("bureau:write");

// Shared identifier schema
const identifierSchema = z.object({
  identifier_type: z.enum(["bvn", "nin", "clr"]),
  identifier: z.string().min(1).max(100).trim(),
  reference: z.string().max(200).trim().optional(),
});

const eventSchema = z.object({
  identifier_type: z.enum(["bvn", "nin"]),
  identifier: z.string().min(1).max(100).trim(),
  event_type: z.string().min(1).max(50).trim(),
  event_category: z.enum(["identity", "cash_flow", "capital_markets", "obligation", "formation"]),
  payload: z.record(z.unknown()).optional().default({}),
  occurred_at: z.string().datetime().optional(),
  reference: z.string().max(200).trim().optional(),
});

export function registerBureauApiRoutes(app: Express): void {

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/v1/bureau/profile
  // Query a ClearLedger profile by BVN, NIN, or CLR ID — bureau:read scope
  // ──────────────────────────────────────────────────────────────────────────
  app.post("/api/v1/bureau/profile", bureauReadAuth, async (req: ApiKeyRequest, res: Response) => {
    try {
      const body = identifierSchema.parse(req.body);
      const apiKeyId = req.apiKeyContext!.apiKeyId;

      const result = await bureauProfileService.queryProfile(
        body.identifier_type,
        body.identifier,
        {
          apiKeyId,
          queryType: "profile_query",
          consumerReference: body.reference,
          environment: process.env.NODE_ENV === "production" ? "live" : "sandbox",
        },
      );

      return res.json(result);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: err.errors });
      }
      console.error("[Bureau] POST /profile error:", err);
      return res.status(500).json({ error: "Bureau query failed" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/v1/bureau/profile/:clearledger_id
  // Look up profile by CLR ID — bureau:read scope
  // ──────────────────────────────────────────────────────────────────────────
  app.get("/api/v1/bureau/profile/:clearledger_id", bureauReadAuth, async (req: ApiKeyRequest, res: Response) => {
    try {
      const clrId = String(req.params.clearledger_id).toUpperCase().trim();
      if (!/^CLR-\d{5,}$/.test(clrId)) {
        return res.status(400).json({ error: "Invalid CLR ID format. Expected CLR-NNNNN." });
      }
      const apiKeyId = req.apiKeyContext!.apiKeyId;

      const result = await bureauProfileService.queryProfile("clr", clrId, {
        apiKeyId,
        queryType: "profile_query_by_id",
        environment: process.env.NODE_ENV === "production" ? "live" : "sandbox",
      });

      if (!result.found) {
        return res.status(404).json({ error: "Profile not found", code: "BUREAU_PROFILE_NOT_FOUND" });
      }
      return res.json(result);
    } catch (err: any) {
      console.error("[Bureau] GET /profile/:id error:", err);
      return res.status(500).json({ error: "Bureau query failed" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/v1/bureau/event
  // Submit enrichment event (MFB partners, obligation reporters) — bureau:write
  // ──────────────────────────────────────────────────────────────────────────
  app.post("/api/v1/bureau/event", bureauWriteAuth, async (req: ApiKeyRequest, res: Response) => {
    try {
      const body = eventSchema.parse(req.body);
      const apiKeyId = req.apiKeyContext!.apiKeyId;

      const profile = await bureauProfileService.createOrGetProfile(
        body.identifier_type,
        body.identifier,
      );

      await bureauProfileService.recordEvent(
        profile.id,
        body.event_category,
        body.event_type,
        body.payload,
        body.occurred_at ? new Date(body.occurred_at) : new Date(),
        apiKeyId,
      );

      return res.status(201).json({
        success: true,
        clearledger_id: profile.clearledgerId,
        message: "Event recorded. Score recalculation queued.",
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: err.errors });
      }
      console.error("[Bureau] POST /event error:", err);
      return res.status(500).json({ error: "Failed to record bureau event" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/internal/bureau/event
  // Internal event submission — Cellion Labs apps (Icon eTrade, etc.)
  // Auth: X-API-Key header must start with co1_internal_
  // NOT in public docs
  // ──────────────────────────────────────────────────────────────────────────
  app.post("/api/internal/bureau/event", async (req: Request, res: Response) => {
    try {
      const apiKey = req.headers["x-api-key"];
      if (!apiKey || typeof apiKey !== "string" || !apiKey.startsWith("co1_internal_")) {
        return res.status(401).json({ error: "Invalid or missing internal API key" });
      }

      const body = z.object({
        source_app: z.string().min(1).max(100),
        identifier_type: z.enum(["bvn", "nin"]),
        identifier: z.string().min(1).max(100).trim(),
        event_type: z.string().min(1).max(50).trim(),
        event_category: z.enum(["identity", "cash_flow", "capital_markets", "obligation", "formation"]),
        payload: z.record(z.unknown()).optional().default({}),
        occurred_at: z.string().datetime().optional(),
      }).parse(req.body);

      const profile = await bureauProfileService.createOrGetProfile(
        body.identifier_type,
        body.identifier,
      );

      await bureauProfileService.recordEvent(
        profile.id,
        body.event_category,
        body.event_type,
        { ...body.payload, source_app: body.source_app },
        body.occurred_at ? new Date(body.occurred_at) : new Date(),
      );

      return res.status(201).json({
        success: true,
        clearledger_id: profile.clearledgerId,
        message: "Internal event recorded. Score recalculation queued.",
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: err.errors });
      }
      console.error("[Bureau Internal] POST /event error:", err);
      return res.status(500).json({ error: "Failed to record internal bureau event" });
    }
  });
}
