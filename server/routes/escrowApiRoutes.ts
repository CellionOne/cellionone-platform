import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { db } from "../db";
import { eq, desc } from "drizzle-orm";
import { kycWebhookConfigs, escrowTransactions, userRoles } from "@shared/schema";
import { authenticateApiKey, type ApiKeyRequest } from "../middleware/apiKeyAuth";
import { isAuthenticated } from "../replit_integrations/auth";
import crypto from "crypto";

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
 * When an activeBankPartner is present, a portion of the service fee is
 * carved out as bankCustodyFee (based on the partner's feeRateBps).
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
  let bankPartnerId: number | null = null;

  if (activeBankPartner && activeBankPartner.feeRateBps > 0) {
    const rawBankFee = Math.floor(principalKobo * activeBankPartner.feeRateBps / 10_000);
    // Clamp: the custody fee can never exceed Cellion's service fee (no negative Cellion revenue)
    bankCustodyFee = Math.min(rawBankFee, serviceFee);
    bankPartnerId = activeBankPartner.id;
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

export async function handleApiEscrowFunded(
  reference: string,
  paystackReference: string,
  amount: number
): Promise<void> {
  const tx = await storage.getEscrowApiTransaction(reference);
  if (!tx) {
    console.error(`[EscrowAPI] Transaction ${reference} not found for webhook`);
    return;
  }
  if (tx.status === "funded") {
    console.log(`[EscrowAPI] Transaction ${reference} already funded`);
    return;
  }

  await storage.updateEscrowApiTransaction(tx.id, {
    status: "funded",
    fundedAt: new Date(),
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

  console.log(`[EscrowAPI] Transaction ${reference} funded via Paystack ref ${paystackReference}`);
}

export function registerEscrowApiRoutes(app: Express): void {
  /**
   * POST /api/v1/escrow/transactions
   * Create a new escrow transaction and get a Paystack payment URL for the buyer.
   */
  app.post("/api/v1/escrow/transactions", authenticateApiKey("escrow:create"), async (req: ApiKeyRequest, res: Response) => {
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
        releaseConditions: z.string().optional(),
        expiresIn: z.number().int().min(1).max(365).optional(), // days
        metadata: z.record(z.any()).optional(),
      });

      const body = schema.parse(req.body);
      const orgId = req.apiKeyContext!.orgId;
      const reference = generateEscrowReference();
      const paystackRef = `co_esc_api_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

      const expiresAt = body.expiresIn
        ? new Date(Date.now() + body.expiresIn * 86400000)
        : null;

      // Calculate service fee (includes bank custody fee carve-out if a partner is active)
      const activeBankPartner = await storage.getActiveBankPartner();
      const { serviceFee, bankCustodyFee, bankPartnerId, totalCharged } = calculateEscrowFee(body.amount, activeBankPartner);

      // Initialize Paystack payment — buyer pays principal + Cellion's service fee (unchanged regardless of bank partner)
      const paystackRes = await fetch(`${PAYSTACK_API_BASE}/transaction/initialize`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getPaystackKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: body.buyerEmail,
          amount: totalCharged, // principal + Cellion service fee
          reference: paystackRef,
          metadata: {
            type: "api_escrow",
            reference,
            orgId,
            principalAmount: body.amount,
            serviceFee,
            bankCustodyFee,
            bankPartnerId,
          },
        }),
      });

      const paystackData = await paystackRes.json() as any;
      if (!paystackData.status) {
        return res.status(502).json({ error: paystackData.message || "Payment initialization failed" });
      }

      const paymentUrl = paystackData.data.authorization_url;

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
        paystackReference: paystackRef,
        paystackPaymentUrl: paymentUrl,
        releaseConditions: body.releaseConditions || null,
        expiresAt,
        metadata: body.metadata || null,
      });

      res.status(201).json({
        reference: tx.reference,
        status: tx.status,
        amount: tx.amount,             // principal only
        serviceFee: tx.serviceFee,     // Cellion fee
        totalCharged: tx.totalCharged, // what buyer pays
        currency: tx.currency,
        description: tx.description,
        buyerName: tx.buyerName,
        buyerEmail: tx.buyerEmail,
        beneficiaryName: tx.beneficiaryName,
        beneficiaryEmail: tx.beneficiaryEmail,
        paymentUrl,
        releaseConditions: tx.releaseConditions,
        expiresAt: tx.expiresAt,
        metadata: tx.metadata,
        createdAt: tx.createdAt,
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
  app.get("/api/v1/escrow/transactions", authenticateApiKey(), async (req: ApiKeyRequest, res: Response) => {
    try {
      const orgId = req.apiKeyContext!.orgId;
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
          paymentUrl: tx.paystackPaymentUrl,
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
  app.get("/api/v1/escrow/transactions/:reference", authenticateApiKey(), async (req: ApiKeyRequest, res: Response) => {
    try {
      const orgId = req.apiKeyContext!.orgId;
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
        paymentUrl: tx.paystackPaymentUrl,
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
   * Release funds to the beneficiary.
   */
  app.post("/api/v1/escrow/transactions/:reference/release", authenticateApiKey("escrow:release"), async (req: ApiKeyRequest, res: Response) => {
    try {
      const orgId = req.apiKeyContext!.orgId;
      const tx = await storage.getEscrowApiTransaction(req.params.reference);
      if (!tx || tx.orgId !== orgId) {
        return res.status(404).json({ error: "Escrow transaction not found" });
      }
      if (tx.status !== "funded") {
        return res.status(400).json({
          error: `Cannot release escrow in status '${tx.status}'. Escrow must be 'funded' to release.`,
        });
      }

      const { releasedTo } = z.object({
        releasedTo: z.string().optional(),
      }).parse(req.body);

      const updated = await storage.updateEscrowApiTransaction(tx.id, {
        status: "released",
        releasedAt: new Date(),
        releasedTo: releasedTo || tx.beneficiaryEmail,
      });

      await deliverEscrowWebhook(orgId, "escrow.released", {
        reference: tx.reference,
        status: "released",
        amount: tx.amount,
        currency: tx.currency,
        releasedTo: updated?.releasedTo,
        releasedAt: updated?.releasedAt,
      });

      res.json({
        reference: tx.reference,
        status: "released",
        releasedTo: updated?.releasedTo,
        releasedAt: updated?.releasedAt,
        message: "Funds released to beneficiary",
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
  app.post("/api/v1/escrow/transactions/:reference/dispute", authenticateApiKey(), async (req: ApiKeyRequest, res: Response) => {
    try {
      const orgId = req.apiKeyContext!.orgId;
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

      // Cumulative bank custody fees for the ACTIVE partner only (funded + released)
      // Scoped to transactions linked to the current active partner via bankPartnerId
      const totalBankCustodyFees = activeBankPartner
        ? [...procurementTxs, ...apiTxs]
            .filter(
              t => ["funded", "released"].includes(t.status) &&
                   (t as any).bankPartnerId === activeBankPartner.id &&
                   (t as any).bankCustodyFee > 0
            )
            .reduce((sum, t) => sum + ((t as any).bankCustodyFee || 0), 0)
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
   * Admin manually releases an API escrow transaction.
   */
  app.post("/api/admin/escrow/api/:id/release", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const id = parseInt(req.params.id);
      const tx = await storage.getEscrowApiTransactionById(id);
      if (!tx) return res.status(404).json({ error: "Transaction not found" });
      if (tx.status === "released") return res.status(400).json({ error: "Already released" });

      const updated = await storage.updateEscrowApiTransaction(id, {
        status: "released",
        releasedAt: new Date(),
        releasedTo: tx.beneficiaryEmail,
      });

      await storage.createAuditLog({
        actorUserId: (req as any).user?.claims?.sub,
        action: "admin_escrow_api_released",
        entityType: "escrow_api_transaction",
        entityId: String(id),
        details: { reference: tx.reference },
      });

      res.json({ success: true, transaction: updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/admin/escrow/api/:id/refund
   * Admin marks an API escrow transaction as refunded.
   */
  app.post("/api/admin/escrow/api/:id/refund", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const id = parseInt(req.params.id);
      const tx = await storage.getEscrowApiTransactionById(id);
      if (!tx) return res.status(404).json({ error: "Transaction not found" });
      if (tx.status === "refunded") return res.status(400).json({ error: "Already refunded" });

      const updated = await storage.updateEscrowApiTransaction(id, {
        status: "refunded",
        refundedAt: new Date(),
      });

      await storage.createAuditLog({
        actorUserId: (req as any).user?.claims?.sub,
        action: "admin_escrow_api_refunded",
        entityType: "escrow_api_transaction",
        entityId: String(id),
        details: { reference: tx.reference },
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
        feeRateBps: z.number().int().min(0).max(150), // max 150 bps (= 1.50%, matching Cellion's service fee cap)
        notes: z.string().optional(),
      }).parse(req.body);

      const partner = await storage.createBankPartner({ ...body, isActive: false });

      await storage.createAuditLog({
        actorUserId: (req as any).user?.claims?.sub,
        action: "admin_bank_partner_created",
        entityType: "bank_partner",
        entityId: String(partner.id),
        details: { name: partner.name, feeRateBps: partner.feeRateBps },
      });

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
        feeRateBps: z.number().int().min(0).max(150).optional(), // max 150 bps = 1.50%
        notes: z.string().optional(),
      }).parse(req.body);

      const partner = await storage.updateBankPartner(id, body);
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
