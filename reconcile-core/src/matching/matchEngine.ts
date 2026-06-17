import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { ParsedDocument, FieldMapProposal, ReconciliationConfig, ReconciliationResult, ReconciliationRow } from '../ingestion/types';
import { normaliseAmount, normaliseDate, isWithinAmountTolerance, isWithinDateTolerance } from './tolerances';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const AI_BATCH_SIZE = 30;

interface ExtractedRow {
  index: number;
  raw: Record<string, string>;
  amount: number | null;
  date: string | null;
  reference: string | null;
  name: string | null;
  identifier: string;
}

/** Extract typed fields from a parsed doc row using the field map. */
function extractRow(
  raw: Record<string, string>,
  index: number,
  docKey: 'docA' | 'docB',
  fieldMap: FieldMapProposal
): ExtractedRow {
  let amount: number | null = null;
  let date: string | null = null;
  let reference: string | null = null;
  let name: string | null = null;

  const amountCol = fieldMap.amountField[docKey];
  if (amountCol && raw[amountCol] !== undefined) {
    try { amount = normaliseAmount(raw[amountCol]); } catch { /* leave null */ }
  }

  if (fieldMap.dateField) {
    const dateCol = fieldMap.dateField[docKey];
    if (dateCol && raw[dateCol] !== undefined) {
      try { date = normaliseDate(raw[dateCol]); } catch { /* leave null */ }
    }
  }

  if (fieldMap.referenceField) {
    const refCol = fieldMap.referenceField[docKey];
    if (refCol && raw[refCol] !== undefined) {
      reference = raw[refCol].trim() || null;
    }
  }

  if (fieldMap.nameField) {
    const nameCol = fieldMap.nameField[docKey];
    if (nameCol && raw[nameCol] !== undefined) {
      name = raw[nameCol].trim() || null;
    }
  }

  const identifier = reference ?? name ?? `row-${index + 1}`;

  return { index, raw, amount, date, reference, name, identifier };
}

/** Deterministic match attempt between one A-row and all available B-rows. */
function tryDeterministicMatch(
  rowA: ExtractedRow,
  candidates: ExtractedRow[],
  fieldMap: FieldMapProposal,
  config: ReconciliationConfig
): { match: ExtractedRow; confidence: number; note: string } | null {
  if (rowA.amount === null) return null;

  for (const rowB of candidates) {
    if (rowB.amount === null) continue;

    const amountOk = isWithinAmountTolerance(rowA.amount, rowB.amount, config.amountTolerance);
    if (!amountOk) continue;

    let fieldsMatched = 1; // amount
    const notes: string[] = [];

    // Date check
    if (fieldMap.dateField && rowA.date && rowB.date) {
      if (isWithinDateTolerance(rowA.date, rowB.date, config.dateToleranceDays)) {
        fieldsMatched++;
      } else {
        notes.push(`Date mismatch: ${rowA.date} vs ${rowB.date}`);
      }
    }

    // Reference check
    if (fieldMap.referenceField && rowA.reference && rowB.reference) {
      if (rowA.reference === rowB.reference) {
        fieldsMatched += 2; // strong signal
      } else {
        notes.push(`Reference mismatch: ${rowA.reference} vs ${rowB.reference}`);
      }
    }

    const totalPossible = 1 +
      (fieldMap.dateField ? 1 : 0) +
      (fieldMap.referenceField ? 2 : 0);

    const confidence = fieldsMatched / totalPossible;

    if (confidence >= 0.5) {
      return {
        match: rowB,
        confidence: Math.min(confidence, 1.0),
        note: notes.length > 0 ? notes.join('; ') : 'Deterministic match',
      };
    }
  }

  return null;
}

interface AiMatchProposal {
  refA: string;
  refB: string;
  identifier: string;
  confidence: number;
  note: string;
  status: 'MATCHED' | 'PARTIAL' | 'EXCEPTION';
}

/** Ask Claude to match batches of unmatched rows. */
async function aiMatchBatch(
  unmatchedA: ExtractedRow[],
  unmatchedB: ExtractedRow[]
): Promise<AiMatchProposal[]> {
  const prompt = `You are a reconciliation engine. Match items from Set A to items from Set B based on amount, date, reference, and entity name similarity.

Set A (unmatched items):
${JSON.stringify(unmatchedA.map((r) => ({ index: r.index, identifier: r.identifier, amount: r.amount, date: r.date, reference: r.reference, name: r.name })), null, 2)}

Set B (unmatched items):
${JSON.stringify(unmatchedB.map((r) => ({ index: r.index, identifier: r.identifier, amount: r.amount, date: r.date, reference: r.reference, name: r.name })), null, 2)}

Return ONLY a valid JSON array (no markdown, no explanation) of match proposals. Each element:
{
  "refA": "<identifier from Set A or null>",
  "refB": "<identifier from Set B or null>",
  "identifier": "<the best common identifier>",
  "confidence": <0.0-1.0>,
  "note": "<brief reason>",
  "status": "MATCHED" | "PARTIAL" | "EXCEPTION"
}

Rules:
- Only propose matches where you have reasonable confidence
- Use "MATCHED" for high-confidence (>=0.85), "PARTIAL" for moderate (0.5-0.84), "EXCEPTION" for unmatched items
- Unmatched items from either set should appear as EXCEPTION with refB or refA set to null
- Do not fabricate data — base matches only on the provided values
- Use neutral terms: identifier, entity, item, transaction`;

  const response = await client.messages.create({
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected AI response type in match engine');

  const raw = content.text.trim();

  try {
    return JSON.parse(raw) as AiMatchProposal[];
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as AiMatchProposal[];
      } catch { /* fall through */ }
    }
    throw new Error(`Match engine could not parse AI batch response.\nRaw:\n${raw}`);
  }
}

/**
 * Run the full reconciliation pipeline.
 * Uses deterministic matching first, then AI-assisted matching for remainders.
 */
export async function runReconciliation(
  docA: ParsedDocument,
  docB: ParsedDocument,
  fieldMap: FieldMapProposal,
  config: ReconciliationConfig
): Promise<ReconciliationResult> {
  const rowsA = docA.rows.map((r, i) => extractRow(r, i, 'docA', fieldMap));
  const rowsB = docB.rows.map((r, i) => extractRow(r, i, 'docB', fieldMap));

  const reconciliationRows: ReconciliationRow[] = [];
  const matchedBIndices = new Set<number>();
  const unmatchedAIndices: number[] = [];

  // --- Pass 1: Deterministic matching ---
  for (const rowA of rowsA) {
    const availableB = rowsB.filter((b) => !matchedBIndices.has(b.index));
    const result = tryDeterministicMatch(rowA, availableB, fieldMap, config);

    if (result) {
      matchedBIndices.add(result.match.index);
      const diff = rowA.amount !== null && result.match.amount !== null
        ? parseFloat((rowA.amount - result.match.amount).toFixed(4))
        : null;

      reconciliationRows.push({
        refA: rowA.reference ?? String(rowA.index + 1),
        refB: result.match.reference ?? String(result.match.index + 1),
        identifier: rowA.identifier,
        dateA: rowA.date,
        amountA: rowA.amount,
        amountB: result.match.amount,
        difference: diff,
        confidence: result.confidence,
        status: result.confidence >= 0.85 ? 'MATCHED' : 'PARTIAL',
        note: result.note,
      });
    } else {
      unmatchedAIndices.push(rowA.index);
    }
  }

  const unmatchedBIndices = rowsB
    .filter((b) => !matchedBIndices.has(b.index))
    .map((b) => b.index);

  // --- Pass 2: AI-assisted matching for unmatched rows ---
  const unmatchedA = rowsA.filter((r) => unmatchedAIndices.includes(r.index));
  const unmatchedB = rowsB.filter((r) => unmatchedBIndices.includes(r.index));

  if (unmatchedA.length > 0 || unmatchedB.length > 0) {
    // Batch into groups of AI_BATCH_SIZE
    const processedAInAI = new Set<number>();
    const processedBInAI = new Set<number>();

    for (let i = 0; i < Math.max(unmatchedA.length, unmatchedB.length); i += AI_BATCH_SIZE) {
      const batchA = unmatchedA.slice(i, i + AI_BATCH_SIZE);
      const batchB = unmatchedB.slice(i, i + AI_BATCH_SIZE);

      if (batchA.length === 0 && batchB.length === 0) break;

      let proposals: AiMatchProposal[] = [];
      try {
        proposals = await aiMatchBatch(batchA, batchB);
      } catch (err) {
        // If AI fails, mark all as EXCEPTION
        console.error('AI match batch failed:', err);
      }

      for (const proposal of proposals) {
        const aRow = batchA.find((r) => r.identifier === proposal.refA || String(r.index + 1) === proposal.refA);
        const bRow = batchB.find((r) => r.identifier === proposal.refB || String(r.index + 1) === proposal.refB);

        if (aRow) processedAInAI.add(aRow.index);
        if (bRow) processedBInAI.add(bRow.index);

        const diff = aRow?.amount != null && bRow?.amount != null
          ? parseFloat((aRow.amount - bRow.amount).toFixed(4))
          : null;

        reconciliationRows.push({
          refA: proposal.refA ?? null,
          refB: proposal.refB ?? null,
          identifier: proposal.identifier,
          dateA: aRow?.date ?? null,
          amountA: aRow?.amount ?? null,
          amountB: bRow?.amount ?? null,
          difference: diff,
          confidence: proposal.confidence,
          status: proposal.status,
          note: `[AI] ${proposal.note}`,
        });
      }

      // Any items not covered by proposals become EXCEPTIONs
      for (const aRow of batchA) {
        if (!processedAInAI.has(aRow.index)) {
          reconciliationRows.push({
            refA: aRow.reference ?? String(aRow.index + 1),
            refB: null,
            identifier: aRow.identifier,
            dateA: aRow.date,
            amountA: aRow.amount,
            amountB: null,
            difference: null,
            confidence: 0,
            status: 'EXCEPTION',
            note: 'No matching item found in Set B',
          });
        }
      }

      for (const bRow of batchB) {
        if (!processedBInAI.has(bRow.index)) {
          reconciliationRows.push({
            refA: null,
            refB: bRow.reference ?? String(bRow.index + 1),
            identifier: bRow.identifier,
            dateA: null,
            amountA: null,
            amountB: bRow.amount,
            difference: null,
            confidence: 0,
            status: 'EXCEPTION',
            note: 'No matching item found in Set A',
          });
        }
      }
    }
  }

  // --- Compute summary ---
  const matched = reconciliationRows.filter((r) => r.status === 'MATCHED').length;
  const partial = reconciliationRows.filter((r) => r.status === 'PARTIAL').length;
  const exceptions = reconciliationRows.filter((r) => r.status === 'EXCEPTION').length;

  const totalAmountA = rowsA.reduce((s, r) => s + (r.amount ?? 0), 0);
  const totalAmountB = rowsB.reduce((s, r) => s + (r.amount ?? 0), 0);
  const variance = parseFloat((totalAmountA - totalAmountB).toFixed(4));

  const totalItems = docA.rows.length + docB.rows.length;
  const matchRate = totalItems > 0
    ? parseFloat(((matched + partial) / Math.max(docA.rows.length, docB.rows.length) * 100).toFixed(2))
    : 0;

  const narrative =
    `Reconciliation complete. Set A had ${docA.rows.length} items (total ${totalAmountA.toFixed(2)}), ` +
    `Set B had ${docB.rows.length} items (total ${totalAmountB.toFixed(2)}). ` +
    `${matched} item(s) matched exactly, ${partial} partially, ${exceptions} exception(s). ` +
    `Overall match rate: ${matchRate}%. Net variance: ${variance.toFixed(2)}.`;

  return {
    summary: {
      totalA: docA.rows.length,
      totalB: docB.rows.length,
      matched,
      partial,
      exceptions,
      matchRate,
      totalAmountA: parseFloat(totalAmountA.toFixed(4)),
      totalAmountB: parseFloat(totalAmountB.toFixed(4)),
      variance,
      narrative,
    },
    rows: reconciliationRows,
  };
}
