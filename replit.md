# Cellion One - Nigeria Legal Tech Platform

## Overview
Cellion One is a comprehensive legal tech platform designed to streamline company incorporation in Nigeria. It serves Founders, Lawyers, and Administrators, offering features such as identity verification, a digital application wizard, document management, integrated payment via Paystack (NGN), AI-powered suggestions for corporate activities, lawyer assignment and case management, and robust administrative controls with audit logging. The platform aims to revolutionize legal processes in Nigeria by providing an efficient, transparent, and technology-driven solution for company registration and related legal services.

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `server/replit_integrations/`.
Do not make changes to the file `server/__tests__/auth.regression.test.ts`.

## System Architecture
The platform utilizes a modern web stack: React with TypeScript, Vite, Tailwind CSS, and shadcn/ui for the frontend; Express.js with TypeScript for the backend; and PostgreSQL (Neon-backed) for the database. Authentication is handled via a custom email/password system integrated with Resend for email services. The UI/UX features a primary green/teal color scheme (hsl(156 72% 35%)) reflecting a Nigerian legal theme, with full dark mode support.

Key architectural patterns include:
- **Three distinct user roles:** Founder, Lawyer, and Admin, each with tailored portals and functionalities.
- **Modular Frontend:** Organized into reusable components, pages per user role, and custom hooks.
- **Structured Backend:** Clear separation of API routes, database operations, and shared schema definitions.
- **Progressive Web Application (PWA):** Features offline support via a service worker and a web app manifest.
- **Paystack-Only Payment System:** All payments processed through Paystack in Nigerian Naira (NGN). International customers pay in NGN and their bank handles currency conversion. Managed by a `PriceBook` module with webhook processing for transaction completion. Stripe was intentionally removed to simplify the payment architecture.
- **Registered Office Service:** Offers tiered registered address services with mail handling, configurable limits (e.g., mail items per month, storage duration), and an automated daily scheduler for subscription management (expiry, renewal nudges). Address visibility is gated based on subscription status.
- **Feature Flags:** Allows dynamic control over feature availability for various functionalities like payment providers or specific service requirements.
- **Comprehensive Audit Logging:** Tracks significant user and system actions across the platform.
- **Post-Incorporation Support Suite:** Comprehensive post-incorporation features including:
  - AI Legal Assistant: GPT-4o powered chat for Nigerian company law questions (`server/routes.ts`, `client/src/pages/founder/legal-assistant.tsx`)
  - Company Profiles: Digital company file with directors, shareholders, RC numbers (`client/src/pages/founder/company-profile.tsx`)
  - Post-Incorporation Checklist: 10 guided tasks (TIN, bank account, VAT, PAYE, etc.) (`client/src/pages/founder/post-inc-checklist.tsx`)
  - Compliance Calendar: Auto-calculated Nigerian compliance deadlines (CAC annual returns, CIT, VAT, PAYE, audit) with status tracking (`client/src/pages/founder/compliance-calendar.tsx`)
  - Email Notifications: Escalating compliance reminders (30/14/7/1/0 days), checklist nudges, incorporation completion emails via Resend (`server/services/emailService.ts`)
  - Compliance Scheduler: Daily background job that updates deadline statuses and sends reminder emails (`server/services/complianceScheduler.ts`)
  - Database: 5 new tables - `legal_chat_messages`, `company_profiles`, `post_incorporation_tasks`, `compliance_deadlines`, plus existing tables
- **Paystack Split Payment System:** Automatic split settlement where Celion takes a fixed NGN cut per SKU and the remainder auto-settles to a lawyer subaccount via Paystack's `subaccount` + `transaction_charge` mechanism. Key components:
  - Product Catalog: 9 SKUs (5 CAC tiers by share capital + SCUML, TM, TIN, NGO) with per-SKU fixed cuts (`server/seed.ts`, `product_catalog` table)
  - Order System: Orders with line items tracking `totalAmount`, `totalCellionCut`, `totalLawyerNet` (`orders`, `order_items`, `order_payments` tables)
  - Split Checkout: `POST /api/checkout/split` creates order + initializes Paystack with `subaccount` and `transaction_charge` params (`server/services/paystackPaymentService.ts`)
  - Webhook Handler: `charge.success` verifies amount, marks order paid, activates applications, creates service requests for post-inc add-ons (`server/services/paystackWebhookHandler.ts`)
  - Feature Flags: `enable_paystack_payments`, `enable_paystack_split_settlement`
  - Secrets: `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_LAWYER_SUBACCOUNT_CODE`
  - Frontend: Checkout page (`client/src/pages/founder/checkout.tsx`), Order list (`client/src/pages/founder/orders.tsx`), Order detail page (`client/src/pages/founder/order-detail.tsx`), Admin orders management (`client/src/pages/admin/orders.tsx`)
  - Service Requests: Auto-created for SCUML/TM/TIN add-ons upon payment (`service_requests` table). Managed by founders, lawyers, and admins through dedicated pages.
  - Service Request Form: Multi-section form for existing company owners to submit company details and upload required documents (Certificate of Incorporation, MEMART, Status Report, TIN, Proof of Address, additional certs). Data stored in `service_request_company_profiles` and `service_request_documents` tables. Profiles are reusable across multiple service requests. Uses object storage for document persistence. (`client/src/pages/founder/service-request-form.tsx`, API routes in `server/routes.ts`)
  - Lawyer Service Requests: Lawyers can view assigned/queued requests, see founder details + company profiles + uploaded documents, and update status (queued → assigned → in_progress → completed). Pages: `client/src/pages/lawyer/service-requests.tsx`, `client/src/pages/lawyer/service-request-detail.tsx`
  - Admin Service Requests: Admin orders page shows service requests per order with lawyer assignment capability. Admin can assign lawyers to queued requests.
- **Identity Verification (Payment-Based):** One-time NGN 10,000 fee per person auto-injected at checkout for unverified users. Covers comprehensive 4-step verification via Smile ID: BVN/NIN validation, document verification, biometric selfie matching, and AML/sanctions screening. Status reflected on identity page (`client/src/pages/founder/identity.tsx`) based on `user.identityVerified` boolean. Verification is payment-gated via VERIFY SKU in product catalog.
- **Personal Profile System:** Comprehensive personal profile with encrypted NIN/BVN storage (AES-256-GCM), document uploads (passport photo, signature specimen, government ID), profile completion tracking (0-100%), and residential address. Shared across all roles.
  - Frontend: `client/src/pages/personal-profile.tsx` (route: `/profile`)
  - API: GET/PUT `/api/profile/personal`, POST `/api/profile/personal/upload-url`, POST `/api/profile/personal/upload-complete`, GET `/api/profile/personal/document/:docType`
  - Schema: `founder_profiles` table with `nin_encrypted`, `bvn_encrypted`, `id_type`, `passport_photo_path`, `signature_path`, `id_document_path`, `profile_completion`, `is_profile_complete`
  - Encryption: NIN/BVN encrypted via `server/services/encryptionService.ts` using AES-256-GCM. Only last 4 digits displayed to user.
- **Director/Shareholder Management:** Founders can invite directors, shareholders, and company secretaries via email. Each invitee creates their own account, completes their profile, and undergoes individual verification.
  - Schema: `company_people` table with invitation workflow (pending → accepted → verified)
  - Frontend: `client/src/pages/founder/company-people.tsx` (route: `/founder/company-people`)
  - API: GET/POST `/api/company-people`, PUT/DELETE `/api/company-people/:id`, POST `/api/company-people/accept-invite`, POST `/api/company-people/resend-invite/:id`, GET `/api/company-people/my-invitations`, GET `/api/company-people/readiness`
  - Email invitations sent via Resend with unique invite tokens. Links to `/invite/:token` page.
  - Roles: director, shareholder, director_shareholder, secretary
  - Share allocation tracking: shares count, percentage, share class (ordinary/preference)
  - Invite acceptance flow: `/invite/:token` page shows invite details, links to register or login, auto-accepts for logged-in users (`client/src/pages/invite-accept.tsx`)
  - Registration page detects `?invite=TOKEN` param, shows invite context and pre-fills email
  - Login page detects `?invite=TOKEN` param, redirects to invite acceptance page after login
  - Readiness API: `GET /api/company-people/readiness` returns profile completion %, document status, NIN/BVN status for founder + all company people
  - Company people page shows per-person profile checklist (passport, signature, ID, NIN, BVN) with progress bars
  - Team readiness summary card shows overall progress (X of Y ready)
  - Checkout readiness gate: blocks payment if any team member's profile is incomplete, shows specific names and completion %
  - Invitation banner on founder dashboard (`client/src/components/invitation-banner.tsx`): shows accepted invitations and profile completion CTA for invited users
  - Email notifications: founder receives email when a director/shareholder completes their profile
- **Two-Factor Authentication (2FA):** SMS-based OTP verification via Africa's Talking API with backup codes.
  - Service: `server/services/twoFactorService.ts` — OTP generation, verification, rate limiting (30s cooldown), max 5 attempts
  - Setup flow: Enter phone → receive OTP → verify → receive 8 backup codes
  - Login integration: When 2FA enabled, login returns `requiresTwoFactor: true` + `userId`, then separate verification step creates session
  - Frontend: Settings page 2FA section (`client/src/pages/settings.tsx`), Login 2FA challenge (`client/src/pages/auth/login.tsx`)
  - API: GET `/api/settings/two-factor`, POST `/api/settings/two-factor/setup`, POST `/api/settings/two-factor/confirm`, POST `/api/settings/two-factor/disable`, POST `/api/auth/two-factor/send`, POST `/api/auth/two-factor/verify`
  - Schema: `users` table fields: `two_factor_enabled`, `two_factor_method`, `two_factor_phone`, `two_factor_secret`, `two_factor_backup_codes`, `last_two_factor_at`
  - Secrets: `AT_API_KEY`, `AT_USERNAME` (Africa's Talking credentials — falls back to console logging when not configured)
- **Sensitive Data Access Logging:** All access to NIN, BVN, and personal documents is logged in `sensitive_data_access_logs` table with accessor, target, data type, action, IP address, and user agent. Integrated into profile read, update, and document view endpoints.
- **User Settings Page:** Shared `/settings` page accessible to all roles (founder, lawyer, admin) with four sections:
  - Profile: Edit first/last name, email displayed read-only (`client/src/pages/settings.tsx`)
  - Password: Change password with current password verification, password strength requirements enforced
  - Two-Factor Authentication: Enable/disable SMS 2FA with backup codes
  - Notification Preferences: Role-adaptive toggles (compliance reminders, service request updates, order updates, incorporation updates, marketing emails). Stored in `notification_preferences` table. Founders see all 5 toggles; lawyers/admins see service request updates and marketing only.
  - API: GET/PUT `/api/settings/profile`, POST `/api/settings/change-password`, GET/PUT `/api/settings/notifications`
- **Security Hardening Suite:** Multi-layered security protections including:
  - HTTP security headers via Helmet.js (CSP, HSTS, XSS protection, X-Frame-Options)
  - Rate limiting: API (100/15min), auth (10/15min), password reset (3/hour), uploads (50/hour)
  - CORS with explicit origin allowlisting
  - Account lockout (5 failed attempts = 15 min lockout)
  - Session timeout (30 min idle, 8 hour absolute maximum)
  - File upload validation (type, size, extension whitelist)
  - Password strength requirements (8+ chars, uppercase, lowercase, number, special char)
  - Security-focused audit logging (login attempts, lockouts, password resets, logouts)

## External Dependencies
- **PostgreSQL:** Primary database, hosted via Neon.
- **OpenAI GPT-4o:** Used for AI-powered CAC activity suggestions.
- **Paystack:** Sole payment gateway for all transactions (NGN). International cards accepted — customer's bank handles currency conversion.
- **Resend:** Email service for authentication, notifications, and service request lifecycle emails. All emails sent from `noreply@send.cellionone.com` via centralized `emailService.ts`. Admin notifications (new orders) sent to `service@cellionone.com`.
- **Africa's Talking:** SMS OTP provider for 2FA. Falls back to console logging when API key not configured. Secrets: `AT_API_KEY`, `AT_USERNAME`.
- **Smile ID:** Identity verification for Nigerian BVN/NIN validation. Uses Enhanced KYC (job_type 5) via `smile-identity-core` npm package. Falls back gracefully when API keys not configured. Secrets: `SMILE_ID_PARTNER_ID`, `SMILE_ID_API_KEY`, `SMILE_ID_ENVIRONMENT` (sandbox/production).
- **Replit Auth:** For user authentication services.
- **Replit Object Storage:** For document uploads (passport photos, signatures, ID documents).