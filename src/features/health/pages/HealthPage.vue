<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <health-section-tabs />
    </ion-header>

    <ion-content :fullscreen="true" class="health-content">
      <div class="health-shell">

        <!-- 1. Readiness hero card -->
        <div class="card readiness-card">
          <p class="section-kicker">Readiness</p>
          <div class="readiness-hero">
            <div class="readiness-score-wrap">
              <span class="readiness-score-num">{{ readinessDisplay }}</span>
              <span class="readiness-score-denom" v-if="readinessScore !== null">/100</span>
            </div>
            <span class="readiness-label" :class="readinessLabelClass">{{ readinessLabel }}</span>
          </div>
          <div class="readiness-bar-track">
            <div class="readiness-bar-fill" :style="{ width: readinessBarWidth }"></div>
          </div>
          <div class="metric-grid readiness-mini-grid">
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

        <!-- 2. Sleep detail card -->
        <div class="card">
          <p class="section-kicker">Sleep</p>
          <div class="metric-grid metric-grid--2col">
            <div class="card-metric">
              <span class="metric-label">Duration</span>
              <span class="metric-value">{{ sleepDisplay }}</span>
            </div>
            <div class="card-metric">
              <span class="metric-label">Score</span>
              <span class="metric-value">{{ sleepScoreDisplay }}</span>
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
          <p v-if="sleepInsight" class="sleep-insight">{{ sleepInsight }}</p>
        </div>

        <!-- 3. Body metrics card -->
        <div class="card">
          <p class="section-kicker">Body</p>
          <div class="metric-grid metric-grid--3col">
            <div class="card-metric">
              <span class="metric-label">Resting HR</span>
              <span class="metric-value">{{ restingHrDisplay }}</span>
            </div>
            <div class="card-metric">
              <span class="metric-label">Resp. Rate</span>
              <span class="metric-value">{{ respRateDisplay }}</span>
            </div>
            <div class="card-metric">
              <span class="metric-label">Weight</span>
              <span class="metric-value">{{ weightDisplay }}</span>
            </div>
          </div>
        </div>

        <!-- 4. Readiness history chart -->
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

        <!-- 5. Activities section -->
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
                <span v-if="act.sourceName" class="activity-source">{{ act.sourceName }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- 5. Sync card -->
        <div class="card sync-card">
          <p class="section-kicker">Health Connect</p>
          <p class="sync-status">{{ healthConnectStatus }}</p>
          <button class="sync-btn" :disabled="syncing" @click="handleConnect">
            {{ syncing ? 'Syncing...' : 'Sync' }}
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
import HealthSectionTabs from '@/features/health/components/HealthSectionTabs.vue';
import {
  getLatestHealthMetric,
  getReadinessScore,
  getLatestReadinessScore,
  getBodyLogs,
  queryReadinessHistory,
} from '@/shared/db/app_db';
import type { BodyLogEntry } from '@/shared/db/app_db';
import {
  isHealthConnectAvailable,
  openHealthConnectSettings,
  requestHealthConnectPermissions,
  syncHealthConnectMetrics,
  getRecentActivities,
  calculateReadinessScore,
  applyReadinessDrain,
  type ActivitySummary,
} from '@/shared/health/healthConnect';

type RhPoint = { date: string; score: number; x: number; y: number; dateLabel: string };

// --- State ---
const sleepHours      = ref<number | null>(null);
const sleepScore      = ref<number | null>(null);
const sleepEfficiency = ref<number | null>(null);
const sleepHr         = ref<number | null>(null);
const respRate        = ref<number | null>(null);
const restingHr       = ref<number | null>(null);
const steps           = ref<number | null>(null);
const readinessScore  = ref<number | null>(null);
const latestBodyLog   = ref<BodyLogEntry | null>(null);
const activities      = ref<ActivitySummary[]>([]);
const syncing         = ref(false);
const readinessHistory = ref<RhPoint[]>([]);
const selectedRhPoint  = ref<RhPoint | null>(null);

// --- Displays ---
const sleepDisplay          = computed(() => sleepHours.value === null      ? '—' : `${sleepHours.value.toFixed(1)} h`);
const sleepScoreDisplay     = computed(() => sleepScore.value === null       ? '—' : `${Math.round(sleepScore.value)}`);
const sleepEfficiencyDisplay= computed(() => sleepEfficiency.value === null  ? '—' : `${Math.round(sleepEfficiency.value)}%`);
const sleepHrDisplay        = computed(() => sleepHr.value === null          ? '—' : `${Math.round(sleepHr.value)} bpm`);
const respRateDisplay       = computed(() => respRate.value === null         ? '—' : `${respRate.value.toFixed(1)} /min`);
const restingHrDisplay      = computed(() => restingHr.value === null        ? '—' : `${Math.round(restingHr.value)} bpm`);
const stepsDisplay          = computed(() => steps.value === null            ? '—' : Math.round(steps.value).toLocaleString());
const weightDisplay         = computed(() => latestBodyLog.value             ? `${latestBodyLog.value.weight_kg.toFixed(1)} kg` : '—');

// --- Readiness ---
const readinessDisplay = computed(() => readinessScore.value === null ? '—' : String(readinessScore.value));

const readinessLabel = computed(() => {
  const s = readinessScore.value;
  if (s === null) return 'No data';
  if (s >= 80) return 'Ready to push';
  if (s >= 60) return 'Steady day';
  return 'Take it easy';
});

const readinessLabelClass = computed(() => {
  const s = readinessScore.value;
  if (s === null) return 'label--muted';
  if (s >= 80) return 'label--green';
  if (s >= 60) return 'label--yellow';
  return 'label--red';
});

const readinessBarWidth = computed(() => {
  if (readinessScore.value === null) return '0%';
  return `${readinessScore.value}%`;
});

// --- Sleep insight ---
const sleepInsight = computed((): string => {
  const eff  = sleepEfficiency.value;
  const hrs  = sleepHours.value;
  const sc   = sleepScore.value;
  const rr   = respRate.value;

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

const workoutInitial = (t: string): string =>
  formatWorkoutType(t).slice(0, 2).toUpperCase();

const formatActivityDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });

// --- Data loading ---
const loadMetrics = async () => {
  const [
    mSleep, mSleepScore, mSleepEff, mSleepHr,
    mRespRate, mRestingHr, mSteps,
  ] = await Promise.all([
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
  const today = new Date().toISOString().slice(0, 10);
  let stored = await getReadinessScore(today);
  if (!stored) stored = await getLatestReadinessScore();

  if (stored?.score != null) {
    readinessScore.value = Math.round(applyReadinessDrain(Number(stored.score)));
  } else {
    const base = calculateReadinessScore({
      sleepHours:      sleepHours.value,
      sleepEfficiency: sleepEfficiency.value,
      sleepScore:      sleepScore.value,
      restingHr:       restingHr.value,
      sleepHeartRate:  sleepHr.value,
      respiratoryRate: respRate.value,
      steps:           steps.value,
    });
    readinessScore.value = Math.round(applyReadinessDrain(base));
  }
};

const loadBody = async () => {
  const logs = await getBodyLogs();
  latestBodyLog.value = logs[0] ?? null;
};

const loadActivities = async () => {
  activities.value = await getRecentActivities(7);
};

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

const rhLinePoints = computed(() =>
  readinessHistory.value.map(p => `${p.x},${p.y}`).join(' ')
);
const rhAreaPoints = computed(() => {
  const pts = readinessHistory.value;
  if (!pts.length) return '';
  return `${pts[0].x},40 ${rhLinePoints.value} ${pts[pts.length - 1].x},40`;
});

onIonViewWillEnter(async () => {
  await Promise.all([loadMetrics(), loadBody(), loadActivities(), loadReadinessHistory()]);
  await loadReadiness();
});

// --- Sync handler ---
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
    await Promise.all([loadMetrics(), loadActivities()]);
    await loadReadiness();
    const t = await toastController.create({ message: `Synced ${syncResult.synced} records.`, duration: 2200, color: 'success' });
    await t.present();
  } catch (error) {
    const t = await toastController.create({
      message: error instanceof Error ? error.message : 'Health Connect unavailable.',
      duration: 2200,
      color: 'danger',
    });
    await t.present();
  } finally {
    syncing.value = false;
  }
};
</script>

<style scoped>
/* ── Shell ─────────────────────────────────────────────── */
.health-content {
  --padding-top: 16px;
  --padding-bottom: 32px;
}

.health-shell {
  padding: 16px;
  display: grid;
  gap: 16px;
  max-width: 760px;
  margin: 0 auto;
}

/* ── Base card ──────────────────────────────────────────── */
.card {
  background: var(--ion-color-primary);
  border-radius: 12px;
  padding: 18px;
}

/* ── Section kicker ─────────────────────────────────────── */
.section-kicker {
  margin: 0 0 12px;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: rgba(255, 255, 255, 0.5);
}

/* ── Metric grid & tiles ────────────────────────────────── */
.metric-grid {
  display: grid;
  gap: 10px;
}

.metric-grid--2col {
  grid-template-columns: repeat(2, 1fr);
}

.metric-grid--3col {
  grid-template-columns: repeat(3, 1fr);
}

.card-metric {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
}

.metric-value {
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
}

/* ── Readiness hero ─────────────────────────────────────── */
.readiness-card {
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.readiness-hero {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-bottom: 14px;
}

.readiness-score-wrap {
  display: flex;
  align-items: baseline;
  gap: 3px;
}

.readiness-score-num {
  font-size: 3.2rem;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}

.readiness-score-denom {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.4);
  font-weight: 500;
}

.readiness-label {
  font-size: 0.88rem;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.label--green  { color: rgb(34, 197, 94); }
.label--yellow { color: rgb(255, 215, 0); }
.label--red    { color: rgb(239, 68, 68); }
.label--muted  { color: rgba(255, 255, 255, 0.4); }

/* Readiness bar */
.readiness-bar-track {
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  margin-bottom: 16px;
  overflow: hidden;
}

.readiness-bar-fill {
  height: 100%;
  border-radius: 2px;
  background: rgb(239, 68, 68);
  transition: width 0.4s ease;
}

.readiness-mini-grid {
  grid-template-columns: repeat(3, 1fr);
}

/* ── Sleep insight line ─────────────────────────────────── */
.sleep-insight {
  margin: 12px 0 0;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.5;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  border-left: 2px solid rgba(239, 68, 68, 0.5);
}

/* ── Readiness history chart ────────────────────────────── */
.rh-chart { display: grid; gap: 8px; }

.rh-svg {
  width: 100%;
  height: auto;
  overflow: visible;
}

.rh-line {
  fill: none;
  stroke: rgb(239, 68, 68);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.rh-area { fill: rgba(239, 68, 68, 0.15); stroke: none; }

.rh-dot {
  fill: rgb(239, 68, 68);
  cursor: pointer;
  transition: r 0.15s;
}

.rh-dot--selected { r: 2; filter: brightness(1.3); }

.rh-tooltip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.35);
}

.rh-tooltip strong { font-size: 1.1rem; color: rgb(239, 68, 68); }
.rh-tooltip small  { font-size: 0.75rem; color: rgba(255, 255, 255, 0.5); }

.rh-axis {
  display: flex;
  justify-content: space-between;
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.35);
}

.empty-hint {
  margin: 0;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.35);
}

/* ── Activities ─────────────────────────────────────────── */
.activity-list {
  display: grid;
  gap: 10px;
}

.activity-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  border-radius: 12px;
  background: var(--ion-color-primary);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.activity-icon {
  font-size: 0.85rem;
  font-weight: 700;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.12);
  color: rgb(239, 68, 68);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  letter-spacing: 0.03em;
}

.activity-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.activity-name {
  font-size: 0.95rem;
  color: #fff;
  font-weight: 600;
}

.activity-date {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
}

.activity-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-top: 4px;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.75);
}

.activity-source {
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.28);
  margin-top: 2px;
}

/* ── Sync card ──────────────────────────────────────────── */
.sync-card {
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.sync-status {
  margin: 0 0 14px;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.5);
}

.sync-btn {
  width: 100%;
  padding: 12px;
  background: rgb(239, 68, 68);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  letter-spacing: 0.03em;
  transition: opacity 0.15s ease;
}

.sync-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sync-btn:not(:disabled):active {
  opacity: 0.85;
}

/* ── Responsive ─────────────────────────────────────────── */
@media (max-width: 400px) {
  .readiness-mini-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .metric-grid--3col {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 600px) {
  .activity-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
