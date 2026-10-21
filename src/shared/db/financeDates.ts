// Local-calendar-date helpers for subscription cadence math. Never use
// toISOString() here: local midnight rendered in UTC lands on the previous
// day for UTC+ timezones (the toDateKey pitfall) and silently drifts due
// dates backwards one day per period.

// Advance a YYYY-MM-DD date key by one cadence step, staying in calendar-date
// space (no Date round-trip, so no timezone shift). Month-end clamps:
// Jan 31 + monthly = Feb 28.
export function nextDueAfter(dateKey: string, cadence: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  let month = m - 1;
  let day = d;
  if (cadence === 'yearly') month += 12;
  else if (cadence === 'weekly') day += 7;
  else if (cadence === 'quarterly') month += 3;
  else month += 1;
  // Normalize year overflow (month ≥ 12 rolls into the next year), then clamp
  // to end of month (Jan 31 → Feb 28). No local-time Date round-trip.
  const year = y + Math.floor(month / 12);
  month = ((month % 12) + 12) % 12;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  if (day > daysInMonth) day = daysInMonth;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

const MAX_CATCH_UP_PERIODS = 120;

/** Due periods from `nextDueDate` through `throughDate`, oldest first. */
export function dueDatesThrough(nextDueDate: string, cadence: string, throughDate: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDueDate) || !/^\d{4}-\d{2}-\d{2}$/.test(throughDate)) return [];
  const dates: string[] = [];
  let due = nextDueDate;
  while (due <= throughDate && dates.length < MAX_CATCH_UP_PERIODS) {
    dates.push(due);
    const next = nextDueAfter(due, cadence);
    if (next <= due) break;
    due = next;
  }
  return dates;
}

export interface RecurringPostStatement {
  statement: string;
  values: unknown[];
}

export interface RecurringPostInput {
  id: number;
  name: string;
  amount: number;
  cadence: string;
  nextDueDate: string;
  dueDates: string[];
  accountId: number | null;
  direction: 'expense' | 'income';
  category: string;
}

/**
 * Build one executeSet batch for recurring posts. The unique recurrence-period
 * columns make every INSERT idempotent; executeSet makes inserts + schedule
 * advancement atomic.
 */
export function buildRecurringPostPlan(input: RecurringPostInput): {
  nextDueDate: string;
  statements: RecurringPostStatement[];
} {
  if (input.dueDates.length === 0) return { nextDueDate: input.nextDueDate, statements: [] };
  const type = input.direction === 'income' ? 'income' : 'expense';
  const category = type === 'income' ? 'income' : input.category || 'other';
  const statements: RecurringPostStatement[] = input.dueDates.map((due) => ({
    statement: `INSERT OR IGNORE INTO finance_transaction
      (date, name, category, amount, type, notes, account_id, recurring_id, recurring_due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    values: [
      due,
      input.name,
      category,
      input.amount,
      type,
      'Recurring payment',
      input.accountId,
      input.id,
      due,
    ],
  }));
  const lastDue = input.dueDates[input.dueDates.length - 1];
  const nextDueDate = nextDueAfter(lastDue, input.cadence);
  statements.push({
    statement: 'UPDATE finance_subscription SET last_posted_date = ?, next_due_date = ? WHERE id = ?',
    values: [lastDue, nextDueDate, input.id],
  });
  return { nextDueDate, statements };
}
