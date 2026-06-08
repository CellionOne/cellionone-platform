import { generatePdf } from "./pdfService";
import type { CompanyApplication, CompanyPerson } from "@shared/schema";

// Shared CAC document styling — white background, Times New Roman for official look
const PAGE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #000; background: #fff; padding: 40px 50px; }
  h1 { font-size: 14pt; font-weight: bold; text-align: center; text-transform: uppercase; margin-bottom: 6px; }
  h2 { font-size: 12pt; font-weight: bold; margin: 18px 0 6px; }
  .subtitle { font-size: 11pt; text-align: center; margin-bottom: 4px; }
  .ref { font-size: 9pt; text-align: center; color: #555; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  th, td { border: 1px solid #000; padding: 5px 8px; vertical-align: top; }
  th { background: #f0f0f0; font-weight: bold; font-size: 10pt; }
  .section { margin-top: 18px; }
  .label { font-weight: bold; }
  .field-row { margin: 6px 0; }
  .sig-block { margin-top: 40px; }
  .sig-line { border-top: 1px solid #000; margin-top: 40px; width: 60%; display: inline-block; }
  .sig-label { font-size: 9pt; margin-top: 3px; }
  .declaration { border: 1px solid #000; padding: 12px; margin: 14px 0; background: #fafafa; font-size: 10pt; line-height: 1.6; }
  .footer { margin-top: 40px; font-size: 9pt; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 8px; }
  .page-break { page-break-after: always; }
  .no-break { page-break-inside: avoid; }
  @page { size: A4; margin: 20mm 15mm; }
`;

function wrap(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${PAGE_CSS}</style></head><body>${body}</body></html>`;
}

function fmtAddress(addr: any): string {
  if (!addr) return "—";
  return [addr.line1, addr.line2, addr.city, addr.state, addr.postalCode, addr.country]
    .filter(Boolean).join(", ");
}

function fmtDate(d?: string | Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

// ── C1: Statement of Compliance ────────────────────────────────────────────
export async function generateStatementOfCompliance(app: CompanyApplication, people: CompanyPerson[]): Promise<Buffer> {
  const companyName = app.companyName1 || "the Company";
  const directors = people.filter(p => p.role === "director" || p.role === "director_shareholder");
  const regAddr = fmtAddress(app.registeredAddress);

  const body = `
    <h1>Statement of Compliance</h1>
    <p class="subtitle">Pursuant to Section 35 of the Companies and Allied Matters Act (CAMA) 2020</p>
    <p class="ref">Corporate Affairs Commission — Nigeria</p>

    <div class="section">
      <div class="field-row"><span class="label">Company Name:</span> ${companyName}</div>
      <div class="field-row"><span class="label">Company Type:</span> ${app.companyType || "Private Limited Company"}</div>
      <div class="field-row"><span class="label">Registered Address:</span> ${regAddr}</div>
    </div>

    <div class="section">
      <h2>1. Compliance Statement</h2>
      <div class="declaration">
        I, the undersigned, being a person named in the memorandum of association of <strong>${companyName}</strong>,
        hereby declare that all the requirements of the Companies and Allied Matters Act (CAMA) 2020
        and the regulations made thereunder in respect of matters precedent to and incidental to the registration
        of this company have been complied with.
      </div>
    </div>

    <div class="section">
      <h2>2. Declarant(s)</h2>
      <table>
        <thead>
          <tr><th>#</th><th>Full Name</th><th>Role</th><th>Nationality</th><th>Residential Address</th></tr>
        </thead>
        <tbody>
          ${directors.map((d, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${d.fullName || "—"}</td>
              <td>${d.role || "Director"}</td>
              <td>${d.nationality || "—"}</td>
              <td>${d.residentialAddress || "—"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>3. Business Activities</h2>
      <p>${(Array.isArray(app.selectedActivities) ? app.selectedActivities.join("; ") : app.businessDescription) || "—"}</p>
    </div>

    <div class="sig-block no-break">
      <p>Declared at __________________________________ this ________ day of __________________, 20____</p>
      <br/><br/>
      <div style="display:flex; gap:80px; flex-wrap:wrap;">
        ${directors.map(d => `
          <div style="margin-top:20px;">
            <div class="sig-line"></div>
            <div class="sig-label">${d.fullName || "Director"}</div>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="sig-block no-break" style="margin-top:40px;">
      <p><strong>Witness / Solicitor:</strong></p>
      <br/>
      <div class="sig-line"></div>
      <div class="sig-label">Signature of Solicitor / Notary</div>
      <div class="field-row" style="margin-top:8px;"><span class="label">Name:</span> ___________________________________</div>
      <div class="field-row"><span class="label">Address:</span> ___________________________________</div>
    </div>

    <div class="footer">Generated by Cellion One Registration Platform — ${fmtDate(new Date())}</div>
  `;
  return generatePdf(wrap("Statement of Compliance", body));
}

// ── C2: Statement of Capital ───────────────────────────────────────────────
export async function generateStatementOfCapital(app: CompanyApplication, people: CompanyPerson[]): Promise<Buffer> {
  const companyName = app.companyName1 || "the Company";
  const shareholders = people.filter(p => p.role === "shareholder" || p.role === "director_shareholder");
  const totalShares = shareholders.reduce((s, p) => s + (p.sharesAllocated || 0), 0);

  // Group by share class
  const shareClasses: Record<string, { total: number; holders: CompanyPerson[] }> = {};
  for (const sh of shareholders) {
    const cls = sh.shareClass || "Ordinary";
    if (!shareClasses[cls]) shareClasses[cls] = { total: 0, holders: [] };
    shareClasses[cls].total += sh.sharesAllocated || 0;
    shareClasses[cls].holders.push(sh);
  }

  const body = `
    <h1>Statement of Capital and Initial Shareholdings</h1>
    <p class="subtitle">Pursuant to the Companies and Allied Matters Act (CAMA) 2020</p>
    <p class="ref">Corporate Affairs Commission — Nigeria</p>

    <div class="section">
      <div class="field-row"><span class="label">Company Name:</span> ${companyName}</div>
      <div class="field-row"><span class="label">Company Type:</span> ${app.companyType || "Private Limited Company"}</div>
      <div class="field-row"><span class="label">Total Shares Issued:</span> ${totalShares.toLocaleString()}</div>
    </div>

    <div class="section">
      <h2>1. Share Classes</h2>
      <table>
        <thead>
          <tr><th>Share Class</th><th>Total Shares</th><th>% of Capital</th></tr>
        </thead>
        <tbody>
          ${Object.entries(shareClasses).map(([cls, info]) => `
            <tr>
              <td>${cls}</td>
              <td>${info.total.toLocaleString()}</td>
              <td>${totalShares ? ((info.total / totalShares) * 100).toFixed(2) + "%" : "—"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>2. Initial Shareholders</h2>
      <table>
        <thead>
          <tr><th>#</th><th>Name</th><th>Nationality</th><th>Share Class</th><th>Shares</th><th>%</th><th>Address</th></tr>
        </thead>
        <tbody>
          ${shareholders.map((s, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${s.fullName || s.corporateName || "—"}</td>
              <td>${s.nationality || s.corporateCountry || "—"}</td>
              <td>${s.shareClass || "Ordinary"}</td>
              <td>${(s.sharesAllocated || 0).toLocaleString()}</td>
              <td>${s.sharePercentage || (totalShares ? (((s.sharesAllocated || 0) / totalShares) * 100).toFixed(2) + "%" : "—")}</td>
              <td>${s.residentialAddress || "—"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    <div class="sig-block no-break" style="margin-top:30px;">
      <p>Dated this ________ day of __________________, 20____</p>
      <br/><br/>
      <div class="sig-line"></div>
      <div class="sig-label">Authorised Signatory</div>
    </div>

    <div class="footer">Generated by Cellion One Registration Platform — ${fmtDate(new Date())}</div>
  `;
  return generatePdf(wrap("Statement of Capital", body));
}

// ── C3: Director Consent to Act ───────────────────────────────────────────
export async function generateDirectorConsentToAct(app: CompanyApplication, people: CompanyPerson[]): Promise<Buffer> {
  const companyName = app.companyName1 || "the Company";
  const directors = people.filter(p => p.role === "director" || p.role === "director_shareholder");

  const consentPages = directors.map((d, i) => `
    <div class="${i < directors.length - 1 ? "page-break" : ""}">
      <h1>Consent to Act as Director</h1>
      <p class="subtitle">Pursuant to Section 275 of the Companies and Allied Matters Act (CAMA) 2020</p>
      <p class="ref">Corporate Affairs Commission — Nigeria</p>

      <div class="section">
        <div class="field-row"><span class="label">Company Name:</span> ${companyName}</div>
        <div class="field-row"><span class="label">Company Type:</span> ${app.companyType || "Private Limited Company"}</div>
      </div>

      <div class="section">
        <h2>Director Details</h2>
        <div class="field-row"><span class="label">Full Name:</span> ${d.fullName || "—"}</div>
        <div class="field-row"><span class="label">Date of Birth:</span> ${d.dateOfBirth ? fmtDate(d.dateOfBirth) : "—"}</div>
        <div class="field-row"><span class="label">Nationality:</span> ${d.nationality || "—"}</div>
        <div class="field-row"><span class="label">Residential Address:</span> ${d.residentialAddress || "—"}</div>
        <div class="field-row"><span class="label">Phone Number:</span> ${d.phoneNumber || "—"}</div>
      </div>

      <div class="section">
        <h2>Consent Statement</h2>
        <div class="declaration">
          I, <strong>${d.fullName || "___________________"}</strong>, hereby consent to act as a Director of
          <strong>${companyName}</strong> and confirm that:<br/><br/>
          (a) I am not disqualified from acting as a director under the Companies and Allied Matters Act (CAMA) 2020;<br/>
          (b) I have not been convicted of any offence involving fraud or dishonesty;<br/>
          (c) I am of full legal capacity and am at least 18 years of age;<br/>
          (d) I will faithfully discharge my duties as Director in accordance with the provisions of CAMA 2020 and the Articles of Association of the Company.
        </div>
      </div>

      <div class="sig-block no-break" style="margin-top:40px;">
        <p>Signed this ________ day of __________________, 20____</p>
        <br/><br/>
        <div class="sig-line"></div>
        <div class="sig-label">${d.fullName || "Director"} (Signature)</div>
      </div>

      <div class="sig-block no-break" style="margin-top:30px;">
        <p><strong>Witness:</strong></p>
        <br/>
        <div class="sig-line"></div>
        <div class="sig-label">Witness Signature</div>
        <div class="field-row" style="margin-top:8px;"><span class="label">Witness Name:</span> ___________________________________</div>
        <div class="field-row"><span class="label">Witness Address:</span> ___________________________________</div>
      </div>
    </div>
  `).join("");

  return generatePdf(wrap("Director Consent to Act", consentPages));
}

// ── C4: Board Resolution ──────────────────────────────────────────────────
export async function generateBoardResolution(app: CompanyApplication, people: CompanyPerson[]): Promise<Buffer> {
  const companyName = app.companyName1 || "the Company";
  const directors = people.filter(p => p.role === "director" || p.role === "director_shareholder");

  const body = `
    <h1>Board Resolution</h1>
    <p class="subtitle">Resolution of the Board of Directors of <strong>${companyName}</strong></p>
    <p class="ref">Corporate Affairs Commission Registration — Nigeria</p>

    <div class="section">
      <div class="field-row"><span class="label">Company Name:</span> ${companyName}</div>
      <div class="field-row"><span class="label">Company Type:</span> ${app.companyType || "Private Limited Company"}</div>
      <div class="field-row"><span class="label">Registered Address:</span> ${fmtAddress(app.registeredAddress)}</div>
      <div class="field-row"><span class="label">Date of Meeting:</span> ___________________________________</div>
    </div>

    <div class="section">
      <h2>Directors Present</h2>
      <table>
        <thead>
          <tr><th>#</th><th>Full Name</th><th>Role</th></tr>
        </thead>
        <tbody>
          ${directors.map((d, i) => `<tr><td>${i + 1}</td><td>${d.fullName || "—"}</td><td>${d.role || "Director"}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Resolutions Passed</h2>
      <div class="declaration">
        IT WAS RESOLVED UNANIMOUSLY that:<br/><br/>
        1. The Company be incorporated with the name <strong>"${companyName}"</strong> under the Companies and Allied Matters Act (CAMA) 2020.<br/><br/>
        2. The registered office of the Company shall be situated at: <strong>${fmtAddress(app.registeredAddress)}</strong><br/><br/>
        3. The persons named in this resolution be appointed as the initial directors of the Company.<br/><br/>
        4. The memorandum and articles of association tabled at this meeting be and are hereby approved and adopted as the constitutional documents of the Company.<br/><br/>
        5. Any director or the company's solicitor be and is hereby authorised to take all steps necessary to effect the incorporation of the Company including signing and filing all necessary documents with the Corporate Affairs Commission.
      </div>
    </div>

    <div class="sig-block no-break" style="margin-top:30px;">
      <p>PASSED as a written resolution on ________ day of __________________, 20____</p>
      <br/>
      <div style="display:flex; gap:80px; flex-wrap:wrap; margin-top:20px;">
        ${directors.map(d => `
          <div style="margin-top:20px; min-width:200px;">
            <div class="sig-line"></div>
            <div class="sig-label">${d.fullName || "Director"}</div>
            <div class="sig-label" style="margin-top:2px;">Director</div>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="footer">Generated by Cellion One Registration Platform — ${fmtDate(new Date())}</div>
  `;
  return generatePdf(wrap("Board Resolution", body));
}

// ── C5: Specimen Signature Card ───────────────────────────────────────────
export async function generateSpecimenSignatureCard(app: CompanyApplication, people: CompanyPerson[]): Promise<Buffer> {
  const companyName = app.companyName1 || "the Company";
  const directors = people.filter(p => p.role === "director" || p.role === "director_shareholder");

  const cards = directors.map((d, i) => `
    <div class="no-break" style="border:1px solid #000; padding:20px; margin-bottom:20px; ${i > 0 && i % 3 === 0 ? "page-break-before:always;" : ""}">
      <div style="text-align:center; font-weight:bold; font-size:12pt; margin-bottom:12px; text-transform:uppercase; letter-spacing:1px;">
        Specimen Signature Card
      </div>
      <div style="font-size:9pt; text-align:center; margin-bottom:10px;">Corporate Affairs Commission — ${companyName}</div>
      <table style="font-size:10pt;">
        <tr><td style="width:35%; border:none; font-weight:bold;">Full Name:</td><td style="border:none;">${d.fullName || "—"}</td></tr>
        <tr><td style="border:none; font-weight:bold;">Date of Birth:</td><td style="border:none;">${d.dateOfBirth ? fmtDate(d.dateOfBirth) : "—"}</td></tr>
        <tr><td style="border:none; font-weight:bold;">Nationality:</td><td style="border:none;">${d.nationality || "—"}</td></tr>
        <tr><td style="border:none; font-weight:bold;">Role:</td><td style="border:none;">${d.role || "Director"}</td></tr>
        <tr><td style="border:none; font-weight:bold;">Address:</td><td style="border:none;">${d.residentialAddress || "—"}</td></tr>
      </table>
      <div style="margin-top:18px; font-weight:bold; font-size:10pt;">Specimen Signature:</div>
      <div style="height:70px; border:1px solid #999; margin-top:6px; background:#fff;"></div>
      <div style="margin-top:6px; font-size:9pt; color:#555;">Please sign clearly within the box above</div>
      <div style="margin-top:12px; font-size:9pt;">Date: _________________________</div>
    </div>
  `).join("");

  const body = `
    <h1>Specimen Signature Cards</h1>
    <p class="subtitle">For CAC Registration — ${companyName}</p>
    <div style="margin-top:20px;">${cards}</div>
    <div class="footer">Generated by Cellion One Registration Platform — ${fmtDate(new Date())}</div>
  `;
  return generatePdf(wrap("Specimen Signature Cards", body));
}

// ── C6: Share Certificate ─────────────────────────────────────────────────
export async function generateShareCertificate(app: CompanyApplication, people: CompanyPerson[]): Promise<Buffer> {
  const companyName = app.companyName1 || "the Company";
  const shareholders = people.filter(p => p.role === "shareholder" || p.role === "director_shareholder");
  const rcNumber = app.rcNumber || "PENDING";

  const certificates = shareholders.map((s, i) => `
    <div class="${i < shareholders.length - 1 ? "page-break" : ""} no-break">
      <div style="border:3px double #000; padding:30px; text-align:center;">
        <div style="font-size:9pt; letter-spacing:2px; text-transform:uppercase; margin-bottom:4px;">Certificate No. ${String(i + 1).padStart(4, "0")}</div>
        <h1 style="font-size:16pt; letter-spacing:1px;">${companyName}</h1>
        <p style="font-size:10pt; margin:4px 0;">RC Number: <strong>${rcNumber}</strong></p>
        <p style="font-size:10pt; margin:4px 0;">Incorporated under the Companies and Allied Matters Act (CAMA) 2020</p>
        <div style="border-top:1px solid #000; border-bottom:1px solid #000; padding:12px 0; margin:20px 0;">
          <p style="font-size:11pt;">Share Certificate</p>
        </div>
        <p style="font-size:11pt; margin:10px 0;">THIS IS TO CERTIFY that</p>
        <p style="font-size:13pt; font-weight:bold; margin:8px 0;">${s.fullName || s.corporateName || "—"}</p>
        <p style="font-size:10pt; margin:4px 0;">${s.residentialAddress || "—"}</p>
        <p style="font-size:11pt; margin:14px 0;">
          is the registered holder of
          <strong>${(s.sharesAllocated || 0).toLocaleString()} ${s.shareClass || "Ordinary"} Share${(s.sharesAllocated || 0) !== 1 ? "s" : ""}</strong>
          of ₦1.00 each, fully paid, in the above-named Company.
        </p>
        <p style="font-size:10pt; margin:4px 0;">Share Percentage: ${s.sharePercentage || "—"}</p>

        <div style="display:flex; justify-content:space-between; margin-top:40px; padding:0 30px; text-align:left;">
          <div style="min-width:200px;">
            <div style="border-top:1px solid #000; padding-top:4px; font-size:9pt;">Director / Authorised Signatory</div>
          </div>
          <div style="font-size:9pt; color:#666;">Issued: _______________</div>
          <div style="min-width:200px;">
            <div style="border-top:1px solid #000; padding-top:4px; font-size:9pt;">Director / Company Secretary</div>
          </div>
        </div>
      </div>
    </div>
  `).join("");

  return generatePdf(wrap("Share Certificates", certificates));
}

export type CacDocType =
  | "statement_of_compliance"
  | "statement_of_capital"
  | "director_consent"
  | "board_resolution"
  | "specimen_signatures"
  | "share_certificates";

export const CAC_DOC_LABELS: Record<CacDocType, string> = {
  statement_of_compliance: "Statement of Compliance",
  statement_of_capital: "Statement of Capital & Shareholdings",
  director_consent: "Director Consent to Act",
  board_resolution: "Board Resolution",
  specimen_signatures: "Specimen Signature Cards",
  share_certificates: "Share Certificates",
};

export async function generateCacDocument(
  docType: CacDocType,
  app: CompanyApplication,
  people: CompanyPerson[]
): Promise<Buffer> {
  switch (docType) {
    case "statement_of_compliance": return generateStatementOfCompliance(app, people);
    case "statement_of_capital":    return generateStatementOfCapital(app, people);
    case "director_consent":        return generateDirectorConsentToAct(app, people);
    case "board_resolution":        return generateBoardResolution(app, people);
    case "specimen_signatures":     return generateSpecimenSignatureCard(app, people);
    case "share_certificates":      return generateShareCertificate(app, people);
    default:
      throw new Error(`Unknown CAC document type: ${docType}`);
  }
}
