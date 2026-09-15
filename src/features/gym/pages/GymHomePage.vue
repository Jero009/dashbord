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
                <p class="nt-kicker">Last workout</p>
              </div>

              <div class="summary-card__body">
                <div class="card-metrics">
                  <div class="nt-metric-tile">
                    <span>Time</span>
                    <strong>{{ formatDuration(latestWorkout?.time_start, latestWorkout?.time_end) }}</strong>
                  </div>
                  <div class="nt-metric-tile">
                    <span>Total load</span>
                    <strong>{{ `${latestWorkout?.total_kg || 0} kg` }}</strong>
                  </div>
                  <div class="nt-metric-tile nt-metric-tile--full">
                    <span>Completed</span>
                    <strong>{{ formatWorkoutDate(latestWorkout?.time_end) }}</strong>
                  </div>
                </div>


              </div>
            </ion-card>

            <ion-card v-else class="active-card" @click="backToWorkout()">
              <div class="card-topline">
                <p class="nt-kicker">Active workout</p>
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
              <span class="nt-kicker">This week</span>
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
                <strong>{{ template.name }}</strong>
                <small>{{ template.created_at }}</small>
              </div>
            </ion-card>
          </div>
        </section>

        <ion-card v-if="recentPRs.length" class="pr-card">
          <div class="card-topline">
            <p class="nt-kicker">Recent PRs</p>
            <span class="pr-card__window">30 days</span>
          </div>
          <div class="pr-list">
            <button
              v-for="pr in recentPRs"
              :key="pr.id"
              class="pr-row nt-press"
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
            <ion-select placeholder="Template" interface="action-sheet" :interface-options="{ cssClass: 'app-action-sheet' }" v-model="selectedTemplateId" class="app-select">
              <ion-select-option v-for="t in templates" :key="t.id" :value="t.id">
                {{ t.name }}
              </ion-select-option>
            </ion-select>
          </div>
          <TrendChart :pts="tonnagePts" unit="kg" size="md" aria-label="Tonnage per workout" />
        </ion-card>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonContent, IonCard, onIonViewWillEnter, IonIcon, IonSelect, IonSelectOption } from '@ionic/vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import { getTemplates, startWorkoutFromTemplate, getActiveWorkout, getLatestWorkout, getWorkoutsByName, getWorkouts, getRecentPRs } from '@/shared/db/app_db';
import { ref, onUnmounted,computed,watch } from 'vue';
import { barbellSharp } from 'ionicons/icons';
import { useRouter } from 'vue-router';
import TrendChart from '@/shared/components/TrendChart.vue';
import type { WorkoutTemplate, Workout, WorkoutHistory } from '@/features/gym/types/models';
import { formatDuration, localDateISO, normalizeDateInput, formatWorkoutDate, formatTime as formatElapsed, formatRestTime } from '@/shared/utils/timeFormat';
import { hapticHeavy, hapticLight } from '@/shared/utils/haptics';
import { getWeeklyWorkoutGoal } from '@/shared/utils/userSettings';
import { restTimerState, cancelRestTimer, resumeRestTimer } from '@/shared/composables/useRestTimer';

const activeWorkout = ref(false);
// Countdown display is the shared rest-timer state (WorkoutPage owns start/stop;
// this page reads the same canonical localStorage record and can clear it).
const activeRestTimer = restTimerState;

// routing
const router = useRouter();

// Guard against double-tap starting two workouts.
let startingWorkout = false;


const startWorkout = async (templateId: number) => {
  if (startingWorkout || activeWorkout.value) {
    return;
  }
  startingWorkout = true;
  try {
    hapticHeavy();

    const workoutId = await startWorkoutFromTemplate(templateId);

    if (!workoutId) {
      console.error('Failed to start workout');
      return;
    }

    router.push(`/workout/${workoutId}`);
  } finally {
    startingWorkout = false;
  }
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


// Clear via the shared composable: wipes canonical storage and cancels the OS
// ding + countdown notification in one place.
const clearActiveRestTimer = () => {
  cancelRestTimer();
};

const restoreActiveRestTimer = () => {
  resumeRestTimer(undefined, () => clearActiveRestTimer());
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
    clearActiveRestTimer();
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

const formatWorkoutTimer = () => formatElapsed(seconds.value);

// chart — TrendChart (v3.x scrub standard)

const workouts = ref<WorkoutHistory[]>([]);
const selectedTemplateId = ref<number | undefined>(undefined);

// prepare data
const chartData = computed(() => {
  return workouts.value
    .filter(w => !!w.time_start)
    .map(w => ({
      date: new Date(normalizeDateInput(w.time_start) || w.time_start).toLocaleDateString(),
      kg: w.total_kg || 0
    }))
    .reverse(); // oldest → newest
});

const tonnagePts = computed(() =>
  chartData.value.map(d => ({ label: d.date, value: d.kg }))
);

// Watch for template selection and update chart data (TrendChart is reactive
// to tonnagePts — no manual render needed)
watch(selectedTemplateId, async (templateId) => {
  if (templateId === undefined || templateId === null) {
    workouts.value = [];
    return;
  }
  const numId = Number(templateId);
  const data = await getWorkoutsByName(numId);
  workouts.value = data || [];
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
  weeklyWorkoutGoal.value = getWeeklyWorkoutGoal()

  const now = new Date()
  const dayOfWeek = now.getDay() // 0 = Sunday
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - dayOfWeek)
  weekStart.setHours(0, 0, 0, 0)
  const weekStartStr = localDateISO(weekStart)

  const all = await getWorkouts()
  weeklyCompletedWorkouts.value = all.filter((w: any) => {
    if (!w.time_end) return false
    const normalized = normalizeDateInput(w.time_end)
    const ts = normalized ? Date.parse(normalized) : NaN
    if (Number.isNaN(ts)) return false
    return localDateISO(new Date(ts)) >= weekStartStr
  }).length
}

// ionViewWillEnter fires on the first entry too, so it covers initial load —
// a separate onMounted loader ran everything twice on page open.
onIonViewWillEnter(async () => {
  await loadActiveWorkout();
  await loadTemplates();
  await loadLatestWorkout();
  await loadWeeklyData();
  await loadRecentPRs();
});



onUnmounted(() => {
  clearTimer();
  clearActiveRestTimer();
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

.weekly-card__header .nt-kicker {
  margin: 0;
}

.weekly-count {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(var(--nt-ink), 0.85);
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
  border: 1px solid rgba(var(--nt-ink), 0.12);
  background: transparent;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.weekly-dot--filled {
  background: var(--ion-color-accent-red);
  border-color: var(--ion-color-accent-red);
}

.weekly-progress-bar {
  height: 3px;
  background: rgba(var(--nt-ink), 0.08);
  border-radius: 999px;
  overflow: hidden;
}

.weekly-progress-bar__fill {
  height: 100%;
  background: var(--ion-color-accent-red);
  border-radius: 999px;
}

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

.active-card__timer {
  border-radius: 10px;
  padding: 14px;
  background: rgba(var(--nt-ink), 0.05);
}

.active-card__timer span,
.workout-tile__copy span {
  display: block;
  margin-bottom: 6px;
  color: rgba(var(--nt-ink), 0.5);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.active-card__timer strong {
  display: block;
  font-size: 1rem;
  font-weight: 600;
}

.active-card__timer strong {
  color: var(--ion-color-accent-red);
  font-weight: 700;
  font-family: var(--nt-font-display);
}

.active-card__timer--rest {
  background: rgba(215, 26, 33, 0.1);
  border: 1px solid rgba(215, 26, 33, 0.3);
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
  color: rgba(var(--nt-ink), 0.5);
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

.pr-card .nt-kicker {
  margin: 0;
}

.pr-card__window {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(var(--nt-ink), 0.5);
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
  background: rgba(var(--nt-ink), 0.05);
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
  color: rgba(var(--nt-ink), 0.9);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-row__stat {
  font-family: var(--nt-font-display);
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--ion-color-accent-red);
  white-space: nowrap;
}

.pr-row__stat small {
  color: rgba(var(--nt-ink), 0.55);
  font-family: var(--nt-font-mono);
  font-weight: 400;
}

.pr-row__date {
  font-size: 0.75rem;
  color: rgba(var(--nt-ink), 0.5);
  white-space: nowrap;
}

.graph-card__header ion-select {
  min-width: 132px;
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