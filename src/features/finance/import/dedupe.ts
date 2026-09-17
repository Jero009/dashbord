// Dedupe for CSV import (T11): a row is a duplicate of an existing
// transaction when (date, abs(amount) to 0.01, name-prefix) all match.
// Pure — the caller queries the target month's rows once, in memory.

export interface ExistingTx {
  date: string;
  amount: number;
  name: string;
}

/** Name-prefix length for matching (bank descriptions get truncated differently per source). */
const PREFIX = 8;

function normalizeName(name: string): string {
  return String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isDuplicate(existing: ExistingTx[], tx: { date: string; amount: number; name: string }): boolean {
  const key = normalizeName(tx.name).slice(0, PREFIX);
  return existing.some(
    (e) =>
      e.date === tx.date &&
      Math.round(Math.abs(Number(e.amount)) * 100) === Math.round(Math.abs(tx.amount) * 100) &&
      normalizeName(e.name).slice(0, PREFIX) === key
  );
}

export interface ImportOutcome<T> {
  fresh: T[];
  duplicates: T[];
}

/** Split candidate transactions into fresh vs duplicates of `existing`. */
export function splitDuplicates<T extends { date: string; amount: number; name: string }>(
  existing: ExistingTx[],
  candidates: T[]
): ImportOutcome<T> {
  const fresh: T[] = [];
  const duplicates: T[] = [];
  // Grow the "existing" set with each accepted row so two identical lines in
  // one file don't both pass.
  for (const c of candidates) {
    if (isDuplicate(existing, c)) duplicates.push(c);
    else {
      fresh.push(c);
      existing.push({ date: c.date, amount: c.amount, name: c.name });
    }
  }
  return { fresh, duplicates };
}
