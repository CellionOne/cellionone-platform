/**
 * CIE Admin Routes — Cellion Intelligence Engine
 *
 * All endpoints require admin authentication.
 * Handles securities management, price ingestion, model versions,
 * score management, signals, and market pulse.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import multer from "multer";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import {
  parseCsvBuffer,
  parseXlsxBuffer,
  parsePdfBuffer,
  buildPreview,
  commitRows,
  type IngestPreviewResult,
} from "../services/cieDataIngestionService";
import { triggerImmediateScoreRun } from "../services/cieScheduler";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

async function isAdmin(req: Request): Promise<boolean> {
  const userId = (req as any).user?.claims?.sub;
  if (!userId) return false;
  const roles = await storage.getUserRoles(userId);
  return roles.includes("admin");
}

function getUserId(req: Request): string {
  return (req as any).user?.claims?.sub ?? "system";
}

export function registerCieAdminRoutes(app: Express): void {

  // ================================================================
  // SECURITIES MANAGEMENT
  // ================================================================

  /** GET /api/admin/cie/securities — list all securities */
  app.get("/api/admin/cie/securities", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const activeOnly = req.query.activeOnly !== "false";
      const securities = await storage.listCieSecurities(activeOnly);
      res.json({ securities, count: securities.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /** POST /api/admin/cie/securities — create a new security */
  app.post("/api/admin/cie/securities", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const schema = z.object({
        symbol: z.string().min(1).max(20).transform(s => s.toUpperCase()),
        name: z.string().min(2).max(255),
        sector: z.string().min(2).max(100),
        exchange: z.string().max(50).optional(),
        isActive: z.boolean().optional(),
      });
      const body = schema.parse(req.body);
      const sec = await storage.upsertCieSecurity({
        symbol: body.symbol,
        name: body.name,
        sector: body.sector,
        exchange: body.exchange ?? "NGX",
        isActive: body.isActive ?? true,
      });
      await storage.createAuditLog({
        actorUserId: getUserId(req),
        action: "cie_security_created",
        entityType: "cie_security",
        entityId: sec.symbol,
        details: { name: sec.name, sector: sec.sector },
      });
      res.status(201).json(sec);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  /** PUT /api/admin/cie/securities/:id — update a security */
  app.put("/api/admin/cie/securities/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const id = parseInt(req.params.id);
      const schema = z.object({
        name: z.string().min(2).max(255).optional(),
        sector: z.string().min(2).max(100).optional(),
        isActive: z.boolean().optional(),
      });
      const body = schema.parse(req.body);
      const sec = await storage.updateCieSecurity(id, body);
      if (!sec) return res.status(404).json({ error: "Security not found" });
      res.json(sec);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  // ================================================================
  // PRICE DATA INGESTION — TWO-STEP FLOW
  // ================================================================

  /**
   * POST /api/admin/cie/ingest/preview
   * Step 1: Upload file, parse it, return a preview with row counts.
   * No data is written to the database.
   */
  app.post("/api/admin/cie/ingest/preview", isAuthenticated, upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const file = req.file;
      if (!file) return res.status(400).json({ error: "No file uploaded" });

      const mime = file.mimetype.toLowerCase();
      const filename = file.originalname.toLowerCase();
      let format: "csv" | "xlsx" | "pdf";
      let rows: ReturnType<typeof parseCsvBuffer>;

      if (filename.endsWith(".csv") || mime.includes("csv")) {
        format = "csv";
        rows = parseCsvBuffer(file.buffer);
      } else if (filename.endsWith(".xlsx") || filename.endsWith(".xls") || mime.includes("spreadsheet") || mime.includes("excel")) {
        format = "xlsx";
        rows = parseXlsxBuffer(file.buffer);
      } else if (filename.endsWith(".pdf") || mime.includes("pdf")) {
        format = "pdf";
        rows = await parsePdfBuffer(file.buffer, file.originalname);
      } else {
        return res.status(400).json({ error: "Unsupported file type. Upload CSV, XLSX, or PDF." });
      }

      const preview = await buildPreview(format, rows);

      res.json({
        ...preview,
        filename: file.originalname,
        fileSize: file.size,
        // Omit full row lists from response to keep payload small
        acceptedRows: undefined,
        rejectedRows: preview.rejectedRows.slice(0, 20), // show first 20 rejections
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/admin/cie/ingest/commit
   * Step 2: Re-parse and commit the file to the database.
   * Triggers score recomputation after commit.
   */
  app.post("/api/admin/cie/ingest/commit", isAuthenticated, upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const file = req.file;
      if (!file) return res.status(400).json({ error: "No file uploaded" });

      const filename = file.originalname.toLowerCase();
      let format: "csv" | "xlsx" | "pdf";
      let rows: ReturnType<typeof parseCsvBuffer>;

      if (filename.endsWith(".csv") || file.mimetype.includes("csv")) {
        format = "csv";
        rows = parseCsvBuffer(file.buffer);
      } else if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
        format = "xlsx";
        rows = parseXlsxBuffer(file.buffer);
      } else if (filename.endsWith(".pdf") || file.mimetype.includes("pdf")) {
        format = "pdf";
        rows = await parsePdfBuffer(file.buffer, file.originalname);
      } else {
        return res.status(400).json({ error: "Unsupported file type" });
      }

      const preview = await buildPreview(format, rows);
      const result = await commitRows(preview, getUserId(req), file.originalname);

      await storage.createAuditLog({
        actorUserId: getUserId(req),
        action: "cie_price_data_committed",
        entityType: "cie_ingestion_log",
        entityId: String(result.logId),
        details: { format, filename: file.originalname, committed: result.committed, skipped: result.skipped },
      });

      // Trigger immediate score recomputation in the background
      triggerImmediateScoreRun().catch(err => {
        console.error("[CIEAdmin] Score recomputation after ingest failed:", err.message);
      });

      res.json({
        logId: result.logId,
        committed: result.committed,
        skipped: result.skipped,
        rowsExtracted: preview.rowsExtracted,
        rowsRejected: preview.rowsRejected,
        flaggedSymbols: preview.flaggedSymbols,
        message: `${result.committed} price rows committed. Score recomputation triggered.`,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /** GET /api/admin/cie/ingest/logs — list recent ingestion logs */
  app.get("/api/admin/cie/ingest/logs", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 100);
      const logs = await storage.listCieIngestionLogs(limit);
      res.json({ logs, count: logs.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ================================================================
  // MODEL VERSIONS
  // ================================================================

  /** GET /api/admin/cie/model-versions — list all model versions */
  app.get("/api/admin/cie/model-versions", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const versions = await storage.listCieModelVersions();
      res.json({ versions, count: versions.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /** POST /api/admin/cie/model-versions — create a new model version */
  app.post("/api/admin/cie/model-versions", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const schema = z.object({
        versionLabel: z.string().min(2).max(50),
        weights: z.object({
          momentum: z.number().min(0).max(1),
          liquidity: z.number().min(0).max(1),
          valuation: z.number().min(0).max(1),
          quality: z.number().min(0).max(1),
          growth: z.number().min(0).max(1),
          financialStrength: z.number().min(0).max(1),
        }),
        notes: z.string().max(500).optional(),
      }).refine(data => {
        const sum = Object.values(data.weights).reduce((a, b) => a + b, 0);
        return Math.abs(sum - 1) < 0.001; // must sum to ~1.0
      }, { message: "Pillar weights must sum to 1.0" });

      const body = schema.parse(req.body);
      const mv = await storage.createCieModelVersion({
        versionLabel: body.versionLabel,
        weights: body.weights,
        notes: body.notes ?? null,
        status: "pending",
        submittedByUserId: getUserId(req),
      });

      await storage.createAuditLog({
        actorUserId: getUserId(req),
        action: "cie_model_version_created",
        entityType: "cie_model_version",
        entityId: String(mv.id),
        details: { versionLabel: mv.versionLabel, weights: mv.weights },
      });

      res.status(201).json(mv);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  /** POST /api/admin/cie/model-versions/:id/activate — activate a model version */
  app.post("/api/admin/cie/model-versions/:id/activate", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const id = parseInt(req.params.id);
      const mv = await storage.activateCieModelVersion(id, getUserId(req));
      if (!mv) return res.status(404).json({ error: "Model version not found" });

      await storage.createAuditLog({
        actorUserId: getUserId(req),
        action: "cie_model_version_activated",
        entityType: "cie_model_version",
        entityId: String(id),
        details: { versionLabel: mv.versionLabel },
      });

      // Trigger immediate recomputation with new model
      triggerImmediateScoreRun().catch(err => {
        console.error("[CIEAdmin] Score recomputation after model activation failed:", err.message);
      });

      res.json({ ...mv, message: "Model version activated. Score recomputation triggered." });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ================================================================
  // SCORES
  // ================================================================

  /** GET /api/admin/cie/scores — get latest scores for all securities */
  app.get("/api/admin/cie/scores", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const scores = await storage.listLatestCieScores();
      res.json({ scores, count: scores.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /** GET /api/admin/cie/scores/:securityId/history — score history for one security */
  app.get("/api/admin/cie/scores/:securityId/history", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const securityId = parseInt(req.params.securityId);
      const days = Math.min(parseInt(String(req.query.days ?? "30")), 365);
      const history = await storage.listCieScoreHistory(securityId, days);
      res.json({ history, count: history.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /** POST /api/admin/cie/scores/run — trigger immediate score run */
  app.post("/api/admin/cie/scores/run", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const result = await triggerImmediateScoreRun();
      await storage.createAuditLog({
        actorUserId: getUserId(req),
        action: "cie_scores_manually_triggered",
        entityType: "cie_scheduler",
        entityId: new Date().toISOString().slice(0, 10),
        details: result,
      });
      res.json({ ...result, message: `Score run complete: ${result.scored} scored, ${result.skipped} skipped` });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ================================================================
  // SIGNALS (analyst intel)
  // ================================================================

  /** GET /api/admin/cie/signals — list all signals */
  app.get("/api/admin/cie/signals", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const publishedOnly = req.query.publishedOnly === "true";
      const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 200);
      const signals = await storage.listCieSignals(publishedOnly, limit);
      res.json({ signals, count: signals.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /** POST /api/admin/cie/signals — create a signal */
  app.post("/api/admin/cie/signals", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const schema = z.object({
        securityId: z.number().int().optional(),
        type: z.enum(["rumour", "news", "trade_call", "sector_rotation"]),
        sentiment: z.enum(["bullish", "bearish", "neutral"]).optional(),
        credibility: z.number().int().min(1).max(5).optional(),
        content: z.string().min(10).max(5000),
        tags: z.array(z.string()).optional(),
        isPublished: z.boolean().optional(),
        expiresInDays: z.number().int().min(1).max(365).optional(),
      });
      const body = schema.parse(req.body);

      const sig = await storage.createCieSignal({
        securityId: body.securityId ?? null,
        type: body.type,
        sentiment: body.sentiment ?? null,
        credibility: body.credibility ?? null,
        content: body.content,
        analystUserId: getUserId(req),
        tags: body.tags ?? null,
        isPublished: body.isPublished ?? false,
        publishedAt: body.isPublished ? new Date() : null,
        expiresAt: body.expiresInDays
          ? new Date(Date.now() + body.expiresInDays * 86400000)
          : null,
      });

      res.status(201).json(sig);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  /** PATCH /api/admin/cie/signals/:id — update a signal */
  app.patch("/api/admin/cie/signals/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const id = parseInt(req.params.id);
      const schema = z.object({
        content: z.string().min(10).max(5000).optional(),
        sentiment: z.enum(["bullish", "bearish", "neutral"]).optional(),
        credibility: z.number().int().min(1).max(5).optional(),
        tags: z.array(z.string()).optional(),
        isPublished: z.boolean().optional(),
      });
      const body = schema.parse(req.body);

      const updates: Record<string, any> = { ...body };
      if (body.isPublished === true) updates.publishedAt = new Date();

      const sig = await storage.updateCieSignal(id, updates);
      if (!sig) return res.status(404).json({ error: "Signal not found" });
      res.json(sig);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  /** DELETE /api/admin/cie/signals/:id — delete a signal */
  app.delete("/api/admin/cie/signals/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const id = parseInt(req.params.id);
      await storage.deleteCieSignal(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ================================================================
  // MARKET PULSE
  // ================================================================

  /** GET /api/admin/cie/market-pulse — get latest market pulse */
  app.get("/api/admin/cie/market-pulse", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const pulse = await storage.getLatestCieMarketPulse();
      res.json(pulse ?? null);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /** PUT /api/admin/cie/market-pulse — update market pulse */
  app.put("/api/admin/cie/market-pulse", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const schema = z.object({
        asiIndex: z.number().int().positive(),         // ASI ×100
        brentCrudeUsdCents: z.number().int().positive(), // Brent crude cents
        ngnPerUsd: z.number().int().positive(),         // NGN per USD ×100
        asiChange: z.number().int().optional(),         // daily change bps
        source: z.string().max(50).optional(),
      });
      const body = schema.parse(req.body);
      const pulse = await storage.upsertCieMarketPulse({
        ...body,
        asiChange: body.asiChange ?? null,
        source: body.source ?? "manual",
        updatedAt: new Date(),
      });

      await storage.createAuditLog({
        actorUserId: getUserId(req),
        action: "cie_market_pulse_updated",
        entityType: "cie_market_pulse",
        entityId: String(pulse.id),
        details: { asiIndex: body.asiIndex, ngnPerUsd: body.ngnPerUsd },
      });

      res.json(pulse);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  // ================================================================
  // DIVIDENDS
  // ================================================================

  /** GET /api/admin/cie/dividends — list all upcoming dividends */
  app.get("/api/admin/cie/dividends", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const upcomingOnly = req.query.upcomingOnly === "true";
      const dividends = await storage.listCieDividends(upcomingOnly);
      res.json({ dividends, count: dividends.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /** POST /api/admin/cie/dividends — create a dividend record */
  app.post("/api/admin/cie/dividends", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const schema = z.object({
        securityId: z.number().int().positive(),
        exDividendDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        amountPerShareNaira: z.number().positive(),
        notes: z.string().max(500).optional(),
      });
      const body = schema.parse(req.body);
      const div = await storage.createCieDividend({
        securityId: body.securityId,
        exDividendDate: body.exDividendDate,
        paymentDate: body.paymentDate ?? null,
        amountPerShareKobo: Math.round(body.amountPerShareNaira * 100),
        notes: body.notes ?? null,
      });
      res.status(201).json(div);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: e.message });
    }
  });

  /** DELETE /api/admin/cie/dividends/:id — delete a dividend */
  app.delete("/api/admin/cie/dividends/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const id = parseInt(req.params.id);
      await storage.deleteCieDividend(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  console.log("[CIE] Admin routes registered");
}
