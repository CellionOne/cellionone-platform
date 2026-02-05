/**
 * Security Middleware Configuration
 * 
 * Implements security best practices for the Celion One legal tech platform.
 * - HTTP security headers via Helmet
 * - Rate limiting for API and auth endpoints
 * - CORS configuration
 */

import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { type Express, type Request, type Response, type NextFunction } from "express";

// Rate limiter for general API endpoints
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for webhooks (they have their own auth)
    return req.path.includes("/webhook");
  },
});

// Stricter rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth requests per windowMs
  message: { error: "Too many authentication attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

// Very strict rate limiter for password reset
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per hour
  message: { error: "Too many password reset attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for file uploads
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each IP to 50 uploads per hour
  message: { error: "Too many file uploads, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export function setupSecurityMiddleware(app: Express): void {
  // Helmet security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.stripe.com"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
          imgSrc: ["'self'", "data:", "blob:", "https:", "*.replit.dev"],
          connectSrc: [
            "'self'",
            "https://api.stripe.com",
            "https://api.paystack.co",
            "wss:",
            "ws:",
          ],
          frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          workerSrc: ["'self'", "blob:"],
        },
      },
      crossOriginEmbedderPolicy: false, // Needed for Stripe/Paystack iframes
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      crossOriginResourcePolicy: { policy: "cross-origin" },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      xContentTypeOptions: true, // nosniff
      xDnsPrefetchControl: { allow: false },
      xDownloadOptions: true,
      xFrameOptions: { action: "sameorigin" },
      xPermittedCrossDomainPolicies: { permittedPolicies: "none" },
      xPoweredBy: false, // Remove X-Powered-By header
      xXssProtection: true,
    })
  );

  // Apply general API rate limiting to /api routes
  app.use("/api", apiLimiter);

  // Apply stricter rate limiting to authentication routes
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
  app.use("/api/auth/password-reset", passwordResetLimiter);
  app.use("/api/auth/forgot-password", passwordResetLimiter);

  // Apply upload rate limiting to specific upload paths
  app.use("/api/founder/identity/upload", uploadLimiter);
  app.use("/api/applications/:id/documents", uploadLimiter);
  app.use("/api/documents/upload", uploadLimiter);

  console.log("[Security] Security middleware configured successfully");
}

// CORS configuration helper
export function getCorsOptions() {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : [];

  // In development, allow the Replit domain
  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.push(
      "http://localhost:5000",
      "https://localhost:5000"
    );
    
    // Allow Replit domains
    if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
      allowedOrigins.push(
        `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`,
        `https://${process.env.REPL_SLUG}-${process.env.REPL_OWNER}.replit.dev`
      );
    }
  }

  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }

      // In development, be more permissive
      if (process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin) || origin.endsWith(".replit.dev") || origin.endsWith(".repl.co")) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
    maxAge: 86400, // 24 hours
  };
}

// Security logging middleware
export function securityLogger(req: Request, res: Response, next: NextFunction): void {
  // Log suspicious requests
  const suspiciousPatterns = [
    /\.\.\//, // Path traversal
    /<script/i, // XSS attempts
    /union\s+select/i, // SQL injection
    /\$\{.*\}/, // Template injection
    /eval\s*\(/i, // Code injection
  ];

  const fullUrl = req.originalUrl;
  const isSuspicious = suspiciousPatterns.some((pattern) => pattern.test(fullUrl));

  if (isSuspicious) {
    console.warn(`[Security] Suspicious request detected: ${req.method} ${fullUrl} from ${req.ip}`);
  }

  next();
}
