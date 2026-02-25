export function generateBankPartnershipProposalHTML(): string {
  const year = new Date().getFullYear();
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @page { size: A4; margin: 40px 50px; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #1a1a1a;
      line-height: 1.7;
      font-size: 11pt;
    }
    .cover {
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      page-break-after: always;
      background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 50%, #ecfdf5 100%);
      padding: 60px;
    }
    .cover-logo {
      font-size: 36pt;
      font-weight: 800;
      color: #0f7a4d;
      letter-spacing: -1px;
      margin-bottom: 8px;
    }
    .cover-subtitle {
      font-size: 13pt;
      color: #52525b;
      margin-bottom: 60px;
    }
    .cover h1 {
      font-size: 28pt;
      color: #18181b;
      font-weight: 700;
      margin-bottom: 16px;
      line-height: 1.2;
    }
    .cover h2 {
      font-size: 14pt;
      color: #52525b;
      font-weight: 400;
      margin-bottom: 40px;
    }
    .cover-meta {
      font-size: 10pt;
      color: #71717a;
    }
    .cover-meta p { margin-bottom: 4px; }
    .page { page-break-after: always; padding: 20px 0; }
    .page:last-child { page-break-after: avoid; }
    h2 {
      font-size: 18pt;
      color: #0f7a4d;
      font-weight: 700;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #d1fae5;
    }
    h3 {
      font-size: 13pt;
      color: #18181b;
      font-weight: 600;
      margin: 20px 0 8px 0;
    }
    p { margin-bottom: 12px; }
    .highlight-box {
      background: #f0fdf4;
      border-left: 4px solid #0f7a4d;
      padding: 16px 20px;
      margin: 16px 0;
      border-radius: 0 6px 6px 0;
    }
    .highlight-box p { margin: 0; }
    .stat-grid {
      display: flex;
      gap: 16px;
      margin: 20px 0;
    }
    .stat-box {
      flex: 1;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .stat-box .number {
      font-size: 22pt;
      font-weight: 700;
      color: #0f7a4d;
      display: block;
    }
    .stat-box .label {
      font-size: 9pt;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 10pt;
    }
    th {
      background: #0f7a4d;
      color: white;
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #e4e4e7;
    }
    tr:nth-child(even) { background: #fafafa; }
    .flow-diagram {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 24px;
      margin: 20px 0;
    }
    .flow-step {
      display: flex;
      align-items: flex-start;
      margin-bottom: 16px;
    }
    .flow-step:last-child { margin-bottom: 0; }
    .flow-number {
      background: #0f7a4d;
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 12pt;
      flex-shrink: 0;
      margin-right: 14px;
      margin-top: 2px;
    }
    .flow-content h4 {
      font-size: 11pt;
      font-weight: 600;
      color: #18181b;
      margin-bottom: 2px;
    }
    .flow-content p {
      font-size: 10pt;
      color: #52525b;
      margin: 0;
    }
    .arrow-down {
      text-align: center;
      color: #0f7a4d;
      font-size: 16pt;
      margin: -8px 0 -8px 7px;
    }
    ul { padding-left: 20px; margin-bottom: 12px; }
    li { margin-bottom: 6px; }
    .security-badge {
      display: inline-block;
      background: #dcfce7;
      color: #166534;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 9pt;
      font-weight: 600;
      margin: 2px 4px 2px 0;
    }
    .footer {
      text-align: center;
      color: #a1a1aa;
      font-size: 8pt;
      padding-top: 20px;
      border-top: 1px solid #e4e4e7;
      margin-top: 40px;
    }
    .confidential {
      text-align: center;
      font-size: 8pt;
      color: #ef4444;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 600;
      margin-top: 40px;
    }
  </style>
</head>
<body>

  <!-- COVER PAGE -->
  <div class="cover">
    <div class="cover-logo">Cellion One</div>
    <div class="cover-subtitle">Legal Technology Platform</div>
    <h1>Banking Partnership<br>Proposal</h1>
    <h2>Pre-Verified Corporate Account Opening<br>for Newly Incorporated Nigerian Companies</h2>
    <div class="cover-meta">
      <p>Prepared by Cellion Platforms Nigeria Limited</p>
      <p>${date}</p>
      <p>Contact: service@cellionone.com</p>
    </div>
    <div class="confidential">Confidential</div>
  </div>

  <!-- EXECUTIVE SUMMARY -->
  <div class="page">
    <h2>1. Executive Summary</h2>
    <p>
      Cellion One is a legal technology platform that digitises company incorporation in Nigeria. We guide founders through the entire CAC registration process — from identity verification and document collection through to payment, lawyer assignment, and post-incorporation compliance.
    </p>
    <p>
      By the time a company is successfully incorporated through our platform, every key person (founder, directors, and shareholders) has undergone <strong>comprehensive identity verification</strong> through Smile ID, and all required corporate documents are digitally stored and verified. This creates a unique opportunity for banking partners.
    </p>
    <div class="highlight-box">
      <p><strong>The Opportunity:</strong> Every newly incorporated company needs a corporate bank account. Cellion One can deliver pre-verified, KYC-ready customers directly to your bank — dramatically reducing your account opening costs, turnaround time, and fraud risk.</p>
    </div>

    <h3>Key Value Propositions</h3>
    <div class="stat-grid">
      <div class="stat-box">
        <span class="number">4-Step</span>
        <span class="label">Identity Verification</span>
      </div>
      <div class="stat-box">
        <span class="number">100%</span>
        <span class="label">Digital Document Storage</span>
      </div>
      <div class="stat-box">
        <span class="number">AML</span>
        <span class="label">Sanctions Screening</span>
      </div>
      <div class="stat-box">
        <span class="number">API</span>
        <span class="label">Integration Ready</span>
      </div>
    </div>
  </div>

  <!-- PLATFORM OVERVIEW -->
  <div class="page">
    <h2>2. Platform Overview</h2>
    <p>
      Cellion One serves three user roles — Founders, Lawyers, and Administrators — and manages the full lifecycle of Nigerian company incorporation.
    </p>

    <h3>What We Handle</h3>
    <table>
      <thead>
        <tr>
          <th>Stage</th>
          <th>What Happens</th>
          <th>Data Collected</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Registration</strong></td>
          <td>Founder creates account, verifies email</td>
          <td>Full name, email, phone</td>
        </tr>
        <tr>
          <td><strong>Profile Completion</strong></td>
          <td>Personal details, ID numbers, document uploads</td>
          <td>NIN, BVN, passport photo, signature, government ID, residential address</td>
        </tr>
        <tr>
          <td><strong>Team Onboarding</strong></td>
          <td>Directors & shareholders invited, each creates their own profile</td>
          <td>Same full profile for each person</td>
        </tr>
        <tr>
          <td><strong>Identity Verification</strong></td>
          <td>4-step Smile ID verification for every key person</td>
          <td>Verification results, biometric data, AML clearance</td>
        </tr>
        <tr>
          <td><strong>Payment & Filing</strong></td>
          <td>Paystack payment, lawyer assigned, CAC filing processed</td>
          <td>Payment records, order history</td>
        </tr>
        <tr>
          <td><strong>Post-Incorporation</strong></td>
          <td>Company profile, compliance calendar, TIN/SCUML/trademark</td>
          <td>RC number, company type, share structure, compliance status</td>
        </tr>
      </tbody>
    </table>

    <h3>Services Offered</h3>
    <table>
      <thead>
        <tr>
          <th>Service</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>CAC Company Incorporation</td><td>5 tiers by share capital (₦1M to ₦100M+), including foreign participation</td></tr>
        <tr><td>NGO Registration</td><td>Registration of Incorporated Trustees</td></tr>
        <tr><td>TIN Registration</td><td>Federal Inland Revenue Service tax identification</td></tr>
        <tr><td>SCUML Certificate</td><td>EFCC Special Control Unit certification</td></tr>
        <tr><td>Trademark Registration</td><td>Two-stage trademark filing</td></tr>
        <tr><td>Post-Incorporation Support</td><td>Compliance calendar, AI legal assistant, document vault</td></tr>
      </tbody>
    </table>
  </div>

  <!-- VERIFICATION PROCESS -->
  <div class="page">
    <h2>3. Identity Verification Process</h2>
    <p>
      Every key person associated with a company on Cellion One undergoes a comprehensive 4-step identity verification process powered by <strong>Smile ID</strong>, a leading African identity verification provider trusted by major banks, fintechs, and telecoms across the continent.
    </p>

    <div class="flow-diagram">
      <div class="flow-step">
        <div class="flow-number">1</div>
        <div class="flow-content">
          <h4>BVN / NIN Validation</h4>
          <p>Bank Verification Number and National Identity Number are validated against Nigeria's national databases via Smile ID's Enhanced KYC product. Confirms the ID number is genuine and retrieves the registered name, date of birth, and photo.</p>
        </div>
      </div>
      <div class="arrow-down">↓</div>
      <div class="flow-step">
        <div class="flow-number">2</div>
        <div class="flow-content">
          <h4>Government ID Document Verification</h4>
          <p>User uploads a government-issued ID (international passport, driver's licence, voter's card, or national ID). Smile ID's Document Verification product checks for authenticity, tampering, and extracts biometric data from the document.</p>
        </div>
      </div>
      <div class="arrow-down">↓</div>
      <div class="flow-step">
        <div class="flow-number">3</div>
        <div class="flow-content">
          <h4>Biometric Selfie & Liveness Detection</h4>
          <p>SmartSelfie Authentication captures a live selfie and matches it against the photo on the ID document. Includes liveness detection to prevent spoofing with photos, videos, or masks. Proves the person holding the device is the person on the document.</p>
        </div>
      </div>
      <div class="arrow-down">↓</div>
      <div class="flow-step">
        <div class="flow-number">4</div>
        <div class="flow-content">
          <h4>AML & Sanctions Screening</h4>
          <p>Automated screening against global sanctions lists, Politically Exposed Persons (PEP) databases, and adverse media. Ensures no key person is flagged for financial crimes, terrorism financing, or other regulatory risks.</p>
        </div>
      </div>
    </div>

    <h3>Verification Output Per Person</h3>
    <table>
      <thead>
        <tr>
          <th>Data Point</th>
          <th>Source</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Full Legal Name</td><td>BVN/NIN Database + ID Document</td><td>Cross-referenced</td></tr>
        <tr><td>Date of Birth</td><td>BVN/NIN Database + ID Document</td><td>Cross-referenced</td></tr>
        <tr><td>BVN</td><td>CBN Database via Smile ID</td><td>Validated</td></tr>
        <tr><td>NIN</td><td>NIMC Database via Smile ID</td><td>Validated</td></tr>
        <tr><td>Photo (Biometric)</td><td>SmartSelfie + ID Document</td><td>Face-matched</td></tr>
        <tr><td>Liveness</td><td>SmartSelfie</td><td>Confirmed alive</td></tr>
        <tr><td>ID Document</td><td>Document Verification</td><td>Authenticated</td></tr>
        <tr><td>AML/PEP Status</td><td>Global Watchlists</td><td>Screened</td></tr>
        <tr><td>Residential Address</td><td>User-provided</td><td>Collected</td></tr>
        <tr><td>Passport Photo</td><td>User upload</td><td>Stored</td></tr>
        <tr><td>Signature Specimen</td><td>User upload</td><td>Stored</td></tr>
      </tbody>
    </table>
  </div>

  <!-- DOCUMENT MANAGEMENT & SECURITY -->
  <div class="page">
    <h2>4. Document Management & Security</h2>

    <h3>Document Storage</h3>
    <p>
      All personal and corporate documents are stored in secure cloud object storage with strict access controls. Documents are organised per user and per company, with the following types collected:
    </p>
    <ul>
      <li><strong>Personal:</strong> Passport photographs, signature specimens, government-issued ID scans</li>
      <li><strong>Corporate:</strong> Certificate of Incorporation, MEMART, Status Report, TIN certificate, proof of address, additional regulatory certificates</li>
    </ul>

    <h3>Data Security Measures</h3>
    <div style="margin: 12px 0;">
      <span class="security-badge">AES-256-GCM Encryption</span>
      <span class="security-badge">HTTPS/TLS</span>
      <span class="security-badge">RBAC Access Control</span>
      <span class="security-badge">Audit Logging</span>
      <span class="security-badge">Rate Limiting</span>
      <span class="security-badge">Session Timeout</span>
      <span class="security-badge">Account Lockout</span>
      <span class="security-badge">CSP Headers</span>
    </div>

    <table>
      <thead>
        <tr>
          <th>Security Feature</th>
          <th>Implementation</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>PII Encryption</td><td>NIN and BVN stored with AES-256-GCM encryption. Only last 4 digits displayed to users.</td></tr>
        <tr><td>Access Logging</td><td>All access to NIN, BVN, and personal documents is logged with accessor, target, data type, IP address, and user agent.</td></tr>
        <tr><td>Authentication</td><td>Email/password with optional SMS-based 2FA. Sessions timeout after 30 minutes idle, 8 hours absolute.</td></tr>
        <tr><td>Account Security</td><td>Account lockout after 5 failed login attempts (15-minute cooldown). Password requirements: 8+ characters with mixed case, numbers, and special characters.</td></tr>
        <tr><td>API Security</td><td>Helmet.js security headers (CSP, HSTS, X-Frame-Options), CORS allowlisting, rate limiting on all endpoints.</td></tr>
        <tr><td>File Security</td><td>File upload validation (type, size, extension whitelist). Documents served via signed URLs with expiration.</td></tr>
        <tr><td>Audit Trail</td><td>Comprehensive audit logging of all significant user and system actions, including admin overrides, payment events, and verification activities.</td></tr>
      </tbody>
    </table>
  </div>

  <!-- DATA SHARING MODEL -->
  <div class="page">
    <h2>5. Data Sharing Architecture</h2>
    <p>
      We propose two methods for delivering verified customer data to your bank, depending on your integration readiness. Both methods require <strong>explicit customer consent</strong> before any data is shared.
    </p>

    <h3>Option A: API Integration (Recommended)</h3>
    <p>
      Cellion One exposes a secure REST API that your bank's systems can call to retrieve verified customer data in real-time. This is the most efficient, auditable, and scalable approach.
    </p>
    <div class="flow-diagram">
      <div class="flow-step">
        <div class="flow-number">1</div>
        <div class="flow-content">
          <h4>Customer Consent</h4>
          <p>After incorporation, the customer opts in to share their verified data with your bank via the Cellion One dashboard. A time-limited consent token is generated.</p>
        </div>
      </div>
      <div class="arrow-down">↓</div>
      <div class="flow-step">
        <div class="flow-number">2</div>
        <div class="flow-content">
          <h4>Bank API Call</h4>
          <p>Your bank's system calls our API with the consent token. We authenticate the request using API keys and verify the consent is valid and not expired.</p>
        </div>
      </div>
      <div class="arrow-down">↓</div>
      <div class="flow-step">
        <div class="flow-number">3</div>
        <div class="flow-content">
          <h4>Data Response</h4>
          <p>Our API returns a structured JSON payload containing: verified personal details, Smile ID verification results, document download URLs (signed, time-limited), company details, and share structure.</p>
        </div>
      </div>
      <div class="arrow-down">↓</div>
      <div class="flow-step">
        <div class="flow-number">4</div>
        <div class="flow-content">
          <h4>Account Opening</h4>
          <p>Your bank processes the pre-verified data and opens the corporate account with minimal additional checks. The customer receives confirmation via both platforms.</p>
        </div>
      </div>
    </div>

    <h3>Option B: Secure Data Package</h3>
    <p>
      For banks not yet ready for API integration, we generate a digitally signed verification package that the customer can download and share directly with your bank.
    </p>
    <table>
      <thead>
        <tr><th>Component</th><th>Format</th><th>Contents</th></tr>
      </thead>
      <tbody>
        <tr><td>Verification Certificate</td><td>PDF</td><td>Summary of all verification checks passed, Smile ID job references, timestamps, and a QR code linking to a verification URL</td></tr>
        <tr><td>Personal Documents</td><td>ZIP</td><td>Passport photo, signature specimen, government ID scan</td></tr>
        <tr><td>Corporate Documents</td><td>ZIP</td><td>Certificate of Incorporation, MEMART, TIN, other certificates</td></tr>
        <tr><td>Company Profile</td><td>PDF</td><td>Directors, shareholders, share allocation, registered address, RC number</td></tr>
      </tbody>
    </table>

    <h3>API Data Schema (Preview)</h3>
    <table>
      <thead>
        <tr><th>Field</th><th>Type</th><th>Description</th></tr>
      </thead>
      <tbody>
        <tr><td>company.name</td><td>String</td><td>Registered company name</td></tr>
        <tr><td>company.rcNumber</td><td>String</td><td>CAC registration number</td></tr>
        <tr><td>company.type</td><td>String</td><td>LTD, GTE, NGO, etc.</td></tr>
        <tr><td>company.shareCapital</td><td>Number</td><td>Authorised share capital in NGN</td></tr>
        <tr><td>company.directors[]</td><td>Array</td><td>Verified director profiles</td></tr>
        <tr><td>company.shareholders[]</td><td>Array</td><td>Verified shareholder profiles with share allocation</td></tr>
        <tr><td>person.fullName</td><td>String</td><td>Verified full legal name</td></tr>
        <tr><td>person.bvnVerified</td><td>Boolean</td><td>BVN validation status</td></tr>
        <tr><td>person.ninVerified</td><td>Boolean</td><td>NIN validation status</td></tr>
        <tr><td>person.documentVerified</td><td>Boolean</td><td>ID document authentication status</td></tr>
        <tr><td>person.biometricVerified</td><td>Boolean</td><td>Selfie face-match result</td></tr>
        <tr><td>person.amlCleared</td><td>Boolean</td><td>AML/PEP screening result</td></tr>
        <tr><td>person.smileIdJobId</td><td>String</td><td>Smile ID reference for independent verification</td></tr>
        <tr><td>documents[]</td><td>Array</td><td>Signed download URLs for all stored documents</td></tr>
      </tbody>
    </table>
  </div>

  <!-- PARTNERSHIP BENEFITS -->
  <div class="page">
    <h2>6. Partnership Benefits</h2>

    <h3>For Your Bank</h3>
    <table>
      <thead>
        <tr><th>Benefit</th><th>Detail</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>Reduced KYC Costs</strong></td><td>Customers arrive pre-verified with BVN, NIN, biometric match, and AML clearance. Your bank can rely on Smile ID's verification results, significantly reducing due diligence effort and cost per account.</td></tr>
        <tr><td><strong>Faster Account Opening</strong></td><td>With all documents digitally available and identities pre-verified, account opening can be reduced from days to hours or minutes.</td></tr>
        <tr><td><strong>Guaranteed Volume</strong></td><td>Every company incorporated through Cellion One needs a corporate bank account. We can funnel 100% of our customer base to a preferred banking partner.</td></tr>
        <tr><td><strong>Lower Fraud Risk</strong></td><td>4-step verification including liveness detection and AML screening means the risk of fraudulent account opening is dramatically reduced.</td></tr>
        <tr><td><strong>Digital-First Customers</strong></td><td>Founders who use Cellion One are tech-savvy business owners who are likely to adopt digital banking products, mobile banking, POS services, and business loans.</td></tr>
        <tr><td><strong>Cross-Sell Opportunity</strong></td><td>Access to a pipeline of new businesses needing not just accounts but also business loans, insurance, POS terminals, payroll services, and foreign exchange.</td></tr>
      </tbody>
    </table>

    <h3>For Cellion One Customers</h3>
    <ul>
      <li>Seamless transition from incorporation to account opening — no need to re-submit documents</li>
      <li>Faster account activation — days instead of weeks</li>
      <li>Single platform for all post-incorporation needs</li>
      <li>Potential for preferential banking terms negotiated by Cellion One</li>
    </ul>

    <h3>Proposed Commercial Model</h3>
    <p>We are open to discussing several partnership structures:</p>
    <ul>
      <li><strong>Referral Fee:</strong> Fixed fee per successful corporate account opened via Cellion One referral</li>
      <li><strong>Revenue Share:</strong> Percentage of account-related revenue for referred customers</li>
      <li><strong>White-Label Integration:</strong> Bank-branded account opening flow embedded within Cellion One</li>
      <li><strong>API Sponsorship:</strong> Bank sponsors the verification cost in exchange for exclusive referral rights</li>
    </ul>
  </div>

  <!-- NEXT STEPS -->
  <div class="page">
    <h2>7. Proposed Next Steps</h2>

    <div class="flow-diagram">
      <div class="flow-step">
        <div class="flow-number">1</div>
        <div class="flow-content">
          <h4>Exploratory Meeting</h4>
          <p>We present a live demo of the Cellion One platform, walk through the verification process, and discuss your bank's specific requirements for corporate account opening.</p>
        </div>
      </div>
      <div class="arrow-down">↓</div>
      <div class="flow-step">
        <div class="flow-number">2</div>
        <div class="flow-content">
          <h4>Technical Assessment</h4>
          <p>Your technical team reviews our API documentation and data schema. We jointly define the integration scope, data fields required, and security protocols.</p>
        </div>
      </div>
      <div class="arrow-down">↓</div>
      <div class="flow-step">
        <div class="flow-number">3</div>
        <div class="flow-content">
          <h4>Pilot Programme</h4>
          <p>We run a 3-month pilot with a limited number of accounts (e.g., 50-100) using the Secure Data Package method to validate the process before full API integration.</p>
        </div>
      </div>
      <div class="arrow-down">↓</div>
      <div class="flow-step">
        <div class="flow-number">4</div>
        <div class="flow-content">
          <h4>Full Integration</h4>
          <p>Based on pilot results, we deploy the full API integration for automated, real-time verified customer onboarding at scale.</p>
        </div>
      </div>
    </div>

    <h3>Contact Information</h3>
    <table>
      <tbody>
        <tr><td><strong>Company</strong></td><td>Cellion Platforms Nigeria Limited</td></tr>
        <tr><td><strong>Platform</strong></td><td>Cellion One — cellionone.com</td></tr>
        <tr><td><strong>Email</strong></td><td>service@cellionone.com</td></tr>
        <tr><td><strong>Verification Provider</strong></td><td>Smile ID (Partner ID: 8352)</td></tr>
      </tbody>
    </table>

    <div class="footer">
      <p>&copy; ${year} Cellion Platforms Nigeria Limited. All rights reserved.</p>
      <p>This document is confidential and intended for the named recipient only.</p>
    </div>
  </div>

</body>
</html>
  `;
}
