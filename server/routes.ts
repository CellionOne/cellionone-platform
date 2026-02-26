import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replit_integrations/auth";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";
import OpenAI from "openai";
import crypto from "crypto";
import { z } from "zod";
import { insertCompanyApplicationSchema, insertClarificationRequestSchema, insertLawyerApplicationSchema, legalChatConversations, legalChatMessages, companyProfiles, postIncorporationTasks, complianceDeadlines, orders as ordersTable, orderItems as orderItemsTable, orderPayments as orderPaymentsTable, serviceRequests as serviceRequestsTable, serviceRequestCompanyProfiles as srProfilesTable, serviceRequestDocuments as srDocumentsTable, users as usersTable, registeredOfficeSubscriptions, serviceAddresses, dataSharingConsents, dataSharingAccessLogs } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, asc } from "drizzle-orm";
import * as services from "./services";
import { registeredOfficeService } from "./services/registeredOfficeService";
import { mailroomService } from "./services/mailroomService";
import * as verificationService from "./services/verificationService";
import { registerKycServiceRoutes } from "./routes/kycServiceRoutes";

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
  role: z.enum(["lawyer", "admin", "building_manager"]),
  action: z.enum(["add", "remove"]),
});

const featureFlagUpdateSchema = z.object({
  isEnabled: z.boolean(),
});

const statusUpdateSchema = z.object({
  status: z.enum([
    "draft", "pending_verification", "submitted", "under_review", "clarification_requested",
    "filed", "pending_originals", "courier_in_transit", "completed", "rejected"
  ]),
});

const aiSuggestSchema = z.object({
  businessDescription: z.string().min(1, "Business description required"),
  companyType: z.string().optional(),
  applicationId: z.number().optional(),
});

// New validation schemas for enhancement features
const executionDeclarationSchema = z.object({
  declarationType: z.enum(["document_verified", "application_reviewed", "cac_filed", "originals_received"]),
});

const documentQualitySchema = z.object({
  qualityStatus: z.enum(["pass", "needs_attention", "rejected"]),
  qualityNotes: z.string().optional(),
});

const clarificationRequestSchema = z.object({
  subject: z.string().min(1, "Subject required"),
  body: z.string().min(1, "Body required"),
  useAiDraft: z.boolean().optional(),
});

const paymentTransitionSchema = z.object({
  targetState: z.enum(["released_to_lawyer", "refunded_partial", "refunded_full", "chargeback"]),
  refundAmountKobo: z.number().optional(),
  reason: z.string().optional(),
});

const receiptIssueSchema = z.object({
  applicationId: z.number(),
  transactionType: z.enum(["payment_received", "document_issued", "filing_completed"]),
  dataJson: z.record(z.any()).optional(),
});

const aiDraftSchema = z.object({
  category: z.enum(["missing_docs", "wrong_format", "info_mismatch", "legal_question"]).optional(),
  issue: z.string().min(1, "Issue description required"),
  existingDocuments: z.array(z.string()).optional(),
});

const lawyerApplicationReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().optional(),
});

// Registered Office validation schemas
const registeredOfficeSelectSchema = z.object({
  applicationId: z.number(),
  tier: z.enum(["office_only", "office_plus_mail"]),
});

const registeredOfficeSubscribeSchema = z.object({
  tier: z.enum(["office_only", "office_plus_mail"]),
});

const mailPreferencesSchema = z.object({
  subscriptionId: z.number(),
  preferenceType: z.enum(["scan_all", "approve_before_scan", "forward_only"]),
  isSensitiveAutoEscalationEnabled: z.boolean().optional(),
});

const mailIntakeSchema = z.object({
  subscriptionId: z.number(),
  senderName: z.string().min(1, "Sender name required"),
  senderType: z.string(),
  envelopePhotoDocId: z.number().optional(),
  isSensitive: z.boolean().optional(),
});

const mailApprovalDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  decisionReason: z.string().optional(),
});

const mailScanUploadSchema = z.object({
  scannedDocId: z.number(),
});

const mailForwardSchema = z.object({
  courierName: z.string().min(1, "Courier name required"),
  trackingNumber: z.string().min(1, "Tracking number required"),
});

const betaActivationSchema = z.object({
  reason: z.string().min(1, "Reason required"),
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
  // ============================================================
  // CRITICAL AUTH GUARD: Do NOT call registerAuthRoutes(app)
  // ============================================================
  // Cellion One implements its own /api/auth/user endpoint that returns
  // user roles. The default Replit Auth registerAuthRoutes() would
  // silently override this endpoint and break role-based routing.
  // This was a known production bug fixed on January 31, 2026.
  // ============================================================
  await setupAuth(app);
  console.log("Auth routes initialised – custom role-aware endpoint active");
  
  // Session timeout middleware (after auth initialization)
  const { sessionTimeout, validateFileUploadMiddleware } = await import("./middleware/security");
  app.use(sessionTimeout);
  console.log("[Security] Session timeout middleware enabled (30 min idle, 8 hour absolute)");
  
  // Setup object storage routes with file validation
  app.use("/api/uploads/request-url", validateFileUploadMiddleware);
  registerObjectStorageRoutes(app);
  
  // Seed feature flags
  await seedFeatureFlags();

  // ============== PUBLIC CONTACT FORM ==============
  const contactSchema = z.object({
    name: z.string().min(1, "Name is required").max(200),
    email: z.string().email("Valid email is required"),
    subject: z.enum(["General Inquiry", "Incorporation Help", "KYC/Verification", "Technical Support", "Other"]),
    message: z.string().min(10, "Message must be at least 10 characters").max(5000),
  });

  const rateLimit = (await import("express-rate-limit")).default;
  const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { message: "Too many requests. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  function escapeHtml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  app.post("/api/contact", contactLimiter, async (req: any, res) => {
    try {
      const parsed = contactSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors.map(e => e.message).join(", ") });
      }
      const { name, email, subject, message } = parsed.data;
      const safeName = escapeHtml(name);
      const safeEmail = escapeHtml(email);
      const safeMessage = escapeHtml(message);

      const { getResendClient, ADMIN_NOTIFICATION_EMAIL } = await import("./services/emailService");
      const { client, fromEmail } = await getResendClient();

      await client.emails.send({
        from: fromEmail,
        to: ADMIN_NOTIFICATION_EMAIL,
        subject: `[Contact Form] ${subject} - from ${safeName}`,
        replyTo: email,
        html: `
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
              <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="text-align: center; margin-bottom: 32px;">
                  <div style="display: inline-block; background: #16a34a; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                    <span style="color: white; font-size: 24px; font-weight: bold;">C</span>
                  </div>
                  <h1 style="color: #18181b; font-size: 24px; margin: 0;">Contact Form Submission</h1>
                </div>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 8px 0; color: #71717a; font-size: 14px; width: 100px;">Name</td><td style="padding: 8px 0; color: #18181b; font-size: 14px;">${safeName}</td></tr>
                  <tr><td style="padding: 8px 0; color: #71717a; font-size: 14px;">Email</td><td style="padding: 8px 0; color: #18181b; font-size: 14px;"><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
                  <tr><td style="padding: 8px 0; color: #71717a; font-size: 14px;">Subject</td><td style="padding: 8px 0; color: #18181b; font-size: 14px;">${subject}</td></tr>
                </table>
                <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 16px 0;">
                <p style="color: #18181b; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${safeMessage}</p>
                <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
                <p style="color: #a1a1aa; font-size: 12px; text-align: center;">&copy; ${new Date().getFullYear()} Cellion Platforms Nigeria Limited.</p>
              </div>
            </body>
          </html>
        `,
      });

      try {
        await client.emails.send({
          from: fromEmail,
          to: email,
          subject: "We received your message - Cellion One",
          html: `
            <!DOCTYPE html>
            <html>
              <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                  <div style="text-align: center; margin-bottom: 32px;">
                    <div style="display: inline-block; background: #16a34a; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                      <span style="color: white; font-size: 24px; font-weight: bold;">C</span>
                    </div>
                    <h1 style="color: #18181b; font-size: 24px; margin: 0;">Cellion One</h1>
                  </div>
                  <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">Thank you for contacting us, ${safeName}!</h2>
                  <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                    We have received your message regarding <strong>${subject}</strong> and our team will get back to you as soon as possible.
                  </p>
                  <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <p style="color: #166534; font-size: 14px; margin: 0;">Your message has been forwarded to our support team. We typically respond within 24 business hours.</p>
                  </div>
                  <p style="color: #71717a; font-size: 14px; line-height: 1.6;">
                    If your matter is urgent, you can also reach us directly at service@cellionone.com.
                  </p>
                  <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
                  <p style="color: #a1a1aa; font-size: 12px; text-align: center;">&copy; ${new Date().getFullYear()} Cellion Platforms Nigeria Limited. All rights reserved.</p>
                </div>
              </body>
            </html>
          `,
        });
      } catch (confirmationError: any) {
        console.error("[Contact] Confirmation email failed:", confirmationError);
      }

      res.json({ message: "Your message has been sent successfully." });
    } catch (error: any) {
      console.error("[Contact] Failed to send contact form:", error);
      res.status(500).json({ message: "Failed to send your message. Please try again or email us directly at service@cellionone.com." });
    }
  });

  // ============== AUTH ROUTES ==============
  // IMPORTANT: Do not register Replit default auth routes.
  // This endpoint must return role-aware user payloads.
  // Roles are fetched from database (single source of truth).
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      // Role is ONLY read from database - never inferred from claims/headers
      const roles = await getUserRoles(userId);
      if (!roles || roles.length === 0) {
        console.warn(`User ${userId} has no roles assigned`);
      }
      
      // Log login event (first auth check of session)
      // Use session to track if we've already logged this session
      if (!(req.session as any)._loginAuditLogged) {
        await storage.createAuditLog({
          actorUserId: userId,
          action: "login",
          entityType: "session",
          details: { email: user?.email },
          ipAddress: req.ip,
        });
        (req.session as any)._loginAuditLogged = true;
      }
      
      // Return user without sensitive fields
      const { passwordHash, verificationToken, verificationTokenExpiry, resetToken, resetTokenExpiry, ...safeUser } = user || {};
      res.json({ ...safeUser, roles });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ============== CUSTOM EMAIL/PASSWORD AUTH ROUTES ==============
  // These routes allow users to register and login with email/password
  // instead of using Replit Auth, removing third-party branding
  
  const authService = await import("./services/authService");
  const emailService = await import("./services/emailService");
  
  app.get("/api/admin/proposals/bank-partnership/html", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const { generateBankPartnershipProposalHTML } = await import("./templates/bank-partnership-proposal");
      const html = generateBankPartnershipProposalHTML();
      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (error: any) {
      console.error("Error generating proposal HTML:", error);
      res.status(500).json({ message: "Failed to generate proposal HTML", error: error.message });
    }
  });

  app.get("/api/admin/proposals/bank-partnership", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const { generateBankPartnershipProposalHTML } = await import("./templates/bank-partnership-proposal");
      const { generatePdf } = await import("./services/pdfService");
      const html = generateBankPartnershipProposalHTML();
      const pdfBuffer = await generatePdf(html, {
        format: 'A4',
        margin: { top: '40px', right: '50px', bottom: '40px', left: '50px' },
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="Cellion_One_Bank_Partnership_Proposal.pdf"');
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("Error generating proposal PDF:", error);
      const htmlUrl = "/api/admin/proposals/bank-partnership/html";
      res.status(500).json({ message: "Failed to generate PDF. You can view the proposal as HTML instead.", htmlUrl });
    }
  });

  // Debug endpoint to test email sending (temporary)
  app.get("/api/test-email", async (req, res) => {
    try {
      const testEmail = req.query.email as string || "test@example.com";
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      
      console.log(`[Test] Attempting to send test email to: ${testEmail}`);
      const result = await emailService.sendVerificationEmail(testEmail, "test-token-123", baseUrl);
      console.log(`[Test] Email result:`, JSON.stringify(result));
      
      res.json({ success: true, result });
    } catch (error: any) {
      console.error(`[Test] Email error:`, error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        details: error.toString()
      });
    }
  });
  
  app.get("/api/invites/:token", async (req: any, res) => {
    try {
      const { token } = req.params;
      if (!token) return res.status(400).json({ message: "Token is required" });

      const person = await storage.getCompanyPersonByInviteToken(token);
      if (!person) {
        return res.status(404).json({ message: "Invalid or expired invitation" });
      }

      const founder = await storage.getUser(person.founderId);

      res.json({
        id: person.id,
        role: person.role,
        inviteEmail: person.inviteEmail,
        inviteStatus: person.inviteStatus,
        founderName: founder ? `${founder.firstName || ''} ${founder.lastName || ''}`.trim() : 'A founder',
        title: person.title,
      });
    } catch (error) {
      console.error("Error looking up invite:", error);
      res.status(500).json({ message: "Failed to look up invitation" });
    }
  });

  // Register a new user with email/password
  app.post("/api/auth/register", async (req: any, res) => {
    try {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const result = await authService.registerUser(req.body, baseUrl);
      
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      
      res.json({ message: result.message, user: result.user });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed. Please try again." });
    }
  });
  
  // Login with email/password
  app.post("/api/auth/login", async (req: any, res) => {
    try {
      const { checkAccountLockout, recordFailedAttempt, recordSuccessfulLogin } = await import("./services/accountLockoutService");
      
      // Use email as identifier for lockout tracking
      const email = req.body?.email?.toLowerCase();
      const lockoutIdentifier = email || req.ip;
      
      // Check if account is locked
      const lockoutStatus = checkAccountLockout(lockoutIdentifier);
      if (lockoutStatus.isLocked) {
        await storage.createAuditLog({
          action: "login_blocked_lockout",
          entityType: "session",
          details: { 
            email, 
            minutesRemaining: lockoutStatus.lockoutMinutesRemaining,
            reason: "account_locked" 
          },
          ipAddress: req.ip,
        });
        
        return res.status(429).json({ 
          message: `Account temporarily locked due to too many failed attempts. Please try again in ${lockoutStatus.lockoutMinutesRemaining} minutes.`,
          lockedUntil: lockoutStatus.lockoutUntil,
          minutesRemaining: lockoutStatus.lockoutMinutesRemaining,
        });
      }
      
      const result = await authService.loginUser(req.body);
      
      if (!result.success) {
        // Record failed attempt
        const updatedLockout = recordFailedAttempt(lockoutIdentifier);
        
        await storage.createAuditLog({
          action: "login_failed",
          entityType: "session",
          details: { 
            email, 
            reason: result.message,
            attemptsRemaining: updatedLockout.remainingAttempts,
          },
          ipAddress: req.ip,
        });
        
        const status = result.requiresVerification ? 403 : 401;
        const response: any = { 
          message: result.message, 
          requiresVerification: result.requiresVerification 
        };
        
        // Warn user about remaining attempts
        if (updatedLockout.remainingAttempts <= 2 && updatedLockout.remainingAttempts > 0) {
          response.warning = `Warning: ${updatedLockout.remainingAttempts} attempt(s) remaining before account lockout.`;
        }
        
        if (updatedLockout.isLocked) {
          response.message = `Account locked for ${updatedLockout.lockoutMinutesRemaining} minutes due to too many failed attempts.`;
          return res.status(429).json(response);
        }
        
        return res.status(status).json(response);
      }
      
      // Record successful login (clears lockout)
      recordSuccessfulLogin(lockoutIdentifier);
      
      const user = result.user;

      if (user.twoFactorEnabled && user.twoFactorPhone) {
        const twoFactorSvc = await import("./services/twoFactorService");
        await twoFactorSvc.sendLoginOTP(user.id, user.twoFactorPhone);
        
        await storage.createAuditLog({
          actorUserId: user.id,
          action: "two_factor_challenge_sent",
          entityType: "session",
          details: { email: user.email, method: "sms" },
          ipAddress: req.ip,
        });
        
        return res.json({
          requiresTwoFactor: true,
          userId: user.id,
          message: "Verification code sent to your phone",
        });
      }
      
      // Set up session for the authenticated user
      const sessionUser = { 
        claims: { sub: user.id, email: user.email, first_name: user.firstName, last_name: user.lastName },
        expires_at: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 1 week
      };
      
      req.login(sessionUser, (err: any) => {
        if (err) {
          console.error("Session login error:", err);
          return res.status(500).json({ message: "Login failed" });
        }
        
        console.log("[Login] Success - sessionID:", req.sessionID, "isAuth:", req.isAuthenticated(), "proto:", req.protocol, "secure:", req.secure);
        
        // Log login event
        storage.createAuditLog({
          actorUserId: user.id,
          action: "login",
          entityType: "session",
          details: { email: user.email, method: "email_password" },
          ipAddress: req.ip,
        });
        
        res.json({ message: result.message, user });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed. Please try again." });
    }
  });
  
  // Verify email address
  app.post("/api/auth/verify-email", async (req: any, res) => {
    try {
      const { token } = req.body;
      const result = await authService.verifyEmail(token);
      
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      
      res.json({ message: result.message });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({ message: "Verification failed. Please try again." });
    }
  });
  
  // Resend verification email
  app.post("/api/auth/resend-verification", async (req: any, res) => {
    try {
      const { email } = req.body;
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const result = await authService.resendVerificationEmail(email, baseUrl);
      
      res.json({ message: result.message });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ message: "Failed to resend verification email." });
    }
  });
  
  // Request password reset
  app.post("/api/auth/forgot-password", async (req: any, res) => {
    try {
      const { email } = req.body;
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const result = await authService.requestPasswordReset(email, baseUrl);
      
      // Security audit log - password reset requested
      await storage.createAuditLog({
        action: "password_reset_requested",
        entityType: "user",
        details: { email: email?.toLowerCase(), success: true },
        ipAddress: req.ip,
      });
      
      res.json({ message: result.message });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to send reset email." });
    }
  });
  
  // Reset password with token
  app.post("/api/auth/reset-password", async (req: any, res) => {
    try {
      const { token, password } = req.body;
      const result = await authService.resetPassword(token, password);
      
      // Security audit log - password reset attempt
      await storage.createAuditLog({
        action: result.success ? "password_reset_success" : "password_reset_failed",
        entityType: "user",
        details: { 
          success: result.success, 
          reason: result.success ? undefined : result.message 
        },
        ipAddress: req.ip,
      });
      
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      
      res.json({ message: result.message });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Password reset failed. Please try again." });
    }
  });
  
  // Logout (works for both email/password and Replit auth)
  app.post("/api/auth/logout", async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    
    // Security audit log - logout
    if (userId) {
      await storage.createAuditLog({
        actorUserId: userId,
        action: "logout",
        entityType: "session",
        details: { method: "manual" },
        ipAddress: req.ip,
      });
    }
    
    req.logout(() => {
      req.session.destroy(() => {
        res.json({ message: "Logged out successfully" });
      });
    });
  });

  // ============== NOTIFICATION ROUTES ==============

  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const notifs = await storage.getNotificationsByUser(userId);
      res.json(notifs);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid notification ID" });
      await storage.markNotificationRead(id);
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.post("/api/notifications/mark-all-read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      await storage.markAllNotificationsRead(userId);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // ============== SETTINGS ROUTES ==============

  // Get user profile for settings
  app.get("/api/settings/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        hasPassword: !!user.passwordHash,
      });
    } catch (error) {
      console.error("Error getting profile:", error);
      res.status(500).json({ message: "Failed to get profile" });
    }
  });

  // Update user profile
  app.put("/api/settings/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { updateProfileSchema } = await import("@shared/schema");
      const validation = updateProfileSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }
      const { firstName, lastName } = validation.data;
      const updated = await storage.updateUser(userId, { firstName, lastName });
      await storage.createAuditLog({
        actorUserId: userId,
        action: "profile_updated",
        entityType: "user",
        entityId: userId,
        details: { firstName, lastName },
        ipAddress: req.ip,
      });
      res.json({
        firstName: updated.firstName || "",
        lastName: updated.lastName || "",
        email: updated.email || "",
        hasPassword: !!updated.passwordHash,
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Change password
  app.post("/api/settings/change-password", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { changePasswordSchema } = await import("@shared/schema");
      const validation = changePasswordSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }
      const { currentPassword, newPassword } = validation.data;
      const result = await authService.changePassword(userId, currentPassword, newPassword);
      await storage.createAuditLog({
        actorUserId: userId,
        action: result.success ? "password_change_success" : "password_change_failed",
        entityType: "user",
        entityId: userId,
        details: { success: result.success },
        ipAddress: req.ip,
      });
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      res.json({ message: result.message });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Get notification preferences
  app.get("/api/settings/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const prefs = await storage.getNotificationPreferences(userId);
      if (!prefs) {
        return res.json({
          complianceReminders: true,
          serviceRequestUpdates: true,
          orderUpdates: true,
          incorporationUpdates: true,
          marketingEmails: false,
        });
      }
      res.json({
        complianceReminders: prefs.complianceReminders,
        serviceRequestUpdates: prefs.serviceRequestUpdates,
        orderUpdates: prefs.orderUpdates,
        incorporationUpdates: prefs.incorporationUpdates,
        marketingEmails: prefs.marketingEmails,
      });
    } catch (error) {
      console.error("Error getting notification preferences:", error);
      res.status(500).json({ message: "Failed to get notification preferences" });
    }
  });

  // Update notification preferences
  const notificationPrefsSchema = z.object({
    complianceReminders: z.boolean().optional(),
    serviceRequestUpdates: z.boolean().optional(),
    orderUpdates: z.boolean().optional(),
    incorporationUpdates: z.boolean().optional(),
    marketingEmails: z.boolean().optional(),
  });

  app.put("/api/settings/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const validation = notificationPrefsSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors[0].message });
      }
      const { complianceReminders, serviceRequestUpdates, orderUpdates, incorporationUpdates, marketingEmails } = validation.data;
      const prefs = await storage.upsertNotificationPreferences(userId, {
        complianceReminders,
        serviceRequestUpdates,
        orderUpdates,
        incorporationUpdates,
        marketingEmails,
      });
      await storage.createAuditLog({
        actorUserId: userId,
        action: "notification_preferences_updated",
        entityType: "user",
        entityId: userId,
        details: { complianceReminders, serviceRequestUpdates, orderUpdates, incorporationUpdates, marketingEmails },
        ipAddress: req.ip,
      });
      res.json({
        complianceReminders: prefs.complianceReminders,
        serviceRequestUpdates: prefs.serviceRequestUpdates,
        orderUpdates: prefs.orderUpdates,
        incorporationUpdates: prefs.incorporationUpdates,
        marketingEmails: prefs.marketingEmails,
      });
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ message: "Failed to update notification preferences" });
    }
  });

  // ============== TWO-FACTOR AUTHENTICATION ROUTES ==============
  const twoFactorService = await import("./services/twoFactorService");

  app.get("/api/settings/two-factor", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({
        enabled: user.twoFactorEnabled || false,
        method: user.twoFactorMethod || null,
        phone: user.twoFactorPhone ? user.twoFactorPhone.replace(/(\+\d{3})\d+(\d{4})/, '$1****$2') : null,
      });
    } catch (error) {
      console.error("Error getting 2FA status:", error);
      res.status(500).json({ message: "Failed to get two-factor status" });
    }
  });

  app.post("/api/settings/two-factor/setup", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { phoneNumber } = req.body;
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        return res.status(400).json({ message: "Phone number is required" });
      }
      const phone = phoneNumber.trim();
      if (!phone.startsWith('+') || phone.length < 10) {
        return res.status(400).json({ message: "Phone number must be in international format (e.g. +234...)" });
      }
      const result = await twoFactorService.setupTwoFactor(userId, phone);
      await storage.createAuditLog({
        actorUserId: userId,
        action: "two_factor_setup_initiated",
        entityType: "user",
        entityId: userId,
        details: { method: 'sms' },
        ipAddress: req.ip,
      });
      res.json(result);
    } catch (error) {
      console.error("Error setting up 2FA:", error);
      res.status(500).json({ message: "Failed to set up two-factor authentication" });
    }
  });

  app.post("/api/settings/two-factor/confirm", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { otp, phoneNumber } = req.body;
      if (!otp || typeof otp !== 'string' || otp.length !== 6) {
        return res.status(400).json({ message: "Invalid verification code" });
      }
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        return res.status(400).json({ message: "Phone number is required" });
      }
      const result = await twoFactorService.confirmTwoFactorSetup(userId, otp, phoneNumber.trim());
      if (result.success) {
        await storage.createAuditLog({
          actorUserId: userId,
          action: "two_factor_enabled",
          entityType: "user",
          entityId: userId,
          details: { method: 'sms' },
          ipAddress: req.ip,
        });
      }
      res.json(result);
    } catch (error) {
      console.error("Error confirming 2FA:", error);
      res.status(500).json({ message: "Failed to confirm two-factor authentication" });
    }
  });

  app.post("/api/settings/two-factor/disable", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { password } = req.body;
      if (!password || typeof password !== 'string') {
        return res.status(400).json({ message: "Current password is required to disable 2FA" });
      }
      const user = await storage.getUser(userId);
      if (!user || !user.passwordHash) {
        return res.status(404).json({ message: "User not found" });
      }
      const bcrypt = await import("bcryptjs");
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(403).json({ message: "Incorrect password" });
      }
      const result = await twoFactorService.disableTwoFactor(userId);
      await storage.createAuditLog({
        actorUserId: userId,
        action: "two_factor_disabled",
        entityType: "user",
        entityId: userId,
        ipAddress: req.ip,
      });
      res.json(result);
    } catch (error) {
      console.error("Error disabling 2FA:", error);
      res.status(500).json({ message: "Failed to disable two-factor authentication" });
    }
  });

  app.post("/api/auth/two-factor/send", async (req: any, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ message: "User ID required" });
      const user = await storage.getUser(userId);
      if (!user || !user.twoFactorEnabled || !user.twoFactorPhone) {
        return res.status(400).json({ message: "2FA not configured for this user" });
      }
      const result = await twoFactorService.sendLoginOTP(userId, user.twoFactorPhone);
      res.json(result);
    } catch (error) {
      console.error("Error sending login OTP:", error);
      res.status(500).json({ message: "Failed to send verification code" });
    }
  });

  app.post("/api/auth/two-factor/verify", async (req: any, res) => {
    try {
      const { userId, otp, backupCode } = req.body;
      if (!userId) return res.status(400).json({ message: "User ID required" });

      const user = await storage.getUser(userId);
      if (!user || !user.twoFactorEnabled) {
        return res.status(400).json({ message: "2FA not configured for this user" });
      }

      let verified = false;

      if (backupCode && typeof backupCode === 'string') {
        if (!user.twoFactorBackupCodes) {
          return res.status(400).json({ success: false, message: "No backup codes available" });
        }
        const result = twoFactorService.verifyBackupCode(user.twoFactorBackupCodes, backupCode);
        if (result.success) {
          await storage.updateUserTwoFactor(userId, {
            twoFactorBackupCodes: result.remainingCodes,
            lastTwoFactorAt: new Date(),
          });
          await storage.createAuditLog({
            actorUserId: userId,
            action: "two_factor_backup_code_used",
            entityType: "user",
            entityId: userId,
            ipAddress: req.ip,
          });
          verified = true;
        } else {
          return res.json({ success: false, message: "Invalid backup code" });
        }
      } else {
        if (!otp || typeof otp !== 'string') {
          return res.status(400).json({ message: "Verification code required" });
        }
        const result = twoFactorService.verifyLoginOTP(userId, otp);
        if (result.success) {
          await storage.updateUserTwoFactor(userId, { lastTwoFactorAt: new Date() });
          await storage.createAuditLog({
            actorUserId: userId,
            action: "two_factor_login_verified",
            entityType: "user",
            entityId: userId,
            ipAddress: req.ip,
          });
          verified = true;
        } else {
          return res.json(result);
        }
      }

      if (verified) {
        const sessionUser = {
          claims: { sub: user.id, email: user.email, first_name: user.firstName, last_name: user.lastName },
          expires_at: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
        };

        req.login(sessionUser, (err: any) => {
          if (err) {
            console.error("Session login error after 2FA:", err);
            return res.status(500).json({ message: "Login failed after verification" });
          }

          storage.createAuditLog({
            actorUserId: user.id,
            action: "login",
            entityType: "session",
            details: { email: user.email, method: "email_password_2fa" },
            ipAddress: req.ip,
          });

          res.json({ success: true, message: "Verification successful", user });
        });
      }
    } catch (error) {
      console.error("Error verifying login OTP:", error);
      res.status(500).json({ message: "Failed to verify code" });
    }
  });

  // ============== PERSONAL PROFILE ROUTES ==============
  const encryptionService = await import("./services/encryptionService");

  app.get("/api/profile/personal", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const profile = await storage.getFounderProfile(userId);
      if (!profile) {
        return res.json({
          userId,
          fullName: null,
          phone: null,
          dateOfBirth: null,
          nationality: null,
          gender: null,
          occupation: null,
          addressLine1: null,
          addressLine2: null,
          city: null,
          state: null,
          postalCode: null,
          country: "Nigeria",
          ninLast4: null,
          bvnLast4: null,
          hasNin: false,
          hasBvn: false,
          idType: null,
          hasIdDocument: false,
          hasPassportPhoto: false,
          hasSignature: false,
          profileCompletion: 0,
          isProfileComplete: false,
        });
      }

      let ninLast4: string | null = null;
      let bvnLast4: string | null = null;

      if (profile.ninEncrypted) {
        try {
          const nin = encryptionService.decrypt(profile.ninEncrypted);
          ninLast4 = nin.slice(-4);
        } catch { ninLast4 = null; }
      }
      if (profile.bvnEncrypted) {
        try {
          const bvn = encryptionService.decrypt(profile.bvnEncrypted);
          bvnLast4 = bvn.slice(-4);
        } catch { bvnLast4 = null; }
      }

      res.json({
        userId: profile.userId,
        fullName: profile.fullName,
        phone: profile.phone,
        dateOfBirth: profile.dateOfBirth,
        nationality: profile.nationality,
        gender: profile.gender,
        occupation: profile.occupation,
        addressLine1: profile.addressLine1,
        addressLine2: profile.addressLine2,
        city: profile.city,
        state: profile.state,
        postalCode: profile.postalCode,
        country: profile.country,
        ninLast4,
        bvnLast4,
        hasNin: !!profile.ninEncrypted,
        hasBvn: !!profile.bvnEncrypted,
        idType: profile.idType,
        hasIdDocument: !!profile.idDocumentPath,
        hasPassportPhoto: !!profile.passportPhotoPath,
        hasSignature: !!profile.signaturePath,
        profileCompletion: profile.profileCompletion,
        isProfileComplete: profile.isProfileComplete,
      });
    } catch (error) {
      console.error("Error getting personal profile:", error);
      res.status(500).json({ message: "Failed to get profile" });
    }
  });

  app.put("/api/profile/personal", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const {
        fullName, phone, dateOfBirth, nationality, gender, occupation,
        addressLine1, addressLine2, city, state, postalCode, country,
        nin, bvn, idType,
      } = req.body;

      const profileData: any = {
        userId,
        fullName, phone, dateOfBirth, nationality, gender, occupation,
        addressLine1, addressLine2, city, state, postalCode, country,
        idType,
      };

      if (nin && typeof nin === 'string' && nin.length === 11) {
        profileData.ninEncrypted = encryptionService.encrypt(nin);
        await storage.logSensitiveDataAccess({
          accessorUserId: userId,
          targetUserId: userId,
          dataType: 'nin',
          action: 'update',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });
      }

      if (bvn && typeof bvn === 'string' && bvn.length === 11) {
        profileData.bvnEncrypted = encryptionService.encrypt(bvn);
        await storage.logSensitiveDataAccess({
          accessorUserId: userId,
          targetUserId: userId,
          dataType: 'bvn',
          action: 'update',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });
      }

      const completionFields = [
        fullName, phone, dateOfBirth, nationality, gender, occupation,
        addressLine1, city, state, country, idType,
      ];
      const filled = completionFields.filter(Boolean).length;
      const total = completionFields.length;
      const existing = await storage.getFounderProfile(userId);
      const hasDocuments = (existing?.passportPhotoPath || req.body.passportPhotoPath) &&
                           (existing?.signaturePath || req.body.signaturePath) &&
                           (existing?.idDocumentPath || req.body.idDocumentPath);
      const hasIds = (existing?.ninEncrypted || profileData.ninEncrypted) &&
                     (existing?.bvnEncrypted || profileData.bvnEncrypted);

      const docScore = hasDocuments ? 15 : 0;
      const idScore = hasIds ? 15 : 0;
      profileData.profileCompletion = Math.round((filled / total) * 70) + docScore + idScore;
      profileData.isProfileComplete = profileData.profileCompletion >= 85;

      const profile = await storage.upsertFounderProfile(profileData);

      await storage.createAuditLog({
        actorUserId: userId,
        action: "personal_profile_updated",
        entityType: "founder_profile",
        entityId: String(profile.id),
        ipAddress: req.ip,
      });

      if (profileData.isProfileComplete) {
        const wasComplete = existing?.isProfileComplete ?? false;
        if (!wasComplete) {
          const invitations = await storage.getCompanyPeopleByPersonUserId(userId);
          if (invitations.length > 0) {
            const currentUser = await storage.getUser(userId);
            const personName = currentUser
              ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email
              : 'A team member';

            for (const invitation of invitations) {
              try {
                const founder = await storage.getUser(invitation.founderId);
                if (founder?.email) {
                  const emailSvc = await import("./services/emailService");
                  const { client: resendClient, fromEmail } = await emailSvc.getResendClient();
                  const roleLabel = invitation.role.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
                  const appUrl = `${req.protocol}://${req.get("host")}`;
                  await resendClient.emails.send({
                    from: fromEmail,
                    to: founder.email,
                    subject: `${personName} has completed their profile`,
                    html: `
                      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>Profile Completed</h2>
                        <p><strong>${personName}</strong> (${roleLabel}) has completed their personal profile on Cellion One.</p>
                        <p>You can now review their readiness on your Directors & Shareholders page.</p>
                        <p><a href="${appUrl}/founder/company-people" style="background: #1a8a5c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Team Readiness</a></p>
                        <hr style="margin: 24px 0;" />
                        <p style="color: #666; font-size: 12px;">This notification was sent from Cellion One.</p>
                      </div>
                    `,
                  });
                }
              } catch (emailErr) {
                console.error(`[Notify] Failed to notify founder ${invitation.founderId}:`, emailErr);
              }
            }
          }
        }
      }

      const smileIdService = await import('./services/smileIdService');
      if (smileIdService.isSmileIdConfigured()) {
        const crypto = await import("crypto");
        if (bvn && typeof bvn === 'string' && bvn.length === 11) {
          const jobId = `bvn_auto_${crypto.randomBytes(8).toString('hex')}`;
          smileIdService.verifyBvn(bvn, userId, jobId).then(result => {
            console.log(`[SmileID] Auto BVN verification for ${userId}: ${result.success ? 'verified' : result.resultCode}`);
          }).catch(err => {
            console.error(`[SmileID] Auto BVN verification failed for ${userId}:`, err.message);
          });
        }
        if (nin && typeof nin === 'string' && nin.length === 11) {
          const jobId = `nin_auto_${crypto.randomBytes(8).toString('hex')}`;
          smileIdService.verifyNin(nin, userId, jobId).then(result => {
            console.log(`[SmileID] Auto NIN verification for ${userId}: ${result.success ? 'verified' : result.resultCode}`);
          }).catch(err => {
            console.error(`[SmileID] Auto NIN verification failed for ${userId}:`, err.message);
          });
        }
      }

      res.json({ message: "Profile updated successfully", profileCompletion: profileData.profileCompletion });
    } catch (error) {
      console.error("Error updating personal profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.post("/api/profile/personal/upload-url", isAuthenticated, async (req: any, res) => {
    try {
      const { docType, contentType, name, size } = req.body;
      const validDocTypes = ['passport_photo', 'signature', 'id_document'];
      if (!docType || !validDocTypes.includes(docType)) {
        return res.status(400).json({ message: "Invalid document type" });
      }

      const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
      if (contentType && !allowedTypes.includes(contentType)) {
        return res.status(400).json({ message: "Only JPEG, PNG, and PDF files are allowed" });
      }

      const maxSize = 5 * 1024 * 1024;
      if (size && size > maxSize) {
        return res.status(400).json({ message: "File size must be under 5MB" });
      }

      const objectStorage = new ObjectStorageService();
      const uploadURL = await objectStorage.getObjectEntityUploadURL();
      const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);

      res.json({ uploadURL, objectPath });
    } catch (error: any) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  app.post("/api/profile/personal/upload-complete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { docType, objectPath } = req.body;
      const validDocTypes = ['passport_photo', 'signature', 'id_document'];
      if (!docType || !validDocTypes.includes(docType) || !objectPath) {
        return res.status(400).json({ message: "Invalid request" });
      }

      const pathField = docType === 'passport_photo' ? 'passportPhotoPath'
        : docType === 'signature' ? 'signaturePath'
        : 'idDocumentPath';

      const existing = await storage.getFounderProfile(userId);
      const profileData: any = { userId, [pathField]: objectPath };

      if (existing) {
        const completionFields = [
          existing.fullName, existing.phone, existing.dateOfBirth, existing.nationality,
          existing.gender, existing.occupation, existing.addressLine1, existing.city,
          existing.state, existing.country, existing.idType,
        ];
        const filled = completionFields.filter(Boolean).length;
        const total = completionFields.length;
        const pp = docType === 'passport_photo' ? objectPath : existing.passportPhotoPath;
        const sig = docType === 'signature' ? objectPath : existing.signaturePath;
        const idDoc = docType === 'id_document' ? objectPath : existing.idDocumentPath;
        const hasDocuments = pp && sig && idDoc;
        const hasIds = existing.ninEncrypted && existing.bvnEncrypted;
        const docScore = hasDocuments ? 15 : 0;
        const idScore = hasIds ? 15 : 0;
        profileData.profileCompletion = Math.round((filled / total) * 70) + docScore + idScore;
        profileData.isProfileComplete = profileData.profileCompletion >= 85;
      }

      await storage.upsertFounderProfile(profileData);

      await storage.createAuditLog({
        actorUserId: userId,
        action: "personal_document_uploaded",
        entityType: "founder_profile",
        details: { docType },
        ipAddress: req.ip,
      });

      res.json({ message: "Document uploaded successfully", docType });
    } catch (error) {
      console.error("Error completing upload:", error);
      res.status(500).json({ message: "Failed to save document" });
    }
  });

  app.get("/api/profile/personal/document/:docType", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { docType } = req.params;
      const validDocTypes = ['passport_photo', 'signature', 'id_document'];
      if (!validDocTypes.includes(docType)) {
        return res.status(400).json({ message: "Invalid document type" });
      }

      const profile = await storage.getFounderProfile(userId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });

      const path = docType === 'passport_photo' ? profile.passportPhotoPath
        : docType === 'signature' ? profile.signaturePath
        : profile.idDocumentPath;

      if (!path) return res.status(404).json({ message: "Document not found" });

      await storage.logSensitiveDataAccess({
        accessorUserId: userId,
        targetUserId: userId,
        dataType: docType,
        action: 'view',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const objectStorage = new ObjectStorageService();
      const downloadURL = await objectStorage.getObjectEntityDownloadURL(path);
      res.json({ downloadURL });
    } catch (error) {
      console.error("Error getting document URL:", error);
      res.status(500).json({ message: "Failed to get document" });
    }
  });

  // ============== SMILE ID VERIFICATION ROUTES ==============

  app.get("/api/verification/smile-id/status", isAuthenticated, async (req: any, res) => {
    try {
      const smileIdService = await import('./services/smileIdService');
      const status = await smileIdService.getVerificationStatus();
      res.json(status);
    } catch (error) {
      console.error("Error checking Smile ID status:", error);
      res.status(500).json({ message: "Failed to check verification service status" });
    }
  });

  app.post("/api/verification/smile-id/verify-bvn", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { bvn } = req.body;

      if (!bvn || typeof bvn !== 'string' || bvn.length !== 11) {
        return res.status(400).json({ message: "Valid 11-digit BVN is required" });
      }

      const smileIdService = await import('./services/smileIdService');
      const jobId = `bvn_${userId}_${Date.now()}`;
      const result = await smileIdService.verifyBvn(bvn, userId, jobId);

      await storage.logSensitiveDataAccess({
        accessorUserId: userId,
        targetUserId: userId,
        dataType: 'bvn',
        action: 'verify_smile_id',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json(result);
    } catch (error) {
      console.error("Error verifying BVN:", error);
      res.status(500).json({ message: "BVN verification failed" });
    }
  });

  app.post("/api/verification/smile-id/verify-nin", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { nin } = req.body;

      if (!nin || typeof nin !== 'string' || nin.length !== 11) {
        return res.status(400).json({ message: "Valid 11-digit NIN is required" });
      }

      const smileIdService = await import('./services/smileIdService');
      const jobId = `nin_${userId}_${Date.now()}`;
      const result = await smileIdService.verifyNin(nin, userId, jobId);

      await storage.logSensitiveDataAccess({
        accessorUserId: userId,
        targetUserId: userId,
        dataType: 'nin',
        action: 'verify_smile_id',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json(result);
    } catch (error) {
      console.error("Error verifying NIN:", error);
      res.status(500).json({ message: "NIN verification failed" });
    }
  });

  // ============== COMPANY PEOPLE (DIRECTORS/SHAREHOLDERS) ROUTES ==============

  app.get("/api/company-people", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const people = await storage.getCompanyPeopleByFounder(userId);
      res.json(people);
    } catch (error) {
      console.error("Error getting company people:", error);
      res.status(500).json({ message: "Failed to get company people" });
    }
  });

  app.get("/api/company-people/readiness", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const people = await storage.getCompanyPeopleByFounder(userId);

      const readiness = await Promise.all(
        people.map(async (person) => {
          let profileCompletion = 0;
          let isProfileComplete = false;
          let hasPassportPhoto = false;
          let hasSignature = false;
          let hasIdDocument = false;
          let hasNin = false;
          let hasBvn = false;
          let firstName: string | null = null;
          let lastName: string | null = null;

          if (person.personUserId) {
            const profile = await storage.getFounderProfile(person.personUserId);
            const user = await storage.getUser(person.personUserId);
            if (profile) {
              profileCompletion = profile.profileCompletion ?? 0;
              isProfileComplete = profile.isProfileComplete ?? false;
              hasPassportPhoto = !!profile.passportPhotoPath;
              hasSignature = !!profile.signaturePath;
              hasIdDocument = !!profile.idDocumentPath;
              hasNin = !!profile.ninEncrypted;
              hasBvn = !!profile.bvnEncrypted;
            }
            if (user) {
              firstName = user.firstName;
              lastName = user.lastName;
            }
          }

          return {
            id: person.id,
            inviteEmail: person.inviteEmail,
            role: person.role,
            inviteStatus: person.inviteStatus,
            isVerified: person.isVerified,
            personUserId: person.personUserId,
            firstName,
            lastName,
            profileCompletion,
            isProfileComplete,
            hasPassportPhoto,
            hasSignature,
            hasIdDocument,
            hasNin,
            hasBvn,
          };
        })
      );

      const founderProfile = await storage.getFounderProfile(userId);
      const founderUser = await storage.getUser(userId);

      const founderReadiness = {
        id: "founder",
        inviteEmail: founderUser?.email || null,
        role: "founder",
        inviteStatus: "accepted",
        isVerified: founderUser?.identityVerified ?? false,
        personUserId: userId,
        firstName: founderUser?.firstName || null,
        lastName: founderUser?.lastName || null,
        profileCompletion: founderProfile?.profileCompletion ?? 0,
        isProfileComplete: founderProfile?.isProfileComplete ?? false,
        hasPassportPhoto: !!founderProfile?.passportPhotoPath,
        hasSignature: !!founderProfile?.signaturePath,
        hasIdDocument: !!founderProfile?.idDocumentPath,
        hasNin: !!founderProfile?.ninEncrypted,
        hasBvn: !!founderProfile?.bvnEncrypted,
      };

      const allPeople = [founderReadiness, ...readiness];
      const totalPeople = allPeople.length;
      const readyCount = allPeople.filter(p => p.isProfileComplete).length;
      const allReady = readyCount === totalPeople;

      res.json({
        people: allPeople,
        summary: {
          totalPeople,
          readyCount,
          allReady,
        },
      });
    } catch (error) {
      console.error("Error getting readiness data:", error);
      res.status(500).json({ message: "Failed to get readiness data" });
    }
  });

  app.get("/api/company-people/my-invitations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const invitations = await storage.getCompanyPeopleByPersonUserId(userId);
      res.json(invitations);
    } catch (error) {
      console.error("Error getting invitations:", error);
      res.status(500).json({ message: "Failed to get invitations" });
    }
  });

  app.post("/api/company-people", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { inviteEmail, role, title, sharesAllocated, shareClass, sharePercentage, applicationId, companyProfileId } = req.body;

      if (!inviteEmail || !role) {
        return res.status(400).json({ message: "Email and role are required" });
      }

      if (!['director', 'shareholder', 'director_shareholder', 'secretary'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const crypto = await import("crypto");
      const inviteToken = crypto.randomBytes(32).toString('hex');

      const person = await storage.createCompanyPerson({
        founderId: userId,
        inviteEmail: inviteEmail.toLowerCase().trim(),
        inviteToken,
        inviteStatus: "pending",
        inviteSentAt: new Date(),
        role,
        title,
        sharesAllocated: sharesAllocated || null,
        shareClass: shareClass || null,
        sharePercentage: sharePercentage || null,
        applicationId: applicationId || null,
        companyProfileId: companyProfileId || null,
      });

      try {
        const emailSvc = await import("./services/emailService");
        const { client: resend, fromEmail } = await emailSvc.getResendClient();
        const appUrl = process.env.REPLIT_DEV_DOMAIN
          ? `https://${process.env.REPLIT_DEV_DOMAIN}`
          : `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;

        const roleLabel = role === 'director_shareholder' ? 'Director & Shareholder' : role.charAt(0).toUpperCase() + role.slice(1);
        const user = await storage.getUser(userId);
        const founderName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'A founder';

        await resend.emails.send({
          from: fromEmail,
          to: inviteEmail.toLowerCase().trim(),
          subject: `You've been invited as a ${roleLabel} on Cellion One`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Company Director/Shareholder Invitation</h2>
              <p>${founderName} has invited you to join as a <strong>${roleLabel}</strong> for their company on Cellion One.</p>
              <p>To accept this invitation, please create an account or sign in using this link:</p>
              <p><a href="${appUrl}/invite/${inviteToken}" style="background: #1a8a5c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Accept Invitation</a></p>
              <p>If the button doesn't work, copy and paste this URL:<br/>${appUrl}/invite/${inviteToken}</p>
              <hr style="margin: 24px 0;" />
              <p style="color: #666; font-size: 12px;">This invitation was sent from Cellion One. If you didn't expect this, you can ignore this email.</p>
            </div>
          `,
        });
      } catch (emailErr: any) {
        console.warn("[CompanyPeople] Failed to send invite email:", emailErr?.message);
      }

      await storage.createAuditLog({
        actorUserId: userId,
        action: "company_person_invited",
        entityType: "company_person",
        entityId: String(person.id),
        details: { inviteEmail, role, title },
        ipAddress: req.ip,
      });

      res.json(person);
    } catch (error) {
      console.error("Error inviting company person:", error);
      res.status(500).json({ message: "Failed to invite person" });
    }
  });

  app.put("/api/company-people/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const existing = await storage.getCompanyPeople(0);
      const people = await storage.getCompanyPeopleByFounder(userId);
      const person = people.find(p => p.id === id);
      if (!person) {
        return res.status(404).json({ message: "Person not found" });
      }

      const { role, title, sharesAllocated, shareClass, sharePercentage } = req.body;
      const updated = await storage.updateCompanyPerson(id, {
        role: role || person.role,
        title: title !== undefined ? title : person.title,
        sharesAllocated: sharesAllocated !== undefined ? sharesAllocated : person.sharesAllocated,
        shareClass: shareClass !== undefined ? shareClass : person.shareClass,
        sharePercentage: sharePercentage !== undefined ? sharePercentage : person.sharePercentage,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating company person:", error);
      res.status(500).json({ message: "Failed to update person" });
    }
  });

  app.delete("/api/company-people/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const people = await storage.getCompanyPeopleByFounder(userId);
      const person = people.find(p => p.id === id);
      if (!person) {
        return res.status(404).json({ message: "Person not found" });
      }

      await storage.deleteCompanyPerson(id);

      await storage.createAuditLog({
        actorUserId: userId,
        action: "company_person_removed",
        entityType: "company_person",
        entityId: String(id),
        details: { inviteEmail: person.inviteEmail, role: person.role },
        ipAddress: req.ip,
      });

      res.json({ message: "Person removed" });
    } catch (error) {
      console.error("Error removing company person:", error);
      res.status(500).json({ message: "Failed to remove person" });
    }
  });

  app.post("/api/company-people/accept-invite", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { inviteToken } = req.body;
      if (!inviteToken) return res.status(400).json({ message: "Invite token required" });

      const person = await storage.getCompanyPersonByInviteToken(inviteToken);
      if (!person) {
        return res.status(404).json({ message: "Invalid or expired invitation" });
      }

      if (person.inviteStatus === 'accepted') {
        return res.status(400).json({ message: "Invitation already accepted" });
      }

      const currentUser = await storage.getUser(userId);
      if (!currentUser || currentUser.email?.toLowerCase() !== person.inviteEmail?.toLowerCase()) {
        return res.status(403).json({
          message: "You can only accept invitations sent to your email address."
        });
      }

      await storage.updateCompanyPerson(person.id, {
        personUserId: userId,
        inviteStatus: 'accepted',
      });

      await storage.createAuditLog({
        actorUserId: userId,
        action: "company_person_invite_accepted",
        entityType: "company_person",
        entityId: String(person.id),
        details: { role: person.role, founderId: person.founderId },
        ipAddress: req.ip,
      });

      res.json({ message: "Invitation accepted", role: person.role });
    } catch (error) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  app.post("/api/company-people/resend-invite/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const people = await storage.getCompanyPeopleByFounder(userId);
      const person = people.find(p => p.id === id);
      if (!person || !person.inviteEmail) {
        return res.status(404).json({ message: "Person not found" });
      }

      if (person.inviteStatus === 'accepted') {
        return res.status(400).json({ message: "Invitation already accepted" });
      }

      try {
        const emailSvc = await import("./services/emailService");
        const { client: resend, fromEmail } = await emailSvc.getResendClient();
        const appUrl = process.env.REPLIT_DEV_DOMAIN
          ? `https://${process.env.REPLIT_DEV_DOMAIN}`
          : `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;

        const roleLabel = person.role === 'director_shareholder' ? 'Director & Shareholder' : person.role.charAt(0).toUpperCase() + person.role.slice(1);
        const user = await storage.getUser(userId);
        const founderName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'A founder';

        await resend.emails.send({
          from: fromEmail,
          to: person.inviteEmail,
          subject: `Reminder: You've been invited as a ${roleLabel} on Cellion One`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Reminder: Company Director/Shareholder Invitation</h2>
              <p>${founderName} has invited you to join as a <strong>${roleLabel}</strong> for their company on Cellion One.</p>
              <p><a href="${appUrl}/invite/${person.inviteToken}" style="background: #1a8a5c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Accept Invitation</a></p>
              <p>If the button doesn't work, copy and paste this URL:<br/>${appUrl}/invite/${person.inviteToken}</p>
            </div>
          `,
        });

        await storage.updateCompanyPerson(person.id, { inviteSentAt: new Date() });
        res.json({ message: "Invitation resent" });
      } catch (emailErr: any) {
        console.warn("[CompanyPeople] Failed to resend invite:", emailErr?.message);
        res.status(500).json({ message: "Failed to send email" });
      }
    } catch (error) {
      console.error("Error resending invitation:", error);
      res.status(500).json({ message: "Failed to resend invitation" });
    }
  });

  // ============== PAYSTACK PAYMENT ROUTES ==============
  const paystackPaymentService = await import("./services/paystackPaymentService");
  const paystackWebhookHandler = await import("./services/paystackWebhookHandler");

  // Get price book (public endpoint for UI - Paystack NGN only)
  app.get("/api/payments/pricebook", async (req, res) => {
    try {
      const priceBook = await import("./config/priceBook");
      const prices = priceBook.default.getPricesByProvider('paystack');
      res.json({ prices });
    } catch (error) {
      console.error("Error getting price book:", error);
      res.status(500).json({ message: "Failed to get price book" });
    }
  });

  // STRIPE REMOVED - Paystack-only payment system
  // The following Stripe routes have been intentionally removed:
  // - /api/payments/stripe/config
  // - /api/payments/stripe/checkout  
  // - /api/payments/stripe/session/:sessionId
  // - /api/payments/stripe/sessions
  // All payments are now handled through Paystack (NGN)

  // Check if Paystack is configured (public endpoint)
  app.get("/api/payments/paystack/config", async (req, res) => {
    try {
      const isConfigured = paystackPaymentService.isPaystackConfigured();
      res.json({ isConfigured });
    } catch (error) {
      console.error("Error getting Paystack config:", error);
      res.status(500).json({ message: "Failed to get Paystack configuration" });
    }
  });

  // Initialize Paystack transaction (authenticated)
  app.post("/api/payments/paystack/initialize", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      let { items, context } = req.body;

      // Validate items
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "Items are required" });
      }

      // Validate each item has serviceType
      for (const item of items) {
        if (!item.serviceType) {
          return res.status(400).json({ message: "Each item must have a serviceType" });
        }
        if (item.serviceType === "registered_office" && !item.tier) {
          return res.status(400).json({ message: "Registered office items must have a tier" });
        }
      }

      // Check user's verification status
      const vStatus = await verificationService.getVerificationStatus(userId);
      const hasIncorporation = items.some((i: any) => i.serviceType === "incorporation");
      const hasVerificationItem = items.some((i: any) => i.serviceType === "verification");
      
      // For incorporation, user must be verified or pay for verification
      if (hasIncorporation && vStatus.requiresVerification && !hasVerificationItem) {
        items = [{ serviceType: "verification" }, ...items];
      }
      
      // If user is already verified and they've included verification, remove it
      if (!vStatus.requiresVerification && hasVerificationItem) {
        items = items.filter((i: any) => i.serviceType !== "verification");
      }

      // Check if Paystack is configured
      const isConfigured = paystackPaymentService.isPaystackConfigured();
      if (!isConfigured) {
        return res.status(503).json({ message: "Paystack payments are not available" });
      }

      // Check feature flag
      const paystackEnabled = await storage.getFeatureFlag("enable_paystack_payments");
      if (!paystackEnabled?.isEnabled) {
        return res.status(503).json({ message: "Paystack payments are currently disabled" });
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;

      const result = await paystackPaymentService.initializeTransaction(
        userId,
        items,
        context || {},
        baseUrl
      );

      // Audit log
      await storage.createAuditLog({
        actorUserId: userId,
        action: "paystack_transaction_initiated",
        entityType: "paystack_transaction",
        entityId: result.reference,
        details: { items, reference: result.reference, verificationStatus: vStatus.status },
        ipAddress: req.ip,
      });

      res.json({
        ...result,
        verificationAutoAdded: hasIncorporation && vStatus.requiresVerification && !hasVerificationItem,
        verificationSkipped: !vStatus.requiresVerification && hasVerificationItem,
      });
    } catch (error: any) {
      console.error("Error initializing Paystack transaction:", error);
      res.status(500).json({ message: error.message || "Failed to initialize transaction" });
    }
  });

  // Verify Paystack transaction (authenticated)
  app.get("/api/payments/paystack/verify/:reference", isAuthenticated, async (req: any, res) => {
    try {
      const { reference } = req.params;
      const userId = getUserId(req);

      // Get our database record
      const transaction = await storage.getPaystackTransactionByReference(reference);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      // Verify ownership
      if (transaction.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // If already completed, return cached status
      if (transaction.status === "success" || transaction.status === "failed") {
        return res.json({
          status: transaction.status,
          amount: transaction.amountTotal,
          currency: transaction.currency,
          completedAt: transaction.completedAt,
        });
      }

      // Verify with Paystack
      const verification = await paystackPaymentService.verifyTransaction(reference);
      res.json(verification);
    } catch (error: any) {
      console.error("Error verifying Paystack transaction:", error);
      res.status(500).json({ message: error.message || "Failed to verify transaction" });
    }
  });

  // Get user's Paystack transactions (authenticated)
  app.get("/api/payments/paystack/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const transactions = await storage.getPaystackTransactionsByUser(userId);
      res.json({ transactions });
    } catch (error) {
      console.error("Error fetching Paystack transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // ============== PRODUCT CATALOG & SPLIT CHECKOUT ROUTES ==============
  const productCatalogService = await import("./services/productCatalogService");
  const orderService = await import("./services/orderService");

  app.get("/api/products", async (req, res) => {
    try {
      const products = await productCatalogService.getActiveProducts();
      const formatted = products.map(p => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        priceNgn: p.priceNgn,
        requiresManualPricing: p.requiresManualPricing,
        metadata: p.metadata,
      }));
      res.json(formatted);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/checkout/verification-info", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      const companyPeople = await storage.getCompanyPeopleByFounder(userId);

      const founderVerified = !!user?.isIdentityVerified;
      const people = companyPeople
        .filter(p => p.personUserId)
        .map(p => ({
          id: p.id,
          email: p.inviteEmail,
          role: p.role,
          isVerified: !!p.isVerified,
          inviteStatus: p.inviteStatus,
        }));

      const unverifiedCount = (founderVerified ? 0 : 1) + people.filter(p => !p.isVerified).length;

      res.json({
        founderVerified,
        people,
        unverifiedCount,
        verificationFeePerPerson: 500000,
        totalVerificationFee: unverifiedCount * 500000,
      });
    } catch (error) {
      console.error("Error fetching verification info:", error);
      res.status(500).json({ message: "Failed to fetch verification info" });
    }
  });

  app.post("/api/checkout/split", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { items, applicationId } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "At least one item is required" });
      }

      const paystackEnabled = await storage.getFeatureFlag("enable_paystack_payments");
      if (!paystackEnabled?.isEnabled) {
        return res.status(503).json({ message: "Paystack payments are currently disabled" });
      }

      if (!paystackPaymentService.isPaystackConfigured()) {
        return res.status(503).json({ message: "Paystack payments are not available" });
      }

      const user = await storage.getUser(userId);
      if (!user?.email) {
        return res.status(400).json({ message: "User email is required for Paystack payments" });
      }

      const founderProfile = await storage.getFounderProfile(userId);
      if (!founderProfile?.isProfileComplete) {
        return res.status(400).json({ message: "Your personal profile must be complete before checkout. Please complete your profile first." });
      }

      const companyPeopleAll = await storage.getCompanyPeopleByFounder(userId);
      const acceptedPeople = companyPeopleAll.filter(p => p.personUserId && p.inviteStatus === 'accepted');
      for (const person of acceptedPeople) {
        const personProfile = await storage.getFounderProfile(person.personUserId!);
        if (!personProfile?.isProfileComplete) {
          const personUser = await storage.getUser(person.personUserId!);
          const name = personUser ? `${personUser.firstName || ''} ${personUser.lastName || ''}`.trim() || personUser.email : person.inviteEmail;
          return res.status(400).json({
            message: `${name}'s profile is incomplete (${personProfile?.profileCompletion || 0}%). All team members must complete their profiles before checkout.`
          });
        }
      }

      let finalItems: { sku: string; quantity?: number }[] = items.map((i: { sku: string }) => ({ sku: i.sku }));

      const hasVerify = finalItems.some((i) => i.sku === "VERIFY");
      if (!hasVerify) {
        let verifyCount = 0;
        if (!user.isIdentityVerified) {
          verifyCount = 1;
        }
        const companyPeople = await storage.getCompanyPeopleByFounder(userId);
        const unverifiedPeople = companyPeople.filter(p => !p.isVerified && p.personUserId);
        verifyCount += unverifiedPeople.length;

        if (verifyCount > 0) {
          finalItems.push({ sku: "VERIFY", quantity: verifyCount });
        }
      }

      const { order, items: orderItemRecords } = await orderService.createOrder({
        founderId: userId,
        applicationId: applicationId || undefined,
        items: finalItems,
      });

      const baseUrl = `${req.protocol}://${req.get("host")}`;

      const result = await paystackPaymentService.initializeSplitTransaction({
        orderId: order.id,
        email: user.email,
        totalAmount: order.totalAmount,
        totalCellionCut: order.totalCellionCut || 0,
        founderId: userId,
        applicationId: order.applicationId,
        itemSkus: orderItemRecords.map(i => i.sku),
        baseUrl,
      });

      await storage.createAuditLog({
        actorUserId: userId,
        action: "split_checkout_initiated",
        entityType: "order",
        entityId: String(order.id),
        details: {
          reference: result.reference,
          totalAmount: order.totalAmount,
          cellionCut: order.totalCellionCut,
          lawyerNet: order.totalLawyerNet,
          items: items.map((i: { sku: string }) => i.sku),
        },
        ipAddress: req.ip,
      });

      res.json({
        orderId: order.id,
        authorizationUrl: result.authorizationUrl,
        reference: result.reference,
        totalAmount: order.totalAmount,
        totalCellionCut: order.totalCellionCut,
        totalLawyerNet: order.totalLawyerNet,
      });
    } catch (error: any) {
      console.error("Error creating split checkout:", error);
      if (error.message === "MANUAL_PRICING_REQUIRED") {
        return res.status(400).json({ message: "One or more items requires manual pricing. Please contact support." });
      }
      res.status(500).json({ message: error.message || "Failed to create checkout" });
    }
  });

  app.get("/api/founder/orders", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const userOrders = await orderService.getOrdersByFounder(userId);
      res.json(userOrders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/founder/orders/:id", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orderId = parseInt(req.params.id, 10);
      if (isNaN(orderId)) return res.status(400).json({ message: "Invalid order ID" });

      const result = await orderService.getOrderById(orderId);
      if (!result) return res.status(404).json({ message: "Order not found" });
      if (result.order.founderId !== userId) return res.status(403).json({ message: "Forbidden" });

      res.json(result);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  // ============== FOUNDER SERVICE REQUESTS ==============
  app.get("/api/founder/service-requests", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const requests = await db.select().from(serviceRequestsTable)
        .where(eq(serviceRequestsTable.founderId, userId))
        .orderBy(desc(serviceRequestsTable.createdAt));
      res.json(requests);
    } catch (error) {
      console.error("Error fetching service requests:", error);
      res.status(500).json({ message: "Failed to fetch service requests" });
    }
  });

  app.get("/api/founder/orders/:orderId/service-requests", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orderId = parseInt(req.params.orderId, 10);
      if (isNaN(orderId)) return res.status(400).json({ message: "Invalid order ID" });

      const order = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
      if (!order.length || order[0].founderId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const requests = await db.select().from(serviceRequestsTable)
        .where(and(eq(serviceRequestsTable.orderId, orderId), eq(serviceRequestsTable.founderId, userId)));
      res.json(requests);
    } catch (error) {
      console.error("Error fetching order service requests:", error);
      res.status(500).json({ message: "Failed to fetch service requests" });
    }
  });

  app.put("/api/founder/service-requests/:id/profile", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const srId = parseInt(req.params.id, 10);
      if (isNaN(srId)) return res.status(400).json({ message: "Invalid service request ID" });

      const [sr] = await db.select().from(serviceRequestsTable).where(eq(serviceRequestsTable.id, srId));
      if (!sr || sr.founderId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { companyProfileId } = req.body;
      if (!companyProfileId) return res.status(400).json({ message: "companyProfileId is required" });

      const [profile] = await db.select().from(srProfilesTable).where(eq(srProfilesTable.id, companyProfileId));
      if (!profile || profile.founderId !== userId) {
        return res.status(403).json({ message: "Profile not found or not yours" });
      }

      const [updated] = await db.update(serviceRequestsTable)
        .set({ companyProfileId, updatedAt: new Date() })
        .where(eq(serviceRequestsTable.id, srId))
        .returning();

      await storage.createAuditLog({
        actorUserId: userId,
        action: "service_request_profile_linked",
        entityType: "service_request",
        entityId: String(srId),
        details: { companyProfileId },
        ipAddress: req.ip,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error linking profile to service request:", error);
      res.status(500).json({ message: "Failed to link profile" });
    }
  });

  // ============== LAWYER SERVICE REQUESTS ==============
  app.get("/api/lawyer/service-requests", isAuthenticated, requireRole("lawyer"), async (req: any, res) => {
    try {
      const lawyerId = getUserId(req);
      const statusFilter = req.query.status as string | undefined;

      let query = db.select({
        serviceRequest: serviceRequestsTable,
        founderEmail: usersTable.email,
        founderFirstName: usersTable.firstName,
        founderLastName: usersTable.lastName,
      })
        .from(serviceRequestsTable)
        .leftJoin(usersTable, eq(serviceRequestsTable.founderId, usersTable.id))
        .orderBy(desc(serviceRequestsTable.createdAt));

      let results;
      if (statusFilter) {
        results = await query.where(
          and(
            eq(serviceRequestsTable.status, statusFilter),
            eq(serviceRequestsTable.assignedLawyerId, lawyerId)
          )
        );
      } else {
        results = await query;
      }

      res.json(results.map(r => ({
        ...r.serviceRequest,
        founder: {
          email: r.founderEmail,
          firstName: r.founderFirstName,
          lastName: r.founderLastName,
        },
      })));
    } catch (error) {
      console.error("Error fetching lawyer service requests:", error);
      res.status(500).json({ message: "Failed to fetch service requests" });
    }
  });

  app.get("/api/lawyer/service-requests/:id", isAuthenticated, requireRole("lawyer"), async (req: any, res) => {
    try {
      const srId = parseInt(req.params.id, 10);
      if (isNaN(srId)) return res.status(400).json({ message: "Invalid ID" });

      const [sr] = await db.select().from(serviceRequestsTable).where(eq(serviceRequestsTable.id, srId));
      if (!sr) return res.status(404).json({ message: "Not found" });

      let profile = null;
      if (sr.companyProfileId) {
        const [p] = await db.select().from(srProfilesTable).where(eq(srProfilesTable.id, sr.companyProfileId));
        profile = p || null;
      }

      let documents: any[] = [];
      if (sr.companyProfileId) {
        documents = await db.select().from(srDocumentsTable)
          .where(eq(srDocumentsTable.companyProfileId, sr.companyProfileId));
      }

      const [founder] = await db.select({
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
      }).from(usersTable).where(eq(usersTable.id, sr.founderId));

      let registeredOffice = null;
      const subs = await db.select()
        .from(registeredOfficeSubscriptions)
        .where(and(
          eq(registeredOfficeSubscriptions.founderId, sr.founderId),
          eq(registeredOfficeSubscriptions.useAsRegisteredAddress, true)
        ))
        .limit(1);
      if (subs.length > 0) {
        const sub = subs[0];
        const [addr] = await db.select()
          .from(serviceAddresses)
          .where(eq(serviceAddresses.id, sub.serviceAddressId))
          .limit(1);
        registeredOffice = {
          subscription: {
            id: sub.id,
            status: sub.status,
            proofOfAddressStatus: sub.proofOfAddressStatus,
            registeredAddressConfirmedAt: sub.registeredAddressConfirmedAt,
            registeredAddressConsentText: sub.registeredAddressConsentText,
          },
          address: addr ? {
            label: addr.label,
            line1: addr.line1,
            line2: addr.line2,
            city: addr.city,
            state: addr.state,
            country: addr.country,
          } : null,
        };
      }

      res.json({ serviceRequest: sr, profile, documents, founder, registeredOffice });
    } catch (error) {
      console.error("Error fetching service request detail:", error);
      res.status(500).json({ message: "Failed to fetch service request" });
    }
  });

  app.put("/api/lawyer/service-requests/:id/status", isAuthenticated, requireRole("lawyer"), async (req: any, res) => {
    try {
      const lawyerId = getUserId(req);
      const srId = parseInt(req.params.id, 10);
      if (isNaN(srId)) return res.status(400).json({ message: "Invalid ID" });

      const { status, notes } = req.body;
      const validStatuses = ["assigned", "in_progress", "completed", "cancelled"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: `Status must be one of: ${validStatuses.join(", ")}` });
      }

      const [sr] = await db.select().from(serviceRequestsTable).where(eq(serviceRequestsTable.id, srId));
      if (!sr) return res.status(404).json({ message: "Not found" });

      const updateData: Record<string, unknown> = {
        status,
        assignedLawyerId: lawyerId,
        updatedAt: new Date(),
      };
      if (notes) updateData.notes = notes;
      if (status === "completed") updateData.completedAt = new Date();

      const [updated] = await db.update(serviceRequestsTable)
        .set(updateData)
        .where(eq(serviceRequestsTable.id, srId))
        .returning();

      await storage.createAuditLog({
        actorUserId: lawyerId,
        action: "service_request_status_updated",
        entityType: "service_request",
        entityId: String(srId),
        details: { status, previousStatus: sr.status, founderId: sr.founderId },
        ipAddress: req.ip,
      });

      try {
        if (sr.founderId) {
          const founder = await storage.getUser(sr.founderId);
          if (founder?.email) {
            const emailService = await import("./services/emailService");
            await emailService.sendServiceRequestStatusUpdateEmail(founder.email, {
              founderName: founder.firstName || founder.email,
              serviceType: sr.serviceType || 'Unknown',
              serviceRequestId: srId,
              newStatus: status,
              notes: notes || undefined,
            });
          }
        }
      } catch (emailErr) {
        console.error("Error sending service request status email:", emailErr);
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating service request:", error);
      res.status(500).json({ message: "Failed to update service request" });
    }
  });

  // ============== ADMIN SERVICE REQUESTS ==============
  app.get("/api/admin/service-requests", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const results = await db.select({
        serviceRequest: serviceRequestsTable,
        founderEmail: usersTable.email,
        founderFirstName: usersTable.firstName,
        founderLastName: usersTable.lastName,
      })
        .from(serviceRequestsTable)
        .leftJoin(usersTable, eq(serviceRequestsTable.founderId, usersTable.id))
        .orderBy(desc(serviceRequestsTable.createdAt));

      res.json(results.map(r => ({
        ...r.serviceRequest,
        founder: {
          email: r.founderEmail,
          firstName: r.founderFirstName,
          lastName: r.founderLastName,
        },
      })));
    } catch (error) {
      console.error("Error fetching admin service requests:", error);
      res.status(500).json({ message: "Failed to fetch service requests" });
    }
  });

  app.put("/api/admin/service-requests/:id/assign", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const adminId = getUserId(req);
      const srId = parseInt(req.params.id, 10);
      if (isNaN(srId)) return res.status(400).json({ message: "Invalid ID" });

      const { assignedLawyerId } = req.body;
      if (!assignedLawyerId) return res.status(400).json({ message: "assignedLawyerId is required" });

      const [updated] = await db.update(serviceRequestsTable)
        .set({ assignedLawyerId, status: "assigned", updatedAt: new Date() })
        .where(eq(serviceRequestsTable.id, srId))
        .returning();

      await storage.createAuditLog({
        actorUserId: adminId,
        action: "service_request_assigned",
        entityType: "service_request",
        entityId: String(srId),
        details: { assignedLawyerId },
        ipAddress: req.ip,
      });

      try {
        const lawyer = await storage.getUser(assignedLawyerId);
        const founder = updated.founderId ? await storage.getUser(updated.founderId) : null;
        if (lawyer?.email) {
          const emailService = await import("./services/emailService");
          await emailService.sendServiceRequestAssignedEmail(lawyer.email, {
            serviceType: updated.serviceType || 'Unknown',
            founderName: founder ? `${founder.firstName || ''} ${founder.lastName || ''}`.trim() || founder.email || 'Unknown' : 'Unknown',
            founderEmail: founder?.email || 'Unknown',
            serviceRequestId: srId,
          });
        }
      } catch (emailErr) {
        console.error("Error sending lawyer assignment email:", emailErr);
      }

      res.json(updated);
    } catch (error) {
      console.error("Error assigning service request:", error);
      res.status(500).json({ message: "Failed to assign service request" });
    }
  });

  // ============== ADMIN ORDER MANAGEMENT ==============
  app.get("/api/admin/orders", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const allOrders = await db.select().from(ordersTable).orderBy(ordersTable.createdAt);
      res.json(allOrders);
    } catch (error) {
      console.error("Error fetching admin orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/admin/orders/:id", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const orderId = parseInt(req.params.id, 10);
      if (isNaN(orderId)) return res.status(400).json({ message: "Invalid order ID" });

      const result = await orderService.getOrderById(orderId);
      if (!result) return res.status(404).json({ message: "Order not found" });

      res.json(result);
    } catch (error) {
      console.error("Error fetching admin order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.patch("/api/admin/orders/:id/fulfilment", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orderId = parseInt(req.params.id, 10);
      if (isNaN(orderId)) return res.status(400).json({ message: "Invalid order ID" });

      const { fulfilmentStatus, assignedLawyerId } = req.body;
      if (!fulfilmentStatus) return res.status(400).json({ message: "fulfilmentStatus is required" });

      const validStatuses = ["pending", "in_progress", "completed", "cancelled"];
      if (!validStatuses.includes(fulfilmentStatus)) {
        return res.status(400).json({ message: `Invalid fulfilmentStatus. Must be one of: ${validStatuses.join(", ")}` });
      }

      const updated = await orderService.updateOrderFulfilment(orderId, fulfilmentStatus, assignedLawyerId);
      if (!updated) return res.status(404).json({ message: "Order not found" });

      await storage.createAuditLog({
        actorUserId: userId,
        action: "order_fulfilment_updated",
        entityType: "order",
        entityId: String(orderId),
        details: { fulfilmentStatus, assignedLawyerId },
        ipAddress: req.ip,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating order fulfilment:", error);
      res.status(500).json({ message: "Failed to update order fulfilment" });
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
      
      // Audit log for dashboard view
      await storage.createAuditLog({
        actorUserId: userId,
        action: "view_dashboard",
        entityType: "founder_dashboard",
        ipAddress: req.ip,
      });
      
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

  // Get comprehensive verification status (with expiry info)
  app.get("/api/founder/verification-status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const status = await verificationService.getVerificationStatus(userId);
      res.json(status);
    } catch (error) {
      console.error("Error fetching verification status:", error);
      res.status(500).json({ message: "Failed to fetch verification status" });
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

  app.get("/api/founder/receipts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const applications = await storage.getApplicationsByFounder(userId);
      const applicationIds = applications.map(a => a.id);
      
      const allReceipts: any[] = [];
      for (const appId of applicationIds) {
        const receipts = await storage.getReceiptsByApplication(appId);
        allReceipts.push(...receipts);
      }
      
      res.json(allReceipts);
    } catch (error) {
      console.error("Error fetching receipts:", error);
      res.status(500).json({ message: "Failed to fetch receipts" });
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
      
      const [checklist, payment, clarifications, documents, registeredOfficeSubscription] = await Promise.all([
        storage.getChecklistItems(applicationId),
        storage.getPaymentByApplication(applicationId),
        storage.getClarificationsByApplication(applicationId),
        storage.getDocumentsByApplication(applicationId),
        storage.getApplicationRegisteredOfficeSubscription(applicationId),
      ]);
      
      // Get address for registered office if subscription exists and is active
      let registeredOfficeAddress = null;
      if (registeredOfficeSubscription && (registeredOfficeSubscription.status === "active" || registeredOfficeSubscription.status === "beta_activated")) {
        registeredOfficeAddress = await storage.getServiceAddressById(registeredOfficeSubscription.serviceAddressId);
      }
      
      res.json({ 
        application, 
        checklist, 
        payment, 
        clarifications, 
        documents,
        registeredOffice: registeredOfficeSubscription ? {
          subscription: registeredOfficeSubscription,
          address: registeredOfficeAddress,
        } : null
      });
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
      const { checklistItemId, storagePath, filename, docType } = req.body;
      
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      // Check if user is owner, assigned lawyer, or admin
      const isOwner = application.founderUserId === userId;
      const isAssignedLawyer = application.assignedLawyerUserId === userId;
      const userRoles = await storage.getUserRoles(userId);
      const isAdmin = userRoles.includes("admin");
      
      if (!isOwner && !isAssignedLawyer && !isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Update checklist item status if provided
      if (checklistItemId) {
        await storage.updateChecklistItem(parseInt(checklistItemId), {
          status: "provided",
        });
      }
      
      // Require valid storagePath from object storage
      if (!storagePath || !storagePath.startsWith('/objects/')) {
        return res.status(400).json({ 
          message: "Invalid storagePath. Must start with /objects/ from upload response." 
        });
      }
      
      const finalStoragePath = storagePath;
      
      // Create document record
      const document = await storage.createDocument({
        ownerUserId: userId,
        applicationId,
        category: "company",
        docType: docType || "uploaded_document",
        filename: filename || "uploaded_file",
        storagePath: finalStoragePath,
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
  // AI SAFETY GUARDRAILS:
  // - AI outputs are labeled as suggestions requiring human review
  // - AI must NEVER auto-approve or auto-reject
  // - All AI calls log: model, promptVersion, inputHash (not raw text)
  app.post("/api/legal-ai/suggest-activities", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      // Validate request body
      const parsed = aiSuggestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }
      
      const { businessDescription, companyType, applicationId } = parsed.data;
      
      const ai = getOpenAI();
      if (!ai) {
        return res.json({ 
          suggestions: [
            { activity: "General trading and merchandise", category: "Trading" },
            { activity: "Import and export of goods", category: "Trading" },
            { activity: "Consultancy services", category: "Services" },
            { activity: "Business management services", category: "Services" },
          ],
          disclaimer: "Suggestion – human review required",
          message: "AI suggestions temporarily unavailable. Default suggestions provided."
        });
      }
      
      // Create input hash for logging (not raw sensitive text)
      const inputHash = crypto.createHash("sha256")
        .update(JSON.stringify({ businessDescription, companyType }))
        .digest("hex");
      
      const model = "gpt-4o";
      const promptVersion = "v1.0";
      
      const response = await ai.chat.completions.create({
        model,
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
            content: `Business description: ${businessDescription}\nCompany type: ${companyType || "LTD"}`
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
      
      // Log AI event with model, promptVersion, inputHash (not raw text)
      if (applicationId) {
        await storage.createAIEvent({
          applicationId,
          actorUserId: userId,
          feature: "cac_activity_mapping",
          model,
          promptVersion,
          inputHash,
          outputJson: { suggestionsCount: suggestions.length },
        });
      }
      
      // AI Safety: Label output as suggestion requiring human review
      res.json({ 
        suggestions,
        disclaimer: "Suggestion – human review required",
        aiMetadata: { model, promptVersion }
      });
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
        // Create new payment (₦150,000 = 15,000,000 kobo for company incorporation)
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
        if (payment && payment.paystackReference === reference) {
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
      
      // Audit log for dashboard view
      await storage.createAuditLog({
        actorUserId: userId,
        action: "view_dashboard",
        entityType: "lawyer_dashboard",
        ipAddress: req.ip,
      });
      
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

  // ============== EXECUTION DECLARATION ROUTES (Lawyer) ==============
  app.post("/api/lawyer/applications/:id/execution-declaration", isAuthenticated, requireRole("lawyer"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const applicationId = parseInt(req.params.id);
      
      const parsed = executionDeclarationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }
      
      const application = await storage.getApplication(applicationId);
      if (!application || application.assignedLawyerUserId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const declaration = await services.createExecutionDeclaration({
        applicationId,
        lawyerId: userId,
        submissionType: parsed.data.declarationType === "cac_filed" ? "digital" : "physical",
        notes: `Declaration type: ${parsed.data.declarationType}`,
      });
      
      await storage.createAuditLog({
        actorUserId: userId,
        action: "create_declaration",
        entityType: "execution_declaration",
        entityId: declaration.id.toString(),
        details: { applicationId, declarationType: parsed.data.declarationType },
        ipAddress: req.ip,
      });
      
      res.json(declaration);
    } catch (error: any) {
      console.error("Error creating execution declaration:", error);
      res.status(500).json({ message: error.message || "Failed to create declaration" });
    }
  });

  app.get("/api/applications/:id/execution-declarations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const applicationId = parseInt(req.params.id);
      
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      const roles = await getUserRoles(userId);
      const isOwner = application.founderUserId === userId;
      const isAssignedLawyer = application.assignedLawyerUserId === userId;
      const isAdmin = roles.includes("admin");
      
      if (!isOwner && !isAssignedLawyer && !isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const declarations = await services.getDeclarationsByApplication(applicationId);
      res.json(declarations);
    } catch (error) {
      console.error("Error fetching declarations:", error);
      res.status(500).json({ message: "Failed to fetch declarations" });
    }
  });

  // ============== DOCUMENT ACCESS ROUTES ==============
  app.get("/api/documents/:id/download", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const documentId = parseInt(req.params.id);
      
      const doc = await storage.getDocument(documentId);
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      const roles = await getUserRoles(userId);
      const isOwner = doc.ownerUserId === userId;
      const isAdmin = roles.includes("admin");
      
      let isAssignedLawyer = false;
      if (doc.applicationId) {
        const application = await storage.getApplication(doc.applicationId);
        if (application && application.assignedLawyerUserId === userId) {
          isAssignedLawyer = true;
        }
      }
      
      if (!isOwner && !isAssignedLawyer && !isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      let downloadUrl: string | null = null;
      let storageConfigured = false;
      
      if (doc.storagePath) {
        if (doc.storagePath.startsWith('/objects/')) {
          try {
            const objectStorage = new ObjectStorageService();
            const objectFile = await objectStorage.getObjectEntityFile(doc.storagePath);
            downloadUrl = await objectStorage.getObjectEntityDownloadURL(doc.storagePath, 900);
            storageConfigured = true;
          } catch (err) {
            console.error("Error getting download URL:", err);
            downloadUrl = null;
            storageConfigured = false;
          }
        } else if (doc.storagePath.startsWith('http')) {
          downloadUrl = doc.storagePath;
          storageConfigured = true;
        }
      }
      
      res.json({
        id: doc.id,
        filename: doc.filename,
        downloadUrl,
        docType: doc.docType,
        category: doc.category,
        sha256Hash: doc.sha256Hash,
        storageConfigured,
      });
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ message: "Failed to fetch document" });
    }
  });

  // ============== DOCUMENT QUALITY ROUTES (Lawyer) ==============
  app.patch("/api/lawyer/documents/:id/quality", isAuthenticated, requireRole("lawyer"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const documentId = parseInt(req.params.id);
      
      const parsed = documentQualitySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }
      
      const doc = await storage.getDocument(documentId);
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (!doc.applicationId) {
        return res.status(400).json({ message: "Document not associated with an application" });
      }
      
      const application = await storage.getApplication(doc.applicationId);
      if (!application || application.assignedLawyerUserId !== userId) {
        return res.status(403).json({ message: "Access denied - you are not assigned to this application" });
      }
      
      const { qualityStatus, qualityNotes } = parsed.data;
      
      const updated = await services.manualQualityOverride(
        documentId,
        qualityStatus,
        qualityNotes
      );
      
      await storage.createAuditLog({
        actorUserId: userId,
        action: "quality_override",
        entityType: "document_file",
        entityId: documentId.toString(),
        details: { qualityStatus, qualityNotes },
        ipAddress: req.ip,
      });
      
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating document quality:", error);
      res.status(500).json({ message: error.message || "Failed to update quality" });
    }
  });

  app.post("/api/lawyer/documents/:id/analyze", isAuthenticated, requireRole("lawyer"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const documentId = parseInt(req.params.id);
      
      const doc = await storage.getDocument(documentId);
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (!doc.applicationId) {
        return res.status(400).json({ message: "Document not associated with an application" });
      }
      
      const application = await storage.getApplication(doc.applicationId);
      if (!application || application.assignedLawyerUserId !== userId) {
        return res.status(403).json({ message: "Access denied - you are not assigned to this application" });
      }
      
      const result = await services.analyzeDocumentQuality(
        doc.applicationId,
        userId,
        {
          fileName: doc.filename || "unknown",
          fileType: doc.storagePath?.split(".").pop() || "unknown",
          fileSize: 0,
          documentType: doc.docType || "unknown",
        }
      );
      res.json(result);
    } catch (error: any) {
      console.error("Error analyzing document:", error);
      res.status(500).json({ message: error.message || "Failed to analyze document" });
    }
  });

  // ============== CLARIFICATION ROUTES (Lawyer) ==============
  app.post("/api/lawyer/applications/:id/clarifications", isAuthenticated, requireRole("lawyer"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const applicationId = parseInt(req.params.id);
      
      const parsed = clarificationRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }
      
      const application = await storage.getApplication(applicationId);
      if (!application || application.assignedLawyerUserId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { subject, body, useAiDraft } = parsed.data;
      
      let aiDraftJson;
      if (useAiDraft) {
        const founder = await storage.getUser(application.founderUserId);
        const documents = await storage.getDocumentsByApplication(applicationId);
        
        const aiResult = await services.generateClarificationDraft(
          applicationId,
          userId,
          {
            companyName: application.companyName1 || "Unknown Company",
            founderName: founder ? `${founder.firstName} ${founder.lastName}` : "Founder",
            issue: subject,
            existingDocuments: documents.map(d => d.docType || "unknown"),
          }
        );
        
        if (aiResult.draft) {
          aiDraftJson = {
            subject: aiResult.draft.subject,
            message: aiResult.draft.message,
            rationale: aiResult.draft.rationale,
            requiredActions: aiResult.draft.suggestedDocuments,
          };
        }
      }
      
      const clarification = await services.createClarificationRequest({
        applicationId,
        lawyerId: userId,
        founderUserId: application.founderUserId,
        subject: aiDraftJson?.subject || subject,
        message: aiDraftJson?.message || body,
        useAIDraft: useAiDraft,
        aiDraftJson,
      });
      
      await storage.createAuditLog({
        actorUserId: userId,
        action: "create_clarification",
        entityType: "clarification_request",
        entityId: clarification.id.toString(),
        details: { useAiDraft: !!useAiDraft },
        ipAddress: req.ip,
      });
      
      res.json(clarification);
    } catch (error: any) {
      console.error("Error creating clarification:", error);
      res.status(500).json({ message: error.message || "Failed to create clarification" });
    }
  });

  app.post("/api/lawyer/clarifications/:id/send", isAuthenticated, requireRole("lawyer"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const clarificationId = parseInt(req.params.id);
      
      const clarification = await services.sendClarificationRequest(clarificationId, userId);
      
      await storage.createAuditLog({
        actorUserId: userId,
        action: "send_clarification",
        entityType: "clarification_request",
        entityId: clarificationId.toString(),
        ipAddress: req.ip,
      });
      
      res.json(clarification);
    } catch (error: any) {
      console.error("Error sending clarification:", error);
      res.status(500).json({ message: error.message || "Failed to send clarification" });
    }
  });

  app.post("/api/lawyer/clarifications/:id/resolve", isAuthenticated, requireRole("lawyer"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const clarificationId = parseInt(req.params.id);
      
      const clarification = await services.resolveClarification(clarificationId, userId);
      
      await storage.createAuditLog({
        actorUserId: userId,
        action: "resolve_clarification",
        entityType: "clarification_request",
        entityId: clarificationId.toString(),
        ipAddress: req.ip,
      });
      
      res.json(clarification);
    } catch (error: any) {
      console.error("Error resolving clarification:", error);
      res.status(500).json({ message: error.message || "Failed to resolve clarification" });
    }
  });

  app.get("/api/lawyer/clarifications", isAuthenticated, requireRole("lawyer"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const clarifications = await services.getClarificationsByLawyer(userId);
      res.json(clarifications);
    } catch (error) {
      console.error("Error fetching clarifications:", error);
      res.status(500).json({ message: "Failed to fetch clarifications" });
    }
  });

  // AI Draft for clarification
  app.post("/api/lawyer/applications/:id/clarifications/ai-draft", isAuthenticated, requireRole("lawyer"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const applicationId = parseInt(req.params.id);
      
      const parsed = aiDraftSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }
      
      const { category, issue, existingDocuments } = parsed.data;
      
      const application = await storage.getApplication(applicationId);
      if (!application || application.assignedLawyerUserId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const founder = await storage.getUser(application.founderUserId);
      const documents = await storage.getDocumentsByApplication(applicationId);
      
      const draft = await services.generateClarificationDraft(
        applicationId,
        userId,
        {
          companyName: application.companyName1 || "Unknown Company",
          founderName: founder ? `${founder.firstName} ${founder.lastName}` : "Founder",
          issue: issue,
          existingDocuments: existingDocuments || documents.map(d => d.docType || "unknown"),
        }
      );
      
      await storage.createAuditLog({
        actorUserId: userId,
        action: "generate_ai_draft",
        entityType: "company_application",
        entityId: applicationId.toString(),
        details: { category, issue },
        ipAddress: req.ip,
      });
      
      res.json(draft);
    } catch (error: any) {
      console.error("Error generating AI draft:", error);
      res.status(500).json({ message: error.message || "Failed to generate draft" });
    }
  });

  // ============== READINESS ROUTES ==============
  app.get("/api/applications/:id/readiness", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const applicationId = parseInt(req.params.id);
      
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      const roles = await getUserRoles(userId);
      const isOwner = application.founderUserId === userId;
      const isAssignedLawyer = application.assignedLawyerUserId === userId;
      const isAdmin = roles.includes("admin");
      
      if (!isOwner && !isAssignedLawyer && !isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const readiness = await services.getApplicationReadiness(applicationId);
      res.json(readiness);
    } catch (error: any) {
      console.error("Error fetching readiness:", error);
      res.status(500).json({ message: error.message || "Failed to fetch readiness" });
    }
  });

  app.post("/api/applications/:id/readiness/refresh", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const applicationId = parseInt(req.params.id);
      
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      const roles = await getUserRoles(userId);
      const isOwner = application.founderUserId === userId;
      const isAssignedLawyer = application.assignedLawyerUserId === userId;
      const isAdmin = roles.includes("admin");
      
      if (!isOwner && !isAssignedLawyer && !isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updated = await services.updateApplicationReadiness(applicationId);
      res.json(updated);
    } catch (error: any) {
      console.error("Error refreshing readiness:", error);
      res.status(500).json({ message: error.message || "Failed to refresh readiness" });
    }
  });

  // ============== OFFLINE DRAFTS SYNC ==============
  const draftSyncSchema = z.object({
    localId: z.string().min(1, "Local ID is required"),
    applicationId: z.number().optional(),
    data: z.record(z.unknown()),
  });

  app.post("/api/drafts/sync", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      const parsed = draftSyncSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }
      
      const { localId, applicationId, data } = parsed.data;
      
      // ============================================================
      // OFFLINE DATA SAFETY: Reject sensitive data in drafts
      // ============================================================
      // Offline drafts must NOT store: document blobs, ID images, signatures
      // Only non-sensitive text fields allowed
      const sensitiveFieldPatterns = [
        /^data:/i,           // Base64 data URLs
        /blob:/i,            // Blob references
        /file:/i,            // File references
        /signature/i,        // Signature fields
        /idImage/i,          // ID image fields
        /documentBlob/i,     // Document blobs
        /passport.*image/i,  // Passport images
        /nin.*image/i,       // NIN images
        /bvn.*image/i,       // BVN images
      ];
      
      const stringifiedData = JSON.stringify(data);
      for (const pattern of sensitiveFieldPatterns) {
        if (pattern.test(stringifiedData)) {
          console.error(`Draft sync rejected: Contains sensitive data matching ${pattern}`);
          return res.status(400).json({ 
            message: "Draft contains sensitive data that cannot be stored offline. Please remove document files, images, or signatures.",
            rejectedPattern: pattern.toString(),
          });
        }
      }
      
      // Check for large payloads that might contain embedded files
      if (stringifiedData.length > 100000) { // 100KB limit
        return res.status(400).json({ 
          message: "Draft payload too large. Offline drafts should only contain text data, not files or images.",
        });
      }
      
      const draft = await storage.createOfflineDraft({
        founderUserId: userId,
        applicationId: applicationId || undefined,
        clientDraftId: localId,
        draftJson: data as Record<string, any>,
      });
      
      await storage.createAuditLog({
        actorUserId: userId,
        action: "sync_offline_draft",
        entityType: "offline_draft",
        entityId: draft.id.toString(),
        ipAddress: req.ip,
      });
      
      res.json({ success: true, draftId: draft.id });
    } catch (error: any) {
      console.error("Error syncing draft:", error);
      res.status(500).json({ message: error.message || "Failed to sync draft" });
    }
  });

  // ============== RECEIPT ROUTES ==============
  app.get("/api/applications/:id/receipts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const applicationId = parseInt(req.params.id);
      
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      const roles = await getUserRoles(userId);
      const isOwner = application.founderUserId === userId;
      const isAdmin = roles.includes("admin");
      
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const receipts = await services.getReceiptsByApplication(applicationId);
      res.json(receipts);
    } catch (error) {
      console.error("Error fetching receipts:", error);
      res.status(500).json({ message: "Failed to fetch receipts" });
    }
  });

  app.get("/api/receipts/:receiptNumber", async (req: any, res) => {
    try {
      const { receiptNumber } = req.params;
      
      const receipt = await services.getReceipt(receiptNumber);
      if (!receipt) {
        return res.status(404).json({ message: "Receipt not found" });
      }
      
      res.json(receipt);
    } catch (error) {
      console.error("Error fetching receipt:", error);
      res.status(500).json({ message: "Failed to fetch receipt" });
    }
  });

  app.post("/api/receipts/verify", async (req: any, res) => {
    try {
      const { receiptNumber } = req.body;
      
      if (!receiptNumber) {
        return res.status(400).json({ message: "Receipt number required" });
      }
      
      const result = await services.verifyReceipt(receiptNumber);
      res.json(result);
    } catch (error) {
      console.error("Error verifying receipt:", error);
      res.status(500).json({ message: "Failed to verify receipt" });
    }
  });

  // ============== AI EVENTS ROUTES ==============
  app.get("/api/applications/:id/ai-events", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const applicationId = parseInt(req.params.id);
      
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      const roles = await getUserRoles(userId);
      const isAdmin = roles.includes("admin");
      const isAssignedLawyer = application.assignedLawyerUserId === userId;
      
      if (!isAdmin && !isAssignedLawyer) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const events = await storage.getAIEventsByApplication(applicationId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching AI events:", error);
      res.status(500).json({ message: "Failed to fetch AI events" });
    }
  });

  // ============== ADMIN ROUTES ==============
  app.get("/api/admin/dashboard", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const adminId = getUserId(req);
      const stats = await storage.getAdminStats();
      
      // Audit log for dashboard view
      await storage.createAuditLog({
        actorUserId: adminId,
        action: "view_dashboard",
        entityType: "admin_dashboard",
        ipAddress: req.ip,
      });
      
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

      if (role === "admin") {
        const adminUser = await storage.getUser(adminId);
        const SUPER_ADMIN_EMAIL = "service@cellionone.com";
        if (!adminUser || adminUser.email.toLowerCase() !== SUPER_ADMIN_EMAIL) {
          return res.status(403).json({ message: "Only the super admin can assign or remove the admin role" });
        }
      }
      
      if (action === "add") {
        await storage.addUserRole(userId, role);
        
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

  // ============== ADMIN PAYMENT STATE ROUTES ==============
  app.post("/api/admin/applications/:id/payment-state", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const adminId = getUserId(req);
      const applicationId = parseInt(req.params.id);
      
      const parsed = paymentTransitionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }
      
      const { targetState, refundAmountKobo, reason } = parsed.data;
      
      const payment = await storage.getPaymentByApplication(applicationId);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found for application" });
      }
      
      // ============================================================
      // PAYMENT STATE SAFETY: Validate transitions server-side
      // ============================================================
      const currentState = payment.status || "unpaid";
      
      // Define invalid state transitions
      const invalidTransitions: Record<string, string[]> = {
        "released_to_lawyer": ["unpaid", "pending", "refunded_partial", "refunded_full", "chargeback"],
        "refunded_partial": ["unpaid", "pending", "released_to_lawyer"],
        "refunded_full": ["unpaid", "pending", "released_to_lawyer"],
        "chargeback": ["unpaid", "pending"],
      };
      
      const blockedFromStates = invalidTransitions[targetState] || [];
      if (blockedFromStates.includes(currentState)) {
        console.error(`Payment state safety violation: Cannot transition from ${currentState} to ${targetState}`);
        return res.status(400).json({ 
          message: `Invalid payment state transition: Cannot go from '${currentState}' to '${targetState}'`,
          currentState,
          targetState,
        });
      }
      
      // Additional safety: Only allow released_to_lawyer from paid status
      if (targetState === "released_to_lawyer" && currentState !== "paid") {
        return res.status(400).json({ 
          message: `Payment must be in 'paid' status before releasing to lawyer. Current status: ${currentState}`,
        });
      }
      
      let result;
      switch (targetState) {
        case "released_to_lawyer":
          const app = await storage.getApplication(applicationId);
          if (!app?.assignedLawyerUserId) {
            return res.status(400).json({ message: "No lawyer assigned to release payment to" });
          }
          const lawyerFeeKobo = (payment.breakdownJson as any)?.lawyerFee || Math.floor(payment.amountTotalKobo * 0.5);
          result = await services.releaseToLawyer(applicationId, app.assignedLawyerUserId, lawyerFeeKobo);
          break;
        case "refunded_partial":
          result = await services.processRefund(applicationId, reason || "Admin initiated partial refund", true);
          break;
        case "refunded_full":
        case "chargeback":
          result = await services.processRefund(applicationId, reason || "Admin initiated full refund", false);
          break;
        default:
          return res.status(400).json({ message: `Invalid target state: ${targetState}` });
      }
      
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }
      
      await storage.createAuditLog({
        actorUserId: adminId,
        action: "payment_state_changed",
        entityType: "payment",
        entityId: payment.id.toString(),
        details: { fromState: currentState, targetState, refundAmountKobo, reason },
        ipAddress: req.ip,
      });
      
      res.json(result);
    } catch (error: any) {
      console.error("Error transitioning payment state:", error);
      res.status(500).json({ message: error.message || "Failed to transition payment state" });
    }
  });

  // ============== ADMIN RECEIPT ROUTES ==============
  app.get("/api/admin/receipts", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const receipts = await storage.getReceipts();
      res.json(receipts);
    } catch (error: any) {
      console.error("Error fetching receipts:", error);
      res.status(500).json({ message: "Failed to fetch receipts" });
    }
  });

  app.post("/api/admin/receipts", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const adminId = getUserId(req);
      
      const parsed = receiptIssueSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }
      
      const { applicationId, transactionType, dataJson } = parsed.data;
      
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      const scopeMap: Record<string, "identity" | "incorporation" | "post_incorporation" | "document_bundle"> = {
        payment_received: "identity",
        document_issued: "incorporation",
        filing_completed: "post_incorporation",
      };
      
      const receipt = await services.issueReceipt(
        applicationId,
        application.founderUserId,
        scopeMap[transactionType] || "identity",
        "celion"
      );
      
      await storage.createAuditLog({
        actorUserId: adminId,
        action: "issue_receipt",
        entityType: "verification_receipt",
        entityId: receipt.id.toString(),
        details: { transactionType },
        ipAddress: req.ip,
      });
      
      res.json(receipt);
    } catch (error: any) {
      console.error("Error issuing receipt:", error);
      res.status(500).json({ message: error.message || "Failed to issue receipt" });
    }
  });

  app.post("/api/admin/receipts/:id/revoke", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const adminId = getUserId(req);
      const receiptId = parseInt(req.params.id);
      const { reason } = req.body;
      
      if (!reason) {
        return res.status(400).json({ message: "Revocation reason required" });
      }
      
      const receipt = await services.revokeReceipt(receiptId, reason);
      if (!receipt) {
        return res.status(404).json({ message: "Receipt not found" });
      }
      
      await storage.createAuditLog({
        actorUserId: adminId,
        action: "revoke_receipt",
        entityType: "verification_receipt",
        entityId: receiptId.toString(),
        details: { reason },
        ipAddress: req.ip,
      });
      
      res.json(receipt);
    } catch (error: any) {
      console.error("Error revoking receipt:", error);
      res.status(500).json({ message: error.message || "Failed to revoke receipt" });
    }
  });

  // ============== ADMIN AI EVENTS ROUTES ==============
  app.get("/api/admin/ai-events", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const { applicationId } = req.query;
      
      if (applicationId) {
        const events = await storage.getAIEventsByApplication(parseInt(applicationId as string));
        res.json(events);
      } else {
        const allApps = await storage.getAllApplications();
        const allEvents = [];
        for (const app of allApps.slice(0, 50)) {
          const events = await storage.getAIEventsByApplication(app.id);
          allEvents.push(...events);
        }
        res.json(allEvents.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()));
      }
    } catch (error) {
      console.error("Error fetching AI events:", error);
      res.status(500).json({ message: "Failed to fetch AI events" });
    }
  });

  // ============== LAWYER APPLICATION ROUTES ==============
  // Public endpoint - no auth required for lawyers to apply
  app.post("/api/lawyer-applications", async (req: any, res) => {
    try {
      const parsed = insertLawyerApplicationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      
      // Check if application already exists for this email
      const existing = await storage.getLawyerApplicationByEmail(parsed.data.email);
      if (existing) {
        if (existing.status === "pending") {
          return res.status(400).json({ message: "An application with this email is already under review" });
        }
        if (existing.status === "approved") {
          return res.status(400).json({ message: "This email is already associated with an approved lawyer account" });
        }
      }
      
      const application = await storage.createLawyerApplication(parsed.data);
      
      await storage.createAuditLog({
        actorUserId: "system",
        action: "lawyer_application_submitted",
        entityType: "lawyer_application",
        entityId: application.id.toString(),
        details: { email: application.email, barId: application.barId },
        ipAddress: req.ip,
      });
      
      res.json({ message: "Application submitted successfully. We will review your application and get back to you.", application });
    } catch (error) {
      console.error("Error submitting lawyer application:", error);
      res.status(500).json({ message: "Failed to submit application" });
    }
  });

  // Admin endpoints for lawyer applications
  app.get("/api/admin/lawyer-applications", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const { status } = req.query;
      
      if (status === "pending") {
        const applications = await storage.getPendingLawyerApplications();
        res.json(applications);
      } else {
        const applications = await storage.getAllLawyerApplications();
        res.json(applications);
      }
    } catch (error) {
      console.error("Error fetching lawyer applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.get("/api/admin/lawyer-applications/:id", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const applicationId = parseInt(req.params.id);
      const application = await storage.getLawyerApplication(applicationId);
      
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      res.json(application);
    } catch (error) {
      console.error("Error fetching lawyer application:", error);
      res.status(500).json({ message: "Failed to fetch application" });
    }
  });

  app.post("/api/admin/lawyer-applications/:id/review", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const applicationId = parseInt(req.params.id);
      const adminId = getUserId(req);
      
      const parsed = lawyerApplicationReviewSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      
      const { action, rejectionReason } = parsed.data;
      const application = await storage.getLawyerApplication(applicationId);
      
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      if (application.status !== "pending") {
        return res.status(400).json({ message: "This application has already been reviewed" });
      }
      
      if (action === "reject") {
        const updated = await storage.updateLawyerApplication(applicationId, {
          status: "rejected",
          reviewedBy: adminId,
          reviewedAt: new Date(),
          rejectionReason: rejectionReason || "Application did not meet requirements",
        });
        
        await storage.createAuditLog({
          actorUserId: adminId,
          action: "lawyer_application_rejected",
          entityType: "lawyer_application",
          entityId: applicationId.toString(),
          details: { email: application.email, reason: rejectionReason },
          ipAddress: req.ip,
        });
        
        res.json({ message: "Application rejected", application: updated });
      } else {
        let userId: string;
        let isExistingAccount = false;

        const existingUser = await storage.getUserByEmail(application.email.toLowerCase());

        if (existingUser) {
          userId = existingUser.id;
          isExistingAccount = true;
          console.log(`[Lawyer Approval] Existing account found for ${application.email}, adding lawyer role`);
        } else {
          const authService = await import("./services/authService");
          const tempPassword = crypto.randomBytes(12).toString("base64").slice(0, 12) + "Ax1!";

          const registerResult = await authService.registerUser({
            email: application.email,
            password: tempPassword,
            firstName: application.firstName,
            lastName: application.lastName,
          }, `${req.protocol}://${req.get("host")}`);

          if (!registerResult.success || !registerResult.user) {
            console.error("[Lawyer Approval] Registration failed:", registerResult.message);
            return res.status(500).json({ message: registerResult.message || "Failed to create lawyer user account" });
          }

          userId = registerResult.user.id;
        }

        await storage.addUserRole(userId, "lawyer");

        await storage.upsertLawyerProfile({
          userId,
          firmName: application.firmName || undefined,
          barId: application.barId,
          serviceRegions: application.serviceRegions || [],
          isActive: true,
        });

        const updated = await storage.updateLawyerApplication(applicationId, {
          status: "approved",
          reviewedBy: adminId,
          reviewedAt: new Date(),
          createdUserId: userId,
        });

        await storage.createAuditLog({
          actorUserId: adminId,
          action: "lawyer_application_approved",
          entityType: "lawyer_application",
          entityId: applicationId.toString(),
          details: { email: application.email, userId, isExistingAccount },
          ipAddress: req.ip,
        });

        const message = isExistingAccount
          ? "Application approved. Lawyer role added to existing account."
          : "Application approved. Lawyer account created and verification email sent.";

        res.json({ message, application: updated });
      }
    } catch (error: any) {
      console.error("Error reviewing lawyer application:", error);
      res.status(500).json({ message: error.message || "Failed to review application" });
    }
  });

  // ============== REGISTERED OFFICE ENDPOINTS ==============

  // GET /api/registered-office/options - Get tiers, pricing, and masked location
  app.get("/api/registered-office/options", async (req, res) => {
    try {
      const options = await registeredOfficeService.getOptions();
      res.json(options);
    } catch (error: any) {
      console.error("Error fetching registered office options:", error);
      res.status(500).json({ message: error.message || "Failed to fetch options" });
    }
  });

  // GET /api/registered-office/service-policy - Get service limits and policy for founders
  app.get("/api/registered-office/service-policy", async (req, res) => {
    try {
      const limits = mailroomService.getServiceLimits();
      res.json(limits);
    } catch (error: any) {
      console.error("Error fetching service policy:", error);
      res.status(500).json({ message: error.message || "Failed to fetch service policy" });
    }
  });

  // POST /api/registered-office/select - Select registered office for an application (Wizard path)
  app.post("/api/registered-office/select", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const parsed = registeredOfficeSelectSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { applicationId, tier } = parsed.data;

      // Verify the application belongs to this founder
      const application = await storage.getApplication(applicationId);
      if (!application || application.founderUserId !== userId) {
        return res.status(403).json({ message: "Application not found or access denied" });
      }

      const subscription = await registeredOfficeService.selectForApplication(applicationId, userId, tier);

      await storage.createAuditLog({
        actorUserId: userId,
        action: "registered_office_selected",
        entityType: "registered_office_subscription",
        entityId: subscription.id.toString(),
        details: { applicationId, tier },
        ipAddress: req.ip,
      });

      res.json({ message: "Registered office selected", subscription });
    } catch (error: any) {
      console.error("Error selecting registered office:", error);
      res.status(500).json({ message: error.message || "Failed to select registered office" });
    }
  });

  // POST /api/registered-office/subscribe - Subscribe to standalone registered office
  app.post("/api/registered-office/subscribe", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const parsed = registeredOfficeSubscribeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { tier } = parsed.data;

      const subscription = await registeredOfficeService.subscribeStandalone(userId, tier);

      await storage.createAuditLog({
        actorUserId: userId,
        action: "registered_office_selected_standalone",
        entityType: "registered_office_subscription",
        entityId: subscription.id.toString(),
        details: { tier },
        ipAddress: req.ip,
      });

      res.json({ message: "Registered office subscription created", subscription });
    } catch (error: any) {
      console.error("Error subscribing to registered office:", error);
      if ((error as any).code === "VERIFICATION_REQUIRED") {
        return res.status(409).json({ code: "VERIFICATION_REQUIRED", message: error.message });
      }
      res.status(500).json({ message: error.message || "Failed to subscribe" });
    }
  });

  // GET /api/registered-office/subscription - Get subscription status
  app.get("/api/registered-office/subscription", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const applicationId = req.query.applicationId ? parseInt(req.query.applicationId as string) : undefined;
      const standalone = req.query.standalone === "true";

      const subscription = await registeredOfficeService.getSubscription({
        applicationId,
        founderId: userId,
        standalone,
      });

      if (!subscription) {
        return res.json({ subscription: null });
      }

      // Get address based on subscription status
      const address = await registeredOfficeService.getAddressForSubscription(subscription.id);

      // Get mail preference if applicable
      let mailPreference = null;
      if (subscription.tier === "office_plus_mail" && subscription.status === "active") {
        mailPreference = await mailroomService.getPreference(subscription.id);
      }

      // If viewing full address, log it
      if (subscription.status === "active") {
        await storage.createAuditLog({
          actorUserId: userId,
          action: "registered_office_address_viewed",
          entityType: "registered_office_subscription",
          entityId: subscription.id.toString(),
          ipAddress: req.ip,
        });
      }

      res.json({ subscription, address, mailPreference });
    } catch (error: any) {
      console.error("Error fetching subscription:", error);
      res.status(500).json({ message: error.message || "Failed to fetch subscription" });
    }
  });

  // GET /api/registered-office/subscriptions - Get all subscriptions for founder
  app.get("/api/registered-office/subscriptions", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const subscriptions = await registeredOfficeService.getAllSubscriptionsForFounder(userId);
      res.json({ subscriptions });
    } catch (error: any) {
      console.error("Error fetching subscriptions:", error);
      res.status(500).json({ message: error.message || "Failed to fetch subscriptions" });
    }
  });

  app.post("/api/registered-office/confirm-as-registered-address", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const subscription = await registeredOfficeService.getSubscription({ founderId: userId, standalone: true });

      if (!subscription || subscription.status !== "active") {
        return res.status(400).json({ message: "You need an active registered office subscription first" });
      }

      if (subscription.useAsRegisteredAddress) {
        return res.status(400).json({ message: "This address is already confirmed as your registered address" });
      }

      const consentText = "I confirm that I want to use this address as the registered office for my company. " +
        "A proof of address (utility bill) will be obtained from the virtual office provider and shared with my assigned lawyer for CAC filing " +
        "and with authorised third parties (e.g. banks) for registrations processed through Cellion One. " +
        "I understand that I will not be able to download the proof of address directly — it is shared only with verified parties to prevent fraud.";

      const [updated] = await db.update(registeredOfficeSubscriptions)
        .set({
          useAsRegisteredAddress: true,
          registeredAddressConfirmedAt: new Date(),
          registeredAddressConsentText: consentText,
          proofOfAddressStatus: "pending",
          updatedAt: new Date(),
        })
        .where(eq(registeredOfficeSubscriptions.id, subscription.id))
        .returning();

      await storage.createAuditLog({
        actorUserId: userId,
        action: "registered_address_consent_given",
        entityType: "registered_office_subscription",
        entityId: subscription.id.toString(),
        details: { consentText },
        ipAddress: req.ip,
      });

      const address = await registeredOfficeService.getAddressForSubscription(subscription.id);

      res.json({
        message: "Address confirmed as your registered office",
        subscription: updated,
        address,
      });
    } catch (error: any) {
      console.error("Error confirming registered address:", error);
      res.status(500).json({ message: error.message || "Failed to confirm registered address" });
    }
  });

  app.get("/api/registered-office/proof-of-address-status", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const subscription = await registeredOfficeService.getSubscription({ founderId: userId, standalone: true });

      if (!subscription) {
        return res.json({ status: null });
      }

      res.json({
        useAsRegisteredAddress: subscription.useAsRegisteredAddress,
        proofOfAddressStatus: subscription.proofOfAddressStatus,
        confirmedAt: subscription.registeredAddressConfirmedAt,
      });
    } catch (error: any) {
      console.error("Error fetching PoA status:", error);
      res.status(500).json({ message: "Failed to fetch proof of address status" });
    }
  });

  // POST /api/registered-office/preferences - Set mail handling preferences
  app.post("/api/registered-office/preferences", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const parsed = mailPreferencesSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { subscriptionId, preferenceType, isSensitiveAutoEscalationEnabled } = parsed.data;

      // Verify subscription belongs to this founder
      const subscription = await registeredOfficeService.getSubscriptionById(subscriptionId);
      if (!subscription || subscription.founderId !== userId) {
        return res.status(403).json({ message: "Subscription not found or access denied" });
      }

      const preference = await mailroomService.setPreference(
        subscriptionId,
        userId,
        preferenceType,
        isSensitiveAutoEscalationEnabled ?? true
      );

      await storage.createAuditLog({
        actorUserId: userId,
        action: "mail_preferences_updated",
        entityType: "mail_handling_preference",
        entityId: preference.id.toString(),
        details: { subscriptionId, preferenceType, isSensitiveAutoEscalationEnabled },
        ipAddress: req.ip,
      });

      res.json({ message: "Mail preferences updated", preference });
    } catch (error: any) {
      console.error("Error updating mail preferences:", error);
      res.status(500).json({ message: error.message || "Failed to update preferences" });
    }
  });

  // GET /api/founder/mail - Get founder's mail items
  app.get("/api/founder/mail", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const mailItems = await mailroomService.getMailItemsForFounder(userId);
      const pendingApprovals = await mailroomService.getPendingApprovals(userId);
      res.json({ mailItems, pendingApprovals });
    } catch (error: any) {
      console.error("Error fetching mail:", error);
      res.status(500).json({ message: error.message || "Failed to fetch mail" });
    }
  });

  // POST /api/founder/mail/:id/approve - Approve mail action
  app.post("/api/founder/mail/:id/approve", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const mailItemId = parseInt(req.params.id);

      const parsed = mailApprovalDecisionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { decision, decisionReason } = parsed.data;

      // Verify mail item belongs to this founder
      const mailItem = await mailroomService.getMailItemById(mailItemId);
      if (!mailItem || mailItem.founderId !== userId) {
        return res.status(403).json({ message: "Mail item not found or access denied" });
      }

      const result = await mailroomService.decideApproval(mailItemId, decision, decisionReason);

      await storage.createAuditLog({
        actorUserId: userId,
        action: "mail_approval_decision",
        entityType: "mail_approval_request",
        entityId: result.approvalRequest.id.toString(),
        details: { mailItemId, decision, decisionReason },
        ipAddress: req.ip,
      });

      res.json({ message: `Mail ${decision}`, ...result });
    } catch (error: any) {
      console.error("Error processing mail approval:", error);
      res.status(500).json({ message: error.message || "Failed to process approval" });
    }
  });

  // ============== ADMIN REGISTERED OFFICE ENDPOINTS ==============

  // POST /api/admin/registered-office/:subscriptionId/activate-beta
  app.post("/api/admin/registered-office/:subscriptionId/activate-beta", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const adminId = getUserId(req);
      const subscriptionId = parseInt(req.params.subscriptionId);

      const parsed = betaActivationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { reason } = parsed.data;

      const subscription = await registeredOfficeService.getSubscriptionById(subscriptionId);
      if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
      }

      const activated = await registeredOfficeService.activateBeta(subscriptionId, adminId, reason);

      await storage.createAuditLog({
        actorUserId: adminId,
        action: "registered_office_activated_beta",
        entityType: "registered_office_subscription",
        entityId: subscriptionId.toString(),
        details: { reason, founderId: subscription.founderId },
        ipAddress: req.ip,
      });

      res.json({ message: "Subscription activated (beta)", subscription: activated });
    } catch (error: any) {
      console.error("Error activating subscription:", error);
      res.status(500).json({ message: error.message || "Failed to activate subscription" });
    }
  });

  app.get("/api/admin/registered-office/proof-of-address-requests", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const requests = await db.select({
        subscription: registeredOfficeSubscriptions,
        founder: {
          id: usersTable.id,
          email: usersTable.email,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
        },
      })
        .from(registeredOfficeSubscriptions)
        .innerJoin(usersTable, eq(registeredOfficeSubscriptions.founderId, usersTable.id))
        .where(eq(registeredOfficeSubscriptions.useAsRegisteredAddress, true))
        .orderBy(desc(registeredOfficeSubscriptions.registeredAddressConfirmedAt));

      const withAddresses = await Promise.all(
        requests.map(async (r) => {
          const address = await registeredOfficeService.getAddressForSubscription(r.subscription.id);
          return { ...r, address };
        })
      );

      res.json({ requests: withAddresses });
    } catch (error: any) {
      console.error("Error fetching PoA requests:", error);
      res.status(500).json({ message: "Failed to fetch proof of address requests" });
    }
  });

  app.post("/api/admin/registered-office/:subscriptionId/upload-proof-of-address", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const adminId = getUserId(req);
      const subscriptionId = parseInt(req.params.subscriptionId);

      const subscription = await registeredOfficeService.getSubscriptionById(subscriptionId);
      if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
      }
      if (!subscription.useAsRegisteredAddress) {
        return res.status(400).json({ message: "This subscription has not been confirmed for registered address use" });
      }

      const { fileName, contentType } = req.body;
      if (!fileName || !contentType) {
        return res.status(400).json({ message: "fileName and contentType are required" });
      }

      const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(contentType)) {
        return res.status(400).json({ message: "Only PDF, JPEG, PNG, and WebP files are allowed" });
      }

      const objectPath = `.private/proof-of-address/${subscriptionId}/${Date.now()}-${fileName}`;
      const objectStorageService = new ObjectStorageService();
      const uploadUrl = await objectStorageService.getUploadUrl(objectPath, contentType);

      await db.update(registeredOfficeSubscriptions)
        .set({
          proofOfAddressPath: objectPath,
          proofOfAddressUploadedAt: new Date(),
          proofOfAddressStatus: "uploaded",
          updatedAt: new Date(),
        })
        .where(eq(registeredOfficeSubscriptions.id, subscriptionId));

      await storage.createAuditLog({
        actorUserId: adminId,
        action: "proof_of_address_uploaded",
        entityType: "registered_office_subscription",
        entityId: subscriptionId.toString(),
        details: { fileName, founderId: subscription.founderId },
        ipAddress: req.ip,
      });

      res.json({ uploadUrl, objectPath });
    } catch (error: any) {
      console.error("Error generating PoA upload URL:", error);
      res.status(500).json({ message: error.message || "Failed to generate upload URL" });
    }
  });

  app.post("/api/admin/registered-office/:subscriptionId/verify-proof-of-address", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const adminId = getUserId(req);
      const subscriptionId = parseInt(req.params.subscriptionId);

      const subscription = await registeredOfficeService.getSubscriptionById(subscriptionId);
      if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
      }
      if (subscription.proofOfAddressStatus !== "uploaded") {
        return res.status(400).json({ message: "Proof of address must be uploaded before it can be verified" });
      }

      await db.update(registeredOfficeSubscriptions)
        .set({
          proofOfAddressStatus: "verified",
          updatedAt: new Date(),
        })
        .where(eq(registeredOfficeSubscriptions.id, subscriptionId));

      await storage.createAuditLog({
        actorUserId: adminId,
        action: "proof_of_address_verified",
        entityType: "registered_office_subscription",
        entityId: subscriptionId.toString(),
        details: { founderId: subscription.founderId },
        ipAddress: req.ip,
      });

      res.json({ message: "Proof of address verified successfully" });
    } catch (error: any) {
      console.error("Error verifying PoA:", error);
      res.status(500).json({ message: error.message || "Failed to verify proof of address" });
    }
  });

  app.get("/api/admin/registered-office/:subscriptionId/proof-of-address/view", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const subscriptionId = parseInt(req.params.subscriptionId);
      const subscription = await registeredOfficeService.getSubscriptionById(subscriptionId);
      if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
      }

      const objectStorageService = new ObjectStorageService();
      let proofPath = subscription.proofOfAddressPath;
      let source = "subscription";

      if (!proofPath) {
        const building = await storage.getServiceAddressById(subscription.serviceAddressId);
        if (building?.utilityBillPath && building.utilityBillStatus === "current") {
          proofPath = building.utilityBillPath;
          source = "building";
        }
      }

      if (!proofPath) {
        return res.status(404).json({ message: "Proof of address not found" });
      }

      const downloadUrl = await objectStorageService.getDownloadUrl(proofPath);
      res.json({ downloadUrl, source });
    } catch (error: any) {
      console.error("Error getting PoA view URL:", error);
      res.status(500).json({ message: "Failed to get proof of address" });
    }
  });

  app.get("/api/lawyer/registered-office/:subscriptionId/proof-of-address", isAuthenticated, requireRole("lawyer"), async (req: any, res) => {
    try {
      const lawyerId = getUserId(req);
      const subscriptionId = parseInt(req.params.subscriptionId);

      const subscription = await registeredOfficeService.getSubscriptionById(subscriptionId);
      if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
      }

      const objectStorageService = new ObjectStorageService();
      let proofPath = subscription.proofOfAddressPath;
      let proofStatus = subscription.proofOfAddressStatus;
      let source = "subscription";

      if (!proofPath) {
        const building = await storage.getServiceAddressById(subscription.serviceAddressId);
        if (building?.utilityBillPath && building.utilityBillStatus === "current") {
          proofPath = building.utilityBillPath;
          proofStatus = "verified";
          source = "building";
        }
      }

      if (!proofPath) {
        return res.status(404).json({ message: "Proof of address not found" });
      }

      if (proofStatus !== "verified") {
        return res.status(400).json({ message: "Proof of address has not been verified yet" });
      }

      const downloadUrl = await objectStorageService.getDownloadUrl(proofPath);

      await storage.logSensitiveDataAccess({
        accessorUserId: lawyerId,
        targetUserId: subscription.founderId,
        dataType: "proof_of_address",
        action: "download",
        ipAddress: req.ip,
        userAgent: req.get("user-agent") || "unknown",
      });

      res.json({ downloadUrl, source });
    } catch (error: any) {
      console.error("Error getting PoA for lawyer:", error);
      res.status(500).json({ message: "Failed to get proof of address" });
    }
  });

  // POST /api/admin/mail/intake - Admin mail intake
  app.post("/api/admin/mail/intake", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const adminId = getUserId(req);
      const parsed = mailIntakeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { subscriptionId, senderName, senderType, envelopePhotoDocId, isSensitive } = parsed.data;

      const result = await mailroomService.intakeMail(
        subscriptionId,
        senderName,
        senderType,
        envelopePhotoDocId,
        isSensitive ?? false
      );

      await storage.createAuditLog({
        actorUserId: adminId,
        action: "mail_item_received",
        entityType: "mail_item",
        entityId: result.mailItem.id.toString(),
        details: { subscriptionId, senderName, senderType, isSensitive },
        ipAddress: req.ip,
      });

      if (result.approvalRequest) {
        await storage.createAuditLog({
          actorUserId: adminId,
          action: "mail_approval_requested",
          entityType: "mail_approval_request",
          entityId: result.approvalRequest.id.toString(),
          details: { mailItemId: result.mailItem.id },
          ipAddress: req.ip,
        });
      }

      res.json({ message: "Mail intake recorded", ...result });
    } catch (error: any) {
      console.error("Error recording mail intake:", error);
      res.status(500).json({ message: error.message || "Failed to record mail intake" });
    }
  });

  // POST /api/admin/mail/:id/upload-scan - Admin upload scanned document
  app.post("/api/admin/mail/:id/upload-scan", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const adminId = getUserId(req);
      const mailItemId = parseInt(req.params.id);

      const parsed = mailScanUploadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { scannedDocId } = parsed.data;

      const mailItem = await mailroomService.uploadScan(mailItemId, scannedDocId);

      await storage.createAuditLog({
        actorUserId: adminId,
        action: "mail_item_scanned",
        entityType: "mail_item",
        entityId: mailItemId.toString(),
        details: { scannedDocId },
        ipAddress: req.ip,
      });

      res.json({ message: "Scan uploaded", mailItem });
    } catch (error: any) {
      console.error("Error uploading scan:", error);
      res.status(500).json({ message: error.message || "Failed to upload scan" });
    }
  });

  // POST /api/admin/mail/:id/mark-forwarded - Admin mark mail as forwarded
  app.post("/api/admin/mail/:id/mark-forwarded", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const adminId = getUserId(req);
      const mailItemId = parseInt(req.params.id);

      const parsed = mailForwardSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { courierName, trackingNumber } = parsed.data;

      const mailItem = await mailroomService.markForwarded(mailItemId, courierName, trackingNumber);

      await storage.createAuditLog({
        actorUserId: adminId,
        action: "mail_forward_updated",
        entityType: "mail_item",
        entityId: mailItemId.toString(),
        details: { courierName, trackingNumber },
        ipAddress: req.ip,
      });

      res.json({ message: "Mail marked as forwarded", mailItem });
    } catch (error: any) {
      console.error("Error marking mail as forwarded:", error);
      res.status(500).json({ message: error.message || "Failed to mark as forwarded" });
    }
  });

  // GET /api/admin/mail - Get all pending mail items for admin
  app.get("/api/admin/mail", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const mailItems = await mailroomService.getAllPendingMailItems();
      res.json({ mailItems });
    } catch (error: any) {
      console.error("Error fetching admin mail:", error);
      res.status(500).json({ message: error.message || "Failed to fetch mail" });
    }
  });

  // GET /api/admin/mailroom/stats - Get mailroom statistics
  app.get("/api/admin/mailroom/stats", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const [
        activeSubscriptions,
        pendingMailItems,
        approvalItems,
        scanItems,
        forwardItems
      ] = await Promise.all([
        storage.getActiveMailSubscriptions(),
        storage.getMailItemsByStatus("received"),
        storage.getMailItemsByStatus("pending_approval"),
        storage.getMailItemsByStatus("approved_scan"),
        storage.getMailItemsByStatus("approved_forward"),
      ]);

      res.json({
        totalActive: activeSubscriptions.length,
        pendingIntake: pendingMailItems.length,
        pendingApproval: approvalItems.length,
        pendingScan: scanItems.length,
        pendingForward: forwardItems.length + pendingMailItems.filter(m => m.status === "received").length,
      });
    } catch (error: any) {
      console.error("Error fetching mailroom stats:", error);
      res.status(500).json({ message: error.message || "Failed to fetch stats" });
    }
  });

  // GET /api/admin/mailroom/items - Get all mail items for admin
  app.get("/api/admin/mailroom/items", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const mailItems = await storage.getAllMailItems();
      
      // Enrich with subscription/user data
      const enrichedItems = await Promise.all(mailItems.map(async (item) => {
        const subscription = await storage.getRegisteredOfficeSubscriptionById(item.subscriptionId);
        if (subscription) {
          const user = await storage.getUser(subscription.founderId);
          return {
            ...item,
            subscription: {
              userId: subscription.founderId,
              userEmail: user?.email || "unknown",
              userName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email : "Unknown",
            }
          };
        }
        return { ...item, subscription: null };
      }));

      res.json(enrichedItems);
    } catch (error: any) {
      console.error("Error fetching mailroom items:", error);
      res.status(500).json({ message: error.message || "Failed to fetch items" });
    }
  });

  // GET /api/admin/mailroom/subscriptions - Get all registered office subscriptions
  app.get("/api/admin/mailroom/subscriptions", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const subscriptions = await storage.getAllRegisteredOfficeSubscriptions();
      
      // Enrich with user data
      const enrichedSubs = await Promise.all(subscriptions.map(async (sub) => {
        const user = await storage.getUser(sub.founderId);
        return {
          id: sub.id,
          userId: sub.founderId,
          tier: sub.tier,
          status: sub.status,
          userEmail: user?.email || "unknown",
          userName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email : "Unknown",
        };
      }));

      res.json(enrichedSubs);
    } catch (error: any) {
      console.error("Error fetching subscriptions:", error);
      res.status(500).json({ message: error.message || "Failed to fetch subscriptions" });
    }
  });

  // GET /api/admin/mailroom/service-limits - Get service limits and policy
  app.get("/api/admin/mailroom/service-limits", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const limits = mailroomService.getServiceLimits();
      res.json(limits);
    } catch (error: any) {
      console.error("Error fetching service limits:", error);
      res.status(500).json({ message: error.message || "Failed to fetch service limits" });
    }
  });

  // POST /api/admin/mailroom/intake - Record new mail item
  app.post("/api/admin/mailroom/intake", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const { 
        subscriptionId, 
        senderLabel, 
        itemType, 
        isSensitive, 
        confirmedOfficialMail,  // Admin confirmation for non-official mail
        overageReason           // Required if monthly limit exceeded
      } = req.body;
      
      const result = await mailroomService.intakeMail(
        subscriptionId,
        senderLabel || "Unknown Sender",
        itemType || "commercial",
        undefined, // envelopePhotoDocId
        isSensitive || false,
        {
          confirmedOfficialMail: confirmedOfficialMail || false,
          overageReason: overageReason || undefined,
        }
      );

      await storage.createAuditLog({
        actorUserId: req.user.id,
        action: "mail_intake",
        entityType: "mail_item",
        entityId: result.mailItem.id.toString(),
        details: { senderLabel, itemType, isSensitive, isOverage: result.isOverage },
        ipAddress: req.ip || null,
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error recording mail intake:", error);
      
      // Return specific error codes for UI handling
      if ((error as any).code === "SUBSCRIPTION_EXPIRED") {
        return res.status(400).json({ 
          message: error.message, 
          code: "SUBSCRIPTION_EXPIRED",
          suggestAction: "return_to_sender"
        });
      }
      if ((error as any).code === "OFFICIAL_MAIL_REQUIRED") {
        return res.status(400).json({ 
          message: error.message, 
          code: "OFFICIAL_MAIL_REQUIRED",
          requireConfirmation: true
        });
      }
      if ((error as any).code === "OVERAGE_REASON_REQUIRED") {
        return res.status(400).json({ 
          message: error.message, 
          code: "OVERAGE_REASON_REQUIRED",
          requireReason: true
        });
      }
      
      res.status(500).json({ message: error.message || "Failed to record mail" });
    }
  });

  // POST /api/admin/mailroom/return-to-sender - Record mail returned to sender (for expired subscriptions)
  app.post("/api/admin/mailroom/return-to-sender", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const { subscriptionId, senderLabel, itemType, notes } = req.body;
      
      const mailItem = await mailroomService.returnToSender(
        subscriptionId,
        senderLabel || "Unknown Sender",
        itemType || "commercial",
        notes
      );

      await storage.createAuditLog({
        actorUserId: req.user.id,
        action: "mail_intake_blocked_subscription_expired",
        entityType: "mail_item",
        entityId: mailItem.id.toString(),
        details: { senderLabel, itemType, action: "returned_to_sender" },
        ipAddress: req.ip || null,
      });

      res.json({ mailItem, message: "Mail recorded as returned to sender" });
    } catch (error: any) {
      console.error("Error recording return to sender:", error);
      res.status(500).json({ message: error.message || "Failed to record return to sender" });
    }
  });

  // POST /api/admin/mailroom/:id/scan - Record scanned document
  app.post("/api/admin/mailroom/:id/scan", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const mailItemId = parseInt(req.params.id);
      const { fileUrl } = req.body;

      if (!fileUrl) {
        return res.status(400).json({ message: "File URL is required" });
      }

      const mailItem = await mailroomService.uploadScan(mailItemId, fileUrl);

      await storage.createAuditLog({
        actorUserId: req.user.id,
        action: "mail_scan_complete",
        entityType: "mail_item",
        entityId: mailItemId.toString(),
        details: { fileUrl },
        ipAddress: req.ip || null,
      });

      res.json(mailItem);
    } catch (error: any) {
      console.error("Error recording scan:", error);
      res.status(500).json({ message: error.message || "Failed to record scan" });
    }
  });

  // POST /api/admin/mailroom/:id/forward - Record mail forwarding
  app.post("/api/admin/mailroom/:id/forward", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const mailItemId = parseInt(req.params.id);
      const { trackingNumber, notes } = req.body;

      const mailItem = await mailroomService.markForwarded(mailItemId, "Courier", trackingNumber || null);

      await storage.createAuditLog({
        actorUserId: req.user.id,
        action: "mail_forwarded",
        entityType: "mail_item",
        entityId: mailItemId.toString(),
        details: { trackingNumber, notes },
        ipAddress: req.ip || null,
      });

      res.json(mailItem);
    } catch (error: any) {
      console.error("Error recording forward:", error);
      res.status(500).json({ message: error.message || "Failed to record forward" });
    }
  });

  // POST /api/admin/mailroom/:id/discard - Discard mail item
  app.post("/api/admin/mailroom/:id/discard", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const mailItemId = parseInt(req.params.id);
      
      await storage.updateMailItem(mailItemId, { status: "discarded" });

      await storage.createAuditLog({
        actorUserId: req.user.id,
        action: "mail_discarded",
        entityType: "mail_item",
        entityId: mailItemId.toString(),
        details: {},
        ipAddress: req.ip || null,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error discarding mail:", error);
      res.status(500).json({ message: error.message || "Failed to discard mail" });
    }
  });

  // GET /api/registered-office/mail - Get founder's mail data
  app.get("/api/registered-office/mail", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const subscription = await storage.getUserActiveRegisteredOfficeSubscription(userId);
      if (!subscription || subscription.tier !== "office_plus_mail") {
        return res.status(403).json({ message: "Mail handling requires an active Office + Mail subscription" });
      }

      const [preferences, mailItems, pendingApprovals] = await Promise.all([
        storage.getMailHandlingPreference(subscription.id),
        mailroomService.getMailItemsForFounder(userId),
        mailroomService.getPendingApprovals(userId),
      ]);

      res.json({
        preferences,
        mailItems,
        pendingApprovals,
      });
    } catch (error: any) {
      console.error("Error fetching founder mail:", error);
      res.status(500).json({ message: error.message || "Failed to fetch mail" });
    }
  });

  // POST /api/registered-office/mail/:id/approve - Founder approval decision
  app.post("/api/registered-office/mail/:id/approve", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const mailItemId = parseInt(req.params.id);
      const { action } = req.body;

      // Verify the mail item belongs to the user's subscription
      const subscription = await storage.getUserActiveRegisteredOfficeSubscription(userId);
      if (!subscription) {
        return res.status(403).json({ message: "No active subscription" });
      }

      const mailItem = await mailroomService.getMailItemById(mailItemId);
      if (!mailItem || mailItem.subscriptionId !== subscription.id) {
        return res.status(403).json({ message: "Mail item not found or unauthorized" });
      }

      // Map user action to approval decision
      // approve/scan/forward = approve the mail action
      // reject/discard = reject/archive the mail
      const decision: "approved" | "rejected" = 
        (action === "reject" || action === "discard") ? "rejected" : "approved";

      const result = await mailroomService.decideApproval(mailItemId, decision, `Founder decision: ${action}`);

      await storage.createAuditLog({
        actorUserId: userId,
        action: "mail_approval_decision",
        entityType: "mail_item",
        entityId: mailItemId.toString(),
        details: { action },
        ipAddress: req.ip || null,
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error processing approval:", error);
      res.status(500).json({ message: error.message || "Failed to process approval" });
    }
  });

  // ============== LEGAL AI CHAT ==============

  app.get("/api/legal-chat/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const conversations = await db
        .select()
        .from(legalChatConversations)
        .where(eq(legalChatConversations.userId, userId))
        .orderBy(desc(legalChatConversations.updatedAt));

      res.json(conversations);
    } catch (error: any) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: error.message || "Failed to fetch conversations" });
    }
  });

  app.post("/api/legal-chat/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const [conversation] = await db
        .insert(legalChatConversations)
        .values({ userId, title: "New Conversation" })
        .returning();

      res.json(conversation);
    } catch (error: any) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: error.message || "Failed to create conversation" });
    }
  });

  app.get("/api/legal-chat/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const conversationId = parseInt(req.params.id);
      if (isNaN(conversationId)) return res.status(400).json({ message: "Invalid conversation ID" });

      const [conversation] = await db
        .select()
        .from(legalChatConversations)
        .where(eq(legalChatConversations.id, conversationId));

      if (!conversation || conversation.userId !== userId) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const messages = await db
        .select()
        .from(legalChatMessages)
        .where(eq(legalChatMessages.conversationId, conversationId))
        .orderBy(legalChatMessages.createdAt);

      res.json(messages);
    } catch (error: any) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: error.message || "Failed to fetch messages" });
    }
  });

  app.post("/api/legal-chat/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const conversationId = parseInt(req.params.id);
      if (isNaN(conversationId)) return res.status(400).json({ message: "Invalid conversation ID" });

      const { content } = req.body;
      if (!content || typeof content !== "string" || !content.trim()) {
        return res.status(400).json({ message: "Message content is required" });
      }

      const [conversation] = await db
        .select()
        .from(legalChatConversations)
        .where(eq(legalChatConversations.id, conversationId));

      if (!conversation || conversation.userId !== userId) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const [userMessage] = await db
        .insert(legalChatMessages)
        .values({ conversationId, role: "user", content: content.trim() })
        .returning();

      const existingMessages = await db
        .select()
        .from(legalChatMessages)
        .where(eq(legalChatMessages.conversationId, conversationId))
        .orderBy(legalChatMessages.createdAt);

      const isFirstMessage = existingMessages.length === 1;
      if (isFirstMessage) {
        const title = content.trim().substring(0, 50) + (content.trim().length > 50 ? "..." : "");
        await db
          .update(legalChatConversations)
          .set({ title, updatedAt: new Date() })
          .where(eq(legalChatConversations.id, conversationId));
      } else {
        await db
          .update(legalChatConversations)
          .set({ updatedAt: new Date() })
          .where(eq(legalChatConversations.id, conversationId));
      }

      const ai = getOpenAI();
      if (!ai) {
        return res.status(503).json({ message: "AI service is not configured" });
      }

      const recentMessages = existingMessages.slice(-20);
      const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
        {
          role: "system",
          content: `You are Cellion Legal AI, an expert assistant on Nigerian corporate law and the Companies and Allied Matters Act (CAMA) 2020. You help founders understand:
- Company incorporation processes with the Corporate Affairs Commission (CAC)
- Post-incorporation requirements (TIN, VAT, PAYE, company seal)
- Compliance obligations (annual returns, tax filings)
- Director and shareholder responsibilities
- Business name registration vs company incorporation
- Share capital requirements and structures
- Nigerian business regulations and permits

Important guidelines:
- Always clarify you are an AI assistant, not a lawyer
- Recommend consulting a qualified lawyer for specific legal advice
- Be specific to Nigerian law and CAC procedures
- Reference CAMA 2020 provisions where relevant
- Keep responses clear, concise, and practical
- If unsure about something, say so rather than guessing`,
        },
        ...recentMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      const completion = await ai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: chatMessages,
        max_tokens: 1024,
      });

      const aiContent = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response. Please try again.";

      const [aiMessage] = await db
        .insert(legalChatMessages)
        .values({ conversationId, role: "assistant", content: aiContent })
        .returning();

      res.json({ userMessage, aiMessage });
    } catch (error: any) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: error.message || "Failed to send message" });
    }
  });

  app.delete("/api/legal-chat/conversations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const conversationId = parseInt(req.params.id);
      if (isNaN(conversationId)) return res.status(400).json({ message: "Invalid conversation ID" });

      const [conversation] = await db
        .select()
        .from(legalChatConversations)
        .where(eq(legalChatConversations.id, conversationId));

      if (!conversation || conversation.userId !== userId) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      await db
        .delete(legalChatMessages)
        .where(eq(legalChatMessages.conversationId, conversationId));

      await db
        .delete(legalChatConversations)
        .where(eq(legalChatConversations.id, conversationId));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ message: error.message || "Failed to delete conversation" });
    }
  });

  // ============== COMPANY PROFILE ROUTES ==============

  const DEFAULT_POST_INC_TASKS = [
    { taskKey: "tin_registration", title: "Register for Tax Identification Number (TIN)", description: "Register your company with the Federal Inland Revenue Service (FIRS) to obtain a TIN.", guidance: "Visit the nearest FIRS office or apply online at www.firs.gov.ng. Required documents: CAC certificate, Memorandum of Association, utility bill, completed TIN application form. Processing typically takes 2-5 business days.", sortOrder: 1 },
    { taskKey: "bank_account", title: "Open a Corporate Bank Account", description: "Open a business bank account in your company's name for all business transactions.", guidance: "Visit any commercial bank with: CAC certificate (certified true copy), Memorandum & Articles of Association, Board resolution to open account, Company TIN, Completed account opening forms, Valid IDs of directors/signatories. Compare bank charges and services before choosing.", sortOrder: 2 },
    { taskKey: "company_seal", title: "Obtain Company Common Seal", description: "Get an official company seal/stamp bearing the company name and RC number.", guidance: "Order from any registered seal maker. The seal must bear your company name exactly as registered with CAC and your RC number. Cost typically ranges from \u20A65,000 - \u20A615,000. Required for executing deeds and certain legal documents.", sortOrder: 3 },
    { taskKey: "vat_registration", title: "Register for Value Added Tax (VAT)", description: "If your business supplies taxable goods or services, register for VAT with FIRS.", guidance: "VAT registration is mandatory if your annual turnover exceeds \u20A625 million or if you supply VAT-able goods/services. Apply at the FIRS office with your TIN, CAC documents, and completed VAT registration form. VAT is currently 7.5% in Nigeria.", sortOrder: 4 },
    { taskKey: "paye_registration", title: "Register for PAYE (Pay As You Earn)", description: "Register with the State Internal Revenue Service for employee tax deductions.", guidance: "Required once you start employing staff. Register with the State IRS where your business operates. You'll need: Company TIN, CAC certificate, list of employees with their salary details. PAYE must be remitted monthly by the 10th of the following month.", sortOrder: 5 },
    { taskKey: "pension_setup", title: "Set Up Pension Scheme", description: "Register with the National Pension Commission (PenCom) if you have 3 or more employees.", guidance: "Under the Pension Reform Act 2014, employers with 3+ employees must contribute to the Contributory Pension Scheme. Employer contributes minimum 10% and employee minimum 8% of basic salary. Register with a licensed Pension Fund Administrator (PFA).", sortOrder: 6 },
    { taskKey: "scuml_registration", title: "SCUML Registration (if applicable)", description: "Register with the Special Control Unit against Money Laundering if your business type requires it.", guidance: "Designated Non-Financial Businesses and Professions (DNFBPs) must register with SCUML. This includes: legal practitioners, accountants, real estate agents, dealers in precious metals, and NGOs. Register at scuml.org.ng with your CAC documents.", sortOrder: 7 },
    { taskKey: "business_premises", title: "Register Business Premises", description: "Register your business premises with the relevant state/local government authority.", guidance: "Most states require businesses to register their premises and obtain a Business Premises Permit. Visit your Local Government Authority or State Ministry of Commerce. Fees vary by state and business size. Renewal is typically annual.", sortOrder: 8 },
    { taskKey: "annual_returns_setup", title: "Set Up Annual Returns Calendar", description: "Mark your annual returns filing deadline and set up reminders to avoid penalties.", guidance: "Companies must file annual returns with CAC within 42 days of their incorporation anniversary date. Late filing attracts a penalty of \u20A65,000 plus \u20A650 per day for every day of default. Use Cellion One's Compliance Calendar to track this automatically.", sortOrder: 9 },
    { taskKey: "statutory_registers", title: "Maintain Statutory Registers", description: "Set up and maintain the required statutory books and registers for your company.", guidance: "Under CAMA 2020, every company must maintain: Register of Members, Register of Directors, Register of Charges, Minutes Book for Board and General Meetings, Register of Debenture Holders (if applicable). These must be kept at the registered office and available for inspection.", sortOrder: 10 },
  ];

  app.get("/api/founder/company-profiles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const profiles = await db
        .select()
        .from(companyProfiles)
        .where(eq(companyProfiles.founderId, userId))
        .orderBy(desc(companyProfiles.createdAt));
      res.json(profiles);
    } catch (error: any) {
      console.error("Error fetching company profiles:", error);
      res.status(500).json({ message: error.message || "Failed to fetch company profiles" });
    }
  });

  app.get("/api/founder/company-profiles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const profileId = parseInt(req.params.id, 10);
      if (isNaN(profileId)) return res.status(400).json({ message: "Invalid profile ID" });

      const [profile] = await db
        .select()
        .from(companyProfiles)
        .where(and(eq(companyProfiles.id, profileId), eq(companyProfiles.founderId, userId)));

      if (!profile) return res.status(404).json({ message: "Company profile not found" });

      const tasks = await db
        .select()
        .from(postIncorporationTasks)
        .where(eq(postIncorporationTasks.companyProfileId, profileId))
        .orderBy(asc(postIncorporationTasks.sortOrder));

      res.json({ ...profile, tasks });
    } catch (error: any) {
      console.error("Error fetching company profile:", error);
      res.status(500).json({ message: error.message || "Failed to fetch company profile" });
    }
  });

  app.put("/api/founder/company-profiles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const profileId = parseInt(req.params.id, 10);
      if (isNaN(profileId)) return res.status(400).json({ message: "Invalid profile ID" });

      const [existing] = await db
        .select()
        .from(companyProfiles)
        .where(and(eq(companyProfiles.id, profileId), eq(companyProfiles.founderId, userId)));

      if (!existing) return res.status(404).json({ message: "Company profile not found" });

      const allowedFields: Record<string, any> = {};
      if (req.body.rcNumber !== undefined) allowedFields.rcNumber = req.body.rcNumber;
      if (req.body.tinNumber !== undefined) allowedFields.tinNumber = req.body.tinNumber;
      if (req.body.incorporationDate !== undefined) allowedFields.incorporationDate = req.body.incorporationDate ? new Date(req.body.incorporationDate) : null;
      allowedFields.updatedAt = new Date();

      const [updated] = await db
        .update(companyProfiles)
        .set(allowedFields)
        .where(eq(companyProfiles.id, profileId))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating company profile:", error);
      res.status(500).json({ message: error.message || "Failed to update company profile" });
    }
  });

  app.post("/api/founder/company-profiles/from-application/:applicationId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const applicationId = parseInt(req.params.applicationId, 10);
      if (isNaN(applicationId)) return res.status(400).json({ message: "Invalid application ID" });

      const application = await storage.getApplication(applicationId);
      if (!application) return res.status(404).json({ message: "Application not found" });
      if (application.founderUserId !== userId) return res.status(403).json({ message: "Forbidden" });
      if (!["completed", "filed"].includes(application.status || "")) {
        return res.status(400).json({ message: "Application must be completed or filed to create a company profile" });
      }

      const [existingProfile] = await db
        .select()
        .from(companyProfiles)
        .where(and(eq(companyProfiles.applicationId, applicationId), eq(companyProfiles.founderId, userId)));

      if (existingProfile) {
        return res.status(409).json({ message: "A company profile already exists for this application", profile: existingProfile });
      }

      const [newProfile] = await db
        .insert(companyProfiles)
        .values({
          applicationId,
          founderId: userId,
          companyName: application.companyName1 || "Unnamed Company",
          companyType: application.companyType || "LTD",
          registeredAddress: application.registeredAddress as any,
          directors: (application.directorsData as any) || [],
          shareholders: (application.shareholdersData as any) || [],
          businessActivities: (application.selectedActivities as any) || [],
          incorporationDate: application.completedAt || new Date(),
        })
        .returning();

      for (const task of DEFAULT_POST_INC_TASKS) {
        await db.insert(postIncorporationTasks).values({
          companyProfileId: newProfile.id,
          founderId: userId,
          ...task,
          status: "not_started",
        });
      }

      const tasks = await db
        .select()
        .from(postIncorporationTasks)
        .where(eq(postIncorporationTasks.companyProfileId, newProfile.id))
        .orderBy(asc(postIncorporationTasks.sortOrder));

      res.json({ ...newProfile, tasks });
    } catch (error: any) {
      console.error("Error creating company profile from application:", error);
      res.status(500).json({ message: error.message || "Failed to create company profile" });
    }
  });

  // ============== POST-INCORPORATION CHECKLIST ROUTES ==============

  app.get("/api/founder/company-profiles/:id/checklist", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const profileId = parseInt(req.params.id, 10);
      if (isNaN(profileId)) return res.status(400).json({ message: "Invalid profile ID" });

      const [profile] = await db
        .select()
        .from(companyProfiles)
        .where(and(eq(companyProfiles.id, profileId), eq(companyProfiles.founderId, userId)));

      if (!profile) return res.status(404).json({ message: "Company profile not found" });

      const tasks = await db
        .select()
        .from(postIncorporationTasks)
        .where(eq(postIncorporationTasks.companyProfileId, profileId))
        .orderBy(asc(postIncorporationTasks.sortOrder));

      res.json(tasks);
    } catch (error: any) {
      console.error("Error fetching checklist:", error);
      res.status(500).json({ message: error.message || "Failed to fetch checklist" });
    }
  });

  app.put("/api/founder/company-profiles/:id/checklist/:taskId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const profileId = parseInt(req.params.id, 10);
      const taskId = parseInt(req.params.taskId, 10);
      if (isNaN(profileId) || isNaN(taskId)) return res.status(400).json({ message: "Invalid ID" });

      const [profile] = await db
        .select()
        .from(companyProfiles)
        .where(and(eq(companyProfiles.id, profileId), eq(companyProfiles.founderId, userId)));

      if (!profile) return res.status(404).json({ message: "Company profile not found" });

      const [task] = await db
        .select()
        .from(postIncorporationTasks)
        .where(and(eq(postIncorporationTasks.id, taskId), eq(postIncorporationTasks.companyProfileId, profileId)));

      if (!task) return res.status(404).json({ message: "Task not found" });

      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (req.body.status !== undefined) {
        updateData.status = req.body.status;
        if (req.body.status === "completed") {
          updateData.completedAt = new Date();
        } else {
          updateData.completedAt = null;
        }
      }
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;

      const [updated] = await db
        .update(postIncorporationTasks)
        .set(updateData)
        .where(eq(postIncorporationTasks.id, taskId))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating checklist task:", error);
      res.status(500).json({ message: error.message || "Failed to update task" });
    }
  });

  // ============== COMPLIANCE CALENDAR ROUTES ==============

  function generateComplianceDeadlines(companyProfileId: number, founderId: string, incorporationDate: Date) {
    const incDate = new Date(incorporationDate);
    const currentYear = new Date().getFullYear();

    const getNextAnnualReturnDate = () => {
      let anniversaryYear = currentYear;
      let anniversary = new Date(anniversaryYear, incDate.getMonth(), incDate.getDate());
      let deadline = new Date(anniversary);
      deadline.setDate(deadline.getDate() + 42);
      if (deadline < new Date()) {
        anniversaryYear++;
        anniversary = new Date(anniversaryYear, incDate.getMonth(), incDate.getDate());
        deadline = new Date(anniversary);
        deadline.setDate(deadline.getDate() + 42);
      }
      return deadline;
    };

    const getNextQuarterEnd = () => {
      const now = new Date();
      const quarterMonth = Math.ceil((now.getMonth() + 1) / 3) * 3;
      let quarterEnd = new Date(now.getFullYear(), quarterMonth, 0);
      if (quarterEnd < now) {
        quarterEnd = new Date(now.getFullYear(), quarterMonth + 3, 0);
      }
      const dueDate = new Date(quarterEnd);
      dueDate.setDate(dueDate.getDate() + 21);
      return dueDate;
    };

    return [
      {
        companyProfileId,
        founderId,
        deadlineType: "annual_return",
        title: "CAC Annual Returns Filing",
        description: "File your annual returns with the Corporate Affairs Commission (CAC).",
        dueDate: getNextAnnualReturnDate(),
        penaltyInfo: "Late filing penalty: ₦5,000 base fee plus ₦50 per day of default. Persistent non-filing may lead to company striking off the register.",
        isRecurring: true,
        recurrenceRule: "yearly",
        status: "upcoming",
      },
      {
        companyProfileId,
        founderId,
        deadlineType: "tax_filing",
        title: "Company Income Tax (CIT) Returns",
        description: "File your company income tax returns with the Federal Inland Revenue Service (FIRS).",
        dueDate: new Date(currentYear, 5, 30),
        penaltyInfo: "Penalty for late filing: ₦25,000 for the first month and ₦5,000 for each subsequent month. Plus interest on unpaid tax at prevailing CBN lending rate.",
        isRecurring: true,
        recurrenceRule: "yearly",
        status: "upcoming",
      },
      {
        companyProfileId,
        founderId,
        deadlineType: "vat_return",
        title: "VAT Returns (Quarterly)",
        description: "File and remit your Value Added Tax returns to FIRS if registered for VAT.",
        dueDate: getNextQuarterEnd(),
        penaltyInfo: "Penalty for late filing: ₦5,000 for the first month and ₦5,000 for each subsequent month. Plus 5% per annum interest above CBN rediscount rate on unpaid VAT.",
        isRecurring: true,
        recurrenceRule: "quarterly",
        status: "upcoming",
      },
      {
        companyProfileId,
        founderId,
        deadlineType: "paye_remittance",
        title: "PAYE Monthly Remittance",
        description: "Remit employee PAYE deductions to the State Internal Revenue Service by the 10th of each month.",
        dueDate: (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(10); return d; })(),
        penaltyInfo: "Penalty for late remittance: 10% of the tax due plus interest at CBN minimum rediscount rate. Employers may face prosecution for persistent defaults.",
        isRecurring: true,
        recurrenceRule: "monthly",
        status: "upcoming",
      },
      {
        companyProfileId,
        founderId,
        deadlineType: "audit_filing",
        title: "Annual Audit & Financial Statements",
        description: "Prepare audited financial statements and file with CAC alongside annual returns.",
        dueDate: getNextAnnualReturnDate(),
        penaltyInfo: "Must be filed alongside annual returns. Companies that fail to keep proper accounting records may face fines of up to ₦500,000 under CAMA 2020.",
        isRecurring: true,
        recurrenceRule: "yearly",
        status: "upcoming",
      },
    ];
  }

  app.get("/api/founder/company-profiles/:id/compliance", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const profileId = parseInt(req.params.id, 10);
      if (isNaN(profileId)) return res.status(400).json({ message: "Invalid profile ID" });

      const [profile] = await db
        .select()
        .from(companyProfiles)
        .where(and(eq(companyProfiles.id, profileId), eq(companyProfiles.founderId, userId)));

      if (!profile) return res.status(404).json({ message: "Company profile not found" });

      const deadlines = await db
        .select()
        .from(complianceDeadlines)
        .where(eq(complianceDeadlines.companyProfileId, profileId))
        .orderBy(asc(complianceDeadlines.dueDate));

      res.json(deadlines);
    } catch (error: any) {
      console.error("Error fetching compliance deadlines:", error);
      res.status(500).json({ message: error.message || "Failed to fetch compliance deadlines" });
    }
  });

  app.put("/api/founder/company-profiles/:id/compliance/:deadlineId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const profileId = parseInt(req.params.id, 10);
      const deadlineId = parseInt(req.params.deadlineId, 10);
      if (isNaN(profileId) || isNaN(deadlineId)) return res.status(400).json({ message: "Invalid ID" });

      const [profile] = await db
        .select()
        .from(companyProfiles)
        .where(and(eq(companyProfiles.id, profileId), eq(companyProfiles.founderId, userId)));

      if (!profile) return res.status(404).json({ message: "Company profile not found" });

      const [deadline] = await db
        .select()
        .from(complianceDeadlines)
        .where(and(eq(complianceDeadlines.id, deadlineId), eq(complianceDeadlines.companyProfileId, profileId)));

      if (!deadline) return res.status(404).json({ message: "Deadline not found" });

      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (req.body.status !== undefined) {
        updateData.status = req.body.status;
        if (req.body.status === "completed") {
          updateData.completedAt = new Date();
        } else {
          updateData.completedAt = null;
        }
      }
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;

      const [updated] = await db
        .update(complianceDeadlines)
        .set(updateData)
        .where(eq(complianceDeadlines.id, deadlineId))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating compliance deadline:", error);
      res.status(500).json({ message: error.message || "Failed to update compliance deadline" });
    }
  });

  app.post("/api/founder/company-profiles/:id/compliance/generate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const profileId = parseInt(req.params.id, 10);
      if (isNaN(profileId)) return res.status(400).json({ message: "Invalid profile ID" });

      const [profile] = await db
        .select()
        .from(companyProfiles)
        .where(and(eq(companyProfiles.id, profileId), eq(companyProfiles.founderId, userId)));

      if (!profile) return res.status(404).json({ message: "Company profile not found" });

      const incorporationDate = profile.incorporationDate || new Date();
      const deadlinesData = generateComplianceDeadlines(profileId, userId, incorporationDate);

      const now = new Date();
      const fourteenDaysFromNow = new Date();
      fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);

      const insertedDeadlines = [];
      for (const dl of deadlinesData) {
        let status = "upcoming";
        if (dl.dueDate < now) {
          status = "overdue";
        } else if (dl.dueDate <= fourteenDaysFromNow) {
          status = "due_soon";
        }

        const [inserted] = await db
          .insert(complianceDeadlines)
          .values({ ...dl, status })
          .returning();

        insertedDeadlines.push(inserted);
      }

      res.json(insertedDeadlines);
    } catch (error: any) {
      console.error("Error generating compliance deadlines:", error);
      res.status(500).json({ message: error.message || "Failed to generate compliance deadlines" });
    }
  });

  // ============== SERVICE REQUEST COMPANY PROFILES & DOCUMENTS ==============

  app.get("/api/founder/service-profiles", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const profiles = await storage.getServiceRequestCompanyProfilesByFounder(userId);
      res.json(profiles);
    } catch (error: any) {
      console.error("Error fetching service profiles:", error);
      res.status(500).json({ message: error.message || "Failed to fetch service profiles" });
    }
  });

  app.get("/api/founder/service-profiles/:id", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid profile ID" });

      const profile = await storage.getServiceRequestCompanyProfile(id);
      if (!profile || profile.founderId !== userId) {
        return res.status(404).json({ message: "Profile not found" });
      }

      const documents = await storage.getServiceRequestDocumentsByProfile(id);
      res.json({ ...profile, documents });
    } catch (error: any) {
      console.error("Error fetching service profile:", error);
      res.status(500).json({ message: error.message || "Failed to fetch service profile" });
    }
  });

  const serviceProfileSchema = z.object({
    category: z.string().min(1, "Category is required"),
    cacRegistrationType: z.string().min(1, "CAC registration type is required"),
    sector: z.string().optional().default(""),
    mainBusinessObjectives: z.string().optional().default(""),
    incorporationNumber: z.string().min(1, "Incorporation/Registration number is required"),
    registeredName: z.string().min(1, "Registered company name is required"),
    dateIncorporated: z.string().optional().default(""),
    tinNumber: z.string().optional().default(""),
    headOfficeAddress: z.string().optional().default(""),
    state: z.string().optional().default(""),
    bankName: z.string().optional().default(""),
    accountNumber: z.string().optional().default(""),
    accountName: z.string().optional().default(""),
    organizationPhone: z.string().optional().default(""),
    organizationEmail: z.string().optional().default(""),
    contactPersonName: z.string().optional().default(""),
    contactPersonNin: z.string().optional().default(""),
    contactPersonAddress: z.string().optional().default(""),
    contactPersonEmail: z.string().optional().default(""),
    contactPersonMobile: z.string().optional().default(""),
  });

  app.post("/api/founder/service-profiles", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const parsed = serviceProfileSchema.parse(req.body);

      const profile = await storage.createServiceRequestCompanyProfile({
        ...parsed,
        founderId: userId,
      });

      await storage.createAuditLog({
        actorUserId: userId,
        action: "create_service_profile",
        entityType: "service_request_company_profile",
        entityId: String(profile.id),
        details: { registeredName: parsed.registeredName, category: parsed.category },
        ipAddress: req.ip,
      });

      res.json(profile);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error creating service profile:", error);
      res.status(500).json({ message: error.message || "Failed to create service profile" });
    }
  });

  app.put("/api/founder/service-profiles/:id", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid profile ID" });

      const existing = await storage.getServiceRequestCompanyProfile(id);
      if (!existing || existing.founderId !== userId) {
        return res.status(404).json({ message: "Profile not found" });
      }

      const parsed = serviceProfileSchema.partial().parse(req.body);
      const profile = await storage.updateServiceRequestCompanyProfile(id, parsed);

      await storage.createAuditLog({
        actorUserId: userId,
        action: "update_service_profile",
        entityType: "service_request_company_profile",
        entityId: String(id),
        ipAddress: req.ip,
      });

      res.json(profile);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation failed", errors: error.errors });
      }
      console.error("Error updating service profile:", error);
      res.status(500).json({ message: error.message || "Failed to update service profile" });
    }
  });

  // Document upload for service requests (uses object storage)
  const objectStorageService = new ObjectStorageService();

  app.post("/api/founder/service-profiles/:profileId/documents/upload-url", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const profileId = parseInt(req.params.profileId, 10);
      if (isNaN(profileId)) return res.status(400).json({ message: "Invalid profile ID" });

      const profile = await storage.getServiceRequestCompanyProfile(profileId);
      if (!profile || profile.founderId !== userId) {
        return res.status(404).json({ message: "Profile not found" });
      }

      const { name, size, contentType, docType } = req.body;
      if (!name || !docType) {
        return res.status(400).json({ message: "Missing required fields: name, docType" });
      }

      const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
      if (contentType && !allowedTypes.includes(contentType)) {
        return res.status(400).json({ message: "Only PDF, JPEG, and PNG files are allowed" });
      }

      const maxSize = 10 * 1024 * 1024; // 10MB
      if (size && size > maxSize) {
        return res.status(400).json({ message: "File size must be under 10MB" });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType, docType, profileId },
      });
    } catch (error: any) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  app.post("/api/founder/service-profiles/:profileId/documents", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const profileId = parseInt(req.params.profileId, 10);
      if (isNaN(profileId)) return res.status(400).json({ message: "Invalid profile ID" });

      const profile = await storage.getServiceRequestCompanyProfile(profileId);
      if (!profile || profile.founderId !== userId) {
        return res.status(404).json({ message: "Profile not found" });
      }

      const { docType, filename, storagePath, sizeBytes, mimeType, serviceRequestId } = req.body;
      if (!docType || !filename || !storagePath) {
        return res.status(400).json({ message: "Missing required fields: docType, filename, storagePath" });
      }

      const doc = await storage.createServiceRequestDocument({
        founderId: userId,
        companyProfileId: profileId,
        serviceRequestId: serviceRequestId || null,
        docType,
        filename,
        storagePath,
        sizeBytes: sizeBytes || null,
        mimeType: mimeType || null,
      });

      await storage.createAuditLog({
        actorUserId: userId,
        action: "upload_service_document",
        entityType: "service_request_document",
        entityId: String(doc.id),
        details: { docType, filename, profileId },
        ipAddress: req.ip,
      });

      res.json(doc);
    } catch (error: any) {
      console.error("Error saving document record:", error);
      res.status(500).json({ message: error.message || "Failed to save document" });
    }
  });

  app.get("/api/founder/service-profiles/:profileId/documents", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const profileId = parseInt(req.params.profileId, 10);
      if (isNaN(profileId)) return res.status(400).json({ message: "Invalid profile ID" });

      const profile = await storage.getServiceRequestCompanyProfile(profileId);
      if (!profile || profile.founderId !== userId) {
        return res.status(404).json({ message: "Profile not found" });
      }

      const documents = await storage.getServiceRequestDocumentsByProfile(profileId);
      res.json(documents);
    } catch (error: any) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: error.message || "Failed to fetch documents" });
    }
  });

  app.get("/api/founder/service-profiles/:profileId/documents/:docId/download", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const profileId = parseInt(req.params.profileId, 10);
      if (isNaN(profileId)) return res.status(400).json({ message: "Invalid profile ID" });

      const profile = await storage.getServiceRequestCompanyProfile(profileId);
      if (!profile || profile.founderId !== userId) {
        return res.status(404).json({ message: "Profile not found" });
      }

      const documents = await storage.getServiceRequestDocumentsByProfile(profileId);
      const doc = documents.find(d => d.id === parseInt(req.params.docId, 10));
      if (!doc) return res.status(404).json({ message: "Document not found" });

      const downloadURL = await objectStorageService.getObjectEntityDownloadURL(doc.storagePath);
      res.json({ downloadURL });
    } catch (error: any) {
      console.error("Error getting download URL:", error);
      res.status(500).json({ message: error.message || "Failed to get download URL" });
    }
  });

  app.delete("/api/founder/service-profiles/:profileId/documents/:docId", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const profileId = parseInt(req.params.profileId, 10);
      if (isNaN(profileId)) return res.status(400).json({ message: "Invalid profile ID" });

      const profile = await storage.getServiceRequestCompanyProfile(profileId);
      if (!profile || profile.founderId !== userId) {
        return res.status(404).json({ message: "Profile not found" });
      }

      const documents = await storage.getServiceRequestDocumentsByProfile(profileId);
      const doc = documents.find(d => d.id === parseInt(req.params.docId, 10));
      if (!doc) return res.status(404).json({ message: "Document not found" });

      await storage.deleteServiceRequestDocument(doc.id);
      res.json({ message: "Document deleted" });
    } catch (error: any) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: error.message || "Failed to delete document" });
    }
  });

  // Service Requests for founder
  app.get("/api/founder/service-requests", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const requests = await storage.getServiceRequestsByFounder(userId);
      res.json(requests);
    } catch (error: any) {
      console.error("Error fetching service requests:", error);
      res.status(500).json({ message: error.message || "Failed to fetch service requests" });
    }
  });

  // ============== DATA SHARING & PARTNER API ==============

  app.post("/api/data-sharing/create-consent", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const founderId = getUserId(req);
      const schema = z.object({
        partnerName: z.string().min(1).max(255),
        partnerType: z.enum(["bank", "insurance", "government", "other"]),
        applicationId: z.number().optional(),
        dataScope: z.object({
          personal: z.boolean().default(true),
          verification: z.boolean().default(true),
          company: z.boolean().default(false),
          documents: z.boolean().default(false),
          proofOfAddress: z.boolean().default(false),
        }),
        expiresInDays: z.number().min(1).max(365).default(90),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }

      const { partnerName, partnerType, applicationId, dataScope, expiresInDays } = parsed.data;
      const consentToken = crypto.randomBytes(48).toString("hex");
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

      const scopeLabels = [];
      if (dataScope.personal) scopeLabels.push("personal information");
      if (dataScope.verification) scopeLabels.push("identity verification results");
      if (dataScope.company) scopeLabels.push("company details");
      if (dataScope.documents) scopeLabels.push("uploaded documents");
      if (dataScope.proofOfAddress) scopeLabels.push("proof of address");

      const consentText = `I authorise Cellion One to share my ${scopeLabels.join(", ")} with ${partnerName} ` +
        `for the purpose of ${partnerType === "bank" ? "corporate account opening" : partnerType === "insurance" ? "insurance application" : "verification"}. ` +
        `This consent is valid until ${expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} and can be revoked at any time.`;

      const [consent] = await db.insert(dataSharingConsents).values({
        founderId,
        applicationId: applicationId || null,
        partnerName,
        partnerType,
        consentToken,
        consentText,
        dataScope,
        status: "active",
        expiresAt,
      }).returning();

      await storage.createAuditLog({
        actorUserId: founderId,
        action: "data_sharing_consent_created",
        entityType: "data_sharing_consent",
        entityId: consent.id.toString(),
        details: { partnerName, partnerType, dataScope, expiresInDays },
        ipAddress: req.ip,
      });

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const shareableLink = `${baseUrl}/verify/${consentToken}`;

      res.json({
        consent,
        shareableLink,
        message: "Consent created successfully",
      });
    } catch (error: any) {
      console.error("Error creating data sharing consent:", error);
      res.status(500).json({ message: error.message || "Failed to create consent" });
    }
  });

  app.get("/api/data-sharing/consents", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const founderId = getUserId(req);
      const consents = await db.select()
        .from(dataSharingConsents)
        .where(eq(dataSharingConsents.founderId, founderId))
        .orderBy(desc(dataSharingConsents.createdAt));

      const now = new Date();
      const withStatus = consents.map(c => ({
        ...c,
        status: c.status === "active" && c.expiresAt < now ? "expired" : c.status,
      }));

      res.json({ consents: withStatus });
    } catch (error: any) {
      console.error("Error fetching consents:", error);
      res.status(500).json({ message: "Failed to fetch consents" });
    }
  });

  app.post("/api/data-sharing/consents/:id/revoke", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const founderId = getUserId(req);
      const consentId = parseInt(req.params.id);

      const [consent] = await db.select()
        .from(dataSharingConsents)
        .where(and(eq(dataSharingConsents.id, consentId), eq(dataSharingConsents.founderId, founderId)))
        .limit(1);

      if (!consent) {
        return res.status(404).json({ message: "Consent not found" });
      }
      if (consent.status !== "active") {
        return res.status(400).json({ message: "Consent is already revoked or expired" });
      }

      await db.update(dataSharingConsents)
        .set({ status: "revoked", revokedAt: new Date() })
        .where(eq(dataSharingConsents.id, consentId));

      await storage.createAuditLog({
        actorUserId: founderId,
        action: "data_sharing_consent_revoked",
        entityType: "data_sharing_consent",
        entityId: consentId.toString(),
        details: { partnerName: consent.partnerName },
        ipAddress: req.ip,
      });

      res.json({ message: "Consent revoked successfully" });
    } catch (error: any) {
      console.error("Error revoking consent:", error);
      res.status(500).json({ message: "Failed to revoke consent" });
    }
  });

  app.get("/api/data-sharing/consents/:id/access-log", isAuthenticated, requireRole("founder"), async (req: any, res) => {
    try {
      const founderId = getUserId(req);
      const consentId = parseInt(req.params.id);

      const [consent] = await db.select()
        .from(dataSharingConsents)
        .where(and(eq(dataSharingConsents.id, consentId), eq(dataSharingConsents.founderId, founderId)))
        .limit(1);

      if (!consent) {
        return res.status(404).json({ message: "Consent not found" });
      }

      const logs = await db.select()
        .from(dataSharingAccessLogs)
        .where(eq(dataSharingAccessLogs.consentId, consentId))
        .orderBy(desc(dataSharingAccessLogs.createdAt));

      res.json({ logs });
    } catch (error: any) {
      console.error("Error fetching access logs:", error);
      res.status(500).json({ message: "Failed to fetch access logs" });
    }
  });

  // Partner Data API — authenticated by consent token only
  async function validateConsentToken(token: string) {
    const [consent] = await db.select()
      .from(dataSharingConsents)
      .where(eq(dataSharingConsents.consentToken, token))
      .limit(1);

    if (!consent) return { valid: false, error: "Invalid verification token", consent: null };
    if (consent.status === "revoked") return { valid: false, error: "This consent has been revoked by the data owner", consent: null };
    if (consent.status !== "active" || consent.expiresAt < new Date()) return { valid: false, error: "This consent has expired", consent: null };
    return { valid: true, error: null, consent };
  }

  app.get("/api/partner/verified-data/:token", async (req, res) => {
    try {
      const { valid, error, consent } = await validateConsentToken(req.params.token);
      if (!valid || !consent) {
        return res.status(403).json({ message: error });
      }

      const scope = consent.dataScope as any;
      const result: any = {
        consentId: consent.id,
        partnerName: consent.partnerName,
        consentGrantedAt: consent.createdAt,
        consentExpiresAt: consent.expiresAt,
      };

      const user = await storage.getUser(consent.founderId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (scope.personal) {
        const profile = await storage.getFounderProfile(consent.founderId);
        result.personal = {
          fullName: `${user.firstName} ${user.lastName}`,
          email: user.email,
          phone: profile?.phone || null,
          dateOfBirth: profile?.dateOfBirth || null,
          nationality: profile?.nationality || null,
          gender: profile?.gender || null,
          address: profile ? {
            line1: profile.addressLine1,
            line2: profile.addressLine2,
            city: profile.city,
            state: profile.state,
            postalCode: profile.postalCode,
            country: profile.country,
          } : null,
        };
      }

      if (scope.verification) {
        const verification = await storage.getIdentityVerification(consent.founderId);
        result.verification = verification ? {
          status: verification.status,
          method: verification.method,
          provider: verification.externalProvider,
          smileIdJobId: verification.externalSessionId,
          livenessScore: verification.livenessScore,
          verifiedAt: verification.verifiedAt,
          expiresAt: verification.expiresAt,
          bvnVerified: true,
          ninVerified: true,
          documentVerified: true,
          biometricVerified: true,
          amlCleared: true,
        } : { status: "not_verified" };
      }

      if (scope.company && consent.applicationId) {
        const [companyProfile] = await db.select()
          .from(companyProfiles)
          .where(eq(companyProfiles.applicationId, consent.applicationId))
          .limit(1);

        if (companyProfile) {
          result.company = {
            name: companyProfile.companyName,
            rcNumber: companyProfile.rcNumber,
            type: companyProfile.companyType,
            shareCapital: companyProfile.shareCapital,
            incorporationDate: companyProfile.incorporationDate,
            directors: companyProfile.directors,
            shareholders: companyProfile.shareholders,
            businessActivities: companyProfile.businessActivities,
          };
        }
      }

      if (scope.documents) {
        const profile = await storage.getFounderProfile(consent.founderId);
        const objectStorageService = new ObjectStorageService();
        const docs: any = {};

        if (profile?.passportPhotoPath) {
          try { docs.passportPhoto = await objectStorageService.getDownloadUrl(profile.passportPhotoPath); } catch {}
        }
        if (profile?.signaturePath) {
          try { docs.signature = await objectStorageService.getDownloadUrl(profile.signaturePath); } catch {}
        }
        if (profile?.idDocumentPath) {
          try { docs.idDocument = await objectStorageService.getDownloadUrl(profile.idDocumentPath); } catch {}
        }
        result.documents = docs;
      }

      if (scope.proofOfAddress) {
        const [roSub] = await db.select()
          .from(registeredOfficeSubscriptions)
          .where(and(
            eq(registeredOfficeSubscriptions.founderId, consent.founderId),
            eq(registeredOfficeSubscriptions.useAsRegisteredAddress, true),
          ))
          .limit(1);

        if (roSub?.proofOfAddressPath && roSub.proofOfAddressStatus === "verified") {
          const objectStorageService = new ObjectStorageService();
          try {
            result.proofOfAddress = {
              status: "verified",
              downloadUrl: await objectStorageService.getDownloadUrl(roSub.proofOfAddressPath),
            };
          } catch {}
        }
      }

      await db.insert(dataSharingAccessLogs).values({
        consentId: consent.id,
        accessType: "api_call",
        accessedBy: consent.partnerName,
        ipAddress: req.ip,
        userAgent: req.get("user-agent") || "unknown",
        dataReturned: { scopes: Object.keys(scope).filter((k: string) => scope[k]) },
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error serving partner data:", error);
      res.status(500).json({ message: "Failed to retrieve data" });
    }
  });

  app.get("/api/partner/verified-data/:token/certificate", async (req, res) => {
    try {
      const { valid, error, consent } = await validateConsentToken(req.params.token);
      if (!valid || !consent) {
        return res.status(403).json({ message: error });
      }

      const user = await storage.getUser(consent.founderId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const verification = await storage.getIdentityVerification(consent.founderId);
      const isVerified = verification?.status === "verified";

      let companyData = null;
      if ((consent.dataScope as any).company && consent.applicationId) {
        const [cp] = await db.select().from(companyProfiles)
          .where(eq(companyProfiles.applicationId, consent.applicationId)).limit(1);
        if (cp) {
          companyData = {
            name: cp.companyName,
            rcNumber: cp.rcNumber,
            type: cp.companyType,
            shareCapital: cp.shareCapital ? Number(cp.shareCapital) : null,
            incorporationDate: cp.incorporationDate ? new Date(cp.incorporationDate).toLocaleDateString("en-GB") : null,
            directors: Array.isArray(cp.directors) ? (cp.directors as any[]).map((d: any) => d.name || `${d.firstName} ${d.lastName}`) : [],
          };
        }
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const { generateVerificationCertificateHTML } = await import("./templates/verification-certificate");

      const certData = {
        certificateNumber: `CO-${consent.id.toString().padStart(6, "0")}-${consent.founderId.slice(-6).toUpperCase()}`,
        subjectName: `${user.firstName} ${user.lastName}`,
        subjectEmail: user.email,
        verificationDate: verification?.verifiedAt ? new Date(verification.verifiedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "N/A",
        expiryDate: verification?.expiresAt ? new Date(verification.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "N/A",
        consentDate: consent.createdAt ? new Date(consent.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "N/A",
        partnerName: consent.partnerName,
        checks: {
          bvnValidation: isVerified,
          ninValidation: isVerified,
          documentVerification: isVerified,
          biometricMatch: isVerified,
          amlScreening: isVerified,
        },
        smileIdJobId: verification?.externalSessionId || null,
        livenessScore: verification?.livenessScore ? Number(verification.livenessScore) : null,
        company: companyData,
        verificationUrl: `${baseUrl}/verify/${consent.consentToken}`,
      };

      const html = generateVerificationCertificateHTML(certData);

      const format = req.query.format;
      if (format === "html") {
        await db.insert(dataSharingAccessLogs).values({
          consentId: consent.id,
          accessType: "certificate_download",
          accessedBy: consent.partnerName,
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || "unknown",
          dataReturned: { type: "verification_certificate_html" },
        });

        res.setHeader("Content-Type", "text/html");
        return res.send(html);
      }

      try {
        const { generatePdf } = await import("./services/pdfService");
        const pdfBuffer = await generatePdf(html);

        await db.insert(dataSharingAccessLogs).values({
          consentId: consent.id,
          accessType: "certificate_download",
          accessedBy: consent.partnerName,
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || "unknown",
          dataReturned: { type: "verification_certificate" },
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Cellion_One_Verification_Certificate_${user.lastName}.pdf"`);
        return res.send(pdfBuffer);
      } catch (pdfError: any) {
        console.error("PDF generation failed for certificate, returning error with HTML fallback:", pdfError.message);
        const htmlUrl = `/api/partner/verified-data/${req.params.token}/certificate?format=html`;
        return res.status(500).json({ message: "Failed to generate PDF. You can view the certificate as HTML instead.", htmlUrl });
      }
    } catch (error: any) {
      console.error("Error generating certificate:", error);
      res.status(500).json({ message: "Failed to generate certificate" });
    }
  });

  app.get("/api/partner/verified-data/:token/package", async (req, res) => {
    try {
      const { valid, error, consent } = await validateConsentToken(req.params.token);
      if (!valid || !consent) {
        return res.status(403).json({ message: error });
      }

      const user = await storage.getUser(consent.founderId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const archiver = await import("archiver");
      const archive = archiver.default("zip", { zlib: { level: 9 } });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="Cellion_One_Verification_Package_${user.lastName}.zip"`);
      archive.pipe(res);

      const scope = consent.dataScope as any;
      const objectStorageService = new ObjectStorageService();

      const dataSummary: any = {
        generatedAt: new Date().toISOString(),
        subject: { name: `${user.firstName} ${user.lastName}`, email: user.email },
        partner: consent.partnerName,
        consentGrantedAt: consent.createdAt,
        consentExpiresAt: consent.expiresAt,
      };

      if (scope.personal) {
        const profile = await storage.getFounderProfile(consent.founderId);
        dataSummary.personal = {
          fullName: `${user.firstName} ${user.lastName}`,
          phone: profile?.phone,
          dateOfBirth: profile?.dateOfBirth,
          nationality: profile?.nationality,
          gender: profile?.gender,
          address: profile ? { line1: profile.addressLine1, line2: profile.addressLine2, city: profile.city, state: profile.state, postalCode: profile.postalCode, country: profile.country } : null,
        };
      }

      if (scope.verification) {
        const verification = await storage.getIdentityVerification(consent.founderId);
        dataSummary.verification = verification ? {
          status: verification.status,
          provider: verification.externalProvider,
          smileIdJobId: verification.externalSessionId,
          livenessScore: verification.livenessScore,
          verifiedAt: verification.verifiedAt,
          expiresAt: verification.expiresAt,
        } : { status: "not_verified" };
      }

      if (scope.company && consent.applicationId) {
        const [cp] = await db.select().from(companyProfiles)
          .where(eq(companyProfiles.applicationId, consent.applicationId)).limit(1);
        if (cp) {
          dataSummary.company = {
            name: cp.companyName,
            rcNumber: cp.rcNumber,
            type: cp.companyType,
            shareCapital: cp.shareCapital,
            directors: cp.directors,
            shareholders: cp.shareholders,
          };
        }
      }

      archive.append(JSON.stringify(dataSummary, null, 2), { name: "data-summary.json" });

      if (scope.documents) {
        const profile = await storage.getFounderProfile(consent.founderId);
        const docPaths = [
          { path: profile?.passportPhotoPath, name: "passport-photo" },
          { path: profile?.signaturePath, name: "signature" },
          { path: profile?.idDocumentPath, name: "id-document" },
        ];

        for (const doc of docPaths) {
          if (doc.path) {
            try {
              const url = await objectStorageService.getDownloadUrl(doc.path);
              const response = await fetch(url);
              if (response.ok) {
                const ext = doc.path.split(".").pop() || "bin";
                const buffer = Buffer.from(await response.arrayBuffer());
                archive.append(buffer, { name: `personal-documents/${doc.name}.${ext}` });
              }
            } catch {}
          }
        }
      }

      if (scope.proofOfAddress) {
        const [roSub] = await db.select()
          .from(registeredOfficeSubscriptions)
          .where(and(
            eq(registeredOfficeSubscriptions.founderId, consent.founderId),
            eq(registeredOfficeSubscriptions.useAsRegisteredAddress, true),
          ))
          .limit(1);

        if (roSub?.proofOfAddressPath && roSub.proofOfAddressStatus === "verified") {
          try {
            const url = await objectStorageService.getDownloadUrl(roSub.proofOfAddressPath);
            const response = await fetch(url);
            if (response.ok) {
              const ext = roSub.proofOfAddressPath.split(".").pop() || "pdf";
              const buffer = Buffer.from(await response.arrayBuffer());
              archive.append(buffer, { name: `proof-of-address.${ext}` });
            }
          } catch {}
        }
      }

      const readmeContent = `CELLION ONE - VERIFICATION DATA PACKAGE
========================================

Subject: ${user.firstName} ${user.lastName}
Generated: ${new Date().toISOString()}
Partner: ${consent.partnerName}
Consent ID: ${consent.id}

CONTENTS
--------
- data-summary.json: Structured data of all verified information
- personal-documents/: Passport photo, signature, and ID document
- proof-of-address.*: Utility bill from virtual office provider (if applicable)

VERIFICATION
------------
To verify the authenticity of this package, visit:
${req.protocol}://${req.get("host")}/verify/${consent.consentToken}

This data was shared with the explicit consent of the data subject.
Consent was granted on ${consent.createdAt ? new Date(consent.createdAt).toLocaleDateString("en-GB") : "N/A"}
and expires on ${consent.expiresAt.toLocaleDateString("en-GB")}.

For questions, contact: service@cellionone.com

(c) ${new Date().getFullYear()} Cellion Platforms Nigeria Limited
`;
      archive.append(readmeContent, { name: "README.txt" });

      await db.insert(dataSharingAccessLogs).values({
        consentId: consent.id,
        accessType: "package_download",
        accessedBy: consent.partnerName,
        ipAddress: req.ip,
        userAgent: req.get("user-agent") || "unknown",
        dataReturned: { type: "full_package", scopes: Object.keys(scope).filter((k: string) => scope[k]) },
      });

      await archive.finalize();
    } catch (error: any) {
      console.error("Error generating package:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to generate package" });
      }
    }
  });

  app.get("/api/partner/verified-data/:token/status", async (req, res) => {
    try {
      const [consent] = await db.select()
        .from(dataSharingConsents)
        .where(eq(dataSharingConsents.consentToken, req.params.token))
        .limit(1);

      if (!consent) {
        return res.status(404).json({ status: "invalid" });
      }

      const now = new Date();
      const isExpired = consent.expiresAt < now;
      const effectiveStatus = consent.status === "active" && isExpired ? "expired" : consent.status;

      const user = await storage.getUser(consent.founderId);
      const verification = await storage.getIdentityVerification(consent.founderId);

      const scope = consent.dataScope as any;
      const checksPassed = verification?.status === "verified";

      res.json({
        status: effectiveStatus,
        subjectName: user ? `${user.firstName} ${user.lastName}` : null,
        partnerName: consent.partnerName,
        partnerType: consent.partnerType,
        consentGrantedAt: consent.createdAt,
        expiresAt: consent.expiresAt,
        dataScope: scope,
        verification: {
          isVerified: checksPassed,
          verifiedAt: verification?.verifiedAt || null,
          checks: {
            bvnValidation: checksPassed,
            ninValidation: checksPassed,
            documentVerification: checksPassed,
            biometricMatch: checksPassed,
            amlScreening: checksPassed,
          },
        },
      });
    } catch (error: any) {
      console.error("Error fetching consent status:", error);
      res.status(500).json({ message: "Failed to fetch status" });
    }
  });

  // ============== ADMIN REGISTERED OFFICES / SERVICE ADDRESSES ==============

  app.get("/api/admin/service-addresses", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const addresses = await storage.getAllServiceAddresses();
      const addressesWithManager = await Promise.all(
        addresses.map(async (addr) => {
          let managerUser = null;
          if (addr.managerUserId) {
            const user = await storage.getUser(addr.managerUserId);
            if (user) {
              managerUser = { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName };
            }
          }
          return { ...addr, managerUser };
        })
      );
      res.json(addressesWithManager);
    } catch (error) {
      console.error("Error fetching service addresses:", error);
      res.status(500).json({ message: "Failed to fetch service addresses" });
    }
  });

  const createServiceAddressSchema = z.object({
    label: z.string().min(1, "Label is required"),
    line1: z.string().min(1, "Address line 1 is required"),
    line2: z.string().optional(),
    floorDetails: z.string().optional(),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    country: z.string().optional(),
    contactPhone: z.string().optional(),
    contactEmail: z.string().email().optional().or(z.literal("")),
    operatingHours: z.string().optional(),
  });

  app.post("/api/admin/service-addresses", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const parsed = createServiceAddressSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }
      const address = await storage.createServiceAddress({
        ...parsed.data,
        line2: parsed.data.line2 || null,
        floorDetails: parsed.data.floorDetails || null,
        country: parsed.data.country || "Nigeria",
        contactPhone: parsed.data.contactPhone || null,
        contactEmail: parsed.data.contactEmail || null,
        operatingHours: parsed.data.operatingHours || null,
        isActive: true,
        managerUserId: null,
        utilityBillPath: null,
        utilityBillUploadedAt: null,
        utilityBillExpiresAt: null,
        utilityBillStatus: null,
      });

      await storage.createAuditLog({
        actorUserId: getUserId(req),
        action: "create_service_address",
        entityType: "service_address",
        entityId: String(address.id),
        details: { label: address.label },
        ipAddress: req.ip,
      });

      res.json(address);
    } catch (error) {
      console.error("Error creating service address:", error);
      res.status(500).json({ message: "Failed to create service address" });
    }
  });

  app.put("/api/admin/service-addresses/:id/manager", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const addressId = parseInt(req.params.id);
      if (isNaN(addressId)) return res.status(400).json({ message: "Invalid address ID" });

      const { managerUserId } = req.body;
      if (managerUserId !== null && typeof managerUserId !== "string") {
        return res.status(400).json({ message: "managerUserId must be a string or null" });
      }

      if (managerUserId) {
        const user = await storage.getUser(managerUserId);
        if (!user) return res.status(404).json({ message: "User not found" });

        const roles = await storage.getUserRoles(managerUserId);
        if (!roles.includes("building_manager")) {
          return res.status(400).json({ message: "User does not have the building_manager role. Assign the role first." });
        }
      }

      const address = await storage.getServiceAddressById(addressId);
      if (!address) return res.status(404).json({ message: "Service address not found" });

      const updated = await storage.updateServiceAddress(addressId, { managerUserId: managerUserId || null });

      await storage.createAuditLog({
        actorUserId: getUserId(req),
        action: "assign_building_manager",
        entityType: "service_address",
        entityId: String(addressId),
        details: { managerUserId, label: address.label },
        ipAddress: req.ip,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error assigning manager:", error);
      res.status(500).json({ message: "Failed to assign manager" });
    }
  });

  app.put("/api/admin/service-addresses/:id", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const addressId = parseInt(req.params.id);
      if (isNaN(addressId)) return res.status(400).json({ message: "Invalid address ID" });

      const address = await storage.getServiceAddressById(addressId);
      if (!address) return res.status(404).json({ message: "Service address not found" });

      const updateSchema = z.object({
        label: z.string().min(1).optional(),
        line1: z.string().min(1).optional(),
        line2: z.string().optional(),
        floorDetails: z.string().optional(),
        city: z.string().min(1).optional(),
        state: z.string().min(1).optional(),
        country: z.string().optional(),
        contactPhone: z.string().optional(),
        contactEmail: z.string().email().optional().or(z.literal("")),
        operatingHours: z.string().optional(),
        isActive: z.boolean().optional(),
      });

      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }

      const updated = await storage.updateServiceAddress(addressId, parsed.data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating service address:", error);
      res.status(500).json({ message: "Failed to update service address" });
    }
  });

  // ============== BUILDING MANAGER ENDPOINTS ==============

  const buildingManagerLocationUpdateSchema = z.object({
    contactPhone: z.string().optional(),
    contactEmail: z.string().email().optional().or(z.literal("")),
    operatingHours: z.string().optional(),
  });

  const buildingManagerMailIntakeSchema = z.object({
    subscriptionId: z.number(),
    senderName: z.string().min(1, "Sender name required"),
    senderType: z.string().min(1, "Sender type required"),
    envelopePhotoDocId: z.number().optional(),
    isSensitive: z.boolean().optional(),
  });

  app.get("/api/building-manager/location", isAuthenticated, requireRole("building_manager"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const location = await storage.getServiceAddressByManagerUserId(userId);
      if (!location) {
        return res.status(404).json({ message: "No location assigned to this manager" });
      }
      res.json(location);
    } catch (error) {
      console.error("Error fetching building manager location:", error);
      res.status(500).json({ message: "Failed to fetch location" });
    }
  });

  app.put("/api/building-manager/location", isAuthenticated, requireRole("building_manager"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const location = await storage.getServiceAddressByManagerUserId(userId);
      if (!location) {
        return res.status(404).json({ message: "No location assigned to this manager" });
      }

      const parsed = buildingManagerLocationUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }

      const updateData: Record<string, any> = {};
      if (parsed.data.contactPhone !== undefined) updateData.contactPhone = parsed.data.contactPhone || null;
      if (parsed.data.contactEmail !== undefined) updateData.contactEmail = parsed.data.contactEmail || null;
      if (parsed.data.operatingHours !== undefined) updateData.operatingHours = parsed.data.operatingHours || null;

      const updated = await storage.updateServiceAddress(location.id, updateData);

      await storage.createAuditLog({
        actorUserId: userId,
        action: "building_manager_update_location",
        entityType: "service_address",
        entityId: String(location.id),
        details: updateData,
        ipAddress: req.ip,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating building manager location:", error);
      res.status(500).json({ message: "Failed to update location" });
    }
  });

  app.post("/api/building-manager/utility-bill/upload-url", isAuthenticated, requireRole("building_manager"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const location = await storage.getServiceAddressByManagerUserId(userId);
      if (!location) {
        return res.status(404).json({ message: "No location assigned to this manager" });
      }

      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({ uploadUrl: uploadURL, storagePath: objectPath, locationId: location.id });
    } catch (error) {
      console.error("Error generating utility bill upload URL:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  app.post("/api/building-manager/utility-bill/upload-complete", isAuthenticated, requireRole("building_manager"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const location = await storage.getServiceAddressByManagerUserId(userId);
      if (!location) {
        return res.status(404).json({ message: "No location assigned to this manager" });
      }

      const storagePath = req.body.storagePath || req.body.uploadedPath;
      if (!storagePath || typeof storagePath !== "string") {
        return res.status(400).json({ message: "storagePath is required" });
      }

      const normalizedPath = storagePath;

      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + 3);

      const updated = await storage.updateServiceAddress(location.id, {
        utilityBillPath: normalizedPath,
        utilityBillUploadedAt: now,
        utilityBillExpiresAt: expiresAt,
        utilityBillStatus: "current",
      });

      await storage.createAuditLog({
        actorUserId: userId,
        action: "building_manager_upload_utility_bill",
        entityType: "service_address",
        entityId: String(location.id),
        details: { path: normalizedPath, expiresAt: expiresAt.toISOString() },
        ipAddress: req.ip,
      });

      res.json({
        message: "Utility bill uploaded successfully",
        utilityBillPath: normalizedPath,
        utilityBillUploadedAt: now,
        utilityBillExpiresAt: expiresAt,
        utilityBillStatus: "current",
      });
    } catch (error) {
      console.error("Error completing utility bill upload:", error);
      res.status(500).json({ message: "Failed to complete upload" });
    }
  });

  app.get("/api/building-manager/utility-bill", isAuthenticated, requireRole("building_manager"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const location = await storage.getServiceAddressByManagerUserId(userId);
      if (!location) {
        return res.status(404).json({ message: "No location assigned to this manager" });
      }

      if (!location.utilityBillPath) {
        return res.json({ hasBill: false, utilityBill: null });
      }

      let downloadURL: string | null = null;
      try {
        const objectStorageService = new ObjectStorageService();
        if (location.utilityBillPath.startsWith("/objects/")) {
          downloadURL = await objectStorageService.getObjectEntityDownloadURL(location.utilityBillPath);
        } else {
          downloadURL = await (objectStorageService as any).getDownloadUrl(location.utilityBillPath);
        }
      } catch (e) {
        console.error("Error generating download URL for utility bill:", e);
      }

      const now = new Date();
      let effectiveStatus = location.utilityBillStatus;
      if (location.utilityBillExpiresAt && location.utilityBillExpiresAt < now) {
        effectiveStatus = "expired";
      }

      res.json({
        hasBill: true,
        utilityBill: {
          path: location.utilityBillPath,
          uploadedAt: location.utilityBillUploadedAt,
          expiresAt: location.utilityBillExpiresAt,
          status: effectiveStatus,
          downloadURL,
        },
      });
    } catch (error) {
      console.error("Error fetching utility bill:", error);
      res.status(500).json({ message: "Failed to fetch utility bill" });
    }
  });

  app.get("/api/building-manager/subscribers", isAuthenticated, requireRole("building_manager"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const location = await storage.getServiceAddressByManagerUserId(userId);
      if (!location) {
        return res.status(404).json({ message: "No location assigned to this manager" });
      }

      const subscriptions = await storage.getSubscriptionsByServiceAddressId(location.id);

      const subscribersData = await Promise.all(
        subscriptions.map(async (sub) => {
          const founder = await storage.getUser(sub.founderId);
          let companyName: string | null = null;
          if (sub.applicationId) {
            const app = await storage.getApplication(sub.applicationId);
            companyName = app?.companyName1 || null;
          }
          return {
            subscriptionId: sub.id,
            founderName: founder ? `${founder.firstName || ""} ${founder.lastName || ""}`.trim() : "Unknown",
            founderEmail: founder?.email || null,
            companyName,
            tier: sub.tier,
            status: sub.status,
            startDate: sub.startDate,
            endDate: sub.endDate,
          };
        })
      );

      res.json(subscribersData);
    } catch (error) {
      console.error("Error fetching subscribers:", error);
      res.status(500).json({ message: "Failed to fetch subscribers" });
    }
  });

  app.get("/api/building-manager/mail", isAuthenticated, requireRole("building_manager"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const location = await storage.getServiceAddressByManagerUserId(userId);
      if (!location) {
        return res.status(404).json({ message: "No location assigned to this manager" });
      }

      const subscriptions = await storage.getSubscriptionsByServiceAddressId(location.id);
      const subscriptionIds = subscriptions.map((s) => s.id);

      const allMailItems: any[] = [];
      for (const subId of subscriptionIds) {
        const items = await storage.getMailItemsBySubscription(subId);
        const sub = subscriptions.find((s) => s.id === subId);
        for (const item of items) {
          const founder = sub ? await storage.getUser(sub.founderId) : null;
          allMailItems.push({
            ...item,
            subscriberName: founder ? `${founder.firstName || ""} ${founder.lastName || ""}`.trim() : "Unknown",
          });
        }
      }

      allMailItems.sort((a, b) => {
        const dateA = a.receivedAt ? new Date(a.receivedAt).getTime() : 0;
        const dateB = b.receivedAt ? new Date(b.receivedAt).getTime() : 0;
        return dateB - dateA;
      });

      res.json(allMailItems);
    } catch (error) {
      console.error("Error fetching mail items:", error);
      res.status(500).json({ message: "Failed to fetch mail items" });
    }
  });

  app.post("/api/building-manager/mail/intake", isAuthenticated, requireRole("building_manager"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const location = await storage.getServiceAddressByManagerUserId(userId);
      if (!location) {
        return res.status(404).json({ message: "No location assigned to this manager" });
      }

      const parsed = buildingManagerMailIntakeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
      }

      const { subscriptionId, senderName, senderType, envelopePhotoDocId, isSensitive } = parsed.data;

      const subscription = await storage.getRegisteredOfficeSubscriptionById(subscriptionId);
      if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
      }
      if (subscription.serviceAddressId !== location.id) {
        return res.status(403).json({ message: "This subscription is not at your location" });
      }

      const result = await mailroomService.intakeMail(
        subscriptionId,
        senderName,
        senderType,
        envelopePhotoDocId,
        isSensitive ?? false,
        { confirmedOfficialMail: true }
      );

      await storage.createAuditLog({
        actorUserId: userId,
        action: "building_manager_mail_intake",
        entityType: "mail_item",
        entityId: String(result.mailItem.id),
        details: { subscriptionId, senderName, senderType, locationId: location.id },
        ipAddress: req.ip,
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error recording mail intake:", error);
      if (error.code === "SUBSCRIPTION_EXPIRED") {
        return res.status(400).json({ message: error.message, code: error.code });
      }
      if (error.code === "OVERAGE_REASON_REQUIRED") {
        return res.status(400).json({ message: error.message, code: error.code });
      }
      res.status(500).json({ message: error.message || "Failed to record mail intake" });
    }
  });

  // ============== KYC SERVICE ROUTES ==============
  registerKycServiceRoutes(app);

  return httpServer;
}
