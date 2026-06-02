<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <health-section-tabs />
    </ion-header>
    <ion-content :fullscreen="true" class="health-content">
      <div class="health-shell">

        <!-- Metric summary -->
        <section class="summary-grid">
          <ion-card class="summary-card">
            <ion-card-header>
              <ion-card-title>Sleep</ion-card-title>
              <ion-card-subtitle>{{ sleepSubtitle }}</ion-card-subtitle>
            </ion-card-header>
            <ion-card-content>
              <div class="metric-value">{{ sleepDisplay }}</div>
            </ion-card-content>
          </ion-card>

          <ion-card class="summary-card">
            <ion-card-header>
              <ion-card-title>Resting HR</ion-card-title>
              <ion-card-subtitle>{{ hrSubtitle }}</ion-card-subtitle>
            </ion-card-header>
            <ion-card-content>
              <div class="metric-value">{{ restingHrDisplay }}</div>
            </ion-card-content>
          </ion-card>

          <ion-card class="summary-card">
            <ion-card-header>
              <ion-card-title>Steps</ion-card-title>
              <ion-card-subtitle>{{ stepsSubtitle }}</ion-card-subtitle>
            </ion-card-header>
            <ion-card-content>
              <div class="metric-value">{{ stepsDisplay }}</div>
            </ion-card-content>
          </ion-card>
        </section>

        <!-- Activities from Health Connect -->
        <section v-if="activities.length">
          <p class="section-kicker">Activities · last 7 days</p>
          <div class="activity-list">
            <div v-for="(act, i) in activities" :key="i" class="activity-card">
              <div class="activity-card__icon">{{ workoutInitial(act.workoutType) }}</div>
              <div class="activity-card__body">
                <strong class="activity-card__name">{{ formatWorkoutType(act.workoutType) }}</strong>
                <span class="activity-card__date">{{ formatActivityDate(act.startDate) }}</span>
                <div class="activity-card__metrics">
                  <span>{{ act.durationMinutes }} min</span>
                  <span v-if="act.calories">· {{ act.calories }} kcal</span>
                  <span v-if="act.distanceKm">· {{ act.distanceKm }} km</span>
                </div>
                <span v-if="act.sourceName" class="activity-card__source">{{ act.sourceName }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Connect card -->
        <ion-card class="connect-card">
          <ion-card-header>
            <ion-card-title>Google Health Connect</ion-card-title>
            <ion-card-subtitle>{{ healthConnectStatus }}</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <ion-button expand="block" :disabled="syncing" @click="handleConnect">
              {{ syncing ? 'Syncing...' : 'Sync Health Connect' }}
            </ion-button>
          </ion-card-content>
        </ion-card>

      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonHeader, IonContent, IonCard, IonCardHeader, IonCardTitle,
  IonCardSubtitle, IonCardContent, IonButton, onIonViewWillEnter, toastController,
} from '@ionic/vue';
import { computed, ref } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import HealthSectionTabs from '@/features/health/components/HealthSectionTabs.vue';
import { getLatestHealthMetric } from '@/shared/db/app_db';
import {
  isHealthConnectAvailable,
  openHealthConnectSettings,
  requestHealthConnectPermissions,
  syncHealthConnectMetrics,
  getRecentActivities,
  type ActivitySummary,
} from '@/shared/health/healthConnect';

const sleepHours = ref<number | null>(null);
const steps = ref<number | null>(null);
const restingHr = ref<number | null>(null);
const syncing = ref(false);
const activities = ref<ActivitySummary[]>([]);

const sleepDisplay = computed(() => (sleepHours.value === null ? '—' : `${sleepHours.value.toFixed(1)} h`));
const stepsDisplay = computed(() => (steps.value === null ? '—' : `${Math.round(steps.value).toLocaleString()}`));
const restingHrDisplay = computed(() => (restingHr.value === null ? '—' : `${restingHr.value} bpm`));
const sleepSubtitle = computed(() => (sleepHours.value === null ? 'No sleep data' : 'Latest night'));
const stepsSubtitle = computed(() => (steps.value === null ? 'No step data' : 'Latest day'));
const hrSubtitle = computed(() => (restingHr.value === null ? 'No HR data' : 'Latest reading'));
const healthConnectStatus = computed(() =>
  isHealthConnectAvailable() ? 'Ready to sync Android health data' : 'Health Connect unavailable on web'
);

const formatWorkoutType = (t: string) =>
  t.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();

const workoutInitial = (t: string): string => {
  const label = formatWorkoutType(t);
  return label.slice(0, 2).toUpperCase();
};

const formatActivityDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });

const loadSummary = async () => {
  const [latestSleep, latestSteps, latestHr] = await Promise.all([
    getLatestHealthMetric('sleep_duration'),
    getLatestHealthMetric('steps'),
    getLatestHealthMetric('resting_heart_rate'),
  ]);
  sleepHours.value = latestSleep ? Number(latestSleep.value) : null;
  steps.value = latestSteps ? Number(latestSteps.value) : null;
  restingHr.value = latestHr ? Number(latestHr.value) : null;
};

const loadActivities = async () => {
  activities.value = await getRecentActivities(7);
};

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
    await Promise.all([loadSummary(), loadActivities()]);
    const t = await toastController.create({ message: `Synced ${syncResult.synced} records.`, duration: 2200, color: 'success' });
    await t.present();
  } catch (error) {
    const t = await toastController.create({ message: error instanceof Error ? error.message : 'Health Connect unavailable.', duration: 2200, color: 'danger' });
    await t.present();
  } finally {
    syncing.value = false;
  }
};

onIonViewWillEnter(async () => {
  await Promise.all([loadSummary(), loadActivities()]);
});
</script>

<style scoped>
.health-content {
  --padding-top: 16px;
  --padding-bottom: 24px;
}

.health-shell {
  padding: 16px;
  display: grid;
  gap: 16px;
  max-width: 760px;
  margin: 0 auto;
}

.summary-grid {
  display: grid;
  gap: 12px;
}

.summary-card,
.connect-card {
  margin: 0;
  border-radius: 12px;
  background: var(--ion-color-primary);
}

.metric-value {
  font-size: 1.6rem;
  font-weight: 600;
}

/* Section label */
.section-kicker {
  margin: 0 0 10px;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: rgba(255, 255, 255, 0.45);
}

/* Activity list */
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
}

.activity-card__icon {
  font-size: 1.6rem;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.activity-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.activity-card__name {
  font-size: 0.95rem;
  color: #fff;
}

.activity-card__date {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.45);
}

.activity-card__metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.75);
}

.activity-card__source {
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.3);
  margin-top: 2px;
}

@media (min-width: 760px) {
  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .activity-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
