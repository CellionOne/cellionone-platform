import type { Express, Request, Response } from "express";
import PDFDocument from "pdfkit";

// ─── Brand constants ────────────────────────────────────────────────────────

const BRAND_GREEN = "#1a7a4a";
const BRAND_DARK = "#0f1f14";
const LIGHT_GREY = "#f5f7f5";
const BORDER_GREY = "#d1dbd5";
const TEXT_MUTED = "#6b7280";
const TEXT_DARK = "#111827";
const CODE_BG = "#1a1a2e";
const CODE_FG = "#e2e8f0";

// ─── PDF helper utilities ────────────────────────────────────────────────────

function writeHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  doc.rect(0, 0, doc.page.width, 90).fill(BRAND_DARK);
  doc.fill("#ffffff").fontSize(20).font("Helvetica-Bold")
    .text("CELLION ONE", 40, 28, { lineBreak: false });
  doc.fill("#a3b8a8").fontSize(10).font("Helvetica")
    .text("Legal-Tech Infrastructure for Nigeria", 40, 52, { lineBreak: false });
  doc.fill("#4ade80").fontSize(10).font("Helvetica")
    .text(`Version 1.0  ·  ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`, { align: "right" });

  doc.moveDown(3);
  doc.fill(TEXT_DARK).fontSize(22).font("Helvetica-Bold").text(title);
  doc.fill(TEXT_MUTED).fontSize(11).font("Helvetica").text(subtitle);
  doc.moveDown(1);
  doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).strokeColor(BRAND_GREEN).lineWidth(2).stroke();
  doc.moveDown(1);
}

function sectionTitle(doc: PDFKit.PDFDocument, text: string) {
  doc.moveDown(1);
  doc.fill(BRAND_GREEN).fontSize(13).font("Helvetica-Bold").text(text);
  doc.moveTo(40, doc.y + 2).lineTo(doc.page.width - 40, doc.y + 2).strokeColor(BORDER_GREY).lineWidth(0.5).stroke();
  doc.moveDown(0.5);
  doc.fill(TEXT_DARK).font("Helvetica").fontSize(10);
}

function bodyText(doc: PDFKit.PDFDocument, text: string) {
  doc.fill(TEXT_DARK).font("Helvetica").fontSize(10).text(text, { lineGap: 3 });
  doc.moveDown(0.4);
}

function codeBlock(doc: PDFKit.PDFDocument, code: string) {
  const lines = code.split("\n");
  const lineHeight = 13;
  const padding = 10;
  const blockHeight = lines.length * lineHeight + padding * 2;

  doc.rect(40, doc.y, doc.page.width - 80, blockHeight).fill(CODE_BG);
  const startY = doc.y + padding;
  doc.fill(CODE_FG).font("Courier").fontSize(8.5);
  let y = startY;
  for (const line of lines) {
    doc.text(line, 52, y, { lineBreak: false });
    y += lineHeight;
  }
  doc.y += blockHeight + 4;
  doc.fill(TEXT_DARK).font("Helvetica").fontSize(10);
  doc.moveDown(0.5);
}

function paramRow(doc: PDFKit.PDFDocument, field: string, type: string, required: boolean, description: string) {
  const x = 52;
  const colWidths = [120, 70, 60, doc.page.width - 80 - 120 - 70 - 60];
  let rowY = doc.y;
  doc.fill(required ? BRAND_GREEN : TEXT_MUTED).font("Courier").fontSize(9).text(field, x, rowY, { width: colWidths[0], lineBreak: false });
  doc.fill(TEXT_MUTED).font("Helvetica").fontSize(9).text(type, x + colWidths[0], rowY, { width: colWidths[1], lineBreak: false });
  doc.fill(required ? BRAND_GREEN : TEXT_MUTED).fontSize(8).text(required ? "Required" : "Optional", x + colWidths[0] + colWidths[1], rowY, { width: colWidths[2], lineBreak: false });
  doc.fill(TEXT_DARK).fontSize(9).text(description, x + colWidths[0] + colWidths[1] + colWidths[2], rowY, { width: colWidths[3] });
  doc.moveDown(0.3);
}

function endpointHeading(doc: PDFKit.PDFDocument, method: string, path: string, description: string) {
  const methodColor = method === "GET" ? "#2563eb" : "#16a34a";
  doc.moveDown(0.8);
  doc.rect(40, doc.y, doc.page.width - 80, 24).fill(LIGHT_GREY);
  const y = doc.y + 6;
  doc.fill(methodColor).font("Helvetica-Bold").fontSize(9).text(method, 48, y, { lineBreak: false });
  doc.fill(TEXT_DARK).font("Courier").fontSize(9).text(path, 95, y, { lineBreak: false });
  doc.fill(TEXT_MUTED).font("Helvetica").fontSize(8.5).text(description, { align: "right" });
  doc.y += 26;
  doc.moveDown(0.3);
  doc.fill(TEXT_DARK).font("Helvetica").fontSize(10);
}

function errorRow(doc: PDFKit.PDFDocument, code: string, status: string, description: string) {
  doc.fill(TEXT_DARK).font("Courier").fontSize(8.5).text(code, 52, doc.y, { width: 160, lineBreak: false });
  doc.fill(TEXT_MUTED).font("Helvetica").fontSize(9).text(status, 220, doc.y, { width: 60, lineBreak: false });
  doc.fill(TEXT_DARK).font("Helvetica").fontSize(9).text(description, 290, doc.y, { width: doc.page.width - 80 - 240 });
  doc.moveDown(0.3);
}

function writePageNumbers(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.fill(TEXT_MUTED).font("Helvetica").fontSize(8)
      .text(`Cellion One  ·  Confidential  ·  Page ${i + 1} of ${range.count}`,
        40, doc.page.height - 30,
        { align: "center", lineBreak: false });
  }
}

function writeToc(doc: PDFKit.PDFDocument, entries: { title: string; indent?: boolean }[]) {
  sectionTitle(doc, "Table of Contents");
  for (const entry of entries) {
    const x = entry.indent ? 72 : 52;
    const bullet = entry.indent ? "  ↳  " : "• ";
    doc.fill(entry.indent ? TEXT_MUTED : TEXT_DARK)
      .font(entry.indent ? "Helvetica" : "Helvetica-Bold")
      .fontSize(10)
      .text(`${bullet}${entry.title}`, x, doc.y, { lineBreak: true });
    doc.moveDown(0.2);
  }
  doc.moveDown(0.5);
}

// ─── KYC PDF ─────────────────────────────────────────────────────────────────

function generateKycPdf(res: Response) {
  const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=\"cellion-one-kyc-api-guide.pdf\"");
  doc.pipe(res);

  writeHeader(
    doc,
    "KYC Verification API Guide",
    "Identity & Corporate Due Diligence API — REST Reference v1.0"
  );

  writeToc(doc, [
    { title: "Overview" },
    { title: "Base URL" },
    { title: "Authentication" },
    { title: "Rate Limits" },
    { title: "Credit Pricing" },
    { title: "Endpoints — Instant ID Lookups" },
    { title: "POST /api/v1/kyc/lookup/bvn", indent: true },
    { title: "POST /api/v1/kyc/lookup/nin", indent: true },
    { title: "Endpoints — Full KYC Sessions" },
    { title: "POST /api/v1/kyc/sessions", indent: true },
    { title: "GET /api/v1/kyc/sessions/:id", indent: true },
    { title: "Endpoints — Corporate Supplier Verification" },
    { title: "POST /api/v1/kyc/supplier/verify", indent: true },
    { title: "GET /api/v1/kyc/supplier/:id", indent: true },
    { title: "Webhooks" },
    { title: "Error Codes" },
    { title: "Support" },
  ]);

  sectionTitle(doc, "Overview");
  bodyText(doc, "The Cellion One KYC API lets you verify individuals and corporate entities programmatically. Use it to run BVN/NIN lookups, full biometric KYC, and supplier due-diligence — all via a secure REST interface authenticated by API key.");

  sectionTitle(doc, "Base URL");
  codeBlock(doc, "https://cellionone.com/api/v1/kyc");

  sectionTitle(doc, "Authentication");
  bodyText(doc, "Include your API key in every request using the X-API-Key header. Keys use the co_live_ prefix followed by 32 hex characters. The full key is shown once at creation — store it securely.");
  codeBlock(doc, `curl -X GET https://cellionone.com/api/v1/kyc/templates \\
  -H "X-API-Key: co_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \\
  -H "Content-Type: application/json"`);

  sectionTitle(doc, "Rate Limits");
  bodyText(doc, "Default: 60 requests per minute per API key. Exceeding this returns 429 Too Many Requests. Contact us to increase limits for high-volume integrations.");

  sectionTitle(doc, "Credit Pricing");
  bodyText(doc, "Cellion One uses a credit-based model — 1 credit = 1 verification, deducted automatically when a verification completes.\n");
  const pricingRows = [
    ["identity_only", "₦5,000 / credit", "BVN/NIN lookup + AML screening", "Instant"],
    ["individual", "₦15,000 / credit", "Full ID + biometric + AML", "~2–5 min (webhook)"],
    ["supplier", "₦75,000 / credit", "Corporate entity + director KYC + AML", "~1 business day"],
  ];
  for (const [type, price, checks, timing] of pricingRows) {
    doc.fill(BRAND_GREEN).font("Courier").fontSize(9).text(type, 52, doc.y, { width: 120, lineBreak: false });
    doc.fill(TEXT_DARK).font("Helvetica").fontSize(9).text(price, 180, doc.y, { width: 100, lineBreak: false });
    doc.fill(TEXT_MUTED).font("Helvetica").fontSize(9).text(checks, 290, doc.y, { width: 150, lineBreak: false });
    doc.fill("#16a34a").font("Helvetica").fontSize(8).text(timing, { align: "right" });
    doc.moveDown(0.3);
  }
  doc.moveDown(0.5);

  sectionTitle(doc, "Endpoints — Instant ID Lookups");

  endpointHeading(doc, "POST", "/api/v1/kyc/lookup/bvn", "Verify a BVN against NIBSS");
  bodyText(doc, "Required scope: verify:identity. Returns verified name, DOB, phone, gender, address, and government photo (if available). Deducts 1 identity_only credit.");
  codeBlock(doc, `{
  "idNumber": "22200000000",
  "firstName": "Emeka",
  "lastName": "Okoro",
  "dateOfBirth": "1990-01-15"
}`);
  bodyText(doc, "Response:");
  codeBlock(doc, `{
  "verified": true,
  "idType": "BVN",
  "referenceId": "id_lookup_1_1700000000_ab12cd34",
  "requestId": 42,
  "fullName": "EMEKA OKORO",
  "dob": "1990-01-15",
  "phone": "080XXXXXXXX",
  "gender": "M",
  "address": "12 Marina Street, Lagos"
}`);

  endpointHeading(doc, "POST", "/api/v1/kyc/lookup/nin", "Verify a NIN against NIMC");
  bodyText(doc, "Same parameters and response shape as the BVN endpoint — substituting NIN for idNumber.");

  endpointHeading(doc, "POST", "/api/v1/kyc/lookup/drivers-licence", "Verify a driver's licence against FRSC");
  bodyText(doc, "Required scope: verify:identity. firstName, lastName, and dateOfBirth are all required for driver's licence lookups.");

  endpointHeading(doc, "POST", "/api/v1/kyc/lookup/voter-id", "Verify a voter ID against INEC");
  bodyText(doc, "Required scope: verify:identity. firstName, lastName, and dateOfBirth are all required.");

  sectionTitle(doc, "Endpoints — Full KYC Sessions");

  endpointHeading(doc, "POST", "/api/v1/kyc/requests", "Create a verification request");
  bodyText(doc, "Required scope: verify:request. Accepts templateId, subjectEmail, subjectName, and subjectPhone. Returns a requestId and an inviteUrl (hosted session link you can email to your end-user).");
  codeBlock(doc, `{
  "templateId": 1,
  "subjectEmail": "customer@example.com",
  "subjectName": "Amaka Nwachukwu",
  "subjectPhone": "0801234567"
}`);

  endpointHeading(doc, "GET", "/api/v1/kyc/requests", "List all requests for your organisation");
  bodyText(doc, "Returns paginated list of requests. Supports ?limit= and ?offset= query parameters.");

  endpointHeading(doc, "GET", "/api/v1/kyc/requests/:requestId", "Get a single verification request");
  bodyText(doc, "Returns the full request record including status, result, and any verified identity snapshot.");

  endpointHeading(doc, "GET", "/api/v1/kyc/templates", "List your verification templates");
  bodyText(doc, "Templates define the verification flow (which checks to run). You can create and manage templates in the KYC dashboard or via the API.");

  sectionTitle(doc, "Webhook Events");
  bodyText(doc, "Register a webhook URL in your organisation settings. Cellion One signs all payloads with HMAC-SHA256 (X-Cellion-Signature header). Verify the signature before processing.");
  codeBlock(doc, `{
  "event": "verification.completed",
  "requestId": 42,
  "status": "verified",
  "subjectEmail": "customer@example.com",
  "verificationType": "individual",
  "verifiedAt": "2026-04-12T10:30:00Z",
  "result": {
    "fullName": "AMAKA NWACHUKWU",
    "dob": "1988-06-20",
    "gender": "F"
  }
}`);

  sectionTitle(doc, "Error Codes");
  const errorRows = [
    ["INSUFFICIENT_CREDITS", "402", "No credits remaining for this verification type"],
    ["INVALID_API_KEY", "401", "API key is missing, malformed, or revoked"],
    ["FORBIDDEN_SCOPE", "403", "API key lacks the required permission scope"],
    ["NOT_FOUND", "404", "The requested resource does not exist"],
    ["VALIDATION_ERROR", "400", "Request body failed schema validation"],
    ["RATE_LIMIT_EXCEEDED", "429", "Too many requests — slow down and retry"],
    ["VERIFICATION_SERVICE_ERROR", "502", "Upstream identity provider returned an error"],
  ];
  doc.moveDown(0.3);
  for (const [code, status, desc] of errorRows) {
    errorRow(doc, code, status, desc);
  }

  sectionTitle(doc, "Support");
  bodyText(doc, "For API support and integration guidance, contact:\n\nservice@cellionone.com\nhttps://cellionone.com/api-docs");

  writePageNumbers(doc);
  doc.end();
}

// ─── KYB PDF ─────────────────────────────────────────────────────────────────

function generateKybPdf(res: Response) {
  const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=\"cellion-one-kyb-api-guide.pdf\"");
  doc.pipe(res);

  writeHeader(
    doc,
    "KYB Company Registry API Guide",
    "Nigerian CAC Registry Lookup API — REST Reference v1.0"
  );

  writeToc(doc, [
    { title: "Overview" },
    { title: "Base URL" },
    { title: "Authentication" },
    { title: "Credit Pricing" },
    { title: "businessType Codes" },
    { title: "Endpoints" },
    { title: "POST /api/v1/kyb/lookup", indent: true },
    { title: "GET /api/v1/kyb/lookups", indent: true },
    { title: "GET /api/v1/kyb/lookups/:reference", indent: true },
    { title: "Error Codes" },
    { title: "Support" },
  ]);

  sectionTitle(doc, "Overview");
  bodyText(doc, "The Cellion One KYB (Know Your Business) API provides programmatic access to the Nigerian Corporate Affairs Commission (CAC) registry via Smile ID. Use it to verify a company's registration number, retrieve its official name, registration date, company type, and directors list — all in a single API call.");
  bodyText(doc, "Common use cases: bank onboarding, supplier due diligence, trade credit decisions, and automated KYB pipelines.");

  sectionTitle(doc, "Base URL");
  codeBlock(doc, "https://cellionone.com/api/v1/kyb");

  sectionTitle(doc, "Authentication");
  bodyText(doc, "All KYB endpoints require an API key with the verify:business scope. Include the key in every request using the X-API-Key header.");
  codeBlock(doc, `curl -X POST https://cellionone.com/api/v1/kyb/lookup \\
  -H "X-API-Key: co_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \\
  -H "Content-Type: application/json" \\
  -d '{"rcNumber": "9228748"}'`);

  sectionTitle(doc, "Credit Pricing");
  bodyText(doc, "KYB lookups consume credits from your organisation's KYB credit balance.\n  • ₦5,000 per lookup (1 credit)\n  • Credits are pre-purchased via Paystack (minimum 10 credits)\n  • 1 credit is deducted per successful lookup (found or not_found)\n  • Errors due to service unavailability do not deduct credits");

  sectionTitle(doc, "businessType Codes");
  const btRows = [
    ["co", "Private limited company (Ltd) — default"],
    ["bn", "Business Name (sole proprietorship)"],
    ["it", "Incorporated Trustee (NGO / association)"],
  ];
  for (const [code, desc] of btRows) {
    doc.fill(BRAND_GREEN).font("Courier").fontSize(9).text(code, 52, doc.y, { width: 60, lineBreak: false });
    doc.fill(TEXT_DARK).font("Helvetica").fontSize(9).text(desc, 120, doc.y, { width: doc.page.width - 200 });
    doc.moveDown(0.3);
  }
  doc.moveDown(0.5);

  sectionTitle(doc, "Endpoints");

  endpointHeading(doc, "POST", "/api/v1/kyb/lookup", "Perform a CAC registry lookup by RC number");
  bodyText(doc, "Checks your KYB credit balance, calls the CAC registry via Smile ID, stores the result, and deducts one credit. Returns the full company record immediately (synchronous).");
  bodyText(doc, "Request Parameters:");
  paramRow(doc, "rcNumber", "string", true, "RC number. Digits only or with RC prefix (e.g. '9228748' or 'RC9228748'). Max 20 chars.");
  paramRow(doc, "businessType", "string", false, "Company category: co (default), bn, or it.");
  doc.moveDown(0.3);
  bodyText(doc, "Example Request Body:");
  codeBlock(doc, `{
  "rcNumber": "9228748",
  "businessType": "co"
}`);
  bodyText(doc, "Success Response (200 — found):");
  codeBlock(doc, `{
  "reference": "kyb_1_1744000000_a1b2c3d4",
  "status": "found",
  "rcNumber": "9228748",
  "businessType": "co",
  "companyName": "CELLION PLATFORMS NIGERIA LIMITED",
  "registrationDate": "2022-08-15",
  "companyStatus": "ACTIVE",
  "companyType": "LTD",
  "address": "51 Raymond Njoku Street, Lagos, Nigeria",
  "shareCapital": "1000000",
  "tinNumber": "12345678-0001",
  "directors": [
    { "name": "EMEKA OKORO", "role": "DIRECTOR" },
    { "name": "NGOZI ADEYEMI", "role": "DIRECTOR" }
  ],
  "creditDeducted": true,
  "createdAt": "2026-04-12T10:30:00.000Z"
}`);
  bodyText(doc, "Not Found Response (404):");
  codeBlock(doc, `{
  "reference": "kyb_1_1744000001_b2c3d4e5",
  "status": "not_found",
  "rcNumber": "0000001",
  "businessType": "co",
  "companyName": null,
  "directors": null,
  "creditDeducted": true,
  "createdAt": "2026-04-12T10:31:00.000Z"
}`);

  endpointHeading(doc, "GET", "/api/v1/kyb/lookups", "List all KYB lookups for your organisation");
  bodyText(doc, "Returns lookups sorted by createdAt descending. Supports pagination via limit (default 50, max 200) and offset query parameters.");
  bodyText(doc, "Example Request:");
  codeBlock(doc, "GET /api/v1/kyb/lookups?limit=20&offset=0");
  bodyText(doc, "Response:");
  codeBlock(doc, `{
  "data": [ /* array of lookup records */ ],
  "limit": 20,
  "offset": 0,
  "pageCount": 20
}`);

  endpointHeading(doc, "GET", "/api/v1/kyb/lookups/:reference", "Retrieve a single lookup by reference");
  bodyText(doc, "Fetch a previously performed lookup by its reference string. Only lookups belonging to your organisation are accessible.");
  bodyText(doc, "Example:");
  codeBlock(doc, "GET /api/v1/kyb/lookups/kyb_1_1744000000_a1b2c3d4");

  sectionTitle(doc, "companyStatus Values");
  const statusRows = [
    ["ACTIVE", "Company is in good standing with CAC"],
    ["INACTIVE", "Company is registered but not actively trading"],
    ["DISSOLVED", "Company has been formally wound up"],
    ["STRUCK_OFF", "Company struck off the register by CAC"],
    ["CONVERTED", "Company type has changed via conversion filing"],
    ["SUSPENDED", "CAC has suspended the company's registration"],
  ];
  for (const [status, desc] of statusRows) {
    doc.fill(BRAND_GREEN).font("Courier").fontSize(9).text(status, 52, doc.y, { width: 120, lineBreak: false });
    doc.fill(TEXT_DARK).font("Helvetica").fontSize(9).text(desc, 180, doc.y, { width: doc.page.width - 230 });
    doc.moveDown(0.3);
  }
  doc.moveDown(0.5);

  sectionTitle(doc, "KYB-Specific Error Codes");
  const errorRows = [
    ["INSUFFICIENT_CREDITS", "402", "No KYB credits remaining — purchase more to continue"],
    ["INVALID_API_KEY", "401", "API key missing, invalid, or lacks verify:business scope"],
    ["RC_NOT_FOUND", "404", "RC number not found in the CAC registry"],
    ["INVALID_RC_FORMAT", "400", "rcNumber must be numeric digits or RC-prefixed digits"],
    ["LOOKUP_NOT_FOUND", "404", "GET /:reference — reference does not exist for your org"],
    ["REGISTRY_SERVICE_ERROR", "502", "Upstream CAC registry is temporarily unavailable"],
    ["RATE_LIMIT_EXCEEDED", "429", "60 req/min per API key — retry with backoff"],
  ];
  doc.moveDown(0.3);
  for (const [code, status, desc] of errorRows) {
    errorRow(doc, code, status, desc);
  }

  sectionTitle(doc, "Integration Notes");
  bodyText(doc, "1. Store the reference field returned by POST /lookup — use it to retrieve the record later via GET /lookups/:reference.\n\n2. The API is synchronous — no webhook is fired for KYB lookups. The full result is in the POST response body.\n\n3. Rate limit: 60 requests per minute per API key. For bulk lookups, implement exponential back-off on 429 responses.\n\n4. The rawResult field is omitted from API responses to keep payloads clean. Contact support if you need access to raw Smile ID data.\n\n5. KYB credits and KYC credits are tracked separately in your billing account. Purchase KYB credits from the KYC organisation settings page.");

  sectionTitle(doc, "Support");
  bodyText(doc, "For API support and integration guidance, contact:\n\nservice@cellionone.com\nhttps://cellionone.com/api-docs");

  writePageNumbers(doc);
  doc.end();
}

// ─── Route registration ──────────────────────────────────────────────────────

export function registerPdfDocsRoutes(app: Express) {
  app.get("/api/docs/kyc-api.pdf", (_req: Request, res: Response) => {
    try {
      generateKycPdf(res);
    } catch (err) {
      console.error("[PDF Docs] KYC PDF generation error:", err);
      if (!res.headersSent) res.status(500).send("PDF generation failed");
    }
  });

  app.get("/api/docs/kyb-api.pdf", (_req: Request, res: Response) => {
    try {
      generateKybPdf(res);
    } catch (err) {
      console.error("[PDF Docs] KYB PDF generation error:", err);
      if (!res.headersSent) res.status(500).send("PDF generation failed");
    }
  });
}
