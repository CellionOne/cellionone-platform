import { db } from "../db";
import { eq, and, desc, sql, gte, lte, count } from "drizzle-orm";
import {
  kycBillingAccounts, kycBillingRequests, kycCreditTransactions,
  kycInvoices, kycOrganisations,
  type KycBillingAccount, type KycBillingRequest, type KycCreditTransaction, type KycInvoice,
} from "@shared/schema";
import crypto from "crypto";

const INDIVIDUAL_CREDIT_PRICE_KOBO = 1000000;
const SUPPLIER_CREDIT_PRICE_KOBO = 10000000;

function getCreditPriceKobo(verificationType: string): number {
  return verificationType === "supplier" ? SUPPLIER_CREDIT_PRICE_KOBO : INDIVIDUAL_CREDIT_PRICE_KOBO;
}

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
    description: `${verificationType === "supplier" ? "Supplier" : "Individual"} verification - Request #${requestId}`,
    verificationRequestId: requestId,
  }).returning();

  return transaction;
}

export async function hasCredits(orgId: number, verificationType: string): Promise<boolean> {
  const account = await getBillingAccount(orgId);
  if (!account || !account.isActive) return false;

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

export async function refundCredit(
  orgId: number,
  requestId: number
): Promise<KycCreditTransaction> {
  const account = await getBillingAccount(orgId);
  if (!account) throw new Error("No billing account found");

  const newBalance = account.creditBalance + 1;

  await db.update(kycBillingAccounts)
    .set({ creditBalance: newBalance, updatedAt: new Date() })
    .where(eq(kycBillingAccounts.id, account.id));

  const [transaction] = await db.insert(kycCreditTransactions).values({
    billingAccountId: account.id,
    type: "refund",
    amount: 1,
    balance: newBalance,
    description: `Refund for failed verification - Request #${requestId}`,
    verificationRequestId: requestId,
  }).returning();

  return transaction;
}

export async function requestInvoicedBilling(
  orgId: number,
  userId: string,
  companyName: string,
  email: string,
  volume: string,
  message: string
): Promise<KycBillingRequest> {
  const [existing] = await db.select().from(kycBillingRequests)
    .where(and(
      eq(kycBillingRequests.organisationId, orgId),
      eq(kycBillingRequests.status, "pending")
    ));

  if (existing) {
    throw new Error("A pending billing request already exists for this organisation");
  }

  const [request] = await db.insert(kycBillingRequests).values({
    organisationId: orgId,
    requestedBy: userId,
    companyName,
    companyEmail: email,
    estimatedMonthlyVolume: volume,
    message,
    status: "pending",
  }).returning();

  return request;
}

export async function approveInvoicedBilling(
  requestId: number,
  adminUserId: string,
  creditLimit: number
): Promise<KycBillingRequest> {
  const [billingRequest] = await db.select().from(kycBillingRequests)
    .where(eq(kycBillingRequests.id, requestId));

  if (!billingRequest) throw new Error("Billing request not found");
  if (billingRequest.status !== "pending") throw new Error("Request is not pending");

  const [updated] = await db.update(kycBillingRequests)
    .set({
      status: "approved",
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
    })
    .where(eq(kycBillingRequests.id, requestId))
    .returning();

  let account = await getBillingAccount(billingRequest.organisationId);
  if (!account) {
    account = await createBillingAccount(billingRequest.organisationId);
  }

  await db.update(kycBillingAccounts)
    .set({
      billingMode: "invoiced",
      creditLimit,
      invoiceEmail: billingRequest.companyEmail,
      invoiceCompanyName: billingRequest.companyName,
      isActive: true,
      approvedAt: new Date(),
      approvedBy: adminUserId,
      updatedAt: new Date(),
    })
    .where(eq(kycBillingAccounts.id, account.id));

  return updated;
}

export async function rejectInvoicedBilling(
  requestId: number,
  adminUserId: string,
  notes: string
): Promise<KycBillingRequest> {
  const [billingRequest] = await db.select().from(kycBillingRequests)
    .where(eq(kycBillingRequests.id, requestId));

  if (!billingRequest) throw new Error("Billing request not found");
  if (billingRequest.status !== "pending") throw new Error("Request is not pending");

  const [updated] = await db.update(kycBillingRequests)
    .set({
      status: "rejected",
      adminNotes: notes,
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
    })
    .where(eq(kycBillingRequests.id, requestId))
    .returning();

  return updated;
}

export async function generateInvoice(
  orgId: number,
  periodStart: Date,
  periodEnd: Date
): Promise<KycInvoice> {
  const account = await getBillingAccount(orgId);
  if (!account) throw new Error("No billing account found");
  if (account.billingMode !== "invoiced") throw new Error("Organisation is not on invoiced billing");

  const transactions = await db.select().from(kycCreditTransactions)
    .where(and(
      eq(kycCreditTransactions.billingAccountId, account.id),
      eq(kycCreditTransactions.type, "usage"),
      gte(kycCreditTransactions.createdAt, periodStart),
      lte(kycCreditTransactions.createdAt, periodEnd)
    ));

  const individualCount = transactions.filter(t => t.verificationType === "individual").length;
  const supplierCount = transactions.filter(t => t.verificationType === "supplier").length;

  const lineItems: { description: string; quantity: number; unitPrice: number; total: number }[] = [];

  if (individualCount > 0) {
    lineItems.push({
      description: "Individual KYC Verification",
      quantity: individualCount,
      unitPrice: INDIVIDUAL_CREDIT_PRICE_KOBO,
      total: individualCount * INDIVIDUAL_CREDIT_PRICE_KOBO,
    });
  }
  if (supplierCount > 0) {
    lineItems.push({
      description: "Supplier/Corporate KYC Verification",
      quantity: supplierCount,
      unitPrice: SUPPLIER_CREDIT_PRICE_KOBO,
      total: supplierCount * SUPPLIER_CREDIT_PRICE_KOBO,
    });
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal;

  const year = periodEnd.getFullYear();
  const [countResult] = await db.select({ cnt: count() })
    .from(kycInvoices)
    .where(sql`EXTRACT(YEAR FROM ${kycInvoices.createdAt}) = ${year}`);

  const seq = (countResult?.cnt || 0) + 1;
  const invoiceNumber = `INV-${year}-${String(seq).padStart(4, "0")}`;

  const dueDate = new Date(periodEnd);
  dueDate.setDate(dueDate.getDate() + (account.paymentTermsDays || 30));

  const [invoice] = await db.insert(kycInvoices).values({
    billingAccountId: account.id,
    invoiceNumber,
    periodStart,
    periodEnd,
    lineItems,
    subtotal,
    total,
    currency: "NGN",
    status: "draft",
    dueDate,
  }).returning();

  return invoice;
}

export async function markInvoicePaid(
  invoiceId: number,
  paystackRef?: string
): Promise<KycInvoice> {
  const [updated] = await db.update(kycInvoices)
    .set({
      status: "paid",
      paidAt: new Date(),
      paystackReference: paystackRef || null,
    })
    .where(eq(kycInvoices.id, invoiceId))
    .returning();

  if (!updated) throw new Error("Invoice not found");
  return updated;
}

export async function getInvoices(orgId: number): Promise<KycInvoice[]> {
  const account = await getBillingAccount(orgId);
  if (!account) return [];

  return db.select().from(kycInvoices)
    .where(eq(kycInvoices.billingAccountId, account.id))
    .orderBy(desc(kycInvoices.createdAt));
}

export async function getTransactions(orgId: number, limit = 50): Promise<KycCreditTransaction[]> {
  const account = await getBillingAccount(orgId);
  if (!account) return [];

  return db.select().from(kycCreditTransactions)
    .where(eq(kycCreditTransactions.billingAccountId, account.id))
    .orderBy(desc(kycCreditTransactions.createdAt))
    .limit(limit);
}

export async function getPendingBillingRequests(): Promise<(KycBillingRequest & { orgName: string | null })[]> {
  const requests = await db.select({
    id: kycBillingRequests.id,
    organisationId: kycBillingRequests.organisationId,
    requestedBy: kycBillingRequests.requestedBy,
    companyName: kycBillingRequests.companyName,
    companyEmail: kycBillingRequests.companyEmail,
    estimatedMonthlyVolume: kycBillingRequests.estimatedMonthlyVolume,
    message: kycBillingRequests.message,
    status: kycBillingRequests.status,
    adminNotes: kycBillingRequests.adminNotes,
    reviewedBy: kycBillingRequests.reviewedBy,
    reviewedAt: kycBillingRequests.reviewedAt,
    createdAt: kycBillingRequests.createdAt,
    orgName: kycOrganisations.name,
  })
    .from(kycBillingRequests)
    .leftJoin(kycOrganisations, eq(kycBillingRequests.organisationId, kycOrganisations.id))
    .orderBy(desc(kycBillingRequests.createdAt));

  return requests;
}

export async function adjustCredits(
  orgId: number,
  amount: number,
  reason: string,
  adminUserId: string
): Promise<KycCreditTransaction> {
  const account = await getBillingAccount(orgId);
  if (!account) throw new Error("No billing account found");

  const newBalance = account.creditBalance + amount;

  await db.update(kycBillingAccounts)
    .set({ creditBalance: newBalance, updatedAt: new Date() })
    .where(eq(kycBillingAccounts.id, account.id));

  const [transaction] = await db.insert(kycCreditTransactions).values({
    billingAccountId: account.id,
    type: "adjustment",
    amount,
    balance: newBalance,
    description: `Admin adjustment: ${reason} (by ${adminUserId})`,
  }).returning();

  return transaction;
}

export async function getAllBillingAccounts(): Promise<(KycBillingAccount & { orgName: string | null })[]> {
  const accounts = await db.select({
    id: kycBillingAccounts.id,
    organisationId: kycBillingAccounts.organisationId,
    billingMode: kycBillingAccounts.billingMode,
    creditBalance: kycBillingAccounts.creditBalance,
    invoiceEmail: kycBillingAccounts.invoiceEmail,
    invoiceCompanyName: kycBillingAccounts.invoiceCompanyName,
    invoiceAddress: kycBillingAccounts.invoiceAddress,
    paymentTermsDays: kycBillingAccounts.paymentTermsDays,
    creditLimit: kycBillingAccounts.creditLimit,
    isActive: kycBillingAccounts.isActive,
    approvedAt: kycBillingAccounts.approvedAt,
    approvedBy: kycBillingAccounts.approvedBy,
    createdAt: kycBillingAccounts.createdAt,
    updatedAt: kycBillingAccounts.updatedAt,
    orgName: kycOrganisations.name,
  })
    .from(kycBillingAccounts)
    .leftJoin(kycOrganisations, eq(kycBillingAccounts.organisationId, kycOrganisations.id))
    .orderBy(desc(kycBillingAccounts.createdAt));

  return accounts;
}
