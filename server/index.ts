import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase } from "./seed";
import { startSubscriptionScheduler } from "./services/subscriptionScheduler";
import { runComplianceDeadlineCheck } from "./services/complianceScheduler";
import { runKycExpiryCheck, runSanctionsMonitoring, runIndividualExpiryCheck, runDocumentFilesExpiryCheck } from "./services/kycSchedulerService";
import { startCieScheduler } from "./services/cieScheduler";
import { runEscrowExpiry } from "./routes/escrowApiRoutes";
import { setupSecurityMiddleware, securityLogger, sessionTimeout, validateFileUploadMiddleware } from "./middleware/security";

// Log as early as possible so deployment systems can confirm startup
console.log(`[Startup] Cellion One server starting — NODE_ENV=${process.env.NODE_ENV || "development"} PID=${process.pid}`);

// ============== MANDATORY SECURITY SECRETS CHECK ==============
// ENCRYPTION_KEY is required for field-level AES-256-GCM encryption of PII (BVN, NIN).
// Fail fast in production — development allows missing key for easier local setup.
if (!process.env.ENCRYPTION_KEY) {
  if (process.env.NODE_ENV === "production") {
    console.error("[Security] FATAL: ENCRYPTION_KEY is not set. This secret is required to protect encrypted PII fields (BVN, NIN). Refusing to start in production without it.");
    process.exit(1);
  } else {
    console.warn("[Security] WARNING: ENCRYPTION_KEY is not set. Field encryption will fail if any encrypted PII is accessed. Set this secret before deploying to production.");
  }
}

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception (process kept alive):', err.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection (process kept alive):', reason);
});

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ============== HEALTH CHECK (registered before everything else) ==============
// Respond immediately so deployment health checks pass before full init completes
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", env: process.env.NODE_ENV || "development" });
});

// ============== SECURITY MIDDLEWARE ==============
// CRITICAL: Must be set up early, but AFTER webhook routes are registered
// (webhooks need raw body parsing which conflicts with some security headers)

// Security logging for suspicious requests (safe to add before webhooks)
app.use(securityLogger);

// ============== PAYSTACK WEBHOOK ROUTE ==============
// CRITICAL: Must be registered BEFORE express.json() middleware
// Paystack webhooks need raw body for signature verification (HMAC SHA512)
app.post(
  '/api/payments/paystack/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['x-paystack-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing x-paystack-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      // Validate that req.body is a Buffer
      if (!Buffer.isBuffer(req.body)) {
        const errorMsg = '[Paystack Webhook] req.body is not a Buffer. Webhook route may be registered after express.json()';
        console.error(errorMsg);
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      const payload = req.body.toString('utf8');

      // Dynamically import webhook handler
      const { default: paystackWebhookHandler } = await import('./services/paystackWebhookHandler');
      const result = await paystackWebhookHandler.processWebhook(payload, sig);

      if (!result.processed) {
        console.error('[Paystack Webhook] Failed to process:', result.error);
        return res.status(400).json({ error: result.error });
      }

      res.status(200).json({ received: true, event: result.event });
    } catch (error: any) {
      console.error('[Paystack Webhook] Error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

// ============== YOUVERIFY FIELD AGENT WEBHOOK ROUTE ==============
// CRITICAL: Must be registered BEFORE express.json() middleware
app.post(
  '/api/webhooks/youverify',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const payload = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
      const headersMap: Record<string, string | string[] | undefined> = {};
      Object.keys(req.headers).forEach(k => { headersMap[k] = req.headers[k]; });
      const { processYouverifyWebhook } = await import('./services/youverifyWebhookHandler');
      const result = await processYouverifyWebhook(payload, headersMap);
      if (!result.success) {
        console.error('[Youverify Webhook] Failed to process:', result.error);
        return res.status(400).json({ error: result.error });
      }
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('[Youverify Webhook] Error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

// ============== EXTERNAL VERIFICATION WEBHOOK ROUTE ==============
// CRITICAL: Must be registered BEFORE express.json() middleware
// External identity verification services send webhooks when verification completes
app.post(
  '/api/webhooks/verification',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      // Validate that req.body is a Buffer
      if (!Buffer.isBuffer(req.body)) {
        console.error('[Verification Webhook] req.body is not a Buffer');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      const payload = req.body.toString('utf8');
      
      // Dynamically import webhook handler
      const { processVerificationWebhook } = await import('./services/verificationWebhookHandler');
      const result = await processVerificationWebhook(payload, req.headers);

      if (!result.success) {
        console.error('[Verification Webhook] Failed to process:', result.error);
        return res.status(400).json({ error: result.error });
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('[Verification Webhook] Error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

// ============== SECURITY HEADERS & RATE LIMITING ==============
// CRITICAL: Must be AFTER webhook routes (which need raw body) but BEFORE express.json()
setupSecurityMiddleware(app);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// ============== START LISTENING BEFORE ASYNC INIT ==============
// This allows the deployment health check to reach the server while
// seeding and route registration complete in the background.
const port = parseInt(process.env.PORT || "5000", 10);
httpServer.listen(
  {
    port,
    host: "0.0.0.0",
    reusePort: true,
  },
  () => {
    log(`serving on port ${port}`);
  }
);

(async () => {
  try {
    await seedDatabase();
    await registerRoutes(httpServer, app);

    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error("Internal Server Error:", err);

      if (res.headersSent) {
        return next(err);
      }

      return res.status(status).json({ message });
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    log("application fully initialised");

    // Start the subscription scheduler for expiry/renewal processing
    startSubscriptionScheduler();

    // Start the CIE (Cellion Intelligence Engine) nightly scoring scheduler
    startCieScheduler();

    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    // Run compliance deadline check daily
    runComplianceDeadlineCheck().catch(console.error);
    setInterval(() => runComplianceDeadlineCheck().catch(console.error), ONE_DAY_MS);

    // Run KYC document expiry check daily
    runKycExpiryCheck().catch(console.error);
    setInterval(() => runKycExpiryCheck().catch(console.error), ONE_DAY_MS);

    // Run individual user identity expiry check daily
    runIndividualExpiryCheck().catch(console.error);
    setInterval(() => runIndividualExpiryCheck().catch(console.error), ONE_DAY_MS);

    // Run platform document files expiry check daily
    runDocumentFilesExpiryCheck().catch(console.error);
    setInterval(() => runDocumentFilesExpiryCheck().catch(console.error), ONE_DAY_MS);

    // Run sanctions monitoring weekly (gated by feature flag)
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    setInterval(() => {
      runSanctionsMonitoring().catch(console.error);
    }, SEVEN_DAYS_MS);
    runSanctionsMonitoring().catch(console.error);

    // Auto-expire stale escrow API transactions every 30 minutes
    const THIRTY_MIN_MS = 30 * 60 * 1000;
    runEscrowExpiry().catch(console.error);
    setInterval(() => runEscrowExpiry().catch(console.error), THIRTY_MIN_MS);

    // Clean up expired login attempts every hour
    setInterval(() => {
      import("./storage").then(({ storage }) => {
        storage.cleanupExpiredLoginAttempts().catch((e: any) => {
          console.error("[Security] Failed to cleanup login attempts:", e);
        });
      });
    }, 60 * 60 * 1000);
  } catch (err: any) {
    console.error("[FATAL] Failed to initialise application:", err.message || err);
    // Keep the process alive so health checks can still respond, but log the failure
  }
})();
