/**
 * Public API Routes — no authentication required
 * Base path: /api/v1
 */

import type { Express, Request, Response } from "express";

export function registerPublicApiRoutes(app: Express): void {

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/v1/status
  // Platform health / module availability snapshot — no auth required
  // ──────────────────────────────────────────────────────────────────────────
  app.get("/api/v1/status", (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        platform: "Cellion One",
        version: "1.0.0",
        status: "operational",
        modules: {
          identity: { status: "operational", endpoints: 14 },
          escrow: { status: "operational", endpoints: 6 },
          intelligence: { status: "operational", endpoints: 1 },
          formation: { status: "operational", endpoints: 2 },
          bureau: { status: "coming_soon", endpoints: 0 },
        },
      },
      timestamp: new Date().toISOString(),
    });
  });
}
