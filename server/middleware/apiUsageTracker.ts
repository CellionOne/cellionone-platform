/**
 * API Usage Tracker — fire-and-forget monthly rollup middleware
 * Attach to /api/v1/* routes. Reads apiKeyContext set by authenticateApiKey.
 * Never throws or blocks the request.
 */

import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { apiUsageSummary } from "@shared/schema";
import type { ApiKeyRequest } from "./apiKeyAuth";

/** Extract the module segment from a /api/v1/<module>/... path */
function extractModule(path: string): string {
  // Strip query string
  const clean = path.split("?")[0];
  // e.g. /api/v1/cie/pulse -> cie; /api/v1/kyc/lookup/bvn -> kyc
  const match = clean.match(/^\/api\/v1\/([^/]+)/);
  return match ? match[1] : "unknown";
}

/** Normalise a path to a stable endpoint key (strip UUIDs, numeric IDs, tokens) */
function normaliseEndpoint(path: string): string {
  return path
    .split("?")[0]
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id")
    .replace(/\/\d+/g, "/:id")
    .replace(/\/[a-zA-Z0-9_-]{32,}/g, "/:token")
    .substring(0, 150);
}

export async function trackApiUsage(
  apiKeyId: number,
  path: string,
  statusCode: number,
): Promise<void> {
  try {
    const now = new Date();
    const periodYear = now.getFullYear();
    const periodMonth = now.getMonth() + 1;
    const module = extractModule(path);
    const endpoint = normaliseEndpoint(path);
    const isError = statusCode >= 400 ? 1 : 0;

    await db.execute(sql`
      INSERT INTO api_usage_summary
        (api_key_id, period_year, period_month, module, endpoint, request_count, error_count, updated_at)
      VALUES
        (${apiKeyId}, ${periodYear}, ${periodMonth}, ${module}, ${endpoint}, 1, ${isError}, now())
      ON CONFLICT (api_key_id, period_year, period_month, module, endpoint)
      DO UPDATE SET
        request_count = api_usage_summary.request_count + 1,
        error_count   = api_usage_summary.error_count + ${isError},
        updated_at    = now()
    `);
  } catch (e) {
    // Non-blocking — log but never propagate
    console.error("[apiUsageTracker] upsert failed:", e);
  }
}

/** Express middleware — attach to app.use("/api/v1", ...) */
export function apiUsageTrackerMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.on("finish", () => {
    const apiKeyId = (req as ApiKeyRequest).apiKeyContext?.apiKeyId;
    if (!apiKeyId) return; // unauthenticated requests (e.g. /api/v1/status) are skipped
    // Fire-and-forget
    trackApiUsage(apiKeyId, req.path, res.statusCode).catch(() => {});
  });
  next();
}
