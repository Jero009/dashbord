// Widget bridge: pushes a compact state snapshot to the native
// DashboardWidget plugin, which persists it (SharedPreferences) and pings the
// AppWidgetProviders. Transport only — data shaping lives here.
import { registerPlugin } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

const DashboardWidget = registerPlugin<{ sync(opts: { data: string }): Promise<void> }>('DashboardWidget');

// The plugin's `sync` FULLY REPLACES the stored snapshot blob, and two
// producers write different fields (healthConnect writes sleep fields, Home
// writes briefing fields). Keep the last snapshot here and merge so one
// producer never blanks the other's fields.
const SNAPSHOT_MIRROR_KEY = 'widgetBridge.snapshot'

function readSnapshotMirror(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(SNAPSHOT_MIRROR_KEY)
    const obj = raw ? JSON.parse(raw) : null
    return obj && typeof obj === 'object' ? obj : {}
  } catch {
    return {}
  }
}

function mergeAndBuild(fields: Record<string, unknown>): Record<string, unknown> {
  const merged = { ...readSnapshotMirror(), ...fields }
  // Drop null/undefined/NaN values — the Java side treats missing as fallback.
  for (const k of Object.keys(merged)) {
    const v = merged[k]
    if (v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))) delete merged[k]
  }
  localStorage.setItem(SNAPSHOT_MIRROR_KEY, JSON.stringify(merged))
  return merged
}

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

// Briefing widget fields ride the SAME shared snapshot (one blob, many
// providers) — they merge in on every sync so the briefing widget updates
// whenever any widget sync runs after a briefing pull.
export interface BriefingWidgetFields {
  briefingTitle: string | null;
  briefingBody: string | null;
  /** Local date key of the briefing (YYYY-MM-DD) or formatted short date. */
  briefingDate: string | null;
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

export async function updateSleepWidget(state: SleepWidgetState, extra: BriefingWidgetFields | null = null): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  // Briefing fields ride along when provided (single native round-trip).
  const merged = extra ? await updateWidgetFields({ ...sleepStateToFields(state) }, extra) : await updateWidgetFields(sleepStateToFields(state))
  return merged
}

/** Sleep-state fields only (no `date` collision with briefing pushes). */
function sleepStateToFields(state: SleepWidgetState): Record<string, unknown> {
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
  return payload
}

/**
 * Merge arbitrary widget fields over the last snapshot and push. Use this for
 * producers that don't own sleep data (briefing pulls from Home).
 */
export async function updateWidgetFields(
  fields: Record<string, unknown>,
  extra: BriefingWidgetFields | null = null,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  // Briefing widget fields — merge when the caller has them (Home's
  // loadBriefing passes them so the widget updates after each briefing pull).
  if (extra) {
    if (extra.briefingTitle) fields.briefingTitle = extra.briefingTitle;
    if (extra.briefingBody) fields.briefingBody = extra.briefingBody;
    if (extra.briefingDate) fields.briefingDate = extra.briefingDate;
  }

  try {
    // Merge over the last snapshot (see readSnapshotMirror) — the plugin
    // replaces the blob wholesale, and multiple producers write disjoint
    // fields, so an unmerged push would blank the other widgets.
    const merged = mergeAndBuild(fields);
    await DashboardWidget.sync({ data: JSON.stringify(merged) });
  } catch (error) {
    console.error('Widget update failed:', error);
  }
}

