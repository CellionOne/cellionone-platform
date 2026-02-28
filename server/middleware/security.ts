/**
 * Security Middleware Configuration
 * 
 * Implements security best practices for the Cellion One legal tech platform.
 * - HTTP security headers via Helmet
 * - Rate limiting for API and auth endpoints
 * - CORS configuration
 */

import helmet from "helmet";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
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
  const isProduction = process.env.NODE_ENV === "production";

  const cspDirectives: Record<string, string[]> = {
    defaultSrc: ["'self'"],
    scriptSrc: isProduction
      ? ["'self'", "'unsafe-inline'", "https://js.paystack.co"]
      : ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.paystack.co"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
    imgSrc: ["'self'", "data:", "blob:", "https:", "*.replit.dev"],
    connectSrc: isProduction
      ? ["'self'", "https://api.paystack.co"]
      : ["'self'", "https://api.paystack.co", "wss:", "ws:"],
    frameSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    workerSrc: ["'self'", "blob:"],
    reportUri: ["/api/csp-report"],
  };

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: cspDirectives,
      },
      crossOriginEmbedderPolicy: false, // Needed for Paystack iframes
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
  app.use("/api/auth/reset-password", passwordResetLimiter);
  app.use("/api/auth/forgot-password", passwordResetLimiter);

  // Apply upload rate limiting to all upload-related paths
  app.use("/api/uploads/request-url", uploadLimiter);
  app.use("/api/founder/identity/upload", uploadLimiter);
  app.use("/api/applications/:id/documents", uploadLimiter);
  app.use("/api/documents/upload", uploadLimiter);

  console.log("[Security] Security middleware configured successfully");
}

// CORS configuration helper
export function getCorsOptions() {
  const allowedOrigins: string[] = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
    : [];

  // Build list of allowed Replit origins
  const replitSlug = process.env.REPL_SLUG;
  const replitOwner = process.env.REPL_OWNER;
  
  if (replitSlug && replitOwner) {
    // Add specific Replit domains for this repl only
    allowedOrigins.push(
      `https://${replitSlug}.${replitOwner}.repl.co`,
      `https://${replitSlug}-${replitOwner}.replit.dev`
    );
  }

  // In development, add localhost
  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.push(
      "http://localhost:5000",
      "https://localhost:5000"
    );
  }

  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (server-to-server, mobile apps)
      if (!origin) {
        return callback(null, true);
      }

      // Check against explicit allowlist
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // In development only, allow the current request's Replit subdomain
      // This handles dynamic preview URLs during development
      if (process.env.NODE_ENV !== "production") {
        if (replitSlug && replitOwner && (
          origin.includes(`${replitSlug}.${replitOwner}`) ||
          origin.includes(`${replitSlug}-${replitOwner}`)
        )) {
          return callback(null, true);
        }
      }

      console.warn(`[Security] CORS blocked origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-CSRF-Token", "X-API-Key"],
    exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
    maxAge: 86400, // 24 hours
  };
}

// Security logging middleware — blocks and logs suspicious requests
export function securityLogger(req: Request, res: Response, next: NextFunction): void {
  const suspiciousPatterns = [
    { pattern: /\.\.\//, name: "path_traversal" },
    { pattern: /\.\.%2[fF]/, name: "path_traversal_encoded" },
    { pattern: /%2[eE]%2[eE]%2[fF]/, name: "path_traversal_double_encoded" },
    { pattern: /<script/i, name: "xss_attempt" },
    { pattern: /%3[cC]script/i, name: "xss_attempt_encoded" },
    { pattern: /union\s+select/i, name: "sql_injection" },
    { pattern: /\$\{.*\}/, name: "template_injection" },
    { pattern: /eval\s*\(/i, name: "code_injection" },
    { pattern: /;.*cat\s|;.*ls\s|;.*rm\s|;.*wget\s/i, name: "command_injection" },
  ];

  const fullUrl = req.originalUrl;
  let decodedUrl = fullUrl;
  try { decodedUrl = decodeURIComponent(fullUrl); } catch (e) { /* malformed URI */ }
  let bodyStr = "";
  if (typeof req.body === "string") {
    bodyStr = req.body;
  } else if (req.body && typeof req.body === "object") {
    try { bodyStr = JSON.stringify(req.body); } catch (e) { /* ignore */ }
  }
  const checkTarget = fullUrl + " " + decodedUrl + " " + bodyStr;
  const matched = suspiciousPatterns.find((p) => p.pattern.test(checkTarget));

  if (matched) {
    console.warn(`[Security] BLOCKED suspicious request (${matched.name}): ${req.method} ${fullUrl} from ${req.ip}`);

    (async () => {
      try {
        const { storage } = await import("../storage");
        await storage.createSecurityEvent({
          eventType: "suspicious_request",
          severity: "high",
          ipAddress: req.ip || null,
          details: {
            method: req.method,
            url: fullUrl,
            pattern: matched.name,
            userAgent: req.get("user-agent"),
          },
        });
      } catch (e) {
        console.error("[Security] Failed to log security event:", e);
      }
    })();

    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
}

// Session timeout configuration
const SESSION_CONFIG = {
  IDLE_TIMEOUT_MINUTES: 30, // Log out after 30 minutes of inactivity
  ABSOLUTE_TIMEOUT_HOURS: 8, // Maximum session duration (8 hours)
};

interface SessionWithActivity {
  lastActivity?: number;
  createdAt?: number;
}

/**
 * Session timeout middleware
 * 
 * Enforces session timeouts:
 * - Idle timeout: Session expires after inactivity
 * - Absolute timeout: Session expires after max duration regardless of activity
 */
export function sessionTimeout(req: Request, res: Response, next: NextFunction): void {
  const session = (req as any).session as SessionWithActivity | undefined;
  
  if (!session || !(req as any).isAuthenticated?.()) {
    return next();
  }
  
  const now = Date.now();
  
  // Initialize timestamps if not present
  if (!session.createdAt) {
    session.createdAt = now;
  }
  if (!session.lastActivity) {
    session.lastActivity = now;
  }
  
  // Check absolute timeout (max session duration)
  const sessionAge = now - session.createdAt;
  const maxSessionAge = SESSION_CONFIG.ABSOLUTE_TIMEOUT_HOURS * 60 * 60 * 1000;
  
  if (sessionAge > maxSessionAge) {
    console.log(`[Security] Session absolute timeout exceeded for user`);
    try {
      (req as any).session?.destroy?.(() => {});
    } catch (e) {}
    return res.status(401).json({ 
      message: "Session expired. Please log in again.",
      reason: "absolute_timeout"
    });
  }
  
  // Check idle timeout
  const idleTime = now - session.lastActivity;
  const maxIdleTime = SESSION_CONFIG.IDLE_TIMEOUT_MINUTES * 60 * 1000;
  
  if (idleTime > maxIdleTime) {
    console.log(`[Security] Session idle timeout exceeded for user`);
    try {
      (req as any).session?.destroy?.(() => {});
    } catch (e) {}
    return res.status(401).json({ 
      message: "Session expired due to inactivity. Please log in again.",
      reason: "idle_timeout"
    });
  }
  
  // Update last activity timestamp
  session.lastActivity = now;
  
  next();
}

// CSRF Token Protection
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  const exemptPaths = [
    "/api/webhooks/",
    "/api/v1/",
    "/api/csp-report",
    "/api/csrf-token",
  ];
  if (exemptPaths.some((path) => req.path.startsWith(path))) {
    return next();
  }

  if (!req.path.startsWith("/api/")) {
    return next();
  }

  const session = (req as any).session;
  if (!session) {
    return next();
  }

  const tokenFromHeader = req.headers["x-csrf-token"] as string | undefined;
  const sessionToken = session.csrfToken as string | undefined;

  if (!sessionToken || !tokenFromHeader || tokenFromHeader !== sessionToken) {
    console.warn(`[Security] CSRF token mismatch: ${req.method} ${req.path} from ${req.ip}`);
    res.status(403).json({ error: "Invalid or missing CSRF token" });
    return;
  }

  next();
}

export function generateCsrfToken(req: Request): string {
  const token = crypto.randomBytes(32).toString("hex");
  const session = (req as any).session;
  if (session) {
    session.csrfToken = token;
  }
  return token;
}

// File upload validation configuration
const UPLOAD_CONFIG = {
  MAX_FILE_SIZE_MB: 10,
  ALLOWED_DOCUMENT_EXTENSIONS: [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"],
  ALLOWED_IMAGE_EXTENSIONS: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
  ALLOWED_MIME_TYPES: new Set([
    // Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    // Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ]),
  // Dangerous patterns that should never be in filenames
  DANGEROUS_PATTERNS: [
    /\.\./,           // Path traversal
    /[<>:"|?*]/,      // Invalid characters
    /\x00/,           // Null bytes
    /^\.+$/,          // Only dots
  ],
};

export interface FileUploadValidation {
  isValid: boolean;
  error?: string;
}

/**
 * Validate file upload request metadata
 * Called before generating presigned URLs
 */
export function validateFileUpload(
  filename: string,
  contentType: string | undefined,
  size: number | undefined
): FileUploadValidation {
  // Check filename for dangerous patterns
  for (const pattern of UPLOAD_CONFIG.DANGEROUS_PATTERNS) {
    if (pattern.test(filename)) {
      return { isValid: false, error: "Invalid filename detected" };
    }
  }
  
  // Check file extension
  const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
  const allowedExtensions = [
    ...UPLOAD_CONFIG.ALLOWED_DOCUMENT_EXTENSIONS,
    ...UPLOAD_CONFIG.ALLOWED_IMAGE_EXTENSIONS,
  ];
  
  if (!allowedExtensions.includes(ext)) {
    return { 
      isValid: false, 
      error: `File type not allowed. Allowed types: ${allowedExtensions.join(", ")}` 
    };
  }
  
  // Check MIME type if provided
  if (contentType && !UPLOAD_CONFIG.ALLOWED_MIME_TYPES.has(contentType.toLowerCase())) {
    return { 
      isValid: false, 
      error: "File content type not allowed" 
    };
  }
  
  // Check file size if provided
  if (size !== undefined) {
    const maxBytes = UPLOAD_CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024;
    if (size > maxBytes) {
      return { 
        isValid: false, 
        error: `File too large. Maximum size is ${UPLOAD_CONFIG.MAX_FILE_SIZE_MB}MB` 
      };
    }
    if (size <= 0) {
      return { isValid: false, error: "Invalid file size" };
    }
  }
  
  return { isValid: true };
}

/**
 * Middleware to validate file upload requests
 */
export function validateFileUploadMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { name, contentType, size } = req.body;
  
  if (!name) {
    return next(); // Let the route handler deal with missing name
  }
  
  const validation = validateFileUpload(name, contentType, size);
  
  if (!validation.isValid) {
    console.warn(`[Security] File upload rejected: ${validation.error} - ${name} from ${req.ip}`);
    return res.status(400).json({ error: validation.error });
  }
  
  next();
}
