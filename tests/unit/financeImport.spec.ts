import { describe, test, expect } from 'vitest';
import { parseCSV, detectDelimiter, normalizeImportDate, normalizeImportAmount } from '@/features/finance/import/parseCSV';
import { bankProfile, paypalProfile, detectProfile, categoryFor } from '@/features/finance/import/profiles';
import { isDuplicate, splitDuplicates } from '@/features/finance/import/dedupe';

describe('parseCSV', () => {
  test('comma delimiter with quoted fields and escaped quotes', () => {
    const rows = parseCSV('a,"b,1","c""x"""\n2,3,4');
    expect(rows[0]).toEqual(['a', 'b,1', 'c"x"']);
    expect(rows[1]).toEqual(['2', '3', '4']);
  });

  test('semicolon delimiter auto-detect (SI bank style)', () => {
    expect(detectDelimiter('Datum;Opis;Znesek\n17.9.2026;Hofer;-12,50')).toBe(';');
    const rows = parseCSV('Datum;Opis;Znesek\n17.9.2026;Hofer;-12,50');
    expect(rows[1]).toEqual(['17.9.2026', 'Hofer', '-12,50']);
  });

  test('CRLF and trailing blank lines are handled', () => {
    const rows = parseCSV('a,b\r\n1,2\r\n\r\n');
    expect(rows).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('normalizeImportDate / Amount', () => {
  test('SI date DD.MM.YYYY → YYYY-MM-DD', () => {
    expect(normalizeImportDate('17.9.2026')).toBe('2026-09-17');
    expect(normalizeImportDate('03.12.2026')).toBe('2026-12-03');
  });

  test('ISO date passes through; garbage → null', () => {
    expect(normalizeImportDate('2026-09-17')).toBe('2026-09-17');
    expect(normalizeImportDate('')).toBeNull();
    expect(normalizeImportDate('17/09/2026')).toBeNull();
  });

  test('SI amount 1.234,56 → 1234.56', () => {
    expect(normalizeImportAmount('-12,50')).toBe(-12.5);
    expect(normalizeImportAmount('1.234,56')).toBe(1234.56);
    expect(normalizeImportAmount('1,234.56 EUR')).toBe(1234.56);
    expect(normalizeImportAmount('€ 15')).toBe(15);
    expect(normalizeImportAmount('')).toBeNull();
  });
});

describe('category rules', () => {
  test('keyword matching with fallback other', () => {
    expect(categoryFor('HOFER LJUBLJANA 1234')).toBe('groceries');
    expect(categoryFor('PETROL d.d.')).toBe('transport');
    expect(categoryFor('NETFLIX.COM')).toBe('subscriptions');
    expect(categoryFor('Prenos claim 88')).toBe('other');
  });
});

describe('bank profile', () => {
  test('detectHeader matches NLB-ish columns', () => {
    expect(bankProfile.detectHeader(['Datum knjiženja', 'Opis', 'Znesek'])).toBe(true);
    expect(bankProfile.detectHeader(['Datum', 'Stanje'])).toBe(false);
  });

  test('signed amount: negative is expense, positive is income', () => {
    const rows = parseCSV('Datum;Opis;Znesek\n17.9.2026;HOFER 123;-12,50\n18.9.2026;Plača;1.200,00', ';');
    const txs = bankProfile.mapRows(rows, 7);
    expect(txs[0]).toMatchObject({ date: '2026-09-17', name: 'HOFER 123', amount: 12.5, type: 'expense', accountId: 7 });
    expect(txs[1]).toMatchObject({ date: '2026-09-18', name: 'Plača', amount: 1200, type: 'income' });
  });

  test('separate debit/credit columns', () => {
    const rows = parseCSV('Datum;Opis;Izhod;Prihodek\n17.9.2026;PETROL;25,10;\n17.9.2026;Vrni;;9,99', ';');
    const txs = bankProfile.mapRows(rows, 1);
    expect(txs[0].type).toBe('expense');
    expect(txs[0].amount).toBe(25.1);
    expect(txs[1].type).toBe('income');
    expect(txs[1].amount).toBe(9.99);
  });

  test('non-data rows (balance lines) are skipped', () => {
    const rows = parseCSV('Datum;Opis;Znesek\n17.9.2026;Stanje;neštevilka', ';');
    expect(bankProfile.mapRows(rows, 1)).toEqual([]);
  });
});

describe('paypal profile', () => {
  const csv = 'Datum,Name, Brutto, Gebühr, Netto\n17.09.2026,Some Sale,25,00,1,15,23,85';
  // NOTE: PayPal exports use comma decimals with comma delimiter? No — the
  // web export is comma-delimited with quoted numeric fields in EN, or
  // semicolon-delimited in DE locales. Test the quoted-EN form below.
  test('detectHeader and gross/fee/net collapse (quoted fields)', () => {
    const rows = parseCSV('Datum,Name," Brutto"," Gebühr"," Netto"\n17.09.2026,Some Sale,"25,00","1,15","23,85"');
    expect(paypalProfile.detectHeader(rows[0])).toBe(true);
    const txs = paypalProfile.mapRows(rows, 3);
    expect(txs[0]).toMatchObject({ date: '2026-09-17', name: 'Some Sale', amount: 25, type: 'income', accountId: 3 });
    expect(txs[0].notes).toBe('PayPal fee 1.15');
  });
});

describe('dedupe', () => {
  test('matches on date + rounded amount + name prefix', () => {
    const existing = [{ date: '2026-09-17', amount: 12.5, name: 'HOFER 123 LJ' }];
    expect(isDuplicate(existing, { date: '2026-09-17', amount: 12.5, name: 'HOFER 1234' })).toBe(true);
    expect(isDuplicate(existing, { date: '2026-09-18', amount: 12.5, name: 'HOFER 123' })).toBe(false);
    expect(isDuplicate(existing, { date: '2026-09-17', amount: 12.5, name: 'HOFER 999' })).toBe(false); // different payee
    expect(isDuplicate(existing, { date: '2026-09-17', amount: 12.5, name: 'HOFER 123 TRGOVINA' })).toBe(true); // longer desc, same prefix
  });

  test('re-importing the same file yields 0 new rows', () => {
    const file = [
      { date: '2026-09-17', amount: 12.5, name: 'HOFER 123', category: 'groceries' },
      { date: '2026-09-18', amount: 3.4, name: 'CAFE', category: 'food' },
    ];
    const first = splitDuplicates([], file);
    expect(first.fresh.length).toBe(2);
    const third = splitDuplicates(
      file.map(({ date, amount, name }) => ({ date, amount, name })),
      file
    );
    expect(third.fresh.length).toBe(0);
    expect(third.duplicates.length).toBe(2);
  });

  test('two identical lines in one file → only first is fresh', () => {
    const line = { date: '2026-09-17', amount: 5, name: 'DUP' };
    const out = splitDuplicates([], [line, { ...line }]);
    expect(out.fresh.length).toBe(1);
    expect(out.duplicates.length).toBe(1);
  });
});

describe('detectProfile', () => {
  test('sniffs paypal vs bank, falls back to bank', () => {
    expect(detectProfile(['Datum', 'Name', ' Brutto', ' Gebühr']).id).toBe('paypal');
    expect(detectProfile(['Datum', 'Opis', 'Znesek']).id).toBe('bank');
    expect(detectProfile(['whatever', 'columns']).id).toBe('bank');
  });
});
