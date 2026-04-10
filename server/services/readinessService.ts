import { db } from "../db";
import { eq } from "drizzle-orm";
import { 
  companyApplications, 
  documentFiles, 
  identityVerifications, 
  payments,
  type CompanyApplication 
} from "@shared/schema";

export interface ReadinessBreakdownItem {
  name: string;
  status: "complete" | "incomplete" | "na";
  note?: string;
}

export interface ReadinessBreakdownCategory {
  category: string;
  score: number;
  weight: number;
  items: ReadinessBreakdownItem[];
}

export interface ReadinessResult {
  overallScore: number;
  breakdown: ReadinessBreakdownCategory[];
  nextSteps: string[];
}

export async function calculateApplicationReadiness(
  applicationId: number
): Promise<ReadinessResult> {
  const [application] = await db.select().from(companyApplications)
    .where(eq(companyApplications.id, applicationId));
    
  if (!application) {
    throw new Error("Application not found");
  }

  const documents = await db.select().from(documentFiles)
    .where(eq(documentFiles.applicationId, applicationId));

  const [identityVerification] = await db.select().from(identityVerifications)
    .where(eq(identityVerifications.founderUserId, application.founderUserId));

  const [payment] = await db.select().from(payments)
    .where(eq(payments.applicationId, applicationId));

  const identityVerified = identityVerification?.status === "verified";
  const identityFromPreviousRegistration =
    identityVerified && identityVerification?.identitySource === 'kyb_pipeline';
  const paymentComplete = payment?.status === "completed" || 
    application.paymentState === "paid_escrowed" || 
    application.paymentState === "released_to_lawyer";

  return computeReadinessScore(application, documents, identityVerified, paymentComplete, identityFromPreviousRegistration);
}

export function computeReadinessScore(
  application: CompanyApplication,
  documents: Array<{ docType: string; qualityStatus?: string | null }>,
  identityVerified: boolean,
  paymentComplete: boolean,
  identityFromPreviousRegistration = false
): ReadinessResult {
  const breakdown: ReadinessBreakdownCategory[] = [];
  const nextSteps: string[] = [];

  const companyInfoItems: ReadinessBreakdownItem[] = [
    { name: "Company Name", status: application.companyName1 ? "complete" : "incomplete" },
    { name: "Company Type", status: application.companyType ? "complete" : "incomplete" },
    { name: "Business Description", status: application.businessDescription ? "complete" : "incomplete" },
    { name: "Registered Address", status: application.registeredAddress ? "complete" : "incomplete" },
  ];
  const companyInfoScore = Math.round((companyInfoItems.filter(i => i.status === "complete").length / companyInfoItems.length) * 100);
  breakdown.push({ category: "Company Information", score: companyInfoScore, weight: 25, items: companyInfoItems });
  
  if (companyInfoScore < 100) {
    nextSteps.push("Complete all company information fields");
  }

  const hasDirectors = application.directorsData && Array.isArray(application.directorsData) && application.directorsData.length > 0;
  const hasShareholders = application.shareholdersData && Array.isArray(application.shareholdersData) && application.shareholdersData.length > 0;
  const peopleItems: ReadinessBreakdownItem[] = [
    { name: "Directors", status: hasDirectors ? "complete" : "incomplete" },
    { name: "Shareholders", status: hasShareholders ? "complete" : "incomplete" },
  ];
  const peopleScore = Math.round((peopleItems.filter(i => i.status === "complete").length / peopleItems.length) * 100);
  breakdown.push({ category: "Directors & Shareholders", score: peopleScore, weight: 25, items: peopleItems });
  
  if (!hasDirectors) nextSteps.push("Add at least one director");
  if (!hasShareholders) nextSteps.push("Add shareholder information");

  const requiredDocs = ["passport_photo", "id_document", "utility_bill", "signature"];
  const docItems: ReadinessBreakdownItem[] = requiredDocs.map(docType => {
    const doc = documents.find(d => d.docType === docType);
    let status: "complete" | "incomplete" | "na" = "incomplete";
    let note: string | undefined;

    if (doc) {
      if (doc.qualityStatus === "rejected") {
        status = "incomplete";
        note = "Document rejected - please re-upload";
      } else if (doc.qualityStatus === "needs_attention") {
        status = "complete";
        note = "Under review";
      } else {
        status = "complete";
      }
    }

    return {
      name: docType.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
      status,
      note,
    };
  });
  const docScore = Math.round((docItems.filter(i => i.status === "complete").length / docItems.length) * 100);
  breakdown.push({ category: "Required Documents", score: docScore, weight: 30, items: docItems });
  
  if (docScore < 100) {
    nextSteps.push("Upload all required documents");
  }

  const verificationItems: ReadinessBreakdownItem[] = [
    {
      name: "Identity Verification",
      status: identityVerified ? "complete" : "incomplete",
      note: identityFromPreviousRegistration ? "Verified from previous company registration" : undefined,
    },
    { name: "Payment", status: paymentComplete ? "complete" : "incomplete" },
  ];
  const verificationScore = Math.round((verificationItems.filter(i => i.status === "complete").length / verificationItems.length) * 100);
  breakdown.push({ category: "Verification & Payment", score: verificationScore, weight: 20, items: verificationItems });
  
  if (!identityVerified) nextSteps.push("Complete identity verification");
  if (!paymentComplete) nextSteps.push("Complete payment");

  const overallScore = Math.round(
    breakdown.reduce((acc, b) => acc + (b.score * b.weight / 100), 0)
  );

  return { overallScore, breakdown, nextSteps };
}

export async function updateApplicationReadiness(applicationId: number): Promise<void> {
  const readiness = await calculateApplicationReadiness(applicationId);
  
  const missingItems = readiness.breakdown
    .flatMap(b => b.items.filter(i => i.status === "incomplete").map(i => `${b.category}: ${i.name}`));
  const warnings = readiness.breakdown
    .flatMap(b => b.items.filter(i => i.note).map(i => `${i.name}: ${i.note}`));
  
  await db.update(companyApplications)
    .set({
      readinessScore: readiness.overallScore,
      readinessBreakdown: {
        missingItems,
        warnings,
        blockers: missingItems.length > 3 ? ["Multiple required items missing"] : [],
        nextActions: readiness.nextSteps,
      },
      updatedAt: new Date(),
    })
    .where(eq(companyApplications.id, applicationId));
}

export async function getApplicationReadiness(applicationId: number): Promise<{
  score: number;
  breakdown: ReadinessBreakdownCategory[];
  nextSteps: string[];
} | null> {
  const [application] = await db.select().from(companyApplications)
    .where(eq(companyApplications.id, applicationId));
    
  if (!application) {
    return null;
  }

  if (application.readinessScore !== null && application.readinessBreakdown) {
    const fresh = await calculateApplicationReadiness(applicationId);
    return {
      score: fresh.overallScore,
      breakdown: fresh.breakdown,
      nextSteps: fresh.nextSteps,
    };
  }

  const fresh = await calculateApplicationReadiness(applicationId);
  await updateApplicationReadiness(applicationId);
  
  return {
    score: fresh.overallScore,
    breakdown: fresh.breakdown,
    nextSteps: fresh.nextSteps,
  };
}
