import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase } from "./seed";
import { startSubscriptionScheduler } from "./services/subscriptionScheduler";
import { setupSecurityMiddleware, securityLogger } from "./middleware/security";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ============== SECURITY MIDDLEWARE ==============
// CRITICAL: Must be set up early, but AFTER webhook routes are registered
// (webhooks need raw body parsing which conflicts with some security headers)

// Security logging for suspicious requests (safe to add before webhooks)
app.use(securityLogger);

// ============== STRIPE WEBHOOK ROUTE ==============
// CRITICAL: Must be registered BEFORE express.json() middleware
// Stripe webhooks need raw Buffer body for signature verification
app.post(
  '/api/payments/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      // Validate that req.body is a Buffer (not parsed JSON)
      if (!Buffer.isBuffer(req.body)) {
        const errorMsg = '[Stripe Webhook] req.body is not a Buffer. Webhook route may be registered after express.json()';
        console.error(errorMsg);
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      // Dynamically import webhook handler
      const { default: stripeWebhookHandler } = await import('./services/stripeWebhookHandler');
      await stripeWebhookHandler.processWebhook(req.body as Buffer, sig);

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('[Stripe Webhook] Error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

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

(async () => {
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

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      
      // Start the subscription scheduler for expiry/renewal processing
      startSubscriptionScheduler();
    },
  );
})();
