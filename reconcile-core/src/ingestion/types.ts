export interface ParsedDocument {
  label: string;
  headers: string[];
  rows: Record<string, string>[];
  inferredTypes: Record<string, 'date' | 'amount' | 'reference' | 'text'>;
  skippedRows: { raw: string; reason: string }[];
}

export interface FieldMapProposal {
  amountField: { docA: string; docB: string; confidence: number };
  dateField: { docA: string; docB: string; confidence: number } | null;
  referenceField: { docA: string; docB: string; confidence: number } | null;
  nameField: { docA: string; docB: string; confidence: number } | null;
  rationale: string;
}

export interface ReconciliationConfig {
  dateToleranceDays: number;
  amountTolerance: { type: 'exact' | 'absolute' | 'percentage'; value: number };
  nameMatchMode: 'fuzzy' | 'exact' | 'ignore';
  extraInstructions?: string;
}

export interface ReconciliationRow {
  refA: string | null;
  refB: string | null;
  identifier: string;
  dateA: string | null;
  amountA: number | null;
  amountB: number | null;
  difference: number | null;
  confidence: number;
  status: 'MATCHED' | 'PARTIAL' | 'EXCEPTION';
  note: string;
}

export interface ReconciliationResult {
  summary: {
    totalA: number;
    totalB: number;
    matched: number;
    partial: number;
    exceptions: number;
    matchRate: number;
    totalAmountA: number;
    totalAmountB: number;
    variance: number;
    narrative: string;
  };
  rows: ReconciliationRow[];
}
