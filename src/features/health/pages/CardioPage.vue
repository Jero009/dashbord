<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <health-section-tabs />
    </ion-header>
    <ion-content class="cardio-content">
      <div class="cardio-shell">
        <div class="card">
          <div class="card-header">
            <p class="section-kicker">Activity</p>
            <ion-select
              v-model="daysBack"
              interface="action-sheet"
              :interface-options="{ cssClass: 'app-action-sheet' }"
              class="app-select time-select"
              @ionChange="load"
            >
              <ion-select-option :value="7">7 days</ion-select-option>
              <ion-select-option :value="14">14 days</ion-select-option>
              <ion-select-option :value="30">30 days</ion-select-option>
            </ion-select>
          </div>

          <template v-if="!loading && activities.length">
            <div class="tile-grid">
              <div class="tile">
                <span class="tile__label">Sessions</span>
                <strong class="tile__value">{{ activities.length }}</strong>
              </div>
              <div class="tile">
                <span class="tile__label">Total time</span>
                <strong class="tile__value">{{ totalDuration }}m</strong>
              </div>
              <div class="tile">
                <span class="tile__label">Distance</span>
                <strong class="tile__value">{{ totalDistance > 0 ? totalDistance + 'km' : '—' }}</strong>
              </div>
              <div class="tile">
                <span class="tile__label">Calories</span>
                <strong class="tile__value">{{ totalCalories > 0 ? totalCalories : '—' }}</strong>
              </div>
            </div>

            <div class="activity-list">
              <div v-for="(a, i) in activities" :key="i" class="activity-item">
                <span class="type-tag">{{ typeAbbr(a.workoutType) }}</span>
                <div class="activity-info">
                  <strong class="activity-name">{{ typeLabel(a.workoutType) }}</strong>
                  <span class="activity-meta">
                    {{ formatDate(a.startDate) }}<template v-if="a.sourceName"> · {{ a.sourceName }}</template>
                  </span>
                </div>
                <div class="activity-stats">
                  <span class="stat">{{ a.durationMinutes }}m</span>
                  <span v-if="a.distanceKm" class="stat">{{ a.distanceKm }}km</span>
                  <span v-if="a.calories" class="stat">{{ a.calories }}kcal</span>
                </div>
              </div>
            </div>
          </template>

          <p v-else-if="loading" class="empty-copy">Loading...</p>

          <p v-else class="empty-copy">
            No activities found for the past {{ daysBack }} days.
            Make sure Exercise permission is granted in Health Connect settings.
          </p>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonContent, IonSelect, IonSelectOption, onIonViewWillEnter } from '@ionic/vue';
import { ref, computed, onMounted } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import HealthSectionTabs from '@/features/health/components/HealthSectionTabs.vue';
import { getRecentActivities } from '@/shared/health/healthConnect';
import type { ActivitySummary } from '@/shared/health/healthConnect';

const daysBack = ref(14);
const loading = ref(false);
const activities = ref<ActivitySummary[]>([]);

const totalDuration = computed(() => activities.value.reduce((s, a) => s + a.durationMinutes, 0));
const totalDistance = computed(() => {
  const d = activities.value.reduce((s, a) => s + (a.distanceKm ?? 0), 0);
  return Math.round(d * 10) / 10;
});
const totalCalories = computed(() => activities.value.reduce((s, a) => s + (a.calories ?? 0), 0));

const TYPE_LABELS: Record<string, string> = {
  running: 'Running', cycling: 'Cycling', walking: 'Walking',
  swimming: 'Swimming', swimmingPool: 'Pool swim', swimmingOpenWater: 'Open water swim',
  hiking: 'Hiking', yoga: 'Yoga', highIntensityIntervalTraining: 'HIIT',
  strengthTraining: 'Strength', traditionalStrengthTraining: 'Strength',
  functionalStrengthTraining: 'Strength', rowing: 'Rowing', rowingMachine: 'Rowing',
  elliptical: 'Elliptical', stairClimbing: 'Stair climb', stairClimbingMachine: 'Stair climb',
  runningTreadmill: 'Treadmill', bikingStationary: 'Stationary bike',
  crossTraining: 'Cross training', mixedCardio: 'Cardio',
  dance: 'Dance', pilates: 'Pilates', boxing: 'Boxing',
  martialArts: 'Martial arts', tennis: 'Tennis', soccer: 'Soccer',
  basketball: 'Basketball', volleyball: 'Volleyball', other: 'Activity',
};

const TYPE_ABBR: Record<string, string> = {
  running: 'RUN', cycling: 'CYC', walking: 'WALK', swimming: 'SWIM',
  swimmingPool: 'SWIM', swimmingOpenWater: 'SWIM', hiking: 'HIKE',
  yoga: 'YOGA', highIntensityIntervalTraining: 'HIIT',
  strengthTraining: 'STR', traditionalStrengthTraining: 'STR',
  functionalStrengthTraining: 'STR', rowing: 'ROW', rowingMachine: 'ROW',
  elliptical: 'ELLI', stairClimbing: 'STAIR', stairClimbingMachine: 'STAIR',
  runningTreadmill: 'TRDM', bikingStationary: 'BIKE',
  crossTraining: 'XTRN', mixedCardio: 'CRD', dance: 'DANS',
  pilates: 'PIL', boxing: 'BOX', martialArts: 'MA', other: 'ACT',
};

const typeLabel = (t: string) =>
  TYPE_LABELS[t] ?? t.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
const typeAbbr = (t: string) => TYPE_ABBR[t] ?? t.slice(0, 3).toUpperCase();

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const load = async () => {
  loading.value = true;
  activities.value = await getRecentActivities(daysBack.value);
  loading.value = false;
};

onMounted(load);
onIonViewWillEnter(load);
</script>

<style scoped>
.cardio-content {
  --padding-top: 16px;
  --padding-bottom: 24px;
}

.cardio-shell {
  max-width: 760px;
  margin: 0 auto;
  padding: 16px;
  display: grid;
  gap: 16px;
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

.time-select {
  max-width: 110px;
  --padding-start: 8px;
  --padding-end: 8px;
  min-height: auto;
  font-size: 12px;
}

.tile-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  text-align: center;
}

.tile__label {
  font-family: var(--nt-font-head);
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--nt-text-dim);
}

.tile__value {
  font-family: var(--nt-font-display);
  font-size: 1.3rem;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}

.activity-list {
  display: grid;
  gap: 8px;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
}

.type-tag {
  font-family: var(--nt-font-head);
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--nt-text-dim);
  background: rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 3px 7px;
  white-space: nowrap;
  flex-shrink: 0;
}

.activity-info {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 2px;
}

.activity-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
}

.activity-meta {
  font-size: 0.72rem;
  color: var(--nt-text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.activity-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.stat {
  font-family: var(--nt-font-mono);
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.85);
}

.empty-copy {
  margin: 0;
  color: var(--nt-text-dim);
  font-size: 0.9rem;
  line-height: 1.5;
}

@media (min-width: 600px) {
  .tile-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
</style>
