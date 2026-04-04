/**
 * CIE Portal Routes — session-authenticated endpoints for the Subscriber Portal web UI
 *
 * Base path: /api/cie-portal
 * Authentication: session cookie (isAuthenticated)
 * Tier enforcement: looks up the user's active CIE subscription
 *
 * GET /api/cie-portal/status          — subscription status + tier (all users)
 * GET /api/cie-portal/pulse           — market pulse (all tiers)
 * GET /api/cie-portal/securities      — securities list (subscriber+)
 * GET /api/cie-portal/securities/:ticker — security detail + history (subscriber+)
 * GET /api/cie-portal/signals         — analyst signals (pro+)
 * GET /api/cie-portal/api-keys        — list cie:read keys for user's org
 * POST /api/cie-portal/api-keys       — create a cie:read key
 * DELETE /api/cie-portal/api-keys/:id — revoke a key
 */

import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import {
  cieSubscriptions,
  kycOrganisations,
  kycOrgMembers,
  kycApiKeys,
  kycApiUsageLogs,
} from "../../shared/schema";

type CieTier = "free" | "subscriber" | "pro";
const TIER_ORDER: Record<CieTier, number> = { free: 0, subscriber: 1, pro: 2 };

function getUserId(req: any): string {
  return req.user?.claims?.sub ?? "";
}

async function resolveUserTier(userId: string): Promise<CieTier> {
  if (!userId) return "free";
  const now = new Date();

  // 1. Check for org-scoped subscription
  const memberships = await db.select({ orgId: kycOrgMembers.orgId })
    .from(kycOrgMembers)
    .where(and(eq(kycOrgMembers.userId, userId), eq(kycOrgMembers.inviteStatus, "accepted")))
    .limit(5);

  if (memberships.length > 0) {
    const orgIds = memberships.map(m => m.orgId);
    for (const orgId of orgIds) {
      const [sub] = await db.select({ tier: cieSubscriptions.tier })
        .from(cieSubscriptions)
        .where(and(
          eq(cieSubscriptions.orgId, orgId),
          eq(cieSubscriptions.status, "active"),
          gte(cieSubscriptions.currentPeriodEnd, now),
        ))
        .orderBy(desc(cieSubscriptions.currentPeriodEnd))
        .limit(1);
      if (sub) return sub.tier as CieTier;
    }
  }

  // 2. Check personal subscription
  const [personal] = await db.select({ tier: cieSubscriptions.tier })
    .from(cieSubscriptions)
    .where(and(
      eq(cieSubscriptions.userId, userId),
      eq(cieSubscriptions.status, "active"),
      gte(cieSubscriptions.currentPeriodEnd, now),
    ))
    .orderBy(desc(cieSubscriptions.currentPeriodEnd))
    .limit(1);

  return personal ? (personal.tier as CieTier) : "free";
}

function requireCieTierSession(minTier: CieTier) {
  return async (req: any, res: Response, next: NextFunction) => {
    const userId = getUserId(req);
    const tier = await resolveUserTier(userId);
    (req as any).cieTier = tier;
    if (TIER_ORDER[tier] < TIER_ORDER[minTier]) {
      return res.status(403).json({
        error: `This section requires CIE ${minTier} tier or higher`,
        currentTier: tier,
        requiredTier: minTier,
        code: "INSUFFICIENT_CIE_TIER",
      });
    }
    next();
  };
}

async function resolveUserOrg(userId: string): Promise<number | null> {
  // Look for an org the user created or belongs to
  const [created] = await db.select({ id: kycOrganisations.id })
    .from(kycOrganisations)
    .where(eq(kycOrganisations.createdByUserId, userId))
    .limit(1);
  if (created) return created.id;

  const [member] = await db.select({ orgId: kycOrgMembers.orgId })
    .from(kycOrgMembers)
    .where(and(eq(kycOrgMembers.userId, userId), eq(kycOrgMembers.inviteStatus, "accepted")))
    .limit(1);
  return member?.orgId ?? null;
}

export function registerCiePortalRoutes(app: Express): void {

  // ── GET /api/cie-portal/status ───────────────────────────────────────────
  app.get("/api/cie-portal/status", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const tier = await resolveUserTier(userId);

      const now = new Date();
      const [sub] = await db.select()
        .from(cieSubscriptions)
        .where(and(
          eq(cieSubscriptions.userId, userId),
          eq(cieSubscriptions.status, "active"),
          gte(cieSubscriptions.currentPeriodEnd, now),
        ))
        .orderBy(desc(cieSubscriptions.currentPeriodEnd))
        .limit(1);

      res.json({
        tier,
        isPaid: tier !== "free",
        subscription: sub ? {
          id: sub.id,
          tier: sub.tier,
          status: sub.status,
          currentPeriodEnd: sub.currentPeriodEnd,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          cancelledAt: sub.cancelledAt,
          paystackCustomerCode: sub.paystackCustomerCode,
        } : null,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/cie-portal/pulse ────────────────────────────────────────────
  app.get("/api/cie-portal/pulse", isAuthenticated, async (_req: Request, res: Response) => {
    try {
      const pulse = await storage.getLatestCieMarketPulse();
      if (!pulse) {
        return res.json({ available: false, message: "Market pulse data not yet available." });
      }
      res.json({
        available: true,
        asiIndex: pulse.asiIndex != null ? pulse.asiIndex / 100 : null,
        asiDailyChangePct: pulse.asiChange != null ? pulse.asiChange / 10000 : null,
        brentCrudeUsd: pulse.brentCrudeUsdCents != null ? pulse.brentCrudeUsdCents / 100 : null,
        ngnPerUsd: pulse.ngnPerUsd != null ? pulse.ngnPerUsd / 100 : null,
        source: pulse.source ?? "manual",
        updatedAt: pulse.updatedAt,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/cie-portal/securities ──────────────────────────────────────
  app.get(
    "/api/cie-portal/securities",
    isAuthenticated,
    requireCieTierSession("subscriber"),
    async (req: any, res: Response) => {
      try {
        const { sector, q } = z.object({
          sector: z.string().optional(),
          q: z.string().optional(),
        }).parse(req.query);

        const scores = await storage.getLatestCieScores();

        let filtered = scores;
        if (sector && sector !== "all") {
          filtered = filtered.filter(s => s.sector?.toLowerCase() === sector.toLowerCase());
        }
        if (q) {
          const search = q.toLowerCase();
          filtered = filtered.filter(s =>
            s.symbol.toLowerCase().includes(search) ||
            s.name.toLowerCase().includes(search),
          );
        }

        res.json({
          securities: filtered.map(s => ({
            ticker: s.symbol,
            name: s.name,
            sector: s.sector,
            ias: s.ias,
            rs: s.rs,
            cs: s.cs,
            recommendation: s.recommendation,
            scoreDate: s.scoreDate,
          })),
          total: filtered.length,
          tier: (req as any).cieTier,
        });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    },
  );

  // ── GET /api/cie-portal/securities/:ticker ───────────────────────────────
  app.get(
    "/api/cie-portal/securities/:ticker",
    isAuthenticated,
    requireCieTierSession("subscriber"),
    async (req: any, res: Response) => {
      try {
        const ticker = req.params.ticker.toUpperCase();
        const security = await storage.getCieSecurityBySymbol(ticker);
        if (!security) return res.status(404).json({ error: `Security '${ticker}' not found` });

        const score = await storage.getLatestCieScore(security.id);
        const latestPrice = await storage.getLatestCiePrice(security.id);
        const history = await storage.listCieScoreHistory(security.id, 30);

        const now = new Date();

        // Dividend alert: upcoming within 14 days
        const dividends = await storage.listCieDividends(true);
        const divAlert = dividends.find(d => {
          const ex = new Date(d.exDividendDate);
          const daysUntil = Math.ceil((ex.getTime() - now.getTime()) / 86400000);
          return d.symbol === ticker && daysUntil <= 14 && daysUntil >= 0;
        });

        res.json({
          ticker: security.symbol,
          name: security.name,
          sector: security.sector,
          isin: security.isin,
          latestPrice: latestPrice ? {
            date: latestPrice.tradeDate,
            closeNaira: latestPrice.closeKobo != null ? latestPrice.closeKobo / 100 : null,
            volume: latestPrice.volume,
          } : null,
          scores: score ? {
            scoreDate: score.scoreDate,
            ias: score.ias,
            rs: score.rs,
            cs: score.cs,
            recommendation: score.recommendation,
            pillarBreakdown: score.pillarBreakdown,
          } : null,
          history: history.map(h => ({
            date: h.scoreDate,
            ias: h.ias,
            rs: h.rs,
            cs: h.cs,
          })),
          dividendAlert: divAlert ? {
            exDividendDate: divAlert.exDividendDate,
            amountPerShareNaira: divAlert.amountPerShareKobo != null ? divAlert.amountPerShareKobo / 100 : null,
            daysUntil: Math.ceil((new Date(divAlert.exDividendDate).getTime() - now.getTime()) / 86400000),
          } : null,
        });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    },
  );

  // ── GET /api/cie-portal/signals ──────────────────────────────────────────
  app.get(
    "/api/cie-portal/signals",
    isAuthenticated,
    requireCieTierSession("pro"),
    async (_req: Request, res: Response) => {
      try {
        const signals = await storage.listCieSignals(true, 30);
        res.json({ signals, count: signals.length });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    },
  );

  // ── GET /api/cie-portal/api-keys ─────────────────────────────────────────
  app.get("/api/cie-portal/api-keys", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const orgId = await resolveUserOrg(userId);
      if (!orgId) return res.json({ keys: [], orgId: null, message: "No KYC organisation found. Create one to generate API keys." });

      const keys = await db.select()
        .from(kycApiKeys)
        .where(and(eq(kycApiKeys.orgId, orgId), eq(kycApiKeys.isActive, true)))
        .orderBy(desc(kycApiKeys.createdAt));

      // Filter for cie:read keys
      const cieKeys = keys.filter(k => k.permissions?.includes("cie:read"));

      const keysWithUsage = await Promise.all(cieKeys.map(async k => {
        const [usage] = await db.select({
          lastUsedAt: sql<string>`MAX(${kycApiUsageLogs.createdAt})`.as("last_used_at"),
          totalCalls: sql<number>`COUNT(*)`.as("total_calls"),
        })
          .from(kycApiUsageLogs)
          .where(eq(kycApiUsageLogs.apiKeyId, k.id));
        return {
          id: k.id,
          label: k.label,
          keyPrefix: k.keyHash.substring(0, 8) + "••••••••",
          permissions: k.permissions,
          rateLimit: k.rateLimit,
          isActive: k.isActive,
          createdAt: k.createdAt,
          lastUsedAt: usage?.lastUsedAt ?? null,
          totalCalls: Number(usage?.totalCalls ?? 0),
        };
      }));

      res.json({ keys: keysWithUsage, orgId });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/cie-portal/api-keys ────────────────────────────────────────
  app.post("/api/cie-portal/api-keys", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const orgId = await resolveUserOrg(userId);
      if (!orgId) return res.status(400).json({ error: "No KYC organisation found. Create one to generate API keys." });

      const tier = await resolveUserTier(userId);
      if (tier === "free") return res.status(403).json({ error: "CIE subscription required to create API keys." });

      const { label } = z.object({ label: z.string().min(1).max(100) }).parse(req.body);

      const rawKey = `cie_${crypto.randomBytes(32).toString("hex")}`;
      const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
      const rateLimit = tier === "pro" ? 1000 : 500;

      await db.insert(kycApiKeys).values({
        orgId,
        label,
        keyHash,
        permissions: ["cie:read"],
        rateLimit,
        isActive: true,
      });

      await storage.createAuditLog({
        actorUserId: userId,
        action: "cie_api_key_created",
        entityType: "kyc_api_key",
        entityId: label,
        details: { orgId, tier, label },
      });

      res.status(201).json({
        apiKey: rawKey,
        message: "Store this key securely — it will not be shown again.",
        label,
        permissions: ["cie:read"],
        rateLimit,
      });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  // ── DELETE /api/cie-portal/api-keys/:id ──────────────────────────────────
  app.delete("/api/cie-portal/api-keys/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = getUserId(req);
      const orgId = await resolveUserOrg(userId);
      const keyId = parseInt(req.params.id);
      if (isNaN(keyId)) return res.status(400).json({ error: "Invalid key ID" });

      const [key] = await db.select()
        .from(kycApiKeys)
        .where(and(eq(kycApiKeys.id, keyId), eq(kycApiKeys.orgId, orgId ?? -1)));
      if (!key) return res.status(404).json({ error: "Key not found" });

      await db.update(kycApiKeys).set({ isActive: false }).where(eq(kycApiKeys.id, keyId));

      await storage.createAuditLog({
        actorUserId: userId,
        action: "cie_api_key_revoked",
        entityType: "kyc_api_key",
        entityId: String(keyId),
        details: { orgId, label: key.label },
      });

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
