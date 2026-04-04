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
 *   2. Redirect user to authorizationUrl
 *   3. On charge.success webhook (metadata.type = 'cie_subscription'):
 *      → activate subscription, store subscription code + period dates
 *   4. On subscription.disable webhook:
 *      → mark subscription cancelled
 *   5. On invoice.payment_failed webhook:
 *      → mark subscription past_due, send notification
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";

const PAYSTACK_API_BASE = "https://api.paystack.co";

type CieTier = "free" | "subscriber" | "pro";

const TIER_LABELS: Record<CieTier, string> = {
  free: "Free",
  subscriber: "CIE Subscriber",
  pro: "CIE Pro",
};

// Monthly amounts in kobo (NGN)
const TIER_AMOUNTS_KOBO: Record<Exclude<CieTier, "free">, number> = {
  subscriber: 5_000_00, // ₦50,000/month
  pro: 15_000_00,       // ₦150,000/month
};

function getPaystackSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_TEST_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured");
  return key;
}

async function paystackRequest<T>(
  endpoint: string,
  method: "GET" | "POST" = "GET",
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
 * Seed Paystack CIE plans if the env vars are not set.
 * Called on startup — logs plan codes for admin to copy into env vars.
 * Safe to call multiple times (idempotent via plan lookup).
 */
export async function seedCiePlans(): Promise<void> {
  if (!process.env.PAYSTACK_SECRET_KEY && !process.env.PAYSTACK_TEST_SECRET_KEY) {
    console.log("[CIE Billing] Paystack not configured — skipping CIE plan seeding");
    return;
  }

  const plans: Array<{ tier: "subscriber" | "pro"; envKey: string; name: string; amount: number }> = [
    {
      tier: "subscriber",
      envKey: "PAYSTACK_CIE_SUBSCRIBER_PLAN_CODE",
      name: "CIE Subscriber — Monthly",
      amount: TIER_AMOUNTS_KOBO.subscriber,
    },
    {
      tier: "pro",
      envKey: "PAYSTACK_CIE_PRO_PLAN_CODE",
      name: "CIE Pro — Monthly",
      amount: TIER_AMOUNTS_KOBO.pro,
    },
  ];

  for (const plan of plans) {
    if (process.env[plan.envKey]) {
      console.log(`[CIE Billing] ${plan.envKey} already set (${process.env[plan.envKey]})`);
      continue;
    }
    try {
      // Check if a plan with this name already exists
      const listResult = await paystackRequest<{ data: Array<{ plan_code: string; name: string }> }>(
        `/plan?perPage=100`,
        "GET",
      );
      const existing = Array.isArray((listResult as any)) 
        ? (listResult as any[]).find((p: any) => p.name === plan.name)
        : null;

      if (existing) {
        console.log(`[CIE Billing] Plan "${plan.name}" already exists: ${existing.plan_code}`);
        console.log(`[CIE Billing] ⚠️  Set env var: ${plan.envKey}=${existing.plan_code}`);
      } else {
        const created = await paystackRequest<{ plan_code: string }>(
          "/plan",
          "POST",
          {
            name: plan.name,
            amount: plan.amount,
            interval: "monthly",
            description: `Cellion Intelligence Engine — ${TIER_LABELS[plan.tier]} tier, monthly subscription`,
          },
        );
        console.log(`[CIE Billing] Created Paystack plan "${plan.name}": ${created.plan_code}`);
        console.log(`[CIE Billing] ⚠️  Set env var: ${plan.envKey}=${created.plan_code}`);
      }
    } catch (err: any) {
      console.warn(`[CIE Billing] Failed to seed plan "${plan.name}": ${err.message}`);
    }
  }
}

export function registerCieBillingRoutes(app: Express): void {
  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/cie-billing/status
  // Returns the caller's active CIE subscription details (or free tier if none).
  // ──────────────────────────────────────────────────────────────────────────
  app.get("/api/cie-billing/status", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const sub = await storage.getCieSubscriptionByUserId(userId);

      if (!sub || sub.status !== "active") {
        return res.json({
          tier: "free",
          status: "none",
          subscriberPlanAmount: TIER_AMOUNTS_KOBO.subscriber / 100,
          proPlanAmount: TIER_AMOUNTS_KOBO.pro / 100,
          currency: "NGN",
        });
      }

      return res.json({
        id: sub.id,
        tier: sub.tier,
        status: sub.status,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        paystackSubscriptionCode: sub.paystackSubscriptionCode,
        subscriberPlanAmount: TIER_AMOUNTS_KOBO.subscriber / 100,
        proPlanAmount: TIER_AMOUNTS_KOBO.pro / 100,
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
  // Returns: { authorizationUrl, reference }
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

      // Ensure no active subscription already exists for this tier
      const existing = await storage.getCieSubscriptionByUserId(userId);
      if (existing && existing.status === "active" && existing.tier === tier) {
        return res.status(409).json({
          error: `You already have an active CIE ${tier} subscription`,
          subscriptionId: existing.id,
        });
      }

      const reference = `cie_sub_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;

      const baseUrl = req.headers.origin || 
        (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://cellionone.com");

      const txResult = await paystackRequest<{
        authorization_url: string;
        access_code: string;
        reference: string;
      }>("/transaction/initialize", "POST", {
        email: user.email,
        amount: TIER_AMOUNTS_KOBO[tier],
        reference,
        plan: planCode,
        currency: "NGN",
        callback_url: `${baseUrl}/cie/subscribe/success?reference=${reference}`,
        metadata: {
          type: "cie_subscription",
          userId,
          tier,
          custom_fields: [
            { display_name: "CIE Tier", variable_name: "cie_tier", value: tier },
            { display_name: "User ID", variable_name: "user_id", value: userId },
          ],
        },
      });

      // Store a pending subscription record
      const pendingSub = await storage.createCieSubscription({
        userId,
        tier,
        status: "active",
        paystackEmail: user.email,
        paystackPlanCode: planCode,
        paystackReference: reference,
      });

      await storage.createAuditLog({
        actorUserId: userId,
        action: "cie_subscription_initiated",
        entityType: "cie_subscription",
        entityId: String(pendingSub.id),
        details: { tier, reference, planCode },
      });

      return res.json({
        authorizationUrl: txResult.authorization_url,
        reference,
        subscriptionId: pendingSub.id,
        tier,
        amount: TIER_AMOUNTS_KOBO[tier] / 100,
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
  // Cancel the current subscription at period end.
  // Returns a Paystack management link so the user can confirm cancellation.
  // ──────────────────────────────────────────────────────────────────────────
  app.post("/api/cie-billing/cancel", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const sub = await storage.getCieSubscriptionByUserId(userId);
      if (!sub || sub.status !== "active") {
        return res.status(404).json({ error: "No active CIE subscription found" });
      }

      // Mark cancel-at-period-end in our DB immediately
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
        title: "CIE Subscription Cancellation",
        message: `Your CIE ${TIER_LABELS[sub.tier as CieTier]} subscription will be cancelled at the end of the current billing period.`,
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
  // Upgrade from Subscriber → Pro (initiates a new payment).
  // On success webhook, the existing subscription is superseded.
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
          previousSubscriptionId: existing.id,
          custom_fields: [
            { display_name: "CIE Tier", variable_name: "cie_tier", value: "pro" },
            { display_name: "User ID", variable_name: "user_id", value: userId },
          ],
        },
      });

      // Create a new pending pro subscription record
      const newSub = await storage.createCieSubscription({
        userId,
        tier: "pro",
        status: "active",
        paystackEmail: user.email,
        paystackPlanCode: planCode,
        paystackReference: reference,
      });

      await storage.createAuditLog({
        actorUserId: userId,
        action: "cie_subscription_upgrade_initiated",
        entityType: "cie_subscription",
        entityId: String(newSub.id),
        details: { from: existing.tier, to: "pro", reference },
      });

      return res.json({
        authorizationUrl: txResult.authorization_url,
        reference,
        subscriptionId: newSub.id,
        tier: "pro",
        amount: TIER_AMOUNTS_KOBO.pro / 100,
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
