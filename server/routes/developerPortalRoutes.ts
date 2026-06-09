/**
 * Developer Portal Routes
 * Self-service registration, login, API key management, usage stats.
 */

import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { db } from "../db";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { Resend } from "resend";
import {
  developerOrgs,
  developerEmailTokens,
  kycApiKeys,
  kycApiUsageLogs,
  apiUsageSummary,
  type DeveloperOrg,
} from "@shared/schema";
import { requireDevAuth, type DevAuthRequest } from "../middleware/requireDevAuth";

const resend = new Resend(process.env.RESEND_API_KEY);
const BCRYPT_ROUNDS = 12;
const APP_URL = process.env.APP_URL || "https://cellionone.com";
const ALLOWED_SCOPES = ["verify:identity", "verify:business", "escrow:read", "escrow:write", "bureau:read", "bureau:write", "formation:read", "formation:write", "intelligence:read"];

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function sendVerificationEmail(email: string, name: string, verifyUrl: string): Promise<void> {
  await resend.emails.send({
    from: "Cellion One Developers <noreply@cellionone.com>",
    to: email,
    subject: "Verify your Cellion One developer account",
    html: `
      <p>Hi ${name},</p>
      <p>Thanks for registering as a Cellion One API developer. Please verify your email address to get started:</p>
      <p><a href="${verifyUrl}" style="background:#1a7a4a;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Verify Email Address</a></p>
      <p>This link expires in 24 hours.</p>
      <p>If you didn't register, you can ignore this email.</p>
      <p>— Cellion One Developer Platform</p>
    `,
  });
}

export function registerDeveloperPortalRoutes(app: Express): void {

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/developers/register
  // ──────────────────────────────────────────────────────────────────────────
  app.post("/api/developers/register", async (req: Request, res: Response) => {
    try {
      const body = z.object({
        name: z.string().min(2).max(200).trim(),
        email: z.string().email().toLowerCase().trim(),
        password: z.string().min(8).max(128),
        orgType: z.string().max(50).optional(),
        website: z.string().url().max(300).optional().or(z.literal("")),
        country: z.string().length(3).default("NGA"),
      }).parse(req.body);

      const [existing] = await db.select({ id: developerOrgs.id })
        .from(developerOrgs).where(eq(developerOrgs.email, body.email)).limit(1);
      if (existing) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
      const [org] = await db.insert(developerOrgs).values({
        name: body.name,
        email: body.email,
        passwordHash,
        orgType: body.orgType ?? null,
        website: body.website || null,
        country: body.country,
        isEmailVerified: false,
        isApproved: false,
        sandboxOnly: true,
        tier: "starter",
      }).returning();

      // Generate email verification token
      const rawToken = crypto.randomBytes(48).toString("hex");
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db.insert(developerEmailTokens).values({ orgId: org.id, tokenHash, expiresAt });

      const verifyUrl = `${APP_URL}/developers/verify-email?token=${rawToken}`;

      try {
        await sendVerificationEmail(body.email, body.name, verifyUrl);
      } catch (emailErr) {
        console.error("[DeveloperPortal] Failed to send verification email:", emailErr);
      }

      return res.status(201).json({ message: "Registration successful. Check your email to verify your account." });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: err.errors });
      console.error("[DeveloperPortal] Register error:", err);
      return res.status(500).json({ error: "Registration failed" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/developers/login
  // ──────────────────────────────────────────────────────────────────────────
  app.post("/api/developers/login", async (req: Request, res: Response) => {
    try {
      const body = z.object({
        email: z.string().email().toLowerCase().trim(),
        password: z.string().min(1),
      }).parse(req.body);

      const [org] = await db.select().from(developerOrgs).where(eq(developerOrgs.email, body.email)).limit(1);
      if (!org) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      if (org.isSuspended) {
        return res.status(403).json({ error: "This account has been suspended" });
      }
      if (!org.isEmailVerified) {
        return res.status(403).json({ error: "Please verify your email before logging in", code: "EMAIL_NOT_VERIFIED" });
      }

      const passwordOk = await bcrypt.compare(body.password, org.passwordHash);
      if (!passwordOk) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      (req.session as any).developerOrgId = org.id;
      req.session.save((err) => {
        if (err) {
          console.error("[DeveloperPortal] Session save error:", err);
          return res.status(500).json({ error: "Login failed" });
        }
        return res.json({
          org: {
            id: org.id,
            name: org.name,
            email: org.email,
            tier: org.tier,
            sandboxOnly: org.sandboxOnly,
            isApproved: org.isApproved,
          },
        });
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: err.errors });
      console.error("[DeveloperPortal] Login error:", err);
      return res.status(500).json({ error: "Login failed" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/developers/logout
  // ──────────────────────────────────────────────────────────────────────────
  app.post("/api/developers/logout", (req: Request, res: Response) => {
    delete (req.session as any).developerOrgId;
    req.session.save(() => res.json({ message: "Logged out" }));
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/developers/verify-email?token=xxx
  // ──────────────────────────────────────────────────────────────────────────
  app.get("/api/developers/verify-email", async (req: Request, res: Response) => {
    try {
      const rawToken = String(req.query.token || "");
      if (!rawToken) return res.redirect("/developers/login?error=invalid_token");

      const tokenHash = hashToken(rawToken);
      const [record] = await db.select().from(developerEmailTokens)
        .where(eq(developerEmailTokens.tokenHash, tokenHash)).limit(1);

      if (!record) return res.redirect("/developers/login?error=invalid_token");
      if (record.usedAt) return res.redirect("/developers/dashboard?message=already_verified");
      if (new Date() > record.expiresAt) return res.redirect("/developers/register?error=token_expired");

      await db.update(developerEmailTokens)
        .set({ usedAt: new Date() })
        .where(eq(developerEmailTokens.id, record.id));

      await db.update(developerOrgs)
        .set({ isEmailVerified: true, updatedAt: new Date() })
        .where(eq(developerOrgs.id, record.orgId));

      return res.redirect("/developers/login?message=email_verified");
    } catch (err) {
      console.error("[DeveloperPortal] Verify email error:", err);
      return res.redirect("/developers/login?error=verification_failed");
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/developers/me (requireDevAuth)
  // ──────────────────────────────────────────────────────────────────────────
  app.get("/api/developers/me", requireDevAuth, (req: DevAuthRequest, res: Response) => {
    const org = req.developerOrg!;
    res.json({
      id: org.id,
      name: org.name,
      email: org.email,
      tier: org.tier,
      sandboxOnly: org.sandboxOnly,
      isApproved: org.isApproved,
      orgType: org.orgType,
      website: org.website,
      country: org.country,
      createdAt: org.createdAt,
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/developers/keys
  // ──────────────────────────────────────────────────────────────────────────
  app.get("/api/developers/keys", requireDevAuth, async (req: DevAuthRequest, res: Response) => {
    try {
      const orgId = req.developerOrg!.id;

      const keys = await db.select().from(kycApiKeys)
        .where(and(eq(kycApiKeys.developerOrgId, orgId), eq(kycApiKeys.isActive, true)))
        .orderBy(desc(kycApiKeys.createdAt));

      const keysWithUsage = await Promise.all(keys.map(async (k) => {
        const [usage] = await db.select({
          lastUsedAt: sql<string>`MAX(${kycApiUsageLogs.createdAt})`.as("last_used_at"),
          totalCalls: sql<number>`COUNT(*)`.as("total_calls"),
        }).from(kycApiUsageLogs).where(eq(kycApiUsageLogs.apiKeyId, k.id));
        return {
          id: k.id,
          name: k.name,
          keyPrefix: k.keyPrefix,
          environment: k.environment ?? "live",
          permissions: k.permissions,
          isActive: k.isActive,
          createdAt: k.createdAt,
          lastUsedAt: usage?.lastUsedAt ?? null,
          totalCalls: Number(usage?.totalCalls ?? 0),
        };
      }));

      res.json({ keys: keysWithUsage });
    } catch (err) {
      console.error("[DeveloperPortal] GET /keys error:", err);
      res.status(500).json({ error: "Failed to list keys" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/developers/keys
  // ──────────────────────────────────────────────────────────────────────────
  app.post("/api/developers/keys", requireDevAuth, async (req: DevAuthRequest, res: Response) => {
    try {
      const body = z.object({
        name: z.string().min(1).max(255).trim(),
        environment: z.enum(["live", "test"]).default("live"),
        permissions: z.array(z.enum(ALLOWED_SCOPES as [string, ...string[]])).min(1),
      }).parse(req.body);

      const org = req.developerOrg!;
      if (org.sandboxOnly && body.environment === "live") {
        return res.status(403).json({ error: "Sandbox-only accounts cannot create live keys. Contact us to enable live access.", code: "SANDBOX_ONLY" });
      }

      const prefix = body.environment === "test" ? "co1_test_" : "co1_live_";
      const rawKey = `${prefix}${crypto.randomBytes(24).toString("hex")}`;
      const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
      const keyPrefix = rawKey.substring(0, 12);

      await db.insert(kycApiKeys).values({
        developerOrgId: org.id,
        name: body.name,
        environment: body.environment,
        keyPrefix,
        keyHash,
        permissions: body.permissions,
        rateLimitPerMinute: 60,
        isActive: true,
      });

      return res.status(201).json({
        apiKey: rawKey,
        name: body.name,
        environment: body.environment,
        permissions: body.permissions,
        message: "Store this key securely — it will not be shown again.",
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: err.errors });
      console.error("[DeveloperPortal] POST /keys error:", err);
      return res.status(500).json({ error: "Failed to create key" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE /api/developers/keys/:id
  // ──────────────────────────────────────────────────────────────────────────
  app.delete("/api/developers/keys/:id", requireDevAuth, async (req: DevAuthRequest, res: Response) => {
    try {
      const keyId = parseInt(String(req.params.id), 10);
      const orgId = req.developerOrg!.id;

      const [key] = await db.select().from(kycApiKeys)
        .where(and(eq(kycApiKeys.id, keyId), eq(kycApiKeys.developerOrgId, orgId))).limit(1);

      if (!key) return res.status(404).json({ error: "Key not found" });

      await db.update(kycApiKeys)
        .set({ isActive: false, revokedAt: new Date() })
        .where(eq(kycApiKeys.id, keyId));

      res.json({ message: "Key revoked" });
    } catch (err) {
      console.error("[DeveloperPortal] DELETE /keys/:id error:", err);
      res.status(500).json({ error: "Failed to revoke key" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/developers/usage
  // ──────────────────────────────────────────────────────────────────────────
  app.get("/api/developers/usage", requireDevAuth, async (req: DevAuthRequest, res: Response) => {
    try {
      const orgId = req.developerOrg!.id;

      const orgKeys = await db.select({ id: kycApiKeys.id })
        .from(kycApiKeys).where(eq(kycApiKeys.developerOrgId, orgId));
      const keyIds = orgKeys.map(k => k.id);
      if (keyIds.length === 0) return res.json({ byModule: [], total: 0 });

      const rows = await db.select({
        module: apiUsageSummary.module,
        requestCount: sql<number>`SUM(${apiUsageSummary.requestCount})`.as("request_count"),
        errorCount: sql<number>`SUM(${apiUsageSummary.errorCount})`.as("error_count"),
      }).from(apiUsageSummary)
        .where(inArray(apiUsageSummary.apiKeyId, keyIds))
        .groupBy(apiUsageSummary.module);

      const total = rows.reduce((acc, r) => acc + Number(r.requestCount), 0);
      res.json({ byModule: rows, total });
    } catch (err) {
      console.error("[DeveloperPortal] GET /usage error:", err);
      res.status(500).json({ error: "Failed to retrieve usage" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/developers/usage/monthly
  // ──────────────────────────────────────────────────────────────────────────
  app.get("/api/developers/usage/monthly", requireDevAuth, async (req: DevAuthRequest, res: Response) => {
    try {
      const orgId = req.developerOrg!.id;

      const orgKeys = await db.select({ id: kycApiKeys.id })
        .from(kycApiKeys).where(eq(kycApiKeys.developerOrgId, orgId));
      const keyIds = orgKeys.map(k => k.id);
      if (keyIds.length === 0) return res.json({ months: [] });

      const rows = await db.select({
        periodYear: apiUsageSummary.periodYear,
        periodMonth: apiUsageSummary.periodMonth,
        module: apiUsageSummary.module,
        requestCount: sql<number>`SUM(${apiUsageSummary.requestCount})`.as("request_count"),
        errorCount: sql<number>`SUM(${apiUsageSummary.errorCount})`.as("error_count"),
      }).from(apiUsageSummary)
        .where(inArray(apiUsageSummary.apiKeyId, keyIds))
        .groupBy(apiUsageSummary.periodYear, apiUsageSummary.periodMonth, apiUsageSummary.module)
        .orderBy(desc(apiUsageSummary.periodYear), desc(apiUsageSummary.periodMonth));

      res.json({ months: rows });
    } catch (err) {
      console.error("[DeveloperPortal] GET /usage/monthly error:", err);
      res.status(500).json({ error: "Failed to retrieve monthly usage" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PATCH /api/developers/settings
  // ──────────────────────────────────────────────────────────────────────────
  app.patch("/api/developers/settings", requireDevAuth, async (req: DevAuthRequest, res: Response) => {
    try {
      const body = z.object({
        name: z.string().min(2).max(200).trim().optional(),
        website: z.string().url().max(300).optional().or(z.literal("")),
        orgType: z.string().max(50).optional(),
      }).parse(req.body);

      const [updated] = await db.update(developerOrgs)
        .set({ ...body, website: body.website || null, updatedAt: new Date() })
        .where(eq(developerOrgs.id, req.developerOrg!.id))
        .returning();

      res.json({ org: updated });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: err.errors });
      res.status(500).json({ error: "Settings update failed" });
    }
  });
}
