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
import { db } from "../db";
import { eq, and, gte, count, desc, sql } from "drizzle-orm";
import type { InsertCieSignal } from "../../shared/schema";
import { cieSubscriptions, ciePartners, kycApiKeys, kycApiUsageLogs, users } from "../../shared/schema";
import { generatePartnerApiKey } from "../services/kycApiKeyService";
import { invalidateCieApiKeyTierCache } from "../middleware/apiKeyAuth";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import {
  parseCsvBuffer,
  parseXlsxBuffer,
  parsePdfBuffer,
  parseDocxBuffer,
  parseTextContent,
  parseDividendDocument,
  buildPreview,
  buildDividendPreview,
  getStoredDividendPreview,
  deleteStoredDividendPreview,
  commitFromToken,
  generatePricesTemplate,
  generateDividendsTemplate,
  generateSignalsTemplate,
  generatePricesXlsxTemplate,
  generateDividendsXlsxTemplate,
  generateSignalsXlsxTemplate,
  generateDataEntryGuide,
} from "../services/cieDataIngestionService";
import { triggerImmediateScoreRun } from "../services/cieScheduler";
import { generateCieSignalDraft, generateCieMarketCommentary, isOpenAIAvailable } from "../services/aiService";
import { generateAlphaIntelReport, getCachedAlphaIntelReport, setCachedAlphaIntelReport } from "../services/cieReportService";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

/** Express Request extended with Replit Auth user claims */
interface AuthenticatedRequest extends Request {
  user?: {
    claims?: {
      sub?: string;
    };
  };
}

async function isAdmin(req: AuthenticatedRequest): Promise<boolean> {
  const userId = req.user?.claims?.sub;
  if (!userId) return false;
  const roles = await storage.getUserRoles(userId);
  return roles.includes("admin");
}

async function isSuperAdmin(req: AuthenticatedRequest): Promise<boolean> {
  const userId = req.user?.claims?.sub;
  if (!userId) return false;
  const roles = await storage.getUserRoles(userId);
  return roles.includes("super_admin");
}

/** Returns true for both full admin and the restricted cie_analyst role */
async function isCieAnalystOrAdmin(req: AuthenticatedRequest): Promise<boolean> {
  const userId = req.user?.claims?.sub;
  if (!userId) return false;
  const roles = await storage.getUserRoles(userId);
  return roles.includes("admin") || roles.includes("cie_analyst");
}

function getUserId(req: AuthenticatedRequest): string {
  return req.user?.claims?.sub ?? "system";
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : "Internal server error";
}

export function registerCieAdminRoutes(app: Express): void {

  // ================================================================
  // DATA ENTRY GUIDE & TEMPLATES
  // ================================================================

  /** GET /api/admin/cie/data-entry-guide — full JSON guide with field specs and workflow */
  app.get("/api/admin/cie/data-entry-guide", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isCieAnalystOrAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      res.json(generateDataEntryGuide());
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
    }
  });

  /**
   * GET /api/admin/cie/templates/:type[?format=xlsx]
   * Download a data entry template for prices | dividends | signals.
   * Accepts optional ?format=xlsx for Excel workbook; defaults to CSV.
   */
  app.get("/api/admin/cie/templates/:type", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isCieAnalystOrAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const { type } = req.params;
      const isXlsx = req.query.format === "xlsx";

      const validTypes = ["prices", "dividends", "signals"] as const;
      if (!validTypes.includes(type as typeof validTypes[number])) {
        return res.status(404).json({ error: `Unknown template type '${type}'. Use: prices | dividends | signals` });
      }

      if (isXlsx) {
        let buf: Buffer;
        let filename: string;
        if (type === "prices") {
          buf = generatePricesXlsxTemplate();
          filename = "cie-prices-template.xlsx";
        } else if (type === "dividends") {
          buf = generateDividendsXlsxTemplate();
          filename = "cie-dividends-template.xlsx";
        } else {
          buf = generateSignalsXlsxTemplate();
          filename = "cie-signals-template.xlsx";
        }
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.send(buf);
      }

      // CSV (default)
      let csv: string;
      let filename: string;
      if (type === "prices") {
        csv = generatePricesTemplate();
        filename = "cie-prices-template.csv";
      } else if (type === "dividends") {
        csv = generateDividendsTemplate();
        filename = "cie-dividends-template.csv";
      } else {
        csv = generateSignalsTemplate();
        filename = "cie-signals-template.csv";
      }
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
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
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
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
    } catch (e: unknown) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: errMsg(e) });
    }
  });

  /** PUT /api/admin/cie/securities/:id — update a security */
  app.put("/api/admin/cie/securities/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const id = parseInt(req.params.id as string);
      const schema = z.object({
        name: z.string().min(2).max(255).optional(),
        sector: z.string().min(2).max(100).optional(),
        isActive: z.boolean().optional(),
        // Intelligence fields (analyst-maintained)
        divBehaviourPattern: z.enum(["HEAVY_SELL", "MODERATE", "HOLDER", "HOLDER_PLUS", "UNKNOWN"]).nullable().optional(),
        entryZoneLowKobo: z.number().int().nullable().optional(),
        entryZoneHighKobo: z.number().int().nullable().optional(),
        targetPriceKobo: z.number().int().nullable().optional(),
      });
      const body = schema.parse(req.body);
      const sec = await storage.updateCieSecurity(id, body);
      if (!sec) return res.status(404).json({ error: "Security not found" });
      res.json(sec);
    } catch (e: unknown) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: errMsg(e) });
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
      if (!await isCieAnalystOrAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const file = req.file;
      if (!file) return res.status(400).json({ error: "No file uploaded" });

      const mime = file.mimetype.toLowerCase();
      const filename = file.originalname.toLowerCase();
      let format: "csv" | "xlsx" | "pdf" | "docx";
      let rows;

      if (filename.endsWith(".csv") || mime.includes("csv")) {
        format = "csv";
        rows = parseCsvBuffer(file.buffer, file.originalname);
      } else if (filename.endsWith(".xlsx") || filename.endsWith(".xls") || mime.includes("spreadsheet") || mime.includes("excel")) {
        format = "xlsx";
        rows = parseXlsxBuffer(file.buffer, file.originalname);
      } else if (filename.endsWith(".pdf") || mime.includes("pdf")) {
        format = "pdf";
        rows = await parsePdfBuffer(file.buffer, file.originalname);
      } else if (filename.endsWith(".docx") || mime.includes("wordprocessingml") || mime.includes("msword")) {
        format = "docx";
        rows = await parseDocxBuffer(file.buffer, file.originalname);
      } else {
        return res.status(400).json({ error: "Unsupported file type. Upload CSV, XLSX, PDF, or DOCX." });
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
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
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
      if (!await isCieAnalystOrAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const schema = z.object({
        previewToken: z.string().uuid("previewToken must be a valid UUID"),
        acceptedRowIndices: z.array(z.number().int().nonnegative()).optional(),
      });

      const body = schema.parse(req.body);
      const userId = getUserId(req);

      type WhatChangedItem = { ticker: string; field: string; oldVal: string; newVal: string };

      // Snapshot previous prices + scores before commit (for threshold comparison)
      const [prevPrices, prevScores, allSecurities] = await Promise.all([
        storage.listLatestCiePricesAllActive(),
        storage.getLatestCieScores(),
        storage.listCieSecurities(true),
      ]);
      const prevPriceMap = new Map(prevPrices.map(p => [p.securityId, p]));
      const prevScoreMap = new Map(prevScores.map(s => [s.securityId, s]));
      const secById = new Map(allSecurities.map(s => [s.id, s]));

      const result = await commitFromToken(
        body.previewToken,
        body.acceptedRowIndices ?? null, // null = commit all accepted rows
        userId,
        userId
      );

      // Run score engine synchronously so we can diff pre/post recommendations
      let newScores: typeof prevScores = [];
      try {
        await triggerImmediateScoreRun();
        newScores = await storage.getLatestCieScores();
        // Regenerate and cache the Alpha Intel report in the background (non-blocking)
        generateAlphaIntelReport()
          .then(buf => setCachedAlphaIntelReport(buf))
          .catch(err => console.error("[CIEAdmin] Background report regeneration failed:", err instanceof Error ? err.message : String(err)));
      } catch (err: unknown) {
        console.error("[CIEAdmin] Score recomputation after confirm failed:", err instanceof Error ? err.message : String(err));
      }
      // Load new prices for Day% computation
      const newPrices = await storage.listLatestCiePricesAllActive();

      const whatChanged: WhatChangedItem[] = [];

      for (const np of newPrices) {
        const old = prevPriceMap.get(np.securityId);
        const ticker = secById.get(np.securityId)?.symbol ?? String(np.securityId);

        // Day% threshold crossing (flag if abs day% >= 2%)
        if (np.openKobo && np.openKobo > 0) {
          const dayPct = ((np.closeKobo - np.openKobo) / np.openKobo) * 100;
          if (Math.abs(dayPct) >= 2) {
            whatChanged.push({
              ticker,
              field: "Day%",
              oldVal: old?.openKobo && old.openKobo > 0
                ? `${(((old.closeKobo - old.openKobo) / old.openKobo) * 100).toFixed(2)}%`
                : "—",
              newVal: `${dayPct.toFixed(2)}%`,
            });
          }
        }

        // Close price change >=5% vs previous day's close
        if (old && old.closeKobo > 0) {
          const changePct = ((np.closeKobo - old.closeKobo) / old.closeKobo) * 100;
          if (Math.abs(changePct) >= 5) {
            whatChanged.push({
              ticker,
              field: "Close vs prev close",
              oldVal: `₦${(old.closeKobo / 100).toFixed(2)}`,
              newVal: `₦${(np.closeKobo / 100).toFixed(2)} (${changePct > 0 ? "+" : ""}${changePct.toFixed(2)}%)`,
            });
          }
        }
      }

      // Recommendation transitions from score engine recomputation
      for (const ns of newScores) {
        const ps = prevScoreMap.get(ns.securityId);
        if (!ps) continue;
        if (ps.recommendation !== ns.recommendation && ps.recommendation && ns.recommendation) {
          const ticker = secById.get(ns.securityId)?.symbol ?? String(ns.securityId);
          whatChanged.push({
            ticker,
            field: "Recommendation",
            oldVal: ps.recommendation,
            newVal: ns.recommendation,
          });
        }
        // RSI threshold crossings (entering/exiting overbought 70 or oversold 30)
        const prevRsi = ps.rsi14 ?? null;
        const newRsi = ns.rsi14 ?? null;
        if (prevRsi !== null && newRsi !== null) {
          const enteredOverbought = prevRsi <= 70 && newRsi > 70;
          const exitedOverbought = prevRsi > 70 && newRsi <= 70;
          const enteredOversold = prevRsi >= 30 && newRsi < 30;
          const exitedOversold = prevRsi < 30 && newRsi >= 30;
          if (enteredOverbought || exitedOverbought || enteredOversold || exitedOversold) {
            const ticker = secById.get(ns.securityId)?.symbol ?? String(ns.securityId);
            whatChanged.push({
              ticker,
              field: "RSI(14)",
              oldVal: prevRsi.toFixed(1),
              newVal: `${newRsi.toFixed(1)} (${enteredOverbought ? "⚠️ Overbought" : exitedOverbought ? "Exit overbought" : enteredOversold ? "📉 Oversold" : "Exit oversold"})`,
            });
          }
        }
      }

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
          whatChangedCount: whatChanged.length,
        },
      });

      res.json({
        logId: result.logId,
        uploadId: result.uploadId,
        committed: result.committed,
        skipped: result.skipped,
        message: `${result.committed} price rows committed. Score recomputation complete.`,
        whatChanged,
      });
    } catch (e: unknown) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      const msg = errMsg(e);
      if (msg.includes("Preview token")) return res.status(410).json({ error: msg });
      res.status(500).json({ error: msg });
    }
  });

  /**
   * POST /api/admin/cie/ingest/preview-text  (Step 1 — paste-text variant)
   *
   * Accepts { text: string } — analyst-pasted raw content from any source.
   * Returns the same preview token structure as the file-upload preview endpoint.
   */
  app.post("/api/admin/cie/ingest/preview-text", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isCieAnalystOrAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const schema = z.object({ text: z.string().min(10, "Paste at least 10 characters of text") });
      const { text } = schema.parse(req.body);

      const rows = await parseTextContent(text);
      const preview = await buildPreview("text", rows, "pasted-text");

      res.json({
        previewToken: preview.previewToken,
        format: preview.format,
        filename: preview.filename,
        rowsExtracted: preview.rowsExtracted,
        rowsAccepted: preview.rowsAccepted,
        rowsRejected: preview.rowsRejected,
        rowsFlagged: preview.rowsFlagged,
        lowConfidenceCount: preview.lowConfidenceCount,
        flaggedSymbols: preview.flaggedSymbols,
        acceptedRows: preview.acceptedRows,
        rejectedRows: preview.rejectedRows.slice(0, 50),
        previewRows: preview.previewRows,
        expiresAt: preview.expiresAt,
      });
    } catch (e: unknown) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: errMsg(e) });
    }
  });

  /**
   * POST /api/admin/cie/dividends/parse-document  (Step 1 — dividend AI extraction)
   *
   * Accepts a file (PDF or DOCX) OR { text: string } body.
   * Returns a dividend preview token + proposed DividendRow[] for analyst review.
   * No data is written at this step.
   */
  app.post("/api/admin/cie/dividends/parse-document",
    isAuthenticated,
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        if (!await isCieAnalystOrAdmin(req)) return res.status(403).json({ error: "Forbidden" });

        let rows;
        let format: "pdf" | "docx" | "text";
        let filename = "dividend-document";

        const file = req.file;
        if (file) {
          const mime = file.mimetype.toLowerCase();
          const fn = file.originalname.toLowerCase();
          filename = file.originalname;

          if (fn.endsWith(".pdf") || mime.includes("pdf")) {
            format = "pdf";
            rows = await parseDividendDocument({ type: "pdf", buffer: file.buffer, filename: file.originalname });
          } else if (fn.endsWith(".docx") || mime.includes("wordprocessingml") || mime.includes("msword")) {
            format = "docx";
            rows = await parseDividendDocument({ type: "docx", buffer: file.buffer, filename: file.originalname });
          } else {
            return res.status(400).json({ error: "Unsupported file type for dividend extraction. Upload PDF or DOCX." });
          }
        } else {
          // Body may be raw text
          const schema = z.object({ text: z.string().min(10, "Paste at least 10 characters of text") });
          const { text } = schema.parse(req.body);
          format = "text";
          rows = await parseDividendDocument({ type: "text", text });
        }

        const preview = await buildDividendPreview(rows, format, filename);

        res.json({
          previewToken: preview.previewToken,
          format: preview.format,
          filename: preview.filename,
          rowsExtracted: preview.rowsExtracted,
          rowsAccepted: preview.rowsAccepted,
          rowsRejected: preview.rowsRejected,
          acceptedRows: preview.acceptedRows,
          rejectedRows: preview.rejectedRows,
          previewRows: preview.previewRows,
          expiresAt: preview.expiresAt,
        });
      } catch (e: unknown) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
        res.status(500).json({ error: errMsg(e) });
      }
    }
  );

  /**
   * POST /api/admin/cie/dividends/confirm-parsed
   *
   * Analyst commits AI-extracted dividend rows selected by rowIndex.
   * Body: { previewToken: string, acceptedRowIndices?: number[] }
   */
  app.post("/api/admin/cie/dividends/confirm-parsed", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isCieAnalystOrAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const schema = z.object({
        previewToken: z.string().uuid("previewToken must be a valid UUID"),
        acceptedRowIndices: z.array(z.number().int().nonnegative()).optional(),
      });
      const body = schema.parse(req.body);

      const preview = getStoredDividendPreview(body.previewToken);
      if (!preview) return res.status(410).json({ error: "Dividend preview token not found or expired. Please re-upload." });

      const rowsToCommit = body.acceptedRowIndices != null
        ? preview.acceptedRows.filter(r => body.acceptedRowIndices!.includes(r.rowIndex))
        : preview.acceptedRows;

      const securities = await storage.listCieSecurities(false);
      const symbolToId = new Map(securities.map(s => [s.symbol, s.id]));

      let committed = 0;
      const errors: string[] = [];

      for (const row of rowsToCommit) {
        const secId = symbolToId.get(row.ticker);
        if (!secId) { errors.push(`${row.ticker}: ticker not found in securities master list`); continue; }

        try {
          await storage.createCieDividend({
            securityId: secId,
            exDividendDate: row.exDividendDate,
            paymentDate: row.paymentDate ?? null,
            amountPerShareKobo: Math.round(row.amountPerShareNaira * 100),
            notes: null,
          });
          committed++;
        } catch (err: unknown) {
          errors.push(`${row.ticker}: ${err instanceof Error ? err.message : "database error"}`);
        }
      }

      deleteStoredDividendPreview(body.previewToken);

      res.json({
        committed,
        skipped: rowsToCommit.length - committed,
        errors: errors.slice(0, 20),
        message: `${committed} dividend record${committed !== 1 ? "s" : ""} committed.`,
      });
    } catch (e: unknown) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: errMsg(e) });
    }
  });

  /** GET /api/admin/cie/ingest/logs — list recent ingestion logs */
  app.get("/api/admin/cie/ingest/logs", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isCieAnalystOrAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 100);
      const logs = await storage.listCieIngestionLogs(limit);
      res.json({ logs, count: logs.length });
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
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
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
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
        status: "draft",
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
    } catch (e: unknown) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: errMsg(e) });
    }
  });

  /** POST /api/admin/cie/model-versions/:id/submit — submit a draft version for approval (draft → pending) */
  app.post("/api/admin/cie/model-versions/:id/submit", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const id = parseInt(req.params.id as string);
      const mv = await storage.submitCieModelVersion(id);
      if (!mv) return res.status(409).json({ error: "Model version not found or not in draft status" });

      await storage.createAuditLog({
        actorUserId: getUserId(req),
        action: "cie_model_version_submitted",
        entityType: "cie_model_version",
        entityId: String(id),
        details: { versionLabel: mv.versionLabel },
      });

      res.json({ ...mv, message: "Model version submitted for review." });
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
    }
  });

  /** POST /api/admin/cie/model-versions/:id/activate — activate a pending model version (pending → active)
   * Requires SUPER ADMIN — standard admins may only submit (draft → pending); activation is a governance boundary. */
  app.post("/api/admin/cie/model-versions/:id/activate", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isSuperAdmin(req)) return res.status(403).json({ error: "Forbidden: super-admin required to activate model versions" });
      const id = parseInt(req.params.id as string);
      const mv = await storage.activateCieModelVersion(id, getUserId(req));
      if (!mv) return res.status(409).json({ error: "Model version not found or not in pending status — submit for review first" });

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
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
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
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
    }
  });

  /** GET /api/admin/cie/scores/:securityId/history — score history for one security */
  app.get("/api/admin/cie/scores/:securityId/history", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const securityId = parseInt(req.params.securityId as string);
      const days = Math.min(parseInt(String(req.query.days ?? "30")), 365);
      const history = await storage.listCieScoreHistory(securityId, days);
      res.json({ history, count: history.length });
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
    }
  });

  /** POST /api/admin/cie/scores/run — trigger immediate score run */
  app.post("/api/admin/cie/scores/run", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isCieAnalystOrAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const result = await triggerImmediateScoreRun();
      await storage.createAuditLog({
        actorUserId: getUserId(req),
        action: "cie_scores_manually_triggered",
        entityType: "cie_scheduler",
        entityId: new Date().toISOString().slice(0, 10),
        details: result,
      });
      res.json({ ...result, message: `Score run complete: ${result.scored} scored, ${result.skipped} skipped` });
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
    }
  });

  // ================================================================
  // SIGNALS
  // ================================================================

  /** GET /api/admin/cie/signals — list all signals */
  app.get("/api/admin/cie/signals", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isCieAnalystOrAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const publishedOnly = req.query.publishedOnly === "true";
      const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 200);
      const signals = await storage.listCieSignals(publishedOnly, limit);
      res.json({ signals, count: signals.length });
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
    }
  });

  /** POST /api/admin/cie/signals — create a signal */
  app.post("/api/admin/cie/signals", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isCieAnalystOrAdmin(req)) return res.status(403).json({ error: "Forbidden" });
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
    } catch (e: unknown) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: errMsg(e) });
    }
  });

  /** PATCH /api/admin/cie/signals/:id — update a signal */
  app.patch("/api/admin/cie/signals/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isCieAnalystOrAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const id = parseInt(req.params.id as string);
      const schema = z.object({
        content: z.string().min(10).max(5000).optional(),
        sentiment: z.enum(["bullish", "bearish", "neutral"]).optional(),
        credibility: z.number().int().min(1).max(5).optional(),
        tags: z.array(z.string()).optional(),
        isPublished: z.boolean().optional(),
      });
      const body = schema.parse(req.body);

      const updates: Partial<InsertCieSignal> = { ...body };
      if (body.isPublished === true) updates.publishedAt = new Date();

      const sig = await storage.updateCieSignal(id, updates);
      if (!sig) return res.status(404).json({ error: "Signal not found" });
      res.json(sig);
    } catch (e: unknown) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: errMsg(e) });
    }
  });

  /** DELETE /api/admin/cie/signals/:id — delete a signal */
  app.delete("/api/admin/cie/signals/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isCieAnalystOrAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const id = parseInt(req.params.id as string);
      await storage.deleteCieSignal(id);
      res.json({ success: true });
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
    }
  });

  /** POST /api/admin/cie/signals/ai-draft — generate AI signal draft */
  app.post("/api/admin/cie/signals/ai-draft", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isCieAnalystOrAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      if (!isOpenAIAvailable()) {
        return res.status(503).json({ error: "AI assistant is not available in this environment.", code: "AI_UNAVAILABLE" });
      }

      const schema = z.object({
        prompt: z.string().min(0).max(2000).optional().default(""),
        ticker: z.string().optional(),
        sector: z.string().optional(),
        signalType: z.enum(["trade_call", "news", "rumour", "sector_rotation"]).optional(),
      });
      const { prompt, ticker, sector, signalType } = schema.parse(req.body);

      // Require at least a ticker OR a non-empty prompt to generate a meaningful draft
      if (!prompt && !ticker) {
        return res.status(400).json({ error: "Provide at least a ticker symbol or analyst notes to generate a draft." });
      }

      // Optionally enrich with score data for the ticker
      let currentIas: number | null = null;
      let currentRecommendation: string | null = null;
      let resolvedSector = sector ?? null;
      if (ticker) {
        const security = await storage.getCieSecurityBySymbol(ticker.toUpperCase());
        if (security) {
          resolvedSector = resolvedSector ?? security.sector;
          const score = await storage.getLatestCieScore(security.id);
          if (score) {
            currentIas = score.ias;
            currentRecommendation = score.recommendation;
          }
        }
      }

      const draft = await generateCieSignalDraft({
        prompt,
        ticker: ticker ?? null,
        sector: resolvedSector,
        currentIas,
        currentRecommendation,
        signalType: signalType ?? null,
      });
      if (!draft) return res.status(503).json({ error: "AI signal draft generation failed. Please try again." });

      res.json({ draft });
    } catch (e: unknown) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: errMsg(e) });
    }
  });

  /** POST /api/admin/cie/market-pulse/ai-commentary — regenerate AI market commentary on demand */
  app.post("/api/admin/cie/market-pulse/ai-commentary", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isCieAnalystOrAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      if (!isOpenAIAvailable()) {
        return res.status(503).json({ error: "AI commentary is not available in this environment.", code: "AI_UNAVAILABLE" });
      }
      const pulse = await storage.getLatestCieMarketPulse();
      const scores = await storage.getLatestCieScores();
      const topSecurities = [...scores]
        .filter(s => s.ias != null)
        .sort((a, b) => (b.ias ?? 0) - (a.ias ?? 0))
        .slice(0, 5)
        .map(s => ({ ticker: s.symbol, name: s.name, ias: s.ias ?? 0, recommendation: s.recommendation ?? "", sector: s.sector }));
      const today = new Date().toISOString().slice(0, 10);
      const commentary = await generateCieMarketCommentary({
        asiIndex: pulse?.asiIndex != null ? pulse.asiIndex / 100 : null,
        asiChangePct: pulse?.asiChange != null ? pulse.asiChange / 10000 : null,
        brentCrudeUsd: pulse?.brentCrudeUsdCents != null ? pulse.brentCrudeUsdCents / 100 : null,
        ngnPerUsd: pulse?.ngnPerUsd != null ? pulse.ngnPerUsd / 100 : null,
        topSecurities,
        scoreDate: today,
      });
      if (!commentary) return res.status(503).json({ error: "AI commentary generation failed. Please try again." });
      const stored = await storage.updateLatestCieMarketPulseCommentary(commentary);
      if (!stored) {
        return res.status(409).json({ error: "AI commentary generated but no market pulse record exists to attach it to. Upload market pulse data first." });
      }
      res.json({ commentary });
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
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
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
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
    } catch (e: unknown) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: errMsg(e) });
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
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
    }
  });

  /** POST /api/admin/cie/dividends — create a dividend record (accepts securityId OR ticker) */
  app.post("/api/admin/cie/dividends", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const schema = z.object({
        securityId: z.number().int().positive().optional(),
        ticker: z.string().optional(),
        exDividendDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        amountPerShareNaira: z.number().positive(),
        notes: z.string().max(500).optional(),
      }).refine(d => d.securityId != null || d.ticker != null, { message: "securityId or ticker is required" });
      const body = schema.parse(req.body);

      let resolvedSecId = body.securityId;
      if (!resolvedSecId && body.ticker) {
        const secs = await storage.listCieSecurities(false);
        const found = secs.find(s => s.symbol.toUpperCase() === body.ticker!.toUpperCase());
        if (!found) return res.status(404).json({ error: `Security not found: ${body.ticker}` });
        resolvedSecId = found.id;
      }

      const div = await storage.createCieDividend({
        securityId: resolvedSecId!,
        exDividendDate: body.exDividendDate,
        paymentDate: body.paymentDate ?? null,
        amountPerShareKobo: Math.round(body.amountPerShareNaira * 100),
        notes: body.notes ?? null,
      });
      res.status(201).json(div);
    } catch (e: unknown) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: errMsg(e) });
    }
  });

  /** DELETE /api/admin/cie/dividends/:id — delete a dividend */
  app.delete("/api/admin/cie/dividends/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const id = parseInt(req.params.id as string);
      await storage.deleteCieDividend(id);
      res.json({ success: true });
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
    }
  });

  // ================================================================
  // REVENUE & SUBSCRIBER METRICS
  // ================================================================

  /**
   * GET /api/admin/cie/revenue
   * Subscription counts by tier, MRR, churn rate, and full subscriber list.
   */
  app.get("/api/admin/cie/revenue", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Active subscriptions by tier
      const active = await db.select()
        .from(cieSubscriptions)
        .where(and(eq(cieSubscriptions.status, "active"), gte(cieSubscriptions.currentPeriodEnd, now)));

      const subscriberCount = active.filter(s => s.tier === "subscriber").length;
      const proCount = active.filter(s => s.tier === "pro").length;
      const totalActive = active.length;

      // MRR: ₦5,000 per subscriber, ₦10,000 per pro
      const mrrKobo = subscriberCount * 500_000 + proCount * 1_000_000;

      // Churn: subscriptions that were cancelled/expired in last 30 days
      const churned = await db.select({ id: cieSubscriptions.id })
        .from(cieSubscriptions)
        .where(and(
          sql`${cieSubscriptions.status} IN ('cancelled', 'expired')`,
          gte(cieSubscriptions.cancelledAt, thirtyDaysAgo),
        ));
      const churnLast30Days = churned.length;

      // Full subscriber list with user emails
      const activeWithUsers = await db.select({
        id: cieSubscriptions.id,
        userId: cieSubscriptions.userId,
        orgId: cieSubscriptions.orgId,
        tier: cieSubscriptions.tier,
        status: cieSubscriptions.status,
        currentPeriodEnd: cieSubscriptions.currentPeriodEnd,
        paystackCustomerCode: cieSubscriptions.paystackCustomerCode,
        cancelAtPeriodEnd: cieSubscriptions.cancelAtPeriodEnd,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
        .from(cieSubscriptions)
        .leftJoin(users, eq(cieSubscriptions.userId, users.id))
        .where(and(eq(cieSubscriptions.status, "active"), gte(cieSubscriptions.currentPeriodEnd, now)))
        .orderBy(cieSubscriptions.currentPeriodEnd);

      // Churn rate: churned / (currently active + churned) * 100
      const churnRatePct = (totalActive + churnLast30Days) > 0
        ? +((churnLast30Days / (totalActive + churnLast30Days)) * 100).toFixed(1)
        : 0;

      res.json({
        subscriberCount,
        proCount,
        totalActive,
        mrrKobo,
        mrrNaira: mrrKobo / 100,
        churnLast30Days,
        churnRatePct,
        subscribers: activeWithUsers.map(s => ({
          id: s.id,
          userId: s.userId,
          orgId: s.orgId,
          tier: s.tier,
          email: s.email,
          name: [s.firstName, s.lastName].filter(Boolean).join(" ") || "—",
          renewalDate: s.currentPeriodEnd,
          cancelAtPeriodEnd: s.cancelAtPeriodEnd,
          paystackCustomerCode: s.paystackCustomerCode,
        })),
      });
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
    }
  });

  // ================================================================
  // CIE PARTNER PROGRAMME — /api/admin/cie/partners
  // ================================================================

  /** GET /api/admin/cie/partners — list all partners with MTD call counts */
  app.get("/api/admin/cie/partners", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
    try {
      const partners = await db.select().from(ciePartners).orderBy(desc(ciePartners.createdAt));

      const now = new Date();
      const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Enrich each partner with their active key prefix and MTD call count.
      // MTD calls are aggregated across ALL keys for the partner (active + revoked)
      // so that calls made before a key rotation are not lost from reporting.
      const enriched = await Promise.all(partners.map(async (p) => {
        const allKeys = await db.select({ id: kycApiKeys.id, keyPrefix: kycApiKeys.keyPrefix, isActive: kycApiKeys.isActive })
          .from(kycApiKeys)
          .where(eq(kycApiKeys.ciePartnerId, p.id));

        const activeKey = allKeys.find(k => k.isActive) ?? null;
        let mtdCalls = 0;

        if (allKeys.length > 0) {
          const keyIds = allKeys.map(k => k.id);
          const [usage] = await db.select({ cnt: count() }).from(kycApiUsageLogs)
            .where(and(
              sql`${kycApiUsageLogs.apiKeyId} IN (${sql.join(keyIds.map(id => sql`${id}`), sql`, `)})`,
              gte(kycApiUsageLogs.createdAt, mtdStart),
            ));
          mtdCalls = Number(usage?.cnt ?? 0);
        }

        return {
          ...p,
          activeKeyPrefix: activeKey?.keyPrefix ?? null,
          mtdCalls,
        };
      }));

      res.json(enriched);
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
    }
  });

  /** POST /api/admin/cie/partners — create a new partner + generate API key */
  app.post("/api/admin/cie/partners", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

    const schema = z.object({
      orgName: z.string().min(2).max(255),
      contactName: z.string().max(255).optional(),
      contactEmail: z.string().email().max(255).optional(),
      cellionRevenueSharePct: z.number().int().min(0).max(100).default(60),
      tier: z.enum(["subscriber", "pro"]).default("subscriber"),
      notes: z.string().max(2000).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const data = parsed.data;
    try {
      const [partner] = await db.insert(ciePartners).values({
        orgName: data.orgName,
        contactName: data.contactName ?? null,
        contactEmail: data.contactEmail ?? null,
        cellionRevenueSharePct: data.cellionRevenueSharePct,
        tier: data.tier,
        status: "active",
        notes: data.notes ?? null,
      }).returning();

      const { key: plaintext, apiKey } = await generatePartnerApiKey(partner.id, partner.orgName, partner.tier);

      res.status(201).json({
        partner,
        apiKeyId: apiKey.id,
        keyPrefix: apiKey.keyPrefix,
        /** Returned once — never stored in plaintext */
        plaintextKey: plaintext,
      });
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
    }
  });

  /** PATCH /api/admin/cie/partners/:id — update partner details */
  app.patch("/api/admin/cie/partners/:id", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid partner id" });

    const schema = z.object({
      orgName: z.string().min(2).max(255).optional(),
      contactName: z.string().max(255).nullable().optional(),
      contactEmail: z.string().email().max(255).nullable().optional(),
      cellionRevenueSharePct: z.number().int().min(0).max(100).optional(),
      tier: z.enum(["subscriber", "pro"]).optional(),
      status: z.enum(["active", "inactive", "suspended"]).optional(),
      notes: z.string().max(2000).nullable().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    try {
      const [existing] = await db.select().from(ciePartners).where(eq(ciePartners.id, id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Partner not found" });

      const [updated] = await db.update(ciePartners)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(ciePartners.id, id))
        .returning();

      // Invalidate tier cache if tier or status changed
      if (parsed.data.tier !== undefined || parsed.data.status !== undefined) {
        invalidateCieApiKeyTierCache(null, null, id);
      }

      // If tier changed, immediately update rateLimitPerMinute on all active keys
      // so the new rate limit takes effect without requiring key regeneration.
      if (parsed.data.tier !== undefined) {
        const PARTNER_RATE_LIMITS: Record<string, number> = { subscriber: 500, pro: 1000 };
        const newRateLimit = PARTNER_RATE_LIMITS[parsed.data.tier] ?? 500;
        await db.update(kycApiKeys)
          .set({ rateLimitPerMinute: newRateLimit })
          .where(and(eq(kycApiKeys.ciePartnerId, id), eq(kycApiKeys.isActive, true)));
      }

      res.json(updated);
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
    }
  });

  /** POST /api/admin/cie/partners/:id/regenerate-key — revoke old key and issue new one */
  app.post("/api/admin/cie/partners/:id/regenerate-key", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid partner id" });

    try {
      const [partner] = await db.select().from(ciePartners).where(eq(ciePartners.id, id)).limit(1);
      if (!partner) return res.status(404).json({ error: "Partner not found" });

      // Revoke all existing active keys for this partner
      await db.update(kycApiKeys)
        .set({ isActive: false })
        .where(and(eq(kycApiKeys.ciePartnerId, id), eq(kycApiKeys.isActive, true)));

      // Generate a new key
      const { key: plaintext, apiKey } = await generatePartnerApiKey(partner.id, partner.orgName, partner.tier);

      // Invalidate cached tier
      invalidateCieApiKeyTierCache(null, null, id);

      res.json({
        apiKeyId: apiKey.id,
        keyPrefix: apiKey.keyPrefix,
        /** Returned once — never stored in plaintext */
        plaintextKey: plaintext,
      });
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
    }
  });

  /** GET /api/admin/cie/partners/revenue — partner revenue summary for Revenue tab */
  app.get("/api/admin/cie/partners/revenue", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    if (!await isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
    try {
      const now = new Date();
      const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const partners = await db.select().from(ciePartners)
        .where(eq(ciePartners.status, "active"))
        .orderBy(ciePartners.orgName);

      const result = await Promise.all(partners.map(async (p) => {
        const keys = await db.select({ id: kycApiKeys.id })
          .from(kycApiKeys)
          .where(eq(kycApiKeys.ciePartnerId, p.id));

        let mtdCalls = 0;
        if (keys.length > 0) {
          const keyIds = keys.map(k => k.id);
          const [usage] = await db.select({ cnt: count() }).from(kycApiUsageLogs)
            .where(and(
              sql`${kycApiUsageLogs.apiKeyId} IN (${sql.join(keyIds.map(id => sql`${id}`), sql`, `)})`,
              gte(kycApiUsageLogs.createdAt, mtdStart),
            ));
          mtdCalls = Number(usage?.cnt ?? 0);
        }

        return {
          partnerId: p.id,
          orgName: p.orgName,
          tier: p.tier,
          cellionRevenueSharePct: p.cellionRevenueSharePct,
          partnerRevenueSharePct: 100 - p.cellionRevenueSharePct,
          mtdCalls,
        };
      }));

      res.json(result);
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
    }
  });

  // ================================================================
  // REPORT DOWNLOAD
  // ================================================================

  /**
   * GET /api/admin/cie/report/latest
   * Download the latest Alpha Intel Excel report (5 tabs, all securities).
   * Report is generated on-demand — first call after a score run may take ~10s.
   */
  app.get("/api/admin/cie/report/latest", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isCieAnalystOrAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const today = new Date().toISOString().slice(0, 10);
      // Serve cached report if it was generated today, otherwise generate fresh
      const cached = getCachedAlphaIntelReport();
      let buf: Buffer;
      if (cached && cached.date === today) {
        buf = cached.buf;
      } else {
        buf = await generateAlphaIntelReport();
        setCachedAlphaIntelReport(buf);
      }

      res.setHeader("Content-Disposition", `attachment; filename="AlphaIntel_NGX_${today}.xlsx"`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Length", buf.length);
      res.send(buf);
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
    }
  });

  // ================================================================
  // MARKET CONTEXT
  // ================================================================

  /**
   * POST /api/admin/cie/market-context
   * Persist or update today's analyst macro inputs (ASI close, Brent, NGN/USD, CBN MPR).
   */
  app.post("/api/admin/cie/market-context", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isCieAnalystOrAdmin(req)) return res.status(403).json({ error: "Forbidden" });

      const schema = z.object({
        contextDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(new Date().toISOString().slice(0, 10)),
        asiClose: z.number().optional(),         // Naira value e.g. 101234.50
        asiChangePct: z.number().optional(),     // e.g. 1.25 means 1.25%
        brentUsd: z.number().optional(),          // e.g. 76.50
        ngnPerUsd: z.number().optional(),          // e.g. 1580.50
        cbnMpr: z.number().optional(),             // e.g. 26.50 (percent)
        gainersCount: z.number().int().optional(),
        losersCount: z.number().int().optional(),
        notes: z.string().optional(),
      });

      const body = schema.parse(req.body);
      const userId = getUserId(req);

      const ctx = await storage.upsertCieMarketContext({
        contextDate: body.contextDate,
        asiCloseKobo: body.asiClose != null ? Math.round(body.asiClose * 100) : null,
        asiChangePctBps: body.asiChangePct != null ? Math.round(body.asiChangePct * 100) : null,
        brentUsdCents: body.brentUsd != null ? Math.round(body.brentUsd * 100) : null,
        ngnPerUsd: body.ngnPerUsd != null ? Math.round(body.ngnPerUsd * 100) : null,
        cbnMprBps: body.cbnMpr != null ? Math.round(body.cbnMpr * 100) : null,
        gainersCount: body.gainersCount ?? null,
        losersCount: body.losersCount ?? null,
        notes: body.notes ?? null,
        createdByUserId: userId,
      });

      res.json({ success: true, context: ctx });
    } catch (e: unknown) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "Validation error", details: e.errors });
      res.status(500).json({ error: errMsg(e) });
    }
  });

  /**
   * GET /api/admin/cie/market-context/latest
   * Fetch the most recent analyst market context entry.
   */
  app.get("/api/admin/cie/market-context/latest", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!await isCieAnalystOrAdmin(req)) return res.status(403).json({ error: "Forbidden" });
      const ctx = await storage.getLatestCieMarketContext();
      res.json(ctx ?? null);
    } catch (e: unknown) {
      res.status(500).json({ error: errMsg(e) });
    }
  });

  console.log("[CIE] Admin routes registered");
}
