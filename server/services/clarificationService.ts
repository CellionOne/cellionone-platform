import { db } from "../db";
import { eq, desc } from "drizzle-orm";
import { 
  clarificationRequests, 
  companyApplications,
  documentFiles,
  users,
  type ClarificationRequest, 
  type InsertClarificationRequest 
} from "@shared/schema";
import { generateClarificationDraft, type ClarificationDraft } from "./aiService";

export interface CreateClarificationInput {
  applicationId: number;
  lawyerId: string;
  founderUserId: string;
  subject: string;
  message: string;
  useAIDraft?: boolean;
  issueDescription?: string;
}

export async function createClarificationRequest(
  input: CreateClarificationInput
): Promise<ClarificationRequest> {
  const [application] = await db.select().from(companyApplications)
    .where(eq(companyApplications.id, input.applicationId));
    
  if (!application) {
    throw new Error("Application not found");
  }

  if (application.assignedLawyerUserId !== input.lawyerId) {
    throw new Error("Only the assigned lawyer can create clarification requests");
  }

  const clarificationData: InsertClarificationRequest = {
    applicationId: input.applicationId,
    lawyerUserId: input.lawyerId,
    founderUserId: input.founderUserId,
    subject: input.subject,
    message: input.message,
    status: "open",
  };

  const [clarification] = await db.insert(clarificationRequests)
    .values(clarificationData)
    .returning();

  return clarification;
}

export async function sendClarificationRequest(
  clarificationId: number,
  lawyerId: string
): Promise<ClarificationRequest> {
  const [clarification] = await db.select().from(clarificationRequests)
    .where(eq(clarificationRequests.id, clarificationId));
    
  if (!clarification) {
    throw new Error("Clarification request not found");
  }

  if (clarification.lawyerUserId !== lawyerId) {
    throw new Error("Only the assigned lawyer can send this clarification");
  }

  if (clarification.status !== "open") {
    throw new Error("Can only send clarifications that are in 'open' status");
  }

  const [updated] = await db.update(clarificationRequests)
    .set({
      status: "sent",
      sentAt: new Date(),
    })
    .where(eq(clarificationRequests.id, clarificationId))
    .returning();

  await db.update(companyApplications)
    .set({ 
      status: "clarification_requested",
      updatedAt: new Date(),
    })
    .where(eq(companyApplications.id, clarification.applicationId));

  return updated;
}

export async function generateAIDraft(
  applicationId: number,
  lawyerId: string,
  issueDescription: string
): Promise<{ draft: ClarificationDraft | null }> {
  const [application] = await db.select().from(companyApplications)
    .where(eq(companyApplications.id, applicationId));
    
  if (!application) {
    throw new Error("Application not found");
  }

  const [founder] = await db.select().from(users)
    .where(eq(users.id, application.founderUserId));

  const documents = await db.select().from(documentFiles)
    .where(eq(documentFiles.applicationId, applicationId));

  const result = await generateClarificationDraft(
    applicationId,
    lawyerId,
    {
      companyName: application.companyName1 || "Unknown Company",
      founderName: founder ? `${founder.firstName} ${founder.lastName}` : "Founder",
      issue: issueDescription,
      existingDocuments: documents.map(d => d.docType),
    }
  );

  return result;
}

export async function getClarificationsByApplication(
  applicationId: number
): Promise<ClarificationRequest[]> {
  return db.select().from(clarificationRequests)
    .where(eq(clarificationRequests.applicationId, applicationId))
    .orderBy(desc(clarificationRequests.createdAt));
}

export async function getClarificationsByFounder(
  founderUserId: string
): Promise<ClarificationRequest[]> {
  return db.select().from(clarificationRequests)
    .where(eq(clarificationRequests.founderUserId, founderUserId))
    .orderBy(desc(clarificationRequests.createdAt));
}

export async function getClarificationsByLawyer(
  lawyerId: string
): Promise<ClarificationRequest[]> {
  return db.select().from(clarificationRequests)
    .where(eq(clarificationRequests.lawyerUserId, lawyerId))
    .orderBy(desc(clarificationRequests.createdAt));
}

export async function resolveClarification(
  clarificationId: number,
  lawyerId: string
): Promise<ClarificationRequest> {
  const [clarification] = await db.select().from(clarificationRequests)
    .where(eq(clarificationRequests.id, clarificationId));
    
  if (!clarification) {
    throw new Error("Clarification request not found");
  }

  if (clarification.lawyerUserId !== lawyerId) {
    throw new Error("Only the assigned lawyer can resolve this clarification");
  }

  const [updated] = await db.update(clarificationRequests)
    .set({
      status: "resolved",
      resolvedAt: new Date(),
    })
    .where(eq(clarificationRequests.id, clarificationId))
    .returning();

  const openClarifications = await db.select().from(clarificationRequests)
    .where(eq(clarificationRequests.applicationId, clarification.applicationId))
    .then(rows => rows.filter(r => r.status === "open" || r.status === "sent"));

  if (openClarifications.length === 0) {
    await db.update(companyApplications)
      .set({ 
        status: "under_review",
        updatedAt: new Date(),
      })
      .where(eq(companyApplications.id, clarification.applicationId));
  }

  return updated;
}

export async function getPendingClarificationCount(applicationId: number): Promise<number> {
  const clarifications = await db.select().from(clarificationRequests)
    .where(eq(clarificationRequests.applicationId, applicationId));
    
  return clarifications.filter(c => c.status === "open" || c.status === "sent").length;
}
