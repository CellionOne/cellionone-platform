/**
 * CIE Subscription Billing Routes
 *
 * Session-authenticated (Cellion user account). Manages Paystack recurring
 * subscriptions for CIE tier access (Free / Subscriber / Pro).
 *
 * Routes:
 *   GET  /api/cie-billing/status     — current tier + subscription state
 *   POST /api/cie-billing/subscribe  — initiate payment for a new tier
 *   POST /api/cie-billing/cancel     — cancel at period end
 *   POST /api/cie-billing/upgrade    — switch Subscriber → Pro
 *   POST /api/cie-billing/downgrade  — switch Pro → Subscriber
 *
 * Subscription ownership model:
 *   Subscriptions are org-scoped when the user belongs to a KYC organisation
 *   (as creator OR as an accepted member). Any org member can view/manage the
 *   org's CIE subscription. Individual users without an org have personal
 *   subscriptions keyed by userId only.
 *
 * Paystack flow:
 *   1. POST /transaction/initialize with { plan, email, metadata }
 *      Subscription record created with status='pending'.
 *   2. Redirect user to authorizationUrl
 *   3. On charge.success webhook (metadata.type = 'cie_subscription'):
 *      → Update subscription to status='active'; set Paystack codes + period dates.
 *      → If previousSubscriptionId in metadata → mark previous as 'expired'.
 *   4. On subscription.disable webhook → status='cancelled'
 *   5. On invoice.payment_failed webhook → status='past_due'
 *
 * Pricing (task spec):
 *   Subscriber: ₦5,000/month  (500,000 kobo)
 *   Pro:        ₦10,000/month (1,000,000 kobo)
 */

import type { Express, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { db } from "../db";
import { kycOrganisations, kycOrgMembers, cieSubscriptions } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import type { CieSubscription } from "@shared/schema";

const PAYSTACK_API_BASE = "https://api.paystack.co";

type CieTier = "free" | "subscriber" | "pro";

const TIER_LABELS: Record<CieTier, string> = {
  free: "Free",
  subscriber: "CIE Subscriber",
  pro: "CIE Pro",
};

// Monthly amounts in kobo (NGN). Display only — Paystack plan amount governs actual charge.
const TIER_AMOUNTS_KOBO: Record<Exclude<CieTier, "free">, number> = {
  subscriber: 500_000,   // ₦5,000/month
  pro: 1_000_000,        // ₦10,000/month
};

function getPaystackSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_TEST_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured");
  return key;
}

async function paystackRequest<T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" = "GET",
  body?: Record<string, unknown>,
): Promise<T> {
  const secretKey = getPaystackSecretKey();
  const response = await fetch(`${PAYSTACK_API_BASE}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok || !data.status) {
    throw new Error(data.message || `Paystack API error: ${response.status}`);
  }
  return data.data;
}

function getPlanCode(tier: "subscriber" | "pro"): string | null {
  if (tier === "subscriber") return process.env.PAYSTACK_CIE_SUBSCRIBER_PLAN_CODE || null;
  if (tier === "pro") return process.env.PAYSTACK_CIE_PRO_PLAN_CODE || null;
  return null;
}

/**
 * CIE Tier Plan Definitions
 *
 * Three tiers; only paid tiers have Paystack plans.
 * Free is the default tier — no plan code needed, no billing.
 *
 * Tier       | Paystack Plan | Amount         | Features
 * -----------|---------------|----------------|-----------------------------------
 * free        | none (default)| ₦0/month       | 2 securities, no analytics
 * subscriber  | PLN_xxx       | ₦5,000/month   | 20 securities, basic analytics
 * pro         | PLN_xxx       | ₦10,000/month  | Unlimited securities + full suite
 */
export const CIE_PLAN_CONFIG = [
  {
    tier: "free" as const,
    paystackPlanCode: null,
    amountKobo: 0,
    name: "CIE Free",
    description: "Default access tier — no subscription required",
  },
  {
    tier: "subscriber" as const,
    paystackPlanCode: process.env.PAYSTACK_CIE_SUBSCRIBER_PLAN_CODE ?? null,
    amountKobo: TIER_AMOUNTS_KOBO.subscriber,
    name: "CIE Subscriber — Monthly",
    description: "CIE Subscriber tier, monthly subscription",
  },
  {
    tier: "pro" as const,
    paystackPlanCode: process.env.PAYSTACK_CIE_PRO_PLAN_CODE ?? null,
    amountKobo: TIER_AMOUNTS_KOBO.pro,
    name: "CIE Pro — Monthly",
    description: "CIE Pro tier, monthly subscription",
  },
] as const;

/**
 * Seed Paystack CIE plans for the two paid tiers (Subscriber and Pro).
 * Free tier is the platform default — it does not require a Paystack plan.
 * Also updates existing plans if the amount differs from the spec.
 * Called on startup — logs plan codes for admin to copy into env vars.
 */
export async function seedCiePlans(): Promise<void> {
  if (!process.env.PAYSTACK_SECRET_KEY && !process.env.PAYSTACK_TEST_SECRET_KEY) {
    console.log("[CIE Billing] Paystack not configured — skipping CIE plan seeding");
    return;
  }

  console.log("[CIE Billing] Free tier: default access (no Paystack plan)");

  const plans = CIE_PLAN_CONFIG
    .filter((p) => p.tier !== "free")
    .map((p) => ({
      tier: p.tier as "subscriber" | "pro",
      envKey: p.tier === "subscriber" ? "PAYSTACK_CIE_SUBSCRIBER_PLAN_CODE" : "PAYSTACK_CIE_PRO_PLAN_CODE",
      name: p.name,
      amount: p.amountKobo,
    }));

  for (const plan of plans) {
    const envCode = process.env[plan.envKey];
    try {
      const listResult = await paystackRequest<any[]>("/plan?perPage=100");
      const planList: any[] = Array.isArray(listResult) ? listResult : [];
      const existing = planList.find((p: any) => p.name === plan.name);

      if (existing) {
        if (existing.amount !== plan.amount) {
          await paystackRequest(`/plan/${existing.plan_code}`, "PUT", {
            amount: plan.amount,
            interval: "monthly",
          });
          console.log(`[CIE Billing] Updated plan "${plan.name}" amount to ${plan.amount} kobo`);
        }
        if (!envCode) {
          console.log(`[CIE Billing] Plan "${plan.name}" exists: ${existing.plan_code}`);
          console.log(`[CIE Billing] ⚠️  Set env var: ${plan.envKey}=${existing.plan_code}`);
        } else {
          console.log(`[CIE Billing] ${plan.envKey} configured (${envCode})`);
        }
      } else {
        const created = await paystackRequest<{ plan_code: string }>("/plan", "POST", {
          name: plan.name,
          amount: plan.amount,
          interval: "monthly",
          description: plan.name,
        });
        console.log(`[CIE Billing] Created plan "${plan.name}": ${created.plan_code}`);
        console.log(`[CIE Billing] ⚠️  Set env var: ${plan.envKey}=${created.plan_code}`);
      }
    } catch (err: any) {
      console.warn(`[CIE Billing] Failed to seed plan "${plan.name}": ${err.message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Org resolution helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find the KYC organisation a user belongs to — either as the creator
 * (via kycOrganisations.createdByUserId) or as an accepted member
 * (via kycOrgMembers). Returns null if the user has no org.
 */
async function resolveOrgForUser(userId: string): Promise<number | null> {
  try {
    // Check if user created an org
    const [creatorOrg] = await db.select({ id: kycOrganisations.id })
      .from(kycOrganisations)
      .where(eq(kycOrganisations.createdByUserId, userId))
      .limit(1);
    if (creatorOrg) return creatorOrg.id;

    // Check accepted org membership
    const [memberRow] = await db.select({ orgId: kycOrgMembers.orgId })
      .from(kycOrgMembers)
      .where(and(
        eq(kycOrgMembers.userId, userId),
        eq(kycOrgMembers.inviteStatus, "accepted"),
      ))
      .limit(1);
    return memberRow?.orgId ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve the current ACTIVE CIE subscription for a user.
 * If the user belongs to an org → look up by orgId (org-scoped).
 * Otherwise → look up by userId (personal subscription).
 * Returns both the resolved orgId and the active subscription.
 */
async function resolveUserCieBilling(userId: string): Promise<{
  orgId: number | null;
  activeSub: CieSubscription | undefined;
}> {
  const orgId = await resolveOrgForUser(userId);
  const activeSub = orgId
    ? await storage.getCieSubscriptionByOrgId(orgId)
    : await storage.getCieSubscriptionByUserId(userId);
  return { orgId, activeSub };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared checkout helper — used by subscribe / upgrade / downgrade
// Returns the checkout data object; callers are responsible for res.json().
// ─────────────────────────────────────────────────────────────────────────────
type CieCheckoutResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: number; error: string; code?: string };

async function buildCieCheckout(params: {
  req: any;
  userId: string;
  userEmail: string;
  orgId: number | null;
  tier: "subscriber" | "pro";
  previousSubscriptionId?: number;
  actionLabel: string;
}): Promise<CieCheckoutResult> {
  const { req, userId, userEmail, orgId, tier, previousSubscriptionId, actionLabel } = params;

  const planCode = getPlanCode(tier);
  if (!planCode) {
    return {
      ok: false,
      status: 503,
      error: `CIE ${tier} plan is not yet configured. Please contact support.`,
      code: "PLAN_NOT_CONFIGURED",
    };
  }

  const reference = `cie_sub_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
  const baseUrl = req.headers.origin ||
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://cellionone.com");

  const txResult = await paystackRequest<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }>("/transaction/initialize", "POST", {
    email: userEmail,
    amount: TIER_AMOUNTS_KOBO[tier],
    reference,
    plan: planCode,
    currency: "NGN",
    callback_url: `${baseUrl}/cie/subscribe/success?reference=${reference}`,
    metadata: {
      type: "cie_subscription",
      userId,
      tier,
      orgId: orgId ?? null,
      ...(previousSubscriptionId ? { previousSubscriptionId } : {}),
      custom_fields: [
        { display_name: "CIE Tier", variable_name: "cie_tier", value: tier },
        { display_name: "User ID", variable_name: "user_id", value: userId },
      ],
    },
  });

  const pendingSub = await storage.createCieSubscription({
    userId,
    orgId: orgId ?? undefined,
    tier,
    status: "pending",
    paystackEmail: userEmail,
    paystackPlanCode: planCode,
    paystackReference: reference,
  });

  await storage.createAuditLog({
    actorUserId: userId,
    action: actionLabel,
    entityType: "cie_subscription",
    entityId: String(pendingSub.id),
    details: { tier, reference, planCode, orgId, previousSubscriptionId },
  });

  return {
    ok: true,
    data: {
      authorizationUrl: txResult.authorization_url,
      reference,
      subscriptionId: pendingSub.id,
      tier,
      amountNaira: TIER_AMOUNTS_KOBO[tier] / 100,
      currency: "NGN",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Route registration
// ─────────────────────────────────────────────────────────────────────────────
export function registerCieBillingRoutes(app: Express): void {
  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/cie-billing/status
  // ──────────────────────────────────────────────────────────────────────────
  app.get("/api/cie-billing/status", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { orgId, activeSub } = await resolveUserCieBilling(userId);

      return res.json({
        id: activeSub?.id,
        tier: activeSub ? activeSub.tier : "free",
        status: activeSub ? activeSub.status : "none",
        orgId: orgId ?? undefined,
        currentPeriodStart: activeSub?.currentPeriodStart,
        currentPeriodEnd: activeSub?.currentPeriodEnd,
        cancelAtPeriodEnd: activeSub?.cancelAtPeriodEnd,
        paystackSubscriptionCode: activeSub?.paystackSubscriptionCode,
        plans: {
          free: { amountNaira: 0, interval: "none" },
          subscriber: { amountNaira: TIER_AMOUNTS_KOBO.subscriber / 100, interval: "monthly" },
          pro: { amountNaira: TIER_AMOUNTS_KOBO.pro / 100, interval: "monthly" },
        },
        currency: "NGN",
      });
    } catch (err: any) {
      console.error("[CIE Billing] Status error:", err);
      res.status(500).json({ error: "Failed to retrieve subscription status" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/cie-billing/subscribe
  // Initiate a new CIE subscription (subscriber or pro).
  // ──────────────────────────────────────────────────────────────────────────
  app.post("/api/cie-billing/subscribe", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { tier } = z.object({ tier: z.enum(["subscriber", "pro"]) }).parse(req.body);

      const cieEnabled = await storage.getFeatureFlag("enable_cie_service");
      if (!cieEnabled?.isEnabled) {
        return res.status(503).json({ error: "CIE service is not currently available" });
      }

      const user = await storage.getUser(userId);
      if (!user?.email) return res.status(400).json({ error: "User email is required" });

      const { orgId, activeSub } = await resolveUserCieBilling(userId);

      // Reject if already on this tier or a higher tier
      if (activeSub) {
        if (activeSub.tier === tier) {
          return res.status(409).json({
            error: `Already on an active CIE ${TIER_LABELS[tier]} subscription`,
            subscriptionId: activeSub.id,
          });
        }
        if (activeSub.tier === "pro" && tier === "subscriber") {
          return res.status(409).json({
            error: "Already on a higher CIE Pro plan. Use /downgrade to switch.",
            subscriptionId: activeSub.id,
          });
        }
      }

      // Reject duplicate pending record for the same tier
      const latestSub = orgId
        ? (await db.select().from(cieSubscriptions)
            .where(and(eq(cieSubscriptions.orgId, orgId), eq(cieSubscriptions.status, "pending")))
            .orderBy(desc(cieSubscriptions.createdAt))
            .limit(1))[0]
        : await storage.getLatestCieSubscriptionByUserId(userId);

      if (latestSub?.status === "pending" && latestSub.tier === tier) {
        return res.status(409).json({
          error: `A pending CIE ${tier} subscription already exists. Complete checkout or wait for it to expire.`,
          subscriptionId: latestSub.id,
        });
      }

      const result = await buildCieCheckout({
        req, userId, userEmail: user.email, orgId, tier,
        actionLabel: "cie_subscription_initiated",
      });
      return result.ok ? res.json(result.data) : res.status(result.status).json({ error: result.error, code: result.code });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: err.errors });
      console.error("[CIE Billing] Subscribe error:", err);
      res.status(500).json({ error: err.message || "Failed to initiate subscription" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/cie-billing/cancel
  // Cancel the current active subscription at period end.
  // ──────────────────────────────────────────────────────────────────────────
  app.post("/api/cie-billing/cancel", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { orgId, activeSub: sub } = await resolveUserCieBilling(userId);
      if (!sub) return res.status(404).json({ error: "No active CIE subscription found" });

      await storage.updateCieSubscription(sub.id, { cancelAtPeriodEnd: true });

      let managementLink: string | null = null;
      if (sub.paystackSubscriptionCode) {
        try {
          const linkResult = await paystackRequest<{ link: string }>(
            `/subscription/${sub.paystackSubscriptionCode}/manage/link`,
          );
          managementLink = linkResult.link;
        } catch (e: any) {
          console.warn("[CIE Billing] Failed to get Paystack management link:", e.message);
        }
      }

      await storage.createAuditLog({
        actorUserId: userId,
        action: "cie_subscription_cancel_requested",
        entityType: "cie_subscription",
        entityId: String(sub.id),
        details: { tier: sub.tier, orgId, cancelAtPeriodEnd: true },
      });

      await storage.createNotification({
        userId,
        title: "CIE Subscription Cancellation Requested",
        message: `Your CIE ${TIER_LABELS[sub.tier as CieTier]} subscription will cancel at the end of the billing period.`,
        type: "info",
        linkUrl: "/cie/subscribe",
      });

      return res.json({
        message: "Subscription set to cancel at period end",
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: true,
        managementLink,
      });
    } catch (err: any) {
      console.error("[CIE Billing] Cancel error:", err);
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/cie-billing/upgrade
  // Upgrade Subscriber → Pro.
  // ──────────────────────────────────────────────────────────────────────────
  app.post("/api/cie-billing/upgrade", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { orgId, activeSub } = await resolveUserCieBilling(userId);
      if (!activeSub) return res.status(404).json({ error: "No active CIE subscription to upgrade" });
      if (activeSub.tier === "pro") return res.status(409).json({ error: "Already on the CIE Pro tier" });

      const user = await storage.getUser(userId);
      if (!user?.email) return res.status(400).json({ error: "User email is required" });

      const result = await buildCieCheckout({
        req, userId, userEmail: user.email, orgId, tier: "pro",
        previousSubscriptionId: activeSub.id,
        actionLabel: "cie_subscription_upgrade_initiated",
      });
      return result.ok ? res.json(result.data) : res.status(result.status).json({ error: result.error, code: result.code });
    } catch (err: any) {
      console.error("[CIE Billing] Upgrade error:", err);
      res.status(500).json({ error: err.message || "Failed to initiate upgrade" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/cie-billing/downgrade
  // Downgrade Pro → Subscriber.
  // Creates a new pending Subscriber subscription with a checkout payment.
  // When charge.success fires, the Pro subscription is marked expired and the
  // Subscriber subscription becomes active.
  // The caller also receives a Paystack management link to disable the Pro
  // recurring plan on Paystack's side.
  // ──────────────────────────────────────────────────────────────────────────
  app.post("/api/cie-billing/downgrade", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { orgId, activeSub } = await resolveUserCieBilling(userId);
      if (!activeSub) return res.status(404).json({ error: "No active CIE subscription to downgrade" });
      if (activeSub.tier !== "pro") {
        return res.status(409).json({
          error: `Current tier is "${activeSub.tier}" — downgrade is only applicable from Pro`,
        });
      }

      const user = await storage.getUser(userId);
      if (!user?.email) return res.status(400).json({ error: "User email is required" });

      // Mark the current Pro subscription as pending cancellation
      await storage.updateCieSubscription(activeSub.id, { cancelAtPeriodEnd: true });

      // Obtain a Paystack management link so the user can disable the Pro recurring plan
      let managementLink: string | null = null;
      if (activeSub.paystackSubscriptionCode) {
        try {
          const linkResult = await paystackRequest<{ link: string }>(
            `/subscription/${activeSub.paystackSubscriptionCode}/manage/link`,
          );
          managementLink = linkResult.link;
        } catch (e: any) {
          console.warn("[CIE Billing] Failed to get management link for downgrade:", e.message);
        }
      }

      // Initiate the new Subscriber checkout; webhook will expire the Pro on success
      const result = await buildCieCheckout({
        req, userId, userEmail: user.email, orgId, tier: "subscriber",
        previousSubscriptionId: activeSub.id,
        actionLabel: "cie_subscription_downgrade_initiated",
      });

      if (!result.ok) {
        return res.status(result.status).json({ error: result.error, code: result.code });
      }

      // Include the Paystack management link so the user can also disable the Pro plan
      return res.json({ ...result.data, managementLink });
    } catch (err: any) {
      console.error("[CIE Billing] Downgrade error:", err);
      res.status(500).json({ error: err.message || "Failed to initiate downgrade" });
    }
  });

  console.log("[CIE Billing] Routes registered (/api/cie-billing/*)");
}
