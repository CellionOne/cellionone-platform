/**
 * requireDevAuth — protects developer portal routes
 * Checks req.session.developerOrgId (integer) set at login.
 * Attaches req.developerOrg to the request.
 */

import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { developerOrgs, type DeveloperOrg } from "@shared/schema";

export interface DevAuthRequest extends Request {
  developerOrg?: DeveloperOrg;
}

export async function requireDevAuth(
  req: DevAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const devOrgId = (req.session as any).developerOrgId as number | undefined;
  if (!devOrgId) {
    res.status(401).json({ error: "Developer authentication required" });
    return;
  }

  try {
    const [org] = await db.select().from(developerOrgs).where(eq(developerOrgs.id, devOrgId)).limit(1);
    if (!org || org.isSuspended) {
      res.status(401).json({ error: "Developer account not found or suspended" });
      return;
    }
    req.developerOrg = org;
    next();
  } catch (err) {
    console.error("[requireDevAuth] DB error:", err);
    res.status(500).json({ error: "Authentication check failed" });
  }
}
