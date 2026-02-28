import type { Request, Response, NextFunction } from "express";
import { validateApiKey, checkRateLimit, logApiUsage } from "../services/kycApiKeyService";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { kycBillingAccounts, kycCreditTransactions } from "@shared/schema";
import { sql } from "drizzle-orm";

export interface ApiKeyRequest extends Request {
  apiKeyContext?: {
    apiKeyId: number;
    orgId: number;
    permissions: string[];
  };
}

export function authenticateApiKey(requiredPermission?: string) {
  return async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const apiKey = req.headers["x-api-key"] as string;

    if (!apiKey) {
      return res.status(401).json({ error: "Missing X-API-Key header" });
    }

    if (!apiKey.startsWith("co_live_")) {
      return res.status(401).json({ error: "Invalid API key format" });
    }

    const result = await validateApiKey(apiKey);
    if (!result) {
      return res.status(401).json({ error: "Invalid or expired API key" });
    }

    const { apiKey: keyRecord, orgId, permissions } = result;

    if (requiredPermission && !permissions.includes(requiredPermission)) {
      await logApiUsage(
        keyRecord.id,
        req.path,
        req.method,
        403,
        req.ip || null,
        Date.now() - startTime
      );
      return res.status(403).json({ error: `Missing required permission: ${requiredPermission}` });
    }

    const withinLimit = await checkRateLimit(keyRecord.id, keyRecord.rateLimitPerMinute);
    if (!withinLimit) {
      await logApiUsage(
        keyRecord.id,
        req.path,
        req.method,
        429,
        req.ip || null,
        Date.now() - startTime
      );
      return res.status(429).json({
        error: "Rate limit exceeded",
        retryAfter: 60,
      });
    }

    const [billingAccount] = await db.select().from(kycBillingAccounts)
      .where(eq(kycBillingAccounts.organisationId, orgId));

    if (!billingAccount || !billingAccount.isActive) {
      await logApiUsage(
        keyRecord.id,
        req.path,
        req.method,
        402,
        req.ip || null,
        Date.now() - startTime
      );
      return res.status(402).json({
        error: "No active billing account. Please set up billing before using the API.",
      });
    }

    if (billingAccount.billingMode === "prepaid") {
      if (billingAccount.creditBalance <= 0) {
        await logApiUsage(
          keyRecord.id,
          req.path,
          req.method,
          402,
          req.ip || null,
          Date.now() - startTime
        );
        return res.status(402).json({
          error: "Insufficient credits. Please purchase more credits to continue.",
          creditBalance: billingAccount.creditBalance,
        });
      }
    } else if (billingAccount.billingMode === "invoiced") {
      const creditLimit = billingAccount.creditLimit || 0;
      const [usageResult] = await db.select({
        totalUsed: sql<number>`COALESCE(SUM(ABS(${kycCreditTransactions.amount})) FILTER (WHERE ${kycCreditTransactions.type} = 'usage'), 0)`,
      }).from(kycCreditTransactions)
        .where(eq(kycCreditTransactions.billingAccountId, billingAccount.id));

      const totalUsed = Number(usageResult?.totalUsed ?? 0);
      if (creditLimit > 0 && totalUsed >= creditLimit) {
        await logApiUsage(
          keyRecord.id,
          req.path,
          req.method,
          402,
          req.ip || null,
          Date.now() - startTime
        );
        return res.status(402).json({
          error: "Credit limit reached. Please contact support to increase your limit.",
          creditLimit,
          totalUsed,
        });
      }
    }

    req.apiKeyContext = {
      apiKeyId: keyRecord.id,
      orgId,
      permissions,
    };

    res.on("finish", () => {
      logApiUsage(
        keyRecord.id,
        req.path,
        req.method,
        res.statusCode,
        req.ip || null,
        Date.now() - startTime
      ).catch(err => console.error("[API Key] Failed to log usage:", err));
    });

    next();
  };
}
