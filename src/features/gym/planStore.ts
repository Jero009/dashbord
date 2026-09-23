// Plan store — a tiny cache shared by Gym Home / Plan page / Analytics so the
// plan strip and headers don't each re-query the DB on every mount. Not a
// global state store (the app has none); just refs + one loader.
import { ref, computed } from 'vue';
import {
  getActivePlan,
  getPausesForPlan,
  planConfigOf,
  pauseSpansOf,
  type Plan,
  type PlanPause,
} from '@/shared/db/app_db';
import {
  planWeek,
  planWeeksTotal,
  nextDeloadDate,
  deloadWeekNumbers,
  dateKey,
} from '@/shared/utils/planCalendar';
import { invalidatePlanCache } from '@/shared/utils/trainingPhase';

const plan = ref<Plan | null>(null);
const pauses = ref<PlanPause[]>([]);
let loaded = false;

export const openPause = computed(() =>
  pauses.value.find((p) => p.end_date === null) ?? null
);

export const activePlan = computed(() => plan.value);

/** Pause-adjusted plan week covering today (null outside/before plan). */
export const currentWeek = computed(() => {
  if (!plan.value) return null;
  return planWeek(planConfigOf(plan.value), pauseSpansOf(pauses.value), new Date());
});

export const weeksTotal = computed(() => {
  if (!plan.value) return null;
  return planWeeksTotal(planConfigOf(plan.value), pauseSpansOf(pauses.value));
});

/** Next deload start strictly after now, or null. */
export const nextDeload = computed(() => {
  if (!plan.value) return null;
  return nextDeloadDate(planConfigOf(plan.value), pauseSpansOf(pauses.value), new Date());
});

export const deloadWeeks = computed(() => {
  if (!plan.value) return new Set<number>();
  return deloadWeekNumbers(planConfigOf(plan.value));
});

/** "Plan paused · Sick · day 3" support: days since the open pause started. */
export const pauseDay = computed(() => {
  const p = openPause.value;
  if (!p) return null;
  const start = new Date(`${p.start_date}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  return Math.max(1, Math.floor((Date.now() - start.getTime()) / 86_400_000) + 1);
});

/** Load once per session; call `reload()` after any plan/pause write. */
export async function loadPlan(force = false): Promise<void> {
  if (loaded && !force) return;
  plan.value = await getActivePlan();
  pauses.value = plan.value ? await getPausesForPlan(plan.value.id) : [];
  loaded = true;
}

/** Cache-buster after create/edit/pause/resume. */
export async function reloadPlan(): Promise<void> {
  invalidatePlanCache();
  loaded = false;
  await loadPlan(true);
}

/** Date key for a pause/event date chip. */
export { dateKey };
