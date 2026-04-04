import type { Request, Response, NextFunction } from "express";
import { validateApiKey, checkRateLimit, logApiUsage } from "../services/kycApiKeyService";
import { db } from "../db";
import { eq, and, desc, gte } from "drizzle-orm";
import { kycBillingAccounts, kycCreditTransactions, cieSubscriptions, ciePartners } from "@shared/schema";
import { sql } from "drizzle-orm";

type CieTier = "free" | "subscriber" | "pro";

export interface ApiKeyRequest extends Request {
  apiKeyContext?: {
    apiKeyId: number;
    /** Org-scoped key owner. Null for personal CIE subscriber keys. */
    orgId: number | null;
    /** Personal key owner. Null for org-scoped keys. */
    userId: string | null;
    /** CIE Partner id — set when this key belongs to a partner programme. */
    ciePartnerId: number | null;
    permissions: string[];
    /** Resolved CIE tier — populated when skipBillingCheck is true (CIE routes). */
    cieTier?: CieTier;
  };
}

export interface ApiKeyAuthOptions {
  /** When true, skip the KYC billing account check and resolve CIE subscription tier. */
  skipBillingCheck?: boolean;
}

/**
 * 5-minute in-memory cache.
 * Keyed as:
 *   "partner:<ciePartnerId>" for CIE partner keys
 *   "org:<orgId>"           for org-scoped keys
 *   "user:<userId>"         for personal keys
 * Invalidated by invalidateCieApiKeyTierCache().
 */
const cieTierCache = new Map<string, { tier: CieTier; fetchedAt: number }>();
const CIE_CACHE_TTL_MS = 5 * 60 * 1000;

export function invalidateCieApiKeyTierCache(
  orgId: number | null,
  userId?: string | null,
  ciePartnerId?: number | null,
): void {
  if (orgId !== null && orgId !== undefined) cieTierCache.delete(`org:${orgId}`);
  if (userId) cieTierCache.delete(`user:${userId}`);
  if (ciePartnerId) cieTierCache.delete(`partner:${ciePartnerId}`);
}

async function resolveCieTier(
  orgId: number | null,
  userId: string | null,
  permissions: string[],
  ciePartnerId?: number | null,
): Promise<CieTier> {
  // ── Partner programme fast-path ──────────────────────────────────────────
  // Partner keys bypass cie_subscriptions entirely; their tier comes from cie_partners.
  if (ciePartnerId !== null && ciePartnerId !== undefined) {
    const cacheKey = `partner:${ciePartnerId}`;
    const cached = cieTierCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CIE_CACHE_TTL_MS) {
      return cached.tier;
    }
    let partnerTier: CieTier = "subscriber";
    try {
      const [partner] = await db.select({ tier: ciePartners.tier, status: ciePartners.status })
        .from(ciePartners)
        .where(eq(ciePartners.id, ciePartnerId))
        .limit(1);
      if (partner && partner.status === "active") {
        partnerTier = partner.tier as CieTier;
      } else {
        partnerTier = "free"; // suspended / inactive partner loses access
      }
    } catch (err) {
      console.error("[apiKeyAuth] Partner tier resolution error:", err);
    }
    cieTierCache.set(cacheKey, { tier: partnerTier, fetchedAt: Date.now() });
    return partnerTier;
  }

  // ── Standard subscription resolution ─────────────────────────────────────
  const cacheKey = orgId !== null ? `org:${orgId}` : `user:${userId}`;
  const cached = cieTierCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CIE_CACHE_TTL_MS) {
    return cached.tier;
  }

  let tier: CieTier = "free";
  try {
    const now = new Date();

    // Build the subscription ownership filter.
    // Org-scoped keys match on orgId; personal keys match on userId.
    const ownerFilter = orgId !== null
      ? eq(cieSubscriptions.orgId, orgId)
      : eq(cieSubscriptions.userId, userId as string);

    // Step 1: Look for an active, non-expired subscription
    // Requires status='active' AND currentPeriodEnd > now to prevent stale rows from granting access
    const [activeSub] = await db.select({ tier: cieSubscriptions.tier })
      .from(cieSubscriptions)
      .where(and(
        ownerFilter,
        eq(cieSubscriptions.status, "active"),
        gte(cieSubscriptions.currentPeriodEnd, now),
      ))
      .orderBy(desc(cieSubscriptions.currentPeriodEnd))
      .limit(1);

    if (activeSub) {
      tier = activeSub.tier as CieTier;
    } else {
      // Step 2: Check if any subscription history exists
      const [anySub] = await db.select({ id: cieSubscriptions.id })
        .from(cieSubscriptions)
        .where(ownerFilter)
        .limit(1);

      if (anySub) {
        // History exists but no active row → downgraded to free
        tier = "free";
      } else {
        // No subscription history → fall back to API key permission flags.
        // This is a backward-compatibility bridge for API keys issued before the
        // subscription system was introduced (Task #31). Once all existing paid
        // API key holders have been migrated to subscriptions, remove this block
        // and let entitlement flow exclusively through the cieSubscriptions table.
        if (permissions.includes("cie:pro")) tier = "pro";
        else if (permissions.includes("cie:subscriber")) tier = "subscriber";
      }
    }
  } catch (err) {
    console.error("[apiKeyAuth] CIE tier resolution error — defaulting to free:", err);
    tier = "free";
  }

  cieTierCache.set(cacheKey, { tier, fetchedAt: Date.now() });
  return tier;
}

/**
 * Authenticate an API key and optionally enforce a required permission.
 *
 * @param requiredPermission - A single scope string OR an array of scope strings.
 *   - String: the key must have that exact scope.
 *   - Array: the key must have at least ONE of the listed scopes (OR logic).
 *   - Omitted / undefined: any valid, active API key is accepted.
 * @param options - Optional configuration flags (e.g. skipBillingCheck for CIE API).
 */
export function authenticateApiKey(requiredPermission?: string | string[], options?: ApiKeyAuthOptions) {
  return async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const apiKey = req.headers["x-api-key"] as string;

    if (!apiKey) {
      return res.status(401).json({ error: "Missing X-API-Key header" });
    }

    if (!apiKey.startsWith("co_live_")) {
      return res.status(401).json({ error: "Invalid API key format" });
    }

    const result = await validateApiKey(apiKey);
    if (!result) {
      return res.status(401).json({ error: "Invalid or expired API key" });
    }

    const { apiKey: keyRecord, orgId, userId, ciePartnerId, permissions } = result;

    if (requiredPermission) {
      const required = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
      const hasPermission = required.some(p => permissions.includes(p));
      if (!hasPermission) {
        await logApiUsage(
          keyRecord.id,
          req.path,
          req.method,
          403,
          req.ip || null,
          Date.now() - startTime
        );
        return res.status(403).json({ error: `Missing required permission: ${required.join(" or ")}` });
      }
    }

    const withinLimit = await checkRateLimit(keyRecord.id, keyRecord.rateLimitPerMinute);
    if (!withinLimit) {
      await logApiUsage(
        keyRecord.id,
        req.path,
        req.method,
        429,
        req.ip || null,
        Date.now() - startTime
      );
      return res.status(429).json({
        error: "Rate limit exceeded",
        retryAfter: 60,
      });
    }

    if (!options?.skipBillingCheck && ciePartnerId === null) {
      // Partner keys bypass billing entirely (their access is governed by cie_partners.status).
      // This guard only applies to KYC org keys and personal keys.
      if (orgId === null) {
        // Personal CIE keys have no org and always use skipBillingCheck=true; reject defensively here.
        return res.status(402).json({ error: "No billing account. Personal keys require a CIE subscription." });
      }
      const [billingAccount] = await db.select().from(kycBillingAccounts)
        .where(eq(kycBillingAccounts.organisationId, orgId));

      if (!billingAccount || !billingAccount.isActive) {
        await logApiUsage(
          keyRecord.id,
          req.path,
          req.method,
          402,
          req.ip || null,
          Date.now() - startTime
        );
        return res.status(402).json({
          error: "No active billing account. Please set up billing before using the API.",
        });
      }

      if (billingAccount.billingMode === "prepaid") {
        if (billingAccount.creditBalance <= 0) {
          await logApiUsage(
            keyRecord.id,
            req.path,
            req.method,
            402,
            req.ip || null,
            Date.now() - startTime
          );
          return res.status(402).json({
            error: "Insufficient credits. Please purchase more credits to continue.",
            creditBalance: billingAccount.creditBalance,
          });
        }
      } else if (billingAccount.billingMode === "invoiced") {
        const creditLimit = billingAccount.creditLimit || 0;
        const [usageResult] = await db.select({
          totalUsed: sql<number>`COALESCE(SUM(ABS(${kycCreditTransactions.amount})) FILTER (WHERE ${kycCreditTransactions.type} = 'usage'), 0)`,
        }).from(kycCreditTransactions)
          .where(eq(kycCreditTransactions.billingAccountId, billingAccount.id));

        const totalUsed = Number(usageResult?.totalUsed ?? 0);
        if (creditLimit > 0 && totalUsed >= creditLimit) {
          await logApiUsage(
            keyRecord.id,
            req.path,
            req.method,
            402,
            req.ip || null,
            Date.now() - startTime
          );
          return res.status(402).json({
            error: "Credit limit reached. Please contact support to increase your limit.",
            creditLimit,
            totalUsed,
          });
        }
      }
    }

    // Resolve CIE subscription tier for CIE API routes (skipBillingCheck = true)
    const cieTier = options?.skipBillingCheck
      ? await resolveCieTier(orgId, userId, permissions, ciePartnerId)
      : undefined;

    req.apiKeyContext = {
      apiKeyId: keyRecord.id,
      orgId,
      userId,
      ciePartnerId: ciePartnerId ?? null,
      permissions,
      cieTier,
    };

    res.on("finish", () => {
      logApiUsage(
        keyRecord.id,
        req.path,
        req.method,
        res.statusCode,
        req.ip || null,
        Date.now() - startTime
      ).catch(err => console.error("[API Key] Failed to log usage:", err));
    });

    next();
  };
}
