export function generateVerificationPartnerProposalHTML(): string {
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
    <div class="cover-subtitle">Identity Verification Platform</div>
    <h1>Verification Partner<br>Proposal</h1>
    <h2>End-to-End Identity &amp; Corporate Verification<br>for Nigerian Businesses and Organisations</h2>
    <div class="cover-meta">
      <p>Prepared by Cellion Platforms Nigeria Limited</p>
      <p>${date}</p>
      <p>Contact: service@cellionone.com</p>
    </div>
    <div class="confidential">Confidential</div>
  </div>

  <!-- ABOUT CELLION ONE -->
  <div class="page">
    <h2>1. About Cellion One</h2>
    <p>
      Cellion One is a legal technology and compliance platform that helps founders register and run compliant businesses in Nigeria. We handle company incorporation, identity verification, regulatory filings, and ongoing compliance &mdash; all from a single digital platform.
    </p>
    <p>
      Our verification infrastructure, powered by <strong>Smile ID</strong>, processes BVN/NIN validation, government ID document checks, biometric selfie matching, and AML/sanctions screening. This same infrastructure is available to partner organisations who need reliable, audit-ready verification for their own stakeholders.
    </p>
    <div class="highlight-box">
      <p><strong>Our Mission:</strong> To make identity verification in Nigeria fast, reliable, and audit-ready &mdash; so organisations can focus on their core business instead of manual compliance processes.</p>
    </div>

    <h3>Key Capabilities</h3>
    <div class="stat-grid">
      <div class="stat-box">
        <span class="number">4-Step</span>
        <span class="label">Verification Pipeline</span>
      </div>
      <div class="stat-box">
        <span class="number">BVN/NIN</span>
        <span class="label">National ID Validation</span>
      </div>
      <div class="stat-box">
        <span class="number">AML</span>
        <span class="label">Sanctions Screening</span>
      </div>
      <div class="stat-box">
        <span class="number">API</span>
        <span class="label">Programmatic Access</span>
      </div>
    </div>
  </div>

  <!-- THE PROBLEM -->
  <div class="page">
    <h2>2. The Problem</h2>
    <p>
      Organisations across Nigeria &mdash; from HR departments and fintechs to insurance companies and procurement teams &mdash; face significant challenges when verifying the identity and compliance status of individuals and companies they work with.
    </p>

    <h3>Common Pain Points</h3>
    <table>
      <thead>
        <tr>
          <th>Challenge</th>
          <th>Impact</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Manual verification processes</strong></td>
          <td>Days or weeks to verify a single individual; paper-based workflows prone to human error</td>
        </tr>
        <tr>
          <td><strong>Fragmented data sources</strong></td>
          <td>BVN, NIN, document checks, and AML screening each require separate integrations and vendor relationships</td>
        </tr>
        <tr>
          <td><strong>High cost per verification</strong></td>
          <td>Building and maintaining in-house verification infrastructure is expensive and requires specialised expertise</td>
        </tr>
        <tr>
          <td><strong>Audit and compliance gaps</strong></td>
          <td>Lack of structured audit trails makes it difficult to demonstrate compliance to regulators</td>
        </tr>
        <tr>
          <td><strong>No standardised output</strong></td>
          <td>Verification results are scattered across emails, spreadsheets, and disconnected systems with no single source of truth</td>
        </tr>
      </tbody>
    </table>

    <div class="highlight-box">
      <p><strong>The result:</strong> Organisations either skip thorough verification (increasing risk) or spend disproportionate time and money on manual processes that don't scale.</p>
    </div>
  </div>

  <!-- OUR SOLUTION -->
  <div class="page">
    <h2>3. Our Solution</h2>
    <p>
      Cellion One provides an end-to-end verification pipeline that consolidates BVN/NIN validation, government ID document checks, biometric selfie matching, and AML/sanctions screening into a single, auditable workflow.
    </p>

    <h3>Verification Pipeline</h3>
    <div class="flow-diagram">
      <div class="flow-step">
        <div class="flow-number">1</div>
        <div class="flow-content">
          <h4>BVN / NIN Validation</h4>
          <p>Bank Verification Number and National Identity Number validated against national databases via Smile ID. Confirms the ID number is genuine and retrieves the registered name, date of birth, and photo.</p>
        </div>
      </div>
      <div class="arrow-down">&darr;</div>
      <div class="flow-step">
        <div class="flow-number">2</div>
        <div class="flow-content">
          <h4>Government ID Document Verification</h4>
          <p>User uploads a government-issued ID (international passport, driver&rsquo;s licence, voter&rsquo;s card, or national ID). The document is checked for authenticity, tampering, and biometric data is extracted.</p>
        </div>
      </div>
      <div class="arrow-down">&darr;</div>
      <div class="flow-step">
        <div class="flow-number">3</div>
        <div class="flow-content">
          <h4>Biometric Selfie &amp; Liveness Detection</h4>
          <p>A live selfie is captured and matched against the photo on the ID document. Includes liveness detection to prevent spoofing with photos, videos, or masks.</p>
        </div>
      </div>
      <div class="arrow-down">&darr;</div>
      <div class="flow-step">
        <div class="flow-number">4</div>
        <div class="flow-content">
          <h4>AML &amp; Sanctions Screening</h4>
          <p>Automated screening against global sanctions lists, Politically Exposed Persons (PEP) databases, and adverse media. Ensures no individual is flagged for financial crimes or terrorism financing.</p>
        </div>
      </div>
    </div>
  </div>

  <!-- INTEGRATION OPTIONS -->
  <div class="page">
    <h2>4. Integration Options</h2>
    <p>
      We offer three ways to access our verification infrastructure, depending on your volume and technical requirements.
    </p>

    <h3>Option A: Web Dashboard</h3>
    <p>
      For ad-hoc or low-volume verification needs. Your team logs into the Cellion One dashboard, submits verification requests, and receives results with downloadable certificates &mdash; no technical integration required.
    </p>

    <h3>Option B: REST API</h3>
    <p>
      For programmatic access. Integrate our verification endpoints directly into your existing systems &mdash; HR platforms, onboarding flows, or compliance tools. Full API documentation provided, with sandbox environment for testing.
    </p>

    <h3>Option C: Bulk Verification</h3>
    <p>
      For large volumes. Upload a batch of individuals or companies for verification. Results are processed and returned as a structured report with individual certificates for each verified entity.
    </p>

    <table>
      <thead>
        <tr>
          <th>Feature</th>
          <th>Web Dashboard</th>
          <th>REST API</th>
          <th>Bulk Upload</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Individual verification</td><td>Yes</td><td>Yes</td><td>Yes</td></tr>
        <tr><td>Supplier / corporate verification</td><td>Yes</td><td>Yes</td><td>Yes</td></tr>
        <tr><td>Real-time results</td><td>Yes</td><td>Yes</td><td>Batch (within 24h)</td></tr>
        <tr><td>Verification certificates</td><td>PDF download</td><td>JSON + PDF</td><td>ZIP package</td></tr>
        <tr><td>AML screening</td><td>Yes</td><td>Yes</td><td>Yes</td></tr>
        <tr><td>Webhook notifications</td><td>N/A</td><td>Yes</td><td>Yes</td></tr>
        <tr><td>Technical integration</td><td>None required</td><td>REST API</td><td>CSV upload</td></tr>
        <tr><td>Best for</td><td>1&ndash;10 per month</td><td>10&ndash;1,000+ per month</td><td>Large one-off batches</td></tr>
      </tbody>
    </table>
  </div>

  <!-- WHAT'S INCLUDED -->
  <div class="page">
    <h2>5. What&rsquo;s Included</h2>
    <p>
      Every verification processed through Cellion One produces structured, audit-ready output that your compliance team can rely on.
    </p>

    <h3>Verification Output</h3>
    <table>
      <thead>
        <tr>
          <th>Deliverable</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Verified Identity Certificate</strong></td>
          <td>A digitally signed PDF certificate summarising all verification checks passed, with Smile ID job references, timestamps, and a QR code linking to a verification URL for independent confirmation.</td>
        </tr>
        <tr>
          <td><strong>AML Screening Report</strong></td>
          <td>Results of sanctions, PEP, and adverse media screening for each verified individual, with clear pass/flag/fail status and source references.</td>
        </tr>
        <tr>
          <td><strong>Document Expiry Tracking</strong></td>
          <td>Automated tracking of ID document expiry dates with notifications when re-verification is needed, ensuring your records stay current.</td>
        </tr>
        <tr>
          <td><strong>Audit Trail</strong></td>
          <td>Complete, tamper-evident log of every verification action &mdash; who requested it, when it was processed, what checks were performed, and what the results were.</td>
        </tr>
        <tr>
          <td><strong>Verified Entities Registry</strong></td>
          <td>Access to your organisation&rsquo;s registry of all verified individuals and companies, with search, filtering, and status tracking.</td>
        </tr>
      </tbody>
    </table>

    <h3>For Supplier / Corporate Verification</h3>
    <p>In addition to individual identity checks, supplier verification includes:</p>
    <ul>
      <li>CAC registration status and company details</li>
      <li>Director and shareholder identification</li>
      <li>Financial standing indicators</li>
      <li>Compliance status (TIN, SCUML, regulatory filings)</li>
      <li>Consolidated corporate due diligence report</li>
    </ul>
  </div>

  <!-- PRICING -->
  <div class="page">
    <h2>6. Pricing</h2>
    <p>
      Transparent, per-verification pricing with no monthly minimums for dashboard users. API customers purchase prepaid credit packs.
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
          <td><strong>Individual Verification</strong></td>
          <td>BVN/NIN validation, document check, biometric selfie, AML screening, verified identity certificate</td>
          <td><strong>&#8358;10,000 / person</strong></td>
        </tr>
        <tr>
          <td><strong>Supplier / Corporate Verification</strong></td>
          <td>Company registration check, director/shareholder verification, financial standing, compliance status, corporate due diligence report</td>
          <td><strong>&#8358;100,000 / company</strong></td>
        </tr>
        <tr>
          <td><strong>API Credits (Prepaid)</strong></td>
          <td>Programmatic access via REST API. Minimum purchase: 10 credits. 1 credit = 1 individual verification.</td>
          <td><strong>&#8358;10,000 / credit</strong></td>
        </tr>
      </tbody>
    </table>

    <div class="highlight-box">
      <p><strong>Volume Discounts:</strong> For organisations processing 50+ verifications per month, we offer custom pricing. Contact us to discuss a tailored plan.</p>
    </div>

    <h3>What&rsquo;s Included in Every Verification</h3>
    <ul>
      <li>Full 4-step verification pipeline (BVN/NIN, document, biometric, AML)</li>
      <li>Digitally signed verification certificate (PDF)</li>
      <li>AML screening report</li>
      <li>Document expiry tracking</li>
      <li>Complete audit trail</li>
      <li>Access to your verified entities registry</li>
    </ul>
  </div>

  <!-- SECURITY & COMPLIANCE -->
  <div class="page">
    <h2>7. Security &amp; Compliance</h2>
    <p>
      Cellion One is built with enterprise-grade security from the ground up. All personal and sensitive data is protected in accordance with the Nigeria Data Protection Regulation (NDPR) and international best practices.
    </p>

    <h3>Security Measures</h3>
    <div style="margin: 12px 0;">
      <span class="security-badge">AES-256-GCM Encryption</span>
      <span class="security-badge">HTTPS/TLS</span>
      <span class="security-badge">RBAC Access Control</span>
      <span class="security-badge">Audit Logging</span>
      <span class="security-badge">Rate Limiting</span>
      <span class="security-badge">NDPR Compliant</span>
      <span class="security-badge">CSP Headers</span>
      <span class="security-badge">API Key Auth</span>
    </div>

    <table>
      <thead>
        <tr>
          <th>Area</th>
          <th>Implementation</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Encryption at Rest</strong></td>
          <td>All PII (BVN, NIN, biometric data) is encrypted with AES-256-GCM. Only last 4 digits of identity numbers are displayed in the UI.</td>
        </tr>
        <tr>
          <td><strong>Encryption in Transit</strong></td>
          <td>All API communication uses HTTPS/TLS. No unencrypted data is transmitted between client and server.</td>
        </tr>
        <tr>
          <td><strong>Access Controls</strong></td>
          <td>Role-based access control (RBAC) ensures only authorised users can access verification data. API keys are scoped per organisation.</td>
        </tr>
        <tr>
          <td><strong>Audit Trail</strong></td>
          <td>Every access to personal data is logged with accessor identity, timestamp, IP address, and action performed.</td>
        </tr>
        <tr>
          <td><strong>Data Retention</strong></td>
          <td>Verification data is retained in accordance with NDPR requirements. Customers can request data deletion at any time.</td>
        </tr>
        <tr>
          <td><strong>NDPR Compliance</strong></td>
          <td>Data processing complies with the Nigeria Data Protection Regulation. Consent is obtained before processing any personal data.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- NEXT STEPS -->
  <div class="page">
    <h2>8. Next Steps</h2>
    <p>
      We&rsquo;d love to explore how Cellion One&rsquo;s verification infrastructure can support your organisation. Here&rsquo;s how to get started:
    </p>

    <div class="flow-diagram">
      <div class="flow-step">
        <div class="flow-number">1</div>
        <div class="flow-content">
          <h4>Discovery Call</h4>
          <p>Schedule a 30-minute call to discuss your verification needs, volume expectations, and integration preferences.</p>
        </div>
      </div>
      <div class="arrow-down">&darr;</div>
      <div class="flow-step">
        <div class="flow-number">2</div>
        <div class="flow-content">
          <h4>Pilot Programme</h4>
          <p>We set up a pilot with a small batch of verifications so your team can evaluate the output quality, turnaround time, and certificate format.</p>
        </div>
      </div>
      <div class="arrow-down">&darr;</div>
      <div class="flow-step">
        <div class="flow-number">3</div>
        <div class="flow-content">
          <h4>Go Live</h4>
          <p>Once you&rsquo;re satisfied with the pilot, we finalise the partnership agreement, provision API access or dashboard accounts, and go live.</p>
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
        <tr><td>Email</td><td>service@cellionone.com</td></tr>
        <tr><td>Website</td><td>www.cellionone.com</td></tr>
        <tr><td>Partnership Enquiries</td><td>www.cellionone.com/partner-with-us</td></tr>
      </tbody>
    </table>

    <div class="highlight-box">
      <p><strong>Ready to get started?</strong> Email us at service@cellionone.com or visit our partner page to submit an enquiry. We typically respond within one business day.</p>
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
