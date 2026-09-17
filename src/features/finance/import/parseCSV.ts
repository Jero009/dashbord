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

/** Parse a CSV string into rows of cells. Skips fully-empty trailing lines. */
export function parseCSV(raw: string, delimiter?: Delimiter): string[][] {
  const delim = delimiter ?? detectDelimiter(raw);
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
  while (i < raw.length) {
    const ch = raw[i];
    if (inQuotes) {
      if (ch === '"') {
        if (raw[i + 1] === '"') {
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
// bank standard) and YYYY-MM-DD. Returns a YYYY-MM-DD key or null.
export function normalizeImportDate(value: string): string | null {
  const v = String(value ?? '').trim();
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

// Amount normalization: SI formats use 1.234,56 (dot thousands, comma
// decimals); EN uses 1,234.56. Strips currency symbols and spaces.
export function normalizeImportAmount(value: string): number | null {
  let v = String(value ?? '').trim();
  if (!v) return null;
  v = v.replace(/[^\d.,+\-]/g, '');
  if (!v) return null;
  const hasComma = v.includes(',');
  const hasDot = v.includes('.');
  if (hasComma && hasDot) {
    // The rightmost separator is the decimal one.
    if (v.lastIndexOf(',') > v.lastIndexOf('.')) v = v.replace(/\./g, '').replace(',', '.');
    else v = v.replace(/,/g, '');
  } else if (hasComma) {
    v = v.replace(',', '.');
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
