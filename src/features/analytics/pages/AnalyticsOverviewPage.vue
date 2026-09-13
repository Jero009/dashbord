<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <analytics-section-tabs />
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="analytics-shell">
        <!-- Recovery recommendation hero -->
        <div class="card recovery-card" :class="`recovery-card--${recovery.level}`">
          <div class="card-header">
            <p class="section-kicker">Today</p>
            <span class="recovery-pill" :class="`recovery-pill--${recovery.level}`">
              {{ recoveryLabel }}
            </span>
          </div>
          <strong class="recovery-headline">{{ recoveryLabel }}</strong>
          <p class="recovery-reason">{{ recovery.reason }}</p>
        </div>

        <!-- Training load -->
        <div class="card">
          <p class="section-kicker">Training load</p>
          <template v-if="load.status !== 'insufficient'">
            <div class="tile-grid tile-grid--3">
              <div class="tile">
                <span class="tile__label">Acute (7d)</span>
                <strong class="tile__value">{{ formatVolume(load.acuteTotal) }}</strong>
              </div>
              <div class="tile">
                <span class="tile__label">Weekly avg</span>
                <strong class="tile__value">{{ formatVolume(load.chronicWeeklyAvg) }}</strong>
              </div>
              <div class="tile">
                <span class="tile__label">ACWR</span>
                <strong class="tile__value" :class="acwrClass">{{ load.acwr.toFixed(2) }}</strong>
              </div>
            </div>
            <p class="load-note">{{ loadNote }}</p>
          </template>
          <p v-else class="empty-copy">Need more workout history</p>
        </div>

        <!-- Insights -->
        <div class="card">
          <p class="section-kicker">Insights</p>
          <template v-if="insights.length > 0">
            <div class="insight-list">
              <div v-for="ins in insights" :key="ins.id" class="insight-row">
                <i class="insight-dot" :class="`insight-dot--${ins.tone}`"></i>
                <span class="insight-text">{{ ins.text }}</span>
              </div>
            </div>
          </template>
          <p v-else class="empty-copy">Not enough data yet</p>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonContent, onIonViewWillEnter } from '@ionic/vue';
import { ref, computed } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import AnalyticsSectionTabs from '@/features/analytics/components/AnalyticsSectionTabs.vue';
import {
  getRecentSleepSessionSummaries,
  getRecentHealthMetrics,
  queryReadinessHistory,
  getSessionLoads,
} from '@/shared/db/app_db';
import { computeInsights, type DatedValue, type TrainingLoad, type RecoveryRecommendation, type Insight } from '@/shared/health/insights';
import { computeTodayRecovery } from '@/shared/health/todayRecovery';
import { computeDailyLoads, computeAcwrSeries, type DailyLoad } from '@/shared/health/trainingLoad';
import { localDateISO } from '@/shared/utils/timeFormat';

const load = ref<TrainingLoad>({ acuteTotal: 0, chronicWeeklyAvg: 0, acwr: 0, status: 'insufficient' });
const recovery = ref<RecoveryRecommendation>({ level: 'train', reason: 'Recovery markers look good — green light to push.' });
const insights = ref<Insight[]>([]);

const recoveryLabel = computed(() => ({
  train: 'Train hard',
  maintain: 'Maintain',
  recover: 'Recover',
}[recovery.value.level]));

const acwrClass = computed(() => ({
  'tile__value--accent': load.value.status === 'high',
  'tile__value--positive': load.value.status === 'optimal',
}));

const loadNote = computed(() => {
  switch (load.value.status) {
    case 'high': return 'Load spiking — injury risk rises';
    case 'undertraining': return 'Below usual — room to add volume';
    case 'detraining': return 'No recent training — ease back in';
    default: return 'Sustainable range';
  }
});

const formatVolume = (v: number) => (v >= 10000 ? `${Math.round(v / 100) / 10}k` : `${Math.round(v)}`);

const loadAll = async () => {
  const [sleep, rhrRows, readinessRows, sessions] = await Promise.all([
    getRecentSleepSessionSummaries(28).catch(() => []),
    getRecentHealthMetrics('resting_heart_rate', 28).catch(() => []),
    queryReadinessHistory(28).catch(() => []),
    getSessionLoads(28).catch(() => []),
  ]);

  const sleepHours: DatedValue[] = sleep
    .filter((s) => Number.isFinite(s.time_asleep_hours))
    .map((s) => ({ date: s.date, value: Number(s.time_asleep_hours) }));

  const rhr: DatedValue[] = (rhrRows as { date: string; value: number }[])
    .map((r) => ({ date: r.date, value: Number(r.value) }))
    .filter((r) => Number.isFinite(r.value));

  const readiness: DatedValue[] = readinessRows
    .map((r) => ({ date: r.date, value: Number(r.score) }))
    .filter((r) => Number.isFinite(r.value));

  // One shared verdict (same EWMA ACWR + recovery-z services as Home chip and
  // TrainingLoadOverlay) so the pages can never disagree.
  const verdict = computeTodayRecovery({
    sessions: sessions.map((s) => ({
      date: s.date,
      volumeLoad: s.volume,
      durationMinutes: s.duration_minutes,
      sessionRpe: s.session_rpe,
    })),
    rhr,
    readiness,
    today: localDateISO(),
  });
  recovery.value = verdict ?? { level: 'train', reason: 'Recovery markers look good — green light to push.' };

  // Load tiles read off the same ACWR series the verdict used.
  const dailyLoads = computeDailyLoads(sessions.map((s) => ({
    date: s.date,
    volumeLoad: s.volume,
    durationMinutes: s.duration_minutes,
    sessionRpe: s.session_rpe,
  })));
  load.value = loadFromSeries(dailyLoads);

  insights.value = computeInsights({ sleepHours, rhr, readiness, dailyVolume: dailyVolumeFromLoads(dailyLoads) });
};

/** Summarise the shared EWMA ACWR series into the tile values. */
function loadFromSeries(dailyLoads: DailyLoad[]): TrainingLoad {
  const series = computeAcwrSeries(dailyLoads, { endDate: localDateISO() });
  const latest = [...series].reverse().find((p) => p.acwr != null);
  if (!latest) return { acuteTotal: 0, chronicWeeklyAvg: 0, acwr: 0, status: 'insufficient' };
  const recent = series.slice(-7);
  const chronicWeekly = latest.chronic * 7;
  return {
    acuteTotal: Math.round(recent.reduce((s, p) => s + p.load, 0)),
    chronicWeeklyAvg: Math.round(chronicWeekly),
    acwr: latest.acwr ?? 0,
    status:
      latest.acwr == null ? 'insufficient'
        : latest.acwr > 1.5 ? 'high'
          : latest.acwr < 0.8 ? (recent.every((p) => p.load === 0) ? 'detraining' : 'undertraining')
            : 'optimal',
  };
}

/** Volume-per-day series for computeInsights, from the same daily loads. */
function dailyVolumeFromLoads(dailyLoads: DailyLoad[]): DatedValue[] {
  return dailyLoads.map((d) => ({ date: d.date, value: d.volumeLoad }));
}

onIonViewWillEnter(() => {
  loadAll();
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

/* Recovery hero */
.recovery-card {
  border: 1px solid transparent;
}

.recovery-card--recover {
  border-color: var(--ion-color-accent-red);
}

.recovery-headline {
  font-family: var(--nt-font-display);
  font-size: 2rem;
  font-weight: 700;
  color: var(--nt-fg);
  line-height: 1;
}

.recovery-card--recover .recovery-headline {
  color: var(--ion-color-accent-red);
}

.recovery-card--train .recovery-headline {
  color: var(--nt-data-positive);
}

.recovery-reason {
  margin: 0;
  color: rgba(var(--nt-ink), 0.7);
  font-size: 0.9rem;
  line-height: 1.5;
}

.recovery-pill {
  font-family: var(--nt-font-head);
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 4px 12px;
  border-radius: var(--nt-radius-pill);
  background: rgba(var(--nt-ink), 0.08);
  color: rgba(var(--nt-ink), 0.7);
}

.recovery-pill--recover {
  background: rgba(215, 26, 33, 0.15);
  color: var(--ion-color-accent-red);
}

.recovery-pill--train {
  background: rgba(34, 197, 94, 0.15);
  color: var(--nt-data-positive);
}

/* Tiles */
.tile-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 14px;
  background: rgba(var(--nt-ink), 0.05);
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
  color: var(--nt-fg);
}

.tile__value--accent {
  color: var(--ion-color-accent-red);
}

.tile__value--positive {
  color: var(--nt-data-positive);
}

.load-note {
  margin: 0;
  color: rgba(var(--nt-ink), 0.6);
  font-size: 0.85rem;
  line-height: 1.5;
}

/* Insights */
.insight-list {
  display: grid;
  gap: 10px;
}

.insight-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(var(--nt-ink), 0.05);
  border-radius: 10px;
}

.insight-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 6px;
  flex-shrink: 0;
  background: rgba(var(--nt-ink), 0.4);
}

.insight-dot--warning {
  background: var(--ion-color-accent-red);
}

.insight-dot--positive {
  background: var(--nt-data-positive);
}

.insight-text {
  font-size: 0.9rem;
  color: rgba(var(--nt-ink), 0.85);
  line-height: 1.45;
}

.empty-copy {
  margin: 0;
  color: rgba(var(--nt-ink), 0.6);
  font-size: 0.9rem;
  line-height: 1.5;
}
</style>
