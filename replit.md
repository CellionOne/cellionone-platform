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
- **Progressive Web Application (PWA):** Supports offline functionality.
- **Paystack-Only Payment System:** All payments processed via Paystack in NGN, supporting split payments with Cellion taking a fixed cut and auto-settlement to lawyer subaccounts.
- **Registered Office Service:** Tiered virtual registered address services with mail handling, configurable limits, and automated subscription management. Includes a proof-of-address workflow and supports multiple locations.
- **Admin Role Security:** Super admin controls admin role assignments; other admins manage lawyer roles.
- **Feature Flags:** Dynamic control over feature availability.
- **Comprehensive Audit Logging:** Tracks significant user and system actions.
- **Post-Incorporation Support Suite:** Features an AI Legal Assistant, digital Company Profiles, a 10-task Post-Incorporation Checklist, and an auto-calculated Compliance Calendar with email reminders.
- **Service Requests:** Auto-created for certain add-ons, managing detailed service workflows including document uploads and status updates.
- **Identity Verification (Payment-Based):** Comprehensive 4-step verification via Smile ID (BVN/NIN, document, biometric, AML/sanctions screening) for a one-time fee.
- **Personal Profile System:** Comprehensive user profiles with encrypted NIN/BVN storage, document uploads, profile completion tracking, and residential address.
- **Director/Shareholder Management:** Founders can invite directors, shareholders, and company secretaries who then complete profiles and undergo individual verification.
- **Two-Factor Authentication (2FA):** SMS-based OTP verification via Africa's Talking API with backup codes.
- **Sensitive Data Access Logging:** All access to sensitive data is logged with detailed information.
- **User Settings Page:** Unified settings for all roles, offering profile editing, password changes, 2FA management, and role-adaptive notification preferences.
- **Security Hardening Suite:** Multi-layer security including HTTP security headers (Helmet.js, CSP), tiered rate limiting, CORS, account lockout, CSRF protection, suspicious request blocking, login anomaly detection, and an admin security dashboard.
- **Consent-Based Data Sharing:** Founders can create time-limited, revocable consent tokens to share verified data with named partners.
- **KYC-as-a-Service Module:** Full KYC verification service for individuals and corporates with organisation onboarding, AI-powered document extraction, risk scoring, document expiry tracking, and Paystack integration. Includes a public API for programmatic verification requests with API key management, prepaid credits, and webhook delivery.
- **Notification Centre:** In-app notification system with a bell icon, popover, and a full notifications page.
- **Digital Signature Pad:** Personal profile page offers draw-on-screen and upload options for signature specimens, stored securely.
- **Shared Public Navigation & Footer:** Reusable components for marketing and public pages, including navigation, product/resource dropdowns, pricing, contact links, and theme toggling.
- **Landing Page:** World-class single-statement hero, trust bar, 7-section layout, and two-path KYC integration journey (Web Dashboard vs API).
- **Verified Entities Registry:** Cross-platform catalogue of all verified individuals and companies, auto-populated upon KYC approval.
- **Verified Procurement Marketplace:** Full RFQ/Bid/Contract/Invoice system for verified organisations. Features include: RFQ creation (draft/publish workflow, open/invited visibility, line items, categories), bid submission with templates, contract award with milestone tracking, professional invoice generation with manual tax entry, and escrow infrastructure (gated behind `enable_escrow_payments` feature flag until banking partner secured). All amounts stored in kobo. Contract numbers: CO-YYYY-XXXXX, Invoice numbers: INV-YYYY-XXXXX. Routes in `server/routes/procurementRoutes.ts`, pages in `client/src/pages/procurement/`. 20 seeded categories covering Nigerian business sectors.
- **Admin Proposals Page:** Admin-only page for viewing partnership proposals as formatted HTML for browser-native printing/saving.
- **Certificate HTML Fallback:** Verification certificates support `?format=html` query parameter for browser-rendered viewing when PDF generation fails.
- **SEO & Structured Data:**
  - Open Graph and Twitter Card meta tags in `index.html` for social sharing previews.
  - Schema.org JSON-LD structured data on landing page: Organization, WebSite, FAQPage, and Service schemas.
  - `robots.txt` blocking private routes (`/admin/`, `/founder/`, `/lawyer/`, `/kyc/`, `/settings/`, `/profile/`, `/api/`).
  - `sitemap.xml` listing all 8 public pages with priority/changefreq.
  - `usePageMeta` hook (`client/src/hooks/use-page-meta.ts`) for per-page title, meta description, OG tags, Twitter tags, and canonical URL updates. Applied to: landing, why-cellion-one, api-docs, terms, privacy, apply-lawyer, login, register.
  - Canonical domain: `https://cellionone.com`.

## External Dependencies
- **PostgreSQL:** Primary database, hosted via Neon.
- **OpenAI GPT-4o:** Powers the AI Legal Assistant.
- **Paystack:** Sole payment gateway for all NGN transactions.
- **Resend:** Email service for authentication, notifications, and system communications.
- **Africa's Talking:** SMS OTP provider for Two-Factor Authentication.
- **Smile ID:** Identity verification service for BVN/NIN validation and biometric matching.
- **Replit Auth:** Used for foundational user authentication services.
- **Replit Object Storage:** Utilized for secure storage of document uploads.