# Cellion One — Threat Model

**Date:** 2026-04-03  
**Version:** 1.0  
**Scope:** Full platform (web app + public APIs + admin portal)

---

## 1. System Overview

Cellion One is a Nigeria-focused legal-tech platform offering:

| Service | Description |
|---------|-------------|
| Company Incorporation | Digital wizard + document management |
| KYC-as-a-Service | Identity verification API for third-party orgs |
| Escrow-as-a-Service | Public API for escrow transactions via Paystack |
| Procurement Marketplace | RFQ / Bid / Contract / Invoice with escrow |
| Registered Office | Virtual address + mail handling subscriptions |
| Admin Portal | User, lawyer, compliance, and platform management |

**Key actors:** Founders, Lawyers, KYC Organisations, API consumers, Platform Admins, Super Admin.

**External integrations:** Paystack (payments), Resend (email), Africa's Talking (SMS OTP), Smile ID (biometric/KYC), OpenAI (AI legal assistant), Replit Object Storage (documents), PostgreSQL/Neon (database).

---

## 2. Trust Boundaries

```
Internet (untrusted)
  │
  ├── Public Routes: /, /landing, /contact, /api-docs, /terms, /privacy
  │     No authentication required
  │
  ├── API Key Routes: /api/v1/kyc/*, /api/v1/escrow/*
  │     Authenticated via X-API-Key header (HMAC-hashed in DB)
  │     Rate limited: 60 req/min per key (DB) + 200 req/15min (express-rate-limit)
  │
  ├── Session Routes: /api/* (non-v1)
  │     Authenticated via Replit Auth session cookie
  │     Role-checked: founder, lawyer, admin, building_manager
  │
  └── Admin Routes: /api/admin/*
        Authenticated + admin role required
        Extra rate limit: 60 req/15min per IP
        Super Admin required for role assignments
```

---

## 3. Data Classification

| Classification | Examples |
|----------------|----------|
| **Critical — Encrypted at rest** | NIN, BVN, biometric photo paths |
| **Sensitive — Access logged** | Verified identity data, KYC documents |
| **PII** | Name, email, phone, DOB, address |
| **Financial** | Paystack amounts, escrow balances (in kobo) |
| **Operational secrets** | API keys (hashed), webhook secrets (stored raw), session secret, encryption key |

Sensitive field encryption uses AES-256-GCM with a dedicated `ENCRYPTION_KEY` secret. Auth tag length is explicitly set to 16 bytes.

---

## 4. Threat Matrix

### T1: Authentication & Session Attacks

| Threat | Controls | Residual Risk |
|--------|----------|---------------|
| Brute-force login | authLimiter: 10 req/15min per IP; account lockout after N failures | LOW |
| Session hijacking | Secure, HttpOnly, SameSite=Strict cookies; 30-min idle timeout; 8-hour absolute timeout | LOW |
| CSRF | Per-session CSRF token in X-CSRF-Token header; exempt: webhooks, /api/v1/ | LOW |
| Password reset abuse | passwordResetLimiter: 3 req/hour per IP | LOW |
| SMS OTP replay (2FA) | OTP expires after use + time window | LOW–MEDIUM |

### T2: API Key Abuse

| Threat | Controls | Residual Risk |
|--------|----------|---------------|
| Stolen API key | Keys hashed with SHA-256 at rest; never stored in plaintext | LOW |
| Rate limit bypass | Per-key DB check (60/min) + express-rate-limit (200/15min); key generator uses X-API-Key header | LOW |
| Scope escalation | Per-key permission array checked on every request | LOW |
| IPv4 rate limit bypass | express-rate-limit 8.2.2 fixes IPv4-mapped IPv6 collapse bug | FIXED |

### T3: Injection & XSS

| Threat | Controls | Residual Risk |
|--------|----------|---------------|
| SQL injection | Drizzle ORM parameterised queries throughout; no raw SQL with user input | LOW |
| XSS (stored) | CSP headers (Helmet); React's default encoding prevents DOM XSS; no dangerouslySetInnerHTML | LOW |
| XSS (email templates) | Server-side HTML construction uses validated data; risk is email client rendering only | MEDIUM |
| Path traversal | securityLogger blocks `../` patterns at middleware layer; file upload validation | LOW |
| XML entity expansion | fast-xml-parser upgraded to 4.5.5 with entity limits | FIXED |
| Template injection | securityLogger blocks `${...}` patterns | LOW |
| Command injection | securityLogger blocks `;cat|;ls|;rm|;wget` patterns | LOW |

### T4: Payment & Escrow Fraud

| Threat | Controls | Residual Risk |
|--------|----------|---------------|
| Webhook replay | Paystack HMAC-SHA512 signature verified on raw body before JSON parsing | LOW |
| Double-funding | Status check before updating (`if tx.status === 'funded' return`) | LOW |
| Amount tampering | Amount recorded at creation time; Paystack reference ties amount to Paystack's record | LOW |
| Unauthorised release | Escrow release requires API key with `escrow:write` scope owned by the creating org | LOW |
| Bank custody fee manipulation | `bankCustodyFee` clamped to never exceed `serviceFee`; computed server-side only | LOW |

### T5: Sensitive Data Exposure

| Threat | Controls | Residual Risk |
|--------|----------|---------------|
| Plaintext BVN/NIN in DB | AES-256-GCM encryption with `ENCRYPTION_KEY` | LOW |
| Smile ID data leakage | Smile ID never appears in API responses or webhooks; data stored internally only | LOW |
| Admin credential in logs | Fixed: password no longer logged to stdout | FIXED |
| Encryption key in session secret | Fixed: `ENCRYPTION_KEY` is now independent; fallback warns loudly | MITIGATED |
| KYC photo access | Access-logged endpoint; requires authenticated request | LOW |
| Consent token scope | Tokens are time-limited (TTL) and revocable | LOW |

### T6: Denial of Service

| Threat | Controls | Residual Risk |
|--------|----------|---------------|
| General API flooding | apiLimiter: 100 req/15min per IP | LOW |
| Admin endpoint flooding | adminLimiter: 60 req/15min per IP (new) | LOW |
| Auth endpoint flooding | authLimiter: 10 req/15min; passwordResetLimiter: 3/hr | LOW |
| File upload DoS | uploadLimiter: 50/hr; file size capped at 10MB; MIME type validation | LOW |
| XML bomb / entity expansion | fast-xml-parser 4.5.5 with entity limits | FIXED |
| ReDoS via route matching | path-to-regexp upgraded to 8.4.0 | FIXED |
| Multipart abuse | multer upgraded to 2.1.1 | FIXED |
| brace-expansion hang | Dependency at 2.0.2; fix available in 2.0.3 (transitive dep) | MEDIUM |

### T7: Infrastructure & Supply Chain

| Threat | Controls | Residual Risk |
|--------|----------|---------------|
| Dependency vulnerabilities | Automated audit; critical packages updated this session | LOW |
| Secret leakage to source | Secrets managed via Replit secret store; .gitignore covers .env | LOW |
| Exposed X-Powered-By | Helmet removes X-Powered-By header | LOW |
| HSTS missing | Helmet sets HSTS with 1-year maxAge + preload | LOW |
| Clickjacking | X-Frame-Options: SAMEORIGIN set | LOW |
| MIME sniffing | X-Content-Type-Options: nosniff set | LOW |

---

## 5. Outstanding Risks (Action Required)

| ID | Risk | Severity | Action |
|----|------|----------|--------|
| OR-1 | `ENCRYPTION_KEY` not set — falls back to SESSION_SECRET | HIGH | Set dedicated `ENCRYPTION_KEY` secret |
| OR-2 | brace-expansion 2.0.2 DoS (CVE-2026-33750) | MODERATE | Transitive dep — upgrade parent when available |
| OR-3 | minimatch 9.0.x multiple CVEs | HIGH | Transitive dep (node_modules only, not runtime critical path) |
| OR-4 | HTML template string interpolation in email bodies | MEDIUM | Add lightweight HTML escaper at next email template refactor |
| OR-5 | IP addresses and emails logged to stdout | MEDIUM | Implement log redaction + 90-day retention policy |
| OR-6 | lodash CVE-2026-4800 | HIGH | lodash 4.18.0 is a bad publish; monitor for 4.18.x+ stable release |
| OR-7 | rollup 4.53.5 CVE-2026-27606 | HIGH | Dev-only dependency; no runtime impact; upgrade vite when available |

---

## 6. Security Controls Summary

| Control | Implementation |
|---------|----------------|
| Authentication | Email/password + bcrypt; 2FA via SMS OTP + backup codes |
| Authorisation | Role-based (founder/lawyer/admin/building_manager); per-API-key scope |
| Transport security | HTTPS enforced; HSTS 1 year + preload |
| Input validation | Zod schemas on all API endpoints; file upload MIME + size checks |
| Output encoding | React default encoding; CSP headers |
| Rate limiting | 5 tiers: auth (10), admin (60), general API (100), per-key API (200/15m), upload (50/hr) |
| Encryption at rest | AES-256-GCM for PII fields; ENCRYPTION_KEY decoupled from session |
| Audit logging | createAuditLog() on all significant actions; sensitive data access logged |
| Secret management | All secrets in Replit secret store; never in source code |
| Webhook security | HMAC-SHA512 signature verification (Paystack); HMAC-SHA256 (org webhooks) |
| HTTP security headers | Helmet: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| CSRF protection | Per-session token in X-CSRF-Token header |
| Suspicious request blocking | Pattern matching middleware for traversal, injection, XSS |
| Session management | 30-min idle + 8-hour absolute timeout |
| Account security | Lockout after repeated failures; login anomaly detection |

---

## 7. Compliance Notes

- **NDPR (Nigeria Data Protection Regulation):** PII is collected with consent, encryption at rest, access-logged, purpose-limited. Data subject rights (access, deletion) require implementation of data export/deletion workflows.
- **GDPR relevance:** Platform operates internationally; IP and email logging to stdout should be addressed with log redaction before scale.
- **PCIDSS:** Cellion One does not store card data — Paystack handles all card processing. This minimises PCI scope significantly.
- **AML/KYC:** Automated weekly sanctions screening (`enable_sanctions_monitoring` flag), STR reporting module, and risk scoring are in place.
