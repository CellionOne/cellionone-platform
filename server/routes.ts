import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import OpenAI from "openai";
import crypto from "crypto";
import { z } from "zod";
import { insertCompanyApplicationSchema, insertClarificationRequestSchema } from "@shared/schema";

// Validation schemas
const createApplicationSchema = insertCompanyApplicationSchema.pick({
  applicationType: true,
  companyType: true,
  companyName1: true,
  companyName2: true,
  companyName3: true,
  businessDescription: true,
  registeredAddress: true,
});

const updateApplicationSchema = insertCompanyApplicationSchema.partial();

const assignLawyerSchema = z.object({
  lawyerId: z.string().min(1, "Lawyer ID is required"),
});

const roleChangeSchema = z.object({
  role: z.enum(["lawyer", "admin"]),
  action: z.enum(["add", "remove"]),
});

const featureFlagUpdateSchema = z.object({
  isEnabled: z.boolean(),
});

const statusUpdateSchema = z.object({
  status: z.enum([
    "draft", "submitted", "under_review", "clarification_requested",
    "filed", "pending_originals", "courier_in_transit", "completed", "rejected"
  ]),
});

const aiSuggestSchema = z.object({
  businessDescription: z.string().min(1, "Business description required"),
  companyType: z.string().optional(),
});

// Lazy initialization of OpenAI to avoid startup errors
let openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

// Helper to get user ID from session
function getUserId(req: any): string {
  return req.user?.claims?.sub;
}

// Helper to get user roles
async function getUserRoles(userId: string): Promise<string[]> {
  return storage.getUserRoles(userId);
}

// Middleware to check for specific role
function requireRole(...requiredRoles: string[]) {
  return async (req: any, res: any, next: any) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const userRoles = await getUserRoles(userId);
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));
    
    if (!hasRequiredRole) {
      return res.status(403).json({ message: "Forbidden: requires one of [" + requiredRoles.join(", ") + "]" });
    }
    
    next();
  };
}

// Create default checklist items for new application
async function createDefaultChecklist(applicationId: number) {
  const items = [
    { key: "passport_photo", label: "Passport Photograph", required: true },
    { key: "id_document", label: "Government ID (NIN, Passport, or Driver's License)", required: true },
    { key: "address_proof", label: "Proof of Address", required: true },
    { key: "director_id", label: "Director's ID Document", required: true },
    { key: "shareholder_details", label: "Shareholder Information Form", required: true },
  ];
  
  for (const item of items) {
    await storage.createChecklistItem({
      applicationId,
      ...item,
      status: "missing",
    });
  }
}

// Seed default feature flags
async function seedFeatureFlags() {
  const defaultFlags = [
    { key: "enable_tin_registration", description: "Enable TIN registration feature", isEnabled: false },
    { key: "enable_bank_referrals", description: "Enable bank account opening referrals", isEnabled: false },
    { key: "enable_registered_address_service", description: "Enable virtual registered address service", isEnabled: false },
    { key: "enable_mail_forwarding", description: "Enable mail forwarding for virtual addresses", isEnabled: false },
    { key: "enable_compliance_reminders", description: "Send automated compliance deadline reminders", isEnabled: false },
  ];
  
  for (const flag of defaultFlags) {
    const existing = await storage.getFeatureFlag(flag.key);
    if (!existing) {
      await storage.upsertFeatureFlag(flag);
    }
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication
  await setupAuth(app);
  registerAuthRoutes(app);
  
  // Seed feature flags
  await seedFeatureFlags();

  // ============== AUTH ROUTES ==============
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      const roles = await getUserRoles(userId);
      res.json({ ...user, roles });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ============== FOUNDER ROUTES ==============
  app.get("/api/founder/dashboard", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const [applications, identity, stats] = await Promise.all([
        storage.getApplicationsByFounder(userId),
        storage.getIdentityVerification(userId),
        storage.getFounderStats(userId),
      ]);
      res.json({ applications, identity, stats });
    } catch (error) {
      console.error("Error fetching founder dashboard:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  app.get("/api/founder/applications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const applications = await storage.getApplicationsByFounder(userId);
      res.json(applications);
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.get("/api/founder/identity", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const verification = await storage.getIdentityVerification(userId);
      res.json(verification || null);
    } catch (error) {
      console.error("Error fetching identity verification:", error);
      res.status(500).json({ message: "Failed to fetch identity verification" });
    }
  });

  app.post("/api/founder/identity/upload", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const verification = await storage.upsertIdentityVerification({
        founderUserId: userId,
        status: "pending",
        method: "manual",
      });
      
      await storage.createAuditLog({
        actorUserId: userId,
        action: "upload_document",
        entityType: "identity_verification",
        entityId: verification.id.toString(),
        ipAddress: req.ip,
      });
      
      res.json(verification);
    } catch (error) {
      console.error("Error uploading identity docs:", error);
      res.status(500).json({ message: "Failed to upload documents" });
    }
  });

  app.get("/api/founder/vault", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const [applications, documents] = await Promise.all([
        storage.getApplicationsByFounder(userId),
        storage.getDocumentsByUser(userId),
      ]);
      res.json({ applications, documents });
    } catch (error) {
      console.error("Error fetching vault:", error);
      res.status(500).json({ message: "Failed to fetch vault" });
    }
  });

  // ============== APPLICATION ROUTES ==============
  app.get("/api/applications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const applicationId = parseInt(req.params.id);
      
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      // Check ownership or assigned lawyer
      const roles = await getUserRoles(userId);
      const isOwner = application.founderUserId === userId;
      const isAssignedLawyer = application.assignedLawyerUserId === userId;
      const isAdmin = roles.includes("admin");
      
      if (!isOwner && !isAssignedLawyer && !isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const [checklist, payment, clarifications] = await Promise.all([
        storage.getChecklistItems(applicationId),
        storage.getPaymentByApplication(applicationId),
        storage.getClarificationsByApplication(applicationId),
      ]);
      
      res.json({ application, checklist, payment, clarifications });
    } catch (error) {
      console.error("Error fetching application:", error);
      res.status(500).json({ message: "Failed to fetch application" });
    }
  });

  app.post("/api/applications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      // Validate request body
      const parsed = createApplicationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }
      
      const { applicationType, companyType, companyName1, companyName2, companyName3, businessDescription, registeredAddress } = parsed.data;
      
      const application = await storage.createApplication({
        founderUserId: userId,
        applicationType: applicationType || "incorporation",
        companyType,
        companyName1,
        companyName2,
        companyName3,
        businessDescription,
        registeredAddress,
        status: "draft",
      });
      
      await createDefaultChecklist(application.id);
      
      await storage.createAuditLog({
        actorUserId: userId,
        action: "create_application",
        entityType: "company_application",
        entityId: application.id.toString(),
        ipAddress: req.ip,
      });
      
      res.json(application);
    } catch (error) {
      console.error("Error creating application:", error);
      res.status(500).json({ message: "Failed to create application" });
    }
  });

  app.patch("/api/applications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const applicationId = parseInt(req.params.id);
      
      // Validate request body
      const parsed = updateApplicationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }
      
      const application = await storage.getApplication(applicationId);
      if (!application || application.founderUserId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updated = await storage.updateApplication(applicationId, parsed.data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating application:", error);
      res.status(500).json({ message: "Failed to update application" });
    }
  });

  app.post("/api/applications/:id/submit", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const applicationId = parseInt(req.params.id);
      
      const application = await storage.getApplication(applicationId);
      if (!application || application.founderUserId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      if (application.status !== "draft") {
        return res.status(400).json({ message: "Application already submitted" });
      }
      
      const updated = await storage.updateApplication(applicationId, {
        status: "submitted",
        submittedAt: new Date(),
      });
      
      await storage.createAuditLog({
        actorUserId: userId,
        action: "submit_application",
        entityType: "company_application",
        entityId: applicationId.toString(),
        ipAddress: req.ip,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error submitting application:", error);
      res.status(500).json({ message: "Failed to submit application" });
    }
  });

  app.post("/api/applications/:id/documents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const applicationId = parseInt(req.params.id);
      const { checklistItemId } = req.body;
      
      const application = await storage.getApplication(applicationId);
      if (!application || application.founderUserId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Update checklist item status
      await storage.updateChecklistItem(parseInt(checklistItemId), {
        status: "provided",
      });
      
      // Create document record
      const document = await storage.createDocument({
        ownerUserId: userId,
        applicationId,
        category: "company",
        docType: "uploaded_document",
        filename: "uploaded_file",
        storagePath: `/uploads/${applicationId}/${Date.now()}`,
        isSensitive: true,
      });
      
      await storage.createAuditLog({
        actorUserId: userId,
        action: "upload_document",
        entityType: "document_file",
        entityId: document.id.toString(),
        ipAddress: req.ip,
      });
      
      res.json(document);
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  // ============== LEGAL AI ROUTES ==============
  app.post("/api/legal-ai/suggest-activities", isAuthenticated, async (req: any, res) => {
    try {
      // Validate request body
      const parsed = aiSuggestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }
      
      const { businessDescription, companyType } = parsed.data;
      
      const ai = getOpenAI();
      if (!ai) {
        return res.json({ 
          suggestions: [
            { activity: "General trading and merchandise", category: "Trading" },
            { activity: "Import and export of goods", category: "Trading" },
            { activity: "Consultancy services", category: "Services" },
            { activity: "Business management services", category: "Services" },
          ],
          message: "AI suggestions temporarily unavailable. Default suggestions provided."
        });
      }
      
      const response = await ai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a Nigerian legal expert specializing in company registration with the Corporate Affairs Commission (CAC). 
Given a business description, suggest appropriate CAC activities/objects that should be registered. 
Provide 5-8 specific activities that are commonly accepted by CAC.
Format: Return a JSON object with a "suggestions" key containing an array of objects with "activity" and "category" fields.
Example: {"suggestions": [{"activity": "General trading and merchandise", "category": "Trading"}]}`
          },
          {
            role: "user",
            content: `Business description: ${businessDescription}\nCompany type: ${companyType || "LLC"}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 500,
      });
      
      const content = response.choices[0]?.message?.content;
      let suggestions: Array<{ activity: string; category: string }> = [];
      
      if (content) {
        try {
          const aiResponse = JSON.parse(content);
          suggestions = aiResponse.suggestions || aiResponse.activities || [];
        } catch {
          suggestions = [];
        }
      }
      
      res.json({ suggestions });
    } catch (error) {
      console.error("Error getting AI suggestions:", error);
      res.status(500).json({ message: "Failed to get AI suggestions", suggestions: [] });
    }
  });

  // ============== PAYMENT ROUTES ==============
  app.post("/api/payments/initiate/:applicationId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const applicationId = parseInt(req.params.applicationId);
      
      const application = await storage.getApplication(applicationId);
      if (!application || application.founderUserId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Check for existing payment
      let payment = await storage.getPaymentByApplication(applicationId);
      
      if (!payment) {
        // Create new payment (₦150,000 = 15,000,000 kobo for LLC incorporation)
        payment = await storage.createPayment({
          applicationId,
          amountTotalKobo: 15000000,
          currency: "NGN",
          provider: "paystack",
          status: "initialized",
          breakdownJson: {
            platformFee: 5000000,
            lawyerFee: 7500000,
            governmentFee: 2000000,
            courierFee: 500000,
          },
        });
      }
      
      // In production, integrate with Paystack API here
      // For now, return mock authorization URL
      const reference = `celion_${applicationId}_${Date.now()}`;
      await storage.updatePayment(payment.id, { paystackReference: reference });
      
      res.json({
        paymentId: payment.id,
        amount: payment.amountTotalKobo,
        reference,
        authorizationUrl: `/api/payments/mock-callback?reference=${reference}`,
      });
    } catch (error) {
      console.error("Error initiating payment:", error);
      res.status(500).json({ message: "Failed to initiate payment" });
    }
  });

  app.get("/api/payments/mock-callback", async (req: any, res) => {
    try {
      const { reference } = req.query;
      
      // Find payment by reference and mark as successful
      // In production, verify with Paystack webhook
      const allApps = await storage.getAllApplications();
      for (const app of allApps) {
        const payment = await storage.getPaymentByApplication(app.id);
        if (payment?.paystackReference === reference) {
          await storage.updatePayment(payment.id, {
            status: "success",
            paidAt: new Date(),
          });
          break;
        }
      }
      
      res.redirect("/founder/applications");
    } catch (error) {
      console.error("Error processing payment callback:", error);
      res.redirect("/founder/applications?payment=failed");
    }
  });

  // ============== LAWYER ROUTES ==============
  app.get("/api/lawyer/dashboard", isAuthenticated, requireRole("lawyer"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const [applications, stats] = await Promise.all([
        storage.getApplicationsByLawyer(userId),
        storage.getLawyerStats(userId),
      ]);
      res.json({ applications, stats });
    } catch (error) {
      console.error("Error fetching lawyer dashboard:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  app.get("/api/lawyer/applications", isAuthenticated, requireRole("lawyer"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const applications = await storage.getApplicationsByLawyer(userId);
      res.json(applications);
    } catch (error) {
      console.error("Error fetching lawyer applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.get("/api/lawyer/payouts", isAuthenticated, requireRole("lawyer"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const payouts = await storage.getPayoutsByLawyer(userId);
      
      const stats = {
        totalEarned: payouts.reduce((sum, p) => sum + p.amountKobo, 0),
        pending: payouts.filter(p => p.status === "pending").reduce((sum, p) => sum + p.amountKobo, 0),
        sent: payouts.filter(p => p.status === "sent").reduce((sum, p) => sum + p.amountKobo, 0),
      };
      
      res.json({ payouts, stats });
    } catch (error) {
      console.error("Error fetching payouts:", error);
      res.status(500).json({ message: "Failed to fetch payouts" });
    }
  });

  app.post("/api/lawyer/applications/:id/status", isAuthenticated, requireRole("lawyer"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const applicationId = parseInt(req.params.id);
      
      // Validate request body
      const parsed = statusUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }
      
      const { status } = parsed.data;
      
      const application = await storage.getApplication(applicationId);
      if (!application || application.assignedLawyerUserId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updated = await storage.updateApplication(applicationId, { status });
      
      await storage.createAuditLog({
        actorUserId: userId,
        action: "change_status",
        entityType: "company_application",
        entityId: applicationId.toString(),
        details: { newStatus: status },
        ipAddress: req.ip,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating status:", error);
      res.status(500).json({ message: "Failed to update status" });
    }
  });

  // ============== ADMIN ROUTES ==============
  app.get("/api/admin/dashboard", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json({ stats, recentActivity: [] });
    } catch (error) {
      console.error("Error fetching admin dashboard:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  app.get("/api/admin/users", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const usersWithRoles = await Promise.all(
        allUsers.map(async (user) => ({
          ...user,
          roles: await storage.getUserRoles(user.id),
        }))
      );
      res.json(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/users/:userId/roles", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Validate request body
      const parsed = roleChangeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }
      
      const { role, action } = parsed.data;
      const adminId = getUserId(req);
      
      if (action === "add") {
        await storage.addUserRole({ userId, role });
        
        // Create lawyer profile if adding lawyer role
        if (role === "lawyer") {
          await storage.upsertLawyerProfile({ userId, isActive: true });
        }
      } else if (action === "remove") {
        await storage.removeUserRole(userId, role);
      }
      
      await storage.createAuditLog({
        actorUserId: adminId,
        action: "admin_override",
        entityType: "user_role",
        entityId: userId,
        details: { role, action },
        ipAddress: req.ip,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.get("/api/admin/applications", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const applications = await storage.getAllApplications();
      
      // Add lawyer names
      const appsWithLawyers = await Promise.all(
        applications.map(async (app) => {
          if (app.assignedLawyerUserId) {
            const lawyer = await storage.getUser(app.assignedLawyerUserId);
            return { ...app, lawyerName: lawyer ? `${lawyer.firstName} ${lawyer.lastName}` : null };
          }
          return app;
        })
      );
      
      res.json(appsWithLawyers);
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.get("/api/admin/lawyers", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const lawyers = await storage.getActiveLawyers();
      
      const lawyersWithInfo = await Promise.all(
        lawyers.map(async (lawyer) => {
          const user = await storage.getUser(lawyer.userId);
          return {
            ...lawyer,
            email: user?.email,
            name: user ? `${user.firstName} ${user.lastName}` : null,
          };
        })
      );
      
      res.json(lawyersWithInfo);
    } catch (error) {
      console.error("Error fetching lawyers:", error);
      res.status(500).json({ message: "Failed to fetch lawyers" });
    }
  });

  app.post("/api/admin/applications/:id/assign", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const applicationId = parseInt(req.params.id);
      
      // Validate request body
      const parsed = assignLawyerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }
      
      const { lawyerId } = parsed.data;
      const adminId = getUserId(req);
      
      const updated = await storage.updateApplication(applicationId, {
        assignedLawyerUserId: lawyerId,
        status: "under_review",
      });
      
      await storage.createAuditLog({
        actorUserId: adminId,
        action: "admin_override",
        entityType: "company_application",
        entityId: applicationId.toString(),
        details: { assignedLawyerId: lawyerId },
        ipAddress: req.ip,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error assigning lawyer:", error);
      res.status(500).json({ message: "Failed to assign lawyer" });
    }
  });

  app.get("/api/admin/feature-flags", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const flags = await storage.getFeatureFlags();
      res.json(flags);
    } catch (error) {
      console.error("Error fetching feature flags:", error);
      res.status(500).json({ message: "Failed to fetch feature flags" });
    }
  });

  app.patch("/api/admin/feature-flags/:key", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const { key } = req.params;
      
      // Validate request body
      const parsed = featureFlagUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }
      
      const { isEnabled } = parsed.data;
      const adminId = getUserId(req);
      
      const updated = await storage.updateFeatureFlag(key, isEnabled);
      
      await storage.createAuditLog({
        actorUserId: adminId,
        action: "admin_override",
        entityType: "feature_flag",
        entityId: key,
        details: { isEnabled },
        ipAddress: req.ip,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating feature flag:", error);
      res.status(500).json({ message: "Failed to update feature flag" });
    }
  });

  app.get("/api/admin/audit-logs", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const logs = await storage.getAuditLogs(200);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  return httpServer;
}
