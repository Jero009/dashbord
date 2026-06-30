<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title class="title">EXERCISES</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Exercises</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>
      <div class="exercise-list-container">
        <ion-searchbar
          v-model="searchQuery"
          class="exercise-search"
          placeholder="Search"
          :debounce="120"
          inputmode="search"
          show-clear-button="focus"
        ></ion-searchbar>
        <ion-select
          v-model="selectedMuscleGroup"
          placeholder="Muscle group"
          interface="action-sheet"
          :interface-options="{ cssClass: 'app-action-sheet' }"
          class="muscle-group-select app-select"
        >
          <ion-select-option value="">All</ion-select-option>
          <ion-select-option v-for="mg in muscleGroups" :key="mg.id" :value="mg.name">
            {{ mg.name }}
          </ion-select-option>
        </ion-select>
        <p v-if="!filteredExercises.length" class="picker-empty">No exercises</p>
        <ion-list class="exercise-list" lines="none">
          <ion-item
            class="exercise-item"
            v-for="ex in filteredExercises"
            :key="ex.id"
            lines="none"
            @click="handleExerciseClick(ex)"
          >
            <div class="exercise-content">
              <div class="exercise-main">
                <div class="exercise-name">{{ ex.name }}</div>
              </div>
            </div>
          </ion-item>
        </ion-list>
      </div>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.exercise-list {
  background: transparent;
}

.exercise-list-container {
  width: 90%;
  margin: auto;
}

.exercise-item {
  margin: 10px auto;
  width: 100%;
  /* Style the ion-item via its own custom props so the rounded surface is a
     single colour — setting `background-color` on the host leaves the inner
     `.item-native` background (square corners) showing through as a 2nd tone. */
  --background: var(--ion-color-primary);
  --background-activated: var(--nt-surface-2);
  --background-hover: var(--nt-surface-2);
  --border-radius: 10px;
  --padding-start: 16px;
  --padding-end: 16px;
  --padding-top: 12px;
  --padding-bottom: 12px;
  --inner-padding-end: 0;
  --min-height: 0;
  cursor: pointer;
}

.exercise-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.exercise-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.exercise-name {
  font-size: 16px;
  font-weight: 500;
  color: var(--ion-color-light);
}

.muscle-group-select {
  margin: auto;
  width: 100%;
}

.exercise-search {
  --background: rgba(255, 255, 255, 0.06);
  --color: #fff;
  --placeholder-color: rgba(255, 255, 255, 0.4);
  --icon-color: rgba(255, 255, 255, 0.4);
  --border-radius: var(--nt-radius-sm);
  --box-shadow: none;
  padding: 0;
  margin-bottom: 8px;
}

.picker-empty {
  margin: 16px auto;
  text-align: center;
  color: var(--nt-text-dim);
  font-size: 0.9rem;
}
</style>

<script setup lang="ts">
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonSearchbar,
  IonRefresher,
  IonRefresherContent,
  onIonViewWillEnter
} from '@ionic/vue';
import type { RefresherCustomEvent } from '@ionic/vue';
import { ref, onMounted, computed } from 'vue';
import type { MuscleGroup } from '@/features/gym/types/models';
import {
  getExercises,
  getMuscleGroups,
  addExerciseToWorkout,
  getNextWorkoutOrderIndex,
  getLatestCompletedSetDefaultsForExercise
} from '@/shared/db/app_db';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();

type exercise = {
  id: number;
  name: string;
  muscle_group: string;
  equipment: string;
};

const exercises = ref<exercise[]>([]);
const selectedMuscleGroup = ref('');
const searchQuery = ref('');
const muscleGroups = ref<MuscleGroup[]>([]);

// Filter by muscle group + free-text name search, then sort by muscle group.
const filteredExercises = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return exercises.value
    .filter((ex) => !selectedMuscleGroup.value || ex.muscle_group === selectedMuscleGroup.value)
    .filter((ex) => !q || ex.name.toLowerCase().includes(q))
    .sort((a, b) => a.muscle_group.localeCompare(b.muscle_group));
});

// Get exercises from db
const LoadExercises = async () => {
  const data = await getExercises();
  exercises.value = data;
};

// Exercise selection - handles both template and workout contexts
const handleExerciseClick = async (exercise: exercise) => {
  const workoutIdQuery = route.query.workoutId;

  try {
    if (workoutIdQuery) {
      const workoutId = Number(workoutIdQuery);
      if (!Number.isFinite(workoutId) || workoutId <= 0) {
        console.error('Invalid workoutId in route query:', workoutIdQuery);
        return;
      }
      // Adding exercise to an active workout
      const orderIndex = await getNextWorkoutOrderIndex(workoutId);
      const defaults = await getLatestCompletedSetDefaultsForExercise(exercise.id, workoutId);
      await addExerciseToWorkout(workoutId, exercise.id, orderIndex, 3, defaults.reps, defaults.weight);

      // Navigate back to the workout page
      await router.push({
        name: 'Workout',
        params: { id: workoutId.toString() }
      });
    } else if (route.query.templateId) {
      localStorage.setItem('selectedExerciseForTemplate', JSON.stringify(exercise));
      await router.push({
        name: 'TemplateEditor',
        params: { id: route.query.templateId.toString() }
      });
    } else if (route.query.from === 'TemplateBuilder') {
      localStorage.setItem('selectedExerciseForTemplate', JSON.stringify(exercise));
      await router.push({ name: 'TemplateBuilder' });
    } else {
      await router.push({
        name: 'ExerciseDetail',
        params: { id: exercise.id.toString() }
      });
    }
  } catch (e) {
    console.error('Failed to select exercise:', e);
  }
};

// Refresh
const handleRefresh = async (event: RefresherCustomEvent) => {
  await LoadExercises();
  event.target.complete();
};

onMounted(() => {
  LoadExercises();
  getMuscleGroups().then((data) => (muscleGroups.value = data));
});

onIonViewWillEnter(() => {
  LoadExercises();
  getMuscleGroups().then((data) => (muscleGroups.value = data));
});
</script>
