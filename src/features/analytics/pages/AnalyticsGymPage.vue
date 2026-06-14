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
            <p class="section-kicker">Training load</p>
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

        <!-- Volume by muscle group -->
        <div class="card">
          <p class="section-kicker">Volume by muscle group</p>
          <template v-if="muscleVolume.length > 0">
            <div class="chart-frame">
              <canvas ref="muscleChartRef"></canvas>
            </div>
          </template>
          <p v-else class="empty-copy">No completed sets in this window.</p>
        </div>

        <!-- Muscle balance -->
        <div v-if="muscleVolume.length > 0" class="card">
          <p class="section-kicker">Push / Pull / Legs balance</p>
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
          <p class="section-kicker">Weekly tonnage</p>
          <template v-if="weeklyTonnage.length > 0">
            <div class="chart-frame chart-frame--short">
              <canvas ref="tonnageChartRef"></canvas>
            </div>
          </template>
          <p v-else class="empty-copy">Not enough history yet.</p>
        </div>

        <!-- Frequency heatmap -->
        <div class="card">
          <p class="section-kicker">Training frequency</p>
          <template v-if="frequency.length > 0">
            <div class="freq-grid">
              <div
                v-for="(cell, idx) in heatCells"
                :key="idx"
                class="freq-cell"
                :class="{ 'freq-cell--future': cell.future }"
                :style="cell.future ? {} : { background: heatColor(cell.count) }"
                :title="cell.future ? '' : `${cell.date}: ${cell.count} workout${cell.count === 1 ? '' : 's'}`"
              ></div>
            </div>
            <div class="freq-legend">
              <span class="freq-legend__label">Less</span>
              <i class="freq-cell freq-cell--legend" :style="{ background: heatColor(0) }"></i>
              <i class="freq-cell freq-cell--legend" :style="{ background: heatColor(1) }"></i>
              <i class="freq-cell freq-cell--legend" :style="{ background: heatColor(2) }"></i>
              <span class="freq-legend__label">More</span>
            </div>
          </template>
          <p v-else class="empty-copy">No workouts logged yet.</p>
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
  onIonViewWillEnter
} from '@ionic/vue';
import { ref, computed, nextTick, watch, onUnmounted } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import AnalyticsSectionTabs from '@/features/analytics/components/AnalyticsSectionTabs.vue';
import {
  queryVolumeByMuscleGroup,
  queryWeeklyTonnage,
  queryWorkoutFrequency
} from '@/shared/db/app_db';
import type { MuscleVolume, WeeklyTonnage, WorkoutDayCount } from '@/shared/db/app_db';
import {
  Chart,
  LineController, LineElement, PointElement,
  BarController, BarElement,
  LinearScale, CategoryScale, Filler, Tooltip
} from 'chart.js';
import { chartLineDataset, chartTooltip, chartTicks, chartGrid, chartColors } from '@/shared/utils/chartStyle';
import { hapticSelect } from '@/shared/utils/haptics';

Chart.register(LineController, LineElement, PointElement, BarController, BarElement, LinearScale, CategoryScale, Filler, Tooltip);

const HEATMAP_WEEKS = 10;

const windowDays = ref(90);
const muscleVolume = ref<MuscleVolume[]>([]);
const weeklyTonnage = ref<WeeklyTonnage[]>([]);
const frequency = ref<WorkoutDayCount[]>([]);

const muscleChartRef = ref<HTMLCanvasElement>();
const tonnageChartRef = ref<HTMLCanvasElement>();
let muscleChart: Chart | null = null;
let tonnageChart: Chart | null = null;

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

// Push = chest/shoulders/arms, Pull = back, Legs = legs, Core = core.
const PUSH = new Set(['chest', 'shoulders', 'arms']);
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
    { label: 'Push', pct: pct(push), color: 'rgb(215, 26, 33)' },
    { label: 'Pull', pct: pct(pull), color: 'rgba(215, 26, 33, 0.6)' },
    { label: 'Legs', pct: pct(legs), color: 'rgba(255, 255, 255, 0.45)' },
    { label: 'Core', pct: pct(core), color: 'rgba(255, 255, 255, 0.2)' },
  ].filter((s) => s.pct > 0);
});

// Heatmap grid: HEATMAP_WEEKS columns × 7 rows, filled column-by-column.
const heatCells = computed(() => {
  const counts = new Map<string, number>();
  for (const d of frequency.value) counts.set(d.date, Number(d.count) || 0);

  const today = new Date();
  const todayKey = toKey(today);
  // Anchor to the start of the current week (Sunday), go back HEATMAP_WEEKS - 1 weeks.
  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay() - (HEATMAP_WEEKS - 1) * 7);

  const cells: { date: string; count: number; future: boolean }[] = [];
  for (let week = 0; week < HEATMAP_WEEKS; week++) {
    for (let day = 0; day < 7; day++) {
      const d = new Date(start);
      d.setDate(start.getDate() + week * 7 + day);
      const key = toKey(d);
      cells.push({ date: key, count: counts.get(key) || 0, future: key > todayKey });
    }
  }
  return cells;
});

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function withinWindow(dateKey: string): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays.value);
  return dateKey >= toKey(cutoff);
}

const heatColor = (count: number): string => {
  if (count <= 0) return 'rgba(255, 255, 255, 0.06)';
  if (count === 1) return 'rgba(215, 26, 33, 0.55)';
  return 'rgb(215, 26, 33)';
};

const formatVolume = (volume: number) => {
  if (volume >= 10000) return `${Math.round(volume / 100) / 10}k`;
  return `${Math.round(volume)}`;
};

const loadAll = async () => {
  const [volume, tonnage, freq] = await Promise.all([
    queryVolumeByMuscleGroup(windowDays.value).catch(() => []),
    queryWeeklyTonnage(8).catch(() => []),
    queryWorkoutFrequency(HEATMAP_WEEKS).catch(() => []),
  ]);
  muscleVolume.value = volume;
  weeklyTonnage.value = tonnage;
  frequency.value = freq;
  await nextTick();
  renderCharts();
};

const renderCharts = () => {
  renderMuscleChart();
  renderTonnageChart();
};

const renderMuscleChart = () => {
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
          backgroundColor: 'rgba(215, 26, 33, 0.55)',
          hoverBackgroundColor: chartColors.red,
          borderRadius: 3,
          maxBarThickness: 32,
        },
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      animation: false,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...chartTooltip,
          callbacks: { label: (c) => ` ${Math.round((c.parsed.x as number) ?? 0)} kg` },
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
    }
  });
};

const renderTonnageChart = () => {
  if (tonnageChart) { tonnageChart.destroy(); tonnageChart = null; }
  if (!tonnageChartRef.value || weeklyTonnage.value.length === 0) return;
  const ctx = tonnageChartRef.value.getContext('2d');
  if (!ctx) return;

  tonnageChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: weeklyTonnage.value.map((w) => weekLabel(w.week)),
      datasets: [
        {
          ...chartLineDataset,
          label: 'Volume',
          data: weeklyTonnage.value.map((w) => Number(w.volume) || 0),
        },
      ]
    },
    options: {
      responsive: true,
      animation: false,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...chartTooltip,
          callbacks: { label: (c) => ` ${Math.round(c.parsed.y ?? 0)} kg` },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { ...chartTicks, callback: (v) => `${v}` },
          grid: chartGrid,
        },
        x: {
          ticks: { ...chartTicks, maxTicksLimit: 8 },
          grid: { display: false },
        }
      }
    }
  });
};

// "2026-23" -> "W23"
const weekLabel = (week: string) => {
  const parts = week.split('-');
  return parts.length === 2 ? `W${Number(parts[1])}` : week;
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
  if (tonnageChart) { tonnageChart.destroy(); tonnageChart = null; }
});
</script>

<style scoped>
.analytics-shell {
  padding: 16px;
  display: grid;
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

.section-kicker {
  margin: 0;
  font-family: var(--nt-font-head);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--nt-text-dim);
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
  background: rgba(255, 255, 255, 0.05);
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
  color: #fff;
}

.time-select {
  max-width: 130px;
  --padding-start: 8px;
  --padding-end: 8px;
  min-height: auto;
  font-size: 12px;
}

.chart-frame {
  position: relative;
  height: 260px;
  width: 100%;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 8px 4px 4px;
}

.chart-frame--short {
  height: 200px;
}

/* Balance bar */
.balance-bar {
  display: flex;
  height: 14px;
  border-radius: var(--nt-radius-pill);
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
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

/* Frequency heatmap */
.freq-grid {
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: repeat(7, 1fr);
  grid-auto-columns: 1fr;
  gap: 3px;
}

.freq-cell {
  aspect-ratio: 1;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.06);
}

.freq-cell--future {
  background: transparent !important;
}

.freq-cell--legend {
  width: 10px;
  height: 10px;
  aspect-ratio: auto;
  border-radius: 2px;
}

.freq-legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
}

.freq-legend__label {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.35);
  margin: 0 4px;
}

.empty-copy {
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
}

@media (min-width: 600px) {
  .tile-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
