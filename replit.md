# Cellion One - Nigeria Legal Tech Platform

## Overview
Cellion One is a comprehensive legal tech platform designed to streamline company incorporation and related legal services in Nigeria. It aims to revolutionize legal processes for Founders, Lawyers, and Administrators by offering an efficient, transparent, and technology-driven solution, thereby simplifying a complex legal process and setting new standards for legal tech in Nigeria. Key capabilities include a digital application wizard, document management, integrated payments, AI-powered suggestions, lawyer assignment, and robust administrative controls.

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `server/replit_integrations/`.
Do not make changes to the file `server/__tests__/auth.regression.test.ts`.

## System Architecture
The platform utilizes a modern web stack: React with TypeScript, Vite, Tailwind CSS, and shadcn/ui for the frontend; Express.js with TypeScript for the backend; and PostgreSQL (Neon-backed) for the database. Authentication uses a custom email/password system. The UI/UX features a primary green/teal color scheme (hsl(156 72% 35%)) and full dark mode support. It supports four distinct user roles: Founder, Lawyer, Admin, and Building Manager, each with tailored portals.

Key architectural decisions and features include:
-   **Modular Design:** Reusable frontend components and a structured backend with clear separation of concerns.
-   **Progressive Web Application (PWA):** Supports offline functionality.
-   **Payment System:** Paystack-only for NGN, supporting split payments and auto-settlement, with an optional banking partner fee layer.
-   **Registered Office Service:** Tiered virtual address services with mail handling and automated subscription management.
-   **Security & Administration:** Super admin controls, feature flags, comprehensive audit logging, 2FA via SMS OTP, sensitive data access logging, and a robust security hardening suite including HTTP headers, rate limiting, and CSRF protection.
-   **Post-Incorporation Support:** AI Legal Assistant, digital Company Profiles, a 10-task Post-Incorporation Checklist, and an auto-calculated Compliance Calendar with email reminders.
-   **Identity & KYC:** Comprehensive 4-step identity verification via Smile ID (BVN/NIN, document, biometric, AML/sanctions) for individuals, and a full KYC-as-a-Service module for individuals and corporates. This includes hosted verification sessions, a public API, verified identity profile store, AML monitoring hub, and STR Report Builder.
-   **User Management:** Personal profile system with encrypted NIN/BVN storage, document uploads, and Director/Shareholder management with individual verification.
-   **Procurement Marketplace:** A full RFQ/Bid/Contract/Invoice system for verified organizations with escrow payments.
-   **Escrow-as-a-Service API:** Public REST API for third-party platforms to manage escrow transactions.
-   **CIE (Cellion Intelligence Engine):** A subscription API serving NGX equity intelligence with tiered access and integrated billing.
-   **Notification Centre:** In-app notification system.
-   **Digital Signature Pad:** For signature specimens.
-   **SEO & Structured Data:** Open Graph, Twitter Cards, Schema.org JSON-LD, `robots.txt`, `sitemap.xml`, and a `usePageMeta` hook for dynamic SEO.
-   **Consent-Based Data Sharing:** Founders can create time-limited, revocable consent tokens to share verified data.

## External Dependencies
-   **PostgreSQL:** Primary database, hosted via Neon.
-   **OpenAI GPT-4o:** Powers the AI Legal Assistant.
-   **Paystack:** Payment gateway for all NGN transactions.
-   **Resend:** Email service for authentication and notifications.
-   **Africa's Talking:** SMS OTP provider for Two-Factor Authentication.
-   **Smile ID:** Identity verification service.
-   **Replit Auth:** Foundational user authentication.
-   **Replit Object Storage:** Secure storage for document uploads.