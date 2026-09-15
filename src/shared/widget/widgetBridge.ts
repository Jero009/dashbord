// Widget bridge: pushes a compact state snapshot to the native
// DashboardWidget plugin, which persists it (SharedPreferences) and pings the
// AppWidgetProvider. Transport only — data shaping lives here.
import { registerPlugin } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

const DashboardWidget = registerPlugin<{ sync(opts: { data: string }): Promise<void> }>('DashboardWidget');

export interface SleepWidgetState {
  date: string;          // local date of the sleep night (YYYY-MM-DD)
  sleepScore: number | null;
  sleepHours: number | null;
  delta7d: number | null; // score delta vs 7 days prior
}

export async function updateSleepWidget(state: SleepWidgetState): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const payload: Record<string, unknown> = { date: state.date };
  if (state.sleepScore !== null) payload.sleepScore = state.sleepScore;
  if (state.sleepHours !== null) payload.sleepHours = state.sleepHours;
  if (state.delta7d !== null) payload.delta7d = state.delta7d;
  try {
    await DashboardWidget.sync({ data: JSON.stringify(payload) });
  } catch (error) {
    console.error('Widget update failed:', error);
  }
}
