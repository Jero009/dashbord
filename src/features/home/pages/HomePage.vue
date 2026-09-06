<template>
  <ion-page>
    <ion-header>
      <DashboardTopBar />
    </ion-header>

    <ion-content :fullscreen="true" class="home-content">
      <div class="home-shell">

        <!-- Active workout banner -->
        <ion-card v-if="activeWorkout" class="active-card" @click="backToWorkout">
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

        <!-- Battery -->
        <ion-card class="summary-card">
          <div class="card-topline">
            <p class="section-kicker">Battery</p>
            <span class="card-date">{{ new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }) }}</span>
          </div>

          <div class="scores-row">
            <div class="score-tile">
              <span class="score-tile__label">Battery</span>
              <strong class="score-tile__val" :style="{ color: batteryColor }">{{ batteryScore !== null ? batteryScore : '—' }}</strong>
            </div>
            <div class="score-tile">
              <span class="score-tile__label">Sleep score</span>
              <strong class="score-tile__val" :style="{ color: sleepScoreColor }">{{ sleepScoreVal !== null ? sleepScoreVal : '—' }}</strong>
            </div>
          </div>

          <div class="summary-card__body">

            <div class="battery-ring">
              <svg viewBox="0 0 120 120" class="readiness-ring__svg" aria-hidden="true">
                <circle class="readiness-ring__track" cx="60" cy="60" r="46" />
                <circle
                  class="readiness-ring__progress"
                  cx="60" cy="60" r="46"
                  :style="{ strokeDashoffset: batteryDashOffset, stroke: batteryColor }"
                />
              </svg>
              <div class="readiness-ring__content">
                <strong>{{ batteryScore !== null ? batteryScore : '—' }}</strong>
                <span>{{ battery?.status ?? 'No data' }}</span>
              </div>
            </div>

            <div class="battery-right">
              <div class="ready-chips">
                <div class="ready-chip" :class="battery?.readyToTrain ? 'ready-chip--on' : 'ready-chip--off'">
                  Train
                </div>
                <div class="ready-chip" :class="battery?.readyToStudy ? 'ready-chip--on' : 'ready-chip--off'">
                  Study
                </div>
              </div>

              <button
                v-if="recovery"
                class="recovery-chip"
                :class="`recovery-chip--${recovery.level}`"
                @click="openAnalytics"
              >
                <span class="recovery-chip__label">{{ recoveryLabel }}</span>
                <span class="recovery-chip__reason">{{ recovery.reason }}</span>
              </button>

              <div class="card-metrics">
                <div class="card-metric">
                  <span>Sleep</span>
                  <strong>{{ sleepDisplay }}</strong>
                </div>
                <div class="card-metric">
                  <span>Resting HR</span>
                  <strong>{{ restingHrDisplay }}</strong>
                </div>
                <div class="card-metric">
                  <span>Steps</span>
                  <strong>{{ stepsDisplay }}</strong>
                </div>
                <div class="card-metric">
                  <span>Readiness</span>
                  <strong>{{ baseline ?? '—' }}</strong>
                </div>
              </div>

              <p v-if="drainParts.length" class="drain-line">{{ drainParts.join(' · ') }}</p>
            </div>

          </div>
          <div v-if="baseline !== null" class="battery-timeline">
            <canvas ref="batteryChartRef"></canvas>
          </div>
        </ion-card>

        <ion-card v-if="weekDigest" class="summary-card week-card" button @click="openReview">
          <div class="card-topline">
            <p class="section-kicker">This week</p>
            <ion-icon :icon="chevronUpOutline" class="week-card__chevron" />
          </div>
          <div class="week-grid">
            <div class="week-stat">
              <span class="week-stat__label">Workouts</span>
              <strong class="week-stat__val">{{ weekDigest.workoutCount }}</strong>
            </div>
            <div class="week-stat">
              <span class="week-stat__label">Avg sleep</span>
              <strong class="week-stat__val">{{ weekDigest.avgSleepScore ?? '—' }}</strong>
            </div>
            <div class="week-stat">
              <span class="week-stat__label">Net worth</span>
              <strong class="week-stat__val" :class="{ 'week-stat__val--pos': (weekDigest.netWorthDelta ?? 0) > 0, 'week-stat__val--neg': (weekDigest.netWorthDelta ?? 0) < 0 }">
                <template v-if="weekDigest.netWorthDelta !== null">{{ weekDigest.netWorthDelta > 0 ? '+' : '' }}{{ formatCurrency(weekDigest.netWorthDelta) }}</template>
                <template v-else>—</template>
              </strong>
            </div>
          </div>
        </ion-card>

        <!-- Last workout card (big) -->
        <ion-card v-if="!activeWorkout && latestWorkout" class="workout-hero-card">
          <div class="workout-hero__topline">
            <p class="section-kicker">Last workout</p>
            <span class="card-date">{{ latestWorkoutLabel }}</span>
          </div>
          <p class="workout-hero__name">{{ latestWorkout.name ?? 'Workout' }}</p>
          <div class="card-metrics card-metrics--4 workout-hero__metrics">
            <div class="card-metric">
              <span>Duration</span>
              <strong>{{ latestWorkoutDuration }}</strong>
            </div>
            <div class="card-metric">
              <span>Volume</span>
              <strong>{{ latestWorkoutVolume }}</strong>
            </div>
            <div class="card-metric">
              <span>Exercises</span>
              <strong>{{ latestWorkoutExerciseCount }}</strong>
            </div>
            <div class="card-metric">
              <span>Sets</span>
              <strong>{{ latestWorkoutSetCount }}</strong>
            </div>
          </div>
          <button v-if="latestWorkout.id_workout_template" class="workout-hero__start" @click="repeatLastWorkout">
            Start again
          </button>
        </ion-card>

        <!-- Weight card -->
        <ion-card class="weight-card">
          <div class="weight-card__left">
            <p class="section-kicker">Weight</p>
            <strong class="weight-val">{{ todayWeight !== null ? todayWeight + ' kg' : '—' }}</strong>
            <span v-if="goalWeight !== null && todayWeight !== null" class="weight-goal-line">{{ weightDeltaLabel }}</span>
            <div v-if="todayWeight === null" class="weight-quick-log">
              <input
                v-model="quickWeightInput"
                type="number"
                step="0.1"
                inputmode="decimal"
                placeholder="kg"
                class="form-input weight-input"
                @keyup.enter="logQuickWeight"
              />
              <button class="log-btn" @click="logQuickWeight">Log</button>
            </div>
          </div>
          <div class="weight-card__spark">
            <canvas ref="sparkRef"></canvas>
          </div>
        </ion-card>


      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonCard, IonContent, IonHeader, IonIcon, IonPage, onIonViewWillEnter, toastController } from '@ionic/vue';
import { chevronUpOutline } from 'ionicons/icons';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import { getLatestHealthMetric, getLatestReadinessScore, getReadinessScore, getLatestWorkout, getWorkoutHistoryExercises, getActiveWorkout, getTodayCompletedWorkouts, getBodyLogs, insertBodyLog, startWorkoutFromTemplate} from '@/shared/db/app_db';
import { calculateReadinessScore, calculateBattery, getRecentActivities, type BatteryResult, type ActivitySummary } from '@/shared/health/healthConnect';
import { getRecentHealthMetrics, queryReadinessHistory, queryDailyVolume, getReviewDigest, type ReviewDigest } from '@/shared/db/app_db';
import { computeTrainingLoad, computeRecoveryRecommendation, mean, type RecoveryRecommendation } from '@/shared/health/insights';
import { formatCurrency } from '@/shared/utils/currency';
import { formatDuration, formatWorkoutDate, localDateISO, normalizeDateInput, formatTime as formatElapsed } from '@/shared/utils/timeFormat';
import type { Workout, WorkoutHistoryExercise } from '@/features/gym/types/models';
import { getGoalWeightKg } from '@/shared/utils/userSettings';
import { hapticLight, hapticMedium, hapticSuccess } from '@/shared/utils/haptics';
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip } from 'chart.js';
import { chartLineDataset, chartDimDataset, chartTooltip, chartTicks, chartGrid } from '@/shared/utils/chartStyle';
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);

const router = useRouter();

// Weight card
const todayWeight = ref<number | null>(null);
const goalWeight = ref<number | null>(getGoalWeightKg());
const quickWeightInput = ref('');
const sparkRef = ref<HTMLCanvasElement>();
let sparkChart: Chart | null = null;

const weightDeltaLabel = computed(() => {
  if (todayWeight.value === null || goalWeight.value === null) return '';
  const delta = todayWeight.value - goalWeight.value;
  if (delta <= 0) return 'Goal reached';
  return `−${delta.toFixed(1)} kg to go`;
});

const buildSparkline = (points: number[]) => {
  if (!sparkRef.value || points.length < 2) return;
  if (sparkChart) sparkChart.destroy();
  const ctx = sparkRef.value.getContext('2d')!;
  sparkChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: points.map(() => ''),
      datasets: [{
        ...chartLineDataset,
        data: points,
        pointRadius: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: { display: false },
      }
    }
  });
};

const loadTodayWeight = async () => {
  const logs = await getBodyLogs();
  const todayEntry = logs.find(e => e.date === todayStr);
  todayWeight.value = todayEntry ? todayEntry.weight_kg : null;

  // last 7 days with data, chronological
  const cutoff = localDateISO(new Date(Date.now() - 7 * 86400000));
  const week = [...logs].filter(e => e.date >= cutoff).reverse();
  if (week.length >= 2) {
    await new Promise(r => setTimeout(r, 50)); // let canvas render
    buildSparkline(week.map(e => e.weight_kg));
  }
};

const logQuickWeight = async () => {
  hapticMedium();
  const val = parseFloat(quickWeightInput.value);
  if (!val || val <= 0) return;
  await insertBodyLog({ date: todayStr, weight_kg: val });
  quickWeightInput.value = '';
  await loadTodayWeight();
  hapticSuccess();
  const t = await toastController.create({ message: 'logged', duration: 1500, color: 'success' });
  await t.present();
};

const sleepHours = ref<number | null>(null);
const sleepScoreVal = ref<number | null>(null);
const steps = ref<number | null>(null);
const restingHr = ref<number | null>(null);
const readinessBaselineScore = ref<number | null>(null);
const latestWorkout = ref<Workout | null>(null);
const latestWorkoutExercises = ref<WorkoutHistoryExercise[]>([]);
const nowTick = ref(Date.now());
let readinessTimer: ReturnType<typeof setInterval> | null = null;

// Active workout
const activeWorkout = ref(false);
const workoutStartTime = ref<string | null>(null);
const workoutSeconds = ref(0);
let workoutInterval: ReturnType<typeof setInterval> | null = null;
const activeRestTimer = ref({ isActive: false, remaining: 0, total: 0 });
let restInterval: ReturnType<typeof setInterval> | null = null;

const clearWorkoutTimer = () => {
  if (workoutInterval) { clearInterval(workoutInterval); workoutInterval = null; }
};
const clearRestTimer = () => {
  if (restInterval) { clearInterval(restInterval); restInterval = null; }
  activeRestTimer.value = { isActive: false, remaining: 0, total: 0 };
};

const formatRestTime = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const formatWorkoutTimer = () => formatElapsed(workoutSeconds.value);

const restoreRestTimer = () => {
  // Read from localStorage to match WorkoutPage's canonical rest-timer storage
  // (sessionStorage is wiped on process kill and nothing ever writes the key there).
  const saved = localStorage.getItem('restTimer');
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    const endTime = Number(parsed.endTime);
    if (!Number.isFinite(endTime)) return;
    const total = Math.max(1, Number(parsed.total) || Number(parsed.remaining) || 0);
    activeRestTimer.value = { isActive: true, remaining: 0, total };
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      activeRestTimer.value.remaining = remaining;
      if (remaining <= 0) { clearRestTimer(); localStorage.removeItem('restTimer'); }
    };
    tick();
    if (activeRestTimer.value.isActive) restInterval = setInterval(tick, 1000);
  } catch { /* ignore */ }
};

const loadActiveWorkout = async () => {
  const workout = await getActiveWorkout();
  if (workout?.time_start) {
    workoutStartTime.value = normalizeDateInput(workout.time_start);
    activeWorkout.value = true;
    clearWorkoutTimer();
    // Clear any existing rest interval before restoring — loadActiveWorkout runs on
    // every view re-entry, so without this each re-entry leaked another interval.
    clearRestTimer();
    workoutInterval = setInterval(() => {
      workoutSeconds.value = Math.max(0, Math.floor((Date.now() - new Date(workoutStartTime.value!).getTime()) / 1000));
    }, 1000);
    restoreRestTimer();
  } else {
    activeWorkout.value = false;
    workoutStartTime.value = null;
    workoutSeconds.value = 0;
    clearWorkoutTimer();
    clearRestTimer();
  }
};

const backToWorkout = async () => {
  hapticLight();
  const w = await getActiveWorkout();
  if (w) router.push(`/workout/${w.id}`).catch(() => {});
};

const repeatLastWorkout = async () => {
  hapticMedium();
  const templateId = latestWorkout.value?.id_workout_template
  if (!templateId) return
  const workoutId = await startWorkoutFromTemplate(templateId)
  if (workoutId) router.push(`/workout/${workoutId}`).catch(() => {})
}

// Today
// Refreshed on each load so a view kept alive across midnight doesn't keep
// serving yesterday's data.
let todayStr = localDateISO();
const todayEvents = ref<Record<string, any>[]>([]);
const todayWorkouts = ref<{ id: number; name: string | null; time_start: string; time_end: string; total_kg: number | null }[]>([]);
const todayActivities = ref<ActivitySummary[]>([]);

const baseline = computed(() => {
  if (readinessBaselineScore.value !== null) return readinessBaselineScore.value;
  if (sleepHours.value === null && restingHr.value === null && steps.value === null) return null;
  return calculateReadinessScore({
    sleepHours: sleepHours.value,
    sleepEfficiency: null,
    sleepScore: null,
    restingHr: restingHr.value,
    sleepHeartRate: null,
    respiratoryRate: null,
    steps: steps.value,
    rhrBaseline: null,
    sleepHrBaseline: null,
    respiratoryRateBaseline: null,
  });
});

const battery = computed<BatteryResult | null>(() => {
  if (baseline.value === null) return null;
  return calculateBattery(
    baseline.value,
    new Date(nowTick.value),
    todayWorkouts.value,
    todayActivities.value,
    todayEvents.value as { type: string; date: string; time_start: string | null; time_end: string | null }[]
  );
});

const batteryScore = computed(() => battery.value?.score ?? null);
const batteryRatio = computed(() => batteryScore.value === null ? 0 : batteryScore.value / 100);
const batteryDashOffset = computed(() => 289 - 289 * batteryRatio.value);
const batteryColor = computed(() => {
  const s = batteryScore.value;
  if (s === null) return 'rgba(var(--nt-ink), 0.25)';
  if (s >= 70) return 'rgb(34,197,94)';
  if (s >= 45) return 'rgba(var(--nt-ink), 0.85)';
  return 'var(--ion-color-accent-red)';
});
const sleepScoreColor = computed(() => {
  const s = sleepScoreVal.value;
  if (s === null) return 'var(--nt-fg)';
  if (s >= 70) return 'rgb(34,197,94)';
  if (s >= 45) return 'rgba(var(--nt-ink), 0.85)';
  return 'var(--ion-color-accent-red)';
});

const drainParts = computed(() => {
  const d = battery.value?.drains;
  if (!d) return [];
  return [
    d.time > 0 ? `−${d.time} rest` : null,
    d.workout > 0 ? `−${d.workout} workout` : null,
    d.activity > 0 ? `−${d.activity} activity` : null,
    d.event > 0 ? `−${d.event} events` : null,
  ].filter(Boolean) as string[];
});

const sleepDisplay = computed(() => (sleepHours.value === null ? '—' : `${sleepHours.value.toFixed(1)} h`));
const stepsDisplay = computed(() => (steps.value === null ? '—' : `${Math.round(steps.value).toLocaleString()} steps`));
const restingHrDisplay = computed(() => (restingHr.value === null ? '—' : `${restingHr.value} bpm`));

const latestWorkoutLabel = computed(() => formatWorkoutDate(latestWorkout.value?.time_end));
const latestWorkoutDuration = computed(() => formatDuration(latestWorkout.value?.time_start, latestWorkout.value?.time_end));
const latestWorkoutVolume = computed(() => `${Math.round(latestWorkout.value?.total_kg ?? 0).toLocaleString()} kg`);
const latestWorkoutExerciseCount = computed(() => `${latestWorkoutExercises.value.length}`);
const latestWorkoutSetCount = computed(() =>
  `${latestWorkoutExercises.value.reduce((total, exercise) => total + Number(exercise.set_count || 0), 0)}`
);

const loadSummary = async () => {
  const [latestSleep, latestSleepEfficiency, latestSleepScore, latestSleepHeartRate, latestRespiratoryRate, latestSteps, latestHr] =
    await Promise.all([
      getLatestHealthMetric('sleep_duration'),
      getLatestHealthMetric('sleep_efficiency'),
      getLatestHealthMetric('sleep_score'),
      getLatestHealthMetric('sleep_heart_rate'),
      getLatestHealthMetric('respiratory_rate'),
      getLatestHealthMetric('steps'),
      getLatestHealthMetric('resting_heart_rate'),
    ]);
  const [todayReadiness, latestSession] = await Promise.all([
    getReadinessScore(localDateISO()),
    getLatestWorkout(),
  ]);
  const latestReadiness = todayReadiness ?? (await getLatestReadinessScore());

  sleepHours.value = latestSleep ? Number(latestSleep.value) : null;
  const sleepEfficiency = latestSleepEfficiency ? Number(latestSleepEfficiency.value) / 100 : null;
  const sleepScore = latestSleepScore ? Number(latestSleepScore.value) : null;
  sleepScoreVal.value = sleepScore;
  const sleepHeartRate = latestSleepHeartRate ? Number(latestSleepHeartRate.value) : null;
  const respiratoryRate = latestRespiratoryRate ? Number(latestRespiratoryRate.value) : null;
  steps.value = latestSteps ? Number(latestSteps.value) : null;
  restingHr.value = latestHr ? Number(latestHr.value) : null;
  readinessBaselineScore.value = latestReadiness ? Number(latestReadiness.score) : null;
  latestWorkout.value = latestSession ?? null;
  latestWorkoutExercises.value = latestSession ? (await getWorkoutHistoryExercises(latestSession.id)) : [];

  if (readinessBaselineScore.value === null && (sleepHours.value !== null || restingHr.value !== null || steps.value !== null)) {
    readinessBaselineScore.value = calculateReadinessScore({
      sleepHours: sleepHours.value,
      sleepEfficiency,
      sleepScore,
      restingHr: restingHr.value,
      sleepHeartRate,
      respiratoryRate,
      steps: steps.value,
      rhrBaseline: null,
      sleepHrBaseline: null,
      respiratoryRateBaseline: null,
    });
  }
};


const recovery = ref<RecoveryRecommendation | null>(null);
const recoveryLabel = computed(() => {
  if (!recovery.value) return '';
  return { train: 'Train hard', maintain: 'Maintain', recover: 'Recover' }[recovery.value.level];
});

const loadRecovery = async () => {
  const [rhrRows, readinessRows, volume] = await Promise.all([
    getRecentHealthMetrics('resting_heart_rate', 28).catch(() => []),
    queryReadinessHistory(28).catch(() => []),
    queryDailyVolume(28).catch(() => []),
  ]);

  const rhrAsc = (rhrRows as { date: string; value: number }[])
    .map((r) => ({ date: r.date, value: Number(r.value) }))
    .filter((r) => Number.isFinite(r.value))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => r.value);

  const readinessAsc = readinessRows
    .map((r) => ({ date: r.date, value: Number(r.score) }))
    .filter((r) => Number.isFinite(r.value))
    .sort((a, b) => a.date.localeCompare(b.date));

  const load = computeTrainingLoad(volume);
  recovery.value = computeRecoveryRecommendation({
    rhrToday: rhrAsc.length > 0 ? rhrAsc[rhrAsc.length - 1] : null,
    rhrBaseline: rhrAsc.length >= 3 ? mean(rhrAsc) : null,
    readinessToday: readinessAsc.length > 0 ? readinessAsc[readinessAsc.length - 1].value : null,
    acwr: load.status === 'insufficient' ? null : load.acwr,
  });
};

const openAnalytics = () => {
  hapticLight();
  router.push('/analytics');
};

const weekDigest = ref<ReviewDigest | null>(null);
const loadWeekDigest = async () => {
  weekDigest.value = await getReviewDigest('week').catch(() => null);
};

const openReview = () => {
  hapticLight();
  router.push('/analytics/review');
};

// Battery timeline chart
const batteryChartRef = ref<HTMLCanvasElement>();
let batteryChartInstance: Chart | null = null;

const buildBatteryChart = () => {
  if (!batteryChartRef.value || baseline.value === null) return;
  if (batteryChartInstance) { batteryChartInstance.destroy(); batteryChartInstance = null; }

  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const hours = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00–23:00
  const labels = hours.map(h => `${String(h).padStart(2, '0')}:00`);
  const evs = todayEvents.value as { type: string; date: string; time_start: string | null; time_end: string | null }[];
  const wks = todayWorkouts.value;
  const acts = todayActivities.value;

  const allScores = hours.map(h => {
    const t = new Date(todayStr + 'T' + String(h).padStart(2, '0') + ':00:00');
    return calculateBattery(baseline.value as number, t, wks, acts, evs).score;
  });

  // Split at current hour index
  const nowIdx = hours.findIndex(h => h > nowHour);
  const splitIdx = nowIdx === -1 ? hours.length : nowIdx;

  const pastData  = allScores.map((s, i) => i < splitIdx ? s : null);
  const futureData = allScores.map((s, i) => i >= splitIdx - 1 ? s : null); // -1 to connect

  const ctx = batteryChartRef.value.getContext('2d')!;
  batteryChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          ...chartLineDataset,
          data: pastData,
          pointRadius: 0,
          spanGaps: false,
        },
        {
          ...chartDimDataset,
          data: futureData,
          spanGaps: false,
        },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...chartTooltip,
          callbacks: { label: (c) => ` ${c.parsed.y} pts` }
        }
      },
      scales: {
        x: {
          ticks: { ...chartTicks, maxTicksLimit: 6 },
          grid: chartGrid,
        },
        y: {
          min: 0,
          max: 100,
          ticks: { ...chartTicks, stepSize: 25 },
          grid: chartGrid,
        }
      }
    }
  });
};

const loadAll = async () => {
  todayStr = localDateISO();
  await Promise.all([
    loadSummary(),
    loadActiveWorkout(),
    loadTodayWeight(),
    loadRecovery(),
    loadWeekDigest(),
    getTodayCompletedWorkouts().then((ws) => { todayWorkouts.value = ws; }),
    getRecentActivities(2).then((acts) => { todayActivities.value = acts; }),
  ]);
  await new Promise(r => setTimeout(r, 60));
  buildBatteryChart();
};

onIonViewWillEnter(loadAll);

onUnmounted(() => {
  if (readinessTimer) { clearInterval(readinessTimer); readinessTimer = null; }
  clearWorkoutTimer();
  clearRestTimer();
  if (sparkChart) { sparkChart.destroy(); sparkChart = null; }
  if (batteryChartInstance) { batteryChartInstance.destroy(); batteryChartInstance = null; }
});

onMounted(() => {
  // loadAll() already runs via onIonViewWillEnter (which fires on the first entry
  // too). Calling it again here raced two concurrent loads on mount — drop it and
  // just start the clock tick.
  readinessTimer = setInterval(() => { nowTick.value = Date.now(); }, 60_000);
});
</script>

<style scoped>
.home-content {
  --padding-top: 16px;
  --padding-bottom: 24px;
}

.home-shell {
  max-width: 760px;
  margin: 0 auto;
  padding: 0 16px 24px;
  display: grid;
  gap: 16px;
}

/* Cards */
.summary-card,
.active-card {
  margin: 0;
  padding: 18px;
  border-radius: var(--nt-radius-md);
  background: var(--ion-color-primary);
}

.workout-hero-card {
  margin: 0;
  padding: 18px;
  border-radius: var(--nt-radius-md);
  background: var(--ion-color-primary);
}

.workout-hero__topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.workout-hero__topline .section-kicker {
  margin: 0;
}

.workout-hero__name {
  margin: 0 0 16px;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--nt-fg);
  line-height: 1.2;
}

.workout-hero__metrics {
  margin-bottom: 16px;
}

.workout-hero__start {
  width: 100%;
  padding: 12px;
  background: var(--ion-color-accent-red);
  border: none;
  border-radius: 8px;
  color: var(--nt-on-accent);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 150ms ease;
}

.workout-hero__start:hover {
  background: var(--nt-accent-press);
}

.active-card {
  background: var(--ion-color-primary);
  border: 1px solid rgba(215, 26, 33, 0.35);
  cursor: pointer;
  transition: border-color 150ms ease;
}

.card-topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.section-kicker {
  margin: 0;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: rgba(var(--nt-ink), 0.5);
}

.card-date {
  font-size: 0.72rem;
  color: rgba(var(--nt-ink), 0.5);
}

/* 3-score row */
.scores-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 14px;
}

.score-tile {
  border-radius: 10px;
  padding: 12px 14px;
  background: rgba(var(--nt-ink), 0.05);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.score-tile__label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(var(--nt-ink), 0.5);
}

.score-tile__val {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1;
  color: var(--nt-fg);
}

/* Battery / Readiness layout */
.summary-card__body {
  margin-top: 18px;
  display: grid;
  gap: 14px;
}

.battery-ring {
  --score: 0;
  position: relative;
  width: min(100%, 200px);
  aspect-ratio: 1;
  margin: 0 auto;
}

.battery-right {
  display: grid;
  gap: 12px;
}

.ready-chips {
  display: flex;
  gap: 10px;
}

.ready-chip {
  flex: 1;
  padding: 10px;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
  text-align: center;
  transition: background-color 150ms ease;
}

.ready-chip--on {
  background: rgba(34, 197, 94, 0.15);
  color: rgb(34, 197, 94);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.ready-chip--off {
  background: rgba(var(--nt-ink), 0.05);
  color: rgba(var(--nt-ink), 0.35);
  border: 1px solid rgba(var(--nt-ink), 0.08);
}

.recovery-chip {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  text-align: left;
  background: rgba(var(--nt-ink), 0.05);
  border: 1px solid rgba(var(--nt-ink), 0.08);
  cursor: pointer;
  transition: opacity 150ms ease;
}

.recovery-chip:active {
  opacity: 0.7;
}

.recovery-chip--recover {
  background: rgba(215, 26, 33, 0.12);
  border-color: rgba(215, 26, 33, 0.35);
}

.recovery-chip--train {
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.3);
}

.recovery-chip__label {
  font-family: var(--nt-font-head);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(var(--nt-ink), 0.85);
}

.recovery-chip--recover .recovery-chip__label {
  color: var(--ion-color-accent-red);
}

.recovery-chip--train .recovery-chip__label {
  color: var(--nt-data-positive);
}

.recovery-chip__reason {
  font-size: 0.78rem;
  color: rgba(var(--nt-ink), 0.6);
  line-height: 1.4;
}

.week-card {
  cursor: pointer;
}

.week-card__chevron {
  color: rgba(var(--nt-ink), 0.4);
  transform: rotate(90deg);
  font-size: 16px;
}

.week-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 8px;
}

.week-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
}

.week-stat__label {
  font-family: var(--nt-font-head);
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--nt-text-dim);
}

.week-stat__val {
  font-family: var(--nt-font-display);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--nt-fg);
}

.week-stat__val--pos { color: var(--nt-data-positive); }
.week-stat__val--neg { color: var(--ion-color-accent-red); }

.drain-line {
  margin: 0;
  font-size: 0.72rem;
  color: rgba(var(--nt-ink), 0.5);
}

.battery-timeline {
  height: 90px;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid rgba(var(--nt-ink), 0.08);
}

/* Metric tiles */
.card-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.card-metrics--4 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.card-metric {
  border-radius: 10px;
  padding: 12px 14px;
  background: rgba(var(--nt-ink), 0.05);
}

.card-metric span {
  display: block;
  margin-bottom: 6px;
  font-size: 0.75rem;
  color: rgba(var(--nt-ink), 0.5);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.card-metric strong {
  display: block;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--nt-fg);
}

/* Active workout timers */
.active-card__body {
  margin-top: 18px;
  display: grid;
  gap: 12px;
}

.active-card__timer {
  border-radius: 10px;
  padding: 14px;
  background: rgba(var(--nt-ink), 0.05);
}

.active-card__timer span {
  display: block;
  margin-bottom: 6px;
  font-size: 0.75rem;
  color: rgba(var(--nt-ink), 0.5);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.active-card__timer strong {
  display: block;
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--ion-color-accent-red);
  font-family: 'Doto', monospace;
}

.active-card__timer--rest {
  background: rgba(215, 26, 33, 0.08);
  border: 1px solid rgba(215, 26, 33, 0.25);
}

.readiness-ring {
  --score: 0;
  position: relative;
  width: min(100%, 260px);
  aspect-ratio: 1;
  margin: 0 auto;
}

.readiness-ring__svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.readiness-ring__track,
.readiness-ring__progress {
  fill: none;
  stroke-width: 12;
  cx: 60;
  cy: 60;
  r: 46;
}

.readiness-ring__track {
  stroke: rgba(var(--nt-ink), 0.08);
}

.readiness-ring__progress {
  stroke: var(--ion-color-accent-red);
  stroke-linecap: round;
  stroke-dasharray: 289;
}

.readiness-ring__content {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 6px;
  text-align: center;
  color: var(--nt-fg);
}

.readiness-ring__content strong {
  font-size: 3rem;
  font-weight: 700;
  line-height: 1;
  color: var(--nt-fg);
}

.readiness-ring__content span {
  color: rgba(var(--nt-ink), 0.5);
}

.weight-card {
  margin: 0;
  padding: 18px;
  border-radius: var(--nt-radius-md);
  background: var(--ion-color-primary);
  display: flex;
  align-items: center;
  gap: 12px;
}

.weight-card__left {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex-shrink: 0;
}

.weight-card__left .section-kicker {
  margin: 0 0 2px;
}

.weight-val {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--nt-fg);
  line-height: 1.1;
}

.weight-goal-line {
  font-size: 0.72rem;
  color: rgba(var(--nt-ink), 0.5);
}

.weight-quick-log {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 6px;
}

.weight-input {
  width: 70px;
  padding: 6px 10px;
  background: rgba(var(--nt-ink), 0.06);
  border: 1px solid rgba(var(--nt-ink), 0.1);
  border-radius: 8px;
  color: var(--nt-fg);
  font-size: 0.9rem;
  outline: none;
  transition: border-color 150ms ease;
}

.weight-input:focus {
  border-color: var(--ion-color-accent-red);
}

.log-btn {
  padding: 6px 12px;
  background: var(--ion-color-accent-red);
  border: none;
  border-radius: 8px;
  color: var(--nt-on-accent);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 150ms ease;
}

.log-btn:hover {
  background: var(--nt-accent-press);
}

.weight-card__spark {
  flex: 1;
  height: 54px;
  min-width: 0;
}

@media (min-width: 600px) {
  .summary-card__body {
    grid-template-columns: 180px 1fr;
    align-items: center;
  }

  .card-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .card-metrics--4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .active-card__body {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

</style>
