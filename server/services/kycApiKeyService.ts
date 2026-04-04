import crypto from "crypto";
import { db } from "../db";
import { eq, and, desc, sql, count, gte } from "drizzle-orm";
import {
  kycApiKeys, kycApiUsageLogs, kycBillingAccounts,
  kycOrganisations,
  type KycApiKey,
} from "@shared/schema";

const API_KEY_PREFIX = "co_live_";

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export async function generateApiKey(
  orgId: number,
  name: string,
  permissions: string[],
  dbOrTx: typeof db = db
): Promise<{ key: string; apiKey: KycApiKey }> {
  const randomPart = crypto.randomBytes(16).toString("hex");
  const fullKey = `${API_KEY_PREFIX}${randomPart}`;
  const keyPrefix = fullKey.slice(0, 12);
  const keyHash = hashKey(fullKey);

  const [apiKey] = await dbOrTx.insert(kycApiKeys).values({
    organisationId: orgId,
    keyPrefix,
    keyHash,
    name,
    permissions,
    rateLimitPerMinute: 60,
    isActive: true,
  }).returning();

  return { key: fullKey, apiKey };
}

export async function validateApiKey(
  key: string
): Promise<{ apiKey: KycApiKey; orgId: number | null; userId: string | null; permissions: string[] } | null> {
  const keyHash = hashKey(key);

  const [apiKey] = await db.select().from(kycApiKeys)
    .where(and(eq(kycApiKeys.keyHash, keyHash), eq(kycApiKeys.isActive, true)));

  if (!apiKey) return null;

  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
    return null;
  }

  await db.update(kycApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(kycApiKeys.id, apiKey.id));

  return {
    apiKey,
    orgId: apiKey.organisationId ?? null,
    userId: apiKey.userId ?? null,
    permissions: apiKey.permissions || [],
  };
}

export async function revokeApiKey(keyId: number, orgId: number): Promise<boolean> {
  const [updated] = await db.update(kycApiKeys)
    .set({ isActive: false })
    .where(and(eq(kycApiKeys.id, keyId), eq(kycApiKeys.organisationId, orgId)))
    .returning();

  return !!updated;
}

export async function listApiKeys(orgId: number): Promise<KycApiKey[]> {
  return db.select().from(kycApiKeys)
    .where(eq(kycApiKeys.organisationId, orgId))
    .orderBy(desc(kycApiKeys.createdAt));
}

export async function logApiUsage(
  keyId: number,
  endpoint: string,
  method: string,
  statusCode: number,
  ipAddress: string | null,
  responseTimeMs: number | null
): Promise<void> {
  const requestId = crypto.randomUUID();
  await db.insert(kycApiUsageLogs).values({
    apiKeyId: keyId,
    endpoint,
    method,
    statusCode,
    ipAddress: ipAddress || null,
    requestId,
    responseTimeMs: responseTimeMs || null,
  });
}

export async function getApiUsageStats(orgId: number): Promise<{
  totalRequests: number;
  last24h: number;
  last7d: number;
  last30d: number;
}> {
  const keys = await db.select({ id: kycApiKeys.id }).from(kycApiKeys)
    .where(eq(kycApiKeys.organisationId, orgId));

  if (keys.length === 0) {
    return { totalRequests: 0, last24h: 0, last7d: 0, last30d: 0 };
  }

  const keyIds = keys.map(k => k.id);

  const now = new Date();
  const day = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const month = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [stats] = await db.select({
    totalRequests: count(),
    last24h: sql<number>`COUNT(*) FILTER (WHERE ${kycApiUsageLogs.createdAt} >= ${day})`,
    last7d: sql<number>`COUNT(*) FILTER (WHERE ${kycApiUsageLogs.createdAt} >= ${week})`,
    last30d: sql<number>`COUNT(*) FILTER (WHERE ${kycApiUsageLogs.createdAt} >= ${month})`,
  }).from(kycApiUsageLogs)
    .where(sql`${kycApiUsageLogs.apiKeyId} IN (${sql.join(keyIds.map(id => sql`${id}`), sql`, `)})`);

  return {
    totalRequests: Number(stats?.totalRequests ?? 0),
    last24h: Number(stats?.last24h ?? 0),
    last7d: Number(stats?.last7d ?? 0),
    last30d: Number(stats?.last30d ?? 0),
  };
}

export async function checkRateLimit(keyId: number, limitPerMinute: number): Promise<boolean> {
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

  const [result] = await db.select({ cnt: count() }).from(kycApiUsageLogs)
    .where(and(
      eq(kycApiUsageLogs.apiKeyId, keyId),
      gte(kycApiUsageLogs.createdAt, oneMinuteAgo)
    ));

  return Number(result?.cnt ?? 0) < limitPerMinute;
}
