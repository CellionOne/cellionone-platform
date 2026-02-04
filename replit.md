# Celion One - Nigeria Legal Tech Platform

## Overview
Celion One is a comprehensive legal tech platform for Nigeria company incorporation. The platform supports three user roles (Founder, Lawyer, Admin) with features including identity verification, digital application wizard, document management vault, payment integration (Paystack), AI-powered CAC activity suggestions (OpenAI), lawyer assignment and case management, admin controls, and audit logging.

## Tech Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL (Neon-backed via Replit)
- **Authentication**: Custom email/password auth (bcryptjs) + Resend email integration
- **AI**: OpenAI GPT-4o for CAC activity suggestions
- **Payments**: Paystack (Nigeria)
- **PWA**: Service worker with offline support, web app manifest

## User Roles
1. **Founder**: Can create applications, upload documents, make payments, track status
2. **Lawyer**: Reviews assigned cases, processes applications, receives payouts
3. **Admin**: Manages users, assigns lawyers, controls feature flags, views audit logs

## Project Structure
```
client/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── app-sidebar.tsx  # Navigation sidebar
│   │   ├── dashboard-layout.tsx
│   │   ├── theme-provider.tsx
│   │   ├── status-badge.tsx
│   │   ├── loading-spinner.tsx
│   │   └── empty-state.tsx
│   ├── pages/
│   │   ├── landing.tsx      # Public landing page
│   │   ├── founder/         # Founder portal pages
│   │   ├── lawyer/          # Lawyer portal pages
│   │   ├── admin/           # Admin portal pages
│   │   └── applications/    # Application management
│   └── hooks/
│       └── use-auth.tsx     # Authentication hook
server/
├── routes.ts                # API endpoints
├── storage.ts               # Database operations
├── db.ts                    # Database connection
└── replit_integrations/     # Auth & AI integrations
shared/
├── schema.ts                # Drizzle ORM schema
└── models/auth.ts           # Auth-related models
```

## Database Schema
- **users**: Core user data (from Replit Auth)
- **sessions**: Auth sessions
- **user_roles**: Role assignments (founder, lawyer, admin)
- **founder_profiles**: Extended founder info
- **lawyer_profiles**: Lawyer details and capacity
- **identity_verifications**: KYC status tracking
- **company_applications**: Main application data
- **application_checklist_items**: Document requirements
- **document_files**: Uploaded files metadata
- **payments**: Payment records (Paystack)
- **payout_ledger**: Lawyer earnings
- **clarification_requests**: Communication between lawyers and founders
- **audit_logs**: Activity tracking
- **feature_flags**: Feature toggles
- **notifications**: User notifications
- **service_addresses**: Office locations (Ikoyi)
- **registered_office_subscriptions**: User subscriptions to registered office service
- **mail_handling_preferences**: User mail handling preferences (scan_all, approve_before_scan, forward_only)
- **mail_items**: Individual mail items received at registered office
- **mail_approval_requests**: Approval workflow for mail scanning/forwarding

## API Endpoints

### Auth
- `GET /api/login` - Initiate Replit Auth
- `GET /api/callback` - OAuth callback
- `GET /api/logout` - Sign out
- `GET /api/auth/user` - Get current user with roles

### Founder
- `GET /api/founder/dashboard` - Dashboard data
- `GET /api/founder/applications` - List applications
- `GET /api/founder/identity` - Identity verification status
- `POST /api/founder/identity/upload` - Upload KYC documents
- `GET /api/founder/vault` - Document vault

### Applications
- `GET /api/applications/:id` - Application details
- `POST /api/applications` - Create application
- `PATCH /api/applications/:id` - Update application
- `POST /api/applications/:id/submit` - Submit for review
- `POST /api/applications/:id/documents` - Upload document

### Legal AI
- `POST /api/legal-ai/suggest-activities` - AI CAC activity suggestions

### Payments
- `POST /api/payments/initiate/:applicationId` - Start payment

### Lawyer
- `GET /api/lawyer/dashboard` - Lawyer dashboard
- `GET /api/lawyer/applications` - Assigned cases
- `GET /api/lawyer/payouts` - Payout history
- `POST /api/lawyer/applications/:id/status` - Update case status

### Admin
- `GET /api/admin/dashboard` - Admin dashboard
- `GET /api/admin/users` - List all users
- `POST /api/admin/users/:userId/roles` - Manage roles
- `GET /api/admin/applications` - All applications
- `POST /api/admin/applications/:id/assign` - Assign lawyer
- `GET /api/admin/feature-flags` - List flags
- `PATCH /api/admin/feature-flags/:key` - Toggle flag
- `GET /api/admin/audit-logs` - Activity logs
- `GET /api/admin/lawyer-applications` - List lawyer applications
- `GET /api/admin/lawyer-applications/:id` - Get lawyer application details
- `POST /api/admin/lawyer-applications/:id/review` - Approve/reject lawyer application

### Lawyer Onboarding (Public)
- `POST /api/lawyer-applications` - Submit lawyer application (no auth required)

### Registered Office
- `GET /api/registered-office/options` - Get available tiers and location info
- `POST /api/registered-office/select` - Select registered office during wizard
- `POST /api/registered-office/subscribe` - Subscribe to standalone service
- `GET /api/registered-office/subscription` - Get current subscription and address
- `POST /api/registered-office/preferences` - Set mail handling preferences
- `GET /api/registered-office/mail` - Get founder's mail items
- `POST /api/registered-office/mail/:id/approve` - Approve mail action

### Admin Mailroom
- `GET /api/admin/mailroom/stats` - Mailroom statistics
- `GET /api/admin/mailroom/items` - All mail items
- `GET /api/admin/mailroom/subscriptions` - All subscriptions
- `POST /api/admin/mailroom/intake` - Record new mail
- `POST /api/admin/mailroom/:id/scan` - Record scan
- `POST /api/admin/mailroom/:id/forward` - Record forwarding
- `POST /api/admin/mailroom/:id/discard` - Discard mail
- `POST /api/admin/registered-office/:id/beta-activate` - Beta activate subscription

## Design System
- **Primary Color**: Green/Teal (hsl(156 72% 35%)) - Nigerian legal theme
- **Dark Mode**: Fully supported with automatic theme switching
- **Components**: shadcn/ui with custom theming

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `OPENAI_API_KEY` - OpenAI API key (optional, falls back to defaults)
- `PAYSTACK_SECRET_KEY` - Paystack secret (for production)
- `REGISTERED_OFFICE_MAIL_ITEMS_INCLUDED_PER_MONTH` - Monthly mail items included per subscription (default: 5)
- `REGISTERED_OFFICE_STORAGE_DAYS` - Days to retain mail items (default: 30)
- `REGISTERED_OFFICE_OFFICIAL_MAIL_ONLY` - Accept only official mail: government, bank, legal, commercial (default: true)

## Testing
- **Backend Regression Tests**: Run with `npx vitest run`
- Test file: `server/__tests__/auth.regression.test.ts` (6 tests for role-based auth)
- vitest.config.ts configured for Node environment

## Registered Office Service Architecture

### Service Tiers
- **Office Only** (₦75,000/year): Registered address for CAC filings only
- **Office + Mail** (₦150,000/year): Address + mail receiving, scanning, forwarding

### Service Limits (Configurable via Environment)
- **Mail Items**: 5 items/month included (overage tracked with reason)
- **Storage**: 30 days retention before auto-deletion
- **Official Mail Only**: Government, bank, legal, commercial mail accepted; personal mail returned

### Subscription Lifecycle
1. **Pending**: Created but not paid
2. **Active**: Paid and in service period
3. **Beta Activated**: Admin-activated for testing
4. **Expired**: Past expiration date (auto-detected by scheduler)

### Daily Scheduler (server/services/subscriptionScheduler.ts)
- Runs daily with 5-second initial delay
- Expires subscriptions past their expiresAt date
- Sends renewal nudges (30 days and 7 days before expiry)
- Creates audit logs and notifications

### Address Gating
- Full address (line1, line2, postal code) only revealed for active/beta_activated subscriptions
- Pending/expired subscriptions show location only (city, state, country)
- Lawyer view shows Celion One badge with subscription status

### Mail Intake Validation
- Blocks intake for expired subscriptions (returns to sender)
- Validates official mail type when REGISTERED_OFFICE_OFFICIAL_MAIL_ONLY is enabled
- Tracks overage with reason when exceeding monthly limit
- Sends founder notifications for overages

### API Endpoints
- `GET /api/registered-office/service-policy` - Service limits for founders
- `GET /api/admin/mailroom/service-limits` - Service limits for admin

## Recent Changes
- February 4, 2026: Launch-Readiness Hardening
  - Service limits with configurable environment variables
  - Subscription expiry scheduler with daily processing
  - Renewal nudge notifications (30-day and 7-day)
  - Official mail validation for mail intake
  - Overage tracking with admin-provided reasons
  - Expired subscription blocking (mail returned to sender)
  - Service policy display in founder mail/registered office pages
  - Registered office status badge in lawyer application view
  - Address gating for pending/expired subscriptions
  - Comprehensive audit logging for subscription lifecycle
- February 4, 2026: Registered Office + Mail Handling feature
  - Registered office address service with Ikoyi, Lagos location
  - Two tiers: Office Only (₦75,000/year) and Office + Mail (₦150,000/year)
  - Mail handling preferences: scan_all, approve_before_scan, forward_only
  - Sensitive mail auto-escalation option
  - Full address gating (only revealed after payment/activation)
  - Integration with incorporation wizard Address step
  - Standalone /founder/registered-office subscription page
  - /founder/mail inbox for mail handling
  - Admin /admin/mailroom for intake, scanning, forwarding
  - Beta activation for testing without payment
  - Feature flags: registered_office, mail_handling
- February 2, 2026: Lawyer onboarding system
  - Public lawyer application form (/apply-lawyer)
  - Admin review workflow for lawyer applications
  - Auto-creation of lawyer accounts upon approval
  - Email notifications for application status
  - "Join as Lawyer" link in landing page footer
- January 31, 2026: Hardening phase complete
  - Fixed critical role-based routing bug (removed registerAuthRoutes() override)
  - Added 7 hardening safeguards: auth route ownership, frontend routing guards, payment state validation, AI safety labels, offline data validation, audit logging
  - Created regression test suite (6 tests, all passing)
  - Enhanced audit logging with 21+ action types including login, view_dashboard, payment_state_changed
- January 2026: Enhanced platform with advanced features
  - Payment state transitions (released_to_lawyer, refunded_partial, refunded_full, chargeback)
  - Verification receipts management (issue/revoke)
  - Execution declarations for lawyers
  - Clarification requests with AI draft composer
  - Offline draft sync with IndexedDB
  - Document quality check UI
  - AI events log viewer for admin
  - New feature flags: offline_drafting, document_quality_check, ai_clarifications, execution_declarations, verification_receipts, readiness_scoring
  - 18 audit log action types throughout the system
- January 2026: Initial build with complete frontend/backend implementation
- Database schema with 15+ tables
- Three-role authentication system
- Application wizard with 4-step flow
- AI-powered CAC activity suggestions
- Green/teal theme customization
