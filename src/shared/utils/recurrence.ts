// Calendar recurrence engine. Pure date math — no DB, no Vue — so it is unit
// testable and shared between the DB layer (occurrence expansion for queries)
// and the UI (week/agenda views).
//
// An event's `date` is its FIRST occurrence. `recurrence` selects the cadence;
// `recur_interval` is the "every N" step (default 1); `recur_days` lists weekday
// digits (Sunday=0) for weekly events (empty = same weekday as the start);
// `recur_count` caps the number of occurrences; `end_date` is an inclusive
// "until" bound. All dates are local `YYYY-MM-DD` strings (matching toDateKey).

export const RECURRENCE_TYPES = [
  'none',
  'daily',
  'weekly',
  'weekdays',
  'monthly',
  'yearly',
] as const;

export type RecurrenceType = (typeof RECURRENCE_TYPES)[number];

export interface RecurringEventLike {
  date: string;
  recurrence?: string | null;
  recur_interval?: number | null;
  recur_days?: string | null;
  recur_count?: number | null;
  end_date?: string | null;
}

// --- local date helpers (no UTC, to stay off-by-one-free like toDateKey) ---
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}
function addYears(d: Date, n: number): Date {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + n);
  return x;
}

// Safety cap so a far-past start date can never spin forever.
const MAX_STEPS = 20000;

/**
 * Yields occurrence dates (ascending, inclusive of the base date) up to and
 * including `limit`, honouring interval, recur_days, recur_count and end_date.
 */
export function* occurrences(ev: RecurringEventLike, limit: string): Generator<string> {
  const rec = (ev.recurrence ?? 'none') as RecurrenceType;
  if (rec === 'none' || !ev.recurrence) {
    if (ev.date <= limit) yield ev.date;
    return;
  }

  const base = parseYMD(ev.date);
  const interval = Math.max(1, Number(ev.recur_interval) || 1);
  const count = ev.recur_count && ev.recur_count > 0 ? Math.floor(ev.recur_count) : null;
  const until = ev.end_date || null;
  let emitted = 0;

  const cappedLimit = until && until < limit ? until : limit;

  if (rec === 'daily') {
    for (let i = 0; i < MAX_STEPS; i++) {
      const s = ymd(addDays(base, i * interval));
      if (s > cappedLimit) return;
      yield s;
      if (count && ++emitted >= count) return;
    }
    return;
  }

  if (rec === 'weekdays') {
    // Every Monday–Friday from the base date forward (interval ignored).
    for (let i = 0, day = base; i < MAX_STEPS; i++, day = addDays(day, 1)) {
      const s = ymd(day);
      if (s > cappedLimit) return;
      const dow = day.getDay();
      if (dow >= 1 && dow <= 5) {
        yield s;
        if (count && ++emitted >= count) return;
      }
    }
    return;
  }

  if (rec === 'weekly') {
    const days = ev.recur_days
      ? ev.recur_days.split(',').map(Number).filter((n) => n >= 0 && n <= 6)
      : [base.getDay()];
    const daySet = new Set(days.length ? days : [base.getDay()]);
    const baseWeekStart = addDays(base, -base.getDay()); // Sunday of base week
    for (let w = 0; w < MAX_STEPS; w++) {
      const weekStart = addDays(baseWeekStart, w * interval * 7);
      if (ymd(weekStart) > cappedLimit) return;
      for (let dow = 0; dow < 7; dow++) {
        if (!daySet.has(dow)) continue;
        const s = ymd(addDays(weekStart, dow));
        if (s < ev.date || s > cappedLimit) continue;
        yield s;
        if (count && ++emitted >= count) return;
      }
    }
    return;
  }

  if (rec === 'monthly') {
    const dom = base.getDate();
    for (let i = 0; i < MAX_STEPS; i++) {
      const cand = addMonths(base, i * interval);
      // Skip months without this day-of-month (e.g. the 31st in February) —
      // RRULE semantics: the occurrence is omitted, not clamped.
      if (cand.getDate() !== dom) {
        if (ymd(cand) > cappedLimit) return;
        continue;
      }
      const s = ymd(cand);
      if (s > cappedLimit) return;
      yield s;
      if (count && ++emitted >= count) return;
    }
    return;
  }

  if (rec === 'yearly') {
    for (let i = 0; i < MAX_STEPS; i++) {
      const cand = addYears(base, i * interval);
      // Skip Feb 29 in non-leap years rather than rolling to Mar 1.
      if (cand.getMonth() !== base.getMonth() || cand.getDate() !== base.getDate()) {
        if (ymd(cand) > cappedLimit) return;
        continue;
      }
      const s = ymd(cand);
      if (s > cappedLimit) return;
      yield s;
      if (count && ++emitted >= count) return;
    }
  }
}

/** True when the event has an occurrence exactly on `date`. */
export function eventOccursOn(ev: RecurringEventLike, date: string): boolean {
  if (!ev.recurrence || ev.recurrence === 'none') return ev.date === date;
  if (date < ev.date) return false;
  if (ev.end_date && date > ev.end_date) return false;
  for (const s of occurrences(ev, date)) {
    if (s === date) return true;
    if (s > date) return false;
  }
  return false;
}

/** All occurrence dates that fall within the given `YYYY-MM` month. */
export function expandOccurrencesInMonth(ev: RecurringEventLike, yearMonth: string): string[] {
  const [y, m] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const monthStart = `${yearMonth}-01`;
  const monthEnd = `${yearMonth}-${String(daysInMonth).padStart(2, '0')}`;
  const out: string[] = [];
  for (const s of occurrences(ev, monthEnd)) {
    if (s >= monthStart) out.push(s);
  }
  return out;
}

/** All occurrence dates within an inclusive [start, end] date range. */
export function expandOccurrencesInRange(ev: RecurringEventLike, start: string, end: string): string[] {
  const out: string[] = [];
  for (const s of occurrences(ev, end)) {
    if (s >= start) out.push(s);
  }
  return out;
}

/** Human label for an event's recurrence, e.g. "Every 2 weeks". */
export function recurrenceLabel(ev: RecurringEventLike): string {
  const rec = ev.recurrence ?? 'none';
  if (rec === 'none' || !ev.recurrence) return '';
  const n = Math.max(1, Number(ev.recur_interval) || 1);
  const every = n === 1 ? 'Every' : `Every ${n}`;
  let base: string;
  switch (rec) {
    case 'daily': base = n === 1 ? 'Daily' : `${every} days`; break;
    case 'weekdays': base = 'Every weekday'; break;
    case 'weekly': base = n === 1 ? 'Weekly' : `${every} weeks`; break;
    case 'monthly': base = n === 1 ? 'Monthly' : `${every} months`; break;
    case 'yearly': base = n === 1 ? 'Yearly' : `${every} years`; break;
    default: base = 'Repeats';
  }
  if (ev.recur_count && ev.recur_count > 0) base += `, ${ev.recur_count}×`;
  else if (ev.end_date) base += `, until ${ev.end_date}`;
  return base;
}
