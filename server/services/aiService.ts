import { createHash } from "crypto";
import { z } from "zod";
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

export function isOpenAIAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

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

// ──────────────────────────────────────────────────────────────────────────────
// CIE Score Narrative (Feature A)
// ──────────────────────────────────────────────────────────────────────────────

export interface CieScoreNarrative {
  headline: string;
  body: string;
  keyPoints: string[];
  caveats: string;
}

export async function generateCieScoreNarrative(context: {
  ticker: string;
  name: string;
  sector: string;
  ias: number;
  rs: number;
  cs: number;
  recommendation: string;
  pillarBreakdown: Record<string, number> | null;
  latestPriceNaira: number | null;
  scoreDate: string;
}): Promise<CieScoreNarrative | null> {
  const systemPrompt = `You are a Nigerian equity research analyst at Cellion Intelligence Engine (CIE). 
Write a concise analyst narrative for a Nigerian Exchange Group (NGX) listed security based on its CIE quantitative scores.

Scores range 0–100:
- IAS (Integrated Aggregate Score): overall quality and value
- RS (Relative Score): performance vs sector peers
- CS (Composite Score): blended momentum and fundamentals

Recommendation tiers: Strong Buy (IAS≥80), Accumulate (IAS≥65), Hold (IAS≥50), Reduce (IAS≥35), Sell (<35)

Return JSON with:
- headline: one-sentence punchy headline (max 15 words)
- body: 2–3 paragraph narrative in professional Nigerian equity research tone (max 200 words total)
- keyPoints: array of 3 bullet-point observations (each max 20 words)
- caveats: one-sentence risk/caveat (max 25 words)`;

  const pillarLines = context.pillarBreakdown
    ? Object.entries(context.pillarBreakdown)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `  ${k.replace(/_/g, " ")}: ${v.toFixed(1)}`)
        .join("\n")
    : "  (not available)";

  const userPrompt = `Security: ${context.ticker} — ${context.name}
Sector: ${context.sector}
Score Date: ${context.scoreDate}
${context.latestPriceNaira != null ? `Latest Price: ₦${context.latestPriceNaira.toFixed(2)}` : ""}

Scores:
  IAS: ${context.ias.toFixed(1)} / 100
  RS: ${context.rs.toFixed(1)} / 100
  CS: ${context.cs.toFixed(1)} / 100
  Recommendation: ${context.recommendation}

Pillar Breakdown:
${pillarLines}

Write the analyst narrative.`;

  try {
    const openai = await getOpenAI();
    const response = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const raw = JSON.parse(content);
    const parsed = CieScoreNarrativeSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("[AI] CIE score narrative schema validation failed:", parsed.error.issues);
      return null;
    }
    return parsed.data as CieScoreNarrative;
  } catch (error) {
    console.error("[AI] CIE score narrative error:", error);
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// CIE Market Commentary (Feature B)
// ──────────────────────────────────────────────────────────────────────────────

export async function generateCieMarketCommentary(context: {
  asiIndex: number | null;
  asiChangePct: number | null;
  brentCrudeUsd: number | null;
  ngnPerUsd: number | null;
  topSecurities: Array<{ ticker: string; name: string; ias: number; recommendation: string; sector: string }>;
  scoreDate: string;
}): Promise<string | null> {
  const systemPrompt = `You are a Nigerian financial markets commentator at Cellion Intelligence Engine (CIE).
Write a daily market commentary for the Nigerian Exchange Group (NGX) based on the latest quantitative data.
Keep it professional, concise, and data-driven. Max 150 words.
Write in plain text — no markdown, no headers. Two short paragraphs.`;

  const topList = context.topSecurities.slice(0, 5)
    .map(s => `${s.ticker} (${s.sector}, IAS ${s.ias.toFixed(1)}, ${s.recommendation})`)
    .join("; ");

  const userPrompt = `Market Data for ${context.scoreDate}:
NGX ASI: ${context.asiIndex != null ? context.asiIndex.toLocaleString() : "N/A"}
Day Change: ${context.asiChangePct != null ? (context.asiChangePct >= 0 ? "+" : "") + context.asiChangePct.toFixed(2) + "%" : "N/A"}
Brent Crude: ${context.brentCrudeUsd != null ? `$${context.brentCrudeUsd.toFixed(2)}/bbl` : "N/A"}
USD/NGN: ${context.ngnPerUsd != null ? `₦${context.ngnPerUsd.toFixed(2)}` : "N/A"}

Top-rated securities today: ${topList || "N/A"}

Write the daily market commentary.`;

  try {
    const openai = await getOpenAI();
    const response = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
    });

    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch (error) {
    console.error("[AI] CIE market commentary error:", error);
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// CIE Signal Draft (Feature C)
// ──────────────────────────────────────────────────────────────────────────────

// ── Zod schemas for AI JSON output validation ─────────────────────────────────

const CieScoreNarrativeSchema = z.object({
  headline: z.string().max(200).default(""),
  body: z.string().max(2000).default(""),
  keyPoints: z.array(z.string()).max(10).default([]),
  caveats: z.string().max(500).default(""),
});

const CieSignalDraftSchema = z.object({
  content: z.string().min(1).max(5000).default(""),
  suggestedType: z.enum(["trade_call", "news", "rumour", "sector_rotation"]).default("trade_call"),
  suggestedSentiment: z.enum(["bullish", "bearish", "neutral"]).default("neutral"),
  suggestedCredibility: z.number().int().min(1).max(5).default(3),
  suggestedTags: z.array(z.string()).max(10).default([]),
});

export interface CieSignalDraft {
  content: string;
  suggestedType: "trade_call" | "news" | "rumour" | "sector_rotation";
  suggestedSentiment: "bullish" | "bearish" | "neutral";
  suggestedCredibility: 1 | 2 | 3 | 4 | 5;
  suggestedTags: string[];
}

export async function generateCieSignalDraft(context: {
  prompt: string;
  ticker?: string | null;
  sector?: string | null;
  currentIas?: number | null;
  currentRecommendation?: string | null;
  signalType?: string | null;
}): Promise<CieSignalDraft | null> {
  const typeHint = context.signalType
    ? `The analyst has selected signal type: "${context.signalType}". Use this as the suggestedType unless it clearly does not fit the brief.`
    : "";

  const systemPrompt = `You are a senior Nigerian equity analyst at Cellion Intelligence Engine (CIE).
Draft a professional analyst signal based on the analyst's brief notes.
Signals are published to Pro-tier subscribers on the CIE platform.
${typeHint}

Return JSON with:
- content: the full signal text (100–400 words, professional Nigerian equity research tone)
- suggestedType: one of "trade_call" | "news" | "rumour" | "sector_rotation"
- suggestedSentiment: one of "bullish" | "bearish" | "neutral"
- suggestedCredibility: integer 1–5 (1=very low, 5=very high)
- suggestedTags: array of 2–5 relevant tags (e.g. ["FMCG", "dividend", "Q1 results"])

Be specific, reference Nigerian market context where relevant.`;

  const contextLines = [
    context.ticker ? `Ticker: ${context.ticker}` : "",
    context.sector ? `Sector: ${context.sector}` : "",
    context.currentIas != null ? `Current IAS: ${context.currentIas.toFixed(1)}` : "",
    context.currentRecommendation ? `Current Recommendation: ${context.currentRecommendation}` : "",
  ].filter(Boolean).join("\n");

  const userPrompt = `${contextLines ? contextLines + "\n\n" : ""}Analyst notes: ${context.prompt}

Draft the analyst signal.`;

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

    const rawContent = response.choices[0]?.message?.content || "{}";
    const rawObj = JSON.parse(rawContent);
    const parsed = CieSignalDraftSchema.safeParse(rawObj);
    if (!parsed.success) {
      console.error("[AI] CIE signal draft schema validation failed:", parsed.error.issues);
      return null;
    }
    return parsed.data as CieSignalDraft;
  } catch (error) {
    console.error("[AI] CIE signal draft error:", error);
    return null;
  }
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

