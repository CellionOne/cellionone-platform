import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { ParsedDocument, FieldMapProposal } from '../ingestion/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Build a compact summary of a document for the AI prompt.
 */
function summariseDoc(doc: ParsedDocument): object {
  return {
    label: doc.label,
    headers: doc.headers,
    inferredTypes: doc.inferredTypes,
    sampleRows: doc.rows.slice(0, 5),
  };
}

/**
 * Use Claude to propose which fields from docA and docB correspond to
 * amount, date, reference, and entity name.
 */
export async function proposeFieldMap(
  docA: ParsedDocument,
  docB: ParsedDocument
): Promise<FieldMapProposal> {
  const prompt = `You are a reconciliation assistant. Given two structured datasets, identify which columns correspond to key financial fields.

Dataset A:
${JSON.stringify(summariseDoc(docA), null, 2)}

Dataset B:
${JSON.stringify(summariseDoc(docB), null, 2)}

Return ONLY a valid JSON object (no markdown fences, no explanation) matching this exact shape:
{
  "amountField": { "docA": "<column name>", "docB": "<column name>", "confidence": <0-1> },
  "dateField": { "docA": "<column name>", "docB": "<column name>", "confidence": <0-1> } or null,
  "referenceField": { "docA": "<column name>", "docB": "<column name>", "confidence": <0-1> } or null,
  "nameField": { "docA": "<column name>", "docB": "<column name>", "confidence": <0-1> } or null,
  "rationale": "<one sentence explanation>"
}

Rules:
- amountField is required; set confidence to 0 if truly absent
- Set other fields to null if no reasonable match exists
- Use exact column names from the headers provided
- Do not guess columns that don't exist`;

  const response = await client.messages.create({
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from AI field mapper');
  }

  let raw = content.text.trim();

  // Try direct parse
  try {
    return JSON.parse(raw) as FieldMapProposal;
  } catch {
    // Try extracting JSON object via regex
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as FieldMapProposal;
      } catch {
        // Fall through to error
      }
    }
    throw new Error(`Field mapper could not parse AI response as JSON.\nRaw response:\n${raw}`);
  }
}
