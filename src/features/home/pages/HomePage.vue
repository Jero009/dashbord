<template>
  <ion-page>
    <ion-header>
      <DashboardTopBar />
    </ion-header>

    <ion-content :fullscreen="true" class="home-content">
      <div class="home-shell">
        <section class="hero-card">
          <div class="hero-card__header">
            <p class="eyebrow">Today</p>
            <h1>Readiness</h1>
            <p class="hero-copy">A daily score based on sleep and resting heart rate.</p>
          </div>

          <div class="hero-card__body">
            <div class="readiness-ring" :style="{ '--score': readinessRatio }">
              <svg viewBox="0 0 120 120" class="readiness-ring__svg" aria-hidden="true">
                <circle class="readiness-ring__track" cx="60" cy="60" r="46"></circle>
                <circle
                  class="readiness-ring__progress"
                  cx="60"
                  cy="60"
                  r="46"
                  :style="{ strokeDashoffset: readinessDashOffset }"
                ></circle>
              </svg>
              <div class="readiness-ring__content">
                <strong>{{ readinessDisplay }}</strong>
                <span v-if="readinessDrainDisplay !== null">-{{ readinessDrainDisplay }} today</span>
                <span v-else>Waiting for data</span>
              </div>
            </div>

            <div class="readiness-meta">
              <div>
                <span>Sleep</span>
                <strong>{{ sleepDisplay }}</strong>
              </div>
              <div>
                <span>Resting HR</span>
                <strong>{{ restingHrDisplay }}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{{ readinessSubtitle }}</strong>
              </div>
            </div>
          </div>
        </section>

        <section class="graph-card">
          <div class="graph-card__header">
            <div>
              <p class="eyebrow">Day curve</p>
              <h2>How it drains</h2>
            </div>
            <span class="graph-card__time">{{ currentTimeLabel }}</span>
          </div>

          <svg viewBox="0 0 100 48" class="graph" role="img" aria-label="Readiness drains through the day">
            <polygon class="graph__area" :points="areaPoints" />
            <polyline class="graph__line" :points="graphPoints" />
            <circle
              v-for="point in graphData"
              :key="point.hour"
              class="graph__dot"
              :cx="point.x"
              :cy="point.y"
              r="1.8"
            />
            <line class="graph__marker" :x1="currentMarkerX" y1="6" :x2="currentMarkerX" y2="42" />
          </svg>

          <div class="graph-labels">
            <span v-for="label in graphLabels" :key="label.hour" :style="{ left: `${label.x}%` }">
              {{ label.text }}
            </span>
          </div>
        </section>

        <section class="quick-grid">
          <ion-card class="quick-card">
            <ion-card-header>
              <ion-card-title>Workout</ion-card-title>
              <ion-card-subtitle>Templates and active sessions</ion-card-subtitle>
            </ion-card-header>
          </ion-card>
          <ion-card class="quick-card">
            <ion-card-header>
              <ion-card-title>Finance</ion-card-title>
              <ion-card-subtitle>Accounts, investments, subscriptions</ion-card-subtitle>
            </ion-card-header>
          </ion-card>
          <ion-card class="quick-card">
            <ion-card-header>
              <ion-card-title>Health</ion-card-title>
              <ion-card-subtitle>Connect sync and manual logs</ion-card-subtitle>
            </ion-card-header>
          </ion-card>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonCard, IonCardHeader, IonCardSubtitle, IonCardTitle, IonContent, IonHeader, IonPage } from '@ionic/vue';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import { getLatestHealthMetric, getLatestReadinessScore, getReadinessScore } from '@/shared/db/app_db';
import { applyReadinessDrain, calculateReadinessScore } from '@/shared/health/healthConnect';

const sleepHours = ref<number | null>(null);
const restingHr = ref<number | null>(null);
const readinessBaselineScore = ref<number | null>(null);
const nowTick = ref(Date.now());
let readinessTimer: ReturnType<typeof setInterval> | null = null;

const currentTimeLabel = computed(() =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(nowTick.value))
);

const effectiveBaselineScore = computed(() => {
  if (readinessBaselineScore.value !== null) {
    return readinessBaselineScore.value;
  }

  if (sleepHours.value === null && restingHr.value === null) {
    return null;
  }

  return calculateReadinessScore(sleepHours.value, restingHr.value);
});

const currentReadinessScore = computed(() => {
  if (effectiveBaselineScore.value === null) {
    return null;
  }

  return applyReadinessDrain(effectiveBaselineScore.value, new Date(nowTick.value));
});

const readinessDisplay = computed(() => {
  const score = currentReadinessScore.value;
  return score === null ? '—' : `${score}`;
});

const readinessRatio = computed(() => {
  const score = currentReadinessScore.value;
  return score === null ? 0 : Math.min(1, score / 100);
});

const readinessDashOffset = computed(() => 289 - 289 * readinessRatio.value);

const readinessDrainDisplay = computed(() => {
  if (effectiveBaselineScore.value === null || currentReadinessScore.value === null) {
    return null;
  }

  return effectiveBaselineScore.value - currentReadinessScore.value;
});

const readinessSubtitle = computed(() => {
  const score = currentReadinessScore.value;
  if (score === null) return 'No data yet';
  if (score >= 80) return 'Ready to push';
  if (score >= 60) return 'Steady day';
  return 'Take it easy';
});

const sleepDisplay = computed(() => (sleepHours.value === null ? '—' : `${sleepHours.value.toFixed(1)} h`));
const restingHrDisplay = computed(() => (restingHr.value === null ? '—' : `${restingHr.value} bpm`));

const graphData = computed(() => {
  const baseline = effectiveBaselineScore.value;
  if (baseline === null) return [];

  const hours = [6, 8, 10, 12, 14, 16, 18, 20, 22];
  return hours.map((hour) => {
    const sampleTime = new Date(nowTick.value);
    sampleTime.setHours(hour, 0, 0, 0);
    const score = applyReadinessDrain(baseline, sampleTime);

    return {
      hour,
      x: ((hour - 6) / 16) * 100,
      y: 44 - (score / 100) * 36,
      score,
    };
  });
});

const graphPoints = computed(() => graphData.value.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' '));

const areaPoints = computed(() => {
  if (!graphData.value.length) return '';
  const end = graphData.value[graphData.value.length - 1];
  return `0,44 ${graphPoints.value} ${end.x.toFixed(2)},44`;
});

const graphLabels = computed(() =>
  graphData.value
    .filter((point) => point.hour % 4 === 2 || point.hour === 6 || point.hour === 22)
    .map((point) => ({
      hour: point.hour,
      x: point.x,
      text: `${point.hour}:00`,
    }))
);

const currentMarkerX = computed(() => {
  const now = new Date(nowTick.value);
  const hour = now.getHours() + now.getMinutes() / 60;
  const bounded = Math.max(6, Math.min(22, hour));
  return ((bounded - 6) / 16) * 100;
});

const loadSummary = async () => {
  const latestSleep = await getLatestHealthMetric('sleep_duration');
  const latestHr = await getLatestHealthMetric('resting_heart_rate');
  const todayReadiness = await getReadinessScore(new Date().toISOString().slice(0, 10));
  const latestReadiness = todayReadiness ?? (await getLatestReadinessScore());

  sleepHours.value = latestSleep ? Number(latestSleep.value) : null;
  restingHr.value = latestHr ? Number(latestHr.value) : null;
  readinessBaselineScore.value = latestReadiness ? Number(latestReadiness.score) : null;
};

onUnmounted(() => {
  if (readinessTimer) {
    clearInterval(readinessTimer);
    readinessTimer = null;
  }
});

onMounted(async () => {
  await loadSummary();
  readinessTimer = setInterval(() => {
    nowTick.value = Date.now();
  }, 60_000);
});
</script>

<style scoped>
.home-content {
  --background: linear-gradient(180deg, #0d0d0d 0%, #151515 100%);
}

.home-shell {
  max-width: 980px;
  margin: 0 auto;
  padding: 1rem 1rem 2rem;
  display: grid;
  gap: 1rem;
}

.hero-card,
.graph-card,
.quick-card {
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: none;
}

.hero-card {
  padding: 1rem;
}

.hero-card__header h1,
.graph-card__header h2,
.quick-card ion-card-title {
  margin: 0;
}

.eyebrow {
  margin: 0 0 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.6);
}

.hero-copy {
  margin: 0.35rem 0 0;
  color: rgba(255, 255, 255, 0.7);
}

.hero-card__body {
  margin-top: 1rem;
  display: grid;
  gap: 1rem;
}

.readiness-ring {
  --score: 0;
  position: relative;
  width: min(100%, 260px);
  aspect-ratio: 1;
  margin: 0 auto;
}

.readiness-ring__svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.readiness-ring__track,
.readiness-ring__progress {
  fill: none;
  stroke-width: 12;
  cx: 60;
  cy: 60;
  r: 46;
}

.readiness-ring__track {
  stroke: rgba(255, 255, 255, 0.08);
}

.readiness-ring__progress {
  stroke: rgb(239, 68, 68);
  stroke-linecap: round;
  stroke-dasharray: 289;
  transition: stroke-dashoffset 300ms linear;
}

.readiness-ring__content {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  text-align: center;
}

.readiness-ring__content strong {
  font-size: 3rem;
  line-height: 1;
}

.readiness-ring__content span {
  color: rgba(255, 255, 255, 0.7);
}

.readiness-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.readiness-meta > div {
  padding: 0.8rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
}

.readiness-meta span,
.graph-card__time {
  display: block;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.55);
}

.graph-card {
  padding: 1rem;
}

.graph-card__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
}

.graph {
  width: 100%;
  height: auto;
  margin-top: 1rem;
  overflow: visible;
}

.graph__area {
  fill: rgba(239, 68, 68, 0.12);
  stroke: none;
}

.graph__line {
  fill: none;
  stroke: rgb(239, 68, 68);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.graph__dot {
  fill: rgb(239, 68, 68);
}

.graph__marker {
  stroke: rgba(255, 255, 255, 0.4);
  stroke-dasharray: 2 2;
}

.graph-labels {
  position: relative;
  height: 1.5rem;
  margin-top: 0.35rem;
}

.graph-labels span {
  position: absolute;
  transform: translateX(-50%);
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.55);
}

.quick-grid {
  display: grid;
  gap: 0.75rem;
}

.quick-card {
  margin: 0;
}

@media (min-width: 760px) {
  .hero-card__body {
    grid-template-columns: 280px 1fr;
    align-items: center;
  }

  .quick-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
