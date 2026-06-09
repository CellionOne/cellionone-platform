/**
 * CIE Internal Routes — event ingestion from Cellion Labs apps (Icon eTrade, etc.)
 * Base path: /api/internal/cie
 * Auth: X-API-Key header must start with co1_internal_
 * NOT in public docs.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { cieEvents, ngxDividends } from "@shared/schema";
import * as cieProcessingService from "../services/cieProcessingService";

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : "Internal server error";
}

function requireInternalKey(req: Request, res: Response): boolean {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || typeof apiKey !== "string" || !apiKey.startsWith("co1_internal_")) {
    res.status(401).json({ error: "Invalid or missing internal API key" });
    return false;
  }
  return true;
}

export function registerCieInternalRoutes(app: Express): void {

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/internal/cie/event
  // Accepts a market event from Icon eTrade or other Cellion Labs apps.
  // Inserts into cie_events and processes immediately (non-blocking).
  // ──────────────────────────────────────────────────────────────────────────
  app.post("/api/internal/cie/event", async (req: Request, res: Response) => {
    try {
      if (!requireInternalKey(req, res)) return;

      const schema = z.object({
        source_app: z.enum(["icon_etrade", "manual_admin", "naya_direct"]),
        event_type: z.enum(["price_update", "trade_volume", "dividend_declared", "corporate_action", "index_update"]),
        ticker: z.string().min(1).max(20).toUpperCase().optional(),
        payload: z.record(z.unknown()).default({}),
        occurred_at: z.string().datetime(),
      });

      const body = schema.parse(req.body);

      // Insert event record
      const [event] = await db.insert(cieEvents).values({
        sourceApp: body.source_app,
        eventType: body.event_type,
        ticker: body.ticker ?? null,
        payload: body.payload as Record<string, unknown>,
        occurredAt: new Date(body.occurred_at),
      }).returning();

      // Process async — never block the response
      setImmediate(async () => {
        try {
          await cieProcessingService.processIncomingEvent(event);
        } catch (err) {
          console.error("[CIEInternal] Event processing error:", errMsg(err));
        }
      });

      return res.status(201).json({ success: true, event_id: event.id });
    } catch (e: unknown) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      console.error("[CIEInternal] POST /event error:", errMsg(e));
      return res.status(500).json({ error: errMsg(e) });
    }
  });

}
