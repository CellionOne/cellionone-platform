import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { kycOrgMembers, kycOrganisations, identityVerifications, verifiedEntities, users as usersTable } from "@shared/schema";
import { calculateEscrowFee } from "./escrowApiRoutes";

async function requireActiveOrg(orgId: number, res: Response): Promise<boolean> {
  const [org] = await db.select().from(kycOrganisations).where(eq(kycOrganisations.id, orgId)).limit(1);
  if (!org) { res.status(404).json({ message: "Organisation not found" }); return false; }
  if (org.status === "pending_review") {
    res.status(403).json({ message: "Your organisation is pending admin review. You cannot publish RFQs or submit bids until it has been approved.", code: "ORG_PENDING_REVIEW" });
    return false;
  }
  if (org.status === "suspended") {
    res.status(403).json({ message: "Your organisation has been suspended. Please contact support.", code: "ORG_SUSPENDED" });
    return false;
  }
  return true;
}

function getUserId(req: any): string {
  return req.user?.claims?.sub;
}

async function getUserOrgMembership(userId: string, orgId: number) {
  const [member] = await db
    .select()
    .from(kycOrgMembers)
    .where(and(eq(kycOrgMembers.orgId, orgId), eq(kycOrgMembers.userId, userId), eq(kycOrgMembers.inviteStatus, "accepted")));
  return member;
}

async function getUserOrgs(userId: string) {
  return db
    .select()
    .from(kycOrgMembers)
    .where(and(eq(kycOrgMembers.userId, userId), eq(kycOrgMembers.inviteStatus, "accepted")));
}

export function registerProcurementRoutes(app: Express) {

  app.get("/api/procurement/categories", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/procurement/categories", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = z.object({
        name: z.string().min(1),
        slug: z.string().min(1),
        description: z.string().optional(),
        parentId: z.number().optional(),
      }).parse(req.body);
      const category = await storage.createCategory(data);
      res.status(201).json(category);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/procurement/rfqs", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const data = z.object({
        title: z.string().min(1).max(500),
        description: z.string().min(1),
        buyerOrgId: z.number(),
        categoryId: z.number().optional(),
        currency: z.string().default("NGN"),
        budgetMin: z.number().optional(),
        budgetMax: z.number().optional(),
        deadline: z.string(),
        deliveryDeadline: z.string().optional(),
        visibility: z.enum(["open", "invited"]).default("open"),
        requirements: z.string().optional(),
        qualifications: z.string().optional(),
        attachments: z.any().optional(),
        items: z.array(z.object({
          description: z.string().min(1),
          quantity: z.number().min(1).default(1),
          unit: z.string().default("units"),
          specifications: z.string().optional(),
        })).optional(),
      }).parse(req.body);

      const member = await getUserOrgMembership(userId, data.buyerOrgId);
      if (!member) return res.status(403).json({ message: "Not a member of this organisation" });

      if (!await requireActiveOrg(data.buyerOrgId, res)) return;

      const { items, ...rfqData } = data;
      const rfq = await storage.createRfq({
        ...rfqData,
        createdByUserId: userId,
        deadline: new Date(data.deadline),
        deliveryDeadline: data.deliveryDeadline ? new Date(data.deliveryDeadline) : undefined,
        status: "draft",
      });

      if (items && items.length > 0) {
        for (const item of items) {
          await storage.createRfqItem({ ...item, rfqId: rfq.id });
        }
      }

      const rfqWithItems = await storage.getRfqById(rfq.id);
      res.status(201).json(rfqWithItems);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/procurement/rfqs", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const orgId = req.query.orgId ? parseInt(req.query.orgId as string) : undefined;
      const status = req.query.status as string | undefined;

      if (orgId) {
        const member = await getUserOrgMembership(userId, orgId);
        if (!member) return res.status(403).json({ message: "Not a member of this organisation" });
        let rfqs = await storage.getRfqsByBuyerOrg(orgId);
        if (status) rfqs = rfqs.filter((r: any) => r.status === status);
        return res.json(rfqs);
      }

      const memberships = await getUserOrgs(userId);
      const orgIds = memberships.map(m => m.orgId);
      if (orgIds.length === 0) return res.json([]);

      let allRfqs: any[] = [];
      for (const oid of orgIds) {
        const rfqs = await storage.getRfqsByBuyerOrg(oid);
        allRfqs = allRfqs.concat(rfqs);
      }
      if (status) allRfqs = allRfqs.filter((r: any) => r.status === status);
      allRfqs.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
      res.json(allRfqs);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/procurement/marketplace", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      const search = req.query.search as string | undefined;
      const rfqs = await storage.getOpenRfqs({ categoryId, search });
      res.json(rfqs);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/procurement/rfqs/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid RFQ ID" });
      const rfq = await storage.getRfqById(id);
      if (!rfq) return res.status(404).json({ message: "RFQ not found" });

      if (rfq.status === "open") {
        return res.json(rfq);
      }

      const memberships = await getUserOrgs(userId);
      const orgIds = new Set(memberships.map(m => m.orgId));
      if (!orgIds.has(rfq.buyerOrgId)) {
        const invitations = await storage.getInvitationsByRfq(id);
        const isInvited = invitations.some(inv => orgIds.has(inv.supplierOrgId));
        if (!isInvited) return res.status(403).json({ message: "Not authorized to view this RFQ" });
      }

      res.json(rfq);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/procurement/rfqs/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const rfq = await storage.getRfqById(id);
      if (!rfq) return res.status(404).json({ message: "RFQ not found" });
      if (rfq.status !== "draft") return res.status(400).json({ message: "Can only edit draft RFQs" });

      const member = await getUserOrgMembership(userId, rfq.buyerOrgId);
      if (!member) return res.status(403).json({ message: "Not authorized" });

      const data = z.object({
        title: z.string().min(1).max(500).optional(),
        description: z.string().min(1).optional(),
        categoryId: z.number().optional(),
        budgetMin: z.number().optional(),
        budgetMax: z.number().optional(),
        deadline: z.string().optional(),
        deliveryDeadline: z.string().optional(),
        requirements: z.string().optional(),
        qualifications: z.string().optional(),
        attachments: z.any().optional(),
        items: z.array(z.object({
          id: z.number().optional(),
          description: z.string().min(1),
          quantity: z.number().min(1).default(1),
          unit: z.string().default("units"),
          specifications: z.string().optional(),
        })).optional(),
      }).parse(req.body);

      const { items, ...updateData } = data;
      const updatedRfq = await storage.updateRfq(id, {
        ...updateData,
        deadline: data.deadline ? new Date(data.deadline) : undefined,
        deliveryDeadline: data.deliveryDeadline ? new Date(data.deliveryDeadline) : undefined,
      });

      if (items) {
        const existingItems = await storage.getRfqItems(id);
        for (const existing of existingItems) {
          if (!items.find(i => i.id === existing.id)) {
            await storage.deleteRfqItem(existing.id);
          }
        }
        for (const item of items) {
          if (item.id) {
            await storage.updateRfqItem(item.id, item);
          } else {
            await storage.createRfqItem({ ...item, rfqId: id });
          }
        }
      }

      const result = await storage.getRfqById(id);
      res.json(result);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/procurement/rfqs/:id/publish", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const rfq = await storage.getRfqById(id);
      if (!rfq) return res.status(404).json({ message: "RFQ not found" });
      if (rfq.status !== "draft") return res.status(400).json({ message: "Can only publish draft RFQs" });

      const member = await getUserOrgMembership(userId, rfq.buyerOrgId);
      if (!member) return res.status(403).json({ message: "Not authorized" });

      if (!await requireActiveOrg(rfq.buyerOrgId, res)) return;

      const updated = await storage.updateRfqStatus(id, "open");
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/procurement/rfqs/:id/close", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const rfq = await storage.getRfqById(id);
      if (!rfq) return res.status(404).json({ message: "RFQ not found" });

      const member = await getUserOrgMembership(userId, rfq.buyerOrgId);
      if (!member) return res.status(403).json({ message: "Not authorized" });

      const updated = await storage.updateRfqStatus(id, "closed");
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/procurement/rfqs/:id/invite", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const rfqId = parseInt(req.params.id);
      const rfq = await storage.getRfqById(rfqId);
      if (!rfq) return res.status(404).json({ message: "RFQ not found" });

      const member = await getUserOrgMembership(userId, rfq.buyerOrgId);
      if (!member) return res.status(403).json({ message: "Not authorized" });

      const { supplierOrgIds } = z.object({
        supplierOrgIds: z.array(z.number()),
      }).parse(req.body);

      const invitations = [];
      for (const supplierOrgId of supplierOrgIds) {
        const inv = await storage.createInvitation({ rfqId, supplierOrgId });
        invitations.push(inv);
      }

      res.status(201).json(invitations);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/procurement/rfqs/:id/bids", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const rfqId = parseInt(req.params.id);
      const rfq = await storage.getRfqById(rfqId);
      if (!rfq) return res.status(404).json({ message: "RFQ not found" });

      const member = await getUserOrgMembership(userId, rfq.buyerOrgId);
      if (!member) return res.status(403).json({ message: "Only the buyer can view bids" });

      const bids = await storage.getBidsByRfq(rfqId);
      res.json(bids);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/procurement/rfqs/:rfqId/bids", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const rfqId = parseInt(req.params.rfqId);
      const rfq = await storage.getRfqById(rfqId);
      if (!rfq) return res.status(404).json({ message: "RFQ not found" });
      if (rfq.status !== "open" && rfq.status !== "evaluation") {
        return res.status(400).json({ message: "RFQ is not accepting bids" });
      }

      const data = z.object({
        supplierOrgId: z.number(),
        totalAmount: z.number().default(0),
        currency: z.string().default("NGN"),
        deliveryTimeline: z.string().optional(),
        validUntil: z.string().optional(),
        coverLetter: z.string().optional(),
        terms: z.string().optional(),
        attachments: z.any().optional(),
        templateId: z.number().optional(),
        items: z.array(z.object({
          rfqItemId: z.number(),
          unitPrice: z.number(),
          quantity: z.number().min(1).default(1),
          notes: z.string().optional(),
        })).optional(),
      }).parse(req.body);

      const member = await getUserOrgMembership(userId, data.supplierOrgId);
      if (!member) return res.status(403).json({ message: "Not a member of the supplier organisation" });

      if (data.supplierOrgId === rfq.buyerOrgId) {
        return res.status(400).json({ message: "Cannot bid on your own RFQ" });
      }

      const { items, ...bidData } = data;
      const bid = await storage.createBid({
        ...bidData,
        rfqId,
        submittedByUserId: userId,
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        status: "draft",
      });

      if (items && items.length > 0) {
        let total = 0;
        for (const item of items) {
          const subtotal = item.unitPrice * item.quantity;
          total += subtotal;
          await storage.createBidItem({
            bidId: bid.id,
            rfqItemId: item.rfqItemId,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            subtotal,
            notes: item.notes,
          });
        }
        await storage.updateBid(bid.id, { totalAmount: total });
      }

      const result = await storage.getBidById(bid.id);
      res.status(201).json(result);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/procurement/bids/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const bid = await storage.getBidById(id);
      if (!bid) return res.status(404).json({ message: "Bid not found" });

      const memberships = await getUserOrgs(userId);
      const orgIds = new Set(memberships.map(m => m.orgId));
      const rfq = await storage.getRfqById(bid.rfqId);
      if (!orgIds.has(bid.supplierOrgId) && !(rfq && orgIds.has(rfq.buyerOrgId))) {
        return res.status(403).json({ message: "Not authorized to view this bid" });
      }

      res.json(bid);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/procurement/bids/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const bid = await storage.getBidById(id);
      if (!bid) return res.status(404).json({ message: "Bid not found" });
      if (bid.status !== "draft") return res.status(400).json({ message: "Can only edit draft bids" });

      const member = await getUserOrgMembership(userId, bid.supplierOrgId);
      if (!member) return res.status(403).json({ message: "Not authorized" });

      const data = z.object({
        totalAmount: z.number().optional(),
        deliveryTimeline: z.string().optional(),
        validUntil: z.string().optional(),
        coverLetter: z.string().optional(),
        terms: z.string().optional(),
        attachments: z.any().optional(),
      }).parse(req.body);

      const updated = await storage.updateBid(id, {
        ...data,
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
      });
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/procurement/bids/:id/submit", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const bid = await storage.getBidById(id);
      if (!bid) return res.status(404).json({ message: "Bid not found" });
      if (bid.status !== "draft") return res.status(400).json({ message: "Bid is already submitted" });

      const member = await getUserOrgMembership(userId, bid.supplierOrgId);
      if (!member) return res.status(403).json({ message: "Not authorized" });

      if (!await requireActiveOrg(bid.supplierOrgId, res)) return;

      // Gate: submitter must have a verified identity (platform KYC/KYB pipeline OR verified_entities registry)
      const [idVerification] = await db.select({ status: identityVerifications.status })
        .from(identityVerifications)
        .where(eq(identityVerifications.founderUserId, userId))
        .limit(1);
      const platformVerified = idVerification?.status === 'verified';

      // Also accept legacy path: user email exists in verifiedEntities (individual)
      let registryVerified = false;
      if (!platformVerified) {
        const [userRecord] = await db.select({ email: usersTable.email })
          .from(usersTable)
          .where(eq(usersTable.id, userId))
          .limit(1);
        if (userRecord?.email) {
          const [veRecord] = await db.select({ id: verifiedEntities.id })
            .from(verifiedEntities)
            .where(and(eq(verifiedEntities.email, userRecord.email), eq(verifiedEntities.entityType, 'individual')))
            .limit(1);
          registryVerified = !!veRecord;
        }
      }

      if (!platformVerified && !registryVerified) {
        return res.status(403).json({
          message: "Identity verification required before submitting bids. Please complete your identity verification.",
          code: "IDENTITY_NOT_VERIFIED",
        });
      }

      const updated = await storage.updateBidStatus(id, "submitted");

      await storage.createNotification({
        userId: (await storage.getRfqById(bid.rfqId))?.createdByUserId || "",
        title: "New Bid Received",
        message: `A new bid has been submitted for your RFQ`,
        type: "info",
        linkUrl: `/procurement/rfqs/${bid.rfqId}`,
      });

      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/procurement/bids/:id/withdraw", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const bid = await storage.getBidById(id);
      if (!bid) return res.status(404).json({ message: "Bid not found" });

      const member = await getUserOrgMembership(userId, bid.supplierOrgId);
      if (!member) return res.status(403).json({ message: "Not authorized" });

      const updated = await storage.updateBidStatus(id, "withdrawn");
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/procurement/my-bids", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const memberships = await getUserOrgs(userId);
      const orgIds = memberships.map(m => m.orgId);

      let allBids: any[] = [];
      for (const orgId of orgIds) {
        const bids = await storage.getBidsBySupplierOrg(orgId);
        allBids = allBids.concat(bids);
      }
      allBids.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
      res.json(allBids);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/procurement/bid-templates", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const orgId = parseInt(req.query.orgId as string);
      if (isNaN(orgId)) return res.status(400).json({ message: "orgId required" });

      const member = await getUserOrgMembership(userId, orgId);
      if (!member) return res.status(403).json({ message: "Not authorized" });

      const templates = await storage.getBidTemplatesByOrg(orgId);
      res.json(templates);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/procurement/bid-templates", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const data = z.object({
        orgId: z.number(),
        name: z.string().min(1),
        categoryId: z.number().optional(),
        coverLetterTemplate: z.string().optional(),
        termsTemplate: z.string().optional(),
        defaultItems: z.any().optional(),
      }).parse(req.body);

      const member = await getUserOrgMembership(userId, data.orgId);
      if (!member) return res.status(403).json({ message: "Not authorized" });

      const template = await storage.createBidTemplate(data);
      res.status(201).json(template);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/procurement/bid-templates/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const template = await storage.getBidTemplateById(id);
      if (!template) return res.status(404).json({ message: "Template not found" });

      const member = await getUserOrgMembership(userId, template.orgId);
      if (!member) return res.status(403).json({ message: "Not authorized" });

      const data = z.object({
        name: z.string().min(1).optional(),
        categoryId: z.number().optional(),
        coverLetterTemplate: z.string().optional(),
        termsTemplate: z.string().optional(),
        defaultItems: z.any().optional(),
      }).parse(req.body);

      const updated = await storage.updateBidTemplate(id, data);
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/procurement/bid-templates/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const template = await storage.getBidTemplateById(id);
      if (!template) return res.status(404).json({ message: "Template not found" });

      const member = await getUserOrgMembership(userId, template.orgId);
      if (!member) return res.status(403).json({ message: "Not authorized" });

      await storage.deleteBidTemplate(id);
      res.json({ message: "Template deleted" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/procurement/rfqs/:rfqId/bids/:bidId/award", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const rfqId = parseInt(req.params.rfqId);
      const bidId = parseInt(req.params.bidId);

      const rfq = await storage.getRfqById(rfqId);
      if (!rfq) return res.status(404).json({ message: "RFQ not found" });

      const member = await getUserOrgMembership(userId, rfq.buyerOrgId);
      if (!member) return res.status(403).json({ message: "Only the buyer can award contracts" });

      const bid = await storage.getBidById(bidId);
      if (!bid) return res.status(404).json({ message: "Bid not found" });
      if (bid.rfqId !== rfqId) return res.status(400).json({ message: "Bid does not belong to this RFQ" });
      if (bid.status !== "submitted" && bid.status !== "shortlisted") {
        return res.status(400).json({ message: "Can only award submitted or shortlisted bids" });
      }

      const milestones = z.array(z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        amount: z.number(),
        dueDate: z.string().optional(),
      })).optional().parse(req.body.milestones);

      const contractNumber = await storage.generateContractNumber();

      const contract = await storage.createContract({
        rfqId,
        bidId,
        buyerOrgId: rfq.buyerOrgId,
        supplierOrgId: bid.supplierOrgId,
        contractNumber,
        totalAmount: bid.totalAmount,
        currency: bid.currency,
        status: "awarded",
        terms: bid.terms,
        awardedByUserId: userId,
        awardedAt: new Date(),
      });

      if (milestones && milestones.length > 0) {
        for (let i = 0; i < milestones.length; i++) {
          await storage.createMilestone({
            contractId: contract.id,
            title: milestones[i].title,
            description: milestones[i].description,
            amount: milestones[i].amount,
            dueDate: milestones[i].dueDate ? new Date(milestones[i].dueDate!) : undefined,
            sortOrder: i,
            status: "pending",
          });
        }
      } else {
        await storage.createMilestone({
          contractId: contract.id,
          title: "Full Delivery",
          description: "Complete delivery of all items/services",
          amount: bid.totalAmount,
          sortOrder: 0,
          status: "pending",
        });
      }

      await storage.updateBidStatus(bidId, "awarded");
      await storage.updateRfqStatus(rfqId, "awarded");

      const allBids = await storage.getBidsByRfq(rfqId);
      for (const otherBid of allBids) {
        if (otherBid.id !== bidId && otherBid.status !== "withdrawn") {
          await storage.updateBidStatus(otherBid.id, "rejected");

          const bidMembers = await db.select().from(kycOrgMembers)
            .where(and(eq(kycOrgMembers.orgId, otherBid.supplierOrgId), eq(kycOrgMembers.inviteStatus, "accepted")));
          for (const m of bidMembers) {
            await storage.createNotification({
              userId: m.userId,
              title: "Bid Not Selected",
              message: `Your bid for "${rfq.title}" was not selected.`,
              type: "info",
              linkUrl: `/procurement/my-bids`,
            });
          }
        }
      }

      const supplierMembers = await db.select().from(kycOrgMembers)
        .where(and(eq(kycOrgMembers.orgId, bid.supplierOrgId), eq(kycOrgMembers.inviteStatus, "accepted")));
      for (const m of supplierMembers) {
        await storage.createNotification({
          userId: m.userId,
          title: "Contract Awarded!",
          message: `You've been awarded contract ${contractNumber} for "${rfq.title}"`,
          type: "success",
          linkUrl: `/procurement/contracts/${contract.id}`,
        });
      }

      const result = await storage.getContractById(contract.id);
      res.status(201).json(result);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/procurement/contracts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const role = req.query.role as string | undefined;
      const status = req.query.status as string | undefined;
      const memberships = await getUserOrgs(userId);
      const orgIds = memberships.map(m => m.orgId);

      let allContracts: any[] = [];
      for (const orgId of orgIds) {
        if (!role || role === "buyer") {
          const contracts = await storage.getContractsByBuyerOrg(orgId);
          allContracts = allContracts.concat(contracts.map(c => ({ ...c, userRole: "buyer" })));
        }
        if (!role || role === "supplier") {
          const contracts = await storage.getContractsBySupplierOrg(orgId);
          allContracts = allContracts.concat(contracts.map(c => ({ ...c, userRole: "supplier" })));
        }
      }

      const seen = new Set<number>();
      allContracts = allContracts.filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
      if (status) allContracts = allContracts.filter(c => c.status === status);
      allContracts.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
      res.json(allContracts);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/procurement/contracts/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid contract ID" });
      const contract = await storage.getContractById(id);
      if (!contract) return res.status(404).json({ message: "Contract not found" });

      const memberships = await getUserOrgs(userId);
      const orgIds = new Set(memberships.map(m => m.orgId));
      if (!orgIds.has(contract.buyerOrgId) && !orgIds.has(contract.supplierOrgId)) {
        return res.status(403).json({ message: "Not authorized to view this contract" });
      }

      const milestones = await storage.getMilestonesByContract(id);
      res.json({ ...contract, milestones });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/procurement/contracts/:id/status", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const contract = await storage.getContractById(id);
      if (!contract) return res.status(404).json({ message: "Contract not found" });

      const isBuyer = !!(await getUserOrgMembership(userId, contract.buyerOrgId));
      const isSupplier = !!(await getUserOrgMembership(userId, contract.supplierOrgId));
      if (!isBuyer && !isSupplier) return res.status(403).json({ message: "Not authorized" });

      const { status } = z.object({
        status: z.enum(["in_progress", "delivered", "completed", "disputed", "cancelled"]),
      }).parse(req.body);

      if (status === "completed" && !isBuyer) {
        return res.status(403).json({ message: "Only the buyer can mark a contract as completed" });
      }

      const updated = await storage.updateContractStatus(id, status);
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/procurement/contracts/:id/milestones", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const contractId = parseInt(req.params.id);
      const contract = await storage.getContractById(contractId);
      if (!contract) return res.status(404).json({ message: "Contract not found" });

      const isBuyer = !!(await getUserOrgMembership(userId, contract.buyerOrgId));
      if (!isBuyer) return res.status(403).json({ message: "Only the buyer can add milestones" });

      const data = z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        amount: z.number(),
        dueDate: z.string().optional(),
        sortOrder: z.number().default(0),
      }).parse(req.body);

      const milestone = await storage.createMilestone({
        contractId,
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        status: "pending",
      });
      res.status(201).json(milestone);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/procurement/contracts/:id/milestones/:milestoneId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const contractId = parseInt(req.params.id);
      const milestoneId = parseInt(req.params.milestoneId);
      const contract = await storage.getContractById(contractId);
      if (!contract) return res.status(404).json({ message: "Contract not found" });

      const isBuyer = !!(await getUserOrgMembership(userId, contract.buyerOrgId));
      const isSupplier = !!(await getUserOrgMembership(userId, contract.supplierOrgId));
      if (!isBuyer && !isSupplier) return res.status(403).json({ message: "Not authorized" });

      const milestones = await storage.getMilestonesByContract(contractId);
      const milestone = milestones.find(m => m.id === milestoneId);
      if (!milestone) return res.status(404).json({ message: "Milestone not found for this contract" });

      const data = z.object({
        status: z.enum(["pending", "in_progress", "submitted", "approved", "rejected"]).optional(),
        evidence: z.any().optional(),
      }).parse(req.body);

      if (data.status === "approved" && !isBuyer) {
        return res.status(403).json({ message: "Only the buyer can approve milestones" });
      }

      const updated = await storage.updateMilestoneStatus(milestoneId, data.status, data.evidence);
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/procurement/contracts/:id/invoices", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const contractId = parseInt(req.params.id);
      const contract = await storage.getContractById(contractId);
      if (!contract) return res.status(404).json({ message: "Contract not found" });

      const isSupplier = !!(await getUserOrgMembership(userId, contract.supplierOrgId));
      if (!isSupplier) return res.status(403).json({ message: "Only the supplier can create invoices" });

      const data = z.object({
        milestoneId: z.number().optional(),
        paymentTerms: z.string().optional(),
        bankDetails: z.string().optional(),
        notes: z.string().optional(),
        taxLabel: z.string().default("VAT"),
        taxAmount: z.number().default(0),
        dueDate: z.string().optional(),
        items: z.array(z.object({
          description: z.string().min(1),
          quantity: z.number().min(1).default(1),
          unitPrice: z.number(),
          unit: z.string().optional(),
        })),
      }).parse(req.body);

      const invoiceNumber = await storage.generateInvoiceNumber();
      const subtotal = data.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
      const totalAmount = subtotal + data.taxAmount;

      const invoice = await storage.createProcurementInvoice({
        invoiceNumber,
        contractId,
        milestoneId: data.milestoneId,
        supplierOrgId: contract.supplierOrgId,
        buyerOrgId: contract.buyerOrgId,
        issuedByUserId: userId,
        subtotal,
        taxAmount: data.taxAmount,
        totalAmount,
        currency: contract.currency,
        status: "draft",
        paymentTerms: data.paymentTerms,
        bankDetails: data.bankDetails,
        notes: data.notes,
        taxLabel: data.taxLabel,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      });

      for (const item of data.items) {
        await storage.createProcurementInvoiceItem({
          invoiceId: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.unitPrice * item.quantity,
          unit: item.unit,
        });
      }

      const result = await storage.getProcurementInvoiceById(invoice.id);
      res.status(201).json(result);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/procurement/invoices", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const role = req.query.role as string | undefined;
      const status = req.query.status as string | undefined;
      const memberships = await getUserOrgs(userId);
      const orgIds = memberships.map(m => m.orgId);

      let allInvoices: any[] = [];
      for (const orgId of orgIds) {
        if (!role || role === "supplier") {
          const invoices = await storage.getProcurementInvoicesBySupplierOrg(orgId);
          allInvoices = allInvoices.concat(invoices.map(i => ({ ...i, userRole: "supplier" })));
        }
        if (!role || role === "buyer") {
          const invoices = await storage.getProcurementInvoicesByBuyerOrg(orgId);
          allInvoices = allInvoices.concat(invoices.map(i => ({ ...i, userRole: "buyer" })));
        }
      }

      const seen = new Set<number>();
      allInvoices = allInvoices.filter(i => {
        if (seen.has(i.id)) return false;
        seen.add(i.id);
        return true;
      });
      if (status) allInvoices = allInvoices.filter(i => i.status === status);
      allInvoices.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
      res.json(allInvoices);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/procurement/invoices/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const invoice = await storage.getProcurementInvoiceById(id);
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });

      const memberships = await getUserOrgs(userId);
      const orgIds = new Set(memberships.map(m => m.orgId));
      if (!orgIds.has(invoice.supplierOrgId) && !orgIds.has(invoice.buyerOrgId)) {
        return res.status(403).json({ message: "Not authorized to view this invoice" });
      }

      const items = await storage.getProcurementInvoiceItems(id);
      res.json({ ...invoice, items });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/procurement/invoices/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const invoice = await storage.getProcurementInvoiceById(id);
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });
      if (invoice.status !== "draft") return res.status(400).json({ message: "Can only edit draft invoices" });

      const member = await getUserOrgMembership(userId, invoice.supplierOrgId);
      if (!member) return res.status(403).json({ message: "Not authorized" });

      const data = z.object({
        paymentTerms: z.string().optional(),
        bankDetails: z.string().optional(),
        notes: z.string().optional(),
        taxLabel: z.string().optional(),
        taxAmount: z.number().optional(),
        dueDate: z.string().optional(),
      }).parse(req.body);

      const updated = await storage.updateProcurementInvoice(id, {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        totalAmount: data.taxAmount !== undefined ? invoice.subtotal + data.taxAmount : undefined,
      });
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/procurement/invoices/:id/send", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const invoice = await storage.getProcurementInvoiceById(id);
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });
      if (invoice.status !== "draft") return res.status(400).json({ message: "Invoice already sent" });

      const member = await getUserOrgMembership(userId, invoice.supplierOrgId);
      if (!member) return res.status(403).json({ message: "Not authorized" });

      const updated = await storage.updateProcurementInvoiceStatus(id, "sent");

      const buyerMembers = await db.select().from(kycOrgMembers)
        .where(and(eq(kycOrgMembers.orgId, invoice.buyerOrgId), eq(kycOrgMembers.inviteStatus, "accepted")));
      for (const m of buyerMembers) {
        await storage.createNotification({
          userId: m.userId,
          title: "Invoice Received",
          message: `Invoice ${invoice.invoiceNumber} has been received`,
          type: "info",
          linkUrl: `/procurement/invoices/${id}`,
        });
      }

      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/procurement/invoices/:id/mark-paid", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const invoice = await storage.getProcurementInvoiceById(id);
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });

      const member = await getUserOrgMembership(userId, invoice.buyerOrgId);
      if (!member) return res.status(403).json({ message: "Only the buyer can mark invoices as paid" });

      const updated = await storage.updateProcurementInvoiceStatus(id, "paid");

      const supplierMembers = await db.select().from(kycOrgMembers)
        .where(and(eq(kycOrgMembers.orgId, invoice.supplierOrgId), eq(kycOrgMembers.inviteStatus, "accepted")));
      for (const m of supplierMembers) {
        await storage.createNotification({
          userId: m.userId,
          title: "Invoice Paid",
          message: `Invoice ${invoice.invoiceNumber} has been marked as paid`,
          type: "success",
          linkUrl: `/procurement/invoices/${id}`,
        });
      }

      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/procurement/invoices/:id/pdf", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const invoice = await storage.getProcurementInvoiceById(id);
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });

      const memberships = await getUserOrgs(userId);
      const orgIds = new Set(memberships.map(m => m.orgId));
      if (!orgIds.has(invoice.supplierOrgId) && !orgIds.has(invoice.buyerOrgId)) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const items = await storage.getProcurementInvoiceItems(id);

      const formatAmount = (amount: number) => {
        return new Intl.NumberFormat("en-NG", { style: "currency", currency: invoice.currency || "NGN" }).format(amount / 100);
      };

      const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Invoice ${invoice.invoiceNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .invoice-title { font-size: 32px; font-weight: 700; color: #16a34a; }
  .invoice-meta { text-align: right; font-size: 14px; color: #666; }
  .invoice-meta strong { color: #1a1a1a; }
  .parties { display: flex; justify-content: space-between; margin-bottom: 30px; }
  .party { width: 48%; }
  .party h3 { font-size: 12px; text-transform: uppercase; color: #999; margin-bottom: 8px; }
  .party p { font-size: 14px; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  th { background: #f8f9fa; text-align: left; padding: 12px; font-size: 12px; text-transform: uppercase; color: #666; border-bottom: 2px solid #e5e7eb; }
  td { padding: 12px; font-size: 14px; border-bottom: 1px solid #e5e7eb; }
  td.right, th.right { text-align: right; }
  .totals { text-align: right; margin-bottom: 30px; }
  .totals .row { display: flex; justify-content: flex-end; gap: 40px; padding: 6px 0; font-size: 14px; }
  .totals .total-row { font-size: 18px; font-weight: 700; border-top: 2px solid #1a1a1a; padding-top: 10px; margin-top: 4px; }
  .bank-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
  .bank-details h3 { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
  .bank-details p { font-size: 14px; white-space: pre-line; }
  .notes { font-size: 13px; color: #666; margin-top: 20px; }
  .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #999; }
  @media print { body { padding: 20px; } .no-print { display: none; } }
</style></head><body>
<div class="header">
  <div><div class="invoice-title">INVOICE</div><div style="font-size:14px;color:#666;margin-top:4px;">${invoice.invoiceNumber}</div></div>
  <div class="invoice-meta">
    <p><strong>Date:</strong> ${new Date(invoice.createdAt!).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })}</p>
    ${invoice.dueDate ? `<p><strong>Due:</strong> ${new Date(invoice.dueDate).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })}</p>` : ""}
    ${invoice.paymentTerms ? `<p><strong>Terms:</strong> ${invoice.paymentTerms}</p>` : ""}
    <p><strong>Status:</strong> ${invoice.status?.toUpperCase()}</p>
  </div>
</div>
<div class="parties">
  <div class="party"><h3>From</h3><p><strong>Supplier Org #${invoice.supplierOrgId}</strong></p></div>
  <div class="party"><h3>To</h3><p><strong>Buyer Org #${invoice.buyerOrgId}</strong></p></div>
</div>
<table>
  <thead><tr><th>Description</th><th class="right">Qty</th><th class="right">Unit Price</th><th class="right">Subtotal</th></tr></thead>
  <tbody>
    ${items.map(item => `<tr><td>${item.description}${item.unit ? ` (${item.unit})` : ""}</td><td class="right">${item.quantity}</td><td class="right">${formatAmount(item.unitPrice)}</td><td class="right">${formatAmount(item.subtotal)}</td></tr>`).join("")}
  </tbody>
</table>
<div class="totals">
  <div class="row"><span>Subtotal:</span><span>${formatAmount(invoice.subtotal)}</span></div>
  <div class="row"><span>${invoice.taxLabel || "VAT"}:</span><span>${formatAmount(invoice.taxAmount)}</span></div>
  <div class="row total-row"><span>Total:</span><span>${formatAmount(invoice.totalAmount)}</span></div>
</div>
${invoice.bankDetails ? `<div class="bank-details"><h3>Payment Details</h3><p>${invoice.bankDetails}</p></div>` : ""}
${invoice.notes ? `<div class="notes"><strong>Notes:</strong> ${invoice.notes}</div>` : ""}
<div class="footer"><p>Generated by Cellion One</p></div>
<div class="no-print" style="text-align:center;margin-top:30px;"><button onclick="window.print()" style="padding:10px 24px;background:#16a34a;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;">Print / Save as PDF</button></div>
</body></html>`;

      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/procurement/contracts/:id/escrow/fund", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const flag = await storage.getFeatureFlag("enable_escrow_payments");
      if (!flag?.isEnabled) {
        return res.status(200).json({
          enabled: false,
          message: "Secure escrow payments coming soon.",
        });
      }

      const userId = getUserId(req);
      const contractId = parseInt(req.params.id);
      const contract = await storage.getContractById(contractId);
      if (!contract) return res.status(404).json({ message: "Contract not found" });

      const isBuyer = !!(await getUserOrgMembership(userId, contract.buyerOrgId));
      if (!isBuyer) return res.status(403).json({ message: "Only the buyer can fund escrow" });

      const { milestoneId, amount } = z.object({
        milestoneId: z.number().optional(),
        amount: z.number().positive(),
      }).parse(req.body);

      // Generate Paystack reference
      const crypto = await import("crypto");
      const paystackRef = `co_esc_proc_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

      // Calculate Cellion service fee (with bank custody fee carve-out if a partner is active)
      const activeBankPartner = await storage.getActiveBankPartner();
      const { serviceFee, bankCustodyFee, bankPartnerId, totalCharged } = calculateEscrowFee(amount, activeBankPartner);

      // Create escrow record — store principal, fee breakdown, and total buyer charge
      const escrow = await storage.createEscrowTransaction({
        contractId,
        milestoneId,
        amount,
        serviceFee,
        bankCustodyFee,
        bankPartnerId,
        totalCharged,
        currency: contract.currency || "NGN",
        status: "pending",
        buyerOrgId: contract.buyerOrgId,
        supplierOrgId: contract.supplierOrgId,
        paystackReference: paystackRef,
      });

      // Initialize Paystack payment — buyer pays principal + service fee (unchanged regardless of bank partner)
      const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_TEST_SECRET_KEY;
      if (!PAYSTACK_SECRET) throw new Error("Paystack key not configured");

      const user = await storage.getUser(userId);
      if (!user?.email) throw new Error("User email required for payment");

      const baseUrl = req.headers.origin || `https://${process.env.REPLIT_DEV_DOMAIN || req.hostname}`;
      const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          amount: totalCharged, // principal + Cellion service fee
          reference: paystackRef,
          callback_url: `${baseUrl}/procurement/contracts/${contractId}?escrow_funded=1`,
          metadata: {
            type: "procurement_escrow",
            escrowId: escrow.id,
            contractId,
            principalAmount: amount,
            serviceFee,
            bankCustodyFee,
            bankPartnerId,
          },
        }),
      });

      const paystackData = await paystackRes.json() as any;
      if (!paystackData.status) {
        throw new Error(paystackData.message || "Paystack initialization failed");
      }

      const paymentUrl = paystackData.data.authorization_url;

      // Store payment URL
      await storage.updateEscrowPaymentUrl(escrow.id, paymentUrl);

      res.status(201).json({
        ...escrow,
        serviceFee,
        bankCustodyFee,
        bankPartnerId,
        totalCharged,
        paystackPaymentUrl: paymentUrl,
        paystackReference: paystackRef,
      });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/procurement/contracts/:id/escrow", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const contractId = parseInt(req.params.id);
      const contract = await storage.getContractById(contractId);
      if (!contract) return res.status(404).json({ message: "Contract not found" });

      const memberships = await getUserOrgs(userId);
      const orgIds = new Set(memberships.map(m => m.orgId));
      if (!orgIds.has(contract.buyerOrgId) && !orgIds.has(contract.supplierOrgId)) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const flag = await storage.getFeatureFlag("enable_escrow_payments");
      const escrowTxs = await storage.getEscrowByContract(contractId);
      res.json({ enabled: flag?.isEnabled || false, transactions: escrowTxs });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/procurement/contracts/:id/escrow/release", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const flag = await storage.getFeatureFlag("enable_escrow_payments");
      if (!flag?.isEnabled) {
        return res.status(200).json({ enabled: false, message: "Escrow payments not yet enabled" });
      }

      const userId = getUserId(req);
      const contractId = parseInt(req.params.id);
      const contract = await storage.getContractById(contractId);
      if (!contract) return res.status(404).json({ message: "Contract not found" });

      const isBuyer = !!(await getUserOrgMembership(userId, contract.buyerOrgId));
      if (!isBuyer) return res.status(403).json({ message: "Only the buyer can release escrow" });

      const { escrowId } = z.object({ escrowId: z.number() }).parse(req.body);
      const escrowTxs = await storage.getEscrowByContract(contractId);
      const escrowTx = escrowTxs.find(e => e.id === escrowId);
      if (!escrowTx) return res.status(404).json({ message: "Escrow transaction not found for this contract" });
      if (escrowTx.status !== "funded") return res.status(400).json({ message: "Only funded escrow can be released" });

      const updated = await storage.updateEscrowStatus(escrowId, "released");
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/procurement/contracts/:id/escrow/dispute", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const flag = await storage.getFeatureFlag("enable_escrow_payments");
      if (!flag?.isEnabled) {
        return res.status(200).json({ enabled: false, message: "Escrow payments not yet enabled" });
      }

      const userId = getUserId(req);
      const contractId = parseInt(req.params.id);
      const contract = await storage.getContractById(contractId);
      if (!contract) return res.status(404).json({ message: "Contract not found" });

      const memberships = await getUserOrgs(userId);
      const orgIds = new Set(memberships.map(m => m.orgId));
      if (!orgIds.has(contract.buyerOrgId) && !orgIds.has(contract.supplierOrgId)) {
        return res.status(403).json({ message: "Not authorized to dispute this escrow" });
      }

      const { escrowId, reason } = z.object({
        escrowId: z.number(),
        reason: z.string().min(10, "Please provide a detailed reason (at least 10 characters)"),
      }).parse(req.body);

      const escrowTxs = await storage.getEscrowByContract(contractId);
      const escrowTx = escrowTxs.find(e => e.id === escrowId);
      if (!escrowTx) return res.status(404).json({ message: "Escrow transaction not found" });
      if (!["funded", "pending"].includes(escrowTx.status)) {
        return res.status(400).json({ message: "Only funded or pending escrow can be disputed" });
      }

      const updated = await storage.updateEscrowDisputed(escrowId, reason);
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  console.log("[Procurement] Routes registered");
}
