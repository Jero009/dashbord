<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <health-section-tabs />
    </ion-header>

    <ion-content :fullscreen="true" class="sleep-content">
      <div class="sleep-shell">
        <ion-card class="sleep-hero">
          <ion-card-header>
            <ion-card-title>Sleep score</ion-card-title>
            <ion-card-subtitle>{{ sleepSubtitle }}</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <div class="sleep-ring" :style="{ '--score': sleepScoreRatio }">
              <svg viewBox="0 0 120 120" class="sleep-ring__svg" aria-hidden="true">
                <circle class="sleep-ring__track" cx="60" cy="60" r="46"></circle>
                <circle class="sleep-ring__progress" cx="60" cy="60" r="46"></circle>
              </svg>
              <div class="sleep-ring__content">
                <strong>{{ sleepScoreDisplay }}</strong>
                <span>{{ sleepEfficiencyDisplay }}</span>
              </div>
            </div>

            <ion-button expand="block" :disabled="syncing" @click="handleSync">
              {{ syncing ? 'Syncing...' : 'Sync Sleep Connect' }}
            </ion-button>
          </ion-card-content>
        </ion-card>

        <section class="sleep-grid">
          <ion-card class="sleep-card">
            <ion-card-header>
              <ion-card-title>Time asleep</ion-card-title>
            </ion-card-header>
            <ion-card-content>{{ sleepHoursDisplay }}</ion-card-content>
          </ion-card>

          <ion-card class="sleep-card">
            <ion-card-header>
              <ion-card-title>Time in bed</ion-card-title>
            </ion-card-header>
            <ion-card-content>{{ timeInBedDisplay }}</ion-card-content>
          </ion-card>

          <ion-card class="sleep-card">
            <ion-card-header>
              <ion-card-title>Efficiency</ion-card-title>
            </ion-card-header>
            <ion-card-content>{{ sleepEfficiencyPercent }}</ion-card-content>
          </ion-card>

          <ion-card class="sleep-card">
            <ion-card-header>
              <ion-card-title>Sleep heart rate</ion-card-title>
            </ion-card-header>
            <ion-card-content>{{ sleepHeartRateDisplay }}</ion-card-content>
          </ion-card>

          <ion-card class="sleep-card">
            <ion-card-header>
              <ion-card-title>Respiratory rate</ion-card-title>
            </ion-card-header>
            <ion-card-content>{{ respiratoryRateDisplay }}</ion-card-content>
          </ion-card>

          <ion-card class="sleep-card">
            <ion-card-header>
              <ion-card-title>Bedtime / wake</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <div>{{ bedTimeDisplay }}</div>
              <div>{{ wakeTimeDisplay }}</div>
            </ion-card-content>
          </ion-card>
        </section>

        <ion-card class="sleep-card">
          <ion-card-header>
            <ion-card-title>Stage timeline</ion-card-title>
            <ion-card-subtitle>When each stage happened overnight</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
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
              <div class="stage-timeline__axis">
                <span>{{ bedTimeClock }}</span>
                <span>{{ wakeTimeClock }}</span>
              </div>
            </div>
            <p v-else class="empty-state">No sleep stage timeline yet.</p>
          </ion-card-content>
        </ion-card>

        <ion-card class="sleep-card">
          <ion-card-header>
            <ion-card-title>Heart rate</ion-card-title>
            <ion-card-subtitle>Sleep heart rate through the night</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <div v-if="heartRatePoints.length" class="heart-rate-chart">
              <svg viewBox="0 0 100 40" class="heart-rate-chart__svg" role="img" aria-label="Sleep heart rate graph">
                <polyline class="heart-rate-chart__line" :points="heartRateLinePoints" />
                <circle
                  v-for="point in heartRatePoints"
                  :key="point.time"
                  class="heart-rate-chart__dot"
                  :class="{ 'is-selected': selectedHeartRatePoint?.time === point.time }"
                  :cx="point.offset"
                  :cy="point.y"
                  r="0.8"
                  @click="selectedHeartRatePoint = point"
                />
              </svg>
              <div v-if="selectedHeartRatePoint" class="heart-rate-tooltip">
                <strong>{{ selectedHeartRatePoint.value }} bpm</strong>
                <small>{{ new Date(selectedHeartRatePoint.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</small>
              </div>
              <div class="stage-timeline__axis">
                <span>{{ bedTimeClock }}</span>
                <span>{{ wakeTimeClock }}</span>
              </div>
            </div>
            <p v-else class="empty-state">No sleep heart-rate data yet.</p>
          </ion-card-content>
        </ion-card>

        <ion-card class="sleep-card">
          <ion-card-header>
            <ion-card-title>Sleep stages</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <div v-if="stageRows.length" class="stage-list">
              <div v-for="stage in stageRows" :key="stage.stage" class="stage-row">
                <span>{{ stageLabel(stage.stage) }}</span>
                <strong>{{ stage.minutes }}m</strong>
                <small>{{ Math.round(stage.share * 100) }}%</small>
              </div>
            </div>
            <p v-else class="empty-state">No stage data yet.</p>
          </ion-card-content>
        </ion-card>

        <ion-card class="sleep-card">
          <ion-card-header>
            <ion-card-title>Sleep consistency</ion-card-title>
            <ion-card-subtitle>Last 7 nights</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <div class="consistency-grid">
              <div class="consistency-pill">
                <span>Score</span>
                <strong>{{ consistencyDisplay }}</strong>
              </div>
              <div class="consistency-pill">
                <span>Streak</span>
                <strong>{{ streakDisplay }}</strong>
              </div>
              <div class="consistency-pill">
                <span>Good nights</span>
                <strong>{{ goodNightsDisplay }}</strong>
              </div>
            </div>
          </ion-card-content>
        </ion-card>

        <ion-card class="sleep-card">
          <ion-card-header>
            <ion-card-title>Previous days</ion-card-title>
            <ion-card-subtitle>Sleep score history</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <div v-if="sleepScoreHistory.length" class="score-history">
              <svg viewBox="0 0 100 48" class="score-history__svg" role="img" aria-label="Sleep score history graph">
                <polygon class="score-history__area" :points="scoreHistoryAreaPoints" />
                <polyline class="score-history__line" :points="scoreHistoryLinePoints" />
                <circle
                  v-for="point in sleepScoreHistory"
                  :key="point.date"
                  class="score-history__dot"
                  :cx="point.x"
                  :cy="point.y"
                  r="1.8"
                />
              </svg>
              <div class="score-history__labels">
                <span v-for="label in scoreHistoryLabels" :key="label.date" :style="{ left: `${label.x}%` }">
                  {{ label.text }}
                </span>
              </div>
            </div>
            <p v-else class="empty-state">No prior sleep history yet.</p>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonPage,
  toastController,
  onIonViewWillEnter,
} from '@ionic/vue';
import { computed, ref } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import HealthSectionTabs from '@/features/health/components/HealthSectionTabs.vue';
import type { SleepStageTimeline, SleepSummary } from '@/shared/health/healthConnect';
import { getLatestSleepSummary, requestHealthConnectPermissions, syncHealthConnectMetrics } from '@/shared/health/healthConnect';
import { getRecentHealthMetrics } from '@/shared/db/app_db';

const syncing = ref(false);
const summary = ref<SleepSummary | null>(null);
const sleepHistory = ref<Array<{ date: string; value: number; score: number | null; efficiency: number | null }>>([]);
const selectedHeartRatePoint = ref<{ time: string; value: number } | null>(null);

const loadSleep = async () => {
  const result = await getLatestSleepSummary();
  summary.value = result.summary ?? null;

  const [sleepRows, scoreRows, efficiencyRows] = await Promise.all([
    getRecentHealthMetrics('sleep_duration', 14),
    getRecentHealthMetrics('sleep_score', 14),
    getRecentHealthMetrics('sleep_efficiency', 14),
  ]);

  const scoreByDate = new Map(scoreRows.map((row) => [row.date, Number(row.value)]));
  const efficiencyByDate = new Map(efficiencyRows.map((row) => [row.date, Number(row.value)]));

  sleepHistory.value = sleepRows.map((row) => ({
    date: row.date,
    value: Number(row.value),
    score: scoreByDate.has(row.date) ? scoreByDate.get(row.date) ?? null : null,
    efficiency: efficiencyByDate.has(row.date) ? efficiencyByDate.get(row.date) ?? null : null,
  }));
};

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

    await syncHealthConnectMetrics();
    await loadSleep();

    const toast = await toastController.create({
      message: 'Sleep data synced.',
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
const sleepEfficiencyDisplay = computed(() =>
  summary.value ? `${Math.round(summary.value.efficiency * 100)}% efficiency` : '—'
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
const bedTimeDisplay = computed(() =>
  summary.value ? `Went to sleep ${new Date(summary.value.wentToSleepAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : '—'
);
const wakeTimeDisplay = computed(() =>
  summary.value ? `Woke up ${new Date(summary.value.wokeUpAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : '—'
);
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
  display: grid;
  gap: 16px;
}

.sleep-hero,
.sleep-card {
  margin: 0;
  border-radius: 12px;
  background: var(--ion-color-primary);
  color: #fff;
}

.sleep-card ion-card-subtitle {
  color: rgba(255, 255, 255, 0.65);
}

.sleep-ring {
  --score: 0;
  position: relative;
  width: min(100%, 240px);
  aspect-ratio: 1;
  margin: 0 auto 16px;
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
  cx: 60;
  cy: 60;
  r: 46;
}

.sleep-ring__track {
  stroke: rgba(255, 255, 255, 0.08);
}

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
  color: #fff;
}

.sleep-ring__content strong {
  font-size: 3rem;
  line-height: 1;
  color: #fff;
}

.sleep-ring__content span {
  color: rgba(255, 255, 255, 0.75);
}

.sleep-grid {
  display: grid;
  gap: 12px;
}

.stage-list {
  display: grid;
  gap: 8px;
}

.stage-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 12px;
  align-items: center;
}

.stage-lanes {
  display: grid;
  gap: 0.5rem;
}

.stage-lane {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 0.75rem;
  align-items: center;
}

.stage-lane__label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.7);
}

.stage-lane__bar {
  position: relative;
  height: 22px;
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.stage-lane__segment {
  position: absolute;
  top: 2px;
  bottom: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 600;
  overflow: hidden;
  white-space: nowrap;
}

.stage-lane__segment span {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
  display: none;
}

.stage-lane__segment.is-awake {
  background: rgba(239, 68, 68, 0.82);
}

.stage-lane__segment.is-rem {
  background: rgba(168, 85, 247, 0.82);
}

.stage-lane__segment.is-deep {
  background: rgba(59, 130, 246, 0.82);
}

.stage-lane__segment.is-light {
  background: rgba(34, 197, 94, 0.82);
}

.stage-lane__segment.is-asleep {
  background: rgba(249, 115, 22, 0.82);
}

.stage-lane__segment.is-in-bed {
  background: rgba(148, 163, 184, 0.72);
}

.stage-timeline__axis {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.heart-rate-chart {
  display: grid;
  gap: 0.5rem;
}

.heart-rate-chart__svg {
  width: 100%;
  height: auto;
  overflow: visible;
}

.heart-rate-chart__line {
  fill: none;
  stroke: var(--ion-color-danger);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.heart-rate-chart__dot {
  fill: var(--ion-color-danger);
  cursor: pointer;
  transition: r 0.2s ease, filter 0.2s ease;
}

.heart-rate-chart__dot:hover {
  r: 1.3;
  filter: brightness(1.2);
}

.heart-rate-chart__dot.is-selected {
  r: 1.3;
  filter: brightness(1.4);
}

.heart-rate-tooltip {
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid var(--ion-color-danger);
  text-align: center;
  color: var(--ion-color-danger);
}

.heart-rate-tooltip strong {
  display: block;
  font-size: 1.25rem;
}

.heart-rate-tooltip small {
  display: block;
  font-size: 0.75rem;
  color: rgba(239, 68, 68, 0.8);
  margin-top: 0.25rem;
}

.consistency-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.consistency-pill {
  padding: 0.75rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.consistency-pill span,
.history-row span {
  display: block;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.65);
}

.history-list {
  display: grid;
  gap: 0.5rem;
}

.score-history {
  display: grid;
  gap: 0.35rem;
}

.score-history__svg {
  width: 100%;
  height: auto;
  overflow: visible;
}

.score-history__area {
  fill: rgba(239, 68, 68, 0.12);
}

.score-history__line {
  fill: none;
  stroke: var(--ion-color-danger);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.score-history__dot {
  fill: var(--ion-color-danger);
}

.score-history__labels {
  position: relative;
  height: 1.4rem;
}

.score-history__labels span {
  position: absolute;
  transform: translateX(-50%);
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.55);
}

.empty-state {
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
}

@media (min-width: 760px) {
  .sleep-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .consistency-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
