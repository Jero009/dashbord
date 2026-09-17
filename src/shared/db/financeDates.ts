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
