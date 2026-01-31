import { createHash } from "crypto";
import { db } from "../db";
import { applicationAIEvents, type InsertApplicationAIEvent } from "@shared/schema";

let openaiClient: any = null;

const MODEL_NAME = "gpt-4o";
const PROMPT_VERSIONS = {
  cac_activity_mapping: "v1.0",
  clarification_generator: "v1.0",
  readiness_explainer: "v1.0",
  doc_quality: "v1.0",
};

async function getOpenAI() {
  if (!openaiClient) {
    const { OpenAI } = await import("openai");
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

async function logAIEvent(event: InsertApplicationAIEvent): Promise<void> {
  await db.insert(applicationAIEvents).values(event);
}

export interface CACActivitySuggestion {
  activityCode: string;
  activityDescription: string;
  relevanceScore: number;
  rationale: string;
}

export async function suggestCACActivities(
  applicationId: number,
  actorUserId: string,
  businessDescription: string,
  companyType: string
): Promise<{ suggestions: CACActivitySuggestion[]; aiEventId?: number }> {
  const inputPayload = JSON.stringify({ businessDescription, companyType });
  const inputHash = sha256(inputPayload);
  
  const systemPrompt = `You are a Nigerian Corporate Affairs Commission (CAC) expert. Given a business description, suggest the most relevant CAC activity codes (ISIC Rev 4 classification used in Nigeria).
  
Return a JSON array of up to 5 suggested activities, each with:
- activityCode: The ISIC activity code (e.g., "6201", "4690")
- activityDescription: Official description of the activity
- relevanceScore: 0-100 indicating relevance to the business
- rationale: Brief explanation of why this activity fits

Focus on primary business activities. Be specific and accurate.`;

  const userPrompt = `Business Description: ${businessDescription}
Company Type: ${companyType}

Suggest the most appropriate CAC activity codes for this business.`;

  try {
    const openai = await getOpenAI();
    const response = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || "{}";
    let parsed: { suggestions?: CACActivitySuggestion[] } = {};
    
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { suggestions: [] };
    }

    const suggestions = Array.isArray(parsed.suggestions) 
      ? parsed.suggestions.slice(0, 5) 
      : [];

    await logAIEvent({
      applicationId,
      actorUserId,
      feature: "cac_activity_mapping",
      model: MODEL_NAME,
      promptVersion: PROMPT_VERSIONS.cac_activity_mapping,
      inputHash,
      outputJson: { suggestions, rawResponse: content },
    });

    return { suggestions };
  } catch (error) {
    console.error("AI CAC suggestion error:", error);
    return { suggestions: [] };
  }
}

export interface ClarificationDraft {
  subject: string;
  message: string;
  rationale: string;
  suggestedDocuments?: string[];
}

export async function generateClarificationDraft(
  applicationId: number,
  actorUserId: string,
  context: {
    companyName: string;
    founderName: string;
    issue: string;
    existingDocuments: string[];
  }
): Promise<{ draft: ClarificationDraft | null; aiEventId?: number }> {
  const inputPayload = JSON.stringify(context);
  const inputHash = sha256(inputPayload);

  const systemPrompt = `You are a professional Nigerian corporate lawyer drafting a clarification request to a founder. Be clear, professional, and specific about what additional information or documents are needed.

Return a JSON object with:
- subject: A clear, professional subject line
- message: The body of the clarification request (2-4 paragraphs, professional but friendly tone)
- rationale: Internal note explaining why this clarification is needed
- suggestedDocuments: Array of document types that might help resolve the issue`;

  const userPrompt = `Company: ${context.companyName}
Founder: ${context.founderName}
Issue: ${context.issue}
Existing Documents: ${context.existingDocuments.join(", ") || "None uploaded"}

Draft a clarification request to the founder.`;

  try {
    const openai = await getOpenAI();
    const response = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
    });

    const content = response.choices[0]?.message?.content || "{}";
    let draft: ClarificationDraft | null = null;
    
    try {
      draft = JSON.parse(content);
    } catch {
      draft = null;
    }

    await logAIEvent({
      applicationId,
      actorUserId,
      feature: "clarification_generator",
      model: MODEL_NAME,
      promptVersion: PROMPT_VERSIONS.clarification_generator,
      inputHash,
      outputJson: { draft, rawResponse: content },
    });

    return { draft };
  } catch (error) {
    console.error("AI clarification draft error:", error);
    return { draft: null };
  }
}

export interface DocumentQualityCheck {
  overallScore: number;
  issues: Array<{
    type: "blur" | "crop" | "missing_page" | "low_resolution" | "wrong_format";
    severity: "low" | "medium" | "high";
    description: string;
  }>;
  recommendations: string[];
}

export async function analyzeDocumentQuality(
  applicationId: number,
  actorUserId: string,
  documentMetadata: {
    fileName: string;
    fileType: string;
    fileSize: number;
    documentType: string;
  }
): Promise<{ quality: DocumentQualityCheck | null }> {
  const inputPayload = JSON.stringify(documentMetadata);
  const inputHash = sha256(inputPayload);

  const issues: DocumentQualityCheck["issues"] = [];
  const recommendations: string[] = [];
  
  if (documentMetadata.fileSize < 10000) {
    issues.push({
      type: "low_resolution",
      severity: "medium",
      description: "File size is very small, document may be low resolution",
    });
    recommendations.push("Upload a higher resolution scan");
  }
  
  if (documentMetadata.fileSize > 10000000) {
    issues.push({
      type: "wrong_format",
      severity: "low",
      description: "File is very large, consider compressing",
    });
  }

  const validTypes = ["application/pdf", "image/jpeg", "image/png"];
  if (!validTypes.includes(documentMetadata.fileType)) {
    issues.push({
      type: "wrong_format",
      severity: "high",
      description: `Unsupported file format: ${documentMetadata.fileType}`,
    });
    recommendations.push("Upload document as PDF, JPEG, or PNG");
  }

  const overallScore = Math.max(0, 100 - issues.reduce((acc, i) => {
    return acc + (i.severity === "high" ? 30 : i.severity === "medium" ? 15 : 5);
  }, 0));

  const quality: DocumentQualityCheck = { overallScore, issues, recommendations };

  await logAIEvent({
    applicationId,
    actorUserId,
    feature: "doc_quality",
    model: "heuristic",
    promptVersion: PROMPT_VERSIONS.doc_quality,
    inputHash,
    outputJson: quality,
  });

  return { quality };
}

