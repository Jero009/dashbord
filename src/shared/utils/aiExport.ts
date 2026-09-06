/**
 * AI data export — assembles the user's tracked data into one human/AI-readable
 * plain-text report, designed to be pasted into an external LLM so it can spot
 * cross-domain patterns the app itself doesn't surface (e.g. sleep → next-day
 * training, training load → recovery lag).
 *
 * The centrepiece is a single date-aligned daily timeline (CSV) so a model can
 * correlate every metric day-by-day; summary sections add context (profile,
 * PRs, body).
 *
 * Pure-ish: all DB access goes through app_db; no Vue/UI deps so it stays easy
 * to test and reuse. Everything degrades gracefully when a domain has no data.
 */

import {
  queryReadinessHistory,
  getRecentSleepSessions,
  getHealthMetricDailySeries,
  getBodyLogs,
  getSessionLoads,
  getAllExercisePRs,
} from '@/shared/db/app_db';
import type { SleepSessionRecord } from '@/shared/db/app_db';
import { computeDailyLoads, computeAcwrSeries } from '@/shared/health/trainingLoad';
import { computeRecoverySeries } from '@/shared/health/recoveryBaseline';
import { aggregateLatestTrainingDay, recoveryTimeStatus } from '@/shared/health/recoveryTime';
import { evaluateOvertraining, acwrZoneLabel } from '@/shared/health/overtraining';
import { getSleepGoalHours, getStepGoal, getGoalWeightKg } from '@/shared/utils/userSettings';
import { shiftDate } from '@/shared/utils/habitStats';
import { localDateISO } from '@/shared/utils/timeFormat';

// ── small formatting helpers ──────────────────────────────────────────────────

/** Local HH:MM from an ISO timestamp, '' when unparseable. */
function hm(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const n0 = (v: number | null | undefined): string =>
  v == null || !Number.isFinite(v) ? '' : String(Math.round(v));
const n1 = (v: number | null | undefined): string =>
  v == null || !Number.isFinite(v) ? '' : (Math.round(v * 10) / 10).toString();
const n2 = (v: number | null | undefined): string =>
  v == null || !Number.isFinite(v) ? '' : (Math.round(v * 100) / 100).toString();

interface DailyRow {
  readiness?: number;
  sleepH?: number;
  sleepEff?: number; // 0–1
  sleepScore?: number | null;
  bedtime?: string;
  waketime?: string;
  deep?: number;
  rem?: number;
  light?: number;
  awake?: number;
  sleepHr?: number | null;
  resp?: number | null;
  rhr?: number;
  steps?: number;
  weight?: number;
  trained?: boolean;
  volume?: number;
  rpe?: number | null;
  acwr?: number | null;
  acwrZone?: string;
  recoveryZ?: number | null;
}

export interface AiExportOptions {
  /** Days of daily timeline to include. Default 120. */
  days?: number;
}

/** Build the full plain-text export. */
export async function buildAiExport(options: AiExportOptions = {}): Promise<string> {
  const days = options.days ?? 120;
  const today = localDateISO();
  const windowStart = shiftDate(today, -(days - 1));

  // Pull every domain in parallel. Each call already tolerates an empty DB.
  const [
    readiness,
    sleepSessions,
    rhrSeries,
    hrvSeries,
    respSeries,
    stepsSeries,
    sleepScoreSeries,
    bodyLogs,
    sessions,
    prs,
  ] = await Promise.all([
    queryReadinessHistory(days).catch(() => []),
    getRecentSleepSessions(days).catch(() => [] as SleepSessionRecord[]),
    getHealthMetricDailySeries('resting_heart_rate', days).catch(() => []),
    getHealthMetricDailySeries('hrv', days).catch(() => []),
    getHealthMetricDailySeries('respiratory_rate', days).catch(() => []),
    getHealthMetricDailySeries('steps', days).catch(() => []),
    getHealthMetricDailySeries('sleep_score', days).catch(() => []),
    getBodyLogs().catch(() => []),
    getSessionLoads(days + 28).catch(() => []), // +28 so chronic load has lead-in
    getAllExercisePRs().catch(() => []),
  ]);

  const rows = new Map<string, DailyRow>();
  const row = (date: string): DailyRow => {
    let r = rows.get(date);
    if (!r) { r = {}; rows.set(date, r); }
    return r;
  };
  const inWindow = (date: string) => date >= windowStart && date <= today;

  for (const r of readiness) if (inWindow(r.date)) row(r.date).readiness = r.score;

  for (const s of sleepSessions) {
    if (!inWindow(s.date)) continue;
    const d = row(s.date);
    d.sleepH = s.time_asleep_hours;
    d.sleepEff = s.efficiency;
    d.sleepScore = s.score;
    d.bedtime = hm(s.bedtime);
    d.waketime = hm(s.waketime);
    d.deep = s.stage_deep_min;
    d.rem = s.stage_rem_min;
    d.light = s.stage_light_min;
    d.awake = s.stage_awake_min;
    d.sleepHr = s.sleep_hr;
    d.resp = s.respiratory_rate;
  }
  // sleep_score from health_metric backfills sessions that predate sleep_session rows
  for (const p of sleepScoreSeries) {
    if (inWindow(p.date) && row(p.date).sleepScore == null) row(p.date).sleepScore = p.value;
  }
  for (const p of rhrSeries) if (inWindow(p.date)) row(p.date).rhr = p.value;
  for (const p of respSeries) if (inWindow(p.date) && row(p.date).resp == null) row(p.date).resp = p.value;
  for (const p of stepsSeries) if (inWindow(p.date)) row(p.date).steps = p.value;

  // Body weight: last entry per date.
  for (const b of bodyLogs) {
    if (inWindow(b.date)) row(b.date).weight = b.weight_kg;
  }

  // Training load / ACWR (EWMA, extended to today so rest days decay).
  const dailyLoads = computeDailyLoads(
    sessions.map((s) => ({
      date: s.date,
      volumeLoad: s.volume,
      durationMinutes: s.duration_minutes,
      sessionRpe: s.session_rpe,
    }))
  );
  const acwrSeries = computeAcwrSeries(dailyLoads, { endDate: today });
  for (const p of acwrSeries) {
    if (!inWindow(p.date)) continue;
    const d = row(p.date);
    d.acwr = p.acwr;
    if (p.acwr != null) d.acwrZone = acwrZoneLabel(p.acwr);
  }
  // Per-day workout volume / rpe / trained flag.
  for (const s of sessions) {
    if (!inWindow(s.date)) continue;
    const d = row(s.date);
    d.trained = true;
    d.volume = (d.volume ?? 0) + s.volume;
    if (s.session_rpe != null) d.rpe = s.session_rpe;
  }

  // Recovery z (HRV once there's enough, else RHR).
  const useHrv = hrvSeries.length >= 14;
  const recovery = computeRecoverySeries(useHrv ? hrvSeries : rhrSeries, useHrv ? 'hrv' : 'rhr');
  for (const p of recovery) if (inWindow(p.date)) row(p.date).recoveryZ = p.recoveryZ;

  // ── assemble the report ─────────────────────────────────────────────────────
  const out: string[] = [];
  const push = (s = '') => out.push(s);

  push('PERSONAL TRACKING DATA EXPORT — FOR AI PATTERN ANALYSIS');
  push(`Generated: ${new Date().toISOString()}`);
  push(`Window: ${windowStart} to ${today} (${days} days)`);
  push('');
  push('HOW TO USE THIS FILE (note to the AI reading it):');
  push('This is one person\'s self-tracked data across sleep, training, recovery and');
  push('body. The app already shows per-domain stats. Your job is to find');
  push('CROSS-DOMAIN and LAGGED patterns it does not: e.g. how sleep/recovery');
  push('predict next-day training quality, how training load leads recovery dips');
  push('by 1–2 days, weekday effects. Call out correlations with rough strength +');
  push('lag, anomalies, and concrete experiments to test. Note where data is');
  push('sparse before over-concluding.');
  push('Blank cells mean "not recorded". Units are in the column legend.');
  push('');

  // Profile & targets
  push('=== PROFILE & TARGETS ===');
  push(`Sleep goal: ${getSleepGoalHours()} h/night`);
  push(`Daily step goal: ${getStepGoal()}`);
  push(`Goal weight: ${getGoalWeightKg() ?? '—'} kg`);
  push('');

  // Training load & recovery (latest)
  push('=== TRAINING LOAD & RECOVERY (latest) ===');
  const latestAcwr = [...acwrSeries].reverse().find((p) => p.acwr != null) ?? acwrSeries[acwrSeries.length - 1];
  if (latestAcwr) {
    push(`ACWR: ${latestAcwr.acwr == null ? '—' : n2(latestAcwr.acwr)} (${latestAcwr.acwr == null ? 'building baseline' : acwrZoneLabel(latestAcwr.acwr)})`);
    push(`Acute load: ${n0(latestAcwr.acute)} · Chronic load: ${n0(latestAcwr.chronic)} (unit: ${latestAcwr.metric})`);
  } else {
    push('ACWR: no training data yet');
  }
  const recPoints = acwrSeries.map((p) => {
    const rp = recovery.find((r) => r.date === p.date);
    return { date: p.date, acwr: p.acwr, recoveryZ: rp?.recoveryZ ?? null };
  });
  const ot = evaluateOvertraining(recPoints);
  push(`Overtraining status: ${ot.status}${ot.reasons[0] ? ' — ' + ot.reasons[0] : ''}`);
  const latestDay = aggregateLatestTrainingDay(
    sessions.map((s) => ({
      date: s.date,
      time_end: s.time_end,
      session_rpe: s.session_rpe,
      duration_minutes: s.duration_minutes,
      volume: s.volume,
    }))
  );
  if (latestDay) {
    const latestRecoveryZ = [...recovery].reverse().find((r) => r.recoveryZ != null)?.recoveryZ ?? null;
    const latestSleepScore = sleepScoreSeries.length ? sleepScoreSeries[sleepScoreSeries.length - 1].value : null;
    const rt = recoveryTimeStatus(
      { rpeLoad: latestDay.rpeLoad, volumeLoad: latestDay.volumeLoad, recoveryZ: latestRecoveryZ, sleepScore: latestSleepScore },
      latestDay.sessionEndIso
    );
    push(`Recovery time from last session (${latestDay.date}): ${rt.label}${rt.recovered ? '' : ` (~${n0(rt.remainingHours)} h remaining)`}`);
  }
  push('');

  // Daily timeline (the centrepiece)
  push('=== DAILY TIMELINE (CSV) ===');
  push('Legend: sleep_h=hours asleep · eff=sleep efficiency % · deep/rem/light/awake=minutes ·');
  push('sleep_hr/rhr=bpm · resp=breaths/min · volume=kg lifted · rpe=session RPE 1-10 ·');
  push('acwr=acute:chronic load ratio · rec_z=recovery z-score (neg=worse)');
  const header = [
    'date', 'readiness', 'sleep_h', 'eff', 'sleep_score', 'bedtime', 'wake',
    'deep', 'rem', 'light', 'awake', 'sleep_hr', 'resp', 'rhr', 'steps', 'weight_kg',
    'trained', 'volume', 'rpe', 'acwr', 'acwr_zone', 'rec_z',
  ];
  push(header.join(','));
  const sortedDates = [...rows.keys()].sort();
  for (const date of sortedDates) {
    const d = rows.get(date)!;
    push([
      date,
      n0(d.readiness),
      n1(d.sleepH),
      d.sleepEff == null ? '' : n0(d.sleepEff * 100),
      d.sleepScore == null ? '' : n0(d.sleepScore),
      d.bedtime ?? '',
      d.waketime ?? '',
      n0(d.deep),
      n0(d.rem),
      n0(d.light),
      n0(d.awake),
      n0(d.sleepHr),
      n1(d.resp),
      n0(d.rhr),
      n0(d.steps),
      n1(d.weight),
      d.trained ? '1' : '',
      n0(d.volume),
      n1(d.rpe),
      d.acwr == null ? '' : n2(d.acwr),
      d.acwrZone ?? '',
      d.recoveryZ == null ? '' : n2(d.recoveryZ),
    ].join(','));
  }
  push('');

  // Personal records
  push('=== PERSONAL RECORDS (strength) ===');
  if (prs.length === 0) push('No PRs recorded.');
  for (const p of prs as Array<Record<string, unknown>>) {
    push(`${String(p.exercise_name)}: ${n1(Number(p.pr_weight))} kg x ${n0(Number(p.pr_reps))} (est 1RM ${n0(Number(p.one_rep_max))} kg) on ${String(p.date_achieved).slice(0, 10)}`);
  }
  push('');

  // Body measurements (latest + change over window)
  push('=== BODY ===');
  const bodyInWindow = bodyLogs.filter((b) => inWindow(b.date)).sort((a, b) => a.date.localeCompare(b.date));
  if (bodyInWindow.length === 0) {
    push('No body-log entries in window.');
  } else {
    const first = bodyInWindow[0];
    const last = bodyInWindow[bodyInWindow.length - 1];
    push(`Weight: ${n1(last.weight_kg)} kg (latest ${last.date}); change over window: ${n1(last.weight_kg - first.weight_kg)} kg`);
    const latestExtra: string[] = [];
    if (last.body_fat_pct != null) latestExtra.push(`body fat ${n1(last.body_fat_pct)}%`);
    if (last.waist_cm != null) latestExtra.push(`waist ${n1(last.waist_cm)} cm`);
    if (last.chest_cm != null) latestExtra.push(`chest ${n1(last.chest_cm)} cm`);
    if (last.arm_cm != null) latestExtra.push(`arm ${n1(last.arm_cm)} cm`);
    if (last.thigh_cm != null) latestExtra.push(`thigh ${n1(last.thigh_cm)} cm`);
    if (latestExtra.length) push(`Latest measurements: ${latestExtra.join(', ')}`);
  }
  push('');

  push('=== END OF EXPORT ===');
  return out.join('\n');
}
