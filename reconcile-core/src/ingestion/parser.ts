import { ParsedDocument } from './types';

/** Detect the most likely delimiter in a raw text block. */
function detectDelimiter(sample: string): string {
  const candidates: [string, number][] = [
    [',', 0],
    ['\t', 0],
    ['|', 0],
  ];
  const lines = sample.split('\n').slice(0, 5).filter((l) => l.trim().length > 0);
  for (const line of lines) {
    for (const c of candidates) {
      c[1] += line.split(c[0]).length - 1;
    }
  }
  const best = candidates.sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : '';
}

/** Split a delimited line respecting simple quoting. */
function splitLine(line: string, delimiter: string): string[] {
  if (!delimiter) return [line.trim()];
  const results: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      results.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  results.push(current.trim());
  return results;
}

/** Heuristic: returns true if the value looks like a header label (not data). */
function looksLikeHeader(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return false;
  // Contains digit-dominant patterns → likely data
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return false;
  if (/^\d+([.,]\d+)*$/.test(v)) return false;
  if (/^[£$€]/.test(v)) return false;
  // Pure letters/underscores/spaces → likely header
  return /^[a-z_\s\-#/]+$/i.test(v);
}

/** Infer field type from a sample of values. */
function inferType(values: string[]): 'date' | 'amount' | 'reference' | 'text' {
  const nonEmpty = values.filter((v) => v.trim().length > 0).slice(0, 20);
  if (nonEmpty.length === 0) return 'text';

  const dateRe =
    /^\d{4}-\d{2}-\d{2}$|^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$|^\d{1,2}[\s\-][A-Za-z]{3}[\s\-]\d{2,4}$|^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}$|^\d{1,2}(?:st|nd|rd|th)\s+[A-Za-z]{3,9}\s+\d{4}$/i;
  const amountRe = /^[£$€GBP\s]*[\d,]+(?:\.\d{1,2})?$|^\d+(?:[.,]\d{3})*(?:[.,]\d{1,2})?$/;
  const referenceRe = /^[A-Z]{2,}[-_]?\d+$|^\d{5,}$|^[A-Z0-9]{6,}$/i;

  let dateScore = 0;
  let amountScore = 0;
  let refScore = 0;

  for (const v of nonEmpty) {
    const trimmed = v.trim().replace(/^[£$€GBP\s]+/, '').replace(/[,\s]/g, '');
    if (dateRe.test(v.trim())) dateScore++;
    else if (amountRe.test(v.trim()) || /^\d+(\.\d{1,2})?$/.test(trimmed)) amountScore++;
    else if (referenceRe.test(v.trim())) refScore++;
  }

  const total = nonEmpty.length;
  if (dateScore / total >= 0.5) return 'date';
  if (amountScore / total >= 0.5) return 'amount';
  if (refScore / total >= 0.5) return 'reference';
  return 'text';
}

/**
 * Parse a raw text/CSV document into a structured ParsedDocument.
 * Auto-detects delimiter, infers headers and field types, collects skipped rows.
 */
export function parseDocument(rawInput: string, label: string): ParsedDocument {
  const skippedRows: { raw: string; reason: string }[] = [];

  // Normalise line endings
  const rawLines = rawInput.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmptyLines = rawLines.filter((l) => l.trim().length > 0);

  if (nonEmptyLines.length === 0) {
    return { label, headers: [], rows: [], inferredTypes: {}, skippedRows };
  }

  const delimiter = detectDelimiter(nonEmptyLines.slice(0, 10).join('\n'));

  // Determine if first row is a header
  const firstCells = splitLine(nonEmptyLines[0], delimiter);
  const hasHeader = firstCells.every((c) => looksLikeHeader(c));

  let headers: string[];
  let dataLines: string[];

  if (hasHeader) {
    headers = firstCells.map((h) => h.trim().replace(/^["']|["']$/g, ''));
    dataLines = nonEmptyLines.slice(1);
  } else {
    headers = firstCells.map((_, i) => `col_${i + 1}`);
    dataLines = nonEmptyLines;
  }

  const rows: Record<string, string>[] = [];

  for (const line of dataLines) {
    if (!line.trim()) continue;
    const cells = splitLine(line, delimiter);

    if (delimiter && cells.length !== headers.length) {
      // Try to reconcile by padding or trimming
      if (cells.length < headers.length) {
        while (cells.length < headers.length) cells.push('');
      } else if (cells.length > headers.length + 2) {
        skippedRows.push({ raw: line, reason: `Column count mismatch: expected ${headers.length}, got ${cells.length}` });
        continue;
      }
    }

    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? '').trim().replace(/^["']|["']$/g, '');
    });
    rows.push(row);
  }

  // Infer types per column
  const inferredTypes: Record<string, 'date' | 'amount' | 'reference' | 'text'> = {};
  for (const header of headers) {
    const values = rows.map((r) => r[header] ?? '');
    inferredTypes[header] = inferType(values);
  }

  return { label, headers, rows, inferredTypes, skippedRows };
}
