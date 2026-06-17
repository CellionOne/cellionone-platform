import 'dotenv/config';
export { ReconciliationConfig, ReconciliationResult } from './ingestion/types';

import { parseDocument } from './ingestion/parser';
import { proposeFieldMap } from './matching/fieldMapper';
import { runReconciliation } from './matching/matchEngine';
import { ReconciliationConfig, ReconciliationResult } from './ingestion/types';

/**
 * Top-level reconcile function.
 * Parses both raw documents, proposes a field map via AI, then runs reconciliation.
 *
 * @param rawA - Raw text content of Set A (CSV, TSV, or delimited)
 * @param rawB - Raw text content of Set B
 * @param config - Reconciliation configuration (tolerances, match mode)
 * @returns Full reconciliation result with summary and row-level detail
 */
export async function reconcile(
  rawA: string,
  rawB: string,
  config: ReconciliationConfig
): Promise<ReconciliationResult> {
  const docA = parseDocument(rawA, 'Set A');
  const docB = parseDocument(rawB, 'Set B');

  const fieldMap = await proposeFieldMap(docA, docB);
  const result = await runReconciliation(docA, docB, fieldMap, config);

  return result;
}
