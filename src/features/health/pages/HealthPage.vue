<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <health-section-tabs />
    </ion-header>
    <ion-content :fullscreen="true" class="health-content">
      <div class="health-shell">
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

        <ion-card class="connect-card">
          <ion-card-header>
            <ion-card-title>Google Health Connect</ion-card-title>
            <ion-card-subtitle>{{ healthConnectStatus }}</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <ion-button expand="block" :disabled="syncing" @click="handleConnect">
              {{ syncing ? 'Syncing...' : 'Connect Health Connect' }}
            </ion-button>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonHeader,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonButton,
  onIonViewWillEnter,
  toastController,
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
} from '@/shared/health/healthConnect';

const sleepHours = ref<number | null>(null);
const steps = ref<number | null>(null);
const restingHr = ref<number | null>(null);
const syncing = ref(false);

const sleepDisplay = computed(() => (sleepHours.value === null ? '—' : `${sleepHours.value.toFixed(1)} h`));
const stepsDisplay = computed(() => (steps.value === null ? '—' : `${Math.round(steps.value).toLocaleString()}`));
const restingHrDisplay = computed(() => (restingHr.value === null ? '—' : `${restingHr.value} bpm`));

const sleepSubtitle = computed(() => (sleepHours.value === null ? 'No sleep data' : 'Latest night'));
const stepsSubtitle = computed(() => (steps.value === null ? 'No step data' : 'Latest day'));
const hrSubtitle = computed(() => (restingHr.value === null ? 'No HR data' : 'Latest reading'));

const healthConnectStatus = computed(() =>
  isHealthConnectAvailable() ? 'Ready to sync Android health data' : 'Health Connect unavailable on web'
);

const loadSummary = async () => {
  const latestSleep = await getLatestHealthMetric('sleep_duration');
  const latestSteps = await getLatestHealthMetric('steps');
  const latestHr = await getLatestHealthMetric('resting_heart_rate');

  sleepHours.value = latestSleep ? Number(latestSleep.value) : null;
  steps.value = latestSteps ? Number(latestSteps.value) : null;
  restingHr.value = latestHr ? Number(latestHr.value) : null;
};

const handleConnect = async () => {
  syncing.value = true;

  try {
    const result = await requestHealthConnectPermissions();
    if (!result.available) {
      if (isHealthConnectAvailable()) {
        await openHealthConnectSettings();
      }

      const toast = await toastController.create({
        message: result.reason ?? 'Health Connect unavailable.',
        duration: 2200,
        color: 'warning',
      });
      await toast.present();
      return;
    }

    if (!result.granted) {
      const toast = await toastController.create({
        message: 'Health Connect permissions not granted yet.',
        duration: 2200,
        color: 'warning',
      });
      await toast.present();
      return;
    }

    const syncResult = await syncHealthConnectMetrics();
    await loadSummary();

    const toast = await toastController.create({
      message: `Synced ${syncResult.synced} Health Connect records.`,
      duration: 2200,
      color: 'success',
    });
    await toast.present();
  } catch (error) {
    const toast = await toastController.create({
      message: error instanceof Error ? error.message : 'Health Connect unavailable.',
      duration: 2200,
      color: 'danger',
    });
    await toast.present();
  } finally {
    syncing.value = false;
  }
};

onIonViewWillEnter(async () => {
  await loadSummary();
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
}

.summary-grid {
  display: grid;
  gap: 12px;
}

.summary-card {
  margin: 0;
  border-radius: 12px;
  background: var(--ion-color-primary);
}

.metric-value {
  font-size: 1.6rem;
  font-weight: 600;
}

.connect-card {
  margin: 0;
  border-radius: 12px;
  background: var(--ion-color-primary);
}

@media (min-width: 760px) {
  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
