import { db } from "../db";
import { eq, and, desc, sql, gte, lte, count } from "drizzle-orm";
import {
  kycBillingAccounts, kycBillingRequests, kycCreditTransactions,
  kycInvoices, kycOrganisations,
  type KycBillingAccount, type KycBillingRequest, type KycCreditTransaction, type KycInvoice,
  type KycBillingMode,
} from "@shared/schema";
import crypto from "crypto";

// ─── Pricing Tiers ────────────────────────────────────────────────────────────
// identity_only = BVN/NIN lookup + AML only (no selfie/document)
// individual    = full individual KYC (identity + document + biometric selfie + AML)
// supplier      = corporate entity + key persons KYC

export const PRICING_TIERS = [
  {
    id: "identity_only" as const,
    label: "Identity Check",
    description: "BVN/NIN lookup, AML & sanctions screening. Instant result.",
    priceKobo: 500_000,        // ₦5,000
    priceNaira: 5_000,
    checks: ["BVN/NIN lookup", "AML & sanctions screening"],
    timing: "Instant",
    resultTiming: "instant" as const,
    color: "text-violet-600 dark:text-violet-400",
  },
  {
    id: "individual" as const,
    label: "Full Individual KYC",
    description: "Identity + government-issued ID + liveness selfie + AML. Result via webhook.",
    priceKobo: 1_500_000,      // ₦15,000
    priceNaira: 15_000,
    checks: ["BVN/NIN lookup", "ID document verification", "Liveness selfie & biometric match", "AML & sanctions screening"],
    timing: "~2–5 min (webhook)",
    resultTiming: "webhook" as const,
    color: "text-amber-600 dark:text-amber-400",
  },
  {
    id: "supplier" as const,
    label: "Supplier / Corporate KYC",
    description: "Entity verification + key persons KYC + sanctions screening.",
    priceKobo: 7_500_000,      // ₦75,000
    priceNaira: 75_000,
    checks: ["Corporate entity verification", "Director & shareholder KYC", "AML & sanctions screening"],
    timing: "~1 business day",
    resultTiming: "webhook" as const,
    color: "text-blue-600 dark:text-blue-400",
  },
] as const;

export type VerificationType = "identity_only" | "individual" | "supplier";

function getCreditPriceKobo(verificationType: string): number {
  const tier = PRICING_TIERS.find(t => t.id === verificationType);
  return tier?.priceKobo ?? PRICING_TIERS[1].priceKobo;
}

export function getPricingTier(verificationType: string) {
  return PRICING_TIERS.find(t => t.id === verificationType) ?? PRICING_TIERS[1];
}

// ─── Account Management ───────────────────────────────────────────────────────

export async function createBillingAccount(orgId: number): Promise<KycBillingAccount> {
  const [existing] = await db.select().from(kycBillingAccounts)
    .where(eq(kycBillingAccounts.organisationId, orgId));
  if (existing) return existing;

  const [account] = await db.insert(kycBillingAccounts).values({
    organisationId: orgId,
    billingMode: "prepaid",
    creditBalance: 0,
    isActive: true,
  }).returning();

  return account;
}

export async function getBillingAccount(orgId: number): Promise<KycBillingAccount | null> {
  const [account] = await db.select().from(kycBillingAccounts)
    .where(eq(kycBillingAccounts.organisationId, orgId));
  return account || null;
}

export async function purchaseCredits(
  orgId: number,
  quantity: number,
  verificationType: string,
  userEmail: string
): Promise<{ reference: string; authorizationUrl: string }> {
  if (quantity < 10) {
    throw new Error("Minimum purchase is 10 credits");
  }

  const account = await getBillingAccount(orgId);
  if (!account) throw new Error("No billing account found. Create one first.");
  if (!account.isActive) throw new Error("Billing account is not active");

  const unitPriceKobo = getCreditPriceKobo(verificationType);
  const totalAmountKobo = unitPriceKobo * quantity;
  const tier = getPricingTier(verificationType);

  const reference = `kyc_credit_${orgId}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  const paystackSecret = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_TEST_SECRET_KEY;
  if (!paystackSecret) throw new Error("Payment not configured");

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: userEmail,
      amount: totalAmountKobo,
      reference,
      metadata: {
        type: "kyc_credit_purchase",
        organisationId: orgId,
        billingAccountId: account.id,
        quantity,
        verificationType,
        unitPriceKobo,
        tierLabel: tier.label,
      },
    }),
  });

  const result = await response.json() as any;
  if (!result.status) {
    throw new Error(result.message || "Failed to initialize payment");
  }

  return {
    reference,
    authorizationUrl: result.data.authorization_url,
  };
}

export async function addCredits(
  orgId: number,
  quantity: number,
  verificationType: string,
  description: string,
  paystackReference?: string
): Promise<KycCreditTransaction> {
  const account = await getBillingAccount(orgId);
  if (!account) throw new Error("No billing account found");

  const newBalance = account.creditBalance + quantity;

  await db.update(kycBillingAccounts)
    .set({ creditBalance: newBalance, updatedAt: new Date() })
    .where(eq(kycBillingAccounts.id, account.id));

  const [transaction] = await db.insert(kycCreditTransactions).values({
    billingAccountId: account.id,
    type: "purchase",
    verificationType,
    amount: quantity,
    balance: newBalance,
    description,
    paystackReference: paystackReference || null,
  }).returning();

  return transaction;
}

export async function deductCredit(
  orgId: number,
  verificationType: string,
  requestId: number
): Promise<KycCreditTransaction> {
  const account = await getBillingAccount(orgId);
  if (!account) throw new Error("No billing account found");

  const tier = getPricingTier(verificationType);

  // Exempt orgs: log usage at ₦0 but skip balance check and deduction
  if (account.billingMode === "exempt") {
    const [transaction] = await db.insert(kycCreditTransactions).values({
      billingAccountId: account.id,
      type: "usage",
      verificationType,
      amount: 0,
      balance: account.creditBalance,
      description: `Exempt usage — ${tier.label} verification — Request #${requestId}`,
      verificationRequestId: requestId,
    }).returning();
    return transaction;
  }

  if (account.billingMode === "prepaid") {
    if (account.creditBalance <= 0) {
      throw new Error("Insufficient credits");
    }
  }

  const newBalance = account.creditBalance - 1;

  await db.update(kycBillingAccounts)
    .set({ creditBalance: newBalance, updatedAt: new Date() })
    .where(eq(kycBillingAccounts.id, account.id));

  const [transaction] = await db.insert(kycCreditTransactions).values({
    billingAccountId: account.id,
    type: "usage",
    verificationType,
    amount: -1,
    balance: newBalance,
    description: `${tier.label} verification — Request #${requestId} · ₦${tier.priceNaira.toLocaleString()}/credit`,
    verificationRequestId: requestId,
  }).returning();

  return transaction;
}

export async function hasCredits(orgId: number, verificationType: string): Promise<boolean> {
  const account = await getBillingAccount(orgId);
  if (!account || !account.isActive) return false;

  // Exempt orgs always have access
  if (account.billingMode === "exempt") return true;

  if (account.billingMode === "prepaid") {
    return account.creditBalance > 0;
  }

  if (account.billingMode === "invoiced") {
    if ((account.creditLimit || 0) <= 0) return true;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [usageResult] = await db.select({
      used: sql<number>`COALESCE(SUM(ABS(${kycCreditTransactions.amount})), 0)`,
    }).from(kycCreditTransactions)
      .where(and(
        eq(kycCreditTransactions.billingAccountId, account.id),
        eq(kycCreditTransactions.type, "usage"),
        gte(kycCreditTransactions.createdAt, startOfMonth)
      ));

    return (usageResult?.used || 0) < (account.creditLimit || 0);
  }

  return false;
}

// ─── Billing Requests & Invoices ──────────────────────────────────────────────

export async function createBillingRequest(
  orgId: number,
  requestData: Omit<typeof kycBillingRequests.$inferInsert, "id" | "createdAt" | "updatedAt">
): Promise<KycBillingRequest> {
  const [request] = await db.insert(kycBillingRequests).values(requestData).returning();
  return request;
}

export async function getBillingRequests(orgId: number): Promise<KycBillingRequest[]> {
  const account = await getBillingAccount(orgId);
  if (!account) return [];

  return db.select().from(kycBillingRequests)
    .where(eq(kycBillingRequests.billingAccountId, account.id))
    .orderBy(desc(kycBillingRequests.createdAt))
    .limit(50);
}

export async function getTransactions(orgId: number, limit = 100): Promise<KycCreditTransaction[]> {
  const account = await getBillingAccount(orgId);
  if (!account) return [];

  return db.select().from(kycCreditTransactions)
    .where(eq(kycCreditTransactions.billingAccountId, account.id))
    .orderBy(desc(kycCreditTransactions.createdAt))
    .limit(limit);
}

export async function getInvoices(orgId: number): Promise<KycInvoice[]> {
  const account = await getBillingAccount(orgId);
  if (!account) return [];

  return db.select().from(kycInvoices)
    .where(eq(kycInvoices.billingAccountId, account.id))
    .orderBy(desc(kycInvoices.createdAt))
    .limit(50);
}

export async function getBillingStats(orgId: number) {
  const account = await getBillingAccount(orgId);
  if (!account) return null;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [monthlyUsage] = await db.select({
    used: sql<number>`COALESCE(SUM(ABS(${kycCreditTransactions.amount})), 0)`,
  }).from(kycCreditTransactions)
    .where(and(
      eq(kycCreditTransactions.billingAccountId, account.id),
      eq(kycCreditTransactions.type, "usage"),
      gte(kycCreditTransactions.createdAt, startOfMonth)
    ));

  const [totalUsage] = await db.select({
    used: sql<number>`COALESCE(SUM(ABS(${kycCreditTransactions.amount})), 0)`,
  }).from(kycCreditTransactions)
    .where(and(
      eq(kycCreditTransactions.billingAccountId, account.id),
      eq(kycCreditTransactions.type, "usage")
    ));

  return {
    account,
    creditBalance: account.creditBalance,
    billingMode: account.billingMode,
    monthlyCreditsUsed: monthlyUsage?.used || 0,
    totalCreditsUsed: totalUsage?.used || 0,
  };
}
