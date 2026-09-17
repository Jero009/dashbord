// Bill-due alert helpers (T2): one daily summary notification when active
// expense subscriptions are due within a short horizon. Pure functions —
// the notification scheduling lives in utils/notifications.ts.
import type { SubscriptionRow } from '@/features/finance/finance';
import { daysFromToday } from '@/features/finance/finance';

export interface BillAlert {
  name: string;
  label: string; // "today" | "tomorrow" | "in Nd"
  amount: number;
}

// Active expense subs due within `days` (inclusive; overdue within the last
// 14 days included — they still need paying), soonest first. Null when nothing
// is due (caller skips scheduling). Local calendar-day math via daysFromToday.
export function dueWithin(subs: SubscriptionRow[], days = 3): BillAlert[] | null {
  const alerts = subs
    .filter(
      (s) =>
        String(s.status ?? 'active') === 'active' &&
        s.direction !== 'income' &&
        s.next_due_date
    )
    .map((s) => {
      const diff = daysFromToday(String(s.next_due_date));
      return { name: String(s.name), amount: Number(s.amount) || 0, diff };
    })
    .filter((a): a is { name: string; amount: number; diff: number } => a.diff !== null && a.diff >= -14 && a.diff <= days)
    .sort((a, b) => a.diff - b.diff)
    .map((a) => ({
      name: a.name,
      label: a.diff === 0 ? 'today' : a.diff === 1 ? 'tomorrow' : `in ${a.diff}d`,
      amount: a.amount,
    }));
  return alerts.length ? alerts : null;
}

// Notification body: "Netflix (tomorrow), Spotify (in 3d) — €27 due within 3 days".
export function billAlertBody(alerts: BillAlert[], days = 3): string {
  const total = alerts.reduce((sum, a) => sum + a.amount, 0);
  const names = alerts.map((a) => `${a.name} (${a.label})`).join(', ');
  const cost = Number.isInteger(total) ? String(total) : total.toFixed(2);
  return `${names} — ${cost} due within ${days} days`;
}
