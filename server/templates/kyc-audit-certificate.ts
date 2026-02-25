interface KycAuditCertificateData {
  certificateNumber: string;
  type: "individual" | "supplier";
  orgName: string;
  orgCategory: string;
  verificationDate: string;
  issuedDate: string;
  verificationUrl: string;

  individual?: {
    subjectName: string;
    subjectEmail: string;
    smileIdChecks?: {
      bvnValidation: boolean;
      ninValidation: boolean;
      documentVerification: boolean;
      biometricMatch: boolean;
      amlScreening: boolean;
    };
    smileIdJobId?: string | null;
    livenessScore?: number | null;
  };

  supplier?: {
    companyName: string;
    rcNumber: string | null;
    tinNumber: string | null;
    vatRegistered: boolean;
    yearEstablished: number | null;
    industryCategory: string | null;
    headOfficeAddress: string | null;
    contactPersonName: string;
    contactPersonEmail: string;
  };

  documents: {
    name: string;
    category: string;
    status: string;
    expiryDate: string | null;
    reviewedAt: string | null;
  }[];

  directors?: {
    fullName: string;
    role: string;
    verificationStatus: string;
  }[];

  riskScore: string | null;
  reviewNotes: string | null;
  reviewedBy: string | null;
}

function riskScoreLabel(score: string | null): { label: string; color: string; bg: string } {
  switch (score) {
    case "green": return { label: "LOW RISK", color: "#166534", bg: "#dcfce7" };
    case "amber": return { label: "MEDIUM RISK", color: "#92400e", bg: "#fef3c7" };
    case "red": return { label: "HIGH RISK", color: "#991b1b", bg: "#fef2f2" };
    default: return { label: "NOT ASSESSED", color: "#71717a", bg: "#f4f4f5" };
  }
}

function docStatusBadge(status: string): string {
  const colors: Record<string, { color: string; bg: string }> = {
    accepted: { color: "#166534", bg: "#dcfce7" },
    rejected: { color: "#991b1b", bg: "#fef2f2" },
    uploaded: { color: "#1e40af", bg: "#dbeafe" },
    processing: { color: "#92400e", bg: "#fef3c7" },
    extracted: { color: "#6d28d9", bg: "#ede9fe" },
  };
  const c = colors[status] || { color: "#71717a", bg: "#f4f4f5" };
  return `<span style="background:${c.bg};color:${c.color};padding:2px 10px;border-radius:12px;font-size:9pt;font-weight:600;text-transform:uppercase;">${status}</span>`;
}

function verificationStatusBadge(status: string): string {
  const colors: Record<string, { color: string; bg: string }> = {
    verified: { color: "#166534", bg: "#dcfce7" },
    failed: { color: "#991b1b", bg: "#fef2f2" },
    in_progress: { color: "#92400e", bg: "#fef3c7" },
    pending: { color: "#1e40af", bg: "#dbeafe" },
    not_required: { color: "#71717a", bg: "#f4f4f5" },
  };
  const c = colors[status] || { color: "#71717a", bg: "#f4f4f5" };
  const label = status.replace(/_/g, " ");
  return `<span style="background:${c.bg};color:${c.color};padding:2px 10px;border-radius:12px;font-size:9pt;font-weight:600;text-transform:uppercase;">${label}</span>`;
}

export function generateKycAuditCertificateHTML(data: KycAuditCertificateData): string {
  const year = new Date().getFullYear();
  const generatedAt = new Date().toLocaleString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });

  const isIndividual = data.type === "individual";
  const title = isIndividual ? "Employee Verification Certificate" : "Supplier Due Diligence Certificate";
  const subjectName = isIndividual
    ? data.individual?.subjectName || "Unknown"
    : data.supplier?.companyName || "Unknown";
  const subjectEmail = isIndividual
    ? data.individual?.subjectEmail || ""
    : data.supplier?.contactPersonEmail || "";

  const risk = riskScoreLabel(data.riskScore);

  const checkIcon = `<span style="color:#16a34a;font-weight:700;font-size:14pt;">&#10003;</span>`;
  const failIcon = `<span style="color:#dc2626;font-weight:700;font-size:14pt;">&#10007;</span>`;

  const checkRow = (label: string, passed: boolean) => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #e4e4e7;">${passed ? checkIcon : failIcon}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #e4e4e7;font-weight:500;">${label}</td>
      <td style="padding:10px 16px;border-bottom:1px solid #e4e4e7;">
        <span style="background:${passed ? "#dcfce7" : "#fef2f2"};color:${passed ? "#166534" : "#991b1b"};padding:2px 10px;border-radius:12px;font-size:9pt;font-weight:600;">
          ${passed ? "PASSED" : "FAILED"}
        </span>
      </td>
    </tr>
  `;

  const smileIdSection = isIndividual && data.individual?.smileIdChecks ? `
    <div style="margin-top:24px;">
      <h3 style="font-size:13pt;color:#0f7a4d;font-weight:600;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #d1fae5;">
        Identity Verification Results (Smile ID)
      </h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:8px 16px;text-align:left;font-size:9pt;color:#71717a;text-transform:uppercase;width:40px;">Status</th>
            <th style="padding:8px 16px;text-align:left;font-size:9pt;color:#71717a;text-transform:uppercase;">Verification Check</th>
            <th style="padding:8px 16px;text-align:left;font-size:9pt;color:#71717a;text-transform:uppercase;width:100px;">Result</th>
          </tr>
        </thead>
        <tbody>
          ${checkRow("Bank Verification Number (BVN) Validation", data.individual.smileIdChecks.bvnValidation)}
          ${checkRow("National Identification Number (NIN) Validation", data.individual.smileIdChecks.ninValidation)}
          ${checkRow("Government ID Document Verification", data.individual.smileIdChecks.documentVerification)}
          ${checkRow("Biometric Selfie & Liveness Detection", data.individual.smileIdChecks.biometricMatch)}
          ${checkRow("AML & Sanctions Screening", data.individual.smileIdChecks.amlScreening)}
        </tbody>
      </table>
      ${data.individual.smileIdJobId ? `
        <div style="display:flex;gap:16px;margin-bottom:16px;">
          <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
            <div style="font-size:9pt;color:#71717a;">Smile ID Reference</div>
            <div style="font-weight:600;font-size:10pt;font-family:monospace;">${data.individual.smileIdJobId}</div>
          </div>
          ${data.individual.livenessScore !== null && data.individual.livenessScore !== undefined ? `
          <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
            <div style="font-size:9pt;color:#71717a;">Liveness Score</div>
            <div style="font-weight:600;font-size:10pt;">${data.individual.livenessScore}%</div>
          </div>
          ` : ""}
        </div>
      ` : ""}
    </div>
  ` : "";

  const supplierProfileSection = !isIndividual && data.supplier ? `
    <div style="margin-top:24px;">
      <h3 style="font-size:13pt;color:#0f7a4d;font-weight:600;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #d1fae5;">
        Company Information
      </h3>
      <table style="width:100%;border-collapse:collapse;font-size:10pt;">
        <tbody>
          <tr><td style="padding:6px 0;color:#71717a;width:180px;">Company Name</td><td style="padding:6px 0;font-weight:500;">${data.supplier.companyName}</td></tr>
          ${data.supplier.rcNumber ? `<tr><td style="padding:6px 0;color:#71717a;">RC Number</td><td style="padding:6px 0;font-weight:500;">${data.supplier.rcNumber}</td></tr>` : ""}
          ${data.supplier.tinNumber ? `<tr><td style="padding:6px 0;color:#71717a;">TIN Number</td><td style="padding:6px 0;font-weight:500;">${data.supplier.tinNumber}</td></tr>` : ""}
          <tr><td style="padding:6px 0;color:#71717a;">VAT Registered</td><td style="padding:6px 0;font-weight:500;">${data.supplier.vatRegistered ? "Yes" : "No"}</td></tr>
          ${data.supplier.yearEstablished ? `<tr><td style="padding:6px 0;color:#71717a;">Year Established</td><td style="padding:6px 0;font-weight:500;">${data.supplier.yearEstablished}</td></tr>` : ""}
          ${data.supplier.industryCategory ? `<tr><td style="padding:6px 0;color:#71717a;">Industry</td><td style="padding:6px 0;font-weight:500;">${data.supplier.industryCategory}</td></tr>` : ""}
          ${data.supplier.headOfficeAddress ? `<tr><td style="padding:6px 0;color:#71717a;">Head Office Address</td><td style="padding:6px 0;font-weight:500;">${data.supplier.headOfficeAddress}</td></tr>` : ""}
          <tr><td style="padding:6px 0;color:#71717a;">Contact Person</td><td style="padding:6px 0;font-weight:500;">${data.supplier.contactPersonName} (${data.supplier.contactPersonEmail})</td></tr>
        </tbody>
      </table>
    </div>
  ` : "";

  const documentsSection = data.documents.length > 0 ? `
    <div style="margin-top:24px;">
      <h3 style="font-size:13pt;color:#0f7a4d;font-weight:600;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #d1fae5;">
        Documents Reviewed
      </h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:8px 16px;text-align:left;font-size:9pt;color:#71717a;text-transform:uppercase;">Document</th>
            <th style="padding:8px 16px;text-align:left;font-size:9pt;color:#71717a;text-transform:uppercase;">Category</th>
            <th style="padding:8px 16px;text-align:left;font-size:9pt;color:#71717a;text-transform:uppercase;">Status</th>
            <th style="padding:8px 16px;text-align:left;font-size:9pt;color:#71717a;text-transform:uppercase;">Expiry</th>
          </tr>
        </thead>
        <tbody>
          ${data.documents.map(doc => `
            <tr>
              <td style="padding:10px 16px;border-bottom:1px solid #e4e4e7;font-weight:500;">${doc.name}</td>
              <td style="padding:10px 16px;border-bottom:1px solid #e4e4e7;text-transform:capitalize;">${doc.category}</td>
              <td style="padding:10px 16px;border-bottom:1px solid #e4e4e7;">${docStatusBadge(doc.status)}</td>
              <td style="padding:10px 16px;border-bottom:1px solid #e4e4e7;">${doc.expiryDate || "N/A"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  ` : "";

  const directorsSection = !isIndividual && data.directors && data.directors.length > 0 ? `
    <div style="margin-top:24px;">
      <h3 style="font-size:13pt;color:#0f7a4d;font-weight:600;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #d1fae5;">
        Director / Significant Person Verification Summary
      </h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:8px 16px;text-align:left;font-size:9pt;color:#71717a;text-transform:uppercase;">Name</th>
            <th style="padding:8px 16px;text-align:left;font-size:9pt;color:#71717a;text-transform:uppercase;">Role</th>
            <th style="padding:8px 16px;text-align:left;font-size:9pt;color:#71717a;text-transform:uppercase;">Verification Status</th>
          </tr>
        </thead>
        <tbody>
          ${data.directors.map(d => `
            <tr>
              <td style="padding:10px 16px;border-bottom:1px solid #e4e4e7;font-weight:500;">${d.fullName}</td>
              <td style="padding:10px 16px;border-bottom:1px solid #e4e4e7;text-transform:capitalize;">${d.role.replace(/_/g, " ")}</td>
              <td style="padding:10px 16px;border-bottom:1px solid #e4e4e7;">${verificationStatusBadge(d.verificationStatus)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  ` : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4; margin: 40px 50px; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #1a1a1a;
      line-height: 1.6;
      font-size: 10pt;
    }
  </style>
</head>
<body>

  <div style="border:2px solid #0f7a4d;border-radius:12px;overflow:hidden;">

    <div style="background:linear-gradient(135deg, #0f7a4d 0%, #0d6b43 100%);padding:28px 32px;text-align:center;color:white;">
      <div style="font-size:24pt;font-weight:800;letter-spacing:-0.5px;margin-bottom:4px;">Cellion One</div>
      <div style="font-size:10pt;opacity:0.85;letter-spacing:1px;text-transform:uppercase;">${title}</div>
    </div>

    <div style="padding:32px;">

      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:9pt;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;">Certificate Number</div>
        <div style="font-size:14pt;font-weight:700;color:#0f7a4d;font-family:monospace;">${data.certificateNumber}</div>
      </div>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin-bottom:24px;">
        <div style="text-align:center;margin-bottom:12px;">
          <div style="font-size:9pt;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;">This certifies that</div>
          <div style="font-size:16pt;font-weight:700;color:#18181b;margin:8px 0;">${subjectName}</div>
          ${subjectEmail ? `<div style="font-size:10pt;color:#52525b;">${subjectEmail}</div>` : ""}
        </div>
        <div style="text-align:center;font-size:10pt;color:#374151;">
          ${isIndividual
            ? `has successfully completed comprehensive identity verification through the Cellion One platform, as requested by <strong>${data.orgName}</strong>.`
            : `has successfully completed supplier due diligence verification through the Cellion One platform, as requested by <strong>${data.orgName}</strong>.`
          }
        </div>
      </div>

      <div style="display:flex;gap:16px;margin-bottom:24px;">
        <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
          <div style="font-size:9pt;color:#71717a;">Requesting Organisation</div>
          <div style="font-weight:600;font-size:10pt;">${data.orgName}</div>
          <div style="font-size:9pt;color:#71717a;text-transform:capitalize;">${data.orgCategory}</div>
        </div>
        <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
          <div style="font-size:9pt;color:#71717a;">Verification Date</div>
          <div style="font-weight:600;font-size:10pt;">${data.verificationDate}</div>
        </div>
        <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
          <div style="font-size:9pt;color:#71717a;">Risk Assessment</div>
          <div style="font-weight:600;font-size:10pt;">
            <span style="background:${risk.bg};color:${risk.color};padding:2px 10px;border-radius:12px;font-size:9pt;font-weight:600;">${risk.label}</span>
          </div>
        </div>
      </div>

      ${smileIdSection}
      ${supplierProfileSection}
      ${documentsSection}
      ${directorsSection}

      ${data.reviewNotes ? `
      <div style="margin-top:24px;">
        <h3 style="font-size:13pt;color:#0f7a4d;font-weight:600;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #d1fae5;">
          Reviewer Notes
        </h3>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px;font-size:10pt;color:#374151;">
          ${data.reviewNotes}
        </div>
      </div>
      ` : ""}

      <div style="margin-top:24px;padding-top:20px;border-top:2px solid #d1fae5;">
        <h3 style="font-size:11pt;color:#0f7a4d;font-weight:600;margin-bottom:8px;">Attestation</h3>
        <p style="font-size:9pt;color:#374151;line-height:1.6;">
          ${isIndividual
            ? `Cellion Platforms Nigeria Limited hereby attests that the individual named above has undergone
              comprehensive identity verification through our platform, as requested by ${data.orgName}.
              The verification was conducted using Smile ID's identity verification services, including
              BVN/NIN database validation, government-issued ID document verification, biometric selfie
              matching with liveness detection, and AML/sanctions screening. All submitted documents have
              been reviewed and assessed by the requesting organisation's verification team.`
            : `Cellion Platforms Nigeria Limited hereby attests that the company named above has undergone
              comprehensive supplier due diligence verification through our platform, as requested by
              ${data.orgName}. The verification included review of corporate registration documents,
              tax compliance certificates, financial documents, and identity verification of directors
              and significant persons where required. All submitted documents have been reviewed and
              assessed by the requesting organisation's verification team.`
          }
        </p>
        <p style="font-size:9pt;color:#374151;line-height:1.6;margin-top:8px;">
          This certificate is issued for the compliance records of ${data.orgName} and should not be relied
          upon by third parties without independent verification. Cellion One acts as a technology platform
          facilitating the verification process and is not a verification authority.
        </p>
      </div>

      <div style="margin-top:20px;padding:12px 16px;background:#fafafa;border:1px solid #e4e4e7;border-radius:6px;text-align:center;">
        <p style="font-size:9pt;color:#71717a;margin-bottom:4px;">Verify this certificate online:</p>
        <p style="font-size:10pt;color:#0f7a4d;font-weight:600;word-break:break-all;">${data.verificationUrl}</p>
      </div>

      <div style="margin-top:20px;text-align:center;">
        <p style="font-size:8pt;color:#a1a1aa;">
          This certificate was generated digitally on ${generatedAt} and does not require a physical signature.
        </p>
        <p style="font-size:8pt;color:#a1a1aa;margin-top:4px;">
          &copy; ${year} Cellion Platforms Nigeria Limited. All rights reserved.
        </p>
      </div>

    </div>
  </div>

</body>
</html>
  `;
}
