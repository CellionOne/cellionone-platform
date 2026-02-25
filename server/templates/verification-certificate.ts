interface CertificateData {
  certificateNumber: string;
  subjectName: string;
  subjectEmail: string;
  verificationDate: string;
  expiryDate: string;
  consentDate: string;
  partnerName: string;
  checks: {
    bvnValidation: boolean;
    ninValidation: boolean;
    documentVerification: boolean;
    biometricMatch: boolean;
    amlScreening: boolean;
  };
  smileIdJobId: string | null;
  livenessScore: number | null;
  company?: {
    name: string;
    rcNumber: string | null;
    type: string | null;
    shareCapital: number | null;
    incorporationDate: string | null;
    directors: string[];
  } | null;
  verificationUrl: string;
}

export function generateVerificationCertificateHTML(data: CertificateData): string {
  const year = new Date().getFullYear();
  const generatedAt = new Date().toLocaleString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  });

  const checkIcon = `<span style="color: #16a34a; font-weight: 700; font-size: 14pt;">✓</span>`;
  const failIcon = `<span style="color: #dc2626; font-weight: 700; font-size: 14pt;">✗</span>`;

  const checkRow = (label: string, passed: boolean) => `
    <tr>
      <td style="padding: 10px 16px; border-bottom: 1px solid #e4e4e7;">${passed ? checkIcon : failIcon}</td>
      <td style="padding: 10px 16px; border-bottom: 1px solid #e4e4e7; font-weight: 500;">${label}</td>
      <td style="padding: 10px 16px; border-bottom: 1px solid #e4e4e7;">
        <span style="background: ${passed ? '#dcfce7' : '#fef2f2'}; color: ${passed ? '#166534' : '#991b1b'}; padding: 2px 10px; border-radius: 12px; font-size: 9pt; font-weight: 600;">
          ${passed ? 'PASSED' : 'FAILED'}
        </span>
      </td>
    </tr>
  `;

  const companySection = data.company ? `
    <div style="margin-top: 24px;">
      <h3 style="font-size: 13pt; color: #0f7a4d; font-weight: 600; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #d1fae5;">
        Associated Company
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 10pt;">
        <tbody>
          <tr><td style="padding: 6px 0; color: #71717a; width: 160px;">Company Name</td><td style="padding: 6px 0; font-weight: 500;">${data.company.name}</td></tr>
          ${data.company.rcNumber ? `<tr><td style="padding: 6px 0; color: #71717a;">RC Number</td><td style="padding: 6px 0; font-weight: 500;">${data.company.rcNumber}</td></tr>` : ''}
          ${data.company.type ? `<tr><td style="padding: 6px 0; color: #71717a;">Company Type</td><td style="padding: 6px 0; font-weight: 500;">${data.company.type}</td></tr>` : ''}
          ${data.company.incorporationDate ? `<tr><td style="padding: 6px 0; color: #71717a;">Date of Incorporation</td><td style="padding: 6px 0; font-weight: 500;">${data.company.incorporationDate}</td></tr>` : ''}
          ${data.company.shareCapital ? `<tr><td style="padding: 6px 0; color: #71717a;">Share Capital</td><td style="padding: 6px 0; font-weight: 500;">₦${data.company.shareCapital.toLocaleString()}</td></tr>` : ''}
          ${data.company.directors.length > 0 ? `<tr><td style="padding: 6px 0; color: #71717a; vertical-align: top;">Directors</td><td style="padding: 6px 0; font-weight: 500;">${data.company.directors.join('<br>')}</td></tr>` : ''}
        </tbody>
      </table>
    </div>
  ` : '';

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

  <div style="border: 2px solid #0f7a4d; border-radius: 12px; overflow: hidden;">

    <div style="background: linear-gradient(135deg, #0f7a4d 0%, #0d6b43 100%); padding: 28px 32px; text-align: center; color: white;">
      <div style="font-size: 24pt; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 4px;">Cellion One</div>
      <div style="font-size: 10pt; opacity: 0.85; letter-spacing: 1px; text-transform: uppercase;">Identity Verification Certificate</div>
    </div>

    <div style="padding: 32px;">

      <div style="text-align: center; margin-bottom: 24px;">
        <div style="font-size: 9pt; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Certificate Number</div>
        <div style="font-size: 14pt; font-weight: 700; color: #0f7a4d; font-family: monospace;">${data.certificateNumber}</div>
      </div>

      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <div style="text-align: center; margin-bottom: 12px;">
          <div style="font-size: 9pt; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">This certifies that</div>
          <div style="font-size: 16pt; font-weight: 700; color: #18181b; margin: 8px 0;">${data.subjectName}</div>
          <div style="font-size: 10pt; color: #52525b;">${data.subjectEmail}</div>
        </div>
        <div style="text-align: center; font-size: 10pt; color: #374151;">
          has successfully completed comprehensive identity verification through the Cellion One platform,
          powered by Smile ID.
        </div>
      </div>

      <h3 style="font-size: 13pt; color: #0f7a4d; font-weight: 600; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #d1fae5;">
        Verification Results
      </h3>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="padding: 8px 16px; text-align: left; font-size: 9pt; color: #71717a; text-transform: uppercase; width: 40px;">Status</th>
            <th style="padding: 8px 16px; text-align: left; font-size: 9pt; color: #71717a; text-transform: uppercase;">Verification Check</th>
            <th style="padding: 8px 16px; text-align: left; font-size: 9pt; color: #71717a; text-transform: uppercase; width: 100px;">Result</th>
          </tr>
        </thead>
        <tbody>
          ${checkRow('Bank Verification Number (BVN) Validation', data.checks.bvnValidation)}
          ${checkRow('National Identification Number (NIN) Validation', data.checks.ninValidation)}
          ${checkRow('Government ID Document Verification', data.checks.documentVerification)}
          ${checkRow('Biometric Selfie & Liveness Detection', data.checks.biometricMatch)}
          ${checkRow('AML & Sanctions Screening', data.checks.amlScreening)}
        </tbody>
      </table>

      <div style="display: flex; gap: 16px; margin-bottom: 20px;">
        <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px;">
          <div style="font-size: 9pt; color: #71717a;">Verification Date</div>
          <div style="font-weight: 600; font-size: 10pt;">${data.verificationDate}</div>
        </div>
        <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px;">
          <div style="font-size: 9pt; color: #71717a;">Valid Until</div>
          <div style="font-weight: 600; font-size: 10pt;">${data.expiryDate}</div>
        </div>
        ${data.smileIdJobId ? `
        <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px;">
          <div style="font-size: 9pt; color: #71717a;">Smile ID Reference</div>
          <div style="font-weight: 600; font-size: 10pt; font-family: monospace;">${data.smileIdJobId}</div>
        </div>
        ` : ''}
        ${data.livenessScore !== null ? `
        <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px;">
          <div style="font-size: 9pt; color: #71717a;">Liveness Score</div>
          <div style="font-weight: 600; font-size: 10pt;">${data.livenessScore}%</div>
        </div>
        ` : ''}
      </div>

      ${companySection}

      <div style="margin-top: 24px; padding-top: 20px; border-top: 2px solid #d1fae5;">
        <h3 style="font-size: 11pt; color: #0f7a4d; font-weight: 600; margin-bottom: 8px;">Attestation</h3>
        <p style="font-size: 9pt; color: #374151; line-height: 1.6;">
          Cellion Platforms Nigeria Limited hereby attests that the individual named above has undergone
          comprehensive identity verification through our platform. The verification was conducted using
          Smile ID's identity verification services, including BVN/NIN database validation, government-issued
          ID document verification, biometric selfie matching with liveness detection, and AML/sanctions screening.
        </p>
        <p style="font-size: 9pt; color: #374151; line-height: 1.6; margin-top: 8px;">
          This data was shared with the consent of ${data.subjectName}, granted on ${data.consentDate},
          for the purpose of verification by ${data.partnerName}.
        </p>
      </div>

      <div style="margin-top: 20px; padding: 12px 16px; background: #fafafa; border: 1px solid #e4e4e7; border-radius: 6px; text-align: center;">
        <p style="font-size: 9pt; color: #71717a; margin-bottom: 4px;">Verify this certificate online:</p>
        <p style="font-size: 10pt; color: #0f7a4d; font-weight: 600; word-break: break-all;">${data.verificationUrl}</p>
      </div>

      <div style="margin-top: 20px; text-align: center;">
        <p style="font-size: 8pt; color: #a1a1aa;">
          This certificate was generated digitally on ${generatedAt} and does not require a physical signature.
        </p>
        <p style="font-size: 8pt; color: #a1a1aa; margin-top: 4px;">
          &copy; ${year} Cellion Platforms Nigeria Limited. All rights reserved.
        </p>
      </div>

    </div>
  </div>

</body>
</html>
  `;
}
