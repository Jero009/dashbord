<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/Exercise"></ion-back-button>
        </ion-buttons>
        <ion-title class="title">{{ exerciseName }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">{{ exerciseName }}</ion-title>
        </ion-toolbar>
      </ion-header>

      <div class="detail-shell">
        <!-- PR hero -->
        <div v-if="hasAnyData" class="card">
          <div class="card-header">
            <p class="section-kicker">Personal record</p>
            <div v-if="muscleGroup || equipment" class="meta-chips">
              <span v-if="muscleGroup" class="meta-chip">{{ muscleGroup }}</span>
              <span v-if="equipment" class="meta-chip">{{ equipment }}</span>
            </div>
          </div>
          <div v-if="currentPR" class="tile-grid tile-grid--3">
            <div class="tile">
              <span class="tile__label">Max weight</span>
              <strong class="tile__value tile__value--accent">{{ currentPR.pr_weight }} kg</strong>
              <small class="tile__detail">{{ currentPR.pr_reps }} reps</small>
            </div>
            <div class="tile">
              <span class="tile__label">Est. 1RM</span>
              <strong class="tile__value">{{ currentPR.one_rep_max }} kg</strong>
              <small class="tile__detail">Epley</small>
            </div>
            <div class="tile">
              <span class="tile__label">Achieved</span>
              <strong class="tile__value tile__value--date">{{ formatPRDate(currentPR.date_achieved) }}</strong>
              <small class="tile__detail">&nbsp;</small>
            </div>
          </div>
          <p v-else class="empty-copy">No record yet.</p>
        </div>

        <!-- Strength chart -->
        <div v-if="hasAnyData" class="card">
          <div class="card-header">
            <p class="section-kicker">Strength</p>
            <ion-select
              v-model="timeFrame"
              interface="action-sheet"
              :interface-options="{ cssClass: 'app-action-sheet' }"
              class="app-select time-select"
            >
              <ion-select-option value="30">30 days</ion-select-option>
              <ion-select-option value="90">90 days</ion-select-option>
              <ion-select-option value="180">180 days</ion-select-option>
              <ion-select-option value="365">1 year</ion-select-option>
            </ion-select>
          </div>
          <template v-if="historyData.length > 0">
            <div class="chart-frame">
              <canvas ref="strengthChartRef"></canvas>
            </div>
            <div class="chart-legend">
              <span class="chart-legend__item"><i class="chart-legend__swatch chart-legend__swatch--red"></i>Top set</span>
              <span class="chart-legend__item"><i class="chart-legend__swatch chart-legend__swatch--dim"></i>Est. 1RM</span>
            </div>
          </template>
          <p v-else class="empty-copy">No sessions in this window.</p>
        </div>

        <!-- Volume chart -->
        <div v-if="historyData.length > 0" class="card">
          <p class="section-kicker">Volume per session</p>
          <div class="chart-frame chart-frame--short">
            <canvas ref="volumeChartRef"></canvas>
          </div>
        </div>

        <!-- Stats -->
        <div v-if="historyData.length > 0" class="card">
          <p class="section-kicker">Last {{ timeFrame }} days</p>
          <div class="tile-grid tile-grid--4">
            <div class="tile">
              <span class="tile__label">Sessions</span>
              <strong class="tile__value">{{ totalWorkouts }}</strong>
            </div>
            <div class="tile">
              <span class="tile__label">Avg volume</span>
              <strong class="tile__value">{{ formatVolume(avgVolume) }}</strong>
            </div>
            <div class="tile">
              <span class="tile__label">Best volume</span>
              <strong class="tile__value">{{ formatVolume(maxVolume) }}</strong>
            </div>
            <div class="tile">
              <span class="tile__label">Top set trend</span>
              <strong class="tile__value" :class="trendClass">{{ weightTrendLabel }}</strong>
            </div>
            <div v-if="avgRPE !== null" class="tile">
              <span class="tile__label">Avg RPE</span>
              <strong class="tile__value">{{ avgRPE }}</strong>
              <small class="tile__detail">/ 10</small>
            </div>
          </div>
        </div>

        <!-- Recent sessions -->
        <div v-if="sessions.length > 0" class="card">
          <p class="section-kicker">Recent sessions</p>
          <div class="session-list">
            <div v-for="s in sessions" :key="s.workout_id" class="session-row">
              <span class="session-row__date">{{ formatWorkoutDate(s.date) }}</span>
              <span class="session-row__sets">{{ s.set_count }} sets</span>
              <span class="session-row__top">{{ s.top_weight }} kg <small>x {{ s.top_reps }}</small></span>
              <span v-if="s.avg_rpe != null" class="session-row__rpe">@{{ s.avg_rpe }}</span>
              <span v-else class="session-row__rpe session-row__rpe--empty">—</span>
              <span class="session-row__volume">{{ formatVolume(s.volume) }}</span>
            </div>
          </div>
        </div>

        <!-- Global empty state -->
        <div v-if="!hasAnyData" class="card">
          <p class="empty-copy">No history yet.</p>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonSelect,
  IonSelectOption,
  onIonViewWillEnter
} from '@ionic/vue';
import { useRoute } from 'vue-router';
import { ref, computed, nextTick, watch, onUnmounted } from 'vue';
import { getExerciseById, getExercisePR, getExerciseHistory, getExerciseSessions } from '@/shared/db/app_db';
import {
  Chart,
  LineController, LineElement, PointElement,
  BarController, BarElement,
  LinearScale, CategoryScale, Filler, Tooltip
} from 'chart.js';
import { chartLineDataset, chartDimDataset, chartTooltip, chartTicks, chartGrid, chartColors } from '@/shared/utils/chartStyle';
import { formatWorkoutDate } from '@/shared/utils/timeFormat';
import { hapticSelect } from '@/shared/utils/haptics';
import type { ExercisePR, ExerciseHistoryPoint, ExerciseSession } from '@/features/gym/types/models';

Chart.register(LineController, LineElement, PointElement, BarController, BarElement, LinearScale, CategoryScale, Filler, Tooltip);

const route = useRoute();
const strengthChartRef = ref<HTMLCanvasElement>();
const volumeChartRef = ref<HTMLCanvasElement>();
let strengthChart: Chart | null = null;
let volumeChart: Chart | null = null;

const exerciseId = computed(() => Number(route.params.id));
const exerciseName = ref('');
const muscleGroup = ref('');
const equipment = ref('');
const currentPR = ref<ExercisePR | null>(null);
const historyData = ref<ExerciseHistoryPoint[]>([]);
const sessions = ref<ExerciseSession[]>([]);
const timeFrame = ref('90');

const hasAnyData = computed(() =>
  !!currentPR.value || historyData.value.length > 0 || sessions.value.length > 0
);

const totalWorkouts = computed(() => historyData.value.length);
const avgVolume = computed(() => {
  if (historyData.value.length === 0) return 0;
  const sum = historyData.value.reduce((acc, item) => acc + (Number(item.volume) || 0), 0);
  return Math.round(sum / historyData.value.length);
});
const maxVolume = computed(() => {
  if (historyData.value.length === 0) return 0;
  return Math.max(...historyData.value.map((item) => Number(item.volume) || 0));
});

const avgRPE = computed(() => {
  const vals = sessions.value.map(s => s.avg_rpe).filter(v => v != null) as number[];
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
});

// Delta between first and last top-set weight inside the window
const weightTrend = computed(() => {
  if (historyData.value.length < 2) return null;
  const first = Number(historyData.value[0].weight) || 0;
  const last = Number(historyData.value[historyData.value.length - 1].weight) || 0;
  return Math.round((last - first) * 10) / 10;
});
const weightTrendLabel = computed(() => {
  if (weightTrend.value === null) return '—';
  if (weightTrend.value === 0) return 'Flat';
  return `${weightTrend.value > 0 ? '+' : ''}${weightTrend.value} kg`;
});
const trendClass = computed(() => ({
  'tile__value--positive': weightTrend.value !== null && weightTrend.value > 0,
  'tile__value--accent': weightTrend.value !== null && weightTrend.value < 0,
}));

// Epley estimate per history point, same formula the PR table uses
const estOneRepMax = (point: ExerciseHistoryPoint): number => {
  const weight = Number(point.weight) || 0;
  const reps = Number(point.reps) || 1;
  if (reps <= 1) return weight;
  return Math.round((weight * (1 + reps / 30)) * 10) / 10;
};

const formatVolume = (volume: number) => {
  if (volume >= 10000) return `${Math.round(volume / 100) / 10}k kg`;
  return `${Math.round(volume)} kg`;
};

const formatPRDate = (dateString: string) => {
  const date = new Date(dateString.includes(' ') ? dateString.replace(' ', 'T') + 'Z' : dateString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const loadExerciseData = async () => {
  const id = exerciseId.value;
  if (!id || Number.isNaN(id)) return;

  const [exercise, pr, history, recentSessions] = await Promise.all([
    getExerciseById(id).catch(() => null),
    getExercisePR(id).catch(() => null),
    getExerciseHistory(id, Number(timeFrame.value)).catch(() => []),
    getExerciseSessions(id, 8).catch(() => []),
  ]);

  exerciseName.value = exercise?.name || 'Exercise';
  muscleGroup.value = exercise?.muscle_group || '';
  equipment.value = exercise?.equipment || '';
  currentPR.value = pr;
  historyData.value = history;
  sessions.value = recentSessions;
  await nextTick();
  renderCharts();
};

const chartLabels = () =>
  historyData.value.map((item) => {
    const date = new Date(item.date);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

const renderCharts = () => {
  renderStrengthChart();
  renderVolumeChart();
};

const renderStrengthChart = () => {
  if (strengthChart) { strengthChart.destroy(); strengthChart = null; }
  if (!strengthChartRef.value || historyData.value.length === 0) return;
  const ctx = strengthChartRef.value.getContext('2d');
  if (!ctx) return;

  strengthChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartLabels(),
      datasets: [
        {
          ...chartLineDataset,
          label: 'Top set',
          data: historyData.value.map((item) => Number(item.weight) || 0),
        },
        {
          ...chartDimDataset,
          label: 'Est. 1RM',
          data: historyData.value.map((item) => estOneRepMax(item)),
        },
      ]
    },
    options: {
      responsive: true,
      animation: false,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...chartTooltip,
          callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y} kg` },
        },
      },
      scales: {
        y: {
          ticks: { ...chartTicks, callback: (v) => `${v} kg` },
          grid: chartGrid,
        },
        x: {
          ticks: { ...chartTicks, maxTicksLimit: 6 },
          grid: chartGrid,
        }
      }
    }
  });
};

const renderVolumeChart = () => {
  if (volumeChart) { volumeChart.destroy(); volumeChart = null; }
  if (!volumeChartRef.value || historyData.value.length === 0) return;
  const ctx = volumeChartRef.value.getContext('2d');
  if (!ctx) return;

  volumeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: chartLabels(),
      datasets: [
        {
          label: 'Volume',
          data: historyData.value.map((item) => Number(item.volume) || 0),
          backgroundColor: 'rgba(215, 26, 33, 0.55)',
          hoverBackgroundColor: chartColors.red,
          borderRadius: 3,
          maxBarThickness: 28,
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
          ticks: { ...chartTicks, callback: (v) => `${v} kg` },
          grid: chartGrid,
        },
        x: {
          ticks: { ...chartTicks, maxTicksLimit: 6 },
          grid: { display: false },
        }
      }
    }
  });
};

watch(timeFrame, async () => {
  hapticSelect();
  await loadExerciseData();
}, { flush: 'post' });

onIonViewWillEnter(() => {
  loadExerciseData();
});

onUnmounted(() => {
  if (strengthChart) { strengthChart.destroy(); strengthChart = null; }
  if (volumeChart) { volumeChart.destroy(); volumeChart = null; }
});
</script>

<style scoped>
.detail-shell {
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
}

.tile-grid--3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.tile-grid--4 {
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

.tile__value--accent {
  color: var(--ion-color-accent-red);
}

.tile__value--positive {
  color: var(--nt-data-positive);
}

.tile__value--date {
  font-size: 0.95rem;
}

.tile__detail {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.6);
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

.chart-legend {
  display: flex;
  gap: 16px;
}

.chart-legend__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--nt-font-head);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--nt-text-dim);
}

.chart-legend__swatch {
  width: 14px;
  height: 2px;
  border-radius: 1px;
}

.chart-legend__swatch--red {
  background: var(--ion-color-accent-red);
}

.chart-legend__swatch--dim {
  background: rgba(255, 255, 255, 0.35);
}

.session-list {
  display: grid;
  gap: 8px;
}

.session-row {
  display: grid;
  grid-template-columns: 1fr auto auto auto auto;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
}

.session-row__date {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}

.session-row__sets {
  font-size: 0.75rem;
  color: var(--nt-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.session-row__top {
  font-family: var(--nt-font-mono);
  font-size: 0.85rem;
  color: #fff;
}

.session-row__top small {
  color: rgba(255, 255, 255, 0.55);
}

.session-row__rpe {
  font-family: var(--nt-font-mono);
  font-size: 0.8rem;
  color: var(--nt-text-dim);
  text-align: right;
  min-width: 28px;
}

.session-row__rpe--empty {
  color: rgba(255, 255, 255, 0.2);
}

.session-row__volume {
  font-family: var(--nt-font-mono);
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  text-align: right;
  min-width: 64px;
}

.meta-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.meta-chip {
  font-family: var(--nt-font-head);
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.06);
  padding: 3px 10px;
  border-radius: var(--nt-radius-pill);
}

.empty-copy {
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
}

@media (min-width: 600px) {
  .tile-grid--4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
