<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="hermes-shell">
        <!-- Today verdict hero -->
        <div class="card recovery-card" :class="recovery ? `recovery-card--${recovery.level}` : ''">
          <div class="card-header">
            <p class="nt-kicker">Today</p>
            <span v-if="recovery" class="recovery-pill" :class="`recovery-pill--${recovery.level}`">
              {{ recoveryLabel }}
            </span>
          </div>
          <strong class="recovery-headline">{{ recovery ? recoveryLabel : 'No verdict yet' }}</strong>
          <p class="recovery-reason">
            {{ recovery?.reason ?? 'Not enough recovery history — sync Health Connect and log a few workouts.' }}
          </p>
        </div>

        <!-- Summary tiles Hermes reads -->
        <div class="card">
          <p class="nt-kicker">Signals</p>
          <div class="tile-grid">
            <div class="tile">
              <span class="tile__label">Readiness</span>
              <strong class="tile__value">{{ readinessVal ?? '—' }}</strong>
            </div>
            <div class="tile">
              <span class="tile__label">Sleep score</span>
              <strong class="tile__value">{{ sleepVal ?? '—' }}</strong>
            </div>
            <div class="tile">
              <span class="tile__label">ACWR</span>
              <strong class="tile__value">{{ acwrVal ?? '—' }}</strong>
            </div>
            <div class="tile">
              <span class="tile__label">Recovery z</span>
              <strong class="tile__value">{{ recoveryZVal ?? '—' }}</strong>
            </div>
          </div>
          <p class="hint-copy">Same numbers Hermes reads when drafting your briefings.</p>
        </div>

        <!-- Cross-domain insights -->
        <div class="card">
          <p class="nt-kicker">Insights</p>
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

        <!-- Hermes push notifications -->
        <div class="card">
          <div class="card-header">
            <p class="nt-kicker">Push from Hermes</p>
            <button class="refresh-btn" aria-label="Refresh" @click="refreshPush">
              <ion-icon :icon="refreshOutline" :class="{ spinning: pushLoading }" />
            </button>
          </div>
          <template v-if="pushMessages.length > 0">
            <div class="push-list">
              <div v-for="(msg, i) in pushMessages" :key="`${msg.receivedAt}-${i}`" class="push-row">
                <span class="push-dot"></span>
                <div class="push-body">
                  <strong class="push-title">{{ msg.title || 'Hermes' }}</strong>
                  <span class="push-text">{{ msg.body }}</span>
                  <span class="push-time">{{ formatPushTime(msg.receivedAt) }}</span>
                </div>
              </div>
            </div>
          </template>
          <p v-else class="empty-copy">
            {{ pushLoading ? 'Checking…' : 'No messages — Hermes pushes briefings to your notifications.' }}
          </p>
          <p class="hint-copy">Polled from the health receiver (type <span class="mono">hermes</span>).</p>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonContent, IonIcon, onIonViewWillEnter } from '@ionic/vue';
import { ref, computed } from 'vue';
import { refreshOutline } from 'ionicons/icons';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import {
  getRecentSleepSessionSummaries,
  getRecentHealthMetrics,
  queryReadinessHistory,
  getSessionLoads,
} from '@/shared/db/app_db';
import { computeTodayRecovery, type RecoveryRecommendation } from '@/shared/health/todayRecovery';
import { computeDailyLoads, computeAcwrSeries, type AcwrPoint } from '@/shared/health/trainingLoad';
import { computeRecoverySeries, type RecoveryPoint } from '@/shared/health/recoveryBaseline';
import { computeInsights, type DatedValue, type Insight } from '@/shared/health/insights';
import { localDateISO } from '@/shared/utils/timeFormat';
import { hapticLight } from '@/shared/utils/haptics';
import { fetchHermesMessages, type HermesMessage } from '@/shared/hermes/hermesPush';

const recovery = ref<RecoveryRecommendation | null>(null);
const readinessVal = ref<number | null>(null);
const sleepVal = ref<number | null>(null);
const acwrVal = ref<string | null>(null);
const recoveryZVal = ref<string | null>(null);
const insights = ref<Insight[]>([]);
const pushMessages = ref<HermesMessage[]>([]);
const pushLoading = ref(false);

const recoveryLabel = computed(() => ({
  train: 'Train hard',
  maintain: 'Maintain',
  recover: 'Recover',
}[recovery.value?.level ?? 'maintain']));

const formatPushTime = (unixSec: number) => {
  if (!unixSec) return '';
  const d = new Date(unixSec * 1000);
  const today = localDateISO();
  const day = localDateISO(d);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return day === today ? time : `${day.slice(5)} ${time}`;
};

const loadAll = async () => {
  const [sleep, rhrRows, readinessRows, sessions] = await Promise.all([
    getRecentSleepSessionSummaries(28).catch(() => []),
    getRecentHealthMetrics('resting_heart_rate', 28).catch(() => []),
    queryReadinessHistory(28).catch(() => []),
    getSessionLoads(28).catch(() => []),
  ]);

  const today = localDateISO();
  const rhr: DatedValue[] = rhrRows
    .map((r: { date: string; value: number }) => ({ date: r.date, value: Number(r.value) }))
    .filter((r: DatedValue) => Number.isFinite(r.value));
  const readiness: DatedValue[] = readinessRows
    .map((r: { date: string; score: number }) => ({ date: r.date, value: Number(r.score) }))
    .filter((r: DatedValue) => Number.isFinite(r.value));
  const sleepHours: DatedValue[] = sleep
    .filter((s: { time_asleep_hours: number | null }) => Number.isFinite(s.time_asleep_hours))
    .map((s: { date: string; time_asleep_hours: number }) => ({ date: s.date, value: Number(s.time_asleep_hours) }));

  const sessionInputs = sessions.map((s) => ({
    date: s.date,
    volumeLoad: s.volume,
    durationMinutes: s.duration_minutes,
    sessionRpe: s.session_rpe,
  }));

  recovery.value = computeTodayRecovery({ sessions: sessionInputs, rhr, readiness, today });

  // Same series the TrainingLoadOverlay charts — one ACWR number, one recovery z.
  const acwrSeries = computeAcwrSeries(computeDailyLoads(sessionInputs), { endDate: today });
  const latestAcwr = [...acwrSeries].reverse().find((p: AcwrPoint) => p.acwr != null);
  acwrVal.value = latestAcwr?.acwr != null ? latestAcwr.acwr.toFixed(2) : null;

  const recoverySeries = computeRecoverySeries(rhr, 'rhr');
  const latestZ = [...recoverySeries].reverse().find((p: RecoveryPoint) => p.recoveryZ != null);
  recoveryZVal.value = latestZ?.recoveryZ != null ? latestZ.recoveryZ.toFixed(2) : null;

  readinessVal.value = [...readiness].reverse().find((r: DatedValue) => r.date === today)?.value
    ?? readinessRows[readinessRows.length - 1]?.score ?? null;
  sleepVal.value = sleep[0]?.score ?? null;

  insights.value = computeInsights({
    sleepHours,
    rhr,
    readiness,
    dailyVolume: computeDailyLoads(sessionInputs).map((d) => ({ date: d.date, value: d.volumeLoad })),
  });
};

const refreshPush = async () => {
  hapticLight();
  pushLoading.value = true;
  try {
    pushMessages.value = await fetchHermesMessages(5);
  } finally {
    pushLoading.value = false;
  }
};

onIonViewWillEnter(() => {
  loadAll();
  void refreshPush();
});
</script>

<style scoped>
.hermes-shell {
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
  align-items: center;
  justify-content: space-between;
}

.recovery-headline {
  font-family: var(--nt-font-head);
  font-size: 1.4rem;
  letter-spacing: var(--nt-tracking-label);
  text-transform: uppercase;
}

.recovery-pill {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: var(--nt-tracking-label);
  padding: 4px 10px;
  border-radius: var(--nt-radius-pill);
}

.recovery-card--train .recovery-pill { color: var(--nt-data-positive); }
.recovery-card--maintain .recovery-pill { color: var(--nt-text); }
.recovery-card--recover .recovery-pill { color: var(--nt-accent); }

.recovery-reason {
  color: var(--nt-text-dim);
  font-size: 0.9rem;
  margin: 0;
}

.tile-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.tile {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 12px;
  display: grid;
  gap: 4px;
}

.tile__label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: var(--nt-tracking-label);
  color: var(--nt-text-dim);
}

.tile__value {
  font-family: var(--nt-font-display);
  font-size: 1.5rem;
}

.insight-list {
  display: grid;
  gap: 10px;
}

.insight-row {
  display: flex;
  gap: 10px;
  align-items: baseline;
}

.insight-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--nt-text-dim);
}

.insight-dot--warning { background: var(--nt-accent); }
.insight-dot--positive { background: var(--nt-data-positive); }

.insight-text {
  font-size: 0.9rem;
  color: var(--nt-text);
}

.push-list {
  display: grid;
  gap: 12px;
}

.push-row {
  display: flex;
  gap: 10px;
}

.push-dot {
  flex: none;
  width: 6px;
  height: 6px;
  margin-top: 7px;
  border-radius: 50%;
  background: var(--nt-accent);
}

.push-body {
  display: grid;
  gap: 2px;
}

.push-title {
  font-size: 0.92rem;
}

.push-text {
  font-size: 0.85rem;
  color: var(--nt-text-dim);
}

.push-time {
  font-family: var(--nt-font-mono);
  font-size: 0.72rem;
  color: var(--nt-text-dim);
}

.refresh-btn {
  background: none;
  border: none;
  color: var(--nt-text-dim);
  min-width: 36px;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.refresh-btn ion-icon.spinning {
  animation: hermes-spin 900ms linear infinite;
}

@keyframes hermes-spin {
  to { transform: rotate(360deg); }
}

.hint-copy,
.empty-copy {
  color: var(--nt-text-dim);
  font-size: 0.8rem;
  margin: 0;
}

.mono {
  font-family: var(--nt-font-mono);
}
</style>
