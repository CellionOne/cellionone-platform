/**
 * Utility functions for date/amount normalisation and tolerance checking.
 * All functions are pure — no API calls or side effects.
 */

const MONTH_MAP: Record<string, string> = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12',
};

/**
 * Parse any reasonable date string and return ISO YYYY-MM-DD.
 * Examples:
 *   normaliseDate("01/15/2024") => "2024-01-15"
 *   normaliseDate("15-Jan-2024") => "2024-01-15"
 *   normaliseDate("January 15, 2024") => "2024-01-15"
 *   normaliseDate("2024-01-15") => "2024-01-15"
 */
export function normaliseDate(raw: string): string {
  const s = raw.trim().replace(/\s+/g, ' ');

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // YYYY/MM/DD
  const isoSlash = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (isoSlash) return `${isoSlash[1]}-${isoSlash[2]}-${isoSlash[3]}`;

  // DD/MM/YYYY or MM/DD/YYYY — heuristic: if day > 12, it's DD/MM
  const slashDMY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDMY) {
    const [, a, b, y] = slashDMY;
    const aNum = parseInt(a, 10);
    const bNum = parseInt(b, 10);
    // If first part > 12, must be day
    if (aNum > 12) {
      return `${y}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
    }
    // Otherwise assume MM/DD/YYYY (US)
    return `${y}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
  }

  // DD-MM-YYYY or DD-Mon-YYYY
  const dashDMY = s.match(/^(\d{1,2})[-\s](\d{1,2}|\w{3,9})[-\s,](\d{4})$/i);
  if (dashDMY) {
    const [, a, b, y] = dashDMY;
    const monthNum = MONTH_MAP[b.toLowerCase()];
    if (monthNum) {
      return `${y}-${monthNum}-${a.padStart(2, '0')}`;
    }
    const bNum = parseInt(b, 10);
    const aNum = parseInt(a, 10);
    if (!isNaN(bNum) && !isNaN(aNum)) {
      if (aNum > 12) return `${y}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
      return `${y}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
    }
  }

  // "1st March 2024" / "15th March 2024"
  const ordinal = s.match(/^(\d{1,2})(?:st|nd|rd|th)\s+([A-Za-z]+)\s+(\d{4})$/i);
  if (ordinal) {
    const [, d, m, y] = ordinal;
    const monthNum = MONTH_MAP[m.toLowerCase()];
    if (monthNum) return `${y}-${monthNum}-${d.padStart(2, '0')}`;
  }

  // "March 15, 2024" / "March 15 2024"
  const longMonth = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (longMonth) {
    const [, m, d, y] = longMonth;
    const monthNum = MONTH_MAP[m.toLowerCase()];
    if (monthNum) return `${y}-${monthNum}-${d.padStart(2, '0')}`;
  }

  // Fallback: try native Date parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  throw new Error(`Cannot parse date: "${raw}"`);
}

/**
 * Check if two date strings are within toleranceDays of each other.
 * Examples:
 *   isWithinDateTolerance("2024-01-01", "2024-01-03", 3) => true
 *   isWithinDateTolerance("2024-01-01", "2024-01-05", 3) => false
 */
export function isWithinDateTolerance(
  dateA: string,
  dateB: string,
  toleranceDays: number
): boolean {
  try {
    const a = new Date(normaliseDate(dateA)).getTime();
    const b = new Date(normaliseDate(dateB)).getTime();
    const diffDays = Math.abs(a - b) / (1000 * 60 * 60 * 24);
    return diffDays <= toleranceDays;
  } catch {
    return false;
  }
}

/**
 * Strip currency symbols, commas, whitespace and return a float.
 * Examples:
 *   normaliseAmount("£1,250.00") => 1250
 *   normaliseAmount("GBP 1250") => 1250
 *   normaliseAmount("$1,234.56") => 1234.56
 *   normaliseAmount("1.250,00") => 1250 (European format)
 */
export function normaliseAmount(raw: string): number {
  let s = raw.trim();

  // Strip currency codes/symbols
  s = s.replace(/^(GBP|USD|EUR|CAD|AUD)\s*/i, '');
  s = s.replace(/[£$€]/g, '');
  s = s.trim();

  // European format: 1.250,00 — period as thousands sep, comma as decimal
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // Standard format: remove thousands commas
    s = s.replace(/,/g, '');
  }

  const result = parseFloat(s);
  if (isNaN(result)) throw new Error(`Cannot parse amount: "${raw}"`);
  return result;
}

/**
 * Check if two amounts are within tolerance.
 * Examples (absolute):
 *   isWithinAmountTolerance(100, 100.50, {type:'absolute', value:1}) => true
 * Examples (percentage):
 *   isWithinAmountTolerance(1000, 1005, {type:'percentage', value:1}) => true
 */
export function isWithinAmountTolerance(
  amountA: number,
  amountB: number,
  tolerance: { type: 'exact' | 'absolute' | 'percentage'; value: number }
): boolean {
  const diff = Math.abs(amountA - amountB);
  switch (tolerance.type) {
    case 'exact':
      return amountA === amountB;
    case 'absolute':
      return diff <= tolerance.value;
    case 'percentage': {
      const base = Math.max(Math.abs(amountA), Math.abs(amountB));
      if (base === 0) return amountB === 0;
      return (diff / base) * 100 <= tolerance.value;
    }
  }
}
