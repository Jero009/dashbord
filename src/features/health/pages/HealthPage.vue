<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <health-section-tabs />
    </ion-header>
    <ion-content :fullscreen="true" class="health-content">
      <div class="health-shell">
        <section class="summary-grid">
          <ion-card class="summary-card readiness-card">
            <ion-card-header>
              <ion-card-title>Readiness</ion-card-title>
              <ion-card-subtitle>{{ readinessSubtitle }}</ion-card-subtitle>
            </ion-card-header>
            <ion-card-content>
              <div class="readiness-score">{{ readinessDisplay }}</div>
              <ion-progress-bar :value="readinessRatio"></ion-progress-bar>
            </ion-card-content>
          </ion-card>

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
            <ion-card-title>Health Connect</ion-card-title>
            <ion-card-subtitle>{{ healthConnectStatus }}</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <ion-button expand="block" @click="handleConnect">Connect Health Connect</ion-button>
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
  IonProgressBar,
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
  getLatestReadinessScore,
  upsertReadinessScore,
} from '@/shared/db/app_db';
import { isHealthConnectAvailable, requestHealthConnectPermissions } from '@/shared/health/healthConnect';

const sleepHours = ref<number | null>(null);
const restingHr = ref<number | null>(null);
const readinessScore = ref<number | null>(null);

const metricDate = ref(new Date().toISOString().slice(0, 10));
const sleepInput = ref('');
const hrInput = ref('');

const readinessDisplay = computed(() => {
  const score = effectiveReadinessScore.value;
  return score === null ? '—' : `${score}/100`;
});

const readinessRatio = computed(() => {
  const score = effectiveReadinessScore.value;
  return score === null ? 0 : Math.min(1, score / 100);
});

const readinessSubtitle = computed(() => {
  if (effectiveReadinessScore.value === null) return 'No data yet';
  if (effectiveReadinessScore.value >= 80) return 'Ready to push';
  if (effectiveReadinessScore.value >= 60) return 'Steady day';
  return 'Take it easy';
});

const sleepDisplay = computed(() => (sleepHours.value === null ? '—' : `${sleepHours.value.toFixed(1)} h`));
const restingHrDisplay = computed(() => (restingHr.value === null ? '—' : `${restingHr.value} bpm`));

const sleepSubtitle = computed(() => (sleepHours.value === null ? 'No sleep data' : 'Latest night'));
const hrSubtitle = computed(() => (restingHr.value === null ? 'No HR data' : 'Latest reading'));

const healthConnectStatus = computed(() =>
  isHealthConnectAvailable() ? 'Android integration pending' : 'Health Connect unavailable on web'
);

const effectiveReadinessScore = computed(() => {
  if (readinessScore.value !== null) return readinessScore.value;
  if (sleepHours.value === null && restingHr.value === null) return null;

  let score = 50;
  if (sleepHours.value !== null) {
    score += Math.min(25, (sleepHours.value / 8) * 25);
  }
  if (restingHr.value !== null) {
    score += Math.max(0, Math.min(25, (70 - restingHr.value) * 1));
  }
  return Math.max(0, Math.min(100, Math.round(score)));
});

const loadSummary = async () => {
  const latestSleep = await getLatestHealthMetric('sleep_duration');
  const latestHr = await getLatestHealthMetric('resting_heart_rate');
  const latestReadiness = await getLatestReadinessScore();

  sleepHours.value = latestSleep ? Number(latestSleep.value) : null;
  restingHr.value = latestHr ? Number(latestHr.value) : null;
  readinessScore.value = latestReadiness ? Number(latestReadiness.score) : null;
};

const handleConnect = async () => {
  try {
    const result = await requestHealthConnectPermissions();
    const toast = await toastController.create({
      message: result.granted ? 'Health Connect permissions granted.' : 'Health Connect permissions not granted yet.',
      duration: 2000,
      color: result.granted ? 'success' : 'warning',
    });
    await toast.present();
  } catch (error) {
    const toast = await toastController.create({
      message: error instanceof Error ? error.message : 'Health Connect unavailable.',
      duration: 2200,
      color: 'danger',
    });
    await toast.present();
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

  if (effectiveReadinessScore.value !== null) {
    await upsertReadinessScore(metricDate.value, effectiveReadinessScore.value, {
      sleep: parsedSleep,
      restingHr: parsedHr,
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

.readiness-card ion-progress-bar {
  margin-top: 12px;
}

.readiness-score,
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
