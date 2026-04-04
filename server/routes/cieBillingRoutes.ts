/**
 * CIE Subscription Billing Routes
 *
 * Session-authenticated (Cellion user account). Manages Paystack recurring
 * subscriptions for CIE tier upgrades (Subscriber / Pro).
 *
 * Routes:
 *   GET  /api/cie-billing/status      — current tier + subscription state
 *   POST /api/cie-billing/subscribe   — initiate payment for a tier
 *   POST /api/cie-billing/cancel      — cancel at period end
 *   POST /api/cie-billing/upgrade     — switch to a higher tier
 *
 * Paystack flow:
 *   1. POST /transaction/initialize with { plan, email, metadata }
 *      Subscription record created with status='pending'.
 *   2. Redirect user to authorizationUrl
 *   3. On charge.success webhook (metadata.type = 'cie_subscription'):
 *      → Update subscription to status='active'; set Paystack codes + period dates.
 *   4. On subscription.disable webhook → status='cancelled'
 *   5. On invoice.payment_failed webhook → status='past_due'
 *
 * Pricing (task spec):
 *   Subscriber: ₦5,000/month  (500,000 kobo)
 *   Pro:        ₦10,000/month (1,000,000 kobo)
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { db } from "../db";
import { kycOrganisations } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";

const PAYSTACK_API_BASE = "https://api.paystack.co";

type CieTier = "free" | "subscriber" | "pro";

const TIER_LABELS: Record<CieTier, string> = {
  free: "Free",
  subscriber: "CIE Subscriber",
  pro: "CIE Pro",
};

// Monthly amounts in kobo (NGN). Display only — Paystack plan amount governs the actual charge.
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

/** Retrieve the Paystack plan code for a given tier from env vars. */
function getPlanCode(tier: "subscriber" | "pro"): string | null {
  if (tier === "subscriber") return process.env.PAYSTACK_CIE_SUBSCRIBER_PLAN_CODE || null;
  if (tier === "pro") return process.env.PAYSTACK_CIE_PRO_PLAN_CODE || null;
  return null;
}

/**
 * CIE Tier Plan Definitions
 *
 * Three tiers exist; only the paid tiers have Paystack plans.
 * Free is the default tier — no plan code needed, no billing.
 *
 * Tier | Paystack Plan | Amount        | Features
 * -----|---------------|---------------|-----------------------------------
 * free | none (default)| ₦0            | 2 securities, no analytics
 * sub  | PLN_xxx       | ₦5,000/month  | 20 securities, basic analytics
 * pro  | PLN_xxx       | ₦10,000/month | Unlimited securities + full suite
 */
export const CIE_PLAN_CONFIG = [
  {
    tier: "free" as const,
    paystackPlanCode: null,   // Free tier has no Paystack plan
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
 * The Free tier is the platform default — it does not require a Paystack plan.
 * Also updates existing plans if the amount differs from the spec.
 * Called on startup — logs plan codes for admin to copy into env vars.
 */
export async function seedCiePlans(): Promise<void> {
  if (!process.env.PAYSTACK_SECRET_KEY && !process.env.PAYSTACK_TEST_SECRET_KEY) {
    console.log("[CIE Billing] Paystack not configured — skipping CIE plan seeding");
    return;
  }

  // Free tier: no Paystack plan required; log its status for visibility
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
      // List plans and find by name
      const listResult = await paystackRequest<any[]>("/plan?perPage=100");
      const planList: any[] = Array.isArray(listResult) ? listResult : [];
      const existing = planList.find((p: any) => p.name === plan.name);

      if (existing) {
        // If amount has changed, update the plan
        if (existing.amount !== plan.amount) {
          await paystackRequest(`/plan/${existing.plan_code}`, "PUT", {
            amount: plan.amount,
            interval: "monthly",
          });
          console.log(`[CIE Billing] Updated plan "${plan.name}" amount to ${plan.amount} kobo`);
        }
        if (!envCode) {
          console.log(`[CIE Billing] Plan "${plan.name}" already exists: ${existing.plan_code}`);
          console.log(`[CIE Billing] ⚠️  Set env var: ${plan.envKey}=${existing.plan_code}`);
        } else {
          console.log(`[CIE Billing] ${plan.envKey} configured (${envCode})`);
        }
      } else {
        const created = await paystackRequest<{ plan_code: string }>("/plan", "POST", {
          name: plan.name,
          amount: plan.amount,
          interval: "monthly",
          description: `Cellion Intelligence Engine — ${TIER_LABELS[plan.tier]} tier, monthly subscription`,
        });
        console.log(`[CIE Billing] Created Paystack plan "${plan.name}": ${created.plan_code}`);
        console.log(`[CIE Billing] ⚠️  Set env var: ${plan.envKey}=${created.plan_code}`);
      }
    } catch (err: any) {
      console.warn(`[CIE Billing] Failed to seed plan "${plan.name}": ${err.message}`);
    }
  }
}

/** Look up the KYC organisation ID for a given userId (returns null if none). */
async function resolveOrgForUser(userId: string): Promise<number | null> {
  try {
    const [org] = await db.select({ id: kycOrganisations.id })
      .from(kycOrganisations)
      .where(eq(kycOrganisations.createdByUserId, userId))
      .limit(1);
    return org?.id ?? null;
  } catch {
    return null;
  }
}

export function registerCieBillingRoutes(app: Express): void {
  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/cie-billing/status
  // Returns the caller's CIE subscription state (free if none / expired).
  // ──────────────────────────────────────────────────────────────────────────
  app.get("/api/cie-billing/status", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const sub = await storage.getCieSubscriptionByUserId(userId);

      const isActive = sub?.status === "active";
      return res.json({
        id: isActive ? sub!.id : undefined,
        tier: isActive ? sub!.tier : "free",
        status: sub?.status ?? "none",
        currentPeriodStart: isActive ? sub!.currentPeriodStart : undefined,
        currentPeriodEnd: isActive ? sub!.currentPeriodEnd : undefined,
        cancelAtPeriodEnd: isActive ? sub!.cancelAtPeriodEnd : undefined,
        paystackSubscriptionCode: isActive ? sub!.paystackSubscriptionCode : undefined,
        plans: {
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
  // Creates a PENDING subscription record; activation occurs on charge.success.
  // Returns: { authorizationUrl, reference, subscriptionId, tier, amount }
  // ──────────────────────────────────────────────────────────────────────────
  app.post("/api/cie-billing/subscribe", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { tier } = z.object({
        tier: z.enum(["subscriber", "pro"]),
      }).parse(req.body);

      // Check feature flag
      const cieEnabled = await storage.getFeatureFlag("enable_cie_service");
      if (!cieEnabled?.isEnabled) {
        return res.status(503).json({ error: "CIE service is not currently available" });
      }

      const planCode = getPlanCode(tier);
      if (!planCode) {
        return res.status(503).json({
          error: `CIE ${tier} plan is not yet configured. Please contact support.`,
          code: "PLAN_NOT_CONFIGURED",
        });
      }

      const user = await storage.getUser(userId);
      if (!user?.email) {
        return res.status(400).json({ error: "User email is required for subscription" });
      }

      // Reject if an active subscription already exists for this user
      const activeSub = await storage.getCieSubscriptionByUserId(userId);
      if (activeSub && activeSub.tier === tier) {
        return res.status(409).json({
          error: `You already have an active CIE ${tier} subscription`,
          subscriptionId: activeSub.id,
        });
      }
      if (activeSub && activeSub.tier === "pro" && tier === "subscriber") {
        return res.status(409).json({
          error: "You already have a higher-tier CIE Pro subscription",
          subscriptionId: activeSub.id,
        });
      }

      // Reject if a pending record for the same tier already exists (prevents double-click duplicates)
      const latestSub = await storage.getLatestCieSubscriptionByUserId(userId);
      if (latestSub?.status === "pending" && latestSub.tier === tier) {
        return res.status(409).json({
          error: `A pending CIE ${tier} subscription already exists. Please complete checkout or wait for it to expire.`,
          subscriptionId: latestSub.id,
        });
      }

      // Resolve KYC org so the subscription can be found by API-key orgId
      const orgId = await resolveOrgForUser(userId);

      const reference = `cie_sub_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
      const baseUrl = req.headers.origin ||
        (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://cellionone.com");

      const txResult = await paystackRequest<{
        authorization_url: string;
        access_code: string;
        reference: string;
      }>("/transaction/initialize", "POST", {
        email: user.email,
        amount: TIER_AMOUNTS_KOBO[tier], // Display hint; Paystack uses plan amount
        reference,
        plan: planCode,
        currency: "NGN",
        callback_url: `${baseUrl}/cie/subscribe/success?reference=${reference}`,
        metadata: {
          type: "cie_subscription",
          userId,
          tier,
          orgId: orgId ?? null,
          custom_fields: [
            { display_name: "CIE Tier", variable_name: "cie_tier", value: tier },
            { display_name: "User ID", variable_name: "user_id", value: userId },
          ],
        },
      });

      // Create PENDING subscription — activated only on charge.success webhook
      const pendingSub = await storage.createCieSubscription({
        userId,
        orgId: orgId ?? undefined,
        tier,
        status: "pending",
        paystackEmail: user.email,
        paystackPlanCode: planCode,
        paystackReference: reference,
      });

      await storage.createAuditLog({
        actorUserId: userId,
        action: "cie_subscription_initiated",
        entityType: "cie_subscription",
        entityId: String(pendingSub.id),
        details: { tier, reference, planCode, orgId },
      });

      return res.json({
        authorizationUrl: txResult.authorization_url,
        reference,
        subscriptionId: pendingSub.id,
        tier,
        amountNaira: TIER_AMOUNTS_KOBO[tier] / 100,
        currency: "NGN",
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: err.errors });
      }
      console.error("[CIE Billing] Subscribe error:", err);
      res.status(500).json({ error: err.message || "Failed to initiate subscription" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/cie-billing/cancel
  // Cancel the current active subscription at period end.
  // Returns a Paystack management link for the user to confirm.
  // ──────────────────────────────────────────────────────────────────────────
  app.post("/api/cie-billing/cancel", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const sub = await storage.getCieSubscriptionByUserId(userId);
      if (!sub || sub.status !== "active") {
        return res.status(404).json({ error: "No active CIE subscription found" });
      }

      // Mark cancel-at-period-end; actual cancellation fires via subscription.disable webhook
      await storage.updateCieSubscription(sub.id, { cancelAtPeriodEnd: true });

      let managementLink: string | null = null;
      if (sub.paystackSubscriptionCode) {
        try {
          const linkResult = await paystackRequest<{ link: string }>(
            `/subscription/${sub.paystackSubscriptionCode}/manage/link`,
          );
          managementLink = linkResult.link;
        } catch (linkErr: any) {
          console.warn("[CIE Billing] Failed to get Paystack management link:", linkErr.message);
        }
      }

      await storage.createAuditLog({
        actorUserId: userId,
        action: "cie_subscription_cancel_requested",
        entityType: "cie_subscription",
        entityId: String(sub.id),
        details: { tier: sub.tier, cancelAtPeriodEnd: true },
      });

      await storage.createNotification({
        userId,
        title: "CIE Subscription Cancellation Requested",
        message: `Your CIE ${TIER_LABELS[sub.tier as CieTier]} subscription will cancel at the end of the current billing period.`,
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
  // Upgrade Subscriber → Pro. Creates a new PENDING subscription record.
  // Previous subscription is superseded when the upgrade charge.success arrives.
  // ──────────────────────────────────────────────────────────────────────────
  app.post("/api/cie-billing/upgrade", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const existing = await storage.getCieSubscriptionByUserId(userId);
      if (!existing || existing.status !== "active") {
        return res.status(404).json({ error: "No active CIE subscription to upgrade" });
      }
      if (existing.tier === "pro") {
        return res.status(409).json({ error: "Already on the CIE Pro tier" });
      }

      const planCode = getPlanCode("pro");
      if (!planCode) {
        return res.status(503).json({
          error: "CIE Pro plan is not yet configured. Please contact support.",
          code: "PLAN_NOT_CONFIGURED",
        });
      }

      const user = await storage.getUser(userId);
      if (!user?.email) {
        return res.status(400).json({ error: "User email is required" });
      }

      const orgId = existing.orgId ?? (await resolveOrgForUser(userId));
      const reference = `cie_sub_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
      const baseUrl = req.headers.origin ||
        (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://cellionone.com");

      const txResult = await paystackRequest<{
        authorization_url: string;
        access_code: string;
        reference: string;
      }>("/transaction/initialize", "POST", {
        email: user.email,
        amount: TIER_AMOUNTS_KOBO.pro,
        reference,
        plan: planCode,
        currency: "NGN",
        callback_url: `${baseUrl}/cie/subscribe/success?reference=${reference}&upgrade=true`,
        metadata: {
          type: "cie_subscription",
          userId,
          tier: "pro",
          orgId: orgId ?? null,
          previousSubscriptionId: existing.id,
          custom_fields: [
            { display_name: "CIE Tier", variable_name: "cie_tier", value: "pro" },
            { display_name: "User ID", variable_name: "user_id", value: userId },
          ],
        },
      });

      // Create PENDING pro subscription — activated on charge.success
      const newSub = await storage.createCieSubscription({
        userId,
        orgId: orgId ?? undefined,
        tier: "pro",
        status: "pending",
        paystackEmail: user.email,
        paystackPlanCode: planCode,
        paystackReference: reference,
      });

      await storage.createAuditLog({
        actorUserId: userId,
        action: "cie_subscription_upgrade_initiated",
        entityType: "cie_subscription",
        entityId: String(newSub.id),
        details: { from: existing.tier, to: "pro", reference, previousSubscriptionId: existing.id },
      });

      return res.json({
        authorizationUrl: txResult.authorization_url,
        reference,
        subscriptionId: newSub.id,
        tier: "pro",
        amountNaira: TIER_AMOUNTS_KOBO.pro / 100,
        currency: "NGN",
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: err.errors });
      }
      console.error("[CIE Billing] Upgrade error:", err);
      res.status(500).json({ error: err.message || "Failed to initiate upgrade" });
    }
  });

  console.log("[CIE Billing] Routes registered (/api/cie-billing/*)");
}
