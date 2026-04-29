/**
 * CIE Portal Routes — session-authenticated endpoints for the Subscriber Portal web UI
 *
 * Base path: /api/cie-portal
 * Authentication: session cookie (isAuthenticated)
 * Tier enforcement: looks up the user's active CIE subscription
 *
 * GET /api/cie-portal/status          — subscription status + tier (all users)
 * GET /api/cie-portal/pulse           — market pulse (all tiers)
 * GET /api/cie-portal/market-summary  — macro ticker data (subscriber+)
 * GET /api/cie-portal/securities      — securities list (subscriber+)
 * GET /api/cie-portal/securities/:ticker — security detail + history (subscriber+)
 * GET /api/cie-portal/signals         — analyst signals (pro+)
 * GET /api/cie-portal/api-keys        — list cie:read keys for user's org
 * POST /api/cie-portal/api-keys       — create a cie:read key
 * DELETE /api/cie-portal/api-keys/:id — revoke a key
 */

import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { eq, and, desc, gte, sql, or, isNull } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { generateCieScoreNarrative, isOpenAIAvailable } from "../services/aiService";
import {
  cieSubscriptions,
  cieScores,
  kycOrganisations,
  kycOrgMembers,
  kycApiKeys,
  kycApiUsageLogs,
} from "../../shared/schema";

type CieTier = "free" | "subscriber" | "pro";
const TIER_ORDER: Record<CieTier, number> = { free: 0, subscriber: 1, pro: 2 };

interface AuthRequest extends Request {
  user?: { claims?: { sub?: string } };
  cieTier?: CieTier;
}

function getUserId(req: AuthRequest): string {
  return req.user?.claims?.sub ?? "";
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : "Internal server error";
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
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = getUserId(req);

    // Platform admins get full "pro" access on all portal endpoints (for User Preview).
    // cie_analyst does NOT get this bypass — they have a separate cockpit role.
    if (userId) {
      const roles = await storage.getUserRoles(userId);
      if (roles.includes("admin")) {
        req.cieTier = "pro";
        return next();
      }
    }

    const tier = await resolveUserTier(userId);
    req.cieTier = tier;
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
  app.get("/api/cie-portal/status", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const userId = getUserId(req);
      const tier = await resolveUserTier(userId);
      const now = new Date();

      // Find the subscription that actually grants the current tier.
      // Must mirror resolveUserTier() precedence: org-scoped first, personal second.
      let activeSub: typeof cieSubscriptions.$inferSelect | null = null;

      // 1. Check org-scoped subscriptions (matches resolveUserTier order)
      const memberships = await db.select({ orgId: kycOrgMembers.orgId })
        .from(kycOrgMembers)
        .where(and(eq(kycOrgMembers.userId, userId), eq(kycOrgMembers.inviteStatus, "accepted")))
        .limit(5);
      for (const { orgId } of memberships) {
        const [orgSub] = await db.select()
          .from(cieSubscriptions)
          .where(and(
            eq(cieSubscriptions.orgId, orgId),
            eq(cieSubscriptions.status, "active"),
            gte(cieSubscriptions.currentPeriodEnd, now),
          ))
          .orderBy(desc(cieSubscriptions.currentPeriodEnd))
          .limit(1);
        if (orgSub) { activeSub = orgSub; break; }
      }

      // 2. Fall back to personal subscription if no org sub found
      if (!activeSub) {
        const [personalSub] = await db.select()
          .from(cieSubscriptions)
          .where(and(
            eq(cieSubscriptions.userId, userId),
            eq(cieSubscriptions.status, "active"),
            gte(cieSubscriptions.currentPeriodEnd, now),
          ))
          .orderBy(desc(cieSubscriptions.currentPeriodEnd))
          .limit(1);
        if (personalSub) activeSub = personalSub;
      }

      res.json({
        tier,
        isPaid: tier !== "free",
        subscription: activeSub ? {
          id: activeSub.id,
          tier: activeSub.tier,
          status: activeSub.status,
          currentPeriodEnd: activeSub.currentPeriodEnd,
          cancelAtPeriodEnd: activeSub.cancelAtPeriodEnd,
          cancelledAt: activeSub.cancelledAt,
          paystackCustomerCode: activeSub.paystackCustomerCode,
        } : null,
      });
    } catch (err: unknown) {
      res.status(500).json({ error: errMsg(err) });
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
        commentary: pulse.commentary ?? null,
        updatedAt: pulse.updatedAt,
      });
    } catch (err: unknown) {
      res.status(500).json({ error: errMsg(err) });
    }
  });

  // ── GET /api/cie-portal/market-summary ──────────────────────────────────
  // Macro ticker data (ASI, Brent, NGN/USD, CBN MPR) — Subscriber+
  app.get(
    "/api/cie-portal/market-summary",
    isAuthenticated,
    requireCieTierSession("subscriber"),
    async (_req: AuthRequest, res: Response) => {
      try {
        const ctx = await storage.getLatestCieMarketContext();
        if (!ctx) {
          return res.json({ available: false });
        }
        return res.json({
          available: true,
          contextDate: ctx.contextDate,
          asiClose:    ctx.asiCloseKobo   != null ? ctx.asiCloseKobo / 100   : null,
          asiChangePct: ctx.asiChangePctBps != null ? ctx.asiChangePctBps / 100 : null,
          brentUsd:    ctx.brentUsdCents  != null ? ctx.brentUsdCents / 100  : null,
          ngnPerUsd:   ctx.ngnPerUsd      != null ? ctx.ngnPerUsd / 100      : null,
          cbnMpr:      ctx.cbnMprBps      != null ? ctx.cbnMprBps / 100      : null,
        });
      } catch (err: unknown) {
        res.status(500).json({ error: errMsg(err) });
      }
    },
  );

  // ── GET /api/cie-portal/securities ──────────────────────────────────────
  app.get(
    "/api/cie-portal/securities",
    isAuthenticated,
    requireCieTierSession("subscriber"),
    async (req: AuthRequest, res: Response) => {
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

        // ── Compute RS momentum (daily / weekly / monthly) ──────────────────
        // Fetch all scores from the last 31 days in one query, then derive trends
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 31);
        const recentRows = await db.select({
          securityId: cieScores.securityId,
          scoreDate: cieScores.scoreDate,
          rs: cieScores.rs,
        }).from(cieScores)
          .where(gte(cieScores.scoreDate, cutoff.toISOString().slice(0, 10)))
          .orderBy(cieScores.securityId, desc(cieScores.scoreDate));

        // Group by securityId: sorted most-recent-first
        const histMap = new Map<number, { scoreDate: string; rs: number }[]>();
        for (const row of recentRows) {
          if (!histMap.has(row.securityId)) histMap.set(row.securityId, []);
          histMap.get(row.securityId)!.push({ scoreDate: row.scoreDate, rs: row.rs ?? 0 });
        }

        const trendDir = (curr: number, prior: number | undefined): "up" | "down" | "flat" | null => {
          if (prior === undefined) return null;
          const diff = curr - prior;
          if (Math.abs(diff) < 0.5) return "flat";
          return diff > 0 ? "up" : "down";
        };

        const getMomentum = (secId: number, currRs: number | null): { daily: string | null; weekly: string | null; monthly: string | null } => {
          const hist = histMap.get(secId) ?? [];
          if (currRs === null || hist.length < 2) return { daily: null, weekly: null, monthly: null };
          const d1 = hist[1]?.rs;
          const d7 = hist[5]?.rs;
          const d30 = hist[20]?.rs;
          return {
            daily: trendDir(currRs, d1),
            weekly: trendDir(currRs, d7),
            monthly: trendDir(currRs, d30),
          };
        };

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
            momentum: getMomentum(s.securityId, s.rs),
          })),
          sectors: Array.from(new Set(scores.map(s => s.sector))).sort(),
          total: filtered.length,
        });
      } catch (err: unknown) {
        res.status(500).json({ error: errMsg(err) });
      }
    },
  );

  // ── GET /api/cie-portal/securities/:ticker ───────────────────────────────
  app.get(
    "/api/cie-portal/securities/:ticker",
    isAuthenticated,
    requireCieTierSession("subscriber"),
    async (req: AuthRequest, res: Response) => {
      try {
        const ticker = (req.params.ticker as string).toUpperCase();
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
          exchange: security.exchange,
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
      } catch (err: unknown) {
        res.status(500).json({ error: errMsg(err) });
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
      } catch (err: unknown) {
        res.status(500).json({ error: errMsg(err) });
      }
    },
  );

  // ── GET /api/cie-portal/api-keys ─────────────────────────────────────────
  // Supports both org-scoped and personal (no-org) CIE subscribers
  app.get("/api/cie-portal/api-keys", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const userId = getUserId(req);
      const tier = await resolveUserTier(userId);
      if (tier === "free") return res.status(403).json({ error: "CIE subscription required to use API keys." });

      const orgId = await resolveUserOrg(userId);

      // Build ownership filter: org keys OR personal keys (userId-scoped, no org)
      const ownershipFilter = orgId
        ? or(
            eq(kycApiKeys.organisationId, orgId),
            and(eq(kycApiKeys.userId, userId), isNull(kycApiKeys.organisationId)),
          )
        : and(eq(kycApiKeys.userId, userId), isNull(kycApiKeys.organisationId));

      const keys = await db.select()
        .from(kycApiKeys)
        .where(and(ownershipFilter, eq(kycApiKeys.isActive, true)))
        .orderBy(desc(kycApiKeys.createdAt));

      // Filter for cie:read keys only
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
          label: k.name,
          keyPrefix: k.keyPrefix,
          permissions: k.permissions,
          rateLimit: k.rateLimitPerMinute,
          isActive: k.isActive,
          createdAt: k.createdAt,
          lastUsedAt: usage?.lastUsedAt ?? null,
          totalCalls: Number(usage?.totalCalls ?? 0),
        };
      }));

      res.json({ keys: keysWithUsage, orgId: orgId ?? null });
    } catch (err: unknown) {
      res.status(500).json({ error: errMsg(err) });
    }
  });

  // ── POST /api/cie-portal/api-keys ────────────────────────────────────────
  // Org-scoped if the user belongs to a KYC org; personal (userId-scoped) otherwise
  app.post("/api/cie-portal/api-keys", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const userId = getUserId(req);
      const tier = await resolveUserTier(userId);
      if (tier === "free") return res.status(403).json({ error: "CIE subscription required to create API keys." });

      const { label } = z.object({ label: z.string().min(1).max(100) }).parse(req.body);
      const orgId = await resolveUserOrg(userId);

      const rawKey = `co_live_${crypto.randomBytes(16).toString("hex")}`;
      const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
      const keyPrefix = rawKey.substring(0, 12);
      const rateLimitPerMinute = tier === "pro" ? 1000 : 500;

      // Store with org ownership when available, otherwise as a personal key (userId)
      await db.insert(kycApiKeys).values(
        orgId
          ? { organisationId: orgId, name: label, keyPrefix, keyHash, permissions: ["cie:read"], rateLimitPerMinute, isActive: true }
          : { userId, name: label, keyPrefix, keyHash, permissions: ["cie:read"], rateLimitPerMinute, isActive: true },
      );

      await storage.createAuditLog({
        actorUserId: userId,
        action: "cie_api_key_created",
        entityType: "kyc_api_key",
        entityId: label,
        details: { orgId: orgId ?? null, tier, label, scope: orgId ? "org" : "personal" },
      });

      res.status(201).json({
        apiKey: rawKey,
        message: "Store this key securely — it will not be shown again.",
        label,
        permissions: ["cie:read"],
        rateLimit: rateLimitPerMinute,
      });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: err.errors });
      res.status(500).json({ error: errMsg(err) });
    }
  });

  // ── DELETE /api/cie-portal/api-keys/:id ──────────────────────────────────
  app.delete("/api/cie-portal/api-keys/:id", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const userId = getUserId(req);
      const tier = await resolveUserTier(userId);
      if (tier === "free") return res.status(403).json({ error: "CIE subscription required." });

      const orgId = await resolveUserOrg(userId);
      const keyId = parseInt(req.params.id as string);
      if (isNaN(keyId)) return res.status(400).json({ error: "Invalid key ID" });

      // Verify ownership: org-scoped OR personal
      const ownershipFilter = orgId
        ? or(
            eq(kycApiKeys.organisationId, orgId),
            and(eq(kycApiKeys.userId, userId), isNull(kycApiKeys.organisationId)),
          )
        : and(eq(kycApiKeys.userId, userId), isNull(kycApiKeys.organisationId));

      const [key] = await db.select()
        .from(kycApiKeys)
        .where(and(eq(kycApiKeys.id, keyId), ownershipFilter));
      if (!key) return res.status(404).json({ error: "Key not found" });
      // Scope guard: only CIE keys may be revoked via this endpoint
      if (!key.permissions?.includes("cie:read")) {
        return res.status(403).json({ error: "Not a CIE API key" });
      }

      await db.update(kycApiKeys).set({ isActive: false }).where(eq(kycApiKeys.id, keyId));

      await storage.createAuditLog({
        actorUserId: userId,
        action: "cie_api_key_revoked",
        entityType: "kyc_api_key",
        entityId: String(keyId),
        details: { orgId: orgId ?? null, label: key.name },
      });

      res.json({ success: true });
    } catch (err: unknown) {
      res.status(500).json({ error: errMsg(err) });
    }
  });

  // ── GET /api/cie-portal/securities/:ticker/ai-narrative ──────────────────
  // On-demand AI score narrative for a security — Subscriber+
  app.get(
    "/api/cie-portal/securities/:ticker/ai-narrative",
    isAuthenticated,
    requireCieTierSession("subscriber"),
    async (req: AuthRequest, res: Response) => {
      try {
        if (!isOpenAIAvailable()) {
          return res.status(503).json({ error: "AI analysis is not available in this environment.", code: "AI_UNAVAILABLE" });
        }

        const ticker = (req.params.ticker as string).toUpperCase();
        const security = await storage.getCieSecurityBySymbol(ticker);
        if (!security) return res.status(404).json({ error: `Security '${ticker}' not found` });

        const score = await storage.getLatestCieScore(security.id);
        if (!score) return res.status(404).json({ error: "No score data available for this security" });

        const latestPrice = await storage.getLatestCiePrice(security.id);
        const latestPriceNaira = latestPrice?.closeKobo != null ? latestPrice.closeKobo / 100 : null;

        const narrative = await generateCieScoreNarrative({
          ticker: security.symbol,
          name: security.name,
          sector: security.sector,
          ias: score.ias ?? 0,
          rs: score.rs ?? 0,
          cs: score.cs ?? 0,
          recommendation: score.recommendation ?? "",
          pillarBreakdown: (score.pillarBreakdown as Record<string, number> | null) ?? null,
          latestPriceNaira,
          scoreDate: score.scoreDate,
        });

        if (!narrative) {
          return res.status(503).json({ error: "AI narrative generation failed. Please try again." });
        }

        res.json({ ticker, narrative });
      } catch (err: unknown) {
        res.status(500).json({ error: errMsg(err) });
      }
    },
  );

  // ── GET /api/cie-portal/ai-status ────────────────────────────────────────
  // Lightweight endpoint for the frontend to check AI availability
  app.get("/api/cie-portal/ai-status", isAuthenticated, (_req: Request, res: Response) => {
    res.json({ available: isOpenAIAvailable() });
  });
}
