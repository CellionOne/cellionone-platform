/**
 * CIE Subscription Billing — session-authenticated routes
 *
 * GET  /api/cie-billing/status     - current subscription state
 * POST /api/cie-billing/subscribe  - initiate payment for a tier
 * POST /api/cie-billing/cancel     - cancel at period end
 * POST /api/cie-billing/upgrade    - Subscriber → Pro
 * POST /api/cie-billing/downgrade  - Pro → Subscriber
 *
 * Subscriptions are org-scoped when the user belongs to a KYC organisation
 * (as creator or accepted member); personal otherwise.
 *
 * Paystack plan codes:
 *   PAYSTACK_CIE_SUBSCRIBER_PLAN_CODE - ₦5,000/month
 *   PAYSTACK_CIE_PRO_PLAN_CODE        - ₦10,000/month
 *
 * Webhook (charge.success, subscription.disable, invoice.payment_failed) in
 * paystackWebhookHandler.ts drives all state transitions.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";

import { db } from "../db";
import { kycOrganisations, kycOrgMembers, cieSubscriptions } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import type { CieSubscription } from "@shared/schema";
import { invalidateCieApiKeyTierCache } from "../middleware/apiKeyAuth";

interface AuthBillingRequest extends Request {
  user?: { id?: string; claims?: { sub?: string } };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : "Internal server error";
}

interface PaystackPlan {
  plan_code: string;
  name: string;
  amount: number;
}

interface PaystackSubscriptionResponse {
  subscription_code: string;
  customer?: { customer_code?: string };
}

const PAYSTACK_BASE = "https://api.paystack.co";

type CieTier = "free" | "subscriber" | "pro";

const TIER_LABELS: Record<CieTier, string> = {
  free: "Free",
  subscriber: "CIE Subscriber",
  pro: "CIE Pro",
};

const TIER_AMOUNTS_KOBO: Record<"subscriber" | "pro", number> = {
  subscriber: 500_000,   // ₦5,000/month
  pro: 1_000_000,        // ₦10,000/month
};

function paystackKey(): string {
  const k = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_TEST_SECRET_KEY;
  if (!k) throw new Error("PAYSTACK_SECRET_KEY not configured");
  return k;
}

async function paystackReq<T>(
  path: string,
  method: "GET" | "POST" | "PUT" = "GET",
  body?: Record<string, unknown>,
): Promise<T> {
  const r = await fetch(`${PAYSTACK_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${paystackKey()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok || !d.status) throw new Error(d.message || `Paystack error ${r.status}`);
  return d.data;
}

function planCode(tier: "subscriber" | "pro"): string | null {
  return tier === "subscriber"
    ? (process.env.PAYSTACK_CIE_SUBSCRIBER_PLAN_CODE ?? null)
    : (process.env.PAYSTACK_CIE_PRO_PLAN_CODE ?? null);
}

/**
 * CIE Tier Plan Definitions
 *
 * Tier       | Paystack Plan | Amount         | Default for
 * -----------|---------------|----------------|-------------
 * free        | none          | ₦0             | all users with no subscription
 * subscriber  | PLN_xxx       | ₦5,000/month   | paid subscriber access
 * pro         | PLN_xxx       | ₦10,000/month  | full access
 */
export const CIE_PLAN_CONFIG = [
  { tier: "free" as const, paystackPlanCode: null, amountKobo: 0, name: "CIE Free" },
  {
    tier: "subscriber" as const,
    paystackPlanCode: process.env.PAYSTACK_CIE_SUBSCRIBER_PLAN_CODE ?? null,
    amountKobo: TIER_AMOUNTS_KOBO.subscriber,
    name: "CIE Subscriber — Monthly",
  },
  {
    tier: "pro" as const,
    paystackPlanCode: process.env.PAYSTACK_CIE_PRO_PLAN_CODE ?? null,
    amountKobo: TIER_AMOUNTS_KOBO.pro,
    name: "CIE Pro — Monthly",
  },
] as const;

export async function seedCiePlans(): Promise<void> {
  if (!process.env.PAYSTACK_SECRET_KEY && !process.env.PAYSTACK_TEST_SECRET_KEY) {
    console.log("[CIE Billing] Paystack not configured — skipping plan seeding");
    return;
  }
  console.log("[CIE Billing] Free tier: default access, no Paystack plan");

  const paidPlans = [
    { envKey: "PAYSTACK_CIE_SUBSCRIBER_PLAN_CODE", name: "CIE Subscriber — Monthly", amount: TIER_AMOUNTS_KOBO.subscriber },
    { envKey: "PAYSTACK_CIE_PRO_PLAN_CODE",        name: "CIE Pro — Monthly",        amount: TIER_AMOUNTS_KOBO.pro },
  ];

  for (const p of paidPlans) {
    const configured = process.env[p.envKey];
    try {
      const list = await paystackReq<PaystackPlan[]>("/plan?perPage=100");
      const plans: PaystackPlan[] = Array.isArray(list) ? list : [];
      const found = plans.find((x: PaystackPlan) => x.name === p.name);
      if (found) {
        if (found.amount !== p.amount) {
          await paystackReq(`/plan/${found.plan_code}`, "PUT", { amount: p.amount, interval: "monthly" });
          console.log(`[CIE Billing] Updated plan "${p.name}" → ${p.amount} kobo`);
        }
        if (!configured) console.log(`[CIE Billing] ⚠️  Set ${p.envKey}=${found.plan_code}`);
        else console.log(`[CIE Billing] ${p.envKey} OK (${configured})`);
      } else {
        const c = await paystackReq<{ plan_code: string }>("/plan", "POST", {
          name: p.name, amount: p.amount, interval: "monthly",
        });
        console.log(`[CIE Billing] Created plan "${p.name}": ${c.plan_code}`);
        console.log(`[CIE Billing] ⚠️  Set ${p.envKey}=${c.plan_code}`);
      }
    } catch (err: unknown) {
      console.warn(`[CIE Billing] Failed to seed "${p.name}": ${errMsg(err)}`);
    }
  }
}

// ─── Org resolution ────────────────────────────────────────────────────────────

async function resolveOrgForUser(userId: string): Promise<number | null> {
  try {
    const [creator] = await db.select({ id: kycOrganisations.id })
      .from(kycOrganisations).where(eq(kycOrganisations.createdByUserId, userId)).limit(1);
    if (creator) return creator.id;

    const [member] = await db.select({ orgId: kycOrgMembers.orgId })
      .from(kycOrgMembers)
      .where(and(eq(kycOrgMembers.userId, userId), eq(kycOrgMembers.inviteStatus, "accepted")))
      .limit(1);
    return member?.orgId ?? null;
  } catch { return null; }
}

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

// ─── Plan-switch helpers ───────────────────────────────────────────────────────

/**
 * Create a new Paystack subscription directly using a stored authorization code.
 * This avoids a new checkout page and prevents double-billing.
 * start_date defaults to the current period end of the old subscription if available.
 */
async function createPaystackSubscriptionDirect(params: {
  customerCode: string;
  authorizationCode: string;
  planCode: string;
  startDate?: Date;
}): Promise<{ subscriptionCode: string; customerCode: string } | null> {
  try {
    const body: Record<string, unknown> = {
      customer: params.customerCode,
      plan: params.planCode,
      authorization: params.authorizationCode,
    };
    if (params.startDate) body.start_date = params.startDate.toISOString();
    const result = await paystackReq<PaystackSubscriptionResponse>("/subscription", "POST", body);
    return {
      subscriptionCode: result.subscription_code,
      customerCode: result.customer?.customer_code || params.customerCode,
    };
  } catch (err: unknown) {
    console.warn("[CIE Billing] Direct subscription creation failed:", errMsg(err));
    return null;
  }
}

/**
 * Attempt to disable a Paystack subscription.
 * Paystack requires an email token for customer-initiated cancellations,
 * but platform-initiated disable (with secret key) works with subscription code only
 * on some plan types. Returns true if successful.
 */
async function disablePaystackSubscription(subscriptionCode: string): Promise<boolean> {
  try {
    await paystackReq("/subscription/disable", "POST", { code: subscriptionCode });
    return true;
  } catch {
    return false;
  }
}

async function getPaystackManagementLink(subscriptionCode: string): Promise<string | null> {
  try {
    const r = await paystackReq<{ link: string }>(`/subscription/${subscriptionCode}/manage/link`);
    return r.link;
  } catch { return null; }
}

// ─── Checkout helper ───────────────────────────────────────────────────────────

type CheckoutResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: number; error: string; code?: string };

async function buildCheckout(params: {
  req: AuthBillingRequest;
  userId: string;
  userEmail: string;
  orgId: number | null;
  tier: "subscriber" | "pro";
  previousSubscriptionId?: number;
  actionLabel: string;
}): Promise<CheckoutResult> {
  const { req, userId, userEmail, orgId, tier, previousSubscriptionId, actionLabel } = params;
  const code = planCode(tier);
  if (!code) return { ok: false, status: 503, error: `CIE ${tier} plan not configured`, code: "PLAN_NOT_CONFIGURED" };

  const reference = `cie_sub_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
  const base = req.headers.origin ||
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://cellionone.com");

  const tx = await paystackReq<{ authorization_url: string; reference: string }>(
    "/transaction/initialize", "POST", {
      email: userEmail,
      amount: TIER_AMOUNTS_KOBO[tier],
      reference, plan: code, currency: "NGN",
      callback_url: `${base}/cie/subscribe/success?reference=${reference}`,
      metadata: {
        type: "cie_subscription", userId, tier, orgId: orgId ?? null,
        ...(previousSubscriptionId ? { previousSubscriptionId } : {}),
        custom_fields: [
          { display_name: "CIE Tier", variable_name: "cie_tier", value: tier },
          { display_name: "User ID",  variable_name: "user_id",  value: userId },
        ],
      },
    },
  );

  const pending = await storage.createCieSubscription({
    userId, orgId: orgId ?? undefined, tier, status: "pending",
    paystackEmail: userEmail, paystackPlanCode: code, paystackReference: reference,
  });

  await storage.createAuditLog({
    actorUserId: userId, action: actionLabel,
    entityType: "cie_subscription", entityId: String(pending.id),
    details: { tier, reference, planCode: code, orgId, previousSubscriptionId },
  });

  return { ok: true, data: { authorizationUrl: tx.authorization_url, reference, subscriptionId: pending.id, tier, amountNaira: TIER_AMOUNTS_KOBO[tier] / 100, currency: "NGN" } };
}

// ─── Routes ────────────────────────────────────────────────────────────────────

export function registerCieBillingRoutes(app: Express): void {

  // GET /api/cie-billing/status
  app.get("/api/cie-billing/status", isAuthenticated, async (req: AuthBillingRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const { orgId, activeSub } = await resolveUserCieBilling(userId);
      return res.json({
        id: activeSub?.id,
        tier: activeSub?.tier ?? "free",
        status: activeSub?.status ?? "none",
        orgId: orgId ?? undefined,
        currentPeriodStart: activeSub?.currentPeriodStart,
        currentPeriodEnd: activeSub?.currentPeriodEnd,
        renewalDate: activeSub?.currentPeriodEnd ?? null,
        nextAmount: activeSub ? TIER_AMOUNTS_KOBO[activeSub.tier as "subscriber" | "pro"] / 100 : 0,
        cancelAtPeriodEnd: activeSub?.cancelAtPeriodEnd ?? false,
        paystackSubscriptionCode: activeSub?.paystackSubscriptionCode,
        plans: {
          free:       { amountNaira: 0,                                    interval: "none" },
          subscriber: { amountNaira: TIER_AMOUNTS_KOBO.subscriber / 100,   interval: "monthly" },
          pro:        { amountNaira: TIER_AMOUNTS_KOBO.pro / 100,          interval: "monthly" },
        },
        currency: "NGN",
      });
    } catch (err: unknown) {
      console.error("[CIE Billing] Status error:", err);
      res.status(500).json({ error: "Failed to retrieve subscription status" });
    }
  });

  // POST /api/cie-billing/subscribe
  app.post("/api/cie-billing/subscribe", isAuthenticated, async (req: AuthBillingRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const { tier } = z.object({ tier: z.enum(["subscriber", "pro"]) }).parse(req.body);

      const flag = await storage.getFeatureFlag("enable_cie_service");
      if (!flag?.isEnabled) return res.status(503).json({ error: "CIE service is not currently available" });

      const user = await storage.getUser(userId);
      if (!user?.email) return res.status(400).json({ error: "User email is required" });

      const { orgId, activeSub } = await resolveUserCieBilling(userId);
      if (activeSub?.tier === tier) return res.status(409).json({ error: `Already on active CIE ${TIER_LABELS[tier]}`, subscriptionId: activeSub.id });
      if (activeSub?.tier === "pro" && tier === "subscriber") {
        return res.status(409).json({ error: "Already on CIE Pro. Use /downgrade to switch.", subscriptionId: activeSub.id });
      }

      // Prevent duplicate pending record for same tier
      const latestPending = orgId
        ? (await db.select().from(cieSubscriptions).where(and(eq(cieSubscriptions.orgId, orgId), eq(cieSubscriptions.status, "pending"))).orderBy(desc(cieSubscriptions.createdAt)).limit(1))[0]
        : await storage.getLatestCieSubscriptionByUserId(userId);
      if (latestPending?.status === "pending" && latestPending.tier === tier) {
        return res.status(409).json({ error: `Pending CIE ${tier} subscription exists. Complete checkout or wait for it to expire.`, subscriptionId: latestPending.id });
      }

      const result = await buildCheckout({ req, userId, userEmail: user.email, orgId, tier, actionLabel: "cie_subscription_initiated" });
      return result.ok ? res.json(result.data) : res.status(result.status).json({ error: result.error, code: result.code });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: err.errors });
      console.error("[CIE Billing] Subscribe error:", err);
      res.status(500).json({ error: errMsg(err) || "Failed to initiate subscription" });
    }
  });

  // POST /api/cie-billing/cancel
  // Disables the Paystack subscription from the platform and marks our record as pending cancel.
  // Falls back to a management link if Paystack disable requires user interaction.
  app.post("/api/cie-billing/cancel", isAuthenticated, async (req: AuthBillingRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const { orgId, activeSub: sub } = await resolveUserCieBilling(userId);
      if (!sub) return res.status(404).json({ error: "No active CIE subscription" });

      // Attempt platform-initiated Paystack disable
      let paystackCancelled = false;
      if (sub.paystackSubscriptionCode) {
        paystackCancelled = await disablePaystackSubscription(sub.paystackSubscriptionCode);
      }

      await storage.updateCieSubscription(sub.id, {
        cancelAtPeriodEnd: true,
        ...(paystackCancelled ? { cancelledAt: new Date() } : {}),
      });

      const managementLink = sub.paystackSubscriptionCode && !paystackCancelled
        ? await getPaystackManagementLink(sub.paystackSubscriptionCode)
        : null;

      await storage.createAuditLog({
        actorUserId: userId, action: "cie_subscription_cancel_requested",
        entityType: "cie_subscription", entityId: String(sub.id),
        details: { tier: sub.tier, orgId, paystackCancelled, cancelAtPeriodEnd: true },
      });

      await storage.createNotification({
        userId, title: "CIE Subscription Cancellation Requested",
        message: `Your ${TIER_LABELS[sub.tier as CieTier]} subscription will cancel at period end.`,
        type: "info", linkUrl: "/cie/subscribe",
      });

      return res.json({
        message: paystackCancelled ? "Subscription cancelled on Paystack" : "Subscription set to cancel at period end",
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: true,
        paystackCancelled,
        managementLink,
      });
    } catch (err: unknown) {
      console.error("[CIE Billing] Cancel error:", err);
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });

  // POST /api/cie-billing/upgrade  (Subscriber → Pro)
  // Uses stored Paystack authorization code for a direct plan switch where available.
  // Falls back to checkout page if authorization code not yet stored.
  app.post("/api/cie-billing/upgrade", isAuthenticated, async (req: AuthBillingRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const { orgId, activeSub } = await resolveUserCieBilling(userId);
      if (!activeSub) return res.status(404).json({ error: "No active CIE subscription to upgrade" });
      if (activeSub.tier === "pro") return res.status(409).json({ error: "Already on CIE Pro" });

      const user = await storage.getUser(userId);
      if (!user?.email) return res.status(400).json({ error: "User email required" });

      const proPlanCode = planCode("pro");
      if (!proPlanCode) return res.status(503).json({ error: "CIE Pro plan not configured", code: "PLAN_NOT_CONFIGURED" });

      // Direct plan switch using stored authorization code (no new checkout; avoids double-billing)
      if (activeSub.paystackAuthorizationCode && activeSub.paystackCustomerCode) {
        const newPs = await createPaystackSubscriptionDirect({
          customerCode: activeSub.paystackCustomerCode,
          authorizationCode: activeSub.paystackAuthorizationCode,
          planCode: proPlanCode,
          startDate: activeSub.currentPeriodEnd ?? undefined,
        });

        if (newPs) {
          // Disable old subscription, create new active DB record, expire old
          if (activeSub.paystackSubscriptionCode) {
            await disablePaystackSubscription(activeSub.paystackSubscriptionCode);
          }
          const periodStart = activeSub.currentPeriodEnd ?? new Date();
          const periodEnd = new Date(periodStart); periodEnd.setDate(periodEnd.getDate() + 30);

          const newSub = await storage.createCieSubscription({
            userId, orgId: orgId ?? undefined, tier: "pro", status: "active",
            paystackSubscriptionCode: newPs.subscriptionCode,
            paystackCustomerCode: newPs.customerCode,
            paystackAuthorizationCode: activeSub.paystackAuthorizationCode,
            paystackEmail: user.email, paystackPlanCode: proPlanCode,
            currentPeriodStart: periodStart, currentPeriodEnd: periodEnd,
          });
          await storage.updateCieSubscription(activeSub.id, { status: "expired", cancelledAt: new Date() });
          invalidateCieApiKeyTierCache(orgId ?? null, userId);

          await storage.createAuditLog({ actorUserId: userId, action: "cie_subscription_upgraded_direct", entityType: "cie_subscription", entityId: String(newSub.id), details: { from: "subscriber", to: "pro", previousId: activeSub.id } });
          await storage.createNotification({ userId, title: "Upgraded to CIE Pro", message: `Your CIE Pro subscription starts ${periodStart.toLocaleDateString("en-NG")}.`, type: "success", linkUrl: "/cie/subscribe" });
          return res.json({ subscriptionId: newSub.id, tier: "pro", amountNaira: TIER_AMOUNTS_KOBO.pro / 100, directSwitch: true, currency: "NGN" });
        }
      }

      // Fallback: checkout page if no authorization code stored yet
      const result = await buildCheckout({ req, userId, userEmail: user.email, orgId, tier: "pro", previousSubscriptionId: activeSub.id, actionLabel: "cie_subscription_upgrade_initiated" });
      return result.ok ? res.json(result.data) : res.status(result.status).json({ error: result.error, code: result.code });
    } catch (err: unknown) {
      console.error("[CIE Billing] Upgrade error:", err);
      res.status(500).json({ error: errMsg(err) || "Failed to initiate upgrade" });
    }
  });

  // POST /api/cie-billing/downgrade  (Pro → Subscriber)
  // Direct plan switch where authorization code is available. Checkout fallback otherwise.
  app.post("/api/cie-billing/downgrade", isAuthenticated, async (req: AuthBillingRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const { orgId, activeSub } = await resolveUserCieBilling(userId);
      if (!activeSub) return res.status(404).json({ error: "No active CIE subscription to downgrade" });
      if (activeSub.tier !== "pro") return res.status(409).json({ error: `Current tier is "${activeSub.tier}". Downgrade only applies to Pro.` });

      const user = await storage.getUser(userId);
      if (!user?.email) return res.status(400).json({ error: "User email required" });

      const subPlanCode = planCode("subscriber");
      if (!subPlanCode) return res.status(503).json({ error: "CIE Subscriber plan not configured", code: "PLAN_NOT_CONFIGURED" });

      if (activeSub.paystackAuthorizationCode && activeSub.paystackCustomerCode) {
        const newPs = await createPaystackSubscriptionDirect({
          customerCode: activeSub.paystackCustomerCode,
          authorizationCode: activeSub.paystackAuthorizationCode,
          planCode: subPlanCode,
          startDate: activeSub.currentPeriodEnd ?? undefined,
        });

        if (newPs) {
          if (activeSub.paystackSubscriptionCode) {
            await disablePaystackSubscription(activeSub.paystackSubscriptionCode);
          }
          const periodStart = activeSub.currentPeriodEnd ?? new Date();
          const periodEnd = new Date(periodStart); periodEnd.setDate(periodEnd.getDate() + 30);

          const newSub = await storage.createCieSubscription({
            userId, orgId: orgId ?? undefined, tier: "subscriber", status: "active",
            paystackSubscriptionCode: newPs.subscriptionCode,
            paystackCustomerCode: newPs.customerCode,
            paystackAuthorizationCode: activeSub.paystackAuthorizationCode,
            paystackEmail: user.email, paystackPlanCode: subPlanCode,
            currentPeriodStart: periodStart, currentPeriodEnd: periodEnd,
          });
          await storage.updateCieSubscription(activeSub.id, { status: "expired", cancelledAt: new Date() });
          invalidateCieApiKeyTierCache(orgId ?? null, userId);

          await storage.createAuditLog({ actorUserId: userId, action: "cie_subscription_downgraded_direct", entityType: "cie_subscription", entityId: String(newSub.id), details: { from: "pro", to: "subscriber", previousId: activeSub.id } });
          await storage.createNotification({ userId, title: "Downgraded to CIE Subscriber", message: `Your CIE Subscriber plan starts ${periodStart.toLocaleDateString("en-NG")}.`, type: "info", linkUrl: "/cie/subscribe" });
          return res.json({ subscriptionId: newSub.id, tier: "subscriber", amountNaira: TIER_AMOUNTS_KOBO.subscriber / 100, directSwitch: true, currency: "NGN" });
        }
      }

      // Fallback: checkout page + management link for old plan
      await storage.updateCieSubscription(activeSub.id, { cancelAtPeriodEnd: true });
      const managementLink = activeSub.paystackSubscriptionCode
        ? await getPaystackManagementLink(activeSub.paystackSubscriptionCode)
        : null;

      const result = await buildCheckout({ req, userId, userEmail: user.email, orgId, tier: "subscriber", previousSubscriptionId: activeSub.id, actionLabel: "cie_subscription_downgrade_initiated" });
      if (!result.ok) return res.status(result.status).json({ error: result.error, code: result.code });
      return res.json({ ...result.data, managementLink });
    } catch (err: unknown) {
      console.error("[CIE Billing] Downgrade error:", err);
      res.status(500).json({ error: errMsg(err) || "Failed to initiate downgrade" });
    }
  });

  console.log("[CIE Billing] Routes registered (/api/cie-billing/*)");
}
