/**
 * CIE Admin Routes — Cellion Intelligence Engine
 *
 * All endpoints require admin authentication.
 * Implements the two-step analyst ingestion workflow:
 *   POST /ingest/preview  → parse + validate, return previewToken + full row set
 *   POST /ingest/confirm  → submit previewToken + acceptedRowIndices, commit approved rows only
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
  commitFromToken,
  generatePricesTemplate,
  generateDividendsTemplate,
  generateSignalsTemplate,
  generateDataEntryGuide,
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
  // DATA ENTRY GUIDE & TEMPLATES
  // ================================================================

  /** GET /api/admin/cie/data-entry-guide — full JSON guide with field specs and workflow */
  app.get("/api/admin/cie/data-entry-guide", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      res.json(generateDataEntryGuide());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /** GET /api/admin/cie/templates/:type — download CSV template (prices | dividends | signals) */
  app.get("/api/admin/cie/templates/:type", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const { type } = req.params;

      let csv: string;
      let filename: string;

      if (type === "prices") {
        csv = generatePricesTemplate();
        filename = "cie-prices-template.csv";
      } else if (type === "dividends") {
        csv = generateDividendsTemplate();
        filename = "cie-dividends-template.csv";
      } else if (type === "signals") {
        csv = generateSignalsTemplate();
        filename = "cie-signals-template.csv";
      } else {
        return res.status(404).json({ error: `Unknown template type '${type}'. Use: prices | dividends | signals` });
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

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
  // PRICE DATA INGESTION — TWO-STEP ANALYST FLOW
  // ================================================================

  /**
   * POST /api/admin/cie/ingest/preview  (Step 1)
   *
   * Parse an uploaded file (CSV / XLSX / PDF) and return:
   *   - previewToken   — UUID valid for 30 minutes
   *   - acceptedRows   — all validated price rows with rowIndex + confidence flags
   *   - rejectedRows   — parsing failures with reason
   *   - flaggedSymbols — symbols not in the master securities list
   *   - lowConfidenceCount — rows where confidence < 0.70 (PDF only)
   *
   * NO data is written to the database at this step.
   */
  app.post("/api/admin/cie/ingest/preview", isAuthenticated, upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const file = req.file;
      if (!file) return res.status(400).json({ error: "No file uploaded" });

      const mime = file.mimetype.toLowerCase();
      const filename = file.originalname.toLowerCase();
      let format: "csv" | "xlsx" | "pdf";
      let rows;

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

      const preview = await buildPreview(format, rows, file.originalname);

      res.json({
        previewToken: preview.previewToken,
        format: preview.format,
        filename: preview.filename,
        fileSize: file.size,
        rowsExtracted: preview.rowsExtracted,
        rowsAccepted: preview.rowsAccepted,
        rowsRejected: preview.rowsRejected,
        rowsFlagged: preview.rowsFlagged,
        lowConfidenceCount: preview.lowConfidenceCount,
        flaggedSymbols: preview.flaggedSymbols,
        acceptedRows: preview.acceptedRows,              // full list with rowIndex + confidence
        rejectedRows: preview.rejectedRows.slice(0, 50), // cap at 50 for response size
        previewRows: preview.previewRows,                // first 20 for quick display
        expiresAt: preview.expiresAt,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /api/admin/cie/ingest/confirm  (Step 2)
   *
   * Analyst submits their decision: which rows from the preview to commit.
   * Body: { previewToken: string, acceptedRowIndices?: number[] }
   *   - If acceptedRowIndices is omitted, ALL accepted rows from preview are committed.
   *   - If acceptedRowIndices is provided, ONLY those rowIndex values are committed.
   *
   * After commit, triggers immediate score recomputation.
   */
  app.post("/api/admin/cie/ingest/confirm", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const schema = z.object({
        previewToken: z.string().uuid("previewToken must be a valid UUID"),
        acceptedRowIndices: z.array(z.number().int().nonnegative()).optional(),
      });

      const body = schema.parse(req.body);
      const userId = getUserId(req);

      const result = await commitFromToken(
        body.previewToken,
        body.acceptedRowIndices ?? null, // null = commit all accepted rows
        userId,
        userId
      );

      await storage.createAuditLog({
        actorUserId: userId,
        action: "cie_price_data_confirmed",
        entityType: "cie_ingestion_log",
        entityId: String(result.logId),
        details: {
          uploadId: result.uploadId,
          committed: result.committed,
          skipped: result.skipped,
          analystSelectedRows: body.acceptedRowIndices?.length ?? "all",
        },
      });

      // Background score recomputation
      triggerImmediateScoreRun().catch(err => {
        console.error("[CIEAdmin] Score recomputation after confirm failed:", err.message);
      });

      res.json({
        logId: result.logId,
        uploadId: result.uploadId,
        committed: result.committed,
        skipped: result.skipped,
        message: `${result.committed} price rows committed. Score recomputation triggered.`,
      });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      if (e.message?.includes("Preview token")) return res.status(410).json({ error: e.message });
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
        return Math.abs(sum - 1) < 0.001;
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
  // SIGNALS
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
        asiIndex: z.number().int().positive(),
        brentCrudeUsdCents: z.number().int().positive(),
        ngnPerUsd: z.number().int().positive(),
        asiChange: z.number().int().optional(),
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

  /** GET /api/admin/cie/dividends — list all dividends */
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
