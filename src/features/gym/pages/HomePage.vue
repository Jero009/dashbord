<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
    </ion-header>
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Home</ion-title>
        </ion-toolbar>
      </ion-header>
    <ion-content :fullscreen="true" class="home-content">
      <div class="home-shell">
        <section class="hero-wrap">
          <div class="top-cards">
            <ion-card v-if="!activeWorkout" class="summary-card">
              <div class="card-topline">
                <p class="section-kicker">Last workout</p>
              </div>

              <div class="summary-card__body">
                <div class="card-metrics">
                  <div class="card-metric">
                    <span>Time</span>
                    <strong>{{ formatDuration(latestWorkout?.time_start, latestWorkout?.time_end) }}</strong>
                  </div>
                  <div class="card-metric">
                    <span>Total load</span>
                    <strong>{{ `${latestWorkout?.total_kg || 0} kg` }}</strong>
                  </div>
                  <div class="card-metric card-metric-wide">
                    <span>Completed</span>
                    <strong>{{ formatWorkoutDate(latestWorkout?.time_end) }}</strong>
                  </div>
                </div>


              </div>
            </ion-card>

            <ion-card v-else class="active-card" @click="backToWorkout()">
              <div class="card-topline">
                <p class="section-kicker">Active workout</p>
              </div>

              <div class="active-card__body">
                <div class="active-card__timer">
                  <span>Workout</span>
                  <strong>{{ formatWorkoutTimer() }}</strong>
                </div>

                <div v-if="activeRestTimer.isActive" class="active-card__timer active-card__timer--rest">
                  <span>Rest</span>
                  <strong>{{ formatRestTime(activeRestTimer.remaining) }}</strong>
                </div>
              </div>
            </ion-card>
          </div>

          <!-- Weekly progress -->
          <div class="weekly-card">
            <div class="weekly-card__header">
              <span class="section-kicker">This week</span>
              <span class="weekly-count">{{ weeklyCompletedWorkouts }} / {{ weeklyWorkoutGoal }}</span>
            </div>
            <div class="weekly-dots">
              <div
                v-for="dot in weeklyGoalDots"
                :key="dot"
                class="weekly-dot"
                :class="{ 'weekly-dot--filled': dot <= weeklyCompletedWorkouts }"
              />
            </div>
            <div class="weekly-progress-bar">
              <div class="weekly-progress-bar__fill" :style="{ width: weeklyGoalProgress + '%' }" />
            </div>
          </div>
        </section>

        <section class="workout-section">

          <div class="workout-grid">
            <ion-card
              class="workout-tile"
              :class="{ 'workout-tile-disabled': activeWorkout }"
              v-for="template in templates"
              :key="template.id"
              :aria-disabled="activeWorkout"
              @click="startWorkout(template.id)"
            >
              <div class="workout-tile__icon">
                <ion-icon :icon="barbellSharp"></ion-icon>
              </div>
              <div class="workout-tile__copy">
                <span>Workout</span>
                <strong>{{ template.name }}</strong>
                <small>{{ template.created_at }}</small>
              </div>
            </ion-card>
          </div>
        </section>

        <ion-card v-if="recentPRs.length" class="pr-card">
          <div class="card-topline">
            <p class="section-kicker">Recent PRs</p>
            <span class="pr-card__window">30 days</span>
          </div>
          <div class="pr-list">
            <button
              v-for="pr in recentPRs"
              :key="pr.id"
              class="pr-row"
              @click="openExercise(pr.exercise_id)"
            >
              <span class="pr-row__name">{{ pr.exercise_name }}</span>
              <span class="pr-row__stat">{{ pr.pr_weight }} kg <small>x {{ pr.pr_reps }}</small></span>
              <span class="pr-row__date">{{ formatWorkoutDate(pr.date_achieved) }}</span>
            </button>
          </div>
        </ion-card>

        <ion-card class="graph-card">
          <div class="graph-card__header">
            <ion-select placeholder="Select template" interface="action-sheet" :interface-options="{ cssClass: 'app-action-sheet' }" v-model="selectedTemplateId" class="app-select">
              <ion-select-option v-for="t in templates" :key="t.id" :value="t.id">
                {{ t.name }}
              </ion-select-option>
            </ion-select>
          </div>
          <div class="chart-frame">
            <canvas ref="chartRef"></canvas>
          </div>
        </ion-card>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonContent, IonCard, onIonViewWillEnter, IonIcon, IonSelect, IonSelectOption } from '@ionic/vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import { getTemplates, startWorkoutFromTemplate, getActiveWorkout, getLatestWorkout, getWorkoutsByName, getWorkouts, getRecentPRs } from '@/shared/db/app_db';
import { ref, onMounted, onUnmounted,computed,watch } from 'vue';
import { barbellSharp } from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler } from 'chart.js';
import type { WorkoutTemplate, Workout, WorkoutHistory } from '@/features/gym/types/models';
import { formatDuration, localDateISO, normalizeDateInput, formatWorkoutDate } from '@/shared/utils/timeFormat';
import { chartLineDataset, chartTooltip, chartTicks, chartGrid } from '@/shared/utils/chartStyle';
import { hapticHeavy, hapticLight } from '@/shared/utils/haptics';

const activeWorkout = ref(false);
const activeRestTimer = ref({
  isActive: false,
  remaining: 0,
  total: 0
});
let activeRestInterval: ReturnType<typeof setInterval> | null = null;

// routing
const router = useRouter();


const startWorkout = async (templateId: number) => {
  if (activeWorkout.value) {
    return;
  }
  hapticHeavy();

  const workoutId = await startWorkoutFromTemplate(templateId);

  if (!workoutId) {
    console.error('Failed to start workout');
    return;
  }

  router.push(`/workout/${workoutId}`);
};
// active workout id
const backToWorkout = async () => {
  hapticLight();
  const workout = await getActiveWorkout();

  if (workout) {
    router.push(`/workout/${workout.id}`);
  }
};

// displaying templates
const templates = ref<WorkoutTemplate[]>([]);

const loadTemplates = async () => {
  const data = await getTemplates();

  if (!data) {
    templates.value = [];
    return;
  }
  templates.value = data;

  if (data.length && !data.some(template => template.id === selectedTemplateId.value)) {
    selectedTemplateId.value = data[0].id;
  }
};
//latest workout

const latestWorkout = ref<Workout | null>(null);

const loadLatestWorkout = async () => {
  const workout = await getLatestWorkout();
  latestWorkout.value = workout || null;
};

// PRs achieved in the last 30 days, linked to the exercise detail page
const recentPRs = ref<any[]>([]);

const loadRecentPRs = async () => {
  const prs = await getRecentPRs(30);
  recentPRs.value = prs.slice(0, 5);
};

const openExercise = (exerciseId: number) => {
  hapticLight();
  router.push(`/exercise/${exerciseId}`);
};


const formatRestTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const clearActiveRestTimer = (removeStorage = false) => {
  if (activeRestInterval) {
    clearInterval(activeRestInterval);
    activeRestInterval = null;
  }

  activeRestTimer.value.isActive = false;
  activeRestTimer.value.remaining = 0;
  activeRestTimer.value.total = 0;

  if (removeStorage) {
    sessionStorage.removeItem('restTimer');
  }
};

const restoreActiveRestTimer = () => {
  const savedTimer = sessionStorage.getItem('restTimer');

  if (!savedTimer) {
    clearActiveRestTimer();
    return;
  }

  try {
    const parsedTimer = JSON.parse(savedTimer);
    const total = Math.max(1, Number(parsedTimer.total) || Number(parsedTimer.remaining) || 0);
    const endTime = Number(parsedTimer.endTime);

    if (!Number.isFinite(endTime)) {
      clearActiveRestTimer(true);
      return;
    }

    if (activeRestInterval) {
      clearInterval(activeRestInterval);
      activeRestInterval = null;
    }

    activeRestTimer.value.isActive = true;
    activeRestTimer.value.total = total;

    const syncRestTimer = () => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      activeRestTimer.value.remaining = remaining;

      if (remaining <= 0) {
        clearActiveRestTimer(true);
      }
    };

    syncRestTimer();

    if (activeRestTimer.value.isActive) {
      activeRestInterval = setInterval(syncRestTimer, 1000);
    }
  } catch {
    clearActiveRestTimer(true);
  }
};




// Timer logic (refactored)
const startTime = ref<string | null>(null);
const seconds = ref(0);
let interval: ReturnType<typeof setInterval> | null = null;

const loadActiveWorkout = async () => {
  const workout = await getActiveWorkout();
  if (workout && workout.time_start) {
    startTime.value = normalizeDateInput(workout.time_start);
    startTimer();
    activeWorkout.value = true;
    restoreActiveRestTimer();
  } else {
    startTime.value = null;
    seconds.value = 0;
    activeWorkout.value = false;
    clearActiveRestTimer(true);
    clearTimer();
  }
};


const startTimer = () => {
  if (!startTime.value || interval) return;
  interval = setInterval(() => {
    const start = new Date(startTime.value!).getTime();
    const now = Date.now();
    seconds.value = Math.max(0, Math.floor((now - start) / 1000));
  }, 1000);
};

const clearTimer = () => {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
};

const formatWorkoutTimer = () => {
  const hrs = Math.floor(seconds.value / 3600);
  const mins = Math.floor((seconds.value % 3600) / 60);
  const secs = seconds.value % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// chart 

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler);

const chartRef = ref<HTMLCanvasElement | null>(null);
let chart: Chart | null = null;

const workouts = ref<WorkoutHistory[]>([]);
const selectedTemplateId = ref<number | undefined>(undefined);

// prepare data
const chartData = computed(() => {
  return workouts.value
    .map(w => ({
      date: new Date(w.time_start.replace(' ', 'T')).toLocaleDateString(),
      kg: w.total_kg || 0
    }))
    .reverse(); // oldest → newest
});

// draw chart with debouncing
let renderChartTimeout: ReturnType<typeof setTimeout> | null = null;

const renderChart = () => {
  if (!chartRef.value) return;

  if (chart) {
    chart.destroy(); // prevent duplicates
  }

  chart = new Chart(chartRef.value, {
    type: 'line',
    data: {
      labels: chartData.value.map(d => d.date),
      datasets: [
        {
          ...chartLineDataset,
          label: 'Total KG',
          data: chartData.value.map(d => d.kg),
        }
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
          callbacks: { label: (ctx) => ` ${(ctx.parsed.y ?? 0).toFixed(0)} kg` }
        }
      },
      scales: {
        x: {
          ticks: { ...chartTicks, maxTicksLimit: 6 },
          grid: chartGrid,
        },
        y: {
          min: 0,
          ticks: { ...chartTicks, callback: (v) => `${v} kg` },
          grid: chartGrid,
        },
      }
    }
  });
};

// Debounced chart rendering to prevent excessive redraws
const debouncedRenderChart = () => {
  if (renderChartTimeout) {
    clearTimeout(renderChartTimeout);
  }
  renderChartTimeout = setTimeout(() => {
    renderChart();
    renderChartTimeout = null;
  }, 300);
};

// Watch for template selection and update chart data
watch(selectedTemplateId, async (templateId) => {
  if (templateId === undefined || templateId === null) {
    workouts.value = [];
    debouncedRenderChart();
    return;
  }
  const numId = Number(templateId);
  const data = await getWorkoutsByName(numId);
  workouts.value = data || [];
  debouncedRenderChart();
});

// Load all templates and latest workout on mount
// Weekly progress dots
const weeklyWorkoutGoal = ref(4)
const weeklyCompletedWorkouts = ref(0)

const weeklyGoalDots = computed(() =>
  Array.from({ length: weeklyWorkoutGoal.value }, (_, i) => i + 1)
)

const weeklyGoalProgress = computed(() =>
  weeklyWorkoutGoal.value ? Math.min(100, Math.round((weeklyCompletedWorkouts.value / weeklyWorkoutGoal.value) * 100)) : 0
)

const loadWeeklyData = async () => {
  const saved = Number(localStorage.getItem('homeWeeklyGoal'))
  weeklyWorkoutGoal.value = Number.isFinite(saved) && saved > 0 ? saved : 4

  const now = new Date()
  const dayOfWeek = now.getDay() // 0 = Sunday
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - dayOfWeek)
  weekStart.setHours(0, 0, 0, 0)
  const weekStartStr = localDateISO(weekStart)

  const all = await getWorkouts()
  weeklyCompletedWorkouts.value = all.filter((w: any) =>
    w.time_end && w.time_end.slice(0, 10) >= weekStartStr
  ).length
}

onMounted(async () => {
  await loadActiveWorkout();
  await loadTemplates();
  await loadLatestWorkout();
  await loadWeeklyData();
  await loadRecentPRs();
  renderChart();
});

onIonViewWillEnter(async () => {
  await loadActiveWorkout();
  await loadTemplates();
  await loadLatestWorkout();
  await loadWeeklyData();
  await loadRecentPRs();
  renderChart();
});



onUnmounted(() => {
  if (renderChartTimeout) { clearTimeout(renderChartTimeout); renderChartTimeout = null; }
  clearTimer();
  clearActiveRestTimer();
  if (chart) chart.destroy();
});

</script>
<style>
ion-content.home-content {
  --padding-top: 16px;
  --padding-bottom: 24px;
}

.home-shell {
  padding: 16px;
  display: grid;
  gap: 18px;
}

.hero-wrap,
.workout-section {
  display: grid;
  gap: 12px;
}

.top-cards {
  display: grid;
  gap: 12px;
}

.weekly-card {
  background: var(--ion-color-primary);
  border-radius: var(--nt-radius-md);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.weekly-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.weekly-card__header .section-kicker {
  margin: 0;
  color: rgba(255,255,255,0.5) !important;
}

.weekly-count {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(255,255,255,0.85);
}

.weekly-dots {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.weekly-dot {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.12);
  background: transparent;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.weekly-dot--filled {
  background: var(--ion-color-accent-red);
  border-color: var(--ion-color-accent-red);
}

.weekly-progress-bar {
  height: 3px;
  background: rgba(255,255,255,0.08);
  border-radius: 999px;
  overflow: hidden;
}

.weekly-progress-bar__fill {
  height: 100%;
  background: var(--ion-color-accent-red);
  border-radius: 999px;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 12px;
  margin-bottom: 12px;
}

.section-heading h3,
.hero-copy h2,
.graph-card__header h3 {
  margin: 0;
}


.summary-card,
.graph-card,
.workout-tile {
  border-radius: var(--nt-radius-md);
  background: var(--ion-color-primary);
}

.summary-card,
.active-card {
  margin: 0;
  padding: 18px;
  width: 100%;
  min-height: 190px;
}


.active-card {
  background: var(--ion-color-primary);
  border: 1px solid rgba(215, 26, 33, 0.3);
  position: relative;
  transition: border-color 150ms ease;
  cursor: pointer;
}

.active-card:hover {
  border-color: rgba(215, 26, 33, 0.5);
}

.active-card:active {
  border-color: var(--ion-color-accent-red);
}

.card-topline,
.graph-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}


.summary-card__body,
.active-card__body {
  display: grid;
  gap: 18px;
  margin-top: 18px;
}

.summary-card__body {
  align-items: start;
}


.card-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.card-metric,
.active-card__timer {
  border-radius: 10px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.05);
}

.card-metric span,
.active-card__timer span,
.workout-tile__copy span {
  display: block;
  margin-bottom: 6px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.card-metric strong,
.active-card__timer strong {
  display: block;
  font-size: 1rem;
  font-weight: 600;
}

.active-card__timer strong {
  color: var(--ion-color-accent-red);
  font-weight: 700;
  font-family: 'Doto', sans-serif;
}

.active-card__timer--rest {
  background: rgba(215, 26, 33, 0.1);
  border: 1px solid rgba(215, 26, 33, 0.3);
}


.card-metric-wide {
  grid-column: 1 / -1;
}

.workout-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.workout-section {
  margin-top: 4px;
}

.workout-tile {
  margin: 0;
  aspect-ratio: 1 / 1;
  padding: 14px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.workout-tile-disabled {
  opacity: 0.4;
  pointer-events: none;
}

.workout-tile__icon {
  width: 54px;
  height: 54px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background:var(--ion-color-primary);
}

.workout-tile__icon ion-icon {
  font-size: 24px;
  color: var(--ion-color-light);
}

.workout-tile__copy strong {
  display: block;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.2;
}

.workout-tile__copy small {
  display: block;
  margin-top: 6px;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
}

.graph-card {
  margin: 0;
  padding: 18px;
}

.pr-card {
  margin: 0;
  padding: 18px;
  border-radius: var(--nt-radius-md);
  background: var(--ion-color-primary);
  display: grid;
  gap: 12px;
}

.pr-card .section-kicker {
  margin: 0;
}

.pr-card__window {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
}

.pr-list {
  display: grid;
  gap: 8px;
}

.pr-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: none;
  border-radius: 10px;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--nt-dur-micro) var(--nt-ease-decel);
}

.pr-row:active {
  background: var(--nt-surface-2);
}

.pr-row__name {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-row__stat {
  font-family: 'Doto', sans-serif;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--ion-color-accent-red);
  white-space: nowrap;
}

.pr-row__stat small {
  color: rgba(255, 255, 255, 0.55);
  font-family: var(--nt-font-mono);
  font-weight: 400;
}

.pr-row__date {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
}

.graph-card__header ion-select {
  min-width: 132px;
}

.chart-frame {
  margin-top: 16px;
  height: 240px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 10px 6px 6px;
}

.chart-frame canvas {
  width: 100% !important;
  height: 100% !important;
}

@media (min-width: 760px) {
  .home-shell {
    max-width: 760px;
    margin: 0 auto;
    padding: 24px;
  }

  .summary-card,
  .active-card {
    padding: 24px;
  }

  .top-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
  }

  .summary-card__body,
  .active-card__body {
    grid-template-columns: 1.1fr 0.9fr;
    align-items: end;
  }

  .active-card__body {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .summary-card__body {
    grid-template-columns: 1fr;
  }

  .workout-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>