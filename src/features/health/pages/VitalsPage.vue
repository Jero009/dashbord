<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <health-section-tabs />
    </ion-header>

    <ion-content :fullscreen="true" class="vitals-content">
      <div class="vitals-shell">

        <!-- HRV -->
        <ion-card class="vitals-card">
          <div class="card-topline">
            <p class="nt-kicker">Heart rate variability</p>
          </div>
          <trend-chart
            v-if="hrvPts.length"
            :pts="hrvPts"
            unit="ms"
            :show-avg="true"
            aria-label="Heart rate variability history"
          />
          <p v-else class="nt-empty">No HRV yet — sync after wearing the watch overnight</p>

          <div v-if="hrvPts.length" class="vitals-tiles">
            <div class="nt-metric-tile">
              <span>Latest</span>
              <strong>{{ hrvLatestDisplay }}</strong>
            </div>
            <div class="nt-metric-tile">
              <span>7-day mean</span>
              <strong>{{ meanDisplay(hrvPts.slice(-7)) }}</strong>
            </div>
            <div class="nt-metric-tile nt-metric-tile--full">
              <span>Recovery signal</span>
              <strong>{{ hrvSignalDisplay }}</strong>
            </div>
          </div>
          <p v-if="hrvPts.length && hrvPts.length < HRV_TAKEOVER_MIN" class="vitals-note">
            {{ hrvPts.length }}/{{ HRV_TAKEOVER_MIN }} readings until HRV drives the recovery signal
          </p>
        </ion-card>

        <!-- SpO2 -->
        <ion-card class="vitals-card">
          <div class="card-topline">
            <p class="nt-kicker">Oxygen saturation</p>
          </div>
          <trend-chart
            v-if="spo2Pts.length"
            :pts="spo2Pts"
            unit="%"
            :show-avg="true"
            :format="(v: number) => v.toFixed(0)"
            aria-label="Oxygen saturation history"
          />
          <p v-else class="nt-empty">No SpO2 data</p>

          <div v-if="spo2Pts.length" class="vitals-tiles">
            <div class="nt-metric-tile">
              <span>Latest</span>
              <strong>{{ spo2LatestDisplay }}</strong>
            </div>
            <div class="nt-metric-tile">
              <span>7-day mean</span>
              <strong>{{ meanDisplay(spo2Pts.slice(-7)) }}</strong>
            </div>
          </div>
          <p v-if="spo2Pts.length" class="vitals-note">Spot checks from the watch — gaps are normal</p>
        </ion-card>

        <!-- VO2 max -->
        <ion-card class="vitals-card">
          <div class="card-topline">
            <p class="nt-kicker">VO2 max</p>
          </div>
          <trend-chart
            v-if="vo2Pts.length"
            :pts="vo2Pts"
            unit="ml/kg/min"
            :show-avg="true"
            :format="(v: number) => v.toFixed(1)"
            aria-label="VO2 max history"
          />
          <p v-else class="nt-empty">No VO2 max data</p>

          <div v-if="vo2Pts.length" class="vitals-tiles">
            <div class="nt-metric-tile">
              <span>Latest</span>
              <strong>{{ vo2LatestDisplay }}</strong>
            </div>
            <div class="nt-metric-tile">
              <span>90-day delta</span>
              <strong>{{ vo2DeltaDisplay }}</strong>
            </div>
          </div>
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
  onIonViewWillEnter,
} from '@ionic/vue';
import { computed, ref } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import TrendChart from '@/shared/components/TrendChart.vue';
import HealthSectionTabs from '@/features/health/components/HealthSectionTabs.vue';
import { getHealthMetricDailySeries } from '@/shared/db/app_db';
import { computeRecoverySeries } from '@/shared/health/recoveryBaseline';

// Must match TrainingLoadOverlay's takeover threshold — the two views agree.
const HRV_TAKEOVER_MIN = 14;

interface DailyPoint { date: string; value: number }

const hrvSeries = ref<DailyPoint[]>([]);
const spo2Series = ref<DailyPoint[]>([]);
const vo2Series = ref<DailyPoint[]>([]);

const toPts = (rows: DailyPoint[], days: number) =>
  rows.slice(-days).map((r) => ({
    label: new Date(`${r.date}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    value: r.value,
  }));

const hrvPts = computed(() => toPts(hrvSeries.value, 30));
const spo2Pts = computed(() => toPts(spo2Series.value, 30));
const vo2Pts = computed(() => toPts(vo2Series.value, 90));

const meanDisplay = (pts: { value: number }[]) => {
  if (!pts.length) return '—';
  const mean = pts.reduce((s, p) => s + p.value, 0) / pts.length;
  return `${Math.round(mean * 10) / 10} ms`;
};

const hrvLatestDisplay = computed(() => {
  const last = hrvSeries.value[hrvSeries.value.length - 1];
  return last ? `${Math.round(last.value)} ms` : '—';
});
const spo2LatestDisplay = computed(() => {
  const last = spo2Series.value[spo2Series.value.length - 1];
  return last ? `${Math.round(last.value)}%` : '—';
});
const vo2LatestDisplay = computed(() => {
  const last = vo2Series.value[vo2Series.value.length - 1];
  return last ? `${(Math.round(last.value * 10) / 10).toFixed(1)}` : '—';
});
const vo2DeltaDisplay = computed(() => {
  const s = vo2Series.value;
  if (s.length < 2) return '—';
  const delta = s[s.length - 1].value - s[0].value;
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${(Math.round(delta * 10) / 10).toFixed(1)}`;
});

// Latest-day recovery z-score from the shared HRV-ready service (higher HRV = better).
const hrvSignalDisplay = computed(() => {
  if (hrvSeries.value.length < 3) return '—';
  const series = computeRecoverySeries(hrvSeries.value.map((r) => ({ date: r.date, value: r.value })), 'hrv');
  const last = series[series.length - 1];
  if (!last || last.recoveryZ === null) return '—';
  const z = Math.round(last.recoveryZ * 10) / 10;
  return `${z >= 0 ? '+' : ''}${z}σ vs baseline`;
});

const loadData = async () => {
  const [hrv, spo2, vo2] = await Promise.all([
    getHealthMetricDailySeries('hrv', 90),
    getHealthMetricDailySeries('spo2', 90),
    getHealthMetricDailySeries('vo2max', 180),
  ]);
  hrvSeries.value = hrv;
  spo2Series.value = spo2;
  vo2Series.value = vo2;
};

onIonViewWillEnter(loadData);
</script>

<style scoped>
.vitals-content {
  --padding-top: 16px;
  --padding-bottom: 24px;
}

.vitals-shell {
  padding: 16px;
  max-width: 760px;
  margin: 0 auto;
  display: grid;
  gap: 16px;
}

.vitals-card {
  margin: 0;
  border-radius: var(--nt-radius-md);
  background: var(--ion-color-primary);
  color: var(--nt-fg);
  padding: 18px;
}

.card-topline {
  margin-bottom: 14px;
}

.vitals-tiles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.vitals-note {
  margin: 10px 0 0;
  font-size: 0.75rem;
  color: var(--nt-text-dim);
}

@media (min-width: 600px) {
  .vitals-tiles {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
