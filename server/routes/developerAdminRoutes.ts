/**
 * Developer Admin Routes — manage developer orgs from the admin portal
 * Auth: isAuthenticated + admin role check
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { eq, desc, and } from "drizzle-orm";
import { developerOrgs, kycApiKeys } from "@shared/schema";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";

function requireAdminRole(req: Request, res: Response, next: () => void) {
  const userId = (req as any).user?.claims?.sub;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  storage.getUserRoles(userId).then(roles => {
    if (!roles.includes("admin")) return res.status(403).json({ error: "Admin access required" });
    next();
  }).catch(() => res.status(500).json({ error: "Role check failed" }));
}

export function registerDeveloperAdminRoutes(app: Express): void {

  // ── GET /api/admin/developers ────────────────────────────────────────────
  app.get("/api/admin/developers", isAuthenticated, requireAdminRole, async (_req: Request, res: Response) => {
    try {
      const orgs = await db.select().from(developerOrgs).orderBy(desc(developerOrgs.createdAt));
      res.json({ orgs });
    } catch (err) {
      console.error("[DevAdmin] GET /developers error:", err);
      res.status(500).json({ error: "Failed to list developer orgs" });
    }
  });

  // ── PATCH /api/admin/developers/:id/approve ──────────────────────────────
  app.patch("/api/admin/developers/:id/approve", isAuthenticated, requireAdminRole, async (req: Request, res: Response) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const [updated] = await db.update(developerOrgs)
        .set({ isApproved: true, sandboxOnly: false, updatedAt: new Date() })
        .where(eq(developerOrgs.id, id))
        .returning();
      if (!updated) return res.status(404).json({ error: "Developer org not found" });
      res.json({ org: updated, message: "Developer org approved for live access" });
    } catch (err) {
      res.status(500).json({ error: "Failed to approve" });
    }
  });

  // ── PATCH /api/admin/developers/:id/suspend ──────────────────────────────
  app.patch("/api/admin/developers/:id/suspend", isAuthenticated, requireAdminRole, async (req: Request, res: Response) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const [updated] = await db.update(developerOrgs)
        .set({ isSuspended: true, updatedAt: new Date() })
        .where(eq(developerOrgs.id, id))
        .returning();
      if (!updated) return res.status(404).json({ error: "Developer org not found" });
      res.json({ org: updated, message: "Developer org suspended" });
    } catch (err) {
      res.status(500).json({ error: "Failed to suspend" });
    }
  });

  // ── PATCH /api/admin/developers/:id/unsuspend ────────────────────────────
  app.patch("/api/admin/developers/:id/unsuspend", isAuthenticated, requireAdminRole, async (req: Request, res: Response) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const [updated] = await db.update(developerOrgs)
        .set({ isSuspended: false, updatedAt: new Date() })
        .where(eq(developerOrgs.id, id))
        .returning();
      if (!updated) return res.status(404).json({ error: "Developer org not found" });
      res.json({ org: updated });
    } catch (err) {
      res.status(500).json({ error: "Failed to unsuspend" });
    }
  });

  // ── GET /api/admin/developers/:id/keys ──────────────────────────────────
  app.get("/api/admin/developers/:id/keys", isAuthenticated, requireAdminRole, async (req: Request, res: Response) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const keys = await db.select().from(kycApiKeys)
        .where(eq(kycApiKeys.developerOrgId, id))
        .orderBy(desc(kycApiKeys.createdAt));
      res.json({ keys: keys.map(k => ({
        id: k.id, name: k.name, keyPrefix: k.keyPrefix,
        environment: k.environment, permissions: k.permissions,
        isActive: k.isActive, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt,
      })) });
    } catch (err) {
      res.status(500).json({ error: "Failed to list keys" });
    }
  });
}
