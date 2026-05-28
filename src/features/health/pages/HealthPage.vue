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

        <ion-card class="entry-card">
          <ion-card-header>
            <ion-card-title>Log today</ion-card-title>
            <ion-card-subtitle>Manual entry for now</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <ion-list>
              <ion-item>
                <ion-label position="stacked">Date</ion-label>
                <ion-input v-model="metricDate" type="date"></ion-input>
              </ion-item>
              <ion-item>
                <ion-label position="stacked">Sleep (hours)</ion-label>
                <ion-input v-model="sleepInput" type="number" inputmode="decimal"></ion-input>
              </ion-item>
              <ion-item>
                <ion-label position="stacked">Resting HR (bpm)</ion-label>
                <ion-input v-model="hrInput" type="number" inputmode="numeric"></ion-input>
              </ion-item>
            </ion-list>
            <ion-button expand="block" @click="saveMetrics">Save metrics</ion-button>
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
  IonItem,
  IonLabel,
  IonInput,
  IonList,
  onIonViewWillEnter,
  toastController,
} from '@ionic/vue';
import { computed, ref } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import HealthSectionTabs from '@/features/health/components/HealthSectionTabs.vue';
import {
  addHealthMetric,
  getLatestHealthMetric,
  upsertReadinessScore,
} from '@/shared/db/app_db';
import {
  calculateReadinessScore,
  isHealthConnectAvailable,
  openHealthConnectSettings,
  requestHealthConnectPermissions,
  syncHealthConnectMetrics,
} from '@/shared/health/healthConnect';

const sleepHours = ref<number | null>(null);
const restingHr = ref<number | null>(null);
const syncing = ref(false);

const metricDate = ref(new Date().toISOString().slice(0, 10));
const sleepInput = ref('');
const hrInput = ref('');

const sleepDisplay = computed(() => (sleepHours.value === null ? '—' : `${sleepHours.value.toFixed(1)} h`));
const restingHrDisplay = computed(() => (restingHr.value === null ? '—' : `${restingHr.value} bpm`));

const sleepSubtitle = computed(() => (sleepHours.value === null ? 'No sleep data' : 'Latest night'));
const hrSubtitle = computed(() => (restingHr.value === null ? 'No HR data' : 'Latest reading'));

const healthConnectStatus = computed(() =>
  isHealthConnectAvailable() ? 'Ready to sync Android health data' : 'Health Connect unavailable on web'
);

const loadSummary = async () => {
  const latestSleep = await getLatestHealthMetric('sleep_duration');
  const latestHr = await getLatestHealthMetric('resting_heart_rate');

  sleepHours.value = latestSleep ? Number(latestSleep.value) : null;
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

const saveMetrics = async () => {
  const parsedSleep = sleepInput.value ? Number(sleepInput.value) : null;
  const parsedHr = hrInput.value ? Number(hrInput.value) : null;

  if (parsedSleep === null && parsedHr === null) {
    const toast = await toastController.create({
      message: 'Add at least one metric before saving.',
      duration: 2000,
      color: 'warning',
    });
    await toast.present();
    return;
  }

  if (parsedSleep !== null && !Number.isFinite(parsedSleep)) {
    const toast = await toastController.create({
      message: 'Sleep must be a valid number.',
      duration: 2000,
      color: 'warning',
    });
    await toast.present();
    return;
  }

  if (parsedHr !== null && !Number.isFinite(parsedHr)) {
    const toast = await toastController.create({
      message: 'Resting HR must be a valid number.',
      duration: 2000,
      color: 'warning',
    });
    await toast.present();
    return;
  }

  if (parsedSleep !== null) {
    await addHealthMetric(metricDate.value, 'sleep_duration', parsedSleep, 'hours', 'manual');
  }
  if (parsedHr !== null) {
    await addHealthMetric(metricDate.value, 'resting_heart_rate', parsedHr, 'bpm', 'manual');
  }

  const baselineScore = calculateReadinessScore(
    parsedSleep ?? sleepHours.value,
    parsedHr ?? restingHr.value
  );

  if (baselineScore !== null) {
    await upsertReadinessScore(metricDate.value, baselineScore, {
      sleep: parsedSleep ?? sleepHours.value,
      restingHr: parsedHr ?? restingHr.value,
      source: 'manual',
    });
  }

  sleepInput.value = '';
  hrInput.value = '';
  await loadSummary();

  const toast = await toastController.create({
    message: 'Metrics saved.',
    duration: 2000,
    color: 'success',
  });
  await toast.present();
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

.connect-card,
.entry-card {
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
