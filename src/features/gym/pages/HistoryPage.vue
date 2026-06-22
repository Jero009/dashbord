<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title class="title">HISTORY</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="home-content">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">History</ion-title>
        </ion-toolbar>
      </ion-header>
          <ion-refresher slot="fixed" @ionRefresh="handleRefresh($event)">
            <ion-refresher-content></ion-refresher-content>
          </ion-refresher>
          <div class="home-shell">
            <div v-for="w in workouts" :key="w.id">
              <ion-card class="card-template">
                <ion-card-header>
                  <div class="card-header-flex">
                    <div>
                      <ion-card-title>{{ w.name || 'Workout' }}</ion-card-title>
                      <ion-card-subtitle>{{ formatDuration(w.time_start, w.time_end) }}</ion-card-subtitle>
                      <ion-card-subtitle>{{ w.total_kg }} kg</ion-card-subtitle>
                    </div>
                    <ion-button class="button-red" fill="clear" @click="handleDelete(w.id)">Delete</ion-button>
                  </div>
                </ion-card-header>
                <ion-card-content>
                  <ion-list >
                      <ion-item class="exercise-row" v-for="ex in w.exercises" :key="ex.id" button :detail="false" @click="openExercise(ex.exercise_id)">
                        <div class="exercise-copy">
                          <div class="exercise-copy__name">{{ ex.name }}</div>
                          <div class="exercise-copy__stats">{{ ex.set_count }} sets &nbsp; {{ ex.reps }} reps<span v-if="ex.avg_rpe != null" class="exercise-copy__rpe">&nbsp; @{{ ex.avg_rpe }}</span></div>
                          <ion-icon class="exercise-copy__icon" :icon="statsChartOutline"></ion-icon>
                        </div>
                      </ion-item>
                  </ion-list>
                </ion-card-content>
              </ion-card>
            </div>
          </div>
    </ion-content>
  </ion-page>
</template>
<style scoped>
ion-content.home-content {
  --padding-top: 16px;
  --padding-bottom: 24px;
}

.home-shell {
  padding: 16px;
  display: grid;
  gap: 18px;
  max-width: 760px;
  margin: 0 auto;
  width: min(100%, 760px);
  justify-items: stretch;
}

.home-shell > div {
  width: 100%;
}

.card-template {
  border-radius: var(--ion-border-radius, 10px);
  background: var(--ion-card-background);
  color: var(--ion-card-color);
  margin: 0;
  padding: 18px;
  min-height: 120px;
  width: 100%;
  box-shadow: none;
}

.card-header-flex {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.card-template ion-card-title {
  margin: 0;
  color: var(--ion-color-light);
  font-weight: 600;
}

.card-template ion-card-subtitle {
  color: rgba(var(--nt-ink), 0.58);
  margin-top: 6px;
  display: block;
}



.card-template ion-card-content {
  background: transparent;
  padding: 0;
}

.card-template ion-list {
  background: transparent;
  padding: 0;
}

.card-template ion-list ion-item {
  background: transparent;
  margin-top: 8px;
  padding: 0;
}

.card-template ion-list ion-item.exercise-row {
  --background: rgba(var(--nt-ink), 0.035);
  --border-radius: 8px;
  --inner-border-width: 0px;
  --box-shadow: none;
  border: none;
  box-shadow: none;
  padding: 8px 12px;
  width: 100%;
}

.card-template ion-list ion-item .exercise-copy {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  color: var(--ion-color-light);
  width: 100%;
}

.exercise-copy__name {
  flex: 1;
  text-align: left;
}

.exercise-copy__stats {
  flex-shrink: 0;
  text-align: right;
  color: rgba(var(--nt-ink), 0.84);
}

.exercise-copy__rpe {
  color: var(--nt-text-dim);
  font-size: 0.8em;
}

.exercise-copy__icon {
  flex-shrink: 0;
  font-size: 16px;
  color: rgba(var(--nt-ink), 0.4);
}

@media (min-width: 700px) {
  .home-shell {
    max-width: 760px;
    margin: 0 auto;
    padding: 20px;
  }

  .card-template {
    padding: 24px;
  }
}
</style>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent,IonCard,IonCardHeader,IonCardContent,IonCardSubtitle,IonCardTitle,IonList,IonItem,IonIcon,
IonRefresher, IonRefresherContent, RefresherCustomEvent, onIonViewWillEnter, IonButton, alertController } from '@ionic/vue';
import { statsChartOutline } from 'ionicons/icons';
import { getWorkouts,getWorkoutHistoryExercises, cancelWorkout } from '@/shared/db/app_db'
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { hapticLight } from '@/shared/utils/haptics';
import type { WorkoutHistory, WorkoutHistoryExercise } from '@/features/gym/types/models';

const router = useRouter();

const openExercise = (exerciseId: number) => {
  if (!exerciseId) return;
  hapticLight();
  router.push(`/exercise/${exerciseId}`);
};



const workouts = ref<(WorkoutHistory & { exercises: WorkoutHistoryExercise[] })[]>([]);


const LoadHistory = async () => {
  const data = await getWorkouts();
  const exercisesPerWorkout = await Promise.all(
    data.map((workout: any) => getWorkoutHistoryExercises(workout.id))
  );
  for (let i = 0; i < data.length; i++) {
    data[i].exercises = exercisesPerWorkout[i];
  }
  workouts.value = data;
};
//time calculation
const toTimestamp = (value: unknown): number => {
  if (value === null || value === undefined) return NaN;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }

  const raw = String(value).trim();
  if (!raw) return NaN;

  const numeric = Number(raw);
  if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
    return numeric;
  }

  const normalized = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
  const hasTimezone = /(?:Z|[-+]\d{2}:?\d{2})$/i.test(normalized);
  const candidate = hasTimezone ? normalized : `${normalized}Z`;

  return new Date(candidate).getTime();
};

const formatDuration = (start: string, end: any) => {
  if (!start || !end) return '0h 0m 0s';

  const s = toTimestamp(start);
  const e = toTimestamp(end);

  if (isNaN(s) || isNaN(e)) return 'Invalid time';

  const diff = Math.max(0, e - s);
  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}h ${minutes}m ${seconds}s`;
};
//refresh 

 const handleRefresh = async  (event: RefresherCustomEvent) => {
   await LoadHistory()
   event.target.complete();
  };

const handleDelete = async (id: number) => {
  const alert = await alertController.create({
    header: 'Delete Workout?',
    message: 'Delete this workout from history?',
    cssClass: 'app-confirm-alert',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Delete',
        role: 'destructive',
        handler: async () => {
          await cancelWorkout(id);
          await LoadHistory();
        }
      }
    ]
  });

  await alert.present();
};

  onIonViewWillEnter(() => {
    LoadHistory();
  });

</script>
