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
            <span class="card-date">{{ todayDateLabel }}</span>
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

        <!-- Circadian alertness card -->
        <ion-card v-if="circCurve.length" class="circ-card">
          <div class="circ-header">
            <p class="section-kicker">Circadian · alertness</p>
            <span class="circ-now-pill" v-if="circNowLabel">{{ circNowLabel }}</span>
          </div>

          <!-- Insufficient data: don't present a fallback curve as if it were real -->
          <div v-if="circInsufficient" class="circ-insufficient">
            <span>Log 3+ nights of sleep to map your alertness curve.</span>
          </div>

          <!-- Colored alertness chart -->
          <div v-else class="circ-chart-wrap">
            <svg viewBox="0 0 24 10" class="circ-svg" preserveAspectRatio="none">
              <!-- Zone bands (cognitive / exercise / rest) -->
              <rect v-if="circWindows?.cognitiveStart != null"
                :x="circWindows.cognitiveStart"
                y="0"
                :width="((circWindows.cognitiveEnd - circWindows.cognitiveStart + 24) % 24)"
                height="10"
                fill="rgba(255,255,255,0.08)" />
              <rect v-if="circWindows?.exerciseMorning"
                :x="circWindows.exerciseMorning.start"
                y="0"
                :width="circWindows.exerciseMorning.end - circWindows.exerciseMorning.start"
                height="10"
                fill="rgba(34,197,94,0.12)" />
              <rect v-if="circWindows?.exerciseAfternoon"
                :x="circWindows.exerciseAfternoon.start"
                y="0"
                :width="circWindows.exerciseAfternoon.end - circWindows.exerciseAfternoon.start"
                height="10"
                fill="rgba(34,197,94,0.12)" />
              <!-- Alertness area -->
              <polygon :points="circAreaPoints" fill="rgba(239,68,68,0.12)" />
              <!-- Alertness line -->
              <polyline :points="circLinePoints" fill="none" stroke="rgb(239,68,68)" stroke-width="0.28" stroke-linecap="round" stroke-linejoin="round" />
              <!-- Now line -->
              <line :x1="circNowX" :x2="circNowX" y1="0" y2="10"
                stroke="rgba(255,255,255,0.5)" stroke-width="0.2" stroke-dasharray="0.4 0.3" />
            </svg>
            <div class="circ-axis">
              <span>0</span><span>6</span><span>12</span><span>18</span>
            </div>
          </div>

          <!-- Zone legend -->
          <div v-if="!circInsufficient" class="circ-legend">
            <span class="circ-legend-dot circ-legend-dot--focus"></span><span>Focus</span>
            <span class="circ-legend-dot circ-legend-dot--exercise"></span><span>Exercise</span>
            <span class="circ-legend-dot circ-legend-dot--curve"></span><span>Curve</span>
          </div>

          <!-- Quick-log trigger → opens a focused bottom sheet for the current slot -->
          <button v-if="timeSlot !== 'night'" class="circ-log-trigger" @click="openCircSheet">
            <span class="circ-log-trigger-label">{{ circSlotPrompt }}</span>
            <ion-icon :icon="chevronUpOutline" />
          </button>
          <div v-else class="circ-log-complete">
            <span>Day logged · rest well</span>
          </div>
        </ion-card>

        <!-- Circadian quick-log bottom sheet -->
        <ion-modal :is-open="circSheetOpen" :breakpoints="[0, 0.5]" :initial-breakpoint="0.5"
          class="circ-sheet" @didDismiss="circSheetOpen = false">
          <div class="circ-sheet-body">
            <p class="section-kicker">{{ circSlotTitle }}</p>

            <!-- Day type: morning, or any time it isn't set yet -->
            <div v-if="timeSlot === 'morning' || circDayType === 'work'" class="circ-log-row">
              <span class="circ-log-label">Today</span>
              <button class="circ-type-btn" :class="{ 'circ-type-btn--active': circDayType === 'work' }"
                @click="circDayType = 'work'; logCircadianField('day_type', 'work')">Work</button>
              <button class="circ-type-btn" :class="{ 'circ-type-btn--active': circDayType === 'free' }"
                @click="circDayType = 'free'; logCircadianField('day_type', 'free')">Free day</button>
            </div>

            <!-- Morning: morning light + wake energy -->
            <template v-if="timeSlot === 'morning'">
              <div class="circ-log-row">
                <span class="circ-log-label">Morning light</span>
                <button class="circ-light-btn" :class="{ 'circ-light-btn--on': circMorningLight }"
                  @click="circMorningLight = !circMorningLight; logCircadianField('morning_light', circMorningLight ? 1 : 0)">
                  {{ circMorningLight ? 'Got it' : 'Not yet' }}
                </button>
              </div>
              <div class="circ-log-row">
                <span class="circ-log-label">Wake energy</span>
                <div class="circ-energy-row">
                  <button v-for="v in [2,4,6,8,10]" :key="v"
                    class="circ-energy-btn"
                    :class="{ 'circ-energy-btn--active': circEnergyWake === v }"
                    @click="circEnergyWake = v; logCircadianField('energy_wake', v)">{{ v }}</button>
                </div>
              </div>
            </template>

            <!-- Noon: noon energy -->
            <template v-if="timeSlot === 'noon'">
              <div class="circ-log-row">
                <span class="circ-log-label">Noon energy</span>
                <div class="circ-energy-row">
                  <button v-for="v in [2,4,6,8,10]" :key="v"
                    class="circ-energy-btn"
                    :class="{ 'circ-energy-btn--active': circEnergyNoon === v }"
                    @click="circEnergyNoon = v; logCircadianField('energy_noon', v)">{{ v }}</button>
                </div>
              </div>
            </template>

            <!-- Evening: evening energy -->
            <template v-if="timeSlot === 'evening'">
              <div class="circ-log-row">
                <span class="circ-log-label">Evening energy</span>
                <div class="circ-energy-row">
                  <button v-for="v in [2,4,6,8,10]" :key="v"
                    class="circ-energy-btn"
                    :class="{ 'circ-energy-btn--active': circEnergyEvening === v }"
                    @click="circEnergyEvening = v; logCircadianField('energy_evening', v)">{{ v }}</button>
                </div>
              </div>
            </template>

            <button class="circ-sheet-done" @click="circSheetOpen = false">Done</button>
          </div>
        </ion-modal>

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


        <!-- Day timeline -->
        <section class="day-view-card">
          <div class="day-view__header">
            <p class="section-kicker">Schedule</p>
            <span class="card-date">{{ todayDateLabel }}</span>
          </div>

          <!-- Habit blocks -->
          <div v-if="todayHabits.length" class="habits-strip">
            <div
              v-for="h in todayHabits"
              :key="h.id"
              class="habit-block"
              :class="{ 'habit-block--done': h.completed === 1 }"
              @click="toggleTodayHabit(h)"
            >
              <div class="habit-block__check">
                <ion-icon v-if="h.completed === 1" :icon="checkmark" />
              </div>
              <span class="habit-block__name">{{ h.name }}</span>
              <span v-if="h.time" class="habit-block__time">{{ h.time }}</span>
            </div>
          </div>

          <!-- All-day items (no time set) -->
          <div v-if="allDayItems.length" class="allday-strip">
            <div v-for="item in allDayItems" :key="item.key" class="allday-pill" :class="item.cls">
              <span v-if="item.isHabit" class="allday-check" :class="{ 'allday-check--done': item.done }" @click="item.toggle && item.toggle()">
                <ion-icon :icon="item.done ? checkmark : ellipseOutline" />
              </span>
              {{ item.label }}
              <button
                v-if="item.type === 'workout' && item.workoutTemplateId"
                class="ev-start-btn"
                @click.stop="startEventWorkout(item.workoutTemplateId)"
              >Start</button>
            </div>
          </div>

          <!-- Timeline -->
          <div v-if="timedItems.length" class="day-view__scroll" ref="timelineEl">
            <div class="day-view__inner" :style="{ height: tlHeight + 'px' }">

              <!-- Hour gridlines -->
              <div
                v-for="h in visibleHours"
                :key="h"
                class="hour-mark"
                :style="{ top: hourToY(h) + 'px' }"
              >
                <span class="hour-label">{{ String(h).padStart(2,'0') }}:00</span>
                <div class="hour-line" />
              </div>

              <!-- Now indicator -->
              <div v-if="nowY >= 0" class="now-line" :style="{ top: nowY + 'px' }">
                <div class="now-dot" />
              </div>

              <!-- Timed events -->
              <div
                v-for="ev in timedEvents"
                :key="ev.id"
                class="ev-block"
                :class="`ev-block--${ev.type}`"
                :style="{ top: ev.top + 'px', height: ev.height + 'px' }"
              >
                <strong class="ev-title">{{ ev.title }}</strong>
                <span class="ev-time">{{ ev.time_start }}{{ ev.time_end ? ' – ' + ev.time_end : '' }}</span>
                <button
                  v-if="ev.type === 'workout' && ev.workout_template_id"
                  class="ev-start-btn"
                  @click.stop="startEventWorkout(ev.workout_template_id)"
                >Start</button>
              </div>

              <!-- Timed habits -->
              <div
                v-for="h in timedHabits"
                :key="h.id"
                class="habit-pill"
                :class="{ 'habit-pill--done': h.completed === 1 }"
                :style="{ top: h.top + 'px' }"
                @click="toggleTodayHabit(h)"
              >
                <span class="habit-pill__check"><ion-icon :icon="h.completed === 1 ? checkmark : ellipseOutline" /></span>
                {{ h.name }}, {{ h.time }}
              </div>

            </div>
          </div>

          <p v-if="!allDayItems.length && !timedItems.length" class="day-view__empty">Nothing scheduled today</p>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonCard, IonContent, IonHeader, IonIcon, IonPage, onIonViewWillEnter, toastController } from '@ionic/vue';
import { checkmark, ellipseOutline, chevronUpOutline } from 'ionicons/icons';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import { getLatestHealthMetric, getLatestReadinessScore, getReadinessScore, getLatestWorkout, getWorkoutHistoryExercises, getCalendarEventsForDate, getHabitsWithStatus, toggleHabitCompletion, getActiveWorkout, getTodayCompletedWorkouts, getBodyLogs, insertBodyLog, startWorkoutFromTemplate} from '@/shared/db/app_db';
import { calculateReadinessScore, calculateBattery, getRecentActivities, type BatteryResult, type ActivitySummary } from '@/shared/health/healthConnect';
import { computeCircadianProfile, computeAlertnessCurve, computeCircadianWindows, type CircadianProfile, type AlertnessPoint, type CircadianWindows, type DayType } from '@/shared/health/circadian';
import { getRecentCircadianLogs, getCircadianLog, upsertCircadianLog, getRecentSleepSessions } from '@/shared/db/app_db';
import { scheduleCircadianNudges } from '@/shared/utils/notifications';
import { formatDuration, formatWorkoutDate, localDateISO, normalizeDateInput } from '@/shared/utils/timeFormat';
import type { Workout, WorkoutHistoryExercise } from '@/features/gym/types/models';
import { getGoalWeightKg } from '@/shared/utils/userSettings';
import { hapticHeavy, hapticLight, hapticMedium, hapticSuccess, hapticSelect } from '@/shared/utils/haptics';
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip } from 'chart.js';
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
        data: points,
        borderColor: 'var(--ion-color-accent-red)',
        backgroundColor: 'rgba(239,68,68,0.08)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        fill: true,
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
  const t = await toastController.create({ message: 'Logged', duration: 1500, color: 'success' });
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

const formatWorkoutTimer = () => {
  const h = Math.floor(workoutSeconds.value / 3600);
  const m = Math.floor((workoutSeconds.value % 3600) / 60);
  const s = workoutSeconds.value % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};

const restoreRestTimer = () => {
  const saved = sessionStorage.getItem('restTimer');
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
      if (remaining <= 0) { clearRestTimer(); sessionStorage.removeItem('restTimer'); }
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
  if (w) router.push(`/workout/${w.id}`);
};

const repeatLastWorkout = async () => {
  hapticMedium();
  const templateId = latestWorkout.value?.id_workout_template
  if (!templateId) return
  const workoutId = await startWorkoutFromTemplate(templateId)
  if (workoutId) router.push(`/workout/${workoutId}`)
}

const startEventWorkout = async (templateId: number) => {
  hapticHeavy();
  const workoutId = await startWorkoutFromTemplate(templateId);
  if (workoutId) router.push(`/workout/${workoutId}`);
};

// Today
// Refreshed on each load so a view kept alive across midnight doesn't keep
// serving yesterday's data.
let todayStr = localDateISO();
const todayEvents = ref<Record<string, any>[]>([]);
const todayHabits = ref<Record<string, any>[]>([]);
const todayWorkouts = ref<{ id: number; name: string | null; time_start: string; time_end: string; total_kg: number | null }[]>([]);
const todayActivities = ref<ActivitySummary[]>([]);
const timelineEl = ref<HTMLElement | null>(null);


const todayDateLabel = computed(() =>
  new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
);

// Timeline
const HOUR_PX = 56;

const parseHour = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h + m / 60;
};

const tlStart = computed(() => {
  const times = [
    ...todayEvents.value.filter((e) => e.time_start).map((e) => parseHour(e.time_start)),
    ...todayHabits.value.filter((h) => h.time).map((h) => parseHour(h.time)),
  ];
  return times.length ? Math.max(0, Math.floor(Math.min(...times)) - 0.5) : 6;
});

const tlEnd = computed(() => {
  const times = [
    ...todayEvents.value.filter((e) => e.time_end).map((e) => parseHour(e.time_end)),
    ...todayEvents.value.filter((e) => e.time_start && !e.time_end).map((e) => parseHour(e.time_start) + 1),
    ...todayHabits.value.filter((h) => h.time).map((h) => parseHour(h.time) + 0.25),
  ];
  return times.length ? Math.min(24, Math.ceil(Math.max(...times)) + 0.5) : 22;
});

const tlHeight = computed(() => (tlEnd.value - tlStart.value) * HOUR_PX);
const hourToY = (h: number) => (h - tlStart.value) * HOUR_PX;

const visibleHours = computed(() => {
  const start = Math.ceil(tlStart.value);
  const end = Math.floor(tlEnd.value);
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);
});

type TimedEvent = Record<string, any> & { top: number; height: number };
type TimedHabit = Record<string, any> & { top: number };

const timedEvents = computed<TimedEvent[]>(() =>
  todayEvents.value
    .filter((e) => e.time_start)
    .map((e) => {
      const start = parseHour(e.time_start);
      const end = e.time_end ? parseHour(e.time_end) : start + 1;
      return { ...e, top: hourToY(start), height: Math.max(32, (end - start) * HOUR_PX) } as TimedEvent;
    })
    .sort((a, b) => a.top - b.top)
);

const timedHabits = computed<TimedHabit[]>(() =>
  todayHabits.value
    .filter((h) => h.time)
    .map((h) => ({ ...h, top: hourToY(parseHour(h.time)) } as TimedHabit))
    .sort((a, b) => a.top - b.top)
);

const timedItems = computed(() => [...timedEvents.value, ...timedHabits.value]);

const allDayItems = computed(() => [
  ...todayEvents.value
    .filter((e) => !e.time_start)
    .map((e) => ({
      key: `ev-${e.id}`,
      label: e.title,
      cls: `allday-pill--${e.type}`,
      isHabit: false,
      done: false,
      toggle: null as (() => void) | null,
      type: e.type as string,
      workoutTemplateId: (e.workout_template_id as number | null | undefined) ?? null,
    })),
  ...todayHabits.value
    .filter((h) => !h.time)
    .map((h) => ({
      key: `hab-${h.id}`,
      label: h.name,
      cls: h.completed === 1 ? 'allday-pill--habit-done' : 'allday-pill--habit',
      isHabit: true,
      done: h.completed === 1,
      toggle: () => toggleTodayHabit(h),
      type: 'habit' as string,
      workoutTemplateId: null as number | null,
    })),
]);

const nowY = computed(() => {
  const now = new Date(nowTick.value);
  const h = now.getHours() + now.getMinutes() / 60;
  if (h < tlStart.value || h > tlEnd.value) return -1;
  return hourToY(h);
});

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
  if (s === null) return 'rgba(255,255,255,0.25)';
  if (s >= 70) return 'rgb(34,197,94)';
  if (s >= 45) return 'rgba(255,255,255,0.85)';
  return 'var(--ion-color-accent-red)';
});
const sleepScoreColor = computed(() => {
  const s = sleepScoreVal.value;
  if (s === null) return '#fff';
  if (s >= 70) return 'rgb(34,197,94)';
  if (s >= 45) return 'rgba(255,255,255,0.85)';
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


const toggleTodayHabit = async (h: Record<string, any>) => {
  const completing = h.completed !== 1;
  if (completing) {
    hapticSuccess();
  } else {
    hapticLight();
  }
  const today = localDateISO();
  await toggleHabitCompletion(h.id, today, completing);
  todayHabits.value = await getHabitsWithStatus(today);
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
          data: pastData,
          borderColor: 'var(--ion-color-accent-red)',
          backgroundColor: 'rgba(239,68,68,0.1)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.35,
          fill: true,
          spanGaps: false,
        },
        {
          data: futureData,
          borderColor: 'rgba(255,255,255,0.25)',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [5, 4],
          pointRadius: 0,
          tension: 0.35,
          fill: false,
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
          backgroundColor: 'rgba(0,0,0,0.85)',
          titleColor: 'rgba(255,255,255,0.5)',
          bodyColor: '#fff',
          callbacks: { label: (c) => ` ${c.parsed.y} pts` }
        }
      },
      scales: {
        x: {
          ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 9 }, maxTicksLimit: 6 },
          grid: { color: 'rgba(255,255,255,0.1)' },
        },
        y: {
          min: 0,
          max: 100,
          ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 9 }, stepSize: 25 },
          grid: { color: 'rgba(255,255,255,0.1)' },
        }
      }
    }
  });
};

// ── Circadian ────────────────────────────────────────────────────────────────

const circProfile     = ref<CircadianProfile | null>(null);
const circCurve       = ref<AlertnessPoint[]>([]);
const circWindows     = ref<CircadianWindows | null>(null);
const circDayType     = ref<'work' | 'free'>('work');
const circEnergyWake  = ref<number | null>(null);
const circEnergyNoon  = ref<number | null>(null);
const circEnergyEvening = ref<number | null>(null);
const circMorningLight  = ref(false);
const circWakeHour    = ref(7);
const circSheetOpen   = ref(false);

const circInsufficient = computed(() => (circProfile.value?.dataQuality ?? 'insufficient') === 'insufficient');

// Time-of-day slot anchored to the user's wake time (not wall clock), so the right
// question surfaces for early/late chronotypes. Hours since wake: 0–5 morning,
// 5–10 noon, 10–16 evening, otherwise night/pre-wake.
const timeSlot = computed((): 'morning' | 'noon' | 'evening' | 'night' => {
  const now = new Date(nowTick.value);
  const h = now.getHours() + now.getMinutes() / 60;
  let sinceWake = h - circWakeHour.value;
  if (sinceWake < 0) sinceWake += 24;
  if (sinceWake < 5)  return 'morning';
  if (sinceWake < 10) return 'noon';
  if (sinceWake < 16) return 'evening';
  return 'night';
});

const circSlotTitle = computed(() => (
  timeSlot.value === 'morning' ? 'Morning check-in'
  : timeSlot.value === 'noon'  ? 'Midday energy'
  : timeSlot.value === 'evening' ? 'Evening wind-down'
  : 'Today'
));

const circSlotPrompt = computed(() => {
  if (timeSlot.value === 'morning') return circEnergyWake.value == null ? 'Log morning light & energy' : 'Morning logged · edit';
  if (timeSlot.value === 'noon')    return circEnergyNoon.value == null ? 'Log your midday energy' : 'Midday logged · edit';
  if (timeSlot.value === 'evening') return circEnergyEvening.value == null ? 'Log your evening energy' : 'Evening logged · edit';
  return 'Log today';
});

const openCircSheet = () => { hapticLight(); circSheetOpen.value = true; };

function circFmtHour(h: number): string {
  const n = ((h % 24) + 24) % 24;
  return `${String(Math.floor(n)).padStart(2,'0')}:${String(Math.round((n % 1) * 60)).padStart(2,'0')}`;
}

function circInWindow(h: number, start: number, end: number): boolean {
  if (end >= start) return h >= start && h <= end;
  return h >= start || h <= end;
}

const circNowX = computed(() => {
  const now = new Date(nowTick.value);
  return now.getHours() + now.getMinutes() / 60;
});

const circLinePoints = computed(() =>
  circCurve.value.map(p => `${p.hour},${(1 - p.alertness) * 9 + 0.5}`).join(' ')
);

const circAreaPoints = computed(() => {
  if (!circCurve.value.length) return '';
  const line = circLinePoints.value;
  return `0,10 ${line} 23,10`;
});

const circNowLabel = computed(() => {
  const w = circWindows.value;
  if (!w) return '';
  const h = circNowX.value;
  if (circInWindow(h, w.cognitiveStart, w.cognitiveEnd)) return 'Focus time';
  if (w.exerciseMorning && circInWindow(h, w.exerciseMorning.start, w.exerciseMorning.end)) return 'Good for exercise';
  if (w.exerciseAfternoon && circInWindow(h, w.exerciseAfternoon.start, w.exerciseAfternoon.end)) return 'Good for exercise';
  const sleepOnset = circProfile.value?.avgSleepOnset ?? 23;
  if (circInWindow(h, sleepOnset - 1, sleepOnset + 1)) return 'Wind down';
  if (h > w.lastMealBy || h < 6) return 'Rest period';
  return 'Light tasks';
});

const loadCircadian = async () => {
  try {
    const sessions = await getRecentSleepSessions(14);
    const logs     = await getRecentCircadianLogs(14);

    const dayTypes = new Map<string, DayType>(logs.map(l => [l.date, l.day_type as DayType]));
    const sleepRecs = sessions.map(s => ({
      date: s.date, bedtime: s.bedtime, waketime: s.waketime,
      timeAsleepHours: s.time_asleep_hours, efficiency: s.efficiency,
    }));

    const profile = computeCircadianProfile(sleepRecs, dayTypes);
    circProfile.value = profile;

    const avgWake = sleepRecs.length
      ? sleepRecs.slice(0, 7).reduce((acc, r) => {
          const d = new Date(r.waketime); return acc + d.getHours() + d.getMinutes() / 60;
        }, 0) / Math.min(sleepRecs.length, 7)
      : 7.0;

    circWakeHour.value = avgWake;
    circCurve.value   = computeAlertnessCurve(profile, avgWake);
    circWindows.value = computeCircadianWindows(profile, avgWake);

    // Restore today's log state
    const todayLog = logs.find(l => l.date === todayStr);
    if (todayLog) {
      circDayType.value       = todayLog.day_type as 'work' | 'free';
      circEnergyWake.value    = todayLog.energy_wake    ?? null;
      circEnergyNoon.value    = todayLog.energy_noon    ?? null;
      circEnergyEvening.value = todayLog.energy_evening ?? null;
      circMorningLight.value  = todayLog.morning_light  === 1;
    }

    // Wake-relative nudges; skip any slot already logged today. Only meaningful once
    // there's enough data to anchor a personalized schedule.
    if (circWindows.value && !circInsufficient.value) {
      const w = circWindows.value;
      const cogLabel = `${circFmtHour(w.cognitiveStart)}–${circFmtHour(w.cognitiveEnd)}`;
      const eveningHour = (w.bedtimeTarget - 2 + 24) % 24;
      scheduleCircadianNudges({
        morning: todayLog?.energy_wake == null ? {
          time: circFmtHour(avgWake + 0.5),
          title: 'Morning check-in',
          body: `Focus window today: ${cogLabel}. Get outdoor light now and log your wake energy.`,
        } : null,
        noon: todayLog?.energy_noon == null ? {
          time: circFmtHour(avgWake + 5),
          title: 'Midday energy log',
          body: 'How is your energy? Log it to calibrate your circadian profile.',
        } : null,
        evening: todayLog?.energy_evening == null ? {
          time: circFmtHour(eveningHour),
          title: 'Evening wind-down',
          body: 'Log your evening energy and start winding down for a consistent bedtime.',
        } : null,
      }).catch(() => {});
    }
  } catch (e) {
    console.error('[HomePage] circadian load failed:', e);
  }
};

const logCircadianField = async (field: string, value: unknown) => {
  hapticSelect();
  // Merge onto the freshly-read persisted row and change only the tapped field.
  // Rebuilding from refs could clobber values set on another surface (e.g. day_type
  // chosen on CircadianPage) with a stale ref.
  const existing = await getCircadianLog(todayStr);
  await upsertCircadianLog({
    date:           todayStr,
    day_type:       existing?.day_type     ?? circDayType.value,
    energy_wake:    existing?.energy_wake   ?? null,
    energy_noon:    existing?.energy_noon   ?? null,
    energy_evening: existing?.energy_evening ?? null,
    meal_first:     existing?.meal_first    ?? null,
    meal_last:      existing?.meal_last     ?? null,
    morning_light:  existing?.morning_light ?? 0,
    notes:          existing?.notes         ?? null,
    [field]: value,
  });
};

const loadAll = async () => {
  todayStr = localDateISO();
  await Promise.all([
    loadSummary(),
    loadActiveWorkout(),
    loadTodayWeight(),
    loadCircadian(),
    getCalendarEventsForDate(todayStr).then((evs) => { todayEvents.value = evs; }),
    getHabitsWithStatus(todayStr).then((habs) => { todayHabits.value = habs; }),
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

onMounted(async () => {
  await loadAll();
  readinessTimer = setInterval(() => { nowTick.value = Date.now(); }, 60_000);
  if (timelineEl.value && nowY.value >= 0) {
    timelineEl.value.scrollTop = Math.max(0, nowY.value - 80);
  }
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
  border-radius: 12px;
  background: var(--ion-color-primary);
}

.workout-hero-card {
  margin: 0;
  padding: 18px;
  border-radius: 12px;
  background: var(--ion-color-primary);
  border: 1px solid rgba(255,255,255,0.08);
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
  color: #fff;
  line-height: 1.2;
}

.workout-hero__metrics {
  margin-bottom: 16px;
}

.workout-hero__start {
  width: 100%;
  padding: 12px;
  background: rgb(239, 68, 68);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 150ms ease;
}

.workout-hero__start:hover {
  background: rgb(220, 38, 38);
}

.active-card {
  background: var(--ion-color-primary);
  border: 1px solid rgba(255, 215, 0, 0.35);
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
  color: rgba(255, 255, 255, 0.5);
}

.card-date {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
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
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.score-tile__label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
}

.score-tile__val {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1;
  color: #fff;
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
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.drain-line {
  margin: 0;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
}

.battery-timeline {
  height: 90px;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
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
  background: rgba(255, 255, 255, 0.05);
}

.card-metric span {
  display: block;
  margin-bottom: 6px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.card-metric strong {
  display: block;
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
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
  background: rgba(255, 255, 255, 0.05);
}

.active-card__timer span {
  display: block;
  margin-bottom: 6px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.active-card__timer strong {
  display: block;
  font-size: 1.4rem;
  font-weight: 700;
  color: rgb(255, 215, 0);
  font-family: 'Doto', monospace;
}

.active-card__timer--rest {
  background: rgba(255, 215, 0, 0.08);
  border: 1px solid rgba(255, 215, 0, 0.25);
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
  stroke: rgba(255, 255, 255, 0.08);
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
  color: #fff;
}

.readiness-ring__content strong {
  font-size: 3rem;
  font-weight: 700;
  line-height: 1;
  color: #fff;
}

.readiness-ring__content span {
  color: rgba(255, 255, 255, 0.5);
}

/* Day view */
.day-view-card {
  border-radius: 12px;
  background: var(--ion-color-primary);
  padding: 18px;
  overflow: hidden;
}

.day-view__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.day-view__header h2 {
  margin: 0;
  font-size: 1rem;
  color: #fff;
}

/* Habit blocks */
.habits-strip {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.habit-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.habit-block--done {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
}

.habit-block__check {
  width: 22px;
  height: 22px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.habit-block__check ion-icon {
  font-size: 20px;
}

.habit-block--done .habit-block__check {
  background: var(--ion-color-accent-red);
  border-color: var(--ion-color-accent-red);
}

.habit-block__name {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.2;
}

.habit-block--done .habit-block__name {
  color: rgba(255, 255, 255, 0.5);
  text-decoration: line-through;
}

.habit-block__time {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
}

/* All-day strip */
.allday-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.allday-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.08);
}

.allday-pill--workout   { background: rgba(239, 68, 68, 0.15);  color: rgb(239, 68, 68); }
.allday-pill--recovery  { background: rgba(34, 197, 94, 0.15);  color: rgb(34, 197, 94); }
.allday-pill--reminder  { background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.85); }
.allday-pill--habit     { background: rgba(239, 68, 68, 0.1);   color: rgba(255,255,255,0.85); }
.allday-pill--habit-done { background: rgba(239, 68, 68, 0.25); color: rgb(239, 68, 68); }

.allday-check {
  cursor: pointer;
  position: relative;
  display: inline-flex;
  align-items: center;
}

.allday-check ion-icon { font-size: 20px; }

/* extend tap target without changing visual size */
.allday-check::after {
  content: '';
  position: absolute;
  inset: -10px;
}

.allday-check--done { color: var(--ion-color-accent-red); }

/* Scrollable timeline */
.day-view__scroll {
  overflow-y: auto;
  max-height: 340px;
  border-radius: 10px;
}

.day-view__inner {
  position: relative;
}

/* Hour marks */
.hour-mark {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  align-items: flex-start;
  pointer-events: none;
}

.hour-label {
  width: 40px;
  flex-shrink: 0;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.25);
  text-align: right;
  padding-right: 10px;
  margin-top: -0.45em;
  line-height: 1;
}

.hour-line {
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
}

/* Now line */
.now-line {
  position: absolute;
  left: 40px;
  right: 0;
  height: 2px;
  background: var(--ion-color-accent-red);
  pointer-events: none;
  display: flex;
  align-items: center;
}

.now-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--ion-color-accent-red);
  margin-left: -3px;
  flex-shrink: 0;
}

/* Event blocks */
.ev-block {
  position: absolute;
  left: 48px;
  right: 4px;
  border-radius: 10px;
  padding: 6px 10px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
}

.ev-block--workout  { background: rgba(239, 68, 68, 0.25); }
.ev-block--recovery { background: rgba(34, 197, 94, 0.15); }
.ev-block--reminder { background: rgba(255, 255, 255, 0.08); }
.ev-block--sleep    { background: rgba(255, 255, 255, 0.05); }

.ev-title {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ev-time {
  display: block;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 1px;
}

/* Habit pills */
.habit-pill {
  position: absolute;
  left: 48px;
  right: 4px;
  height: 24px;
  border-radius: 999px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  cursor: pointer;
  overflow: hidden;
  white-space: nowrap;
}

.habit-pill--done {
  background: rgba(239, 68, 68, 0.3);
  color: #fff;
}

.habit-pill__check {
  display: inline-flex;
  align-items: center;
  color: var(--ion-color-accent-red);
  flex-shrink: 0;
}

.habit-pill__check ion-icon { font-size: 20px; }

.day-view__empty {
  margin: 0;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.5);
}

.ev-start-btn {
  margin-top: 3px;
  padding: 2px 10px;
  background: rgb(239, 68, 68);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  display: block;
  transition: background-color 150ms ease;
}


.weight-card {
  margin: 0;
  padding: 18px;
  border-radius: 12px;
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
  color: #fff;
  line-height: 1.1;
}

.weight-goal-line {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
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
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 150ms ease;
}

.weight-input:focus {
  border-color: rgb(239, 68, 68);
}

.log-btn {
  padding: 6px 12px;
  background: rgb(239, 68, 68);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 150ms ease;
}

.log-btn:hover {
  background: rgb(220, 38, 38);
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

/* ── Circadian card ─────────────────────────────────────────────── */
.circ-card { padding: 18px; }

.circ-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.circ-header .section-kicker { margin: 0; }

.circ-now-pill {
  font-size: 0.72rem;
  font-weight: 600;
  color: rgb(239, 68, 68);
  background: rgba(239, 68, 68, 0.1);
  border-radius: 999px;
  padding: 2px 10px;
}

.circ-chart-wrap { position: relative; }

.circ-insufficient {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88px;
  padding: 12px 14px;
  text-align: center;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
}

.circ-svg {
  width: 100%;
  height: 72px;
  display: block;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
}

.circ-axis {
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 3px;
  padding: 0 2px;
}

.circ-legend {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
}

.circ-legend-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  flex-shrink: 0;
}

.circ-legend-dot--focus    { background: rgba(255, 255, 255, 0.5); }
.circ-legend-dot--exercise { background: rgb(34, 197, 94); }
.circ-legend-dot--curve    { background: rgb(239, 68, 68); }

.circ-log-section {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.circ-log-trigger {
  margin-top: 12px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.circ-log-trigger ion-icon {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.5);
}

.circ-sheet::part(content) {
  border-radius: 18px 18px 0 0;
}

.circ-sheet-body {
  background: var(--ion-color-primary);
  height: 100%;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.circ-sheet-done {
  margin-top: auto;
  padding: 12px 0;
  border: none;
  border-radius: 8px;
  background: rgb(239, 68, 68);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.circ-log-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.circ-log-label {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
  flex-shrink: 0;
  width: 82px;
}

.circ-type-btn {
  flex: 1;
  padding: 6px 0;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.circ-type-btn--active {
  background: rgb(239, 68, 68);
  border-color: rgb(239, 68, 68);
  color: #fff;
}

.circ-light-btn {
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.circ-light-btn--on {
  background: rgba(34, 197, 94, 0.15);
  border-color: rgb(34, 197, 94);
  color: rgb(34, 197, 94);
}

.circ-energy-row {
  display: flex;
  gap: 6px;
  flex: 1;
}

.circ-energy-btn {
  flex: 1;
  padding: 6px 0;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.circ-energy-btn--active {
  background: rgb(239, 68, 68);
  border-color: rgb(239, 68, 68);
  color: #fff;
}

.circ-log-complete {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
  padding: 6px 0;
}
</style>
