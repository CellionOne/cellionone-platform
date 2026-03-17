export function generateSupplierVerificationProposalHTML(): string {
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
    .warning-box {
      background: #fefce8;
      border-left: 4px solid #ca8a04;
      padding: 16px 20px;
      margin: 16px 0;
      border-radius: 0 6px 6px 0;
    }
    .warning-box p { margin: 0; }
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
    .check-list { list-style: none; padding-left: 0; }
    .check-list li::before { content: "✓ "; color: #0f7a4d; font-weight: 700; }
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
    .two-col {
      display: flex;
      gap: 20px;
      margin: 16px 0;
    }
    .two-col > div { flex: 1; }
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
    <div class="cover-subtitle">Supplier Verification Service</div>
    <h1>Know Who You&rsquo;re<br>Doing Business With</h1>
    <h2>Verified Supplier Due Diligence for Nigerian Organisations &mdash;<br>Before the Contract Is Signed</h2>
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
      Procurement fraud and vendor-related financial crime cost Nigerian organisations hundreds of billions of naira each year. Ghost suppliers, shell companies, directors with sanctions exposure, and businesses operating without proper CAC registration are common — and they often pass through manual vendor onboarding processes unchallenged.
    </p>
    <p>
      Cellion One&rsquo;s <strong>Supplier Verification Service</strong> gives procurement teams, finance departments, and compliance officers a fast, reliable way to verify any Nigerian supplier before onboarding them. Within 24 hours, you receive a structured due diligence report covering company registration, director identity, AML/sanctions screening, and compliance status — backed by a digitally signed verification certificate.
    </p>

    <div class="highlight-box">
      <p><strong>The core promise:</strong> Before you sign a purchase order or release a payment, you know exactly who you&rsquo;re dealing with. Every director identified. Every sanction flag surfaced. Every registration status confirmed.</p>
    </div>

    <div class="stat-grid">
      <div class="stat-box">
        <span class="number">24h</span>
        <span class="label">Turnaround Time</span>
      </div>
      <div class="stat-box">
        <span class="number">CAC</span>
        <span class="label">Registration Verified</span>
      </div>
      <div class="stat-box">
        <span class="number">AML</span>
        <span class="label">Sanctions Screening</span>
      </div>
      <div class="stat-box">
        <span class="number">PDF</span>
        <span class="label">Audit Certificate</span>
      </div>
    </div>
  </div>

  <!-- THE PROBLEM -->
  <div class="page">
    <h2>2. The Problem with Supplier Onboarding Today</h2>
    <p>
      Most Nigerian organisations onboard suppliers through a process that involves collecting a CAC certificate, a TIN letter, and a few reference contacts &mdash; and then trusting what they&rsquo;ve been given. This approach has serious, well-documented gaps.
    </p>

    <div class="warning-box">
      <p><strong>The uncomfortable truth:</strong> A CAC certificate can be photocopied, expired, or belong to a company that has since been struck off. A TIN number does not confirm active tax compliance. And most vendor onboarding processes never verify the identity of a single director.</p>
    </div>

    <h3>Common Supplier Risk Scenarios</h3>
    <table>
      <thead>
        <tr>
          <th>Risk Type</th>
          <th>How It Manifests</th>
          <th>Typical Detection Method</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Ghost Suppliers</strong></td>
          <td>Company registered but dormant, no physical operations, no employees. Used to divert procurement payments.</td>
          <td>Only discovered after funds are disbursed — if at all</td>
        </tr>
        <tr>
          <td><strong>Shell Companies</strong></td>
          <td>Company registration is valid but beneficial ownership is obscured through nominees or complex director structures.</td>
          <td>Manual cross-referencing, rarely done systematically</td>
        </tr>
        <tr>
          <td><strong>Sanctioned Directors</strong></td>
          <td>A company director appears on OFAC, UN, or local sanctions lists — creating legal and reputational exposure for any organisation that transacts with them.</td>
          <td>Not checked in most vendor onboarding processes</td>
        </tr>
        <tr>
          <td><strong>Expired or Invalid Registrations</strong></td>
          <td>CAC annual returns not filed; company struck off the register; RC number reused or falsified.</td>
          <td>Manual CAC portal checks — time-consuming and inconsistent</td>
        </tr>
        <tr>
          <td><strong>Conflicted Relationships</strong></td>
          <td>A supplier&rsquo;s director shares identity with a staff member or family member of the procuring organisation.</td>
          <td>Almost never detected without systematic identity checks</td>
        </tr>
      </tbody>
    </table>

    <p>
      The consequence is not just financial loss. Organisations that knowingly or unknowingly transact with sanctioned entities face regulatory action, reputational damage, and potential personal liability for senior management.
    </p>
  </div>

  <!-- OUR SOLUTION -->
  <div class="page">
    <h2>3. The Cellion One Supplier Verification Service</h2>
    <p>
      Our supplier verification process runs five structured checks on every company submitted, producing a consolidated report that your procurement and compliance teams can act on immediately.
    </p>

    <h3>What We Check</h3>
    <div class="flow-diagram">
      <div class="flow-step">
        <div class="flow-number">1</div>
        <div class="flow-content">
          <h4>CAC Registration Status</h4>
          <p>We verify the company&rsquo;s RC number, confirm its current registration status (active, dormant, or struck off), retrieve the registered office address, and confirm its date of incorporation and business type.</p>
        </div>
      </div>
      <div class="arrow-down">&darr;</div>
      <div class="flow-step">
        <div class="flow-number">2</div>
        <div class="flow-content">
          <h4>Director &amp; Shareholder Identity</h4>
          <p>We identify all listed directors and major shareholders from the CAC register and run identity verification on each — including BVN/NIN validation and government ID document checks — to confirm they are real, identifiable individuals.</p>
        </div>
      </div>
      <div class="arrow-down">&darr;</div>
      <div class="flow-step">
        <div class="flow-number">3</div>
        <div class="flow-content">
          <h4>AML &amp; Sanctions Screening</h4>
          <p>Every identified director is screened against global sanctions lists (OFAC, UN, EU), Politically Exposed Persons (PEP) databases, and adverse media. The company itself is also screened against known corporate watchlists.</p>
        </div>
      </div>
      <div class="arrow-down">&darr;</div>
      <div class="flow-step">
        <div class="flow-number">4</div>
        <div class="flow-content">
          <h4>Compliance &amp; Regulatory Checks</h4>
          <p>Where applicable, we confirm the supplier&rsquo;s SCUML registration status (for businesses in designated categories), active TIN status, and whether required regulatory filings are current.</p>
        </div>
      </div>
      <div class="arrow-down">&darr;</div>
      <div class="flow-step">
        <div class="flow-number">5</div>
        <div class="flow-content">
          <h4>Beneficial Ownership Mapping</h4>
          <p>We map the ultimate beneficial owners of the company, identifying any ownership structures that obscure who ultimately controls or benefits from the entity.</p>
        </div>
      </div>
    </div>
  </div>

  <!-- WHAT YOU RECEIVE -->
  <div class="page">
    <h2>4. What You Receive</h2>
    <p>
      Every verified supplier generates a structured output package your team can store, share, and rely on during audits.
    </p>

    <table>
      <thead>
        <tr>
          <th>Deliverable</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Supplier Due Diligence Report</strong></td>
          <td>A structured PDF report summarising all five verification checks, with clear pass / flag / fail status for each area, supporting evidence, and a recommendation on whether to proceed with onboarding.</td>
        </tr>
        <tr>
          <td><strong>Verified Supplier Certificate</strong></td>
          <td>A digitally signed certificate confirming that the supplier has passed Cellion One&rsquo;s verification process, with a unique verification ID and QR code for independent confirmation.</td>
        </tr>
        <tr>
          <td><strong>AML Screening Report</strong></td>
          <td>Individual AML/PEP/sanctions screening results for each director identified, with source references and risk rating.</td>
        </tr>
        <tr>
          <td><strong>Director Identity Profiles</strong></td>
          <td>Verified identity profiles for each director: name, BVN/NIN confirmation, ID document check result, and biometric match status.</td>
        </tr>
        <tr>
          <td><strong>Verified Registry Entry</strong></td>
          <td>The supplier is added to your organisation&rsquo;s private verified entities registry on Cellion One, making them searchable by your procurement team for future engagements without re-running the full process.</td>
        </tr>
        <tr>
          <td><strong>Full Audit Trail</strong></td>
          <td>Complete, tamper-evident log of every check performed, timestamped and accessible for internal or external audit purposes.</td>
        </tr>
      </tbody>
    </table>

    <div class="highlight-box">
      <p><strong>Shelf life:</strong> A verified supplier certificate remains valid for 12 months. After that, we notify you automatically and can re-verify for a reduced renewal fee — so your supplier register stays current without manual tracking.</p>
    </div>
  </div>

  <!-- THE VERIFIED PROCUREMENT MARKETPLACE -->
  <div class="page">
    <h2>5. Beyond Verification: The Verified Procurement Marketplace</h2>
    <p>
      Supplier verification is the foundation. Once a supplier is verified, they&rsquo;re eligible to participate in the <strong>Cellion One Verified Procurement Marketplace</strong> &mdash; a closed, trusted environment where verified organisations transact with confidence.
    </p>

    <div class="two-col">
      <div>
        <h3>For Buyers</h3>
        <ul class="check-list">
          <li>Post RFQs visible only to verified suppliers</li>
          <li>Receive and compare bids from pre-vetted vendors</li>
          <li>Award contracts with milestone-based payment tracking</li>
          <li>Generate professional purchase orders and contracts</li>
          <li>Full procurement audit trail per transaction</li>
        </ul>
      </div>
      <div>
        <h3>For Verified Suppliers</h3>
        <ul class="check-list">
          <li>Access to procurement opportunities from verified buyers</li>
          <li>Verified badge displayed on all bids and proposals</li>
          <li>Bid using structured templates</li>
          <li>Milestone-based contract management</li>
          <li>Professional invoice generation and delivery</li>
        </ul>
      </div>
    </div>

    <div class="highlight-box">
      <p><strong>The network effect:</strong> Every supplier you verify adds to a growing registry of trusted Nigerian businesses. As more organisations use the Cellion One marketplace, your verified suppliers gain access to a wider pool of procurement opportunities &mdash; making verification a commercial asset, not just a compliance cost.</p>
    </div>

    <h3>Marketplace Transaction Flow</h3>
    <div class="flow-diagram">
      <div class="flow-step">
        <div class="flow-number">1</div>
        <div class="flow-content">
          <h4>Buyer posts a Request for Quotation (RFQ)</h4>
          <p>Open to all verified suppliers or invited to a curated shortlist. Line items, categories, deadline, and evaluation criteria defined upfront.</p>
        </div>
      </div>
      <div class="arrow-down">&darr;</div>
      <div class="flow-step">
        <div class="flow-number">2</div>
        <div class="flow-content">
          <h4>Verified suppliers submit bids</h4>
          <p>Using structured bid templates. Each bid is linked to the supplier&rsquo;s verified profile and certificate.</p>
        </div>
      </div>
      <div class="arrow-down">&darr;</div>
      <div class="flow-step">
        <div class="flow-number">3</div>
        <div class="flow-content">
          <h4>Contract awarded with milestone tracking</h4>
          <p>Buyer awards contract, sets milestones, and manages delivery. Supplier invoices against completed milestones.</p>
        </div>
      </div>
    </div>
  </div>

  <!-- HOW TO GET STARTED -->
  <div class="page">
    <h2>6. How to Get Started</h2>
    <p>
      We offer three ways to access supplier verification, suited to different verification volumes and technical needs.
    </p>

    <table>
      <thead>
        <tr>
          <th>Access Method</th>
          <th>Best For</th>
          <th>How It Works</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Web Dashboard</strong></td>
          <td>Organisations verifying 1&ndash;10 suppliers per month</td>
          <td>Submit supplier details via the Cellion One dashboard. No technical integration required. Results and certificates delivered within 24 hours.</td>
        </tr>
        <tr>
          <td><strong>REST API</strong></td>
          <td>Organisations integrating verification into existing procurement or ERP systems</td>
          <td>Programmatic submission via our API. Prepaid credits purchased upfront. Webhooks deliver results in real time. Sandbox environment available for testing.</td>
        </tr>
        <tr>
          <td><strong>Bulk Upload</strong></td>
          <td>Organisations conducting a one-off audit of an existing supplier register</td>
          <td>Upload a CSV of supplier RC numbers and contact details. We run the full verification pipeline and return a consolidated report and individual certificates.</td>
        </tr>
      </tbody>
    </table>

    <h2>7. Pricing</h2>
    <p>
      Transparent, per-verification pricing. No subscription required for dashboard users; API customers purchase prepaid credit packs.
    </p>

    <table>
      <thead>
        <tr>
          <th>Service</th>
          <th>Scope</th>
          <th>Price</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Supplier Verification</strong></td>
          <td>CAC registration, director/shareholder identity, AML screening, compliance checks, beneficial ownership mapping, due diligence report, verified certificate</td>
          <td><strong>&#8358;100,000 / company</strong></td>
        </tr>
        <tr>
          <td><strong>Certificate Renewal</strong></td>
          <td>Re-verification of a previously verified supplier after 12 months. Includes updated AML screening and CAC status check.</td>
          <td><strong>&#8358;60,000 / company</strong></td>
        </tr>
        <tr>
          <td><strong>API Credits (Prepaid)</strong></td>
          <td>Programmatic access. Minimum 10 credits. 1 credit = 1 supplier verification.</td>
          <td><strong>&#8358;100,000 / credit</strong></td>
        </tr>
        <tr>
          <td><strong>Bulk Audit (50+ suppliers)</strong></td>
          <td>One-off bulk verification of an existing supplier register. Custom pricing for large batches.</td>
          <td><strong>Contact us</strong></td>
        </tr>
      </tbody>
    </table>

    <div class="highlight-box">
      <p><strong>Volume Discounts:</strong> Organisations processing 20 or more supplier verifications per year qualify for negotiated pricing. Contact us to discuss a tailored arrangement.</p>
    </div>
  </div>

  <!-- SECURITY & COMPLIANCE -->
  <div class="page">
    <h2>8. Security &amp; Data Protection</h2>
    <p>
      All personal data processed during supplier verification is handled in accordance with the Nigeria Data Protection Regulation (NDPR) and international best practices for sensitive data management.
    </p>

    <div style="margin: 12px 0;">
      <span class="security-badge">AES-256-GCM Encryption</span>
      <span class="security-badge">HTTPS/TLS</span>
      <span class="security-badge">RBAC Access Control</span>
      <span class="security-badge">NDPR Compliant</span>
      <span class="security-badge">Audit Logging</span>
      <span class="security-badge">Rate Limiting</span>
      <span class="security-badge">Consent-Based Processing</span>
      <span class="security-badge">Data Retention Policy</span>
    </div>

    <table>
      <thead>
        <tr>
          <th>Area</th>
          <th>Our Approach</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Consent</strong></td>
          <td>Verification is only initiated with the supplier&rsquo;s knowledge and cooperation. Director identity checks require individual consent in line with NDPR requirements.</td>
        </tr>
        <tr>
          <td><strong>Data Encryption</strong></td>
          <td>All PII (BVN, NIN, biometric data) is encrypted at rest using AES-256-GCM. Data is never stored in plain text.</td>
        </tr>
        <tr>
          <td><strong>Access Control</strong></td>
          <td>Verification results are accessible only to authorised users within your organisation, managed through role-based access controls.</td>
        </tr>
        <tr>
          <td><strong>Data Sharing</strong></td>
          <td>Verified data can be shared with named third parties only through time-limited, revocable consent tokens &mdash; giving your organisation full control over downstream data access.</td>
        </tr>
        <tr>
          <td><strong>Audit Trail</strong></td>
          <td>Every access to a verification record is logged with the accessor&rsquo;s identity, timestamp, and action — providing a full trail for internal and regulatory audit purposes.</td>
        </tr>
        <tr>
          <td><strong>Data Retention</strong></td>
          <td>Verification data is retained in accordance with NDPR requirements. Verified entities can request deletion of their records at any time.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- NEXT STEPS -->
  <div class="page">
    <h2>9. Next Steps</h2>
    <p>
      Getting started with supplier verification takes less than a day. Here&rsquo;s how the onboarding process works:
    </p>

    <div class="flow-diagram">
      <div class="flow-step">
        <div class="flow-number">1</div>
        <div class="flow-content">
          <h4>Discovery Call (30 minutes)</h4>
          <p>We discuss your current vendor onboarding process, the volume of suppliers you manage, any specific risk categories you&rsquo;re concerned about, and which access method suits your team.</p>
        </div>
      </div>
      <div class="arrow-down">&darr;</div>
      <div class="flow-step">
        <div class="flow-number">2</div>
        <div class="flow-content">
          <h4>Pilot Verification (2&ndash;3 Suppliers)</h4>
          <p>We run a complimentary pilot on two or three suppliers of your choosing so your team can review the report format, certificate quality, and turnaround time before committing.</p>
        </div>
      </div>
      <div class="arrow-down">&darr;</div>
      <div class="flow-step">
        <div class="flow-number">3</div>
        <div class="flow-content">
          <h4>Onboard &amp; Go Live</h4>
          <p>We provision your organisation&rsquo;s account on the Cellion One platform, set up your verified entities registry, and confirm your preferred access method. You can begin submitting suppliers the same day.</p>
        </div>
      </div>
      <div class="arrow-down">&darr;</div>
      <div class="flow-step">
        <div class="flow-number">4</div>
        <div class="flow-content">
          <h4>Ongoing Supplier Register Management</h4>
          <p>We send you automatic renewal notifications as certificates approach expiry, so your verified supplier register stays current without manual calendar management.</p>
        </div>
      </div>
    </div>

    <h3>Contact Information</h3>
    <table>
      <thead>
        <tr>
          <th>Channel</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        <tr><td><strong>Email</strong></td><td>service@cellionone.com</td></tr>
        <tr><td><strong>Website</strong></td><td>www.cellionone.com</td></tr>
        <tr><td><strong>Partnership Enquiries</strong></td><td>www.cellionone.com/partner-with-us</td></tr>
      </tbody>
    </table>

    <div class="highlight-box">
      <p><strong>Ready to begin?</strong> Email service@cellionone.com or visit our partner page to submit an enquiry. We respond within one business day and can have your first supplier verification running within 48 hours of onboarding.</p>
    </div>

    <div class="footer">
      <p>&copy; ${year} Cellion Platforms Nigeria Limited. All rights reserved.</p>
      <p>This document is confidential and intended for the named recipient only.</p>
    </div>
    <div class="confidential">Confidential</div>
  </div>

</body>
</html>
`;
}
