# Celion One - Nigeria Legal Tech Platform

## Overview
Celion One is a comprehensive legal tech platform designed to streamline company incorporation in Nigeria. It serves Founders, Lawyers, and Administrators, offering features such as identity verification, a digital application wizard, document management, integrated payment via Paystack (NGN), AI-powered suggestions for corporate activities, lawyer assignment and case management, and robust administrative controls with audit logging. The platform aims to revolutionize legal processes in Nigeria by providing an efficient, transparent, and technology-driven solution for company registration and related legal services.

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
  - Product Catalog: 8 SKUs (5 CAC tiers by share capital + SCUML, TM, TIN) with per-SKU fixed cuts (`server/seed.ts`, `product_catalog` table)
  - Order System: Orders with line items tracking `totalAmount`, `totalCellionCut`, `totalLawyerNet` (`orders`, `order_items`, `order_payments` tables)
  - Split Checkout: `POST /api/checkout/split` creates order + initializes Paystack with `subaccount` and `transaction_charge` params (`server/services/paystackPaymentService.ts`)
  - Webhook Handler: `charge.success` verifies amount, marks order paid, activates applications, creates service requests for post-inc add-ons (`server/services/paystackWebhookHandler.ts`)
  - Feature Flags: `enable_paystack_payments`, `enable_paystack_split_settlement`
  - Secrets: `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_LAWYER_SUBACCOUNT_CODE`
  - Frontend: Checkout page (`client/src/pages/founder/checkout.tsx`), Order detail page, Admin orders management (`client/src/pages/admin/orders.tsx`)
  - Service Requests: Auto-created for SCUML/TM/TIN add-ons upon payment (`service_requests` table)
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
- **Resend:** Email service for authentication and notifications.
- **Replit Auth:** For user authentication services.