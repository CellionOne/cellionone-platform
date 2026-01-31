import { db } from "../db";
import { eq } from "drizzle-orm";
import { documentFiles, type DocumentFile } from "@shared/schema";
import { analyzeDocumentQuality, type DocumentQualityCheck } from "./aiService";

export type QualityStatus = "not_checked" | "pass" | "needs_attention" | "rejected";

export interface QualityReport {
  blurScore?: number;
  cropWarnings?: string[];
  missingPageWarning?: boolean;
  aiAnalysis?: DocumentQualityCheck;
  checkedAt: string;
  checkedBy: "system" | "manual";
}

export async function checkDocumentQuality(
  documentId: number,
  actorUserId: string,
  fileMetadata: {
    fileName: string;
    fileType: string;
    fileSize: number;
  }
): Promise<{ document: DocumentFile; report: QualityReport }> {
  const [doc] = await db.select().from(documentFiles)
    .where(eq(documentFiles.id, documentId));
    
  if (!doc) {
    throw new Error("Document not found");
  }

  const aiResult = await analyzeDocumentQuality(
    doc.applicationId || 0,
    actorUserId,
    {
      fileName: fileMetadata.fileName,
      fileType: fileMetadata.fileType,
      fileSize: fileMetadata.fileSize,
      documentType: doc.docType,
    }
  );

  const report: QualityReport = {
    aiAnalysis: aiResult.quality || undefined,
    checkedAt: new Date().toISOString(),
    checkedBy: "system",
  };

  if (aiResult.quality) {
    const blurIssue = aiResult.quality.issues.find(i => i.type === "blur");
    if (blurIssue) {
      report.blurScore = 50; 
    }

    report.cropWarnings = aiResult.quality.issues
      .filter(i => i.type === "crop")
      .map(i => i.description);

    report.missingPageWarning = aiResult.quality.issues
      .some(i => i.type === "missing_page");
  }

  let qualityStatus: QualityStatus = "pass";
  if (aiResult.quality) {
    const hasHighSeverity = aiResult.quality.issues.some(i => i.severity === "high");
    const hasMediumSeverity = aiResult.quality.issues.some(i => i.severity === "medium");
    
    if (hasHighSeverity) {
      qualityStatus = "rejected";
    } else if (hasMediumSeverity) {
      qualityStatus = "needs_attention";
    }
  }

  const [updated] = await db.update(documentFiles)
    .set({
      qualityStatus,
      qualityReport: report,
      lastQualityCheckedAt: new Date(),
    })
    .where(eq(documentFiles.id, documentId))
    .returning();

  return { document: updated, report };
}

export async function manualQualityOverride(
  documentId: number,
  status: QualityStatus,
  notes?: string
): Promise<DocumentFile> {
  const [doc] = await db.select().from(documentFiles)
    .where(eq(documentFiles.id, documentId));
    
  if (!doc) {
    throw new Error("Document not found");
  }

  const existingReport = (doc.qualityReport as QualityReport) || {};
  const updatedReport: QualityReport = {
    ...existingReport,
    checkedAt: new Date().toISOString(),
    checkedBy: "manual",
  };

  const [updated] = await db.update(documentFiles)
    .set({
      qualityStatus: status,
      qualityReport: updatedReport,
      lastQualityCheckedAt: new Date(),
    })
    .where(eq(documentFiles.id, documentId))
    .returning();

  return updated;
}

export async function getDocumentsByQualityStatus(
  applicationId: number,
  status?: QualityStatus
): Promise<DocumentFile[]> {
  if (status) {
    return db.select().from(documentFiles)
      .where(eq(documentFiles.applicationId, applicationId))
      .then(docs => docs.filter(d => d.qualityStatus === status));
  }
  
  return db.select().from(documentFiles)
    .where(eq(documentFiles.applicationId, applicationId));
}

export async function getQualitySummary(applicationId: number): Promise<{
  total: number;
  passed: number;
  needsAttention: number;
  rejected: number;
  notChecked: number;
}> {
  const docs = await db.select().from(documentFiles)
    .where(eq(documentFiles.applicationId, applicationId));
    
  return {
    total: docs.length,
    passed: docs.filter(d => d.qualityStatus === "pass").length,
    needsAttention: docs.filter(d => d.qualityStatus === "needs_attention").length,
    rejected: docs.filter(d => d.qualityStatus === "rejected").length,
    notChecked: docs.filter(d => d.qualityStatus === "not_checked" || !d.qualityStatus).length,
  };
}

export async function bulkQualityCheck(
  applicationId: number,
  actorUserId: string
): Promise<{ checked: number; errors: string[] }> {
  const docs = await db.select().from(documentFiles)
    .where(eq(documentFiles.applicationId, applicationId));
  
  const uncheckedDocs = docs.filter(d => 
    d.qualityStatus === "not_checked" || !d.qualityStatus
  );
  
  let checked = 0;
  const errors: string[] = [];
  
  for (const doc of uncheckedDocs) {
    try {
      await checkDocumentQuality(doc.id, actorUserId, {
        fileName: doc.filename,
        fileType: doc.mimeType || "application/octet-stream",
        fileSize: doc.sizeBytes || 0,
      });
      checked++;
    } catch (error) {
      errors.push(`Failed to check document ${doc.id}: ${error}`);
    }
  }
  
  return { checked, errors };
}
