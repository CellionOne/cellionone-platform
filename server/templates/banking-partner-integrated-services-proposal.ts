export function generateBankingPartnerIntegratedServicesProposalHTML(): string {
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
      font-size: 26pt;
      color: #18181b;
      font-weight: 700;
      margin-bottom: 16px;
      line-height: 1.2;
    }
    .cover h2 {
      font-size: 13pt;
      color: #52525b;
      font-weight: 400;
      margin-bottom: 40px;
      max-width: 560px;
    }
    .cover-meta {
      font-size: 10pt;
      color: #71717a;
    }
    .cover-meta p { margin-bottom: 4px; }
    .pillar-tags {
      display: flex;
      gap: 10px;
      margin: 24px 0 40px 0;
      flex-wrap: wrap;
      justify-content: center;
    }
    .pillar-tag {
      background: #dcfce7;
      color: #166534;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 9pt;
      font-weight: 600;
      letter-spacing: 0.3px;
    }
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
    h4 {
      font-size: 11pt;
      font-weight: 600;
      color: #18181b;
      margin-bottom: 2px;
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
      vertical-align: top;
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
    .flow-content h4 { margin-bottom: 2px; }
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
    .pillar-header {
      background: linear-gradient(90deg, #0f7a4d 0%, #15803d 100%);
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .pillar-header .pillar-number {
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.8;
      margin-bottom: 4px;
    }
    .pillar-header h2 {
      color: white;
      border-bottom: none;
      padding: 0;
      margin: 0;
      font-size: 16pt;
    }
    .two-col {
      display: flex;
      gap: 20px;
      margin: 16px 0;
    }
    .two-col > div { flex: 1; }
    .card-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }
    .card-box h4 {
      color: #0f7a4d;
      margin-bottom: 6px;
    }
    .card-box p {
      font-size: 10pt;
      color: #52525b;
      margin: 0;
    }
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
    .check-list {
      list-style: none;
      padding: 0;
    }
    .check-list li {
      padding-left: 20px;
      position: relative;
      margin-bottom: 8px;
    }
    .check-list li::before {
      content: "✓";
      position: absolute;
      left: 0;
      color: #0f7a4d;
      font-weight: 700;
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
    .closing-box {
      background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
      border: 1px solid #bbf7d0;
      border-radius: 12px;
      padding: 32px;
      text-align: center;
      margin: 32px 0;
    }
    .closing-box h3 {
      color: #0f7a4d;
      font-size: 16pt;
      margin-bottom: 12px;
    }
    .closing-box p {
      color: #374151;
      max-width: 480px;
      margin: 0 auto 12px auto;
    }
    .contact-row {
      display: flex;
      justify-content: center;
      gap: 32px;
      margin-top: 20px;
      font-size: 10pt;
    }
    .contact-row div { text-align: center; }
    .contact-row .contact-label {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #71717a;
      margin-bottom: 2px;
    }
    .contact-row .contact-value {
      color: #0f7a4d;
      font-weight: 600;
    }
  </style>
</head>
<body>

  <!-- COVER PAGE -->
  <div class="cover">
    <div class="cover-logo">Cellion One</div>
    <div class="cover-subtitle">Legal Technology Platform · Nigeria</div>
    <h1>Banking Partner —<br>Integrated Services Proposal</h1>
    <h2>A three-pillar partnership framework for Nigerian banks seeking verified customers, outsourced compliance, and marketplace escrow opportunities</h2>
    <div class="pillar-tags">
      <span class="pillar-tag">Pillar I — Bank Accounts for Verified Users</span>
      <span class="pillar-tag">Pillar II — KYC / KYB Verification Partner</span>
      <span class="pillar-tag">Pillar III — Escrow Services</span>
    </div>
    <div class="cover-meta">
      <p>Prepared by Cellion Platforms Nigeria Limited</p>
      <p>${date}</p>
      <p>Contact: service@cellionone.com</p>
    </div>
    <div class="confidential">Private &amp; Confidential</div>
  </div>

  <!-- EXECUTIVE SUMMARY -->
  <div class="page">
    <h2>Executive Summary</h2>
    <p>
      Cellion One is a Nigerian legal technology platform that digitises company incorporation, post-incorporation compliance, and KYC/KYB verification. We operate at the intersection of identity, regulation, and commerce — exactly where banks need the most support.
    </p>
    <p>
      This proposal outlines a three-pillar integrated partnership between Cellion One and your institution, each pillar independently valuable and collectively transformative:
    </p>

    <div class="two-col" style="margin-top: 20px;">
      <div>
        <div class="card-box">
          <h4>Pillar I — Bank Accounts</h4>
          <p>Every Cellion user who completes incorporation or KYC is a fully verified individual or registered business that needs a bank account. We can route this pipeline directly to your institution, delivering pre-verified customers with BVN, NIN, biometric match, and AML clearance already complete.</p>
        </div>
        <div class="card-box">
          <h4>Pillar II — Verification Partner</h4>
          <p>Cellion One can serve as your bank's outsourced KYC and KYB engine — verifying your retail customers' identities and conducting corporate due diligence on your business clients and suppliers via our KYC-as-a-Service API.</p>
        </div>
      </div>
      <div>
        <div class="card-box">
          <h4>Pillar III — Escrow Services</h4>
          <p>Cellion One operates a verified procurement marketplace where businesses transact significant sums. We are seeking a licensed banking partner to provide escrow services to our marketplace participants under the bank's existing escrow licence, creating a new revenue stream for your institution.</p>
        </div>
        <div class="highlight-box" style="margin-top: 12px;">
          <p><strong>Why now?</strong> Nigeria's SEC and CBN are tightening identity and AML standards. Banks that integrate a proven digital verification layer early will have a structural compliance and cost advantage over peers who continue to rely on manual, branch-based onboarding.</p>
        </div>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-box">
        <span class="number">4-Step</span>
        <span class="label">Identity Verification</span>
      </div>
      <div class="stat-box">
        <span class="number">KYC+KYB</span>
        <span class="label">Individual &amp; Corporate</span>
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

  <!-- ABOUT CELLION ONE -->
  <div class="page">
    <h2>About Cellion One</h2>
    <p>
      Cellion One serves Founders, Businesses, Lawyers, and Administrators across Nigeria. Our platform handles the full lifecycle of company registration and post-incorporation compliance, and provides KYC/KYB verification-as-a-service to third-party organisations.
    </p>

    <h3>Core Services</h3>
    <table>
      <thead>
        <tr><th>Service</th><th>Description</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>Company Incorporation</strong></td><td>Full CAC registration across 5 share capital tiers, including foreign-participatory companies and NGOs</td></tr>
        <tr><td><strong>Identity Verification (KYC)</strong></td><td>4-step individual verification: BVN/NIN lookup, government ID document verification, biometric selfie matching, and AML/PEP sanctions screening</td></tr>
        <tr><td><strong>Corporate Verification (KYB)</strong></td><td>Business identity checks: CAC registration status, director identity verification, beneficial ownership mapping, and AML screening of principals</td></tr>
        <tr><td><strong>KYC-as-a-Service API</strong></td><td>Programmatic verification for third-party organisations via REST API — with hosted verification sessions, webhooks, and a full dashboard</td></tr>
        <tr><td><strong>Registered Office Service</strong></td><td>Virtual registered address with tiered mail handling for companies without a physical presence</td></tr>
        <tr><td><strong>Verified Procurement Marketplace</strong></td><td>RFQ, bid, contract, and invoice management for verified businesses — all participants are KYC/KYB cleared</td></tr>
        <tr><td><strong>Post-Incorporation Compliance</strong></td><td>Compliance calendar, AI legal assistant, TIN registration, SCUML, trademark filing, and document vault</td></tr>
      </tbody>
    </table>

    <h3>User Base Profile</h3>
    <p>
      Cellion One's users are predominantly founders, directors, and operators of registered Nigerian companies — the exact demographic that banks seek for corporate account acquisition. Every user who completes our onboarding has:
    </p>
    <ul class="check-list">
      <li>Provided full personal details (name, phone, email, date of birth, residential address)</li>
      <li>Submitted BVN and NIN, both validated against national databases</li>
      <li>Uploaded a government-issued ID document (passport, driver's licence, voter's card, or national ID), verified for authenticity</li>
      <li>Passed a live selfie biometric check matched against their ID document</li>
      <li>Been screened against global AML/PEP sanctions lists</li>
      <li>Had their company registered with the Corporate Affairs Commission (CAC)</li>
    </ul>
  </div>

  <!-- PILLAR I: BANK ACCOUNTS -->
  <div class="page">
    <div class="pillar-header">
      <div class="pillar-number">Pillar I</div>
      <h2>Bank Accounts for Verified Cellion Users</h2>
    </div>

    <p>
      Every person who completes identity verification on Cellion One — whether a founder incorporating a company or an individual completing a standalone KYC — has already cleared the same documentation and identity checks that your bank's account opening process would require. This creates a unique pre-verified pipeline.
    </p>

    <h3>Individual Accounts</h3>
    <p>
      Cellion's personal KYC flow produces a fully verified individual with a confirmed BVN, NIN, biometric match, and AML clearance. These individuals can be offered a personal bank account with significantly reduced onboarding friction:
    </p>
    <div class="flow-diagram">
      <div class="flow-step">
        <div class="flow-number">1</div>
        <div class="flow-content">
          <h4>Verification Completed on Cellion One</h4>
          <p>User completes all 4 steps of identity verification. Data is stored securely and a verification certificate is issued.</p>
        </div>
      </div>
      <div class="arrow-down">↓</div>
      <div class="flow-step">
        <div class="flow-number">2</div>
        <div class="flow-content">
          <h4>User Opts In for Account Opening</h4>
          <p>Cellion One presents the bank's account offer within the dashboard. The user consents to share their verified data, generating a time-limited consent token.</p>
        </div>
      </div>
      <div class="arrow-down">↓</div>
      <div class="flow-step">
        <div class="flow-number">3</div>
        <div class="flow-content">
          <h4>Data Transferred to Bank (API or Secure Package)</h4>
          <p>The bank's system retrieves verified identity data, biometric results, and document copies via API, or the user downloads a signed verification package to submit directly.</p>
        </div>
      </div>
      <div class="arrow-down">↓</div>
      <div class="flow-step">
        <div class="flow-number">4</div>
        <div class="flow-content">
          <h4>Account Opened</h4>
          <p>The bank processes the pre-verified data and opens the account — days faster than standard onboarding — with no re-submission of documents already verified.</p>
        </div>
      </div>
    </div>

    <h3>Business Accounts</h3>
    <p>
      For incorporated companies, Cellion One holds both individual KYC (for each director and shareholder) and corporate KYB data (CAC registration, MEMART, TIN, share structure). A newly incorporated company can be presented with a business account offer immediately after incorporation completes:
    </p>
    <table>
      <thead>
        <tr><th>Data Available at Account Opening</th><th>Source</th></tr>
      </thead>
      <tbody>
        <tr><td>Company name, RC number, type (LTD/GTE/NGO), registration date</td><td>CAC via Cellion</td></tr>
        <tr><td>Memorandum and Articles of Association (MEMART)</td><td>Cellion Document Vault</td></tr>
        <tr><td>Certificate of Incorporation</td><td>Cellion Document Vault</td></tr>
        <tr><td>Tax Identification Number (TIN)</td><td>FIRS via Cellion</td></tr>
        <tr><td>Share capital structure and shareholder allocations</td><td>Cellion Platform</td></tr>
        <tr><td>Verified director profiles (name, BVN, NIN, ID, biometric, AML)</td><td>Smile ID via Cellion</td></tr>
        <tr><td>Registered office address</td><td>Cellion Platform</td></tr>
      </tbody>
    </table>
  </div>

  <!-- PILLAR II: KYC/KYB VERIFICATION PARTNER -->
  <div class="page">
    <div class="pillar-header">
      <div class="pillar-number">Pillar II</div>
      <h2>KYC / KYB Verification Partner for the Bank</h2>
    </div>

    <p>
      Beyond serving as a referral source, Cellion One can function as your bank's <strong>outsourced identity and corporate verification engine</strong> — handling KYC for your retail customers and KYB for your business clients and their supply chains, through our established API infrastructure.
    </p>

    <h3>Individual KYC for the Bank's Retail Customers</h3>
    <p>
      Using our KYC-as-a-Service API, your bank can trigger verification workflows for new retail customers programmatically. The customer is directed to a Cellion-hosted verification session (mobile-optimised), completes the 4-step process, and the result is delivered back to your system via webhook or API response.
    </p>
    <div class="flow-diagram">
      <div class="flow-step">
        <div class="flow-number">1</div>
        <div class="flow-content">
          <h4>Bank Initiates Verification Session</h4>
          <p>Your system calls the Cellion API with the customer's name and contact. A hosted verification link is returned.</p>
        </div>
      </div>
      <div class="arrow-down">↓</div>
      <div class="flow-step">
        <div class="flow-number">2</div>
        <div class="flow-content">
          <h4>Customer Completes Verification</h4>
          <p>Customer opens the link on any device and completes BVN/NIN lookup, ID document upload, selfie biometric check, and AML screening — no Cellion account required.</p>
        </div>
      </div>
      <div class="arrow-down">↓</div>
      <div class="flow-step">
        <div class="flow-number">3</div>
        <div class="flow-content">
          <h4>Result Delivered to Bank</h4>
          <p>Cellion sends a signed webhook to your system with the full verification result: pass/fail per check, identity data, AML hit details (if any), and a verification certificate URL.</p>
        </div>
      </div>
    </div>

    <h3>Corporate KYB for the Bank's Business Clients and Suppliers</h3>
    <p>
      Banks are increasingly responsible for due diligence not just on their own customers but on their customers' supply chains. Cellion's KYB module provides:
    </p>
    <table>
      <thead>
        <tr><th>KYB Check</th><th>What It Verifies</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>CAC Registration Status</strong></td><td>Confirms the company is registered, active, and has not been struck off</td></tr>
        <tr><td><strong>Director &amp; Beneficial Owner Verification</strong></td><td>Full KYC on each named director — BVN, NIN, biometric, AML screening</td></tr>
        <tr><td><strong>Document Authenticity</strong></td><td>Review of Certificate of Incorporation, MEMART, and statutory documents</td></tr>
        <tr><td><strong>AML Screening of Principals</strong></td><td>All directors and beneficial owners screened against global sanctions and PEP lists</td></tr>
        <tr><td><strong>Risk Scoring</strong></td><td>AI-assisted risk score based on sector, ownership structure, PEP exposure, and document completeness</td></tr>
        <tr><td><strong>Ongoing Monitoring</strong></td><td>Automated document expiry alerts and periodic AML re-screening via the Cellion dashboard</td></tr>
      </tbody>
    </table>

    <h3>API Integration Points</h3>
    <table>
      <thead>
        <tr><th>Endpoint</th><th>Purpose</th></tr>
      </thead>
      <tbody>
        <tr><td><code>POST /api/v1/kyc/sessions</code></td><td>Create a hosted verification session for an individual — returns a shareable link</td></tr>
        <tr><td><code>GET /api/v1/kyc/requests/:id</code></td><td>Retrieve the status and result of a verification request</td></tr>
        <tr><td><code>POST /api/v1/kyc/lookup/bvn</code></td><td>Programmatic BVN identity lookup</td></tr>
        <tr><td><code>POST /api/v1/kyc/lookup/nin</code></td><td>Programmatic NIN identity lookup</td></tr>
        <tr><td><code>POST /api/v1/kyc/lookup/aml</code></td><td>On-demand AML/PEP screening for any named individual</td></tr>
        <tr><td>Webhook: <code>verification.completed</code></td><td>Push notification to the bank's system when a verification result is ready</td></tr>
      </tbody>
    </table>

    <h3>Billing Options for the Bank</h3>
    <p>The bank can be onboarded under any of three billing models:</p>
    <ul>
      <li><strong>Prepaid Credits</strong> — Purchase verification credits in advance; each check deducts from the balance</li>
      <li><strong>Monthly Invoice</strong> — Usage consolidated monthly and invoiced; suitable for high-volume institutions</li>
      <li><strong>Exempt / Partner Billing</strong> — No per-check charge; agreed flat fee or revenue-sharing arrangement</li>
    </ul>
  </div>

  <!-- PILLAR III: ESCROW SERVICES -->
  <div class="page">
    <div class="pillar-header">
      <div class="pillar-number">Pillar III</div>
      <h2>Escrow Services for Cellion's Marketplace</h2>
    </div>

    <p>
      Cellion One operates a <strong>Verified Procurement Marketplace</strong> where businesses that have undergone KYC/KYB can issue Requests for Quotation (RFQs), receive competitive bids, award contracts, track milestones, and generate professional invoices — all within a single platform where every participant's identity is verified.
    </p>

    <div class="highlight-box">
      <p><strong>The Gap:</strong> As contract values grow, buyers require a neutral third party to hold funds until milestones are met. Cellion is actively building this escrow capability but requires a licensed banking partner to hold funds and issue confirmations under a valid CBN escrow licence. This is where your institution can play a critical role.</p>
    </div>

    <h3>The Opportunity for the Bank</h3>
    <p>
      By becoming Cellion's escrow banking partner, your institution gains access to a new, recurring revenue stream from a marketplace of verified businesses transacting real commercial sums:
    </p>
    <table>
      <thead>
        <tr><th>What the Bank Provides</th><th>What Cellion Provides</th></tr>
      </thead>
      <tbody>
        <tr><td>CBN-licensed escrow accounts</td><td>Verified buyers and sellers (KYC/KYB cleared)</td></tr>
        <tr><td>Fund custody and release authorisation</td><td>Contract management and milestone tracking</td></tr>
        <tr><td>Regulatory compliance (CBN, NDIC)</td><td>API integration to trigger deposit and release events</td></tr>
        <tr><td>Dispute hold capability</td><td>Dispute flagging and evidence submission tools</td></tr>
        <tr><td>Interest on held balances</td><td>Transaction volume from an active marketplace</td></tr>
      </tbody>
    </table>

    <h3>How the Escrow Flow Works</h3>
    <div class="flow-diagram">
      <div class="flow-step">
        <div class="flow-number">1</div>
        <div class="flow-content">
          <h4>Contract Awarded on Cellion Marketplace</h4>
          <p>A verified buyer awards a contract to a verified supplier. The contract value and milestone schedule are recorded on the platform.</p>
        </div>
      </div>
      <div class="arrow-down">↓</div>
      <div class="flow-step">
        <div class="flow-number">2</div>
        <div class="flow-content">
          <h4>Buyer Deposits Contract Value</h4>
          <p>Buyer pays the contract amount into a dedicated escrow account at the partner bank, referenced by the contract number. Cellion's API notifies the bank of the expected amount and release conditions.</p>
        </div>
      </div>
      <div class="arrow-down">↓</div>
      <div class="flow-step">
        <div class="flow-number">3</div>
        <div class="flow-content">
          <h4>Milestones Tracked on Cellion</h4>
          <p>Supplier completes work against each milestone. Buyer reviews and approves. Cellion records each approval with a timestamp.</p>
        </div>
      </div>
      <div class="arrow-down">↓</div>
      <div class="flow-step">
        <div class="flow-number">4</div>
        <div class="flow-content">
          <h4>Bank Releases Funds on Milestone Approval</h4>
          <p>Upon each buyer approval, Cellion's API instructs the bank to release the corresponding milestone payment to the supplier's account. Dispute holds can be placed automatically if a dispute is raised on the platform.</p>
        </div>
      </div>
    </div>

    <h3>Why This Works</h3>
    <p>Traditional escrow is plagued by fraud risk because the parties are often unknown to each other and to the escrow agent. Cellion's marketplace eliminates this risk at the source:</p>
    <ul class="check-list">
      <li>Every buyer and supplier has completed KYC (individual) or KYB (corporate) — identities are confirmed before any transaction begins</li>
      <li>Contract terms, milestone schedules, and invoices are all recorded on-platform with a full audit trail</li>
      <li>The bank can independently verify any participant's identity through the Cellion API before releasing funds</li>
      <li>All participants have agreed to Cellion's terms of service and the escrow conditions at onboarding</li>
    </ul>

    <h3>Revenue Model for the Bank</h3>
    <ul>
      <li><strong>Escrow Fee:</strong> A percentage of each contract value held in escrow (typically 0.5%–2%)</li>
      <li><strong>Float Income:</strong> Interest on balances held pending milestone release</li>
      <li><strong>Account Acquisition:</strong> Every marketplace participant becomes a potential bank account customer</li>
    </ul>
  </div>

  <!-- MUTUAL BENEFITS -->
  <div class="page">
    <h2>Mutual Benefits Summary</h2>

    <h3>Benefits to the Bank</h3>
    <table>
      <thead>
        <tr><th>Pillar</th><th>Benefit</th><th>Detail</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>I</strong></td>
          <td>Guaranteed verified account pipeline</td>
          <td>Every Cellion user who completes KYC or incorporates a company is a pre-qualified individual or business account prospect</td>
        </tr>
        <tr>
          <td><strong>I</strong></td>
          <td>Reduced KYC cost per account</td>
          <td>Customers arrive BVN-validated, NIN-validated, biometrically matched, and AML-cleared — dramatically reducing bank due diligence time and cost</td>
        </tr>
        <tr>
          <td><strong>I</strong></td>
          <td>Digital-first, low-risk segment</td>
          <td>Founders using Cellion One are tech-savvy operators with legitimate registered businesses — a high-value, lower-risk customer segment</td>
        </tr>
        <tr>
          <td><strong>II</strong></td>
          <td>Outsourced compliance infrastructure</td>
          <td>No need to build or maintain in-house digital KYC/KYB systems — Cellion handles the verification engine, API, and reporting dashboard</td>
        </tr>
        <tr>
          <td><strong>II</strong></td>
          <td>Faster customer onboarding</td>
          <td>Retail account opening and supplier onboarding times reduced from weeks to hours through automated digital verification</td>
        </tr>
        <tr>
          <td><strong>II</strong></td>
          <td>Regulatory confidence</td>
          <td>Cellion's verification outputs include full audit logs, Smile ID references, and timestamped results — acceptable to CBN, EFCC, and NDIC examiners</td>
        </tr>
        <tr>
          <td><strong>III</strong></td>
          <td>New escrow revenue stream</td>
          <td>Escrow fees and float income from a growing volume of verified B2B transactions on the Cellion marketplace</td>
        </tr>
        <tr>
          <td><strong>III</strong></td>
          <td>Low-fraud escrow book</td>
          <td>All escrow principals are KYC/KYB verified before any transaction is initiated — fraud risk is structurally lower than traditional escrow arrangements</td>
        </tr>
      </tbody>
    </table>

    <h3>Benefits to Cellion One and Its Customers</h3>
    <table>
      <thead>
        <tr><th>Who</th><th>Benefit</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>Cellion Platform</strong></td><td>A trusted banking partner elevates Cellion's credibility and allows us to offer a complete financial services experience — incorporation to banking to marketplace — from a single platform</td></tr>
        <tr><td><strong>Founders</strong></td><td>Seamless transition from company registration to business banking — no re-submission of documents already verified on Cellion</td></tr>
        <tr><td><strong>KYB Clients</strong></td><td>Access to a reliable, API-driven verification service backed by proven identity data infrastructure</td></tr>
        <tr><td><strong>Marketplace Participants</strong></td><td>Access to licensed escrow infrastructure that protects both buyers and suppliers in high-value transactions — unlocking larger contracts with confidence</td></tr>
      </tbody>
    </table>
  </div>

  <!-- PROPOSED NEXT STEPS -->
  <div class="page">
    <h2>Proposed Next Steps</h2>
    <p>
      We propose a structured engagement to evaluate and pilot each of the three pillars, allowing both institutions to build confidence in the integration before full deployment.
    </p>

    <div class="flow-diagram">
      <div class="flow-step">
        <div class="flow-number">1</div>
        <div class="flow-content">
          <h4>Introductory Meeting (Week 1–2)</h4>
          <p>Executive-level introductory session between Cellion and the bank's digital banking, compliance, and corporate strategy teams. Confirm interest and assign internal leads for each pillar.</p>
        </div>
      </div>
      <div class="arrow-down">↓</div>
      <div class="flow-step">
        <div class="flow-number">2</div>
        <div class="flow-content">
          <h4>Technical Due Diligence (Week 3–6)</h4>
          <p>Cellion provides full API documentation, security architecture overview, data handling policies, and Smile ID partnership credentials. Bank's technology and compliance teams conduct independent review.</p>
        </div>
      </div>
      <div class="arrow-down">↓</div>
      <div class="flow-step">
        <div class="flow-number">3</div>
        <div class="flow-content">
          <h4>Commercial Term Sheet (Week 6–8)</h4>
          <p>Both parties agree on commercial terms for each pillar: referral fee structure (Pillar I), per-verification pricing or billing model (Pillar II), and escrow fee schedule and float arrangement (Pillar III).</p>
        </div>
      </div>
      <div class="arrow-down">↓</div>
      <div class="flow-step">
        <div class="flow-number">4</div>
        <div class="flow-content">
          <h4>Pilot Programme (Month 3–5)</h4>
          <p>Controlled pilot: a cohort of Cellion users is offered the bank's account products (Pillar I), a subset of the bank's new customers is onboarded via Cellion's KYC API (Pillar II), and a small group of marketplace participants is offered escrow (Pillar III).</p>
        </div>
      </div>
      <div class="arrow-down">↓</div>
      <div class="flow-step">
        <div class="flow-number">5</div>
        <div class="flow-content">
          <h4>Full Launch (Month 6+)</h4>
          <p>Full integration across all three pillars. Joint press release and co-marketing to Cellion's user base and the bank's business banking customers.</p>
        </div>
      </div>
    </div>

    <h3>Data Protection &amp; Legal Framework</h3>
    <p>All three pillars will be governed by:</p>
    <ul>
      <li><strong>Nigeria Data Protection Act (NDPA) 2023</strong> — explicit user consent captured before any data is shared; consent tokens are time-limited and revocable</li>
      <li><strong>CBN KYC Regulations</strong> — Cellion's verification outputs are designed to meet CBN's tiered KYC requirements for bank account opening</li>
      <li><strong>Inter-Institution Data Sharing Agreement</strong> — a formal DPA between Cellion Platforms Nigeria Limited and the bank, specifying data types, purposes, retention periods, and breach notification obligations</li>
      <li><strong>API Security</strong> — all API traffic encrypted in transit (TLS 1.3), authenticated via API key + webhook signature verification, with full request logging and rate limiting</li>
    </ul>

    <div class="footer">
      Cellion Platforms Nigeria Limited · service@cellionone.com · cellionone.com · ${year}
    </div>
  </div>

  <!-- CLOSING PAGE -->
  <div class="page">
    <div class="closing-box">
      <h3>Let's Build Something Significant Together</h3>
      <p>
        The convergence of digital identity, regulatory compliance, and fintech infrastructure in Nigeria is accelerating. Cellion One is positioned at the centre of this shift — and we are looking for a forward-thinking banking partner to grow with us.
      </p>
      <p>
        Whether your institution chooses to engage on one pillar or all three, we are confident the partnership will create measurable value for your customers, your compliance function, and your bottom line.
      </p>
      <p style="font-weight: 600; color: #0f7a4d;">We look forward to a productive conversation.</p>
      <div class="contact-row">
        <div>
          <div class="contact-label">Email</div>
          <div class="contact-value">service@cellionone.com</div>
        </div>
        <div>
          <div class="contact-label">Website</div>
          <div class="contact-value">cellionone.com</div>
        </div>
        <div>
          <div class="contact-label">Prepared</div>
          <div class="contact-value">${date}</div>
        </div>
      </div>
    </div>

    <div class="confidential" style="margin-top: 60px;">Private &amp; Confidential — ${year} Cellion Platforms Nigeria Limited</div>
  </div>

</body>
</html>
  `;
}
