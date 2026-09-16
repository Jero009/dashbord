// Widget bridge: pushes a compact state snapshot to the native
// DashboardWidget plugin, which persists it (SharedPreferences) and pings the
// AppWidgetProviders. Transport only — data shaping lives here.
import { registerPlugin } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

const DashboardWidget = registerPlugin<{ sync(opts: { data: string }): Promise<void> }>('DashboardWidget');

export interface SleepWidgetState {
  date: string;          // local date of the sleep night (YYYY-MM-DD)
  sleepScore: number | null;
  sleepHours: number | null;
  delta7d: number | null; // score delta vs 7 days prior
  // Extended fields (battery + stages widgets):
  bedtime: string | null;        // HH:MM
  waketime: string | null;       // HH:MM
  deepMinutes: number | null;
  remMinutes: number | null;
  stageSegments: { stage: string; start: string; end: string; weight: number }[] | null;
}

function hhmm(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function hmFromMinutes(min: number | null): string | null {
  if (min === null || !Number.isFinite(min) || min <= 0) return null;
  const total = Math.round(min);
  return `${Math.floor(total / 60)}H ${total % 60}M`;
}

export async function updateSleepWidget(state: SleepWidgetState): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const payload: Record<string, unknown> = { date: state.date };
  if (state.sleepScore !== null) payload.sleepScore = state.sleepScore;
  if (state.sleepHours !== null) payload.sleepHours = state.sleepHours;
  if (state.delta7d !== null) payload.delta7d = state.delta7d;

  const duration = hmFromMinutes(state.sleepHours !== null ? state.sleepHours * 60 : null);
  if (duration) payload.sleepDuration = duration;
  const bedtime = hhmm(state.bedtime);
  if (bedtime) payload.bedtime = bedtime;
  const waketime = hhmm(state.waketime);
  if (waketime) payload.waketime = waketime;
  const deep = hmFromMinutes(state.deepMinutes);
  if (deep) payload.deepDuration = deep;
  const rem = hmFromMinutes(state.remMinutes);
  if (rem) payload.remDuration = rem;
  if (state.stageSegments?.length) payload.stageSegments = state.stageSegments;

  try {
    await DashboardWidget.sync({ data: JSON.stringify(payload) });
  } catch (error) {
    console.error('Widget update failed:', error);
  }
}
