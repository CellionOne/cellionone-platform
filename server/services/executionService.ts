import { db } from "../db";
import { eq } from "drizzle-orm";
import { 
  executionDeclarations, 
  companyApplications,
  type ExecutionDeclaration, 
  type InsertExecutionDeclaration 
} from "@shared/schema";

const DECLARATION_TEXT_V1 = `
DECLARATION OF SUBMISSION

I, the undersigned lawyer, hereby declare that:

1. I have reviewed all documents submitted for this company incorporation application.
2. I have verified the identity of all directors and shareholders to the best of my ability.
3. I have prepared and submitted the incorporation documents to the Corporate Affairs Commission (CAC) of Nigeria.
4. All information provided in the application is accurate to the best of my knowledge.
5. I take full professional responsibility for this submission in accordance with the Legal Practitioners Act of Nigeria.

This declaration is made in good faith and in compliance with all applicable laws and regulations.
`;

export type SubmissionType = "physical" | "digital";

export interface CreateDeclarationInput {
  applicationId: number;
  lawyerId: string;
  submissionType: SubmissionType;
  submissionLocation?: string;
  notes?: string;
}

export async function createExecutionDeclaration(
  input: CreateDeclarationInput
): Promise<ExecutionDeclaration> {
  const application = await db.select().from(companyApplications)
    .where(eq(companyApplications.id, input.applicationId))
    .then(rows => rows[0]);
    
  if (!application) {
    throw new Error("Application not found");
  }

  if (application.assignedLawyerUserId !== input.lawyerId) {
    throw new Error("Only the assigned lawyer can create an execution declaration");
  }

  const existingDeclarations = await getDeclarationsByApplication(input.applicationId);
  if (existingDeclarations.length > 0) {
    throw new Error("An execution declaration already exists for this application");
  }

  const declarationData: InsertExecutionDeclaration = {
    applicationId: input.applicationId,
    lawyerId: input.lawyerId,
    submissionType: input.submissionType,
    submissionLocation: input.submissionLocation,
    submittedAt: new Date(),
    declarationAccepted: true,
    declarationTextVersion: "v1.0",
    notes: input.notes,
  };

  const [declaration] = await db.insert(executionDeclarations)
    .values(declarationData)
    .returning();

  await db.update(companyApplications)
    .set({ 
      status: "filed",
      updatedAt: new Date(),
    })
    .where(eq(companyApplications.id, input.applicationId));

  return declaration;
}

export async function getDeclaration(id: number): Promise<ExecutionDeclaration | undefined> {
  const [declaration] = await db.select().from(executionDeclarations)
    .where(eq(executionDeclarations.id, id));
  return declaration;
}

export async function getDeclarationsByApplication(
  applicationId: number
): Promise<ExecutionDeclaration[]> {
  return db.select().from(executionDeclarations)
    .where(eq(executionDeclarations.applicationId, applicationId));
}

export async function getDeclarationsByLawyer(
  lawyerId: string
): Promise<ExecutionDeclaration[]> {
  return db.select().from(executionDeclarations)
    .where(eq(executionDeclarations.lawyerId, lawyerId));
}

export function getDeclarationText(version: string = "v1.0"): string {
  return DECLARATION_TEXT_V1;
}

export interface DeclarationValidation {
  valid: boolean;
  errors: string[];
}

export function validateDeclarationInput(input: CreateDeclarationInput): DeclarationValidation {
  const errors: string[] = [];

  if (!input.applicationId || input.applicationId <= 0) {
    errors.push("Valid application ID is required");
  }

  if (!input.lawyerId || input.lawyerId.trim() === "") {
    errors.push("Lawyer ID is required");
  }

  if (!["physical", "digital"].includes(input.submissionType)) {
    errors.push("Submission type must be 'physical' or 'digital'");
  }

  if (input.submissionType === "physical" && !input.submissionLocation) {
    errors.push("Submission location is required for physical submissions");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
