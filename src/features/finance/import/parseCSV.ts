// Generic CSV parser (T11). RFC4180-ish: quoted fields, escaped quotes,
// CRLF/LF line endings, `,` vs `;` delimiter auto-detect. Pure — no DOM/DB.

export type Delimiter = ',' | ';';

export function detectDelimiter(raw: string): Delimiter {
  // Count candidate delimiters in the first non-empty line, outside quotes.
  const firstLine = raw.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
  let comma = 0;
  let semi = 0;
  let inQuotes = false;
  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (ch === ',') comma++;
      else if (ch === ';') semi++;
    }
  }
  return semi > comma ? ';' : ',';
}

/** Parse a CSV string into rows of cells. Skips fully-empty trailing lines.
 *  Strips a leading UTF-8 BOM so Excel "CSV UTF-8" exports don't break the
 *  anchored header patterns (^date, ^amount, …). */
export function parseCSV(raw: string, delimiter?: Delimiter): string[][] {
  const delim = delimiter ?? detectDelimiter(raw);
  const text = raw.startsWith('\uFEFF') ? raw.slice(1) : raw;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;
  const pushCell = () => {
    row.push(cell);
    cell = '';
  };
  const pushRow = () => {
    pushCell();
    // skip rows where every cell is empty (blank lines)
    if (row.some((c) => c.trim().length > 0)) rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
    } else if (ch === delim) {
      pushCell();
      i++;
    } else if (ch === '\r') {
      i++; // consume \r\n or lone \r as row end
    } else if (ch === '\n') {
      pushRow();
      i++;
    } else {
      cell += ch;
      i++;
    }
  }
  if (cell.length > 0 || row.length > 0) pushRow();
  return rows;
}

// Local-safe date normalization for import sources. Accepts DD.MM.YYYY (SI
// bank standard), D.M.YYYY, and YYYY-MM-DD. Calendar-validated — returns a
// YYYY-MM-DD key or null.
export function normalizeImportDate(value: string): string | null {
  const v = String(value ?? '').trim();
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v);
  if (m) {
    const [, d, mo, y] = m;
    const day = Number(d);
    const month = Number(mo);
    if (month < 1 || month > 12) return null;
    const daysInMonth = new Date(Number(y), month, 0).getDate();
    if (day < 1 || day > daysInMonth) return null; // no 31.02. rolling into March
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) {
    const day = Number(m[3]);
    const month = Number(m[2]);
    if (month < 1 || month > 12) return null;
    const daysInMonth = new Date(Number(m[1]), month, 0).getDate();
    if (day < 1 || day > daysInMonth) return null;
    return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return null;
}

// Amount normalization: SI formats use 1.234,56 (dot thousands, comma
// decimals); EN uses 1,234.56. Strips currency symbols and spaces. A lone
// separator followed by exactly 3 digits is treated as grouping (1,234 = 1234).
export function normalizeImportAmount(value: string): number | null {
  let v = String(value ?? '').trim();
  if (!v) return null;
  v = v.replace(/[^\d.,+-]/g, '');
  if (!v) return null;
  const hasComma = v.includes(',');
  const hasDot = v.includes('.');
  if (hasComma && hasDot) {
    // The rightmost separator is the decimal one.
    if (v.lastIndexOf(',') > v.lastIndexOf('.')) v = v.replace(/\./g, '').replace(',', '.');
    else v = v.replace(/,/g, '');
  } else if (hasComma || hasDot) {
    const sep = hasComma ? ',' : '.';
    const parts = v.split(sep);
    const last = parts[parts.length - 1];
    if (parts.length === 2 && last.length === 3) {
      // Ambiguous: "1,234" could be 1234 (grouping) or 1.234 (decimal).
      // Bank/paypal statements at this granularity are thousands — treat as
      // grouping. "1,23" / "1,2345" stay decimal.
      v = parts.join('');
    } else if (parts.length > 2 || last.length === 3) {
      // "1,234,567" — consistent grouping.
      v = parts.join('');
    } else {
      v = v.replace(sep === ',' ? /,/g : /\./g, '.');
    }
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
