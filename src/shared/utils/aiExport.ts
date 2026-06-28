/**
 * AI data export — assembles the user's tracked data into one human/AI-readable
 * plain-text report, designed to be pasted into an external LLM so it can spot
 * cross-domain patterns the app itself doesn't surface (e.g. sleep → next-day
 * training, training load → recovery lag, spending → readiness, circadian
 * misalignment → energy).
 *
 * The centrepiece is a single date-aligned daily timeline (CSV) so a model can
 * correlate every metric day-by-day; summary sections add context (profile,
 * chronotype, PRs, habits, goals, body, finance).
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
  getAllHabits,
  getHabitLogsForRange,
  getGoals,
  getAllExercisePRs,
  getRecentCircadianLogs,
  getFinanceAccounts,
  getFinanceInvestments,
  getFinanceBudgets,
  getFinanceSubscriptions,
  queryMonthlySpending,
  queryCategorySpending,
} from '@/shared/db/app_db';
import type { SleepSessionRecord } from '@/shared/db/app_db';
import { computeDailyLoads, computeAcwrSeries } from '@/shared/health/trainingLoad';
import { computeRecoverySeries } from '@/shared/health/recoveryBaseline';
import { aggregateLatestTrainingDay, recoveryTimeStatus } from '@/shared/health/recoveryTime';
import { evaluateOvertraining, acwrZoneLabel } from '@/shared/health/overtraining';
import {
  computeCircadianProfile,
  computeCircadianScore,
  type SleepRecord,
  type DayType,
} from '@/shared/health/circadian';
import {
  accountAssetsTotal,
  accountLiabilitiesTotal,
  investmentsTotal,
  computeNetWorth,
  subscriptionsMonthlyOutflow,
} from '@/features/finance/finance';
import { currentStreak, bestStreak, completionRate, isScheduledOn, shiftDate } from '@/shared/utils/habitStats';
import {
  getSleepGoalHours,
  getStepGoal,
  getGoalWeightKg,
  getCurrency,
} from '@/shared/utils/userSettings';
import { formatCurrency } from '@/shared/utils/currency';
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

function decimalHourToHM(h: number | null): string {
  if (h == null || !Number.isFinite(h)) return '—';
  const norm = ((h % 24) + 24) % 24;
  const hh = Math.floor(norm);
  const mm = Math.round((norm - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`;
}

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
  habitsDone?: number;
  habitsScheduled?: number;
  dayType?: string;
  eWake?: number | null;
  eNoon?: number | null;
  eEve?: number | null;
  morningLight?: number;
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
    habits,
    habitLogs,
    goals,
    prs,
    circadianLogs,
    accounts,
    investments,
    budgets,
    subscriptions,
    monthly,
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
    getAllHabits().catch(() => []),
    getHabitLogsForRange(windowStart, today).catch(() => []),
    getGoals().catch(() => []),
    getAllExercisePRs().catch(() => []),
    getRecentCircadianLogs(days).catch(() => []),
    getFinanceAccounts().catch(() => []),
    getFinanceInvestments().catch(() => []),
    getFinanceBudgets().catch(() => []),
    getFinanceSubscriptions().catch(() => []),
    queryMonthlySpending(6).catch(() => []),
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

  // Habits scheduled/done per day (respecting per-habit day-of-week + creation date).
  const completedByHabit = new Map<number, Set<string>>();
  for (const log of habitLogs) {
    if (log.completed !== 1) continue;
    let set = completedByHabit.get(log.habit_id);
    if (!set) { set = new Set(); completedByHabit.set(log.habit_id, set); }
    set.add(log.date);
  }
  for (let date = windowStart; date <= today; date = shiftDate(date, 1)) {
    let scheduled = 0;
    let done = 0;
    for (const h of habits as Array<Record<string, unknown>>) {
      const createdKey = typeof h.created_at === 'string' ? h.created_at.slice(0, 10) : '';
      if (createdKey && date < createdKey) continue;
      if (!isScheduledOn(h as { days_of_week?: string | null }, date)) continue;
      scheduled++;
      if (completedByHabit.get(Number(h.id))?.has(date)) done++;
    }
    if (scheduled > 0) {
      const d = row(date);
      d.habitsScheduled = scheduled;
      d.habitsDone = done;
    }
  }

  // Circadian daily log.
  for (const c of circadianLogs) {
    if (!inWindow(c.date)) continue;
    const d = row(c.date);
    d.dayType = c.day_type;
    d.eWake = c.energy_wake;
    d.eNoon = c.energy_noon;
    d.eEve = c.energy_evening;
    d.morningLight = c.morning_light;
  }

  // ── assemble the report ─────────────────────────────────────────────────────
  const out: string[] = [];
  const push = (s = '') => out.push(s);

  push('PERSONAL TRACKING DATA EXPORT — FOR AI PATTERN ANALYSIS');
  push(`Generated: ${new Date().toISOString()}`);
  push(`Window: ${windowStart} to ${today} (${days} days)`);
  push('');
  push('HOW TO USE THIS FILE (note to the AI reading it):');
  push('This is one person\'s self-tracked data across sleep, training, recovery,');
  push('circadian rhythm, habits, goals, body and finance. The app already shows');
  push('per-domain stats. Your job is to find CROSS-DOMAIN and LAGGED patterns it');
  push('does not: e.g. how sleep/recovery predict next-day training quality, how');
  push('training load leads recovery dips by 1–2 days, weekday effects, how');
  push('spending or budget stress tracks readiness/energy, and circadian');
  push('misalignment (irregular bedtime / social jetlag) vs energy. Call out');
  push('correlations with rough strength + lag, anomalies, and concrete');
  push('experiments to test. Note where data is sparse before over-concluding.');
  push('Blank cells mean "not recorded". Units are in the column legend.');
  push('');

  // Profile & targets
  push('=== PROFILE & TARGETS ===');
  push(`Sleep goal: ${getSleepGoalHours()} h/night`);
  push(`Daily step goal: ${getStepGoal()}`);
  push(`Goal weight: ${getGoalWeightKg() ?? '—'} kg`);
  push(`Currency: ${getCurrency()}`);
  push('');

  // Circadian profile
  const sleepRecords: SleepRecord[] = sleepSessions
    .filter((s) => inWindow(s.date))
    .map((s) => ({
      date: s.date,
      bedtime: s.bedtime,
      waketime: s.waketime,
      timeAsleepHours: s.time_asleep_hours,
      efficiency: s.efficiency,
    }));
  const dayTypes = new Map<string, DayType>();
  for (const c of circadianLogs) {
    if (c.day_type === 'work' || c.day_type === 'free') dayTypes.set(c.date, c.day_type);
  }
  const profile = computeCircadianProfile(sleepRecords, dayTypes);
  const rhrValues = rhrSeries.map((p) => p.value).filter((v) => Number.isFinite(v));
  const rhrBaseline = rhrValues.length ? rhrValues.reduce((a, b) => a + b, 0) / rhrValues.length : null;
  const rhrToday = rhrSeries.length ? rhrSeries[rhrSeries.length - 1].value : null;
  const lightFraction = circadianLogs.length
    ? circadianLogs.filter((c) => c.morning_light === 1).length / circadianLogs.length
    : null;
  const circScore = computeCircadianScore(sleepRecords, rhrToday, rhrBaseline, lightFraction);
  push('=== CIRCADIAN PROFILE ===');
  push(`Chronotype: ${profile.chronotype}  (data: ${profile.dataQuality})`);
  push(`Mid-sleep on free days (MSFsc): ${decimalHourToHM(profile.msfsc)}`);
  push(`Est. melatonin onset (DLMO): ${decimalHourToHM(profile.dlmoEstimate)}`);
  push(`Est. temp minimum (CTmin): ${decimalHourToHM(profile.ctminEstimate)}`);
  push(`Sleep-timing consistency: ${n2(profile.sleepConsistency)} (0–1, 1=perfectly regular)`);
  push(`Social jetlag: ${profile.socialJetlag == null ? '—' : n1(profile.socialJetlag) + ' h'}`);
  if (circScore.total != null) {
    push(`Circadian score: ${circScore.total}/100 (consistency ${circScore.consistency}, amplitude ${circScore.amplitude}, efficiency ${circScore.efficiency}, recovery ${circScore.recovery}, light ${circScore.light})`);
  }
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
  push('acwr=acute:chronic load ratio · rec_z=recovery z-score (neg=worse) · energy 1-5 · light=morning light 0/1');
  const header = [
    'date', 'readiness', 'sleep_h', 'eff', 'sleep_score', 'bedtime', 'wake',
    'deep', 'rem', 'light', 'awake', 'sleep_hr', 'resp', 'rhr', 'steps', 'weight_kg',
    'trained', 'volume', 'rpe', 'acwr', 'acwr_zone', 'rec_z',
    'habits_done', 'habits_sched', 'day_type', 'e_wake', 'e_noon', 'e_eve', 'morning_light',
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
      n0(d.habitsDone),
      n0(d.habitsScheduled),
      d.dayType ?? '',
      n0(d.eWake),
      n0(d.eNoon),
      n0(d.eEve),
      d.morningLight == null ? '' : String(d.morningLight),
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

  // Habits with streaks
  push('=== HABITS ===');
  if (habits.length === 0) push('No habits.');
  const earliestLog = habitLogs.length ? habitLogs[0].date : windowStart;
  for (const h of habits as Array<Record<string, unknown>>) {
    const set = completedByHabit.get(Number(h.id)) ?? new Set<string>();
    const hl = h as { days_of_week?: string | null; created_at?: string | null };
    const cur = currentStreak(hl, set, today);
    const best = bestStreak(hl, set, earliestLog, today);
    const rate30 = completionRate(hl, set, shiftDate(today, -29), today);
    const sched = hl.days_of_week ? `days ${hl.days_of_week}` : 'daily';
    push(`${String(h.name)} (${sched}): current streak ${cur}, best ${best}, 30d completion ${rate30 == null ? '—' : n0(rate30 * 100) + '%'}`);
  }
  push('');

  // Goals
  push('=== GOALS ===');
  if (goals.length === 0) push('No goals.');
  for (const g of goals as Array<Record<string, unknown>>) {
    const target = Number(g.target_value) || 0;
    const cur = Number(g.current_value) || 0;
    const pct = target > 0 ? Math.round((cur / target) * 100) : 0;
    push(`${String(g.name)}: ${n1(cur)}/${n1(target)} (${pct}%) · status ${String(g.status)}${g.due_date ? ' · due ' + String(g.due_date) : ''}`);
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

  // Finance
  push('=== FINANCE ===');
  const acctRows = accounts as Array<Record<string, unknown>>;
  const invRows = investments as Array<Record<string, unknown>>;
  const assetTotal = accountAssetsTotal(acctRows);
  const liabilityTotal = accountLiabilitiesTotal(acctRows);
  const investTotal = investmentsTotal(invRows);
  push(`Assets: ${formatCurrency(assetTotal + investTotal)} (accounts ${formatCurrency(assetTotal)} + investments ${formatCurrency(investTotal)}) · Liabilities: ${formatCurrency(liabilityTotal)} · Net worth: ${formatCurrency(computeNetWorth(acctRows, invRows))}`);
  if (monthly.length) {
    push('Monthly income / expense (last 6 months):');
    for (const m of monthly) push(`  ${m.month}: income ${formatCurrency(m.income)}, expense ${formatCurrency(m.expense)}, net ${formatCurrency(m.income - m.expense)}`);
  }
  // Budgets vs current-month spend.
  const monthKey = today.slice(0, 7);
  const catSpend = await queryCategorySpending(monthKey).catch(() => []);
  const spendByCat = new Map<string, number>();
  for (const c of catSpend as Array<Record<string, unknown>>) spendByCat.set(String(c.category), Number(c.amount) || 0);
  if (budgets.length) {
    push(`Budgets vs spend (${monthKey}):`);
    for (const b of budgets as Array<Record<string, unknown>>) {
      const cat = String(b.category);
      const limit = Number(b.monthly_limit) || 0;
      const spent = spendByCat.get(cat) ?? 0;
      push(`  ${cat}: ${formatCurrency(spent)} / ${formatCurrency(limit)}${spent > limit ? ' (OVER)' : ''}`);
    }
  }
  const subRows = subscriptions as Array<Record<string, unknown>>;
  const activeSubs = subRows.filter((s) => String(s.status ?? 'active') === 'active');
  if (activeSubs.length) {
    const monthlySubs = subscriptionsMonthlyOutflow(subRows);
    push(`Active subscriptions: ${activeSubs.length} (~${formatCurrency(monthlySubs)}/mo recurring expense)`);
  }
  push('');

  push('=== END OF EXPORT ===');
  return out.join('\n');
}
