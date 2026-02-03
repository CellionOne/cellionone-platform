import { createHash, randomBytes } from "crypto";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { 
  verificationReceipts, 
  type VerificationReceipt, 
  type InsertVerificationReceipt,
  companyApplications,
  documentFiles,
  executionDeclarations,
  payments
} from "@shared/schema";

type ReceiptScope = "identity" | "incorporation" | "post_incorporation" | "document_bundle";
type ReceiptIssuer = "celion" | "lawyer_proxy" | "agency";
type ReceiptStatus = "issued" | "revoked" | "expired";

interface ReceiptJson {
  companySummary?: { name: string; type: string; founders: string[] };
  statusTimeline?: { status: string; timestamp: string }[];
  documentHashes?: { docType: string; sha256: string }[];
  executionDeclarationRef?: number;
  paymentState?: string;
}

function generateReceiptNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = randomBytes(4).toString("hex").toUpperCase();
  return `CLN-${timestamp}-${random}`;
}

function computeVerificationHash(data: ReceiptJson, receiptNumber: string): string {
  const payload = JSON.stringify({ ...data, receiptNumber });
  return createHash("sha256").update(payload).digest("hex");
}

export async function issueReceipt(
  applicationId: number,
  founderId: string,
  scope: ReceiptScope,
  issuedBy: ReceiptIssuer = "celion",
  expiresInDays?: number
): Promise<VerificationReceipt> {
  const application = await db.select().from(companyApplications)
    .where(eq(companyApplications.id, applicationId))
    .then(rows => rows[0]);
    
  if (!application) {
    throw new Error("Application not found");
  }

  const documents = await db.select().from(documentFiles)
    .where(eq(documentFiles.applicationId, applicationId));

  const payment = await db.select().from(payments)
    .where(eq(payments.applicationId, applicationId))
    .then(rows => rows[0]);

  const execDeclaration = await db.select().from(executionDeclarations)
    .where(eq(executionDeclarations.applicationId, applicationId))
    .then(rows => rows[0]);

  const shareholders = application.shareholdersData as Array<{ name?: string }> || [];
  const founderNames = shareholders.map(s => s.name || "Unknown").filter(Boolean);
  
  const receiptJson: ReceiptJson = {
    companySummary: {
      name: application.companyName1 || "Unknown",
      type: application.companyType || "LTD",
      founders: founderNames.length > 0 ? founderNames : ["Founder information pending"], 
    },
    statusTimeline: [
      { status: "created", timestamp: application.createdAt?.toISOString() || new Date().toISOString() },
      ...(application.status ? [{ status: application.status, timestamp: application.updatedAt?.toISOString() || new Date().toISOString() }] : []),
    ],
    documentHashes: documents.map(doc => ({
      docType: doc.docType || "unknown",
      sha256: doc.sha256Hash || "pending",
    })),
    executionDeclarationRef: execDeclaration?.id,
    paymentState: payment?.state || application.paymentState || "unpaid",
  };

  const receiptNumber = generateReceiptNumber();
  const verificationHash = computeVerificationHash(receiptJson, receiptNumber);

  const expiresAt = expiresInDays 
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const receiptData: InsertVerificationReceipt = {
    applicationId,
    founderId,
    issuedBy,
    scope,
    status: "issued",
    receiptNumber,
    receiptJson,
    verificationHash,
    expiresAt,
  };

  const [receipt] = await db.insert(verificationReceipts).values(receiptData).returning();
  return receipt;
}

export async function getReceipt(receiptId: number): Promise<VerificationReceipt | undefined> {
  const [receipt] = await db.select().from(verificationReceipts)
    .where(eq(verificationReceipts.id, receiptId));
  return receipt;
}

export async function getReceiptByNumber(receiptNumber: string): Promise<VerificationReceipt | undefined> {
  const [receipt] = await db.select().from(verificationReceipts)
    .where(eq(verificationReceipts.receiptNumber, receiptNumber));
  return receipt;
}

export async function getReceiptsByApplication(applicationId: number): Promise<VerificationReceipt[]> {
  return db.select().from(verificationReceipts)
    .where(eq(verificationReceipts.applicationId, applicationId));
}

export async function getReceiptsByFounder(founderId: string): Promise<VerificationReceipt[]> {
  return db.select().from(verificationReceipts)
    .where(eq(verificationReceipts.founderId, founderId));
}

export async function revokeReceipt(
  receiptId: number,
  reason: string
): Promise<VerificationReceipt | undefined> {
  const [receipt] = await db.update(verificationReceipts)
    .set({
      status: "revoked",
      revokedAt: new Date(),
      revocationReason: reason,
    })
    .where(eq(verificationReceipts.id, receiptId))
    .returning();
  return receipt;
}

export interface VerificationResult {
  valid: boolean;
  receipt?: VerificationReceipt;
  error?: string;
}

export async function verifyReceipt(receiptNumber: string): Promise<VerificationResult> {
  const receipt = await getReceiptByNumber(receiptNumber);
  
  if (!receipt) {
    return { valid: false, error: "Receipt not found" };
  }

  if (receipt.status === "revoked") {
    return { 
      valid: false, 
      receipt, 
      error: `Receipt was revoked: ${receipt.revocationReason || "No reason provided"}` 
    };
  }

  if (receipt.expiresAt && new Date(receipt.expiresAt) < new Date()) {
    return { valid: false, receipt, error: "Receipt has expired" };
  }

  const recomputedHash = computeVerificationHash(
    receipt.receiptJson as ReceiptJson,
    receipt.receiptNumber
  );
  
  if (recomputedHash !== receipt.verificationHash) {
    return { valid: false, receipt, error: "Receipt integrity check failed" };
  }

  return { valid: true, receipt };
}

export async function refreshReceiptHashes(applicationId: number): Promise<void> {
  const receipts = await getReceiptsByApplication(applicationId);
  
  for (const receipt of receipts) {
    if (receipt.status !== "issued") continue;
    
    const documents = await db.select().from(documentFiles)
      .where(eq(documentFiles.applicationId, applicationId));
    
    const currentJson = receipt.receiptJson as ReceiptJson || {};
    currentJson.documentHashes = documents.map(doc => ({
      docType: doc.docType || "unknown",
      sha256: doc.sha256Hash || "pending",
    }));
    
    const newHash = computeVerificationHash(currentJson, receipt.receiptNumber);
    
    await db.update(verificationReceipts)
      .set({
        receiptJson: currentJson,
        verificationHash: newHash,
      })
      .where(eq(verificationReceipts.id, receipt.id));
  }
}
