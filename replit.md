# Cellion One - Nigeria Legal Tech Platform

## Overview
Cellion One is a comprehensive legal tech platform designed to streamline company incorporation in Nigeria. It provides a digital application wizard, document management, integrated payments, AI-powered suggestions for corporate activities, lawyer assignment, and robust administrative controls. The platform aims to revolutionize legal processes in Nigeria for Founders, Lawyers, and Administrators by offering an efficient, transparent, and technology-driven solution for company registration and related legal services. Its business vision includes significant market potential by simplifying a complex legal process and setting new standards for legal tech in Nigeria.

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `server/replit_integrations/`.
Do not make changes to the file `server/__tests__/auth.regression.test.ts`.

## System Architecture
The platform employs a modern web stack: React with TypeScript, Vite, Tailwind CSS, and shadcn/ui for the frontend; Express.js with TypeScript for the backend; and PostgreSQL (Neon-backed) for the database. Authentication uses a custom email/password system integrated with Resend. The UI/UX features a primary green/teal color scheme (hsl(156 72% 35%)) and full dark mode support.

Key architectural decisions and features include:
- **Four distinct user roles:** Founder, Lawyer, Admin, and Building Manager, each with tailored portals and functionalities.
- **Modular Frontend:** Organized into reusable components, role-specific pages, and custom hooks.
- **Structured Backend:** Clear separation of API routes, database operations, and shared schema definitions.
- **Progressive Web Application (PWA):** Supports offline functionality via a service worker and a web app manifest.
- **Paystack-Only Payment System:** All payments are processed through Paystack in Nigerian Naira (NGN), managed by a `PriceBook` module with webhook processing. It supports a split payment system where Cellion takes a fixed cut per SKU, and the remainder is auto-settled to a lawyer subaccount.
- **Registered Office Service:** Offers tiered virtual registered address services with mail handling, configurable limits, and an automated daily scheduler for subscription management. Includes a proof-of-address workflow where founders confirm the address, building managers upload utility bills per location, and lawyers can download them for filing (founder download is restricted for fraud prevention). Supports multiple registered office locations, each with an assigned Building Manager.
- **Building Manager Portal:** Dedicated portal for registered office building managers at `/building-manager/*`. Features: dashboard with building overview, utility bill management (upload/track expiry with 3-month cycles), subscriber list (active founders at their location), and mail intake (record incoming mail scoped to their building). Admin can assign `building_manager` role and link users to locations via `/admin/registered-offices`. Tables: Extended `service_addresses` with `managerUserId`, `contactPhone`, `contactEmail`, `operatingHours`, `utilityBillPath`, `utilityBillUploadedAt`, `utilityBillExpiresAt`, `utilityBillStatus`. Frontend pages: `client/src/pages/building-manager/` (dashboard, utility-bill, subscribers, mail-intake), `client/src/pages/admin/registered-offices.tsx`.
- **Admin Role Security:** Only a designated super admin can assign or remove admin roles; other admins manage lawyer roles.
- **Feature Flags:** Allows dynamic control over feature availability.
- **Comprehensive Audit Logging:** Tracks significant user and system actions.
- **Post-Incorporation Support Suite:** Features include an AI Legal Assistant (GPT-4o powered), digital Company Profiles, a 10-task Post-Incorporation Checklist, an auto-calculated Compliance Calendar with escalating email reminders, and a daily background compliance scheduler.
- **Service Requests:** Auto-created for certain add-ons upon payment, enabling founders, lawyers, and admins to manage detailed service workflows, including document uploads and status updates. Supports reusable company profiles for service requests.
- **Identity Verification (Payment-Based):** A one-time fee covers comprehensive 4-step verification via Smile ID (BVN/NIN, document, biometric, AML/sanctions screening), status tracked on the user's identity page.
- **Personal Profile System:** Comprehensive user profiles with encrypted NIN/BVN storage, document uploads (passport, signature, ID), profile completion tracking, and residential address. Encrypted using AES-256-GCM.
- **Director/Shareholder Management:** Founders can invite directors, shareholders, and company secretaries via email, who then create accounts, complete profiles, and undergo individual verification. Includes readiness tracking and a checkout gate based on profile completeness.
- **Two-Factor Authentication (2FA):** SMS-based OTP verification via Africa's Talking API with backup codes, integrated into user settings and login flow.
- **Sensitive Data Access Logging:** All access to sensitive data (NIN, BVN, personal documents) is logged with details of accessor, target, data type, action, IP, and user agent.
- **User Settings Page:** A unified settings page for all roles, offering profile editing, password changes, 2FA management, and role-adaptive notification preferences.
- **Security Hardening Suite:** Includes HTTP security headers (Helmet.js), API rate limiting, CORS with origin allowlisting, account lockout, session timeout, file upload validation, and strong password requirements.
- **Consent-Based Data Sharing:** Founders can create time-limited, revocable consent tokens to share verified data (personal info, verification results, company details, documents, proof of address) with named partners (banks, insurers, government). Partners access data via token-authenticated API endpoints, download PDF verification certificates (Puppeteer-generated), or full ZIP data packages (archiver). All access is logged with IP, user agent, and data returned. Public verification landing page at `/verify/:token`. Tables: `data_sharing_consents`, `data_sharing_access_logs`.
- **KYC-as-a-Service Module:** Full KYC verification service enabling organisations to verify individuals (₦10,000/person) and suppliers/corporates (₦100,000/company). Features:
  - Organisation onboarding with team member management (org_admin, org_reviewer, org_viewer roles)
  - Two verification tracks: Individual (employee identity) and Supplier (corporate due diligence)
  - Self-registration portals: `/kyc/{slug}/employees` and `/kyc/{slug}/suppliers`
  - AI-powered document extraction using OpenAI Vision with auto-classification and confidence scoring
  - Standard + custom document requirements per verification type
  - Verification templates (e.g. "IT Vendor", "Standard Employee")
  - Risk scoring (green/amber/red) based on document completeness and expiry
  - Director verification: supplier verification auto-creates individual requests for directors
  - Document expiry tracking with daily scheduler and email alerts (30-day and 7-day warnings)
  - Paystack payment integration (subject-pays or org-pays flows)
  - Audit certificate generation (PDF via Puppeteer) for compliance files
  - Bulk CSV import for employee verification requests
  - KYC Service Terms & Conditions with mandatory acceptance (TERMS_VERSION = "1.0")
  - Full email notification lifecycle via Resend
  - Backend routes: `server/routes/kycServiceRoutes.ts`
  - Tables: `kyc_organisations`, `kyc_org_members`, `kyc_verification_templates`, `kyc_document_requirements`, `kyc_verification_requests`, `kyc_supplier_profiles`, `kyc_submitted_documents`, `kyc_supplier_people`
  - Consolidated webhook: KYC payments handled by main `paystackWebhookHandler.ts` (references starting with `kyc_`)
  - Admin KYC oversight: `client/src/pages/admin/kyc-overview.tsx` at `/admin/kyc`
  - My Verifications page: `client/src/pages/kyc-service/my-verifications.tsx` at `/kyc/my-verifications` (all roles)
  - Org invite acceptance: `client/src/pages/kyc-service/org-invite-accept.tsx` at `/kyc/org-invite/:token`
  - Frontend pages: `client/src/pages/kyc-service/` (orgs, org-dashboard, verification-detail, org-settings, verify-request, employee-portal, supplier-portal, terms, my-verifications, org-invite-accept)
- **KYC Verification API (Public):** Programmatic REST API for external applications to submit verification requests.
  - API key management: `co_live_` prefix + 32-char hex, SHA-256 hashed storage, configurable permissions and rate limits
  - Dual billing: prepaid credits (min 10 purchase, ₦10,000/individual, ₦100,000/supplier via Paystack) and admin-approved invoiced billing with credit limits
  - Webhook delivery: HMAC-SHA256 signed callbacks (`X-Cellion-Signature`), 3 retries with exponential backoff, test events
  - Public endpoints: `POST /api/v1/kyc/verify/individual`, `POST /api/v1/kyc/verify/supplier`, `GET /api/v1/kyc/requests`, `GET /api/v1/kyc/templates`
  - Template-based or ad-hoc verification modes
  - Org settings tabs: API Keys, Webhooks, Billing (in `client/src/pages/kyc-service/org-settings.tsx`)
  - Admin billing controls: approve/reject invoiced billing requests, credit adjustments, invoice management (in `client/src/pages/admin/kyc-overview.tsx`)
  - API documentation page: `client/src/pages/api-docs.tsx` at `/api-docs`
  - Services: `server/services/kycApiKeyService.ts`, `server/services/kycBillingService.ts`, `server/services/kycWebhookService.ts`
  - Middleware: `server/middleware/apiKeyAuth.ts`
  - Routes: `server/routes/kycApiRoutes.ts`
  - Tables: `kyc_api_keys`, `kyc_api_usage_logs`, `kyc_webhook_configs`, `kyc_webhook_delivery_logs`, `kyc_billing_accounts`, `kyc_billing_requests`, `kyc_credit_transactions`, `kyc_invoices`
  - Paystack webhook: credit purchases handled via `kyc_credit_` reference prefix
- **Notification Centre:** Bell icon with unread count in dashboard header, notification popover with mark-as-read, full notifications page at `/notifications`. API: `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/mark-all-read`.
- **Founder Dashboard KYC Context:** Shows KYC org count, pending reviews, and completed verifications when user has KYC activity.
- **Digital Signature Pad:** Personal profile page offers both draw-on-screen (via `react-signature-canvas`) and upload-scan options for signature specimens. Consent notice explains signature usage and authorisation requirements. Stored securely in Object Storage.
- **Shared Public Navigation & Footer:** Reusable `PublicNav` (`client/src/components/public-nav.tsx`) and `PublicFooter` (`client/src/components/public-footer.tsx`) components used across all marketing/public pages (landing, why-cellion-one, api-docs, terms, privacy, apply-lawyer). PublicNav includes Products/Resources dropdowns, Pricing/Contact links (using `/#anchor` for cross-page navigation), ThemeToggle, Sign In/Get Started buttons, and mobile hamburger menu (Sheet). PublicFooter has 3 columns (Products/Company/Legal), tagline, copyright, UK partner. Auth pages and KYC portals keep their own minimal headers.
- **Landing Page:** World-class single-statement hero ("The Compliance Infrastructure for African Business") with Africa expansion positioning ("Starting in Nigeria. Building for Africa."), trust bar (4 key metrics), streamlined 7-section layout (hero → For Organisations → How It Works → Pricing → Services → FAQ → Contact → CTA), two-path KYC integration journey (Web Dashboard vs API). Contact form with `POST /api/contact` (rate-limited, HTML-sanitized, sends to admin via Resend).
- **Verified Entities Registry:** Cross-platform catalogue of all verified individuals and companies. Table `verified_entities` with deduplication by BVN/NIN hash (individuals) or RC number (companies). Auto-populated via `upsertVerifiedEntity()` in `server/services/verifiedEntityService.ts` when KYC verifications are approved. Tracks verification count, risk scores, AML status, and country (for Africa expansion). Indexes on `bvnHash`, `ninHash`, `rcNumber`, `email`, `entityType`, `country`.
- **Admin Proposals Page:** Admin-only page at `/admin/proposals` for viewing partnership proposals as formatted HTML with browser-native Print/Save-as-PDF. Replaces server-side Puppeteer PDF generation. API: `GET /api/admin/proposals/bank-partnership/html`.
- **Certificate HTML Fallback:** Verification certificates and KYC audit certificates support `?format=html` query param for browser-rendered viewing when PDF generation is unavailable. Endpoints return helpful `htmlUrl` in error responses on PDF failure.

## External Dependencies
- **PostgreSQL:** Primary database, hosted via Neon.
- **OpenAI GPT-4o:** Powers the AI Legal Assistant for corporate activity suggestions.
- **Paystack:** Sole payment gateway for all NGN transactions, including split payments.
- **Resend:** Email service for authentication, notifications, and system communications.
- **Africa's Talking:** SMS OTP provider for Two-Factor Authentication.
- **Smile ID:** Identity verification service for BVN/NIN validation and biometric matching.
- **Replit Auth:** Used for foundational user authentication services.
- **Replit Object Storage:** Utilized for secure storage of document uploads.