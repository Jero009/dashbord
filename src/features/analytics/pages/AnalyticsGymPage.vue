<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <analytics-section-tabs />
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="analytics-shell">
        <!-- Summary tiles -->
        <div class="card">
          <div class="card-header">
            <p class="nt-kicker">Training load</p>
            <ion-select
              v-model="windowDays"
              interface="action-sheet"
              :interface-options="{ cssClass: 'app-action-sheet' }"
              class="app-select time-select"
            >
              <ion-select-option :value="30">30 days</ion-select-option>
              <ion-select-option :value="90">90 days</ion-select-option>
              <ion-select-option :value="180">180 days</ion-select-option>
            </ion-select>
          </div>
          <div class="tile-grid tile-grid--4">
            <div class="tile">
              <span class="tile__label">Volume</span>
              <strong class="tile__value">{{ formatVolume(totalVolume) }}</strong>
            </div>
            <div class="tile">
              <span class="tile__label">Sets</span>
              <strong class="tile__value">{{ totalSets }}</strong>
            </div>
            <div class="tile">
              <span class="tile__label">Workouts</span>
              <strong class="tile__value">{{ totalWorkouts }}</strong>
            </div>
            <div class="tile">
              <span class="tile__label">Per week</span>
              <strong class="tile__value">{{ workoutsPerWeek }}</strong>
            </div>
          </div>
        </div>

        <!-- Training load vs recovery overlay -->
        <training-load-overlay />

        <!-- Volume by muscle group -->
        <div class="card">
          <p class="nt-kicker">Volume by muscle group</p>
          <template v-if="muscleVolume.length > 0">
            <div class="chart-readout">
              <span class="chart-readout__date">{{ muscleReadoutLabel }}</span>
              <span class="chart-readout__value">volume <strong>{{ muscleReadoutValue }}</strong></span>
            </div>
            <div class="chart-frame chart-frame--tall">
              <canvas
                ref="muscleChartRef"
                class="scrub-canvas"
                @pointerdown.prevent="muscleScrub.onDown"
                @pointermove="muscleScrub.onMove"
                @pointerup="muscleScrub.onUp"
                @pointercancel="muscleScrub.onUp"
              ></canvas>
            </div>
          </template>
          <p v-else class="nt-empty">No sets</p>
        </div>

        <!-- Muscle balance -->
        <div v-if="muscleVolume.length > 0" class="card">
          <p class="nt-kicker">Push / Pull / Legs balance</p>
          <div class="balance-bar">
            <div
              v-for="seg in balanceSegments"
              :key="seg.label"
              class="balance-bar__seg"
              :style="{ width: seg.pct + '%', background: seg.color }"
            ></div>
          </div>
          <div class="balance-legend">
            <span v-for="seg in balanceSegments" :key="seg.label" class="balance-legend__item">
              <i class="balance-legend__swatch" :style="{ background: seg.color }"></i>
              {{ seg.label }} {{ seg.pct }}%
            </span>
          </div>
        </div>

        <!-- Weekly tonnage trend -->
        <div class="card">
          <p class="nt-kicker">Weekly tonnage</p>
          <TrendChart
            v-if="weeklyTonnage.length > 0"
            :pts="tonnagePts"
            unit="kg"
            size="md"
            show-range
            aria-label="Weekly tonnage trend"
          />
          <p v-else class="nt-empty">Not enough history</p>
        </div>

        <!-- Plan progress (active plan + past-plan picker) -->
        <div v-if="planPickerOptions.length > 0" class="card">
          <div class="card-header">
            <p class="nt-kicker">Plan progress</p>
            <ion-select
              v-model="selectedPlanId"
              interface="action-sheet"
              :interface-options="{ cssClass: 'app-action-sheet' }"
              class="app-select time-select"
            >
              <ion-select-option v-for="opt in planPickerOptions" :key="opt.id" :value="opt.id">
                {{ opt.label }}
              </ion-select-option>
            </ion-select>
          </div>

          <template v-if="planStats">
            <div class="tile-grid tile-grid--4">
              <div class="tile">
                <span class="tile__label">Week</span>
                <strong class="tile__value">{{ planStats.weekLabel }}</strong>
              </div>
              <div class="tile">
                <span class="tile__label">Done / expected</span>
                <strong class="tile__value">{{ planStats.totalDone }} / {{ planStats.expectedByNow }}</strong>
              </div>
              <div class="tile">
                <span class="tile__label">Completion</span>
                <strong class="tile__value">{{ Math.round(planStats.completion * 100) }}%</strong>
              </div>
              <div class="tile">
                <span class="tile__label">Deloads</span>
                <strong class="tile__value">{{ planStats.deloadsDone }} / {{ planStats.deloadsTotal }}</strong>
              </div>
            </div>

            <TrendChart
              v-if="planTrendPts.length > 1"
              :pts="planTrendPts"
              :overlay-pts="planEst1rmPts"
              unit="kg"
              size="md"
              show-range
              :shade-spans="planShadeSpans"
              aria-label="Plan tonnage trend"
            />

            <template v-if="planTemplateRows.length > 0">
              <p class="nt-kicker">Per template</p>
              <div class="plan-tpl-rows">
                <span v-for="row in planTemplateRows" :key="row.id" class="plan-tpl-row">
                  <span class="plan-tpl-row__name">{{ row.name }}</span>
                  <span class="plan-tpl-row__meta">{{ row.done }}× · {{ Math.round(row.share * 100) }}% tonnage</span>
                </span>
              </div>
            </template>

            <template v-if="planBeforeAfter.length > 0">
              <p class="nt-kicker">First vs last week top weight</p>
              <div class="plan-tpl-rows">
                <span v-for="row in planBeforeAfter" :key="row.name" class="plan-tpl-row">
                  <span class="plan-tpl-row__name">{{ row.name }}</span>
                  <span class="plan-tpl-row__meta">{{ row.first }} → {{ row.last }} kg</span>
                </span>
              </div>
            </template>

            <template v-if="planPauseLog.length > 0">
              <p class="nt-kicker">Pause log</p>
              <div class="plan-tpl-rows">
                <span v-for="(p, pi) in planPauseLog" :key="pi" class="plan-tpl-row">
                  <span class="plan-tpl-row__name">{{ p.label }}</span>
                  <span class="plan-tpl-row__meta">{{ p.days }} {{ p.days === 1 ? 'day' : 'days' }}</span>
                </span>
              </div>
            </template>
          </template>
        </div>

        <!-- Layered health heatmap (Workouts / Sick / Readiness) + day detail -->
        <health-heatmap :weeks="52" />

        <!-- Life-event logging: standalone, forward-only catalog (T14) -->
        <div class="card">
          <div class="card-header">
            <p class="nt-kicker">Life events</p>
            <ion-button fill="clear" size="small" class="log-event-btn" @click="logLifeEvent">
              Log event
            </ion-button>
          </div>
          <template v-if="lifeEvents.length > 0">
            <div class="plan-tpl-rows">
              <span v-for="ev in lifeEvents.slice(0, 6)" :key="ev.id" class="plan-tpl-row">
                <span class="plan-tpl-row__name">{{ lifeEventLabel(ev) }}</span>
                <span class="plan-tpl-row__meta">{{ ev.start_date }}{{ ev.end_date ? ` → ${ev.end_date}` : ' → ongoing' }}</span>
              </span>
            </div>
          </template>
          <p v-else class="nt-empty">Nothing logged yet</p>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonHeader,
  IonContent,
  IonSelect,
  IonSelectOption,
  IonButton,
  modalController,
  onIonViewWillEnter
} from '@ionic/vue';
import { ref, computed, nextTick, watch, onUnmounted } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import AnalyticsSectionTabs from '@/features/analytics/components/AnalyticsSectionTabs.vue';
import TrainingLoadOverlay from '@/features/analytics/components/TrainingLoadOverlay.vue';
import {
  queryVolumeByMuscleGroup,
  queryWeeklyTonnage,
  queryWorkoutFrequency,
  getPlans, getPausesForPlan, getPlanWorkoutSeries, getPlanAdherence, getLifeEvents,
  planConfigOf, pauseSpansOf,
} from '@/shared/db/app_db';
import type { MuscleVolume, WeeklyTonnage, WorkoutDayCount, Plan, PlanPause, LifeEvent } from '@/shared/db/app_db';
import HealthHeatmap from '@/features/analytics/components/HealthHeatmap.vue';
import PauseSheet from '@/features/gym/components/PauseSheet.vue';
import { deloadWeekNumbers, planWeek, planWeeksTotal } from '@/shared/utils/planCalendar';
import { localDateISO } from '@/shared/utils/timeFormat';
import { showToast } from '@/shared/utils/toast';
import {
  Chart,
  BarController, BarElement,
  LinearScale, CategoryScale, Tooltip
} from 'chart.js';
import { chartBarDataset, chartTicks, chartGrid } from '@/shared/utils/chartStyle';
import TrendChart from '@/shared/components/TrendChart.vue';
import { useChartScrub } from '@/shared/composables/useChartScrub';
import { hapticSelect } from '@/shared/utils/haptics';

Chart.register(BarController, BarElement, LinearScale, CategoryScale, Tooltip);

const HEATMAP_WEEKS = 10;

const windowDays = ref(90);
const muscleVolume = ref<MuscleVolume[]>([]);
const weeklyTonnage = ref<WeeklyTonnage[]>([]);
const frequency = ref<WorkoutDayCount[]>([]);

const muscleChartRef = ref<HTMLCanvasElement>();
let muscleChart: Chart | null = null;

const totalVolume = computed(() =>
  muscleVolume.value.reduce((acc, m) => acc + (Number(m.volume) || 0), 0)
);
const totalSets = computed(() =>
  muscleVolume.value.reduce((acc, m) => acc + (Number(m.sets) || 0), 0)
);
const totalWorkouts = computed(() =>
  frequency.value
    .filter((d) => withinWindow(d.date))
    .reduce((acc, d) => acc + (Number(d.count) || 0), 0)
);
const workoutsPerWeek = computed(() => {
  const weeks = windowDays.value / 7;
  return weeks > 0 ? Math.round((totalWorkouts.value / weeks) * 10) / 10 : 0;
});

// Push = chest/shoulders/arms/triceps, Pull = back, Legs = legs, Core = core.
const PUSH = new Set(['chest', 'shoulders', 'arms', 'triceps']);
const balanceSegments = computed(() => {
  let push = 0, pull = 0, legs = 0, core = 0;
  for (const m of muscleVolume.value) {
    const name = (m.muscle_group || '').toLowerCase();
    const vol = Number(m.volume) || 0;
    if (name === 'back') pull += vol;
    else if (name === 'legs') legs += vol;
    else if (name === 'core') core += vol;
    else if (PUSH.has(name)) push += vol;
  }
  const total = push + pull + legs + core;
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  return [
    { label: 'Push', pct: pct(push), color: 'var(--ion-color-accent-red)' },
    { label: 'Pull', pct: pct(pull), color: 'color-mix(in srgb, var(--ion-color-accent-red) 60%, transparent)' },
    { label: 'Legs', pct: pct(legs), color: 'rgba(var(--nt-ink), 0.45)' },
    { label: 'Core', pct: pct(core), color: 'rgba(var(--nt-ink), 0.2)' },
  ].filter((s) => s.pct > 0);
});

function withinWindow(dateKey: string): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays.value);
  return dateKey >= localDateISO(cutoff);
}

const formatVolume = (volume: number) => {
  if (volume >= 10000) return `${Math.round(volume / 100) / 10}k`;
  return `${Math.round(volume)}`;
};

const loadAll = async () => {
  // Fetch enough weeks to cover both the heatmap (HEATMAP_WEEKS) and the selected
  // window, otherwise the "Workouts"/"Per week" tiles undercount on 90/180-day views.
  const freqWeeks = Math.max(HEATMAP_WEEKS, Math.ceil(windowDays.value / 7));
  const [volume, tonnage, freq] = await Promise.all([
    queryVolumeByMuscleGroup(windowDays.value).catch(() => []),
    queryWeeklyTonnage(8).catch(() => []),
    queryWorkoutFrequency(freqWeeks).catch(() => []),
  ]);
  muscleVolume.value = volume;
  weeklyTonnage.value = tonnage;
  frequency.value = freq;
  await loadPlanProgress();
  await nextTick();
  renderCharts();
};

const renderCharts = () => {
  renderMuscleChart();
};

// Scrub: selected row + readout (defaults to the top muscle group).
const muscleScrub = useChartScrub({
  chart: () => muscleChart,
  count: () => muscleVolume.value.length,
  vertical: true, // indexAxis 'y' — bars stack top→bottom, so scrub vertically
});
const muscleActiveIdx = computed(() =>
  muscleScrub.selectedIdx.value ?? Math.max(muscleVolume.value.length - 1, 0));
const muscleReadoutLabel = computed(() =>
  muscleVolume.value[muscleActiveIdx.value]?.muscle_group ?? '');
const muscleReadoutValue = computed(() => {
  const m = muscleVolume.value[muscleActiveIdx.value];
  return m ? `${formatVolume(Number(m.volume) || 0)} kg` : '—';
});

const renderMuscleChart = () => {
  // .update() instead of destroy()+new: keeps tooltip state, canvas sizing and
  // animations stable across re-entries.
  if (muscleChart && muscleChartRef.value && muscleVolume.value.length > 0) {
    muscleChart.data.labels = muscleVolume.value.map((m) => m.muscle_group);
    muscleChart.data.datasets[0].data = muscleVolume.value.map((m) => m.volume);
    muscleChart.update();
    return;
  }
  if (muscleChart) { muscleChart.destroy(); muscleChart = null; }
  if (!muscleChartRef.value || muscleVolume.value.length === 0) return;
  const ctx = muscleChartRef.value.getContext('2d');
  if (!ctx) return;

  muscleChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: muscleVolume.value.map((m) => m.muscle_group),
      datasets: [
        {
          label: 'Volume',
          data: muscleVolume.value.map((m) => Number(m.volume) || 0),
          ...chartBarDataset,
        },
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      animation: false,
      maintainAspectRatio: false,
      layout: { padding: { right: 8 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: false, // readout row replaces the floating tooltip
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { ...chartTicks, callback: (v) => `${v}` },
          grid: chartGrid,
        },
        y: {
          ticks: chartTicks,
          grid: { display: false },
        }
      }
    },
    plugins: [muscleScrub.scrubPlugin],
  });
};

// Weekly tonnage → TrendChart pts
const tonnagePts = computed(() =>
  weeklyTonnage.value.map((w) => ({
    label: weekLabel(w.week),
    value: Number(w.volume) || 0,
  }))
);

// "2026-23" -> "W23"
const weekLabel = (week: string) => {
  const parts = week.split('-');
  return parts.length === 2 ? `W${Number(parts[1])}` : week;
};

// ── Plan progress card (T16) + life-event log (T14) ──────────────────────────
interface PlanSelection {
  plan: Plan;
  pauses: PlanPause[];
  series: Array<{ date: string; weight: number; tonnage: number; templateId: number | null }>;
  adherence: Awaited<ReturnType<typeof getPlanAdherence>>;
}
const planSelections = ref<Map<number, PlanSelection>>(new Map());
const templateNames = ref<Map<number, string>>(new Map());
const selectedPlanId = ref<number | null>(null);
const lifeEvents = ref<LifeEvent[]>([]);

const planPickerOptions = computed(() =>
  [...planSelections.value.values()]
    .sort((a, b) => (a.plan.start_date < b.plan.start_date ? 1 : -1))
    .map((s) => ({
      id: s.plan.id,
      label: `${s.plan.name}${s.plan.archived ? ' (past)' : ''}`,
    }))
);

const selected = computed(() =>
  selectedPlanId.value != null ? planSelections.value.get(selectedPlanId.value) ?? null : null
);

const planStats = computed(() => {
  const s = selected.value;
  if (!s) return null;
  const cfg = planConfigOf(s.plan);
  const spans = pauseSpansOf(s.pauses);
  const todayKey = localDateISO();
  const elapsed = s.plan.archived || s.plan.end_date < todayKey;
  const week = planWeek(cfg, spans, new Date());
  const total = planWeeksTotal(cfg, spans);
  const deloads = deloadWeekNumbers(cfg);
  return {
    weekLabel: elapsed ? `${total}w final` : `${week ?? '—'} / ${total}`,
    totalDone: s.adherence.totalDone,
    expectedByNow: s.adherence.expectedByNow,
    completion: s.adherence.completion,
    deloadsDone: elapsed ? deloads.size : [...deloads].filter((w) => (week ?? 0) > w).length,
    deloadsTotal: deloads.size,
  };
});

const planTrendPts = computed(() =>
  (selected.value?.series ?? []).map((d) => ({ label: d.date.slice(5), value: d.tonnage }))
);

// est-1RM dashed overlay lives on the same series in the weight view; with
// tonnage points the overlay reuses top-set weight (comparable effort shape).
const planEst1rmPts = computed(() =>
  (selected.value?.series ?? []).map((d) => ({ label: d.date.slice(5), value: d.weight }))
);

/** Point-index spans of paused days (incl. open pauses) for the red shading. */
const planShadeSpans = computed(() => {
  const s = selected.value;
  if (!s) return undefined;
  const dates = s.series.map((d) => d.date);
  if (dates.length === 0) return undefined;
  const spans: Array<{ start: number; end: number }> = [];
  for (const p of s.pauses) {
    const startKey = p.start_date;
    const endKey = p.end_date ?? localDateISO();
    let startIdx = dates.findIndex((d) => d >= startKey);
    if (startIdx < 0) startIdx = dates.length; // pause entirely before first workout point
    let endIdx = dates.length - 1;
    for (let i = 0; i < dates.length; i++) {
      if (dates[i] > endKey) { endIdx = i - 1; break; }
    }
    if (endIdx >= startIdx && startIdx < dates.length) {
      spans.push({ start: Math.max(0, startIdx), end: Math.max(0, endIdx) });
    }
  }
  return spans.length > 0 ? spans : undefined;
});

const planTemplateRows = computed(() => {
  const s = selected.value;
  if (!s || s.adherence.totalTonnage <= 0) return [];
  return s.adherence.doneCounts
    .filter((d) => d.templateId !== null)
    .map((d) => ({
      id: d.templateId as number,
      name: templateNames.value.get(d.templateId as number) ?? `Template ${d.templateId}`,
      done: d.done,
      share: d.tonnage / s.adherence.totalTonnage,
    }))
    .sort((a, b) => b.share - a.share);
});

const planBeforeAfter = computed(() => {
  const s = selected.value;
  if (!s || s.series.length < 2) return [];
  const first = s.series.slice(0, 7);
  const last = s.series.slice(-7);
  const firstWeek = new Map<number, number>();
  for (const d of first) {
    if (d.templateId == null) continue;
    firstWeek.set(d.templateId, Math.max(firstWeek.get(d.templateId) ?? 0, d.weight));
  }
  const lastWeek = new Map<number, number>();
  for (const d of last) {
    if (d.templateId == null) continue;
    lastWeek.set(d.templateId, Math.max(lastWeek.get(d.templateId) ?? 0, d.weight));
  }
  const rows: Array<{ name: string; first: number; last: number }> = [];
  for (const [id, fw] of firstWeek) {
    const lw = lastWeek.get(id);
    if (lw == null) continue;
    rows.push({ name: templateNames.value.get(id) ?? `Template ${id}`, first: Math.round(fw), last: Math.round(lw) });
  }
  return rows;
});

const planPauseLog = computed(() => {
  const s = selected.value;
  if (!s) return [];
  return s.pauses.map((p) => {
    const end = p.end_date ?? localDateISO();
    const days = Math.max(1, Math.round((new Date(`${end}T00:00:00`).getTime() - new Date(`${p.start_date}T00:00:00`).getTime()) / 86_400_000) + 1);
    return { label: `${p.reason.charAt(0).toUpperCase() + p.reason.slice(1)}${p.end_date ? '' : ' (open)'}`, days };
  });
});

const loadPlanProgress = async () => {
  const [plans, templates] = await Promise.all([getPlans(true), Promise.resolve([])]);
  void templates;
  templateNames.value = new Map(
    (await import('@/shared/db/app_db').then((m) => m.getTemplates(true)) as any[])
      .map((t) => [Number(t.id), String(t.name)])
  );
  const next = new Map<number, PlanSelection>();
  for (const plan of plans.slice(0, 12)) {
    const pauses = await getPausesForPlan(plan.id);
    const [series, adherence] = await Promise.all([
      getPlanWorkoutSeries(plan, pauses),
      getPlanAdherence(plan, pauses, 1),
    ]);
    next.set(plan.id, { plan, pauses, series, adherence });
  }
  planSelections.value = next;
  // Default to the active plan; keep a past selection if still present.
  if (selectedPlanId.value == null || !next.has(selectedPlanId.value)) {
    const active = [...next.values()].find((s) => !s.plan.archived && s.plan.end_date >= localDateISO());
    selectedPlanId.value = active?.plan.id ?? [...next.keys()][0] ?? null;
  }
  lifeEvents.value = await getLifeEvents(undefined, 50).catch(() => []);
};

const lifeEventLabel = (ev: LifeEvent) => {
  const base = ev.type.charAt(0).toUpperCase() + ev.type.slice(1);
  return ev.severity ? `${base} (${ev.severity === 'knocked_out' ? 'knocked out' : ev.severity})` : base;
};

const logLifeEvent = async () => {
  hapticSelect();
  const modal = await modalController.create({
    component: PauseSheet,
    componentProps: { title: 'Log event', mode: 'life-event' },
    breakpoints: [0, 0.7, 1],
    initialBreakpoint: 0.7,
    cssClass: 'pause-sheet-modal',
  });
  await modal.present();
  const { data, role } = await modal.onDidDismiss<{ reason: string; note: string | null; startDate: string; endDate: string | null; severity: string | null }>();
  if (role !== 'confirm' || !data) return;
  const { createLifeEvent } = await import('@/shared/db/app_db');
  await createLifeEvent({
    type: data.reason,
    severity: data.severity,
    start_date: data.startDate,
    end_date: data.endDate,
    note: data.note,
  });
  lifeEvents.value = await getLifeEvents(undefined, 50).catch(() => []);
  showToast('event logged', 'success');
};

watch(windowDays, async () => {
  hapticSelect();
  await loadAll();
}, { flush: 'post' });

onIonViewWillEnter(() => {
  loadAll();
});

onUnmounted(() => {
  if (muscleChart) { muscleChart.destroy(); muscleChart = null; }
});
</script>

<style scoped>
.analytics-shell {
  padding: 16px;
  display: grid;
  /* shrinkable single column so a wide child (e.g. the load-chart SVG)
     scrolls inside its own container instead of widening the page */
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  max-width: 760px;
  margin: 0 auto;
  width: min(100%, 760px);
}

.card {
  background: var(--ion-color-primary);
  border-radius: var(--nt-radius-md);
  padding: 18px;
  display: grid;
  gap: 14px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}



.tile-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 14px;
  background: rgba(var(--nt-ink), 0.05);
  border-radius: 10px;
  text-align: center;
}

.tile__label {
  font-family: var(--nt-font-head);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--nt-text-dim);
}

.tile__value {
  font-family: var(--nt-font-display);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--nt-fg);
}

.time-select {
  max-width: 130px;
  --padding-start: 8px;
  --padding-end: 8px;
  min-height: auto;
  font-size: 12px;
}

/* Balance bar */
.balance-bar {
  display: flex;
  height: 14px;
  border-radius: var(--nt-radius-pill);
  overflow: hidden;
  background: rgba(var(--nt-ink), 0.05);
}

.balance-bar__seg {
  height: 100%;
}

.balance-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.balance-legend__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--nt-font-head);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--nt-text-dim);
}

.balance-legend__swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

/* Plan progress rows */
.plan-tpl-rows {
  display: grid;
  gap: 8px;
}

.plan-tpl-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: rgba(var(--nt-ink), 0.05);
  border-radius: 10px;
}

.plan-tpl-row__name {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(var(--nt-ink), 0.9);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plan-tpl-row__meta {
  font-family: var(--nt-font-mono);
  font-size: 0.75rem;
  color: var(--nt-text-dim);
  white-space: nowrap;
}

.log-event-btn {
  --color: var(--ion-color-accent-red);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
}

/* Chart.js scrub readout (mirrors TrendChart's readout row) */
.chart-readout {
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-family: var(--nt-font-head);
  font-size: 0.72rem;
  color: var(--nt-text-dim);
}

.chart-readout__date {
  min-width: 3.5em;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.chart-readout__value strong {
  color: var(--nt-fg);
  font-weight: 600;
}

.scrub-canvas {
  touch-action: pan-y; /* horizontal drag scrubs, vertical still scrolls */
  cursor: crosshair;
}

@media (min-width: 600px) {
  .tile-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>