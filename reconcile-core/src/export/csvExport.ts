import { ReconciliationResult } from '../ingestion/types';

/** Escape a single CSV field value. */
function escapeField(value: string | number | null): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export a ReconciliationResult to a CSV string.
 * Headers: refA,refB,identifier,dateA,amountA,amountB,difference,confidence,status,note
 */
export function exportToCsv(result: ReconciliationResult): string {
  const headers = [
    'refA', 'refB', 'identifier', 'dateA',
    'amountA', 'amountB', 'difference', 'confidence', 'status', 'note',
  ];

  const lines: string[] = [headers.join(',')];

  for (const row of result.rows) {
    const cells = [
      escapeField(row.refA),
      escapeField(row.refB),
      escapeField(row.identifier),
      escapeField(row.dateA),
      escapeField(row.amountA),
      escapeField(row.amountB),
      escapeField(row.difference),
      escapeField(row.confidence),
      escapeField(row.status),
      escapeField(row.note),
    ];
    lines.push(cells.join(','));
  }

  return lines.join('\n');
}
