/**
 * CIE Intelligence Engine — Public REST API
 *
 * Base path: /api/v1/cie
 *
 * Authentication: X-API-Key header with `cie:read` scope.
 *
 * Tier gating (encoded as API key permissions):
 *   free       → only `cie:read`          — market pulse
 *   subscriber → `cie:read` + `cie:subscriber` — scores, history, dividends
 *   pro        → `cie:read` + `cie:subscriber` + `cie:pro` — signals, sector-rotation
 */

import type { Express, Response, NextFunction } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { authenticateApiKey, type ApiKeyRequest } from "../middleware/apiKeyAuth";

// ─── Tier constants ────────────────────────────────────────────────────────────
//
// DESIGN DECISION: CIE tiers are encoded as API key permissions rather than
// read from a separate billing/subscription record. This is intentional for
// Task #30 (API surface + gating). Task #31 (CIE Subscription Billing) will
// introduce a `cieSubscriptions` table; at that point the key-issuance flow
// will set/update these permission scopes based on the active billing plan,
// so the permission array remains the runtime source of truth for access
// control while billing governs how permissions are assigned.
//
// Tier hierarchy (additive):
//   free       → ["cie:read"]
//   subscriber → ["cie:read", "cie:subscriber"]
//   pro        → ["cie:read", "cie:subscriber", "cie:pro"]

type CieTier = "free" | "subscriber" | "pro";
const TIER_ORDER: Record<CieTier, number> = { free: 0, subscriber: 1, pro: 2 };

/**
 * Returns the effective CIE tier for a request based on its permissions.
 * `cie:pro` implies all lower tiers (pro keys always have subscriber access too).
 */
function getEffectiveTier(permissions: string[]): CieTier {
  if (permissions.includes("cie:pro")) return "pro";
  if (permissions.includes("cie:subscriber")) return "subscriber";
  return "free";
}

/**
 * Middleware factory that enforces a minimum CIE tier.
 * Must be placed after authenticateApiKey so apiKeyContext is populated.
 */
function requireCieTier(minTier: CieTier) {
  return (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    const perms = req.apiKeyContext?.permissions ?? [];
    const effective = getEffectiveTier(perms);
    if (TIER_ORDER[effective] < TIER_ORDER[minTier]) {
      return res.status(403).json({
        error: `This endpoint requires CIE ${minTier} tier or higher`,
        currentTier: effective,
        requiredTier: minTier,
        upgradeUrl: "https://cellionone.com/cie/subscribe",
        code: "INSUFFICIENT_CIE_TIER",
      });
    }
    next();
  };
}

// Shared auth middleware for all CIE endpoints (skips KYC billing check)
const cieAuth = authenticateApiKey("cie:read", { skipBillingCheck: true });

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatKoboToNaira(kobo: number | null | undefined): number | null {
  if (kobo == null) return null;
  return kobo / 100;
}

function dividendUrgency(exDivDate: string): "urgent" | "soon" | "upcoming" {
  const today = new Date();
  const ex = new Date(exDivDate);
  const daysUntil = Math.ceil((ex.getTime() - today.getTime()) / 86400000);
  if (daysUntil <= 7) return "urgent";
  if (daysUntil <= 21) return "soon";
  return "upcoming";
}

// ─── Route registration ────────────────────────────────────────────────────────

export function registerCieApiRoutes(app: Express): void {

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/v1/cie/pulse
  // Market pulse snapshot — ASI, Brent crude, Naira/USD
  // Available to all tiers (free+)
  // ──────────────────────────────────────────────────────────────────────────
  app.get("/api/v1/cie/pulse", cieAuth, async (req: ApiKeyRequest, res: Response) => {
    try {
      const pulse = await storage.getLatestCieMarketPulse();

      if (!pulse) {
        return res.json({
          available: false,
          message: "Market pulse data not yet populated. Check back after the next scheduled update.",
        });
      }

      return res.json({
        available: true,
        asiIndex: pulse.asiIndex != null ? pulse.asiIndex / 100 : null,
        asiDailyChangePct: pulse.asiChange != null ? pulse.asiChange / 10000 : null,
        brentCrudeUsd: pulse.brentCrudeUsdCents != null ? pulse.brentCrudeUsdCents / 100 : null,
        ngnPerUsd: pulse.ngnPerUsd != null ? pulse.ngnPerUsd / 100 : null,
        source: pulse.source ?? "manual",
        updatedAt: pulse.updatedAt,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Internal error";
      res.status(500).json({ error: msg });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/v1/cie/securities
  // Paginated list of all scored NGX securities — Subscriber+
  // ──────────────────────────────────────────────────────────────────────────
  app.get(
    "/api/v1/cie/securities",
    cieAuth,
    requireCieTier("subscriber"),
    async (req: ApiKeyRequest, res: Response) => {
      try {
        const schema = z.object({
          page:   z.coerce.number().int().min(1).default(1),
          limit:  z.coerce.number().int().min(1).max(100).default(50),
          sector: z.string().optional(),
        });
        const { page, limit, sector } = schema.parse(req.query);

        const scores = await storage.getLatestCieScores();

        // Optional sector filter
        const filtered = sector
          ? scores.filter(s => s.sector.toLowerCase() === sector.toLowerCase())
          : scores;

        const total = filtered.length;
        const start = (page - 1) * limit;
        const paged = filtered.slice(start, start + limit);

        return res.json({
          securities: paged.map(s => ({
            ticker:          s.symbol,
            name:            s.name,
            sector:          s.sector,
            ias:             s.ias,
            rs:              s.rs,
            cs:              s.cs,
            recommendation:  s.recommendation,
            scoreDate:       s.scoreDate,
            updatedAt:       s.createdAt,
          })),
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        });
      } catch (e: unknown) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
        const msg = e instanceof Error ? e.message : "Internal error";
        res.status(500).json({ error: msg });
      }
    },
  );

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/v1/cie/securities/:ticker
  // Full score detail including pillar breakdown — Subscriber+
  // ──────────────────────────────────────────────────────────────────────────
  app.get(
    "/api/v1/cie/securities/:ticker",
    cieAuth,
    requireCieTier("subscriber"),
    async (req: ApiKeyRequest, res: Response) => {
      try {
        const ticker = req.params.ticker.toUpperCase();
        const security = await storage.getCieSecurityBySymbol(ticker);
        if (!security) {
          return res.status(404).json({ error: `Security '${ticker}' not found` });
        }

        const score = await storage.getLatestCieScore(security.id);
        const latestPrice = await storage.getLatestCiePrice(security.id);

        return res.json({
          ticker:         security.symbol,
          name:           security.name,
          sector:         security.sector,
          isin:           security.isin,
          listingDate:    security.listingDate,
          sharesOutstanding: security.sharesOutstanding,
          latestPrice:    latestPrice
            ? {
                date:        latestPrice.tradeDate,
                closeNaira:  formatKoboToNaira(latestPrice.closeKobo),
                openNaira:   formatKoboToNaira(latestPrice.openKobo),
                highNaira:   formatKoboToNaira(latestPrice.highKobo),
                lowNaira:    formatKoboToNaira(latestPrice.lowKobo),
                volume:      latestPrice.volume,
              }
            : null,
          scores: score
            ? {
                scoreDate:      score.scoreDate,
                ias:            score.ias,
                rs:             score.rs,
                cs:             score.cs,
                recommendation: score.recommendation,
                pillarBreakdown: score.pillarBreakdown,
                dataPointsUsed: score.dataPointsUsed,
                updatedAt:      score.createdAt,
              }
            : null,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Internal error";
        res.status(500).json({ error: msg });
      }
    },
  );

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/v1/cie/securities/:ticker/history
  // IAS/RS/CS score time series up to 90 days — Subscriber+
  // ──────────────────────────────────────────────────────────────────────────
  app.get(
    "/api/v1/cie/securities/:ticker/history",
    cieAuth,
    requireCieTier("subscriber"),
    async (req: ApiKeyRequest, res: Response) => {
      try {
        const ticker = req.params.ticker.toUpperCase();
        const { days } = z.object({
          days: z.coerce.number().int().min(1).max(90).default(30),
        }).parse(req.query);

        const security = await storage.getCieSecurityBySymbol(ticker);
        if (!security) {
          return res.status(404).json({ error: `Security '${ticker}' not found` });
        }

        const history = await storage.listCieScoreHistory(security.id, days);

        return res.json({
          ticker: security.symbol,
          name:   security.name,
          days,
          count:  history.length,
          history: history.map(h => ({
            date:           h.scoreDate,
            ias:            h.ias,
            rs:             h.rs,
            cs:             h.cs,
            recommendation: h.recommendation,
          })),
        });
      } catch (e: unknown) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
        const msg = e instanceof Error ? e.message : "Internal error";
        res.status(500).json({ error: msg });
      }
    },
  );

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/v1/cie/dividends
  // Upcoming ex-dividend dates with urgency flags — Subscriber+
  // ──────────────────────────────────────────────────────────────────────────
  app.get(
    "/api/v1/cie/dividends",
    cieAuth,
    requireCieTier("subscriber"),
    async (req: ApiKeyRequest, res: Response) => {
      try {
        const { upcomingOnly } = z.object({
          upcomingOnly: z.enum(["true", "false"]).transform(v => v === "true").default("true"),
        }).parse(req.query);

        const dividends = await storage.listCieDividends(upcomingOnly);

        return res.json({
          count: dividends.length,
          dividends: dividends.map(d => ({
            ticker:              d.symbol,
            name:                d.name,
            exDividendDate:      d.exDividendDate,
            paymentDate:         d.paymentDate,
            amountPerShareNaira: formatKoboToNaira(d.amountPerShareKobo),
            urgency:             dividendUrgency(d.exDividendDate),
            notes:               d.notes,
          })),
        });
      } catch (e: unknown) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
        const msg = e instanceof Error ? e.message : "Internal error";
        res.status(500).json({ error: msg });
      }
    },
  );

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/v1/cie/signals
  // Analyst signals — Pro only
  // ──────────────────────────────────────────────────────────────────────────
  app.get(
    "/api/v1/cie/signals",
    cieAuth,
    requireCieTier("pro"),
    async (req: ApiKeyRequest, res: Response) => {
      try {
        const { limit, type } = z.object({
          limit: z.coerce.number().int().min(1).max(50).default(20),
          type:  z.enum(["rumour", "news", "trade_call", "sector_rotation", "all"]).default("all"),
        }).parse(req.query);

        const signals = await storage.listCieSignals(true, limit);

        const filtered = type === "all" ? signals : signals.filter(s => s.type === type);

        return res.json({
          count: filtered.length,
          signals: filtered.map(s => ({
            id:          s.id,
            ticker:      s.symbol ?? null,
            type:        s.type,
            sentiment:   s.sentiment,
            credibility: s.credibility,
            content:     s.content,
            tags:        s.tags ?? [],
            publishedAt: s.publishedAt,
            expiresAt:   s.expiresAt,
          })),
        });
      } catch (e: unknown) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
        const msg = e instanceof Error ? e.message : "Internal error";
        res.status(500).json({ error: msg });
      }
    },
  );

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/v1/cie/sector-rotation
  // Sector-level IAS rankings and momentum direction — Pro only
  // ──────────────────────────────────────────────────────────────────────────
  app.get(
    "/api/v1/cie/sector-rotation",
    cieAuth,
    requireCieTier("pro"),
    async (req: ApiKeyRequest, res: Response) => {
      try {
        const scores = await storage.getLatestCieScores();

        // Group scores by sector
        const sectorMap = new Map<string, typeof scores>();
        for (const s of scores) {
          if (!sectorMap.has(s.sector)) sectorMap.set(s.sector, []);
          sectorMap.get(s.sector)!.push(s);
        }

        const sectors = Array.from(sectorMap.entries()).map(([sector, items]) => {
          const iasList = items.map(i => i.ias ?? 0);
          const avgIas  = Math.round(iasList.reduce((a, b) => a + b, 0) / iasList.length);
          const maxIas  = Math.max(...iasList);
          const minIas  = Math.min(...iasList);

          // Top 3 by IAS
          const top3 = [...items]
            .sort((a, b) => (b.ias ?? 0) - (a.ias ?? 0))
            .slice(0, 3)
            .map(i => ({ ticker: i.symbol, name: i.name, ias: i.ias, recommendation: i.recommendation }));

          // Momentum heuristic: avgIas ≥ 60 → bullish; ≤ 35 → bearish; else neutral
          const momentum: "bullish" | "bearish" | "neutral" =
            avgIas >= 60 ? "bullish" : avgIas <= 35 ? "bearish" : "neutral";

          return { sector, avgIas, maxIas, minIas, count: items.length, momentum, top3 };
        });

        // Sort by avgIas descending
        sectors.sort((a, b) => b.avgIas - a.avgIas);

        const scoreDate = scores.length > 0 ? scores[0].scoreDate : null;

        return res.json({
          scoreDate,
          totalSecurities: scores.length,
          sectors,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Internal error";
        res.status(500).json({ error: msg });
      }
    },
  );

  console.log("[CIE] Public API routes registered (/api/v1/cie/*)");
}
