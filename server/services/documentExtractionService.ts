import { db } from "../db";
import { eq } from "drizzle-orm";
import {
  kycSubmittedDocuments,
  kycSupplierProfiles,
  kycSupplierPeople,
  kycVerificationRequests,
} from "@shared/schema";

let openaiClient: any = null;

const MODEL_NAME = "gpt-4o";

async function getOpenAI() {
  if (!openaiClient) {
    const { OpenAI } = await import("openai");
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export interface ExtractionField {
  value: string | number | boolean | null;
  confidence: number;
}

export interface CACCertificateExtraction {
  documentType: "cac_certificate";
  companyName: ExtractionField;
  rcNumber: ExtractionField;
  dateOfIncorporation: ExtractionField;
  businessAddress: ExtractionField;
}

export interface CACCO2CO7Extraction {
  documentType: "cac_co2_co7";
  directors: {
    name: ExtractionField;
    address: ExtractionField;
    shares: ExtractionField;
  }[];
  shareCapital: ExtractionField;
  companySecretary: ExtractionField;
}

export interface TINCertificateExtraction {
  documentType: "tin_certificate";
  tinNumber: ExtractionField;
  companyName: ExtractionField;
  taxOffice: ExtractionField;
}

export interface TaxClearanceCertificateExtraction {
  documentType: "tax_clearance_certificate";
  companyName: ExtractionField;
  tinNumber: ExtractionField;
  validFrom: ExtractionField;
  validTo: ExtractionField;
}

export interface GovernmentIDExtraction {
  documentType: "government_id";
  idSubType: ExtractionField;
  fullName: ExtractionField;
  dateOfBirth: ExtractionField;
  gender: ExtractionField;
  idNumber: ExtractionField;
  expiryDate: ExtractionField;
  address: ExtractionField;
}

export interface PassportPhotographExtraction {
  documentType: "passport_photograph";
}

export interface BankReferenceLetterExtraction {
  documentType: "bank_reference_letter";
  bankName: ExtractionField;
  accountName: ExtractionField;
  accountNumber: ExtractionField;
  dateIssued: ExtractionField;
}

export interface VATCertificateExtraction {
  documentType: "vat_certificate";
  vatNumber: ExtractionField;
  companyName: ExtractionField;
}

export interface ProofOfAddressExtraction {
  documentType: "proof_of_address";
  address: ExtractionField;
  name: ExtractionField;
  dateIssued: ExtractionField;
}

export interface UnknownDocumentExtraction {
  documentType: "unknown";
  rawText: ExtractionField;
}

export type DocumentExtraction =
  | CACCertificateExtraction
  | CACCO2CO7Extraction
  | TINCertificateExtraction
  | TaxClearanceCertificateExtraction
  | GovernmentIDExtraction
  | PassportPhotographExtraction
  | BankReferenceLetterExtraction
  | VATCertificateExtraction
  | ProofOfAddressExtraction
  | UnknownDocumentExtraction;

const EXTRACTION_PROMPT = `You are a document analysis AI specializing in Nigerian corporate and identity documents.

Analyze the provided document image and:
1. Classify the document type as one of:
   - "cac_certificate" (CAC Certificate of Incorporation)
   - "cac_co2_co7" (CAC Form CO2 or CO7 — Particulars of Directors)
   - "tin_certificate" (Tax Identification Number Certificate)
   - "tax_clearance_certificate" (Tax Clearance Certificate)
   - "government_id" (Driver's Licence, International Passport, NIN Slip, Voter's Card, National ID Card)
   - "passport_photograph" (Passport-sized photo of a person)
   - "bank_reference_letter" (Bank Reference Letter)
   - "vat_certificate" (VAT Registration Certificate)
   - "proof_of_address" (Utility bill, bank statement, or other proof of address)
   - "unknown" (Cannot determine)

2. Extract structured data based on the document type. For each extracted field, provide a confidence score from 0 to 1 (1 = highly confident, 0.5 = somewhat confident, < 0.5 = uncertain).

Return a JSON object with the following structure based on document type:

For "cac_certificate":
{
  "documentType": "cac_certificate",
  "companyName": {"value": "...", "confidence": 0.95},
  "rcNumber": {"value": "...", "confidence": 0.9},
  "dateOfIncorporation": {"value": "YYYY-MM-DD", "confidence": 0.85},
  "businessAddress": {"value": "...", "confidence": 0.8}
}

For "cac_co2_co7":
{
  "documentType": "cac_co2_co7",
  "directors": [{"name": {"value":"...","confidence":0.9}, "address": {"value":"...","confidence":0.8}, "shares": {"value":"...","confidence":0.85}}],
  "shareCapital": {"value": "...", "confidence": 0.9},
  "companySecretary": {"value": "...", "confidence": 0.85}
}

For "tin_certificate":
{
  "documentType": "tin_certificate",
  "tinNumber": {"value": "...", "confidence": 0.95},
  "companyName": {"value": "...", "confidence": 0.9},
  "taxOffice": {"value": "...", "confidence": 0.85}
}

For "tax_clearance_certificate":
{
  "documentType": "tax_clearance_certificate",
  "companyName": {"value": "...", "confidence": 0.9},
  "tinNumber": {"value": "...", "confidence": 0.9},
  "validFrom": {"value": "YYYY-MM-DD", "confidence": 0.85},
  "validTo": {"value": "YYYY-MM-DD", "confidence": 0.85}
}

For "government_id":
{
  "documentType": "government_id",
  "idSubType": {"value": "drivers_licence|international_passport|nin_slip|voters_card|national_id", "confidence": 0.95},
  "fullName": {"value": "...", "confidence": 0.9},
  "dateOfBirth": {"value": "YYYY-MM-DD", "confidence": 0.85},
  "gender": {"value": "male|female", "confidence": 0.9},
  "idNumber": {"value": "...", "confidence": 0.9},
  "expiryDate": {"value": "YYYY-MM-DD or null", "confidence": 0.85},
  "address": {"value": "... or null", "confidence": 0.7}
}

For "passport_photograph":
{
  "documentType": "passport_photograph"
}

For "bank_reference_letter":
{
  "documentType": "bank_reference_letter",
  "bankName": {"value": "...", "confidence": 0.9},
  "accountName": {"value": "...", "confidence": 0.9},
  "accountNumber": {"value": "...", "confidence": 0.9},
  "dateIssued": {"value": "YYYY-MM-DD", "confidence": 0.85}
}

For "vat_certificate":
{
  "documentType": "vat_certificate",
  "vatNumber": {"value": "...", "confidence": 0.9},
  "companyName": {"value": "...", "confidence": 0.9}
}

For "proof_of_address":
{
  "documentType": "proof_of_address",
  "address": {"value": "...", "confidence": 0.8},
  "name": {"value": "...", "confidence": 0.8},
  "dateIssued": {"value": "YYYY-MM-DD or null", "confidence": 0.7}
}

For "unknown":
{
  "documentType": "unknown",
  "rawText": {"value": "brief description of what you see", "confidence": 0.3}
}

Important:
- Use null for fields you cannot determine.
- Dates should be in YYYY-MM-DD format when possible.
- Be conservative with confidence scores — only give >0.9 when the text is clearly legible.
- Return ONLY valid JSON, no additional text.`;

async function getImageBase64FromUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch document image: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString("base64");
}

function getMimeTypeForVision(mimeType: string | null): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  switch (mimeType) {
    case "image/png":
      return "image/png";
    case "image/gif":
      return "image/gif";
    case "image/webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

export async function extractDocumentData(
  imageUrl: string,
  mimeType: string | null
): Promise<DocumentExtraction> {
  const openai = await getOpenAI();

  const isPdf = mimeType === "application/pdf";

  let imageContent: any;

  if (isPdf) {
    imageContent = {
      type: "image_url" as const,
      image_url: {
        url: imageUrl,
        detail: "high" as const,
      },
    };
  } else {
    try {
      const base64 = await getImageBase64FromUrl(imageUrl);
      const visionMime = getMimeTypeForVision(mimeType);
      imageContent = {
        type: "image_url" as const,
        image_url: {
          url: `data:${visionMime};base64,${base64}`,
          detail: "high" as const,
        },
      };
    } catch {
      imageContent = {
        type: "image_url" as const,
        image_url: {
          url: imageUrl,
          detail: "high" as const,
        },
      };
    }
  }

  const response = await openai.chat.completions.create({
    model: MODEL_NAME,
    messages: [
      {
        role: "system",
        content: EXTRACTION_PROMPT,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze this document and extract structured data. Return ONLY valid JSON.",
          },
          imageContent,
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content || "{}";
  try {
    return JSON.parse(content) as DocumentExtraction;
  } catch {
    return {
      documentType: "unknown",
      rawText: { value: "Failed to parse extraction result", confidence: 0 },
    };
  }
}

export async function processDocumentExtraction(
  documentId: number,
  imageUrl: string,
  mimeType: string | null
): Promise<{ success: boolean; extraction?: DocumentExtraction; error?: string }> {
  try {
    await db
      .update(kycSubmittedDocuments)
      .set({ status: "processing" })
      .where(eq(kycSubmittedDocuments.id, documentId));

    const extraction = await extractDocumentData(imageUrl, mimeType);

    const updateData: Record<string, any> = {
      status: "extracted",
      extractedData: extraction,
      detectedDocumentType: extraction.documentType,
    };

    if (extraction.documentType === "tax_clearance_certificate" && "validTo" in extraction) {
      const validTo = extraction.validTo?.value;
      if (validTo && typeof validTo === "string") {
        const parsed = new Date(validTo);
        if (!isNaN(parsed.getTime())) {
          updateData.expiryDate = parsed;
        }
      }
    }

    if (extraction.documentType === "government_id" && "expiryDate" in extraction) {
      const expiry = extraction.expiryDate?.value;
      if (expiry && typeof expiry === "string") {
        const parsed = new Date(expiry);
        if (!isNaN(parsed.getTime())) {
          updateData.expiryDate = parsed;
        }
      }
    }

    if (extraction.documentType === "bank_reference_letter" && "dateIssued" in extraction) {
      const dateIssued = extraction.dateIssued?.value;
      if (dateIssued && typeof dateIssued === "string") {
        const sixMonthsFromIssue = new Date(dateIssued);
        sixMonthsFromIssue.setMonth(sixMonthsFromIssue.getMonth() + 6);
        if (!isNaN(sixMonthsFromIssue.getTime())) {
          updateData.expiryDate = sixMonthsFromIssue;
        }
      }
    }

    await db
      .update(kycSubmittedDocuments)
      .set(updateData)
      .where(eq(kycSubmittedDocuments.id, documentId));

    return { success: true, extraction };
  } catch (error: any) {
    console.error(`[DocumentExtraction] Error processing document ${documentId}:`, error);

    await db
      .update(kycSubmittedDocuments)
      .set({ status: "uploaded" })
      .where(eq(kycSubmittedDocuments.id, documentId));

    return {
      success: false,
      error: error.message || "Document extraction failed",
    };
  }
}

export async function mapExtractionToSupplierProfile(
  verificationRequestId: number,
  extraction: DocumentExtraction
): Promise<void> {
  const [existingProfile] = await db
    .select()
    .from(kycSupplierProfiles)
    .where(eq(kycSupplierProfiles.verificationRequestId, verificationRequestId))
    .limit(1);

  if (!existingProfile) return;

  const updates: Record<string, any> = {};

  switch (extraction.documentType) {
    case "cac_certificate": {
      if (extraction.companyName?.value && extraction.companyName.confidence > 0.7) {
        updates.companyName = extraction.companyName.value;
      }
      if (extraction.rcNumber?.value && extraction.rcNumber.confidence > 0.7) {
        updates.rcNumber = extraction.rcNumber.value;
      }
      if (extraction.businessAddress?.value && extraction.businessAddress.confidence > 0.6) {
        updates.headOfficeAddress = extraction.businessAddress.value;
      }
      break;
    }
    case "tin_certificate": {
      if (extraction.tinNumber?.value && extraction.tinNumber.confidence > 0.7) {
        updates.tinNumber = extraction.tinNumber.value;
      }
      if (extraction.companyName?.value && extraction.companyName.confidence > 0.7 && !existingProfile.companyName) {
        updates.companyName = extraction.companyName.value;
      }
      break;
    }
    case "vat_certificate": {
      updates.vatRegistered = true;
      break;
    }
    case "bank_reference_letter": {
      if (extraction.bankName?.value && extraction.bankName.confidence > 0.7) {
        updates.bankName = extraction.bankName.value;
      }
      if (extraction.accountName?.value && extraction.accountName.confidence > 0.7) {
        updates.bankAccountName = extraction.accountName.value;
      }
      if (extraction.accountNumber?.value && extraction.accountNumber.confidence > 0.7) {
        updates.bankAccountNumber = extraction.accountNumber.value;
      }
      break;
    }
  }

  const currentExtracted = (existingProfile.extractedData as Record<string, any>) || {};
  const mergedExtracted = {
    ...currentExtracted,
    [extraction.documentType]: extraction,
    lastUpdated: new Date().toISOString(),
  };
  updates.extractedData = mergedExtracted;
  updates.updatedAt = new Date();

  if (Object.keys(updates).length > 0) {
    await db
      .update(kycSupplierProfiles)
      .set(updates)
      .where(eq(kycSupplierProfiles.verificationRequestId, verificationRequestId));
  }
}

export async function mapDirectorsFromExtraction(
  verificationRequestId: number,
  supplierProfileId: number,
  extraction: CACCO2CO7Extraction
): Promise<{ created: number; directors: { name: string; email: string }[] }> {
  const directorsCreated: { name: string; email: string }[] = [];

  if (!extraction.directors || !Array.isArray(extraction.directors)) {
    return { created: 0, directors: [] };
  }

  const existingPeople = await db
    .select()
    .from(kycSupplierPeople)
    .where(eq(kycSupplierPeople.supplierProfileId, supplierProfileId));

  const existingNames = new Set(
    existingPeople.map((p) => p.fullName.toLowerCase().trim())
  );

  for (const director of extraction.directors) {
    const name = director.name?.value;
    if (!name || typeof name !== "string" || director.name.confidence < 0.6) continue;

    const normalizedName = name.toLowerCase().trim();
    if (existingNames.has(normalizedName)) continue;

    await db.insert(kycSupplierPeople).values({
      supplierProfileId,
      verificationRequestId,
      fullName: name,
      email: "",
      role: "director",
      requiresVerification: false,
      verificationStatus: "not_required",
    });

    existingNames.add(normalizedName);
    directorsCreated.push({ name, email: "" });
  }

  return { created: directorsCreated.length, directors: directorsCreated };
}

export async function mapExtractionToIndividualProfile(
  verificationRequestId: number,
  extraction: GovernmentIDExtraction
): Promise<{ mapped: boolean; fields: string[] }> {
  const [request] = await db
    .select()
    .from(kycVerificationRequests)
    .where(eq(kycVerificationRequests.id, verificationRequestId))
    .limit(1);

  if (!request || !request.subjectUserId) {
    return { mapped: false, fields: [] };
  }

  return {
    mapped: true,
    fields: Object.entries(extraction)
      .filter(
        ([key, val]) =>
          key !== "documentType" &&
          val &&
          typeof val === "object" &&
          "confidence" in val &&
          val.confidence > 0.6
      )
      .map(([key]) => key),
  };
}

export async function processAndMapDocument(
  documentId: number,
  verificationRequestId: number,
  imageUrl: string,
  mimeType: string | null,
  verificationType: "individual" | "supplier"
): Promise<{
  success: boolean;
  extraction?: DocumentExtraction;
  mappingResult?: any;
  error?: string;
}> {
  const result = await processDocumentExtraction(documentId, imageUrl, mimeType);

  if (!result.success || !result.extraction) {
    return result;
  }

  const extraction = result.extraction;
  let mappingResult: any = null;

  try {
    if (verificationType === "supplier") {
      await mapExtractionToSupplierProfile(verificationRequestId, extraction);

      if (extraction.documentType === "cac_co2_co7") {
        const [profile] = await db
          .select()
          .from(kycSupplierProfiles)
          .where(eq(kycSupplierProfiles.verificationRequestId, verificationRequestId))
          .limit(1);

        if (profile) {
          mappingResult = await mapDirectorsFromExtraction(
            verificationRequestId,
            profile.id,
            extraction as CACCO2CO7Extraction
          );
        }
      }
    } else if (
      verificationType === "individual" &&
      extraction.documentType === "government_id"
    ) {
      mappingResult = await mapExtractionToIndividualProfile(
        verificationRequestId,
        extraction as GovernmentIDExtraction
      );
    }
  } catch (mappingError: any) {
    console.error(`[DocumentExtraction] Mapping error for doc ${documentId}:`, mappingError);
  }

  return {
    success: true,
    extraction,
    mappingResult,
  };
}
