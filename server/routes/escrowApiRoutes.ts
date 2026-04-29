import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { db } from "../db";
import { eq, desc } from "drizzle-orm";
import { kycWebhookConfigs, escrowTransactions, userRoles } from "@shared/schema";
import { authenticateApiKey, type ApiKeyRequest } from "../middleware/apiKeyAuth";
import { getSiteBaseUrl } from "../services/emailService";
import { isAuthenticated } from "../replit_integrations/auth";
import crypto from "crypto";
import { createBankPortalUserAndSendInvite } from "./bankPortalRoutes";

async function isAdmin(req: Request): Promise<boolean> {
  const userId = (req as any).user?.claims?.sub;
  if (!userId) return false;
  const roles = await storage.getUserRoles(userId);
  return roles.includes("admin");
}

const PAYSTACK_API_BASE = "https://api.paystack.co";

function getPaystackKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_TEST_SECRET_KEY;
  if (!key) throw new Error("Paystack key not configured");
  return key;
}

function generateEscrowReference(): string {
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `CO-ESC-${year}-${rand}`;
}

/**
 * Cellion escrow service fee: 1.5% of principal
 * Minimum: ₦1,500 (150,000 kobo)  |  Maximum: ₦50,000 (5,000,000 kobo)
 *
 * When an activeBankPartner is present and has "escrow_custody" in their
 * serviceTypes, a portion of the service fee is carved out as bankCustodyFee
 * (based on the partner's feeRateBps).
 * The buyer-facing totalCharged does NOT change — this is internal accounting.
 *
 * Returns { serviceFee, bankCustodyFee, totalCharged } all in kobo.
 */
export function calculateEscrowFee(
  principalKobo: number,
  activeBankPartner?: { id: number; feeRateBps: number } | null
): { serviceFee: number; bankCustodyFee: number; bankPartnerId: number | null; totalCharged: number } {
  const raw = Math.round(principalKobo * 0.015);
  const serviceFee = Math.min(Math.max(raw, 150_000), 5_000_000);

  let bankCustodyFee = 0;
  let bankPartnerId: number | null = activeBankPartner?.id ?? null;

  if (activeBankPartner && activeBankPartner.feeRateBps > 0) {
    const rawBankFee = Math.floor(principalKobo * activeBankPartner.feeRateBps / 10_000);
    bankCustodyFee = Math.min(rawBankFee, serviceFee);
  }

  return { serviceFee, bankCustodyFee, bankPartnerId, totalCharged: principalKobo + serviceFee };
}

async function deliverEscrowWebhook(
  orgId: number,
  event: string,
  payload: Record<string, any>
): Promise<void> {
  try {
    const [cfg] = await db
      .select()
      .from(kycWebhookConfigs)
      .where(eq(kycWebhookConfigs.organisationId, orgId))
      .limit(1);

    if (!cfg?.isActive || !cfg.url) return;

    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
    const signature = crypto.createHmac("sha256", cfg.secret).update(body).digest("hex");

    await fetch(cfg.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Cellion-Signature": signature,
        "X-Cellion-Event": event,
      },
      body,
    }).catch((err) => {
      console.error(`[EscrowAPI] Webhook delivery failed for org ${orgId}:`, err.message);
    });
  } catch (err) {
    console.error(`[EscrowAPI] Webhook error for org ${orgId}:`, err);
  }
}

/**
 * Legacy handler: called when an old payment-link escrow charge.success fires
 * (metadata.type === 'api_escrow'). Kept for backward compatibility.
 */
export async function handleApiEscrowFunded(
  reference: string,
  paystackReference: string,
  amount: number
): Promise<void> {
  const tx = await storage.getEscrowApiTransaction(reference);
  if (!tx) {
    console.error(`[EscrowAPI] Legacy: Transaction ${reference} not found`);
    return;
  }
  if (tx.status === "funded") {
    console.log(`[EscrowAPI] Legacy: Transaction ${reference} already funded`);
    return;
  }

  await storage.updateEscrowApiTransaction(tx.id, {
    status: "funded",
    fundedAt: new Date(),
    paystackReference,
  });

  await deliverEscrowWebhook(tx.orgId, "escrow.funded", {
    reference: tx.reference,
    status: "funded",
    amount: tx.amount,
    currency: tx.currency,
    description: tx.description,
    buyerName: tx.buyerName,
    beneficiaryName: tx.beneficiaryName,
    fundedAt: new Date().toISOString(),
  });

  await storage.createAuditLog({
    actorUserId: "system",
    action: "api_escrow_funded",
    entityType: "escrow_api_transaction",
    entityId: reference,
    details: { paystackReference, amount, orgId: tx.orgId },
  });

  console.log(`[EscrowAPI] Legacy escrow ${reference} funded via ${paystackReference}`);
}

/**
 * Called by the Paystack webhook handler when a DVA charge.success fires
 * with channel "dedicated_nuban". Matches by dva_account_number.
 */
export async function handleDvaEscrowFunded(
  dvaAccountNumber: string,
  paystackReference: string,
  amount: number
): Promise<void> {
  const tx = await storage.getEscrowApiTransactionByDvaAccount(dvaAccountNumber);
  if (!tx) {
    console.error(`[EscrowAPI] No escrow found for DVA account ${dvaAccountNumber}`);
    return;
  }
  // Only allow pending_payment → funded. Ignore duplicate/late DVA credits
  // for transactions already in a terminal or advanced state.
  if (tx.status !== "pending_payment") {
    console.log(`[EscrowAPI] DVA escrow ${tx.reference} received charge.success but status is "${tx.status}" — ignoring`);
    return;
  }

  await storage.updateEscrowApiTransaction(tx.id, {
    status: "funded",
    fundedAt: new Date(),
    paystackReference,
  });

  await deliverEscrowWebhook(tx.orgId, "escrow.funded", {
    reference: tx.reference,
    status: "funded",
    amount: tx.amount,
    currency: tx.currency,
    description: tx.description,
    buyerName: tx.buyerName,
    beneficiaryName: tx.beneficiaryName,
    dvaAccountNumber: tx.dvaAccountNumber,
    dvaBankName: tx.dvaBankName,
    fundedAt: new Date().toISOString(),
  });

  await storage.createAuditLog({
    actorUserId: "system",
    action: "api_escrow_funded_via_dva",
    entityType: "escrow_api_transaction",
    entityId: tx.reference,
    details: { paystackReference, amount, dvaAccountNumber, orgId: tx.orgId },
  });

  console.log(`[EscrowAPI] DVA escrow ${tx.reference} funded via ${paystackReference}`);
}

/**
 * Called by the Paystack webhook handler on transfer.success.
 * Marks the escrow as released and fires escrow.released to the org.
 */
export async function handleEscrowTransferSuccess(transferReference: string): Promise<void> {
  const tx = await storage.getEscrowApiTransactionByTransferRef(transferReference);
  if (!tx) {
    console.log(`[EscrowAPI] No escrow matched transfer ref ${transferReference} — may be unrelated`);
    return;
  }
  if (tx.status === "released") {
    console.log(`[EscrowAPI] Escrow ${tx.reference} already released`);
    return;
  }

  const releasedAt = new Date();
  await storage.updateEscrowApiTransaction(tx.id, {
    status: "released",
    releasedAt,
    releasedTo: tx.beneficiaryAccountName || tx.beneficiaryEmail,
  });

  await deliverEscrowWebhook(tx.orgId, "escrow.released", {
    reference: tx.reference,
    status: "released",
    amount: tx.amount,
    currency: tx.currency,
    releasedTo: tx.beneficiaryAccountName || tx.beneficiaryEmail,
    releasedAt: releasedAt.toISOString(),
  });

  await storage.createAuditLog({
    actorUserId: "system",
    action: "api_escrow_transfer_confirmed",
    entityType: "escrow_api_transaction",
    entityId: tx.reference,
    details: { transferReference, orgId: tx.orgId },
  });

  console.log(`[EscrowAPI] Escrow ${tx.reference} released via transfer ${transferReference}`);
}

/**
 * Called by the Paystack webhook handler on transfer.failed.
 * Reverts the escrow back to funded and fires escrow.release_failed.
 */
export async function handleEscrowTransferFailed(transferReference: string): Promise<void> {
  const tx = await storage.getEscrowApiTransactionByTransferRef(transferReference);
  if (!tx) {
    console.log(`[EscrowAPI] No escrow matched failed transfer ref ${transferReference}`);
    return;
  }

  await storage.updateEscrowApiTransaction(tx.id, {
    status: "funded",
    paystackTransferReference: null,
  });

  await deliverEscrowWebhook(tx.orgId, "escrow.release_failed", {
    reference: tx.reference,
    status: "funded",
    amount: tx.amount,
    currency: tx.currency,
    reason: "Bank transfer failed — funds remain in escrow. Retry release.",
  });

  await storage.createAuditLog({
    actorUserId: "system",
    action: "api_escrow_transfer_failed",
    entityType: "escrow_api_transaction",
    entityId: tx.reference,
    details: { transferReference, orgId: tx.orgId },
  });

  console.log(`[EscrowAPI] Transfer failed for escrow ${tx.reference} — reverted to funded`);
}

/**
 * Evaluates whether an inbound DVA transfer amount should be auto-approved.
 * Uses a 1% tolerance to account for any bank charges deducted in transit.
 * Called by the Paystack webhook handler for Titan DVA inbound approval events.
 */
export async function evaluateDvaTransferApproval(
  dvaAccountNumber: string,
  incomingAmountKobo: number
): Promise<{ approve: boolean; reason: string }> {
  const tx = await storage.getEscrowApiTransactionByDvaAccount(dvaAccountNumber);
  if (!tx) {
    return { approve: false, reason: "No escrow found for this DVA account" };
  }
  if (tx.status !== "pending_payment") {
    return { approve: false, reason: `Escrow is in status '${tx.status}' — not accepting payments` };
  }

  const expected = tx.totalCharged!;
  const tolerance = Math.ceil(expected * 0.01); // 1% tolerance
  const diff = Math.abs(incomingAmountKobo - expected);

  if (diff <= tolerance) {
    return { approve: true, reason: `Amount ${incomingAmountKobo} within 1% of expected ${expected}` };
  }
  return {
    approve: false,
    reason: `Amount ${incomingAmountKobo} differs from expected ${expected} by ${diff} kobo (>${tolerance} kobo tolerance)`,
  };
}

// ─── Bank list cache (5 min) ──────────────────────────────────────────────────

let bankListCache: { data: any[]; expiresAt: number } | null = null;

async function fetchPaystackBankList(): Promise<any[]> {
  const now = Date.now();
  if (bankListCache && bankListCache.expiresAt > now) {
    return bankListCache.data;
  }
  const res = await fetch(`${PAYSTACK_API_BASE}/bank?currency=NGN&use_cursor=false&perPage=200`, {
    headers: { Authorization: `Bearer ${getPaystackKey()}` },
  });
  const json = await res.json() as any;
  if (!json.status || !Array.isArray(json.data)) {
    throw new Error(json.message || "Failed to fetch bank list from Paystack");
  }
  bankListCache = { data: json.data, expiresAt: now + 5 * 60 * 1000 };
  return json.data;
}

// ─── DVA helpers ──────────────────────────────────────────────────────────────

const DVA_BANKS = [
  { bank: "titan-paystack", name: "Titan Trust Bank" },
  { bank: "wema-bank", name: "Wema Bank" },
];

async function createPaystackCustomer(email: string, name: string): Promise<string> {
  const nameParts = name.trim().split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ") || firstName;

  const res = await fetch(`${PAYSTACK_API_BASE}/customer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getPaystackKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, first_name: firstName, last_name: lastName }),
  });
  const json = await res.json() as any;
  if (!json.status) throw new Error(json.message || "Failed to create Paystack customer");
  return json.data.customer_code;
}

async function createDedicatedVirtualAccount(
  customerCode: string,
  preferredBank: string
): Promise<{ dva_id: string; account_number: string; bank_name: string; bank_code: string } | null> {
  // PAYSTACK_ESCROW_SUBACCOUNT_CODE controls which subaccount holds escrow funds.
  // This is the swap point for bank partner integration (future phase).
  const subaccountCode = process.env.PAYSTACK_ESCROW_SUBACCOUNT_CODE;
  if (!subaccountCode) {
    console.warn("[EscrowAPI] PAYSTACK_ESCROW_SUBACCOUNT_CODE is not set — DVA created without subaccount preference");
  }

  const body: Record<string, any> = {
    customer: customerCode,
    preferred_bank: preferredBank,
  };
  if (subaccountCode) body.subaccount = subaccountCode;

  const res = await fetch(`${PAYSTACK_API_BASE}/dedicated_account`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getPaystackKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json() as any;
  if (!json.status) {
    console.error(`[EscrowAPI] DVA creation failed for bank ${preferredBank}:`, json.message);
    return null;
  }
  const account = json.data.dedicated_account || json.data;
  return {
    dva_id: String(account.id || json.data.id),
    account_number: account.account_number,
    bank_name: account.bank?.name || account.bank_name,
    bank_code: preferredBank,
  };
}

async function resolveAccountName(
  accountNumber: string,
  bankCode: string
): Promise<string | null> {
  const url = `${PAYSTACK_API_BASE}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getPaystackKey()}` },
  });
  const json = await res.json() as any;
  if (!json.status || !json.data?.account_name) return null;
  return json.data.account_name as string;
}

export function registerEscrowApiRoutes(app: Express): void {
  /**
   * GET /api/v1/escrow/banks
   * Returns the Paystack bank list (5-min in-memory cache).
   * Used by Aprisys frontend to populate the bank selector dropdown.
   */
  app.get("/api/v1/escrow/banks", authenticateApiKey(["escrow:read", "escrow:write"]), async (_req: ApiKeyRequest, res: Response) => {
    try {
      const banks = await fetchPaystackBankList();
      res.json({
        banks: banks.map((b: any) => ({
          name: b.name,
          code: b.code,
          longcode: b.longcode || b.code,
        })),
        count: banks.length,
      });
    } catch (e: any) {
      res.status(502).json({ error: e.message });
    }
  });

  /**
   * POST /api/v1/escrow/transactions
   * Create a new DVA-backed escrow transaction.
   *
   * Flow:
   * 1. Validate beneficiary bank details via Paystack account resolution
   * 2. Create a Paystack customer + Dedicated Virtual Account (Titan first, Wema fallback)
   * 3. Return the DVA account number to the caller — buyer transfers to this account
   */
  app.post("/api/v1/escrow/transactions", authenticateApiKey("escrow:write"), async (req: ApiKeyRequest, res: Response) => {
    try {
      const flag = await storage.getFeatureFlag("enable_escrow_payments");
      if (!flag?.isEnabled) {
        return res.status(503).json({ error: "Escrow service is currently unavailable" });
      }

      const schema = z.object({
        amount: z.number().int().positive("Amount must be a positive integer in kobo"),
        description: z.string().min(5).max(500),
        buyerName: z.string().min(1).max(255),
        buyerEmail: z.string().email(),
        beneficiaryName: z.string().min(1).max(255),
        beneficiaryEmail: z.string().email(),
        beneficiaryAccountNumber: z.string().min(10).max(20),
        beneficiaryBankCode: z.string().min(2).max(20),
        releaseConditions: z.string().optional(),
        expiresIn: z.number().int().min(1).max(365).optional(),
        metadata: z.record(z.any()).optional(),
      });

      const body = schema.parse(req.body);
      const orgId = req.apiKeyContext!.orgId!;

      // Step 1: Validate beneficiary bank account via Paystack
      const resolvedName = await resolveAccountName(body.beneficiaryAccountNumber, body.beneficiaryBankCode);
      if (!resolvedName) {
        return res.status(400).json({
          error: "Account resolution failed — the beneficiary account number or bank code is invalid.",
          code: "ACCOUNT_RESOLUTION_FAILED",
        });
      }

      // Step 2: Calculate fee
      const activeBankPartner = await storage.getActiveBankPartner();
      const { serviceFee, bankCustodyFee, bankPartnerId, totalCharged } = calculateEscrowFee(body.amount, activeBankPartner);

      // Step 3: Create Paystack customer for the buyer
      const customerCode = await createPaystackCustomer(body.buyerEmail, body.buyerName);

      // Step 4: Create DVA — try Titan first, fall back to Wema
      let dvaDetails: { dva_id: string; account_number: string; bank_name: string; bank_code: string } | null = null;
      for (const bank of DVA_BANKS) {
        dvaDetails = await createDedicatedVirtualAccount(customerCode, bank.bank);
        if (dvaDetails) break;
      }

      if (!dvaDetails) {
        return res.status(502).json({
          error: "Could not assign a virtual account at this time. Please try again shortly.",
          code: "DVA_CREATION_FAILED",
        });
      }

      const reference = generateEscrowReference();
      const expiresAt = body.expiresIn
        ? new Date(Date.now() + body.expiresIn * 86400000)
        : null;

      const tx = await storage.createEscrowApiTransaction({
        orgId,
        reference,
        description: body.description,
        amount: body.amount,
        serviceFee,
        bankCustodyFee,
        bankPartnerId,
        totalCharged,
        currency: "NGN",
        status: "pending_payment",
        buyerName: body.buyerName,
        buyerEmail: body.buyerEmail,
        beneficiaryName: body.beneficiaryName,
        beneficiaryEmail: body.beneficiaryEmail,
        dvaId: dvaDetails.dva_id,
        dvaAccountNumber: dvaDetails.account_number,
        dvaBankName: dvaDetails.bank_name,
        dvaBankCode: dvaDetails.bank_code,
        beneficiaryAccountNumber: body.beneficiaryAccountNumber,
        beneficiaryBankCode: body.beneficiaryBankCode,
        beneficiaryAccountName: resolvedName,
        releaseConditions: body.releaseConditions || null,
        expiresAt,
        metadata: body.metadata || null,
      });

      res.status(201).json({
        reference: tx.reference,
        status: tx.status,
        amount: tx.amount,
        serviceFee: tx.serviceFee,
        totalCharged: tx.totalCharged,
        currency: tx.currency,
        description: tx.description,
        buyerName: tx.buyerName,
        buyerEmail: tx.buyerEmail,
        beneficiaryName: tx.beneficiaryName,
        beneficiaryEmail: tx.beneficiaryEmail,
        beneficiaryAccountName: tx.beneficiaryAccountName,
        dvaAccountNumber: tx.dvaAccountNumber,
        dvaBankName: tx.dvaBankName,
        dvaBankCode: tx.dvaBankCode,
        releaseConditions: tx.releaseConditions,
        expiresAt: tx.expiresAt,
        metadata: tx.metadata,
        createdAt: tx.createdAt,
        instructions: `Buyer should transfer ₦${((tx.totalCharged || tx.amount) / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })} to account ${tx.dvaAccountNumber} at ${tx.dvaBankName}. Funds will be held in escrow until released.`,
      });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * GET /api/v1/escrow/transactions
   * List all escrow transactions for the authenticated org.
   */
  app.get("/api/v1/escrow/transactions", authenticateApiKey(["escrow:read", "escrow:write"]), async (req: ApiKeyRequest, res: Response) => {
    try {
      const orgId = req.apiKeyContext!.orgId!;
      const status = req.query.status as string | undefined;
      const txs = await storage.listEscrowApiTransactions(orgId, status);
      res.json({
        transactions: txs.map(tx => ({
          reference: tx.reference,
          status: tx.status,
          amount: tx.amount,
          currency: tx.currency,
          description: tx.description,
          buyerName: tx.buyerName,
          buyerEmail: tx.buyerEmail,
          beneficiaryName: tx.beneficiaryName,
          beneficiaryEmail: tx.beneficiaryEmail,
          beneficiaryAccountName: tx.beneficiaryAccountName,
          dvaAccountNumber: tx.dvaAccountNumber,
          dvaBankName: tx.dvaBankName,
          releaseConditions: tx.releaseConditions,
          fundedAt: tx.fundedAt,
          releasedAt: tx.releasedAt,
          disputedAt: tx.disputedAt,
          expiresAt: tx.expiresAt,
          metadata: tx.metadata,
          createdAt: tx.createdAt,
        })),
        count: txs.length,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * GET /api/v1/escrow/transactions/:reference
   * Get a single escrow transaction by reference.
   */
  app.get("/api/v1/escrow/transactions/:reference", authenticateApiKey(["escrow:read", "escrow:write"]), async (req: ApiKeyRequest, res: Response) => {
    try {
      const orgId = req.apiKeyContext!.orgId!;
      const tx = await storage.getEscrowApiTransaction(req.params.reference);
      if (!tx || tx.orgId !== orgId) {
        return res.status(404).json({ error: "Escrow transaction not found" });
      }
      res.json({
        reference: tx.reference,
        status: tx.status,
        amount: tx.amount,
        currency: tx.currency,
        description: tx.description,
        buyerName: tx.buyerName,
        buyerEmail: tx.buyerEmail,
        beneficiaryName: tx.beneficiaryName,
        beneficiaryEmail: tx.beneficiaryEmail,
        beneficiaryAccountName: tx.beneficiaryAccountName,
        dvaAccountNumber: tx.dvaAccountNumber,
        dvaBankName: tx.dvaBankName,
        dvaBankCode: tx.dvaBankCode,
        releaseConditions: tx.releaseConditions,
        releasedTo: tx.releasedTo,
        disputeReason: tx.disputeReason,
        fundedAt: tx.fundedAt,
        releasedAt: tx.releasedAt,
        disputedAt: tx.disputedAt,
        refundedAt: tx.refundedAt,
        expiresAt: tx.expiresAt,
        metadata: tx.metadata,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/v1/escrow/transactions/:reference/release
   * Release escrow funds to the validated beneficiary via Paystack Transfer API.
   *
   * Flow:
   * 1. Verify escrow is funded and has a validated beneficiary account
   * 2. Create Paystack transfer recipient (if not already created)
   * 3. Initiate Paystack transfer from Cellion balance to beneficiary
   * 4. Store transfer reference — actual release confirmed via transfer.success webhook
   */
  app.post("/api/v1/escrow/transactions/:reference/release", authenticateApiKey("escrow:write"), async (req: ApiKeyRequest, res: Response) => {
    try {
      const orgId = req.apiKeyContext!.orgId!;
      const tx = await storage.getEscrowApiTransaction(req.params.reference);
      if (!tx || tx.orgId !== orgId) {
        return res.status(404).json({ error: "Escrow transaction not found" });
      }
      if (tx.status !== "funded") {
        return res.status(400).json({
          error: `Cannot release escrow in status '${tx.status}'. Escrow must be 'funded' to release.`,
        });
      }
      if (!tx.beneficiaryAccountName || !tx.beneficiaryAccountNumber || !tx.beneficiaryBankCode) {
        return res.status(400).json({
          error: "No validated beneficiary account on record. Cannot initiate transfer.",
          code: "MISSING_BENEFICIARY_ACCOUNT",
        });
      }

      let recipientCode = tx.paystackTransferRecipientCode;

      // Create transfer recipient if not already created
      if (!recipientCode) {
        const recipientRes = await fetch(`${PAYSTACK_API_BASE}/transferrecipient`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getPaystackKey()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "nuban",
            name: tx.beneficiaryAccountName,
            account_number: tx.beneficiaryAccountNumber,
            bank_code: tx.beneficiaryBankCode,
            currency: "NGN",
            description: `Escrow release — ${tx.reference}`,
          }),
        });
        const recipientJson = await recipientRes.json() as any;
        if (!recipientJson.status) {
          return res.status(502).json({
            error: recipientJson.message || "Failed to create transfer recipient",
            code: "RECIPIENT_CREATION_FAILED",
          });
        }
        recipientCode = recipientJson.data.recipient_code as string;
        await storage.updateEscrowApiTransaction(tx.id, {
          paystackTransferRecipientCode: recipientCode,
        });
      }

      // Initiate Paystack transfer (principal amount only — fee was already collected)
      const transferRef = `co_esc_rel_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const transferRes = await fetch(`${PAYSTACK_API_BASE}/transfer`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getPaystackKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "balance",
          amount: tx.amount, // principal in kobo — fee stays with Cellion
          recipient: recipientCode,
          reference: transferRef,
          reason: `Escrow release: ${tx.reference} — ${tx.description}`,
        }),
      });
      const transferJson = await transferRes.json() as any;
      if (!transferJson.status) {
        return res.status(502).json({
          error: transferJson.message || "Failed to initiate transfer",
          code: "TRANSFER_INITIATION_FAILED",
        });
      }

      // Store transfer reference and move status to pending_transfer
      // Actual release is confirmed by the transfer.success webhook
      await storage.updateEscrowApiTransaction(tx.id, {
        status: "pending_transfer",
        paystackTransferReference: transferRef,
        paystackTransferRecipientCode: recipientCode,
      });

      await storage.createAuditLog({
        actorUserId: orgId.toString(),
        action: "api_escrow_release_initiated",
        entityType: "escrow_api_transaction",
        entityId: tx.reference,
        details: { transferRef, recipientCode, amount: tx.amount },
      });

      res.json({
        reference: tx.reference,
        status: "pending_transfer",
        amount: tx.amount,
        currency: tx.currency,
        transferReference: transferRef,
        message: "Transfer initiated. Funds will be released once the bank confirms the transfer (typically within minutes). Listen for the escrow.released webhook event.",
      });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/v1/escrow/transactions/:reference/dispute
   * Raise a dispute on an escrow transaction.
   */
  app.post("/api/v1/escrow/transactions/:reference/dispute", authenticateApiKey("escrow:write"), async (req: ApiKeyRequest, res: Response) => {
    try {
      const orgId = req.apiKeyContext!.orgId!;
      const tx = await storage.getEscrowApiTransaction(req.params.reference);
      if (!tx || tx.orgId !== orgId) {
        return res.status(404).json({ error: "Escrow transaction not found" });
      }
      if (!["funded", "pending_payment"].includes(tx.status)) {
        return res.status(400).json({
          error: `Cannot dispute escrow in status '${tx.status}'.`,
        });
      }

      const { reason } = z.object({
        reason: z.string().min(10, "Please provide a detailed dispute reason"),
      }).parse(req.body);

      const updated = await storage.updateEscrowApiTransaction(tx.id, {
        status: "disputed",
        disputeReason: reason,
        disputedAt: new Date(),
      });

      await deliverEscrowWebhook(orgId, "escrow.disputed", {
        reference: tx.reference,
        status: "disputed",
        disputeReason: reason,
        disputedAt: updated?.disputedAt,
      });

      res.json({
        reference: tx.reference,
        status: "disputed",
        disputeReason: reason,
        disputedAt: updated?.disputedAt,
        message: "Dispute raised. Our team will review within 2 business days.",
      });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  // =================== ADMIN ENDPOINTS ===================

  /**
   * GET /api/admin/escrow
   * Combined admin view: procurement + API escrow transactions.
   */
  app.get("/api/admin/escrow", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const [procurementTxs, apiTxs] = await Promise.all([
        db.select().from(escrowTransactions).orderBy(desc(escrowTransactions.createdAt)).limit(200),
        storage.listAllEscrowApiTransactions(200),
      ]);

      const activeBankPartner = await storage.getActiveBankPartner();

      type EscrowFeeRow = {
        status: string;
        bankPartnerId: number | null;
        bankCustodyFee: number | null;
        createdAt: Date | string | null;
      };

      const feeRows: EscrowFeeRow[] = [
        ...procurementTxs.map(t => ({
          status: t.status,
          bankPartnerId: t.bankPartnerId ?? null,
          bankCustodyFee: t.bankCustodyFee ?? null,
          createdAt: t.createdAt ?? null,
        })),
        ...apiTxs.map(t => ({
          status: t.status,
          bankPartnerId: t.bankPartnerId ?? null,
          bankCustodyFee: t.bankCustodyFee ?? null,
          createdAt: t.createdAt ?? null,
        })),
      ];

      const activatedSince = activeBankPartner?.activatedAt
        ? new Date(activeBankPartner.activatedAt)
        : null;

      const totalBankCustodyFees = activeBankPartner
        ? feeRows
            .filter(t => {
              if (!["funded", "released"].includes(t.status)) return false;
              if (t.bankPartnerId !== activeBankPartner.id) return false;
              if (!(t.bankCustodyFee !== null && t.bankCustodyFee > 0)) return false;
              if (activatedSince && t.createdAt !== null && new Date(t.createdAt) < activatedSince) return false;
              return true;
            })
            .reduce((sum, t) => sum + (t.bankCustodyFee ?? 0), 0)
        : 0;

      res.json({
        procurement: procurementTxs,
        api: apiTxs,
        activeBankPartner: activeBankPartner || null,
        summary: {
          procurementTotal: procurementTxs.length,
          apiTotal: apiTxs.length,
          totalFunded: [
            ...procurementTxs.filter(t => t.status === "funded"),
            ...apiTxs.filter(t => t.status === "funded"),
          ].length,
          totalDisputed: [
            ...procurementTxs.filter(t => t.status === "disputed"),
            ...apiTxs.filter(t => t.status === "disputed"),
          ].length,
          totalBankCustodyFees,
          bankPartnerName: activeBankPartner?.name || null,
        },
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/admin/escrow/api/:id/release
   * Admin manually releases an API escrow transaction via Paystack Transfer API.
   */
  app.post("/api/admin/escrow/api/:id/release", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const id = parseInt(req.params.id);
      const tx = await storage.getEscrowApiTransactionById(id);
      if (!tx) return res.status(404).json({ error: "Transaction not found" });
      if (tx.status === "released") return res.status(400).json({ error: "Already released" });
      if (!["funded", "disputed"].includes(tx.status)) {
        return res.status(400).json({ error: `Cannot release escrow in status '${tx.status}'` });
      }

      if (!tx.beneficiaryAccountName || !tx.beneficiaryAccountNumber || !tx.beneficiaryBankCode) {
        // Fallback: admin direct-mark (no validated account — legacy or manual override)
        const updated = await storage.updateEscrowApiTransaction(id, {
          status: "released",
          releasedAt: new Date(),
          releasedTo: tx.beneficiaryEmail,
        });
        await storage.createAuditLog({
          actorUserId: (req as any).user?.claims?.sub,
          action: "admin_escrow_api_released_manual",
          entityType: "escrow_api_transaction",
          entityId: String(id),
          details: { reference: tx.reference, note: "Manual override — no validated account" },
        });
        return res.json({ success: true, status: "released", transaction: updated });
      }

      // Release via Paystack Transfer API (same flow as the API endpoint)
      let recipientCode = tx.paystackTransferRecipientCode;
      if (!recipientCode) {
        const recipientRes = await fetch(`${PAYSTACK_API_BASE}/transferrecipient`, {
          method: "POST",
          headers: { Authorization: `Bearer ${getPaystackKey()}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "nuban",
            name: tx.beneficiaryAccountName,
            account_number: tx.beneficiaryAccountNumber,
            bank_code: tx.beneficiaryBankCode,
            currency: "NGN",
            description: `Admin escrow release — ${tx.reference}`,
          }),
        });
        const rj = await recipientRes.json() as any;
        if (!rj.status) return res.status(502).json({ error: rj.message || "Recipient creation failed" });
        recipientCode = rj.data.recipient_code;
        await storage.updateEscrowApiTransaction(id, { paystackTransferRecipientCode: recipientCode });
      }

      const transferRef = `co_esc_adm_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const transferRes = await fetch(`${PAYSTACK_API_BASE}/transfer`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getPaystackKey()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "balance",
          amount: tx.amount,
          recipient: recipientCode,
          reference: transferRef,
          reason: `Admin escrow release: ${tx.reference}`,
        }),
      });
      const tj = await transferRes.json() as any;
      if (!tj.status) return res.status(502).json({ error: tj.message || "Transfer initiation failed" });

      await storage.updateEscrowApiTransaction(id, {
        status: "pending_transfer",
        paystackTransferReference: transferRef,
        paystackTransferRecipientCode: recipientCode,
      });

      await storage.createAuditLog({
        actorUserId: (req as any).user?.claims?.sub,
        action: "admin_escrow_api_release_initiated",
        entityType: "escrow_api_transaction",
        entityId: String(id),
        details: { reference: tx.reference, transferRef },
      });

      res.json({ success: true, status: "pending_transfer", transferReference: transferRef });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/admin/escrow/api/:id/refund
   * Admin marks an API escrow transaction as refunded.
   * Uses the stored paystackReference (DVA charge ref) to call Paystack refund API when available.
   */
  app.post("/api/admin/escrow/api/:id/refund", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const id = parseInt(req.params.id);
      const tx = await storage.getEscrowApiTransactionById(id);
      if (!tx) return res.status(404).json({ error: "Transaction not found" });
      if (tx.status === "refunded") return res.status(400).json({ error: "Already refunded" });

      // Attempt Paystack refund if we have the DVA charge reference
      if (tx.paystackReference) {
        const refundRes = await fetch(`${PAYSTACK_API_BASE}/refund`, {
          method: "POST",
          headers: { Authorization: `Bearer ${getPaystackKey()}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            transaction: tx.paystackReference,
            amount: tx.totalCharged, // full refund including fee
          }),
        });
        const refundJson = await refundRes.json() as any;
        if (!refundJson.status) {
          console.error(`[EscrowAPI] Paystack refund failed for ${tx.reference}:`, refundJson.message);
          // Non-fatal — continue with DB update so admin can still record it
        } else {
          console.log(`[EscrowAPI] Paystack refund initiated for ${tx.reference}`);
        }
      }

      const refundedAt = new Date();
      const updated = await storage.updateEscrowApiTransaction(id, {
        status: "refunded",
        refundedAt,
      });

      await storage.createAuditLog({
        actorUserId: (req as any).user?.claims?.sub,
        action: "admin_escrow_api_refunded",
        entityType: "escrow_api_transaction",
        entityId: String(id),
        details: { reference: tx.reference, paystackReference: tx.paystackReference },
      });

      await deliverEscrowWebhook(tx.orgId, "escrow.refunded", {
        reference: tx.reference,
        amount: tx.amount,
        currency: tx.currency,
        buyerName: tx.buyerName,
        buyerEmail: tx.buyerEmail,
        beneficiaryName: tx.beneficiaryName,
        beneficiaryEmail: tx.beneficiaryEmail,
        refundedAt: refundedAt.toISOString(),
      });

      res.json({ success: true, transaction: updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/admin/escrow/procurement/:id/release
   * Admin manually releases a procurement escrow transaction.
   */
  app.post("/api/admin/escrow/procurement/:id/release", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const id = parseInt(req.params.id);
      const tx = await storage.getEscrowTransactionById(id);
      if (!tx) return res.status(404).json({ error: "Transaction not found" });
      if (tx.status === "released") return res.status(400).json({ error: "Already released" });

      const updated = await storage.updateEscrowStatus(id, "released");

      await storage.createAuditLog({
        actorUserId: (req as any).user?.claims?.sub,
        action: "admin_procurement_escrow_released",
        entityType: "escrow_transaction",
        entityId: String(id),
        details: { contractId: tx.contractId },
      });

      res.json({ success: true, transaction: updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/admin/escrow/procurement/:id/refund
   * Admin marks a procurement escrow as refunded.
   */
  app.post("/api/admin/escrow/procurement/:id/refund", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const id = parseInt(req.params.id);
      const tx = await storage.getEscrowTransactionById(id);
      if (!tx) return res.status(404).json({ error: "Transaction not found" });
      if (tx.status === "refunded") return res.status(400).json({ error: "Already refunded" });

      const updated = await storage.updateEscrowStatus(id, "refunded");

      await storage.createAuditLog({
        actorUserId: (req as any).user?.claims?.sub,
        action: "admin_procurement_escrow_refunded",
        entityType: "escrow_transaction",
        entityId: String(id),
        details: { contractId: tx.contractId },
      });

      res.json({ success: true, transaction: updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Admin: Banking Partners ─────────────────────────────────────────────────

  /**
   * GET /api/admin/banking-partners
   * List all banking partners.
   */
  app.get("/api/admin/banking-partners", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const partners = await storage.listBankPartners();
      res.json(partners);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/admin/banking-partners
   * Create a new banking partner.
   */
  app.post("/api/admin/banking-partners", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const body = z.object({
        name: z.string().min(1).max(255),
        contactEmail: z.string().email().optional(),
        serviceTypes: z.array(z.enum(["account_opening", "escrow_custody"])).min(1, "At least one service type is required"),
        feeRateBps: z.number().int().min(0).max(150).optional().default(0),
        notes: z.string().optional(),
      }).parse(req.body);

      const normalizedFeeRateBps = body.serviceTypes.includes("escrow_custody") ? (body.feeRateBps ?? 0) : 0;

      const initialEmails: { label: string; address: string }[] = body.contactEmail
        ? [{ label: "Primary Contact", address: body.contactEmail }]
        : [];
      const partner = await storage.createBankPartner({ ...body, feeRateBps: normalizedFeeRateBps, isActive: false, emails: initialEmails });

      await storage.createAuditLog({
        actorUserId: (req as any).user?.claims?.sub,
        action: "admin_bank_partner_created",
        entityType: "bank_partner",
        entityId: String(partner.id),
        details: { name: partner.name, feeRateBps: partner.feeRateBps },
      });

      if (body.contactEmail) {
        const baseUrl = getSiteBaseUrl(req);
        try {
          await createBankPortalUserAndSendInvite(body.contactEmail, partner.id, partner.name, baseUrl);
        } catch (inviteErr) {
          console.error("[BankPortal] Auto-invite on partner creation failed:", inviteErr);
        }
      }

      res.status(201).json(partner);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", errors: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * PATCH /api/admin/banking-partners/:id
   * Update a banking partner's details (not activation status).
   */
  app.patch("/api/admin/banking-partners/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const id = parseInt(req.params.id);
      const body = z.object({
        name: z.string().min(1).max(255).optional(),
        contactEmail: z.string().email().optional(),
        serviceTypes: z.array(z.enum(["account_opening", "escrow_custody"])).min(1, "At least one service type is required").optional(),
        feeRateBps: z.number().int().min(0).max(150).optional(),
        notes: z.string().optional(),
      }).parse(req.body);

      const updateData = { ...body };
      if (body.serviceTypes !== undefined && !body.serviceTypes.includes("escrow_custody")) {
        updateData.feeRateBps = 0;
      }

      const partner = await storage.updateBankPartner(id, updateData);
      if (!partner) return res.status(404).json({ error: "Partner not found" });

      res.json(partner);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", errors: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/admin/banking-partners/:id/activate
   * Activate a banking partner (deactivates all others).
   */
  app.post("/api/admin/banking-partners/:id/activate", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const id = parseInt(req.params.id);
      const partner = await storage.activateBankPartner(id);
      if (!partner) return res.status(404).json({ error: "Partner not found" });

      await storage.createAuditLog({
        actorUserId: (req as any).user?.claims?.sub,
        action: "admin_bank_partner_activated",
        entityType: "bank_partner",
        entityId: String(id),
        details: { name: partner.name, feeRateBps: partner.feeRateBps },
      });

      res.json(partner);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/admin/banking-partners/:id/deactivate
   * Deactivate a banking partner.
   */
  app.post("/api/admin/banking-partners/:id/deactivate", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const id = parseInt(req.params.id);
      const partner = await storage.deactivateBankPartner(id);
      if (!partner) return res.status(404).json({ error: "Partner not found" });

      await storage.createAuditLog({
        actorUserId: (req as any).user?.claims?.sub,
        action: "admin_bank_partner_deactivated",
        entityType: "bank_partner",
        entityId: String(id),
        details: { name: partner.name },
      });

      res.json(partner);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  console.log("[EscrowAPI] Routes registered");
}

// ─── Auto-Expiry Scheduler ────────────────────────────────────────────────────

/**
 * Marks pending_payment escrow API transactions as expired when their
 * expiresAt timestamp has passed. Fires escrow.expired webhook for each.
 * Called every 30 minutes from server/index.ts.
 */
export async function runEscrowExpiry(): Promise<void> {
  try {
    const candidates = await storage.getExpiredPendingEscrowTransactions();
    if (candidates.length === 0) return;

    const candidateIds = candidates.map((tx) => tx.id);
    const actuallyExpiredIds = await storage.bulkExpireEscrowTransactions(candidateIds);

    if (actuallyExpiredIds.length === 0) return;

    const actuallyExpiredSet = new Set(actuallyExpiredIds);
    const expiredAt = new Date().toISOString();

    for (const tx of candidates) {
      if (!actuallyExpiredSet.has(tx.id)) continue;
      await deliverEscrowWebhook(tx.orgId, "escrow.expired", {
        reference: tx.reference,
        amount: tx.amount,
        currency: tx.currency,
        buyerName: tx.buyerName,
        buyerEmail: tx.buyerEmail,
        beneficiaryName: tx.beneficiaryName,
        expiredAt,
      });
    }

    console.log(`[EscrowExpiry] Expired ${actuallyExpiredIds.length} stale transactions.`);
  } catch (err: any) {
    console.error("[EscrowExpiry] Auto-expiry run failed:", err.message);
  }
}
