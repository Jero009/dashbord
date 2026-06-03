<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <health-section-tabs />
    </ion-header>

    <ion-content :fullscreen="true" class="sleep-content">
      <div class="sleep-shell">

        <!-- Hero: score ring + key metrics -->
        <ion-card class="sleep-card">
          <div class="card-topline">
            <p class="section-kicker">Sleep score</p>
            <div class="date-nav" v-if="sessionDates.length">
              <button class="date-nav__btn" @click="goToPrevDay" :disabled="sessionDates.indexOf(selectedDate ?? '') >= sessionDates.length - 1">&#8249;</button>
              <span class="date-nav__label">{{ selectedDateLabel }}</span>
              <button class="date-nav__btn" @click="goToNextDay" :disabled="sessionDates.indexOf(selectedDate ?? '') <= 0">&#8250;</button>
            </div>
          </div>

          <div class="hero-body">
            <div class="sleep-ring" :style="{ '--score': sleepScoreRatio }">
              <svg viewBox="0 0 120 120" class="sleep-ring__svg" aria-hidden="true">
                <circle class="sleep-ring__track" cx="60" cy="60" r="46" />
                <circle class="sleep-ring__progress" cx="60" cy="60" r="46" />
              </svg>
              <div class="sleep-ring__content">
                <strong>{{ sleepScoreDisplay }}</strong>
                <span>{{ sleepSubtitle }}</span>
              </div>
            </div>

            <div class="hero-stats">
              <div class="card-metric">
                <span>Asleep</span>
                <strong>{{ sleepHoursDisplay }}</strong>
              </div>
              <div class="card-metric">
                <span>In bed</span>
                <strong>{{ timeInBedDisplay }}</strong>
              </div>
              <div class="card-metric">
                <span>Efficiency</span>
                <strong>{{ sleepEfficiencyPercent }}</strong>
              </div>
              <div class="card-metric">
                <span>Bedtime</span>
                <strong>{{ bedTimeClock }}</strong>
              </div>
              <div class="card-metric">
                <span>Wake</span>
                <strong>{{ wakeTimeClock }}</strong>
              </div>
              <div class="card-metric">
                <span>HR</span>
                <strong>{{ sleepHeartRateDisplay }}</strong>
              </div>
              <div class="card-metric">
                <span>Resp.</span>
                <strong>{{ respiratoryRateDisplay }}</strong>
              </div>
            </div>
          </div>

          <button class="sync-btn" :disabled="syncing" @click="handleSync">
            {{ syncing ? 'Syncing…' : 'Sync Health Connect' }}
          </button>
        </ion-card>

        <!-- Stage timeline -->
        <ion-card class="sleep-card">
          <p class="section-kicker">Stage timeline</p>
          <div v-if="sleepStageLanes.length" class="stage-lanes">
            <div v-for="lane in sleepStageLanes" :key="lane.stage" class="stage-lane">
              <div class="stage-lane__label">{{ stageLabel(lane.stage) }}</div>
              <div class="stage-lane__bar">
                <div
                  v-for="segment in lane.segments"
                  :key="`${segment.stage}-${segment.startDate}`"
                  class="stage-lane__segment"
                  :class="stageClass(segment.stage)"
                  :style="stageStyle(segment)"
                />
              </div>
            </div>
            <div class="axis-row">
              <span>{{ bedTimeClock }}</span>
              <span>{{ wakeTimeClock }}</span>
            </div>
          </div>
          <p v-else class="empty-state">No stage timeline yet</p>
        </ion-card>

        <!-- Stage breakdown + consistency row -->
        <div class="two-col">
          <ion-card class="sleep-card">
            <p class="section-kicker">Stages</p>
            <div v-if="stageRows.length" class="stage-list">
              <div v-for="stage in stageRows" :key="stage.stage" class="stage-row">
                <div class="stage-dot" :class="`stage-dot--${stage.stage}`"></div>
                <span>{{ stageLabel(stage.stage) }}</span>
                <strong>{{ stage.minutes }}m</strong>
                <small>{{ Math.round(stage.share * 100) }}%</small>
              </div>
            </div>
            <p v-else class="empty-state">No stage data</p>
          </ion-card>

          <ion-card class="sleep-card">
            <p class="section-kicker">Consistency · 7 nights</p>
            <div class="consistency-grid">
              <div class="card-metric">
                <span>Score</span>
                <strong>{{ consistencyDisplay }}</strong>
              </div>
              <div class="card-metric">
                <span>Streak</span>
                <strong>{{ streakDisplay }}</strong>
              </div>
              <div class="card-metric card-metric--full">
                <span>Good nights</span>
                <strong>{{ goodNightsDisplay }}</strong>
              </div>
            </div>
          </ion-card>
        </div>

        <!-- Heart rate chart -->
        <ion-card class="sleep-card">
          <p class="section-kicker">Heart rate overnight</p>
          <div v-if="heartRatePoints.length" class="heart-rate-chart">
            <svg viewBox="0 0 100 40" class="chart-svg" role="img" aria-label="Sleep heart rate graph">
              <polyline class="chart-line" :points="heartRateLinePoints" />
              <circle
                v-for="point in heartRatePoints"
                :key="point.time"
                class="chart-dot"
                :class="{ 'is-selected': selectedHeartRatePoint?.time === point.time }"
                :cx="point.offset"
                :cy="point.y"
                r="0.8"
                @click="selectedHeartRatePoint = point"
              />
            </svg>
            <div v-if="selectedHeartRatePoint" class="chart-tooltip">
              <strong>{{ selectedHeartRatePoint.value }} bpm</strong>
              <small>{{ new Date(selectedHeartRatePoint.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</small>
            </div>
            <div class="axis-row">
              <span>{{ bedTimeClock }}</span>
              <span>{{ wakeTimeClock }}</span>
            </div>
          </div>
          <p v-else class="empty-state">No HR data yet</p>
        </ion-card>

        <!-- Score history -->
        <ion-card class="sleep-card">
          <p class="section-kicker">History · 30 nights</p>
          <div v-if="sleepScoreHistory.length" class="score-history">
            <svg viewBox="0 0 100 48" class="chart-svg" role="img" aria-label="Sleep score history">
              <polygon class="chart-area" :points="scoreHistoryAreaPoints" />
              <polyline class="chart-line" :points="scoreHistoryLinePoints" />
              <circle
                v-for="point in sleepScoreHistory"
                :key="point.date"
                class="chart-dot"
                :class="{ 'is-selected': selectedScorePoint?.date === point.date }"
                :cx="point.x"
                :cy="point.y"
                r="1"
                @click="selectedScorePoint = { date: point.date, score: point.score ?? 0 }"
              />
            </svg>
            <div v-if="selectedScorePoint" class="chart-tooltip">
              <strong>{{ selectedScorePoint.score }}</strong>
              <small>{{ new Date(`${selectedScorePoint.date}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' }) }}</small>
            </div>
            <div class="score-history__labels">
              <span v-for="label in scoreHistoryLabels" :key="label.date" :style="{ left: `${label.x}%` }">
                {{ label.text }}
              </span>
            </div>
          </div>
          <p v-else class="empty-state">No history yet</p>
        </ion-card>

      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonCard,
  IonContent,
  IonHeader,
  IonPage,
  toastController,
  onIonViewWillEnter,
} from '@ionic/vue';
import { computed, ref } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import HealthSectionTabs from '@/features/health/components/HealthSectionTabs.vue';
import type { SleepStageTimeline, SleepHeartRatePoint, SleepStageSummary, SleepSummary } from '@/shared/health/healthConnect';
import { requestHealthConnectPermissions, syncHealthConnectMetrics } from '@/shared/health/healthConnect';
import { getSleepSession, getRecentSleepSessions } from '@/shared/db/app_db';
import type { SleepSessionRecord } from '@/shared/db/app_db';

const syncing = ref(false);
const summary = ref<SleepSummary | null>(null);
const sleepHistory = ref<Array<{ date: string; value: number; score: number | null; efficiency: number | null }>>([]);
const selectedHeartRatePoint = ref<{ time: string; value: number; offset: number } | null>(null);
const selectedScorePoint = ref<{ date: string; score: number } | null>(null);
const sessionDates = ref<string[]>([]);
const selectedDate = ref<string | null>(null);

function clampVal(val: number, min: number, max: number) { return Math.min(max, Math.max(min, val)); }

function sessionToSummary(record: SleepSessionRecord): SleepSummary {
  const bedMs = new Date(record.bedtime).getTime();
  const wakeMs = new Date(record.waketime).getTime();
  const span = Math.max(1, wakeMs - bedMs);
  const spanMin = span / 60000;

  const rawStages: Array<{ s: string; start: string; end: string; dur: number }> =
    record.stage_timeline_json ? JSON.parse(record.stage_timeline_json) : [];
  const timeline: SleepStageTimeline[] = rawStages
    .map((rs) => {
      const startMs = new Date(rs.start).getTime();
      const offset = clampVal(((startMs - bedMs) / span) * 100, 0, 100);
      const width = clampVal(Math.min((rs.dur / spanMin) * 100, 100 - offset), 0, 100);
      return { stage: rs.s, startDate: rs.start, endDate: rs.end, minutes: rs.dur, offset, width };
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const rawHr: Array<{ t: string; v: number; o: number }> =
    record.hr_timeline_json ? JSON.parse(record.hr_timeline_json) : [];
  const heartRateTimeline: SleepHeartRatePoint[] = rawHr
    .filter((p) => Number.isFinite(p.v))
    .map((p) => ({ time: p.t, value: p.v, offset: p.o }));

  const stageMap: Record<string, number> = {
    deep: record.stage_deep_min,
    light: record.stage_light_min,
    rem: record.stage_rem_min,
    awake: record.stage_awake_min,
    asleep: record.stage_asleep_min,
  };
  const totalStageMin = Object.values(stageMap).reduce((s, m) => s + m, 0);
  const stages: SleepStageSummary[] = Object.entries(stageMap)
    .filter(([, m]) => m > 0)
    .map(([stage, minutes]) => ({ stage, minutes, share: totalStageMin > 0 ? minutes / totalStageMin : 0 }))
    .sort((a, b) => b.minutes - a.minutes);

  return {
    score: record.score,
    timeAsleepHours: record.time_asleep_hours,
    timeInBedHours: record.time_in_bed_hours,
    efficiency: record.efficiency,
    wentToSleepAt: record.bedtime,
    wokeUpAt: record.waketime,
    sleepHeartRate: record.sleep_hr,
    respiratoryRate: record.respiratory_rate,
    stages,
    timeline,
    heartRateTimeline,
  };
}

const loadSleep = async () => {
  const sessions = await getRecentSleepSessions(30);
  sessionDates.value = sessions.map((s) => s.date);
  sleepHistory.value = sessions.map((s) => ({
    date: s.date,
    value: s.time_asleep_hours,
    score: s.score,
    efficiency: s.efficiency,
  }));

  if (sessions.length === 0) {
    summary.value = null;
    return;
  }

  if (!selectedDate.value || !sessionDates.value.includes(selectedDate.value)) {
    selectedDate.value = sessions[0].date;
  }

  const current = sessions.find((s) => s.date === selectedDate.value) ?? sessions[0];
  summary.value = sessionToSummary(current);
};

const goToPrevDay = async () => {
  const idx = sessionDates.value.indexOf(selectedDate.value ?? '');
  if (idx < sessionDates.value.length - 1) {
    selectedDate.value = sessionDates.value[idx + 1];
    const record = await getSleepSession(selectedDate.value);
    summary.value = record ? sessionToSummary(record) : null;
    selectedHeartRatePoint.value = null;
  }
};

const goToNextDay = async () => {
  const idx = sessionDates.value.indexOf(selectedDate.value ?? '');
  if (idx > 0) {
    selectedDate.value = sessionDates.value[idx - 1];
    const record = await getSleepSession(selectedDate.value);
    summary.value = record ? sessionToSummary(record) : null;
    selectedHeartRatePoint.value = null;
  }
};

const selectedDateLabel = computed(() => {
  if (!selectedDate.value) return '—';
  return new Date(`${selectedDate.value}T00:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
});

const handleSync = async () => {
  syncing.value = true;

  try {
    const auth = await requestHealthConnectPermissions();
    if (!auth.available) {
      const toast = await toastController.create({
        message: auth.reason ?? 'Health Connect unavailable.',
        duration: 2200,
        color: 'warning',
      });
      await toast.present();
      return;
    }

    if (!auth.granted) {
      const toast = await toastController.create({
        message: 'Grant Health Connect access to read sleep data.',
        duration: 2200,
        color: 'warning',
      });
      await toast.present();
      return;
    }

    const result = await syncHealthConnectMetrics();
    selectedDate.value = null; // reset to latest after sync
    await loadSleep();

    const toast = await toastController.create({
      message: `Synced ${result.synced} health records.`,
      duration: 2000,
      color: 'success',
    });
    await toast.present();
  } catch (error) {
    const toast = await toastController.create({
      message: error instanceof Error ? error.message : 'Unable to sync sleep data.',
      duration: 2200,
      color: 'danger',
    });
    await toast.present();
  } finally {
    syncing.value = false;
  }
};

const score = computed(() => summary.value?.score ?? null);
const sleepScoreRatio = computed(() => (score.value === null ? 0 : Math.min(1, score.value / 100)));
const sleepScoreDisplay = computed(() => (score.value === null ? '—' : `${score.value}`));
const sleepSubtitle = computed(() => {
  if (score.value === null) return 'No sleep session yet';
  if (score.value >= 80) return 'Excellent recovery';
  if (score.value >= 60) return 'Good enough';
  return 'Needs recovery';
});

const sleepHoursDisplay = computed(() =>
  summary.value ? `${summary.value.timeAsleepHours.toFixed(1)} h` : '—'
);
const timeInBedDisplay = computed(() =>
  summary.value ? `${summary.value.timeInBedHours.toFixed(1)} h` : '—'
);

const sleepEfficiencyPercent = computed(() =>
  summary.value ? `${Math.round(summary.value.efficiency * 100)}%` : '—'
);
const sleepStageTimeline = computed(() => summary.value?.timeline ?? []);
const sleepStageLanes = computed(() => {
  const stages = sleepStageTimeline.value;
  const order = ['deep', 'rem', 'light', 'asleep', 'awake', 'inBed'];
  const grouped = new Map<string, SleepStageTimeline[]>();

  for (const stage of stages) {
    const bucket = grouped.get(stage.stage) ?? [];
    bucket.push(stage);
    grouped.set(stage.stage, bucket);
  }

  return order
    .filter((stage) => grouped.has(stage))
    .map((stage) => ({
      stage,
      segments: grouped.get(stage) ?? [],
    }));
});
const heartRatePoints = computed(() => {
  const points = summary.value?.heartRateTimeline ?? [];
  if (!points.length) return [];

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(1, max - min);

  return points.map((point) => ({
    ...point,
    y: 36 - ((point.value - min) / spread) * 28,
  }));
});
const heartRateLinePoints = computed(() => heartRatePoints.value.map((point) => `${point.offset.toFixed(2)},${point.y.toFixed(2)}`).join(' '));
const sleepScoreHistory = computed(() =>
  [...sleepHistory.value]
    .reverse()
    .map((row, index, rows) => {
      const x = rows.length <= 1 ? 0 : (index / (rows.length - 1)) * 100;
      const score = row.score ?? 0;
      return {
        ...row,
        x,
        y: 44 - (Math.min(100, Math.max(0, score)) / 100) * 36,
      };
    })
);
const scoreHistoryLinePoints = computed(() =>
  sleepScoreHistory.value.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
);
const scoreHistoryAreaPoints = computed(() => {
  if (!sleepScoreHistory.value.length) return '';
  const last = sleepScoreHistory.value[sleepScoreHistory.value.length - 1];
  return `0,44 ${scoreHistoryLinePoints.value} ${last.x.toFixed(2)},44`;
});
const scoreHistoryLabels = computed(() =>
  sleepScoreHistory.value
    .filter((point, index) => index === 0 || index === sleepScoreHistory.value.length - 1 || index % 3 === 0)
    .map((point) => ({
      date: point.date,
      x: point.x,
      text: new Date(`${point.date}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    }))
);
const consistencyWindow = computed(() => sleepHistory.value.slice(0, 7));
const goodNightsCount = computed(() =>
  consistencyWindow.value.filter((row) => row.value >= 7 && (row.score ?? 0) >= 70).length
);
const consistencyScore = computed(() => {
  if (!consistencyWindow.value.length) return null;
  return Math.round((goodNightsCount.value / consistencyWindow.value.length) * 100);
});
const streakCount = computed(() => {
  let streak = 0;
  for (const row of consistencyWindow.value) {
    if (row.value >= 7 && (row.score ?? 0) >= 70) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
});
const consistencyDisplay = computed(() => (consistencyScore.value === null ? '—' : `${consistencyScore.value}%`));
const streakDisplay = computed(() => `${streakCount.value} night${streakCount.value === 1 ? '' : 's'}`);
const goodNightsDisplay = computed(() => `${goodNightsCount.value}/${consistencyWindow.value.length || 0}`);
const sleepHeartRateDisplay = computed(() => {
  const value = summary.value?.sleepHeartRate ?? null;
  return value !== null ? `${value} bpm` : '—';
});
const respiratoryRateDisplay = computed(() => {
  const value = summary.value?.respiratoryRate ?? null;
  return value !== null ? `${value} rpm` : '—';
});
const stageRows = computed(() => summary.value?.stages ?? []);
const bedTimeClock = computed(() =>
  summary.value ? new Date(summary.value.wentToSleepAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'
);
const wakeTimeClock = computed(() =>
  summary.value ? new Date(summary.value.wokeUpAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'
);

const stageLabel = (stage: string) =>
  ({
    awake: 'Awake',
    asleep: 'Asleep',
    rem: 'REM',
    deep: 'Deep',
    light: 'Light',
    inBed: 'In bed',
  }[stage] ?? stage);

const stageClass = (stage: string) => `is-${stage.replace(/([A-Z])/g, '-$1').toLowerCase()}`;

const stageStyle = (stage: SleepStageTimeline) => ({
  left: `${stage.offset}%`,
  width: `${Math.max(stage.width, 2)}%`,
});

onIonViewWillEnter(async () => {
  await loadSleep();
});
</script>

<style scoped>
.sleep-content {
  --padding-top: 16px;
  --padding-bottom: 24px;
}

.sleep-shell {
  padding: 16px;
  max-width: 760px;
  margin: 0 auto;
  display: grid;
  gap: 16px;
}

.sleep-card {
  margin: 0;
  border-radius: 12px;
  background: var(--ion-color-primary);
  color: #fff;
  padding: 18px;
}

.section-kicker {
  margin: 0 0 14px;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: rgba(255, 255, 255, 0.45);
}

/* Card topline */
.card-topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

/* Hero layout */
.hero-body {
  display: grid;
  gap: 16px;
}

.hero-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

/* Metric tiles */
.card-metric {
  border-radius: 10px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.05);
}

.card-metric span {
  display: block;
  margin-bottom: 6px;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
}

.card-metric strong {
  display: block;
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
}

.card-metric--full {
  grid-column: 1 / -1;
}

/* Sync button */
.sync-btn {
  margin-top: 16px;
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.88rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.sync-btn:disabled { opacity: 0.4; }
.sync-btn:not(:disabled):active { background: rgba(255,255,255,0.1); }

/* Date nav */
.date-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.date-nav__label {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.75);
  min-width: 110px;
  text-align: center;
}

.date-nav__btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  line-height: 1;
}

.date-nav__btn:disabled { opacity: 0.25; }

/* Two-col layout */
.two-col {
  display: grid;
  gap: 16px;
}

/* Sleep ring */

.sleep-ring {
  --score: 0;
  position: relative;
  width: min(100%, 200px);
  aspect-ratio: 1;
  margin: 0 auto;
}

.sleep-ring__svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.sleep-ring__track,
.sleep-ring__progress {
  fill: none;
  stroke-width: 12;
}

.sleep-ring__track { stroke: rgba(255, 255, 255, 0.08); }

.sleep-ring__progress {
  stroke: var(--ion-color-danger);
  stroke-linecap: round;
  stroke-dasharray: 289;
  stroke-dashoffset: calc(289 - (289 * var(--score)));
}

.sleep-ring__content {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 0.2rem;
  text-align: center;
}

.sleep-ring__content strong {
  font-size: 2.8rem;
  line-height: 1;
  font-weight: 700;
  color: #fff;
}

.sleep-ring__content span {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.55);
}

/* Stage timeline */
.stage-lanes { display: grid; gap: 8px; }

.stage-lane {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
}

.stage-lane__label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.55);
}

.stage-lane__bar {
  position: relative;
  height: 20px;
  border-radius: 10px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
}

.stage-lane__segment {
  position: absolute;
  top: 2px;
  bottom: 2px;
  border-radius: 8px;
}

.stage-lane__segment.is-awake  { background: rgba(239, 68, 68, 0.8); }
.stage-lane__segment.is-rem    { background: rgba(168, 85, 247, 0.8); }
.stage-lane__segment.is-deep   { background: rgba(59, 130, 246, 0.85); }
.stage-lane__segment.is-light  { background: rgba(34, 197, 94, 0.75); }
.stage-lane__segment.is-asleep { background: rgba(249, 115, 22, 0.8); }
.stage-lane__segment.is-in-bed { background: rgba(148, 163, 184, 0.5); }

.axis-row {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 0.08em;
}

/* Two-column sections */
.two-col { display: grid; gap: 16px; }

/* Stage list */
.stage-list { display: grid; gap: 10px; }

.stage-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stage-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.stage-dot--awake  { background: rgba(239, 68, 68, 0.8); }
.stage-dot--rem    { background: rgba(168, 85, 247, 0.8); }
.stage-dot--deep   { background: rgba(59, 130, 246, 0.85); }
.stage-dot--light  { background: rgba(34, 197, 94, 0.75); }
.stage-dot--asleep { background: rgba(249, 115, 22, 0.8); }

.stage-row span {
  flex: 1;
  font-size: 0.88rem;
  color: rgba(255, 255, 255, 0.8);
}

.stage-row strong {
  font-size: 0.88rem;
  color: #fff;
}

.stage-row small {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
  min-width: 32px;
  text-align: right;
}

/* Consistency */
.consistency-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

/* Charts */
.heart-rate-chart,
.score-history {
  display: grid;
  gap: 8px;
}

.chart-svg {
  width: 100%;
  height: auto;
  overflow: visible;
}

.chart-line {
  fill: none;
  stroke: var(--ion-color-danger);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.chart-area { fill: rgba(239, 68, 68, 0.12); }

.chart-dot {
  fill: var(--ion-color-danger);
  cursor: pointer;
  transition: r 0.15s, filter 0.15s;
}

.chart-dot:hover,
.chart-dot.is-selected {
  filter: brightness(1.3);
}

.chart-tooltip {
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.chart-tooltip strong {
  font-size: 1.1rem;
  color: var(--ion-color-danger);
}

.chart-tooltip small {
  font-size: 0.75rem;
  color: rgba(239, 68, 68, 0.7);
}

.score-history__labels {
  position: relative;
  height: 1.2rem;
}

.score-history__labels span {
  position: absolute;
  transform: translateX(-50%);
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.4);
}

.empty-state {
  margin: 0;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.35);
}

@media (min-width: 600px) {
  .hero-body {
    grid-template-columns: 180px 1fr;
    align-items: center;
  }

  .hero-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .two-col {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
