import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import initSqlJs from 'sql.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRecurringPostPlan, type RecurringPostStatement } from '@/shared/db/financeDates';

type SqlJsDatabase = {
  run: (sql: string, params?: unknown[]) => void;
  exec: (sql: string) => Array<{ values: unknown[][] }>;
  close: () => void;
};

const executeAtomically = (db: SqlJsDatabase, statements: RecurringPostStatement[]) => {
  db.run('BEGIN');
  try {
    for (const item of statements) db.run(item.statement, item.values);
    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
};

describe('recurring posting SQL', () => {
  let db: SqlJsDatabase;

  beforeEach(async () => {
    const SQL = await initSqlJs({
      locateFile: (file: string) => join(process.cwd(), 'node_modules/sql.js/dist', file),
    });
    db = new SQL.Database() as SqlJsDatabase;
    db.run(`
      CREATE TABLE finance_subscription (
        id INTEGER PRIMARY KEY,
        last_posted_date TEXT,
        next_due_date TEXT CHECK(next_due_date <> 'reject')
      );
      CREATE TABLE finance_transaction (
        id INTEGER PRIMARY KEY,
        date TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL,
        notes TEXT,
        account_id INTEGER,
        recurring_id INTEGER,
        recurring_due_date TEXT
      );
      CREATE UNIQUE INDEX idx_finance_transaction_recurring_period
      ON finance_transaction(recurring_id, recurring_due_date)
      WHERE recurring_id IS NOT NULL AND recurring_due_date IS NOT NULL;
      INSERT INTO finance_subscription (id, next_due_date) VALUES (7, '2026-01-01');
    `);
  });

  afterEach(() => db.close());

  const plan = () => buildRecurringPostPlan({
    id: 7,
    name: 'Rent',
    amount: 900,
    cadence: 'monthly',
    nextDueDate: '2026-01-01',
    dueDates: ['2026-01-01', '2026-02-01'],
    accountId: 3,
    direction: 'expense',
    category: 'housing',
  });

  it('explicitly requests an executeSet transaction in the production DB path', () => {
    const source = readFileSync(join(process.cwd(), 'src/shared/db/app_db.ts'), 'utf8');
    expect(source).toContain('db.executeSet(plan.statements, true)');
  });

  it('deduplicates only the recurring-period unique conflict', () => {
    executeAtomically(db, plan().statements);
    executeAtomically(db, plan().statements);

    expect(db.exec('SELECT COUNT(*) FROM finance_transaction')[0].values[0][0]).toBe(2);
    expect(db.exec('SELECT next_due_date FROM finance_subscription WHERE id = 7')[0].values[0][0]).toBe('2026-03-01');
  });

  it('does not ignore unrelated constraint failures', () => {
    const statements = plan().statements.map((item) => ({ ...item, values: [...item.values] }));
    statements[0].values[2] = null;

    expect(() => executeAtomically(db, statements)).toThrow();
    expect(db.exec('SELECT COUNT(*) FROM finance_transaction')[0].values[0][0]).toBe(0);
    expect(db.exec('SELECT next_due_date FROM finance_subscription WHERE id = 7')[0].values[0][0]).toBe('2026-01-01');
  });

  it('rolls inserted periods back when schedule advancement fails', () => {
    const statements = plan().statements.map((item) => ({ ...item, values: [...item.values] }));
    statements.at(-1)!.values[1] = 'reject';

    expect(() => executeAtomically(db, statements)).toThrow();
    expect(db.exec('SELECT COUNT(*) FROM finance_transaction')[0].values[0][0]).toBe(0);
    expect(db.exec('SELECT next_due_date FROM finance_subscription WHERE id = 7')[0].values[0][0]).toBe('2026-01-01');
  });
});
