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
- **Three distinct user roles:** Founder, Lawyer, and Admin, each with tailored portals and functionalities.
- **Modular Frontend:** Organized into reusable components, role-specific pages, and custom hooks.
- **Structured Backend:** Clear separation of API routes, database operations, and shared schema definitions.
- **Progressive Web Application (PWA):** Supports offline functionality via a service worker and a web app manifest.
- **Paystack-Only Payment System:** All payments are processed through Paystack in Nigerian Naira (NGN), managed by a `PriceBook` module with webhook processing. It supports a split payment system where Cellion takes a fixed cut per SKU, and the remainder is auto-settled to a lawyer subaccount.
- **Registered Office Service:** Offers tiered virtual registered address services with mail handling, configurable limits, and an automated daily scheduler for subscription management. Includes a proof-of-address workflow where founders confirm the address, admins upload utility bills, and lawyers can download them for filing (founder download is restricted for fraud prevention).
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

## External Dependencies
- **PostgreSQL:** Primary database, hosted via Neon.
- **OpenAI GPT-4o:** Powers the AI Legal Assistant for corporate activity suggestions.
- **Paystack:** Sole payment gateway for all NGN transactions, including split payments.
- **Resend:** Email service for authentication, notifications, and system communications.
- **Africa's Talking:** SMS OTP provider for Two-Factor Authentication.
- **Smile ID:** Identity verification service for BVN/NIN validation and biometric matching.
- **Replit Auth:** Used for foundational user authentication services.
- **Replit Object Storage:** Utilized for secure storage of document uploads.