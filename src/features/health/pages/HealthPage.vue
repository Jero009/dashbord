<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <health-section-tabs />
    </ion-header>

    <ion-content :fullscreen="true" class="health-content">
      <div class="health-shell">

        <!-- 1. Battery hero -->
        <div class="card readiness-card">
          <p class="section-kicker">Battery</p>
          <div class="readiness-hero">
            <div class="readiness-score-wrap">
              <span class="readiness-score-num">{{ readinessDisplay }}</span>
              <span class="readiness-score-denom" v-if="readinessScore !== null">/100</span>
            </div>
            <div class="hero-right">
              <span class="readiness-label" :class="readinessLabelClass">{{ readinessLabel }}</span>
              <div class="ready-badges" v-if="batteryResult">
                <span class="ready-badge" :class="batteryResult.readyToTrain ? 'badge--green' : 'badge--muted'">Train</span>
                <span class="ready-badge" :class="batteryResult.readyToStudy ? 'badge--green' : 'badge--muted'">Study</span>
              </div>
            </div>
          </div>
          <div class="readiness-bar-track">
            <div class="readiness-bar-fill" :style="{ width: readinessBarWidth, background: batteryBarColor }"></div>
          </div>
          <!-- Drain breakdown -->
          <div v-if="batteryResult" class="metric-grid drain-grid">
            <div class="card-metric">
              <span class="metric-label">Time</span>
              <span class="metric-value drain-val">-{{ batteryResult.drains.time }}</span>
            </div>
            <div class="card-metric">
              <span class="metric-label">Workout</span>
              <span class="metric-value drain-val">-{{ batteryResult.drains.workout }}</span>
            </div>
            <div class="card-metric">
              <span class="metric-label">Activity</span>
              <span class="metric-value drain-val">-{{ batteryResult.drains.activity }}</span>
            </div>
            <div class="card-metric">
              <span class="metric-label">Events</span>
              <span class="metric-value" :class="batteryResult.drains.event < 0 ? 'drain-val--positive' : 'drain-val'">
                {{ batteryResult.drains.event <= 0 ? '+' : '-' }}{{ Math.abs(batteryResult.drains.event) }}
              </span>
            </div>
          </div>
          <div v-else class="metric-grid readiness-mini-grid">
            <div class="card-metric">
              <span class="metric-label">Sleep</span>
              <span class="metric-value">{{ sleepDisplay }}</span>
            </div>
            <div class="card-metric">
              <span class="metric-label">Steps</span>
              <span class="metric-value">{{ stepsDisplay }}</span>
            </div>
            <div class="card-metric">
              <span class="metric-label">Resting HR</span>
              <span class="metric-value">{{ restingHrDisplay }}</span>
            </div>
          </div>
        </div>

        <!-- 2. Sleep card -->
        <div class="card">
          <p class="section-kicker">Sleep · last night</p>
          <div class="sleep-top">
            <div class="sleep-score-block">
              <span class="sleep-score-num" :class="sleepScoreClass">{{ sleepScoreDisplay }}</span>
              <span class="sleep-score-sub">score</span>
            </div>
            <div class="metric-grid metric-grid--2col sleep-metrics">
              <div class="card-metric">
                <span class="metric-label">Duration</span>
                <span class="metric-value">{{ sleepDisplay }}</span>
              </div>
              <div class="card-metric">
                <span class="metric-label">Efficiency</span>
                <span class="metric-value">{{ sleepEfficiencyDisplay }}</span>
              </div>
              <div class="card-metric">
                <span class="metric-label">Sleep HR</span>
                <span class="metric-value">{{ sleepHrDisplay }}</span>
              </div>
              <div class="card-metric">
                <span class="metric-label">Resp. Rate</span>
                <span class="metric-value">{{ respRateDisplay }}</span>
              </div>
            </div>
          </div>
          <p v-if="sleepInsight" class="sleep-insight">{{ sleepInsight }}</p>
        </div>

        <!-- 3. Body + vitals -->
        <div class="card">
          <p class="section-kicker">Body</p>
          <div class="metric-grid metric-grid--3col">
            <div class="card-metric">
              <span class="metric-label">Resting HR</span>
              <span class="metric-value">{{ restingHrDisplay }}</span>
            </div>
            <div class="card-metric">
              <span class="metric-label">Steps</span>
              <span class="metric-value">{{ stepsDisplay }}</span>
            </div>
            <div class="card-metric">
              <span class="metric-label">Weight</span>
              <span class="metric-value">{{ weightDisplay }}</span>
            </div>
          </div>
        </div>

        <!-- 4. Today's plan events -->
        <div v-if="todayEvents.length" class="card">
          <p class="section-kicker">Today's schedule</p>
          <ul class="event-list">
            <li v-for="ev in todayEvents" :key="ev.id" class="event-row">
              <span class="event-time">{{ ev.time_start ? ev.time_start.slice(0, 5) : '—' }}</span>
              <span class="event-dot" :class="`dot--${ev.type}`"></span>
              <span class="event-title">{{ ev.title }}</span>
              <span class="event-tag" :class="`tag--${ev.type}`">{{ ev.type }}</span>
            </li>
          </ul>
        </div>

        <!-- 5. Readiness history -->
        <div class="card">
          <p class="section-kicker">Readiness · last 14 days</p>
          <div v-if="readinessHistory.length >= 2" class="rh-chart">
            <svg viewBox="0 0 100 40" class="rh-svg" aria-label="Readiness history">
              <polygon class="rh-area" :points="rhAreaPoints" />
              <polyline class="rh-line" :points="rhLinePoints" />
              <circle
                v-for="pt in readinessHistory"
                :key="pt.date"
                class="rh-dot"
                :class="{ 'rh-dot--selected': selectedRhPoint?.date === pt.date }"
                :cx="pt.x" :cy="pt.y" r="1.2"
                @click="selectedRhPoint = pt"
              />
            </svg>
            <div v-if="selectedRhPoint" class="rh-tooltip">
              <strong>{{ selectedRhPoint.score }}</strong>
              <small>{{ new Date(selectedRhPoint.date + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' }) }}</small>
            </div>
            <div class="rh-axis">
              <span>{{ readinessHistory[0]?.dateLabel }}</span>
              <span>{{ readinessHistory[readinessHistory.length - 1]?.dateLabel }}</span>
            </div>
          </div>
          <p v-else class="empty-hint">No readiness data yet — sync Health Connect to populate</p>
        </div>

        <!-- 6. Recent activities -->
        <section v-if="activities.length">
          <p class="section-kicker">Activity · last 7 days</p>
          <div class="activity-list">
            <div v-for="(act, i) in activities" :key="i" class="activity-card">
              <div class="activity-icon">{{ workoutInitial(act.workoutType) }}</div>
              <div class="activity-body">
                <strong class="activity-name">{{ formatWorkoutType(act.workoutType) }}</strong>
                <span class="activity-date">{{ formatActivityDate(act.startDate) }}</span>
                <div class="activity-metrics">
                  <span>{{ act.durationMinutes }} min</span>
                  <span v-if="act.calories"> · {{ act.calories }} kcal</span>
                  <span v-if="act.distanceKm"> · {{ act.distanceKm }} km</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 7. Sync -->
        <div class="card sync-card">
          <p class="section-kicker">Health Connect</p>
          <p class="sync-status">{{ healthConnectStatus }}</p>
          <button class="sync-btn" :disabled="syncing" @click="handleConnect">
            {{ syncing ? 'Syncing...' : 'Sync now' }}
          </button>
        </div>

      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonHeader, IonContent, onIonViewWillEnter, toastController,
} from '@ionic/vue';
import { computed, ref } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import { localDateISO } from '@/shared/utils/timeFormat';
import HealthSectionTabs from '@/features/health/components/HealthSectionTabs.vue';
import {
  getLatestHealthMetric,
  getReadinessScore,
  getLatestReadinessScore,
  getBodyLogs,
  queryReadinessHistory,
  getTodayCompletedWorkouts,
  getCalendarEventsForDate,
} from '@/shared/db/app_db';
import type { BodyLogEntry } from '@/shared/db/app_db';
import {
  isHealthConnectAvailable,
  openHealthConnectSettings,
  requestHealthConnectPermissions,
  syncHealthConnectMetrics,
  getRecentActivities,
  calculateReadinessScore,
  calculateBattery,
  type ActivitySummary,
  type BatteryResult,
} from '@/shared/health/healthConnect';
import { computeCircadianScore } from '@/shared/health/circadian';
import { getRecentCircadianLogs, getRecentSleepSessions, getRecentHealthMetrics } from '@/shared/db/app_db';

type RhPoint = { date: string; score: number; x: number; y: number; dateLabel: string };

// --- State ---
const sleepHours      = ref<number | null>(null);
const sleepScore      = ref<number | null>(null);
const sleepEfficiency  = ref<number | null>(null);
const sleepHr          = ref<number | null>(null);
const respRate         = ref<number | null>(null);
const restingHr        = ref<number | null>(null);
const steps            = ref<number | null>(null);
const rhrBaseline      = ref<number | null>(null);
const sleepHrBaseline  = ref<number | null>(null);
const respRateBaseline = ref<number | null>(null);
const readinessScore  = ref<number | null>(null);
const batteryResult   = ref<BatteryResult | null>(null);
const circScore       = ref<number | null>(null);
const todayWorkouts   = ref<{ id: number; name: string | null; time_start: string; time_end: string; total_kg: number | null }[]>([]);
const todayEvents     = ref<{ id?: number; type: string; title?: string; date: string; time_start: string | null; time_end: string | null }[]>([]);
const latestBodyLog   = ref<BodyLogEntry | null>(null);
const activities      = ref<ActivitySummary[]>([]);
const syncing         = ref(false);
const readinessHistory = ref<RhPoint[]>([]);
const selectedRhPoint  = ref<RhPoint | null>(null);

// --- Displays ---
const sleepDisplay           = computed(() => sleepHours.value === null      ? '—' : `${sleepHours.value.toFixed(1)} h`);
const sleepScoreDisplay      = computed(() => sleepScore.value === null       ? '—' : `${Math.round(sleepScore.value)}`);
const sleepEfficiencyDisplay = computed(() => sleepEfficiency.value === null  ? '—' : `${Math.round(sleepEfficiency.value)}%`);
const sleepHrDisplay         = computed(() => sleepHr.value === null          ? '—' : `${Math.round(sleepHr.value)} bpm`);
const respRateDisplay        = computed(() => respRate.value === null         ? '—' : `${respRate.value.toFixed(1)} /min`);
const restingHrDisplay       = computed(() => restingHr.value === null        ? '—' : `${Math.round(restingHr.value)} bpm`);
const stepsDisplay           = computed(() => steps.value === null            ? '—' : Math.round(steps.value).toLocaleString());
const weightDisplay          = computed(() => latestBodyLog.value             ? `${latestBodyLog.value.weight_kg.toFixed(1)} kg` : '—');

const sleepScoreClass = computed(() => {
  const s = sleepScore.value;
  if (s === null) return 'score--muted';
  if (s >= 80) return 'score--green';
  if (s >= 60) return 'score--yellow';
  return 'score--red';
});

// --- Readiness ---
const readinessDisplay = computed(() => readinessScore.value === null ? '—' : String(readinessScore.value));

const readinessLabel = computed(() => {
  const s = readinessScore.value;
  if (s === null) return 'No data';
  if (s >= 70) return 'Peak';
  if (s >= 55) return 'Good';
  if (s >= 35) return 'Low';
  return 'Recharge';
});

const readinessLabelClass = computed(() => {
  const s = readinessScore.value;
  if (s === null) return 'label--muted';
  if (s >= 70) return 'label--green';
  if (s >= 45) return 'label--yellow';
  return 'label--red';
});

const batteryBarColor = computed(() => {
  const s = readinessScore.value;
  if (s === null) return 'rgba(255,255,255,0.25)';
  if (s >= 70) return 'rgb(34,197,94)';
  if (s >= 45) return 'rgba(255,255,255,0.85)';
  return 'rgb(215, 26, 33)';
});

const readinessBarWidth = computed(() => {
  if (readinessScore.value === null) return '0%';
  return `${readinessScore.value}%`;
});

// --- Sleep insight ---
const sleepInsight = computed((): string => {
  const eff = sleepEfficiency.value;
  const hrs = sleepHours.value;
  const sc  = sleepScore.value;
  const rr  = respRate.value;
  if (rr !== null && rr > 17) return 'Respiratory rate elevated — monitor for illness';
  if (eff !== null && eff < 80) return 'Efficiency below target — aim for 85%+';
  if (hrs !== null && hrs < 7)  return 'Sleep under 7 h — recovery may be limited';
  if (sc !== null && sc >= 85)  return 'Strong sleep — recovery looks good';
  if (hrs === null && sc === null && eff === null) return '';
  return 'Sleep looks solid';
});

// --- Health Connect status ---
const healthConnectStatus = computed(() =>
  isHealthConnectAvailable()
    ? 'Sync latest data from Android Health Connect'
    : 'Health Connect unavailable on web'
);

// --- Formatters ---
const formatWorkoutType = (t: string) =>
  t.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
const workoutInitial = (t: string): string => formatWorkoutType(t).slice(0, 2).toUpperCase();
const formatActivityDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });

// --- Data loading ---
const loadMetrics = async () => {
  const [mSleep, mSleepScore, mSleepEff, mSleepHr, mRespRate, mRestingHr, mSteps] = await Promise.all([
    getLatestHealthMetric('sleep_duration'),
    getLatestHealthMetric('sleep_score'),
    getLatestHealthMetric('sleep_efficiency'),
    getLatestHealthMetric('sleep_heart_rate'),
    getLatestHealthMetric('respiratory_rate'),
    getLatestHealthMetric('resting_heart_rate'),
    getLatestHealthMetric('steps'),
  ]);
  sleepHours.value      = mSleep      ? Number(mSleep.value)      : null;
  sleepScore.value      = mSleepScore ? Number(mSleepScore.value) : null;
  sleepEfficiency.value = mSleepEff   ? Number(mSleepEff.value)   : null;
  sleepHr.value         = mSleepHr    ? Number(mSleepHr.value)    : null;
  respRate.value        = mRespRate   ? Number(mRespRate.value)   : null;
  restingHr.value       = mRestingHr  ? Number(mRestingHr.value)  : null;
  steps.value           = mSteps      ? Number(mSteps.value)      : null;
};

const loadReadiness = async () => {
  const today = localDateISO();
  let stored = await getReadinessScore(today);
  if (!stored) stored = await getLatestReadinessScore();

  // No stored readiness and no live metrics → genuinely no data. Show "—"/"No data"
  // instead of a real-looking number derived from an all-null baseline.
  const hasLiveData = [sleepHours.value, sleepEfficiency.value, sleepScore.value, restingHr.value, sleepHr.value, respRate.value]
    .some(v => v !== null);
  if (stored?.score == null && !hasLiveData) {
    readinessScore.value = null;
    batteryResult.value = null;
    return;
  }

  const baseline = stored?.score != null
    ? Number(stored.score)
    : calculateReadinessScore({
        sleepHours:               sleepHours.value,
        sleepEfficiency:          sleepEfficiency.value,
        sleepScore:               sleepScore.value,
        restingHr:                restingHr.value,
        sleepHeartRate:           sleepHr.value,
        respiratoryRate:          respRate.value,
        steps:                    steps.value,
        rhrBaseline:              rhrBaseline.value,
        sleepHrBaseline:          sleepHrBaseline.value,
        respiratoryRateBaseline:  respRateBaseline.value,
      });

  const result = calculateBattery(baseline, new Date(), todayWorkouts.value, activities.value, todayEvents.value, circScore.value);
  batteryResult.value  = result;
  readinessScore.value = result.score;
};

const loadBody = async () => {
  const logs = await getBodyLogs();
  latestBodyLog.value = logs[0] ?? null;
};

const loadActivities = async () => { activities.value = await getRecentActivities(7); };

const loadReadinessHistory = async () => {
  const raw = await queryReadinessHistory(14);
  if (raw.length < 2) { readinessHistory.value = []; return; }
  const minS = Math.min(...raw.map(r => r.score));
  const maxS = Math.max(...raw.map(r => r.score));
  const range = maxS - minS || 1;
  readinessHistory.value = raw.map((r, i) => ({
    date: r.date,
    score: Math.round(r.score),
    x: (i / (raw.length - 1)) * 96 + 2,
    y: 36 - ((r.score - minS) / range) * 32 + 2,
    dateLabel: new Date(r.date + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' }),
  }));
};

const rhLinePoints = computed(() => readinessHistory.value.map(p => `${p.x},${p.y}`).join(' '));
const rhAreaPoints = computed(() => {
  const pts = readinessHistory.value;
  if (!pts.length) return '';
  return `${pts[0].x},40 ${rhLinePoints.value} ${pts[pts.length - 1].x},40`;
});

const loadTodayContext = async () => {
  const today = localDateISO();
  const [workouts, events] = await Promise.all([
    getTodayCompletedWorkouts(),
    getCalendarEventsForDate(today),
  ]);
  todayWorkouts.value = workouts;
  todayEvents.value   = (events as typeof todayEvents.value).sort(
    (a, b) => (a.time_start ?? '').localeCompare(b.time_start ?? '')
  );
};

const loadCircadianScore = async () => {
  try {
    const [sessions, logs, rhrMetric, rhrHistory, sleepHrHistory, respRateHistory] = await Promise.all([
      getRecentSleepSessions(14),
      getRecentCircadianLogs(14),
      getLatestHealthMetric('resting_heart_rate'),
      getRecentHealthMetrics('resting_heart_rate', 14),
      getRecentHealthMetrics('sleep_heart_rate', 14),
      getRecentHealthMetrics('respiratory_rate', 14),
    ]);
    const recs = sessions.map(s => ({
      date: s.date, bedtime: s.bedtime, waketime: s.waketime,
      timeAsleepHours: s.time_asleep_hours, efficiency: s.efficiency,
    }));
    const rhrToday = rhrMetric ? Number(rhrMetric.value) : null;
    const rhrBase  = rhrHistory.length
      ? rhrHistory.reduce((s, m) => s + Number(m.value), 0) / rhrHistory.length
      : null;
    rhrBaseline.value     = rhrBase;
    sleepHrBaseline.value = sleepHrHistory.length >= 3
      ? sleepHrHistory.reduce((s, m) => s + Number(m.value), 0) / sleepHrHistory.length : null;
    respRateBaseline.value = respRateHistory.length >= 3
      ? respRateHistory.reduce((s, m) => s + Number(m.value), 0) / respRateHistory.length : null;
    const lightFraction = logs.length ? logs.filter(l => l.morning_light === 1).length / logs.length : null;
    circScore.value = computeCircadianScore(recs, rhrToday, rhrBase, lightFraction).total;
  } catch { circScore.value = null; }
};

onIonViewWillEnter(async () => {
  await Promise.all([loadMetrics(), loadBody(), loadActivities(), loadReadinessHistory(), loadTodayContext(), loadCircadianScore()]);
  await loadReadiness();
});

const handleConnect = async () => {
  syncing.value = true;
  try {
    const result = await requestHealthConnectPermissions();
    if (!result.available) {
      if (isHealthConnectAvailable()) await openHealthConnectSettings();
      const t = await toastController.create({ message: result.reason ?? 'Health Connect unavailable.', duration: 2200, color: 'warning' });
      await t.present();
      return;
    }
    if (!result.granted) {
      const t = await toastController.create({ message: 'Permissions not granted yet.', duration: 2200, color: 'warning' });
      await t.present();
      return;
    }
    const syncResult = await syncHealthConnectMetrics();
    await Promise.all([loadMetrics(), loadActivities(), loadTodayContext(), loadCircadianScore()]);
    await loadReadiness();
    const t = await toastController.create({ message: `Synced ${syncResult.synced} records.`, duration: 2200, color: 'success' });
    await t.present();
  } catch (error) {
    const t = await toastController.create({
      message: error instanceof Error ? error.message : 'Health Connect unavailable.',
      duration: 2200, color: 'danger',
    });
    await t.present();
  } finally {
    syncing.value = false;
  }
};
</script>

<style scoped>
.health-content { --padding-top: 16px; --padding-bottom: 24px; }

.health-shell {
  padding: 16px;
  display: grid;
  gap: 16px;
  max-width: 760px;
  margin: 0 auto;
}

.card {
  background: var(--ion-color-primary);
  border-radius: var(--nt-radius-md);
  padding: 18px;
}

.section-kicker {
  margin: 0 0 12px;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: rgba(255, 255, 255, 0.5);
}

/* ── Metric tiles ── */
.metric-grid { display: grid; gap: 10px; }
.metric-grid--2col { grid-template-columns: repeat(2, 1fr); }
.metric-grid--3col { grid-template-columns: repeat(3, 1fr); }

.card-metric {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.metric-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
}

.metric-value { font-size: 0.95rem; font-weight: 600; color: #fff; }

/* ── Battery hero ── */
.readiness-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}

.readiness-score-wrap { display: flex; align-items: baseline; gap: 3px; }

.readiness-score-num {
  font-size: 3.2rem;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}

.readiness-score-denom {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 400;
}

.hero-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  padding-top: 6px;
}

.readiness-label {
  font-size: 0.9rem;
  font-weight: 600;
}

.label--green  { color: rgb(34, 197, 94); }
.label--yellow { color: rgba(255, 255, 255, 0.85); }
.label--red    { color: rgb(215, 26, 33); }
.label--muted  { color: rgba(255, 255, 255, 0.5); }

.ready-badges { display: flex; gap: 6px; }

.ready-badge {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 2px 6px;
  border-radius: 999px;
}

.badge--green { background: rgba(34,197,94,0.15); color: rgb(34,197,94); }
.badge--muted { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.35); }

.readiness-bar-track {
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  margin-bottom: 14px;
  overflow: hidden;
}

.readiness-bar-fill {
  height: 100%;
  border-radius: 999px;
}

.drain-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }

.drain-val { color: rgb(215, 26, 33); }
.drain-val--positive { color: rgb(34, 197, 94); }

.readiness-mini-grid { grid-template-columns: repeat(3, 1fr); }

/* ── Sleep card ── */
.sleep-top {
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: stretch;
}

.sleep-score-block {
  display: flex;
  flex-direction: row;
  gap: 10px;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 14px 16px;
  flex-shrink: 0;
  min-width: 68px;
}

.sleep-score-num {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
}

.score--green  { color: rgb(34, 197, 94); }
.score--yellow { color: rgba(255, 255, 255, 0.85); }
.score--red    { color: rgb(215, 26, 33); }
.score--muted  { color: rgba(255, 255, 255, 0.25); }

.sleep-score-sub {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 6px;
}

.sleep-metrics { flex: 1; }

.sleep-insight {
  margin: 12px 0 0;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.5;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  border-left: 2px solid rgba(215, 26, 33, 0.5);
}

/* ── Today's schedule ── */
.event-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.event-row { display: flex; align-items: center; gap: 10px; }

.event-time {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
  width: 38px;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.event-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  flex-shrink: 0;
}

.dot--workout  { background: rgb(215, 26, 33); }
.dot--school   { background: rgba(255, 255, 255, 0.85); }
.dot--recovery { background: rgb(34, 197, 94); }
.dot--sleep    { background: rgba(255, 255, 255, 0.5); }
.dot--reminder { background: rgba(255, 255, 255, 0.35); }
.dot--general  { background: rgba(255, 255, 255, 0.25); }

.event-title {
  flex: 1;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.event-tag {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 2px 6px;
  border-radius: 999px;
  flex-shrink: 0;
}

.tag--workout  { background: rgba(215, 26, 33,0.15);   color: rgb(215, 26, 33); }
.tag--school   { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.85); }
.tag--recovery { background: rgba(34,197,94,0.15);   color: rgb(34,197,94); }
.tag--sleep    { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.85); }
.tag--reminder { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.85); }
.tag--general  { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); }

/* ── Readiness chart ── */
.rh-chart { display: grid; gap: 10px; }
.rh-svg { width: 100%; height: auto; overflow: visible; }

.rh-line {
  fill: none;
  stroke: rgb(215, 26, 33);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.rh-area { fill: rgba(215, 26, 33, 0.15); stroke: none; }

.rh-dot {
  fill: rgb(215, 26, 33);
  cursor: pointer;
}

.rh-dot--selected { r: 2; filter: brightness(1.3); }

.rh-tooltip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(215, 26, 33, 0.12);
  border: 1px solid rgba(215, 26, 33, 0.4);
}

.rh-tooltip strong { font-size: 1.1rem; color: rgb(215, 26, 33); }
.rh-tooltip small  { font-size: 0.75rem; color: rgba(215, 26, 33, 0.7); }

.rh-axis {
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.4);
}

.empty-hint { margin: 0; font-size: 0.9rem; color: rgba(255, 255, 255, 0.5); }

/* ── Activities ── */
.activity-list { display: grid; gap: 10px; }

.activity-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 18px;
  border-radius: var(--nt-radius-md);
  background: var(--ion-color-primary);
}

.activity-icon {
  font-size: 0.85rem;
  font-weight: 700;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(215, 26, 33, 0.12);
  color: rgb(215, 26, 33);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  letter-spacing: 0.03em;
}

.activity-body { flex: 1; display: flex; flex-direction: column; gap: 3px; }
.activity-name { font-size: 0.95rem; color: #fff; font-weight: 600; }
.activity-date { font-size: 0.72rem; color: rgba(255, 255, 255, 0.5); }

.activity-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-top: 6px;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.85);
}

/* ── Sync card ── */
.sync-status {
  margin: 0 0 14px;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.5);
}

.sync-btn {
  width: 100%;
  padding: 12px;
  background: rgb(215, 26, 33);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 150ms ease;
}

.sync-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.sync-btn:not(:disabled):active { background: rgb(178, 19, 25); }

/* ── Responsive ── */
@media (min-width: 600px) {
  .drain-grid { grid-template-columns: repeat(4, 1fr); }
  .activity-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .sleep-top { flex-direction: row; align-items: flex-start; }
  .sleep-score-block { flex-direction: column; gap: 0; }
}
</style>
