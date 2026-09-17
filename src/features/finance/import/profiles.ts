// Import profiles (T11): per-source column mapping + normalization. Pure.
// Each profile takes the FULL parsed row list (header row included), finds its
// columns in the header, and maps the data rows below it.
import type { Delimiter } from './parseCSV';
import { normalizeImportDate, normalizeImportAmount } from './parseCSV';

export interface NewTransaction {
  date: string; // YYYY-MM-DD
  name: string;
  amount: number; // absolute value
  type: 'income' | 'expense';
  category: string;
  accountId: number | null;
  notes?: string;
}

export interface ImportProfile {
  id: string;
  label: string;
  /** Sniff whether a header row fits this profile. */
  detectHeader: (row: string[]) => boolean;
  /** Map all rows of a file (header first). Data rows that can't be parsed are skipped. */
  mapRows: (rows: string[][], accountId: number | null) => NewTransaction[];
}

// ── keyword → category rules (single editable array, order = priority) ──
const CATEGORY_RULES: Array<[RegExp, string]> = [
  [/\b(trgovina|hofer|mercator|spar|tus|lidl|dm\b|jager|konsuma)/i, 'groceries'],
  [/\b(petrol|zalog|mols|omv|avtobus|vlak|parking|parkirn)/i, 'transport'],
  [/\b(netflix|spotify|hbo|disney|prime video|youtube premium|icloud|google one)/i, 'subscriptions'],
  [/\b(kavarna|kaf[eé]|mcdonald|kfc|pizzeria|restavrac|host|logi)/i, 'food'],
  [/\b(apotek|lekar|health|fitnes|gym|smartno)/i, 'health'],
  [/\b(mobitel|telekom|a1\b|telemach|elektro|toplarn|vodovod|komunal)/i, 'utilities'],
  [/\b(amazon|aliexpress|eurospin|pepco|action|hm\b|zara|intersport)/i, 'shopping'],
];

export function categoryFor(name: string): string {
  for (const [re, cat] of CATEGORY_RULES) if (re.test(name)) return cat;
  return 'other';
}

function findCol(lower: string[], patterns: RegExp[]): number {
  for (const re of patterns) {
    const idx = lower.findIndex((c) => re.test(c));
    if (idx >= 0) return idx;
  }
  return -1;
}

// ── generic bank profile (NLB/Intesa/SKB-style: datum; opis; znesek) ──
// Handles either a signed amount column (Znesek/Amount) or separate
// debit/credit columns (Izhod/Prihodek, Debit/Credit).
function detectBankHeader(row: string[]): boolean {
  const lower = row.map((c) => c.trim().toLowerCase());
  const hasDate = lower.some((c) => c.includes('datum') || c === 'date' || c.startsWith('date'));
  const hasDesc = lower.some((c) => c.includes('opis') || c.includes('description') || c.includes('naziv'));
  const hasAmount =
    lower.some((c) => c.includes('znesek') || c.includes('amount') || c.includes('izhod') || c.includes('prihodek') || c.includes('debit') || c.includes('credit'));
  return hasDate && (hasDesc || hasAmount);
}

export const bankProfile: ImportProfile = {
  id: 'bank',
  label: 'Bank CSV (NLB / Intesa / generic)',
  detectHeader: detectBankHeader,
  mapRows: (rows, accountId) => {
    if (rows.length < 2) return [];
    const lower = rows[0].map((c) => c.trim().toLowerCase());
    const dateIdx = findCol(lower, [/datum/, /^date/]);
    const descIdx = findCol(lower, [/opis/, /description/, /naziv/]);
    const signedIdx = findCol(lower, [/znesek/, /^amount/]);
    const debitIdx = findCol(lower, [/izhod/, /debit/]);
    const creditIdx = findCol(lower, [/prihodek/, /credit/]);
    if (dateIdx < 0) return [];
    const out: NewTransaction[] = [];
    for (const row of rows.slice(1)) {
      const date = normalizeImportDate(row[dateIdx]);
      if (!date) continue; // balance rows, footers, blanks
      const name = (descIdx >= 0 ? row[descIdx] : '').trim() || 'Unknown';
      if (signedIdx >= 0) {
        const raw = normalizeImportAmount(row[signedIdx]);
        if (raw == null || raw === 0) continue;
        // Signed column: negative = money out (expense), positive = money in.
        out.push({ date, name, amount: Math.abs(raw), type: raw < 0 ? 'expense' : 'income', category: categoryFor(name), accountId });
        continue;
      }
      const debit = debitIdx >= 0 ? normalizeImportAmount(row[debitIdx]) : null;
      const credit = creditIdx >= 0 ? normalizeImportAmount(row[creditIdx]) : null;
      if (debit != null && debit !== 0) {
        out.push({ date, name, amount: Math.abs(debit), type: 'expense', category: categoryFor(name), accountId });
      } else if (credit != null && credit !== 0) {
        out.push({ date, name, amount: Math.abs(credit), type: 'income', category: categoryFor(name), accountId });
      }
    }
    return out;
  },
};

// ── PayPal profile: web export (Activity → Statements → CSV) with
// Gross/Brutto, Fee/Gebühr and Net/Netto columns. The transaction is ONE row;
// the fee is collapsed into notes so totals stay gross-accurate.
function detectPaypalHeader(row: string[]): boolean {
  const lower = row.map((c) => c.trim().toLowerCase());
  return (
    lower.some((c) => c.includes('brutto') || c.includes('gross')) &&
    lower.some((c) => c.includes('gebühr') || c.includes('fee') || c.includes('netto') || /(^|[^a-z])net([^a-z]|$)/.test(c))
  );
}

export const paypalProfile: ImportProfile = {
  id: 'paypal',
  label: 'PayPal (Activity export)',
  detectHeader: detectPaypalHeader,
  mapRows: (rows, accountId) => {
    if (rows.length < 2) return [];
    const lower = rows[0].map((c) => c.trim().toLowerCase());
    const dateIdx = findCol(lower, [/datum/, /^date/]);
    const nameIdx = findCol(lower, [/name/, /naziv/]);
    const grossIdx = findCol(lower, [/brutto/, /gross/]);
    const feeIdx = findCol(lower, [/gebühr/, /fee/]);
    if (dateIdx < 0 || grossIdx < 0) return [];
    const out: NewTransaction[] = [];
    for (const row of rows.slice(1)) {
      const date = normalizeImportDate(row[dateIdx]);
      if (!date) continue;
      const gross = normalizeImportAmount(row[grossIdx]);
      if (gross == null || gross === 0) continue;
      const fee = feeIdx >= 0 ? normalizeImportAmount(row[feeIdx]) : null;
      const name = (nameIdx >= 0 ? row[nameIdx] : 'PayPal').trim() || 'PayPal';
      const type = gross < 0 ? 'expense' : 'income';
      out.push({
        date,
        name,
        amount: Math.abs(gross),
        type,
        category: categoryFor(name),
        accountId,
        notes: fee != null && fee !== 0 ? `PayPal fee ${Math.abs(fee).toFixed(2)}` : undefined,
      });
    }
    return out;
  },
};

export const IMPORT_PROFILES: ImportProfile[] = [paypalProfile, bankProfile];

/** Auto-detect which profile fits a file; falls back to the bank profile. */
export function detectProfile(headerRow: string[]): ImportProfile {
  for (const p of IMPORT_PROFILES) if (p.detectHeader(headerRow)) return p;
  return bankProfile;
}
