// Streak and consistency math for habits with optional day-of-week scheduling.
// days_of_week is a comma-separated list of JS weekday digits (Sunday = 0);
// null/empty means the habit is scheduled every day. Unscheduled days never
// break a streak — they are skipped when walking backwards.

export interface HabitLike {
  days_of_week?: string | null;
  created_at?: string | null;
}

export function isScheduledOn(habit: HabitLike, dateStr: string): boolean {
  const dow = habit.days_of_week;
  if (!dow) return true;
  const day = String(new Date(dateStr + 'T12:00:00').getDay());
  return dow.split(',').includes(day);
}

export function shiftDate(dateStr: string, deltaDays: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + deltaDays);
  // Read back the local calendar date. `toISOString().slice(0, 10)` would
  // re-introduce the UTC off-by-one the noon anchor exists to avoid.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function currentStreak(
  habit: HabitLike,
  completedDates: Set<string>,
  anchorDate: string,
  maxLookback = 366
): number {
  let streak = 0;
  let date = anchorDate;
  for (let i = 0; i < maxLookback; i++) {
    if (isScheduledOn(habit, date)) {
      if (completedDates.has(date)) {
        streak++;
      } else if (date !== anchorDate) {
        // A missed scheduled day in the past breaks the chain; the anchor day
        // itself being incomplete doesn't (it may simply not be done yet).
        break;
      }
    }
    date = shiftDate(date, -1);
  }
  return streak;
}

export function bestStreak(
  habit: HabitLike,
  completedDates: Set<string>,
  fromDate: string,
  toDate: string
): number {
  let best = 0;
  let run = 0;
  for (let date = fromDate; date <= toDate; date = shiftDate(date, 1)) {
    if (!isScheduledOn(habit, date)) continue;
    if (completedDates.has(date)) {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

// Fraction of scheduled days completed within [fromDate, toDate]; null when
// no day in the window was scheduled.
export function completionRate(
  habit: HabitLike,
  completedDates: Set<string>,
  fromDate: string,
  toDate: string
): number | null {
  let scheduled = 0;
  let done = 0;
  for (let date = fromDate; date <= toDate; date = shiftDate(date, 1)) {
    if (!isScheduledOn(habit, date)) continue;
    scheduled++;
    if (completedDates.has(date)) done++;
  }
  return scheduled === 0 ? null : done / scheduled;
}
