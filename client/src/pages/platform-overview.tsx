import { useQuery } from "@tanstack/react-query";

interface AuthUser {
  id: string;
  email: string;
  roles?: string[];
}

const SUPER_ADMIN_EMAIL = "service@cellionone.com";

export default function PlatformOverview() {
  const { data: user, isLoading } = useQuery<AuthUser>({
    queryKey: ["/api/auth/me"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user || user.email?.toLowerCase() !== SUPER_ADMIN_EMAIL) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500">This page is restricted to the super administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white text-gray-900 min-h-screen print:min-h-0">
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          h1, h2, h3 { page-break-after: avoid; }
          section { page-break-inside: avoid; }
        }
        .overview-container { max-width: 800px; margin: 0 auto; padding: 40px 32px; font-family: 'Inter', system-ui, sans-serif; }
        .overview-container h1 { font-size: 28px; font-weight: 800; color: #17A55E; margin-bottom: 4px; }
        .overview-container h2 { font-size: 20px; font-weight: 700; color: #17A55E; margin-top: 32px; margin-bottom: 12px; border-bottom: 2px solid #17A55E; padding-bottom: 4px; }
        .overview-container h3 { font-size: 16px; font-weight: 600; color: #1a1a1a; margin-top: 20px; margin-bottom: 8px; }
        .overview-container p { font-size: 14px; line-height: 1.7; color: #333; margin-bottom: 12px; }
        .overview-container ul { margin: 0 0 16px 0; padding-left: 20px; }
        .overview-container li { font-size: 14px; line-height: 1.7; color: #333; margin-bottom: 4px; }
        .overview-container .subtitle { font-size: 16px; color: #555; margin-bottom: 24px; }
        .overview-container .tagline { font-size: 18px; color: #17A55E; font-weight: 600; font-style: italic; margin-bottom: 24px; }
        .overview-container .feature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .overview-container .feature-card { background: #f8faf9; border: 1px solid #e5ebe8; border-radius: 8px; padding: 16px; }
        .overview-container .feature-card h4 { font-size: 14px; font-weight: 700; color: #17A55E; margin-bottom: 6px; }
        .overview-container .feature-card p { font-size: 13px; margin-bottom: 0; }
        .overview-container .role-section { background: #fafafa; border-radius: 8px; padding: 16px 20px; margin-bottom: 12px; border-left: 3px solid #17A55E; }
        .overview-container .role-section h4 { font-size: 15px; font-weight: 700; color: #1a1a1a; margin-bottom: 6px; }
        .overview-container .stat-row { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
        .overview-container .stat-box { background: #17A55E; color: white; border-radius: 8px; padding: 16px 20px; flex: 1; min-width: 120px; text-align: center; }
        .overview-container .stat-box .number { font-size: 28px; font-weight: 800; }
        .overview-container .stat-box .label { font-size: 12px; opacity: 0.9; }
        .overview-container .tech-badge { display: inline-block; background: #f0f0f0; border-radius: 4px; padding: 4px 10px; font-size: 12px; font-weight: 500; margin: 2px 4px 2px 0; }
        @media print { .overview-container .feature-grid { grid-template-columns: 1fr 1fr; } }
      `}</style>

      <div className="no-print" style={{ background: '#17A55E', color: 'white', padding: '12px 0', textAlign: 'center', fontSize: '14px' }}>
        <button onClick={() => window.print()} style={{ background: 'white', color: '#17A55E', border: 'none', padding: '8px 24px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', marginRight: '12px' }}>
          Save as PDF
        </button>
        Use your browser's Print function (Ctrl+P / Cmd+P) to save this page as a PDF.
      </div>

      <div className="overview-container">
        <h1>Cellion One</h1>
        <p className="tagline">Simplify Your Business Journey</p>
        <p className="subtitle">Comprehensive Platform Overview — Features, Architecture & Capabilities</p>

        <div className="stat-row">
          <div className="stat-box"><div className="number">225+</div><div className="label">API Endpoints</div></div>
          <div className="stat-box"><div className="number">63+</div><div className="label">Application Pages</div></div>
          <div className="stat-box"><div className="number">4</div><div className="label">User Roles</div></div>
          <div className="stat-box"><div className="number">10+</div><div className="label">Services Offered</div></div>
        </div>

        <h2>About Cellion One</h2>
        <p>
          Cellion One is a legal tech platform that streamlines company incorporation, compliance, and verification. Starting in Nigeria and expanding across Africa, we bring the entire business formation lifecycle into one digital platform — from registration to post-incorporation compliance, identity verification, and KYC services.
        </p>
        <p>
          Our platform connects founders with verified legal professionals, automates compliance tracking, and provides enterprise-grade identity verification — all through a modern, secure, mobile-ready application.
        </p>

        <h2>Core Services</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <h4>Company Incorporation</h4>
            <p>Digital application wizard for CAC registration. Multiple share capital tiers from ₦1M to ₦100M including foreign participation. Real-time application tracking and lawyer assignment.</p>
          </div>
          <div className="feature-card">
            <h4>NGO Registration</h4>
            <p>Registration of Incorporated Trustees including filing fees, newspaper publications, constitution drafting, and all legal charges.</p>
          </div>
          <div className="feature-card">
            <h4>Post-Incorporation Services</h4>
            <p>TIN registration (FIRS), SCUML certification (EFCC), and two-stage Trademark registration — all managed digitally with progress tracking.</p>
          </div>
          <div className="feature-card">
            <h4>Virtual Registered Office</h4>
            <p>Premium Ikoyi, Lagos address for your company's registered office. Includes mail handling with scanning, forwarding, and approval workflows. Building manager oversight per location.</p>
          </div>
        </div>

        <h2 className="page-break">Identity & Verification</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <h4>4-Step Identity Verification</h4>
            <p>Comprehensive verification via Smile ID: BVN/NIN validation, government ID document check, biometric selfie matching, and AML/sanctions screening.</p>
          </div>
          <div className="feature-card">
            <h4>Director & Shareholder Management</h4>
            <p>Invite directors and shareholders via email. Each completes their profile and undergoes individual verification. Readiness tracking and checkout gates ensure completeness.</p>
          </div>
          <div className="feature-card">
            <h4>Personal Profile System</h4>
            <p>Comprehensive profiles with AES-256-GCM encrypted NIN/BVN storage, document uploads (passport, signature, ID), profile completion tracking, and residential address.</p>
          </div>
          <div className="feature-card">
            <h4>Consent-Based Data Sharing</h4>
            <p>Create time-limited, revocable consent tokens to share verified data with banks, insurers, and government. Partners access data via secure API or download verification certificates.</p>
          </div>
        </div>

        <h2>KYC-as-a-Service</h2>
        <p>A full KYC verification module enabling organisations to verify individuals and suppliers through the platform.</p>
        <div className="feature-grid">
          <div className="feature-card">
            <h4>Employee Verification</h4>
            <p>Individual identity verification at ₦10,000 per person. BVN/NIN validation, document checks, and AI-powered extraction with confidence scoring.</p>
          </div>
          <div className="feature-card">
            <h4>Supplier Due Diligence</h4>
            <p>Corporate verification at ₦100,000 per company. Director verification, document requirements, risk scoring (green/amber/red), and audit certificate generation.</p>
          </div>
          <div className="feature-card">
            <h4>Organisation Management</h4>
            <p>Onboard your organisation with team roles (admin, reviewer, viewer). Custom verification templates, bulk CSV import, and self-registration portals for employees and suppliers.</p>
          </div>
          <div className="feature-card">
            <h4>Compliance & Reporting</h4>
            <p>Document expiry tracking with automated email alerts. Audit-ready certificates for compliance files. Full notification lifecycle and access logging.</p>
          </div>
        </div>

        <h2 className="page-break">Platform Features</h2>
        <h3>AI-Powered Tools</h3>
        <ul>
          <li><strong>Legal AI Assistant</strong> — GPT-4o powered assistant for corporate activity suggestions and legal guidance</li>
          <li><strong>AI Document Extraction</strong> — OpenAI Vision for auto-classification, data extraction, and confidence scoring of submitted documents</li>
          <li><strong>Smart Compliance Calendar</strong> — Auto-calculated deadlines with escalating email reminders (30-day and 7-day warnings)</li>
        </ul>

        <h3>Document Management</h3>
        <ul>
          <li><strong>Digital Document Vault</strong> — Secure cloud storage for all company documents</li>
          <li><strong>Digital Signature Pad</strong> — Draw-on-screen or upload signature specimens with consent tracking</li>
          <li><strong>Proof of Address Workflow</strong> — Controlled utility bill management with building manager uploads and lawyer access for filing</li>
        </ul>

        <h3>Payments & Financial</h3>
        <ul>
          <li><strong>Paystack Integration</strong> — All transactions in Nigerian Naira (NGN) with automated split payments</li>
          <li><strong>Lawyer Subaccount Settlement</strong> — Cellion takes a fixed cut per service, remainder auto-settles to the assigned lawyer</li>
          <li><strong>Order Tracking</strong> — Complete order history with payment status and receipt generation</li>
        </ul>

        <h3>Communication & Notifications</h3>
        <ul>
          <li><strong>Notification Centre</strong> — Bell icon with unread count, mark-as-read, and full notifications page</li>
          <li><strong>Email Notifications</strong> — Automated lifecycle emails via Resend for all key events</li>
          <li><strong>Two-Factor Authentication</strong> — SMS-based OTP via Africa's Talking with backup codes</li>
        </ul>

        <h2>User Roles & Portals</h2>
        <div className="role-section">
          <h4>Founder Portal</h4>
          <p style={{ fontSize: '13px', marginBottom: 0 }}>Dashboard, personal profile, identity verification, director/shareholder management, applications, orders, company profile, post-incorporation checklist, compliance calendar, document vault, registered office, mail handling, legal AI assistant, data sharing, KYC service, and checkout.</p>
        </div>
        <div className="role-section">
          <h4>Lawyer Portal</h4>
          <p style={{ fontSize: '13px', marginBottom: 0 }}>Dashboard, assigned cases, service requests with document uploads and status updates, payout tracking with split payment visibility, KYC service access.</p>
        </div>
        <div className="role-section">
          <h4>Admin Portal</h4>
          <p style={{ fontSize: '13px', marginBottom: 0 }}>Dashboard, user management, application oversight, lawyer application review, mailroom, receipts, AI event monitoring, feature flags, audit logs, orders, registered office management, KYC oversight, and partnership proposals.</p>
        </div>
        <div className="role-section">
          <h4>Building Manager Portal</h4>
          <p style={{ fontSize: '13px', marginBottom: 0 }}>Dashboard with building overview, utility bill management (upload/track expiry with 3-month cycles), subscriber list, and mail intake scoped to their assigned location.</p>
        </div>

        <h2 className="page-break">Security & Compliance</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <h4>Data Encryption</h4>
            <p>AES-256-GCM encryption for all sensitive personal data (NIN, BVN). Comprehensive sensitive data access logging with IP and user agent tracking.</p>
          </div>
          <div className="feature-card">
            <h4>Authentication</h4>
            <p>Email/password with strong password requirements, email verification, account lockout, session timeout (30 min idle, 8 hour absolute), and optional SMS-based 2FA.</p>
          </div>
          <div className="feature-card">
            <h4>Infrastructure Security</h4>
            <p>HTTP security headers (Helmet.js), API rate limiting, CORS allowlisting, file upload validation, and comprehensive audit logging of all significant actions.</p>
          </div>
          <div className="feature-card">
            <h4>Role-Based Access</h4>
            <p>Four distinct roles with middleware-enforced access control. Super admin controls for sensitive role assignments. All roles verified from database on every request.</p>
          </div>
        </div>

        <h2>Technical Architecture</h2>
        <h3>Frontend</h3>
        <p>
          <span className="tech-badge">React</span>
          <span className="tech-badge">TypeScript</span>
          <span className="tech-badge">Vite</span>
          <span className="tech-badge">Tailwind CSS</span>
          <span className="tech-badge">shadcn/ui</span>
          <span className="tech-badge">TanStack Query</span>
          <span className="tech-badge">Wouter</span>
          <span className="tech-badge">PWA</span>
        </p>
        <p>Modern single-page application with progressive web app support, offline functionality via service worker, dark mode, and responsive design across all devices.</p>

        <h3>Backend</h3>
        <p>
          <span className="tech-badge">Node.js</span>
          <span className="tech-badge">Express.js</span>
          <span className="tech-badge">TypeScript</span>
          <span className="tech-badge">PostgreSQL</span>
          <span className="tech-badge">Drizzle ORM</span>
        </p>
        <p>RESTful API with 225+ endpoints. Shared type definitions between frontend and backend using Zod schemas. Background schedulers for compliance deadlines, subscription management, and document expiry tracking.</p>

        <h3>External Integrations</h3>
        <ul>
          <li><strong>Paystack</strong> — Payment processing with split payments and webhook handling</li>
          <li><strong>Smile ID</strong> — Identity verification (BVN/NIN, biometric, AML screening)</li>
          <li><strong>OpenAI GPT-4o</strong> — AI legal assistant and document extraction</li>
          <li><strong>Resend</strong> — Transactional email delivery</li>
          <li><strong>Africa's Talking</strong> — SMS OTP for two-factor authentication</li>
          <li><strong>Replit Object Storage</strong> — Secure document and file storage</li>
        </ul>

        <div style={{ marginTop: '40px', padding: '20px', background: '#f8faf9', borderRadius: '8px', textAlign: 'center' }}>
          <p style={{ fontSize: '16px', fontWeight: 600, color: '#17A55E', marginBottom: '4px' }}>Cellion One</p>
          <p style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>Simplify Your Business Journey</p>
          <p style={{ fontSize: '13px', color: '#666' }}>https://cellionone.com</p>
        </div>
      </div>
    </div>
  );
}
