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
            <ion-card-title>Sleep stages</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <div v-if="stageRows.length" class="stage-list">
              <div v-for="stage in stageRows" :key="stage.stage" class="stage-row">
                <span>{{ stage.stage }}</span>
                <strong>{{ stage.minutes }}m</strong>
                <small>{{ Math.round(stage.share * 100) }}%</small>
              </div>
            </div>
            <p v-else class="empty-state">No stage data yet.</p>
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
import type { SleepSummary } from '@/shared/health/healthConnect';
import { getLatestSleepSummary, requestHealthConnectPermissions, syncHealthConnectMetrics } from '@/shared/health/healthConnect';

const syncing = ref(false);
const summary = ref<SleepSummary | null>(null);

const loadSleep = async () => {
  const result = await getLatestSleepSummary();
  summary.value = result.summary ?? null;
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
  display: grid;
  place-items: center;
  text-align: center;
}

.sleep-ring__content strong {
  font-size: 3rem;
  line-height: 1;
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

.empty-state {
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
}

@media (min-width: 760px) {
  .sleep-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
