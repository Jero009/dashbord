/**
 * Centralized time and date formatting utilities
 * Used across the app for consistent date/time handling
 */

const toTimestamp = (value: unknown): number => {
  if (value === null || value === undefined) return NaN;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }

  const raw = String(value).trim();
  if (!raw) return NaN;

  const numeric = Number(raw);
  if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
    return numeric;
  }

  const normalized = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
  const hasTimezone = /(?:Z|[-+]\d{2}:?\d{2})$/i.test(normalized);
  const candidate = hasTimezone ? normalized : `${normalized}Z`;

  return new Date(candidate).getTime();
};

export const normalizeDateInput = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
  const hasTimezone = /(?:Z|[-+]\d{2}:?\d{2})$/i.test(normalized);
  return hasTimezone ? normalized : `${normalized}Z`;
};

// Local-timezone calendar date (YYYY-MM-DD). Use this instead of
// `toISOString().slice(0, 10)`, which returns the UTC date and points at the
// wrong day for part of the evening/morning in any non-UTC timezone.
export const localDateISO = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Local-timezone month key (YYYY-MM). Same UTC-safety rationale as localDateISO.
export const localMonthISO = (date: Date = new Date()): string =>
  localDateISO(date).slice(0, 7);

// Parse a YYYY-MM-DD calendar date into a Date at LOCAL noon. The noon anchor
// keeps `.getDay()`/`.getDate()`/display on the intended day regardless of
// timezone — `new Date('2026-06-28')` is UTC midnight and reads as the previous
// day west of UTC. Inverse of localDateISO for the round-trip.
export const parseLocalDate = (dateStr: string): Date => new Date(`${dateStr}T12:00:00`);

export const formatDuration = (start: string | undefined, end: string | undefined) => {
  if (!start || !end) return '0h 0m 0s';

  const s = toTimestamp(start);
  const e = toTimestamp(end);

  if (isNaN(s) || isNaN(e)) return 'Invalid time';

  const diff = Math.max(0, e - s);
  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}h ${minutes}m ${seconds}s`;
};

export const formatTime = (secondsValue: number) => {
  const hrs = Math.floor(secondsValue / 3600);
  const mins = Math.floor((secondsValue % 3600) / 60);
  const secs = secondsValue % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const formatWorkoutDate = (value: unknown) => {
  const normalized = normalizeDateInput(value);

  if (!normalized) return 'No session yet';

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) return 'No session yet';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date);
};

export { toTimestamp };