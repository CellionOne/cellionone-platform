/**
 * CIE Intelligence Engine — Public REST API
 * Base path: /api/v1/cie
 * Authentication: X-API-Key (cie:read scope)
 * Tiers: free | subscriber | pro — resolved from cieSubscriptions table via apiKeyAuth middleware
 */

import type { Express, Response, NextFunction } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { authenticateApiKey, invalidateCieApiKeyTierCache, type ApiKeyRequest } from "../middleware/apiKeyAuth";
import { generateCieScoreNarrative, isOpenAIAvailable } from "../services/aiService";
import { generateSectorAINote } from "../services/cieReportService";

type CieTier = "free" | "subscriber" | "pro";
const TIER_ORDER: Record<CieTier, number> = { free: 0, subscriber: 1, pro: 2 };

/**
 * Invalidate the CIE tier cache for an org.
 * Called by webhook handler after subscription state changes.
 */
export function invalidateCieOrgTierCache(orgId: number): void {
  invalidateCieApiKeyTierCache(orgId);
}

/**
 * Enforces a minimum CIE tier. Reads resolved tier from apiKeyContext (set by authenticateApiKey).
 */
function requireCieTier(minTier: CieTier) {
  return (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    const effective = (req.apiKeyContext?.cieTier ?? "free") as CieTier;
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
// Intelligence alias auth — same behaviour, different scope string
const intelligenceAuth = authenticateApiKey("intelligence:read", { skipBillingCheck: true });

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
          commentary: null,
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
        commentary: pulse.commentary ?? null,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Internal error";
      res.status(500).json({ error: msg });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/v1/intelligence/pulse
  // Alias for /api/v1/cie/pulse — intelligence:read scope
  // ──────────────────────────────────────────────────────────────────────────
  app.get("/api/v1/intelligence/pulse", intelligenceAuth, async (req: ApiKeyRequest, res: Response) => {
    try {
      const pulse = await storage.getLatestCieMarketPulse();
      if (!pulse) {
        return res.json({
          available: false,
          commentary: null,
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
        commentary: pulse.commentary ?? null,
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

        // Load all supporting data in parallel
        const [scores, allSecurities, allDividends, allLatestPrices, allSignals] = await Promise.all([
          storage.getLatestCieScores(),
          storage.listCieSecurities(true),
          storage.listCieDividends(true),
          storage.listLatestCiePricesAllActive(),
          storage.listCieSignals(true, 200),
        ]);

        // Build lookup maps
        const secBySecId = new Map(allSecurities.map(s => [s.id, s]));
        const divBySecId = new Map<number, typeof allDividends[0]>();
        for (const d of allDividends) {
          const ex = divBySecId.get(d.securityId);
          if (!ex || d.exDividendDate < ex.exDividendDate) divBySecId.set(d.securityId, d);
        }
        const priceBySecId = new Map(allLatestPrices.map(p => [p.securityId, p]));

        // Latest published signal per security
        const latestSignalBySecId = new Map<number, typeof allSignals[0]>();
        for (const sig of [...allSignals].reverse()) {
          if (sig.securityId != null) latestSignalBySecId.set(sig.securityId, sig);
        }

        const today = new Date().toISOString().slice(0, 10);

        // Optional sector filter
        const filtered = sector
          ? scores.filter(s => s.sector.toLowerCase() === sector.toLowerCase())
          : scores;

        const total = filtered.length;
        const start = (page - 1) * limit;
        const paged = filtered.slice(start, start + limit);

        return res.json({
          securities: paged.map(s => {
            const sec = secBySecId.get(s.securityId);
            const div = divBySecId.get(s.securityId);
            const price = priceBySecId.get(s.securityId);
            const sig = latestSignalBySecId.get(s.securityId);

            const closeKobo = price?.closeKobo ?? null;
            const openKobo = price?.openKobo ?? null;
            const dayChangePct = closeKobo && openKobo && openKobo !== 0
              ? parseFloat(((closeKobo - openKobo) / openKobo * 100).toFixed(2))
              : null;

            const divAmountKobo = div?.amountPerShareKobo ?? null;
            const divYieldPct = closeKobo && divAmountKobo && closeKobo > 0
              ? parseFloat(((divAmountKobo / closeKobo) * 100).toFixed(2))
              : null;

            const nextExDivDate = div?.exDividendDate ?? null;
            const daysToExDiv = nextExDivDate
              ? Math.ceil((new Date(nextExDivDate).getTime() - new Date(today).getTime()) / 86400000)
              : null;

            return {
              ticker:          s.symbol,
              name:            s.name,
              sector:          s.sector,
              ias:             s.ias,
              rs:              s.rs,
              cs:              s.cs,
              recommendation:  s.recommendation,
              scoreDate:       s.scoreDate,
              // Technical indicators
              rsi14:           s.rsi14 ?? null,
              ma50:            formatKoboToNaira(s.ma50Kobo),
              aboveMa50:       s.aboveMa50 ?? null,
              dayChangePct,
              weekReturnPct:   s.weekReturn != null ? s.weekReturn / 100 : null,
              monthReturnPct:  s.monthReturn != null ? s.monthReturn / 100 : null,
              ytdReturnPct:    s.ytdReturn != null ? s.ytdReturn / 100 : null,
              dSig:            s.dSig ?? null,
              wSig:            s.wSig ?? null,
              mSig:            s.mSig ?? null,
              ySig:            s.ySig ?? null,
              stars:           s.stars ?? null,
              latestPriceNaira: formatKoboToNaira(closeKobo),
              // Analyst intelligence fields
              behaviourPattern: sec?.divBehaviourPattern ?? null,
              entryZone: sec?.entryZoneLowKobo && sec?.entryZoneHighKobo
                ? { low: formatKoboToNaira(sec.entryZoneLowKobo), high: formatKoboToNaira(sec.entryZoneHighKobo) }
                : null,
              targetPrice: formatKoboToNaira(sec?.targetPriceKobo),
              // Dividend intelligence
              nextExDivDate,
              daysToExDiv,
              daysToQual: daysToExDiv != null ? daysToExDiv - 1 : null,
              divYieldPct,
              divAmountNaira: formatKoboToNaira(divAmountKobo),
              // Latest signal
              latestSignal: sig
                ? { type: sig.type, sentiment: sig.sentiment, publishedAt: sig.publishedAt }
                : null,
              updatedAt:       s.createdAt,
            };
          }),
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
  // Optional: ?aiSummary=true — includes an AI-generated analyst narrative
  // ──────────────────────────────────────────────────────────────────────────
  app.get(
    "/api/v1/cie/securities/:ticker",
    cieAuth,
    requireCieTier("subscriber"),
    async (req: ApiKeyRequest, res: Response) => {
      try {
        const ticker = (req.params.ticker as string).toUpperCase();
        const wantsAiSummary = req.query.aiSummary === "true" || req.query.aiSummary === "1";

        const security = await storage.getCieSecurityBySymbol(ticker);
        if (!security) {
          return res.status(404).json({ error: `Security '${ticker}' not found` });
        }

        const [score, latestPrice, allUpcomingDivs, allSignals] = await Promise.all([
          storage.getLatestCieScore(security.id),
          storage.getLatestCiePrice(security.id),
          storage.listCieDividends(true),           // upcoming only
          storage.listCieSignals(true, 200),          // published, last 200
        ]);

        const latestPriceNaira = latestPrice?.closeKobo != null ? latestPrice.closeKobo / 100 : null;
        const today = new Date().toISOString().slice(0, 10);

        // Dividend enrichment: nearest upcoming ex-div for this security
        const secDivs = allUpcomingDivs.filter(d => d.securityId === security.id)
          .sort((a, b) => a.exDividendDate.localeCompare(b.exDividendDate));
        const nearestDiv = secDivs[0] ?? null;
        const daysToExDiv = nearestDiv
          ? Math.round((new Date(nearestDiv.exDividendDate).getTime() - new Date(today).getTime()) / 86400000)
          : null;
        const divAmountNaira = nearestDiv?.amountPerShareKobo != null ? nearestDiv.amountPerShareKobo / 100 : null;
        const divYieldPct = divAmountNaira != null && latestPriceNaira && latestPriceNaira > 0
          ? parseFloat(((divAmountNaira / latestPriceNaira) * 100).toFixed(4))
          : null;

        // Day% — open→close on latest price date
        const dayChangePct = latestPrice?.openKobo && latestPrice.openKobo > 0
          ? parseFloat((((latestPrice.closeKobo - latestPrice.openKobo) / latestPrice.openKobo) * 100).toFixed(4))
          : null;

        // Latest signal for this security
        const secSignal = allSignals.find(sig => sig.securityId === security.id) ?? null;
        const latestSignal = secSignal
          ? { type: secSignal.type, sentiment: secSignal.sentiment, content: secSignal.content, publishedAt: secSignal.publishedAt }
          : null;

        let aiSummary: Record<string, unknown> | null = null;
        if (wantsAiSummary && score) {
          if (!isOpenAIAvailable()) {
            aiSummary = null; // Gracefully omit rather than error
          } else {
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
            aiSummary = narrative ? (narrative as unknown as Record<string, unknown>) : null;
          }
        }

        return res.json({
          ticker:   security.symbol,
          name:     security.name,
          sector:   security.sector,
          exchange: security.exchange,
          // Analyst-maintained intelligence fields
          divBehaviourPattern: security.divBehaviourPattern ?? null,
          entryZoneLow:        formatKoboToNaira(security.entryZoneLowKobo),
          entryZoneHigh:       formatKoboToNaira(security.entryZoneHighKobo),
          targetPrice:         formatKoboToNaira(security.targetPriceKobo),
          // Dividend enrichment fields (parity with /securities list)
          divYieldPct:         divYieldPct,
          nextExDivDate:       nearestDiv?.exDividendDate ?? null,
          daysToExDiv:         daysToExDiv,
          daysToQual:          daysToExDiv !== null ? Math.max(0, daysToExDiv - 1) : null,
          divAmountNaira:      divAmountNaira,
          // Latest analyst signal
          latestSignal:        latestSignal,
          // Day% (explicit, top-level)
          dayChangePct:        dayChangePct,
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
                // Technical indicators
                rsi14:          score.rsi14 ?? null,
                ma50:           formatKoboToNaira(score.ma50Kobo),
                aboveMa50:      score.aboveMa50 ?? null,
                weekReturnPct:  score.weekReturn != null ? score.weekReturn / 100 : null,
                monthReturnPct: score.monthReturn != null ? score.monthReturn / 100 : null,
                ytdReturnPct:   score.ytdReturn != null ? score.ytdReturn / 100 : null,
                dSig:           score.dSig ?? null,
                wSig:           score.wSig ?? null,
                mSig:           score.mSig ?? null,
                ySig:           score.ySig ?? null,
                stars:          score.stars ?? null,
                updatedAt:      score.createdAt,
              }
            : null,
          ...(wantsAiSummary ? { aiSummary } : {}),
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
        const ticker = (req.params.ticker as string).toUpperCase();
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
  // Enriched sector-level IAS rankings — Pro only
  // ──────────────────────────────────────────────────────────────────────────
  app.get(
    "/api/v1/cie/sector-rotation",
    cieAuth,
    requireCieTier("pro"),
    async (req: ApiKeyRequest, res: Response) => {
      try {
        const [scores, allDividends, marketCtx] = await Promise.all([
          storage.getLatestCieScores(),
          storage.listCieDividends(true),
          storage.getLatestCieMarketContext(),
        ]);

        const today = new Date().toISOString().slice(0, 10);

        // Build div map by securityId
        const divBySecId = new Map(allDividends.map(d => [d.securityId, d]));

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

          // Avg week return for trend arrow
          const avgWeekBps = items.length > 0
            ? Math.round(items.reduce((s, i) => s + (i.weekReturn ?? 0), 0) / items.length)
            : 0;
          const trendArrow = avgWeekBps > 50 ? "↑" : avgWeekBps < -50 ? "↓" : "─";

          // Top 3 by IAS
          const top3 = [...items]
            .sort((a, b) => (b.ias ?? 0) - (a.ias ?? 0))
            .slice(0, 3)
            .map(i => ({
              ticker: i.symbol, name: i.name, ias: i.ias,
              recommendation: i.recommendation,
              weekReturnPct: i.weekReturn != null ? i.weekReturn / 100 : null,
              stars: i.stars ?? null,
            }));

          // Dividend angle — nearest ex-div dates in sector
          const sectorDivs = items
            .map(i => ({ ticker: i.symbol, div: divBySecId.get(i.securityId) }))
            .filter(x => x.div)
            .map(x => ({
              ticker: x.ticker,
              exDivDate: x.div!.exDividendDate,
              daysUntil: Math.ceil((new Date(x.div!.exDividendDate).getTime() - new Date(today).getTime()) / 86400000),
            }))
            .filter(x => x.daysUntil >= -1)
            .sort((a, b) => a.daysUntil - b.daysUntil)
            .slice(0, 3);

          // Momentum heuristic
          const momentum: "bullish" | "bearish" | "neutral" =
            avgIas >= 60 ? "bullish" : avgIas <= 35 ? "bearish" : "neutral";

          const keyMovers = top3.slice(0, 2).map(t => `${t.ticker} (${t.recommendation})`).join(", ") || "N/A";

          return {
            sector,
            avgIas,
            maxIas,
            minIas,
            count: items.length,
            momentum,
            trendArrow,
            avgWeekReturnPct: avgWeekBps / 100,
            top3,
            dividendAngle: sectorDivs,
            keyMovers,        // needed for AI note generation below
          };
        });

        // Sort by avgIas descending
        sectors.sort((a, b) => b.avgIas - a.avgIas);

        // Generate per-sector AI notes in parallel (with fallback if AI unavailable)
        const sectorDivAngles = new Map<string, string>();
        for (const s of sectors) {
          sectorDivAngles.set(s.sector, s.dividendAngle.length > 0
            ? `${s.dividendAngle.length} dividend(s) upcoming`
            : "No upcoming dividends");
        }
        const sectorsWithNotes = await Promise.all(sectors.map(async s => {
          const divAngle = sectorDivAngles.get(s.sector) ?? "N/A";
          const aiNote = await generateSectorAINote(s.sector, s.avgIas, s.trendArrow, s.keyMovers, divAngle);
          const { keyMovers: _km, ...rest } = s;
          return { ...rest, aiNote };
        }));

        const scoreDate = scores.length > 0 ? scores[0].scoreDate : null;

        return res.json({
          scoreDate,
          totalSecurities: scores.length,
          contextDate: marketCtx?.contextDate ?? null,
          analystNotes: marketCtx?.notes ?? null,
          sectors: sectorsWithNotes,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Internal error";
        res.status(500).json({ error: msg });
      }
    },
  );

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/v1/cie/market-summary
  // Daily market summary — gainers/losers counts, top movers, macro context — Subscriber+
  // ──────────────────────────────────────────────────────────────────────────
  app.get(
    "/api/v1/cie/market-summary",
    cieAuth,
    requireCieTier("subscriber"),
    async (req: ApiKeyRequest, res: Response) => {
      try {
        const [scores, marketCtx, allLatestPrices] = await Promise.all([
          storage.getLatestCieScores(),
          storage.getLatestCieMarketContext(),
          storage.listLatestCiePricesAllActive(),
        ]);

        // Build map securityId → day% (close vs open)
        const dayPctMap = new Map<number, number>();
        for (const p of allLatestPrices) {
          if (p.openKobo && p.openKobo !== 0) {
            dayPctMap.set(p.securityId, ((p.closeKobo - p.openKobo) / p.openKobo) * 100);
          }
        }

        // Sort by actual Day%, fallback to weekReturn if no open data
        const withDay = scores.map(s => ({
          ...s,
          dayPct: dayPctMap.get(s.securityId) ?? (s.weekReturn != null ? s.weekReturn / 100 : 0),
        }));
        const sorted = [...withDay].sort((a, b) => b.dayPct - a.dayPct);

        const mapMover = (s: typeof sorted[0]) => ({
          ticker: s.symbol,
          name: s.name,
          sector: s.sector,
          dayChangePct: dayPctMap.has(s.securityId) ? parseFloat(s.dayPct.toFixed(2)) : null,
          weekReturnPct: s.weekReturn != null ? s.weekReturn / 100 : null,
          recommendation: s.recommendation,
          stars: s.stars ?? null,
        });

        const top5Gainers = sorted.slice(0, 5).map(mapMover);
        const top5Losers = sorted.slice(-5).reverse().map(mapMover);

        const gainersCount = marketCtx?.gainersCount ?? withDay.filter(s => s.dayPct > 0).length;
        const losersCount = marketCtx?.losersCount ?? withDay.filter(s => s.dayPct < 0).length;

        return res.json({
          date: marketCtx?.contextDate ?? new Date().toISOString().slice(0, 10),
          totalSecurities: scores.length,
          gainersCount,
          losersCount,
          unchanged: scores.length - gainersCount - losersCount,
          // Macro context from analyst inputs
          macro: marketCtx
            ? {
                asiClose:       marketCtx.asiCloseKobo != null ? marketCtx.asiCloseKobo / 100 : null,
                asiChangePct:   marketCtx.asiChangePctBps != null ? marketCtx.asiChangePctBps / 100 : null,
                brentUsd:       marketCtx.brentUsdCents != null ? marketCtx.brentUsdCents / 100 : null,
                ngnPerUsd:      marketCtx.ngnPerUsd != null ? marketCtx.ngnPerUsd / 100 : null,
                cbnMpr:         marketCtx.cbnMprBps != null ? marketCtx.cbnMprBps / 100 : null,
                contextDate:    marketCtx.contextDate,
              }
            : null,
          top5Gainers,
          top5Losers,
          scoreDate: scores.length > 0 ? scores[0].scoreDate : null,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Internal error";
        res.status(500).json({ error: msg });
      }
    },
  );

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/v1/intelligence/securities
  // NGX100 with real-time signals and recommendations
  // Standard+ tier; free tier sees top 20 with no RSI/recommendation
  // ──────────────────────────────────────────────────────────────────────────
  app.get(
    "/api/v1/intelligence/securities",
    intelligenceAuth,
    requireCieTier("free"),
    async (req: ApiKeyRequest, res: Response) => {
      try {
        const schema = z.object({
          tier:   z.enum(["free", "standard"]).optional(),
          sector: z.string().optional(),
          limit:  z.coerce.number().int().min(1).max(100).default(100),
          offset: z.coerce.number().int().min(0).default(0),
        });
        const query = schema.parse(req.query);

        const apiTier = (req.apiKeyContext?.cieTier ?? "free") as CieTier;
        const isStandard = TIER_ORDER[apiTier] >= TIER_ORDER["subscriber"];

        const { db } = await import("../db");
        const { cieSecurities } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");

        let rows = await db
          .select()
          .from(cieSecurities)
          .where(eq(cieSecurities.isActive, true));

        if (query.sector) {
          rows = rows.filter(s => s.sector.toLowerCase() === query.sector!.toLowerCase());
        }

        // Freshness: based on lastUpdatedAt
        const oneHour = 60 * 60 * 1000;
        const oneDay = 24 * oneHour;
        const now = Date.now();

        let lastUpdated: Date | null = null;
        for (const r of rows) {
          if (r.lastUpdatedAt && (!lastUpdated || r.lastUpdatedAt > lastUpdated)) {
            lastUpdated = r.lastUpdatedAt;
          }
        }
        const ageMs = lastUpdated ? now - lastUpdated.getTime() : Infinity;
        const dataFreshness = ageMs < oneHour ? "live" : ageMs < oneDay ? "delayed" : "stale";

        const total = rows.length;
        const limited = isStandard ? rows : rows.slice(0, 20);
        const paged = limited.slice(query.offset, query.offset + query.limit);

        const mapped = paged.map(s => {
          const base = {
            ticker:          s.symbol,
            name:            s.name,
            sector:          s.sector,
            lastPriceNaira:  s.lastPriceKobo != null ? s.lastPriceKobo / 100 : null,
            dayChangePct:    s.dayChangePct != null ? parseFloat(String(s.dayChangePct)) : null,
            weekChangePct:   s.weekChangePct != null ? parseFloat(String(s.weekChangePct)) : null,
            monthChangePct:  s.monthChangePct != null ? parseFloat(String(s.monthChangePct)) : null,
            volume:          s.latestVolume ?? null,
            signal:          s.signal ?? null,
            momentum:        s.momentum ?? null,
            lastUpdatedAt:   s.lastUpdatedAt ?? null,
          };
          if (!isStandard) return base; // free tier: omit RSI and recommendation
          return {
            ...base,
            rsi:            s.rsi != null ? parseFloat(String(s.rsi)) : null,
            recommendation: s.recommendation ?? null,
            investmentIntel: s.investmentIntel ?? null,
            ytdChangePct:   s.ytdChangePct != null ? parseFloat(String(s.ytdChangePct)) : null,
          };
        });

        return res.json({
          success: true,
          data: {
            securities: mapped,
            total,
            showing: mapped.length,
            last_updated: lastUpdated ?? null,
            data_freshness: dataFreshness,
            tier_note: !isStandard ? "Free tier shows top 20 securities. Upgrade for full NGX100." : undefined,
          },
        });
      } catch (e: unknown) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
        const msg = e instanceof Error ? e.message : "Internal error";
        return res.status(500).json({ error: msg });
      }
    }
  );

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/v1/intelligence/sectors
  // Sector performance summary — free+
  // ──────────────────────────────────────────────────────────────────────────
  app.get(
    "/api/v1/intelligence/sectors",
    intelligenceAuth,
    requireCieTier("free"),
    async (_req: ApiKeyRequest, res: Response) => {
      try {
        const { getSectorSummary } = await import("../services/cieProcessingService");
        const sectors = await getSectorSummary();

        return res.json({
          success: true,
          data: {
            sectors: sectors.map(s => ({
              name:             s.name,
              stock_count:      s.stockCount,
              avg_day_change_pct:  s.avgDayChangePct,
              avg_week_change_pct: s.avgWeekChangePct,
              top_performer:    s.topPerformer,
              bottom_performer: s.bottomPerformer,
              bullish_count:    s.bullishCount,
              bearish_count:    s.bearishCount,
              analyst_note:     s.analystNote,
            })),
            generated_at: new Date().toISOString(),
          },
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Internal error";
        return res.status(500).json({ error: msg });
      }
    }
  );

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/v1/intelligence/dividends
  // Upcoming dividend calendar — Pro only
  // ──────────────────────────────────────────────────────────────────────────
  app.get(
    "/api/v1/intelligence/dividends",
    intelligenceAuth,
    requireCieTier("pro"),
    async (_req: ApiKeyRequest, res: Response) => {
      try {
        const { db } = await import("../db");
        const { ngxDividends } = await import("@shared/schema");
        const { eq, gte } = await import("drizzle-orm");

        const today = new Date().toISOString().slice(0, 10);
        const rows = await db
          .select()
          .from(ngxDividends)
          .where(eq(ngxDividends.isActive, true));

        const upcoming = rows.filter(d => d.qualificationDate >= today);

        const mapped = upcoming.map(d => {
          const daysToQual = Math.ceil(
            (new Date(d.qualificationDate).getTime() - Date.now()) / 86400000
          );
          const amountNgn = d.dividendAmountKobo / 100;
          let strategy: string;
          if (daysToQual <= 7) strategy = "Accumulate before qual";
          else if (daysToQual <= 0) strategy = "Exit post-qual";
          else strategy = "Monitor";

          return {
            ticker:               d.ticker,
            company_name:         d.companyName,
            dividend_amount_ngn:  amountNgn,
            qualification_date:   d.qualificationDate,
            payment_date:         d.paymentDate ?? null,
            days_to_qualification: daysToQual,
            strategy,
          };
        }).sort((a, b) => a.days_to_qualification - b.days_to_qualification);

        return res.json({
          success: true,
          data: {
            dividends: mapped,
            total: mapped.length,
            note: mapped.length === 0
              ? "No upcoming dividends in the system. Data will appear when corporate actions are received."
              : "Dividend data sourced from NGX corporate actions",
          },
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Internal error";
        return res.status(500).json({ error: msg });
      }
    }
  );

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/v1/intelligence/report
  // Download latest APRISYS NGX100 Excel report — Pro only
  // Query: ?date=YYYY-MM-DD (optional, defaults to latest)
  // ──────────────────────────────────────────────────────────────────────────
  app.get(
    "/api/v1/intelligence/report",
    intelligenceAuth,
    requireCieTier("pro"),
    async (req: ApiKeyRequest, res: Response) => {
      try {
        const { db } = await import("../db");
        const { cieReports } = await import("@shared/schema");
        const { eq, desc, and } = await import("drizzle-orm");
        const { generateAprisysReport } = await import("../services/cieReportGenerator");

        const dateParam = typeof req.query.date === "string" ? req.query.date : null;

        // Find matching report record
        let query = db.select().from(cieReports).where(eq(cieReports.status, "complete")).orderBy(desc(cieReports.generatedAt)).limit(1);
        if (dateParam) {
          query = db.select().from(cieReports).where(and(eq(cieReports.reportDate, dateParam), eq(cieReports.status, "complete"))).orderBy(desc(cieReports.generatedAt)).limit(1) as typeof query;
        }

        const [report] = await query;

        if (!report) {
          return res.status(404).json({
            success: false,
            error: {
              code: "NO_REPORT_AVAILABLE",
              message: "No report has been generated yet. Reports are generated daily at 19:00 WAT.",
            },
          });
        }

        const buf = await generateAprisysReport(new Date(report.reportDate));
        const filename = `APRISYS_NGX100_Report_${report.reportDate}.xlsx`;
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Length", buf.length);
        return res.send(buf);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Internal error";
        return res.status(500).json({ error: msg });
      }
    }
  );

  console.log("[CIE] Public API routes registered (/api/v1/cie/*)");
}
