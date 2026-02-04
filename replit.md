# Celion One - Nigeria Legal Tech Platform

## Overview
Celion One is a comprehensive legal tech platform designed to streamline company incorporation in Nigeria. It serves Founders, Lawyers, and Administrators, offering features such as identity verification, a digital application wizard, document management, integrated payment systems (Paystack, Stripe), AI-powered suggestions for corporate activities, lawyer assignment and case management, and robust administrative controls with audit logging. The platform aims to revolutionize legal processes in Nigeria by providing an efficient, transparent, and technology-driven solution for company registration and related legal services.

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
- **Dual Payment Provider System:** Supports Stripe (GBP) for international transactions and Paystack (NGN) for local Nigerian transactions, managed by a `PriceBook` module. This involves a two-step checkout flow for mixed one-off and subscription purchases and robust webhook processing for transaction completion.
- **Registered Office Service:** Offers tiered registered address services with mail handling, configurable limits (e.g., mail items per month, storage duration), and an automated daily scheduler for subscription management (expiry, renewal nudges). Address visibility is gated based on subscription status.
- **Feature Flags:** Allows dynamic control over feature availability for various functionalities like payment providers or specific service requirements.
- **Comprehensive Audit Logging:** Tracks significant user and system actions across the platform.

## External Dependencies
- **PostgreSQL:** Primary database, hosted via Neon.
- **OpenAI GPT-4o:** Used for AI-powered CAC activity suggestions.
- **Paystack:** Payment gateway for Nigerian Naira (NGN) transactions.
- **Stripe:** Payment gateway for international (GBP) transactions.
- **Resend:** Email service for authentication and notifications.
- **Replit Auth:** For user authentication services.