<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title slot="start" class="title">Workout</ion-title>
        <div class="timer">{{ formatTime() }}</div>
        <ion-buttons slot="end">
          <ion-button class="button-red" @click="saveWorkout">stop</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Workout</ion-title>
        </ion-toolbar>
      </ion-header>

      <div class="exercises-list">
        <div v-for="(ex, index) in workoutExercises" :key="ex.id" class="exercise-sliding-item">
          <ion-card class="exercise-card">
            <ion-card-header>
              <div class="exercise-header">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <div class="reorder-buttons">
                    <ion-button
                      fill="clear"
                      size="small"
                      @click="moveExerciseUp(index)"
                      :disabled="index === 0"
                      class="reorder-btn">
                      <ion-icon :icon="chevronUpOutline"></ion-icon>
                    </ion-button>
                    <ion-button
                      fill="clear"
                      size="small"
                      @click="moveExerciseDown(index)"
                      :disabled="index === workoutExercises.length - 1"
                      class="reorder-btn">
                      <ion-icon :icon="chevronDownOutline"></ion-icon>
                    </ion-button>
                  </div>
                  <ion-card-title>{{ ex.name }}</ion-card-title>
                  <ion-button
                    fill="clear"
                    size="small"
                    class="stats-btn"
                    @click="openExerciseStats(ex)">
                    <ion-icon :icon="statsChartOutline"></ion-icon>
                  </ion-button>
                  <p v-if="overloadHint(ex)" class="overload-hint">{{ overloadHint(ex) }}</p>
                </div>
                    <div class="rest-settings" @click="editRestTime(ex)">
                      <ion-icon :icon="timerOutline"></ion-icon>
                      <span>{{ ex.rest_seconds }}s</span>
                    </div>
                  </div>
                </ion-card-header>
                <ion-card-content>
                  <div class="set-cols-header">
                    <span class="col-label col-prev-lbl">PREV</span>
                    <span class="col-label">KG</span>
                    <span class="col-label">REPS</span>
                  </div>
                  <ion-item-sliding class="set-sliding" v-for="set in ex.sets" :key="set.id">
                    <ion-item lines="none" class="set">
                      <ion-checkbox slot="start" v-model="set.completed" @ionChange="(ev) => handleSetChange(ex, set, ev)" class="checkbox"></ion-checkbox>
                      <div class="prev-col">
                        <span class="prev-val" v-if="(set.previous_weight ?? 0) > 0">{{ set.previous_weight }}<span class="prev-x">×</span>{{ set.previous_reps }}</span>
                        <span class="prev-val prev-none" v-else>—</span>
                      </div>
                      <div class="input-container metric-field">
                        <ion-input fill="outline" type="number" :placeholder="getWeightPlaceholder(ex, set)" v-model.number="set.weight" @ionBlur="saveSet(set)" class="input-small"></ion-input>
                        <span class="unit">Kg</span>
                      </div>
                      <div class="input-container metric-field">
                        <ion-input fill="outline" type="number" :placeholder="getRepsPlaceholder(ex, set)" v-model.number="set.reps" @ionBlur="saveSet(set)" class="input-small"></ion-input>
                        <span class="unit">reps</span>
                      </div>
                    </ion-item>
                    <ion-item-options side="end">
                      <ion-item-option color="danger" @click="handleRemoveSet(ex.id, set.id)">
                        Remove
                      </ion-item-option>
                    </ion-item-options>
                  </ion-item-sliding>

                  <!-- Add Set Button -->
                  <ion-button  expand="block" fill="outline" @click="addNewSet(ex)" class="add-set-btn">
                    <ion-icon class="add-set-icon" :icon="addOutline"></ion-icon>
                    Add Set
                  </ion-button>
                </ion-card-content>
          </ion-card>
        </div>
      </div>

      <!-- Add Exercise Button -->
      <div class="add-exercise-container">
        <ion-button expand="block" @click="addNewExercise" class="add-exercise-btn">
          <ion-icon slot="start" :icon="addCircleOutline"></ion-icon>
          Add Exercise
        </ion-button>
      </div>

      <div class="cancel-container">
        <ion-button class="button-red" expand="block" fill="outline" @click="handleCancelWorkout">Cancel Workout</ion-button>
      </div>

    </ion-content>

    <!-- Rest Timer Overlay -->
    <div v-if="restTimer.isActive" class="rest-timer-overlay">
      <div class="rest-timer-content">
        <div class="rest-timer-info">
          <span class="rest-label">Resting</span>
          <span class="rest-time">{{ formatRestTime(restTimer.remaining) }}</span>
        </div>
        <div class="rest-timer-controls">
          <ion-button fill="clear" color="light" @click="adjustRestTimer(-15)">
            -15s
          </ion-button>
          <ion-button fill="clear" color="light" @click="adjustRestTimer(15)">
            +15s
          </ion-button>
          <ion-button fill="solid" color="danger" @click.stop="onSkipRestTimer" class="skip-btn">
            Skip
          </ion-button>
        </div>
      </div>
      <div class="rest-progress-bar" :style="{ width: restProgress + '%' }"></div>
    </div>
  </ion-page>
</template>
<style>
/*top bar*/
.timer {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-family: 'Doto', sans-serif;
  color: rgb(215, 26, 33);
  pointer-events: none;
}
.title {
  margin-left: 10px;
}
.btn-quickstart {
  --background: var(--ion-color-accent-red);
  --background-activated: rgb(178, 19, 25);
  --color: var(--ion-color-light);
  --color-activated: var(--ion-color-light);
  border-radius: 8px;
  padding: 0 16px;
}
/* exercise cards */
.exercise-card{
  width: 100%;
  margin: 18px auto;
  border-radius: var(--nt-radius-md);
  background: var(--ion-color-primary);
  box-shadow: none;
  transition: background-color 150ms ease;
  position: relative;
}

.exercise-card:hover {
  background: var(--nt-surface-2);
}

.exercise-card:active {
  background: var(--nt-surface-2);
}

.exercise-sliding-item {
  margin: 0 10px;
  background-color: transparent;
}

.exercise-slide-host {
  --background: transparent;
  --padding-start: 0;
  --inner-padding-end: 0;
  --inner-border-width: 0;
}
.exercise-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color:var(--ion-color-light);
  gap: 10px;
}
.overload-hint {
  margin: 2px 0 0;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
}

.rest-settings {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.08);
  padding: 10px 12px;
  border-radius: 999px;
  font-size: 0.9rem;
  color: var(--ion-color-light);
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: none;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.rest-settings:active {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
}
.set{
  width: 100%;
  padding: 14px;
  border-radius: 10px;
  margin-bottom: 6px;
  --background: transparent;
  --inner-border-width: 0;
  --inner-padding-end: 0;
  --padding-start: 0;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.set-sliding {
  margin-bottom: 6px;
  --background: transparent;
  background: transparent;
}

.set-cols-header {
  display: flex;
  align-items: center;
  padding: 0 0 4px 48px;
}
.col-label {
  flex: 1;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: rgba(255, 255, 255, 0.3);
  font-family: var(--nt-font-head);
  text-align: center;
}
.col-prev-lbl {
  flex: none;
  width: 72px;
  text-align: center;
}

.prev-col {
  width: 72px;
  flex: none;
  display: flex;
  justify-content: center;
  align-items: center;
}
.prev-val {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.4);
  font-family: var(--nt-font-mono);
  white-space: nowrap;
}
.prev-x {
  color: rgba(255, 255, 255, 0.2);
  margin: 0 1px;
}
.prev-none {
  color: rgba(255, 255, 255, 0.2);
  font-family: var(--nt-font-body);
}
.input-small {
  width: 100%;
  height: 54px;
  --padding-start: 0;
  --padding-end: 0;
  --background: rgba(255, 255, 255, 0.06);
  --border-color: rgba(255, 255, 255, 0.1);
  --border-radius: 8px;
  text-align: center;
  --placeholder-color: rgba(255, 255, 255, 0.35);
  --placeholder-opacity: 1;
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--ion-color-light);
}
.input-container {
  display: flex;
  align-items: center;
  gap: 6px;
}

.metric-field {
  position: relative;
  flex: 1;
  max-width: 160px;
}

.metric-field .unit {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
  pointer-events: none;
}

.checkbox {
  --size: 28px;
  --checkmark-width: 4px;
  --border-color: var(--ion-color-accent-red);
  --border-color-checked: var(--ion-color-accent-red);
  --checkbox-background: transparent;
  --checkbox-background-checked: var(--ion-color-accent-red);
  --border-radius: 8px;
}

.cancel-container {
  padding: 16px;
  margin-top: 18px;
  margin-bottom: 18px;
}

.add-exercise-container {
  padding: 16px;
  padding-top: 10px;
}

.add-exercise-btn {
  --background: var(--ion-color-accent-red) !important;
  --background-activated: rgb(178, 19, 25) !important;
  --color: var(--ion-color-light) !important;
  --color-activated: var(--ion-color-light) !important;
  --border-radius: 8px;
  font-weight: 600;
}

.add-set-btn {
  background: var(--ion-color-primary);
  margin-top: 10px;
  --border-radius: 8px;
  color: rgba(255, 255, 255, 0.85);
}

.add-set-icon {
  color: var(--ion-color-accent-red);
}

/* Rest Timer Overlay */
.rest-timer-overlay {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 56px);
  left: 0;
  right: 0;
  background: var(--ion-color-primary);
  color: white;
  padding: 16px 18px 14px;
  z-index: 9999;
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.rest-timer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.rest-timer-info {
  display: flex;
  flex-direction: column;
}

.rest-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
}

.rest-time {
  font-size: 1.8rem;
  font-weight: 700;
  font-family: 'Doto', sans-serif;
  color: rgb(215, 26, 33);
}

.rest-timer-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.skip-btn {
  --border-radius: 8px;
  font-weight: 600;
}

.rest-timer-controls ion-button {
  --border-radius: 999px;
  font-family: Doto;
}

.rest-progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 4px;
  background: rgb(215, 26, 33);
}

.reorder-buttons {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-right: 4px;
}

.reorder-btn {
  --padding-start: 2px;
  --padding-end: 2px;
  min-width: 40px;
  height: 24px;
}

.reorder-btn ion-icon {
  font-size: 20px;
  color: var(--ion-color-accent-red);
}

.reorder-btn:disabled {
  opacity: 0.4;
  pointer-events: none;
}

.stats-btn {
  --padding-start: 4px;
  --padding-end: 4px;
  margin: 0;
  height: 28px;
}

.stats-btn ion-icon {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.5);
}

ion-toast.pr-toast {
  --background: var(--nt-surface-2);
  --color: #fff;
  --border-radius: var(--nt-radius-md);
  font-family: var(--nt-font-head);
}

ion-toast.pr-toast::part(header) {
  color: var(--ion-color-accent-red);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.78rem;
}

</style>
<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent,IonButtons,IonButton,IonCard,IonCardHeader,IonCardContent,IonCheckbox,IonInput,IonCardTitle,onIonViewWillEnter, alertController, IonIcon, IonItemSliding, IonItemOptions, IonItemOption, IonItem, modalController } from '@ionic/vue';
import { ref, onUnmounted, computed } from 'vue';
import { useRouter,useRoute } from 'vue-router';
import { addCircleOutline, addOutline, timerOutline, chevronUpOutline, chevronDownOutline, statsChartOutline } from 'ionicons/icons';
import type { WorkoutExercise } from '@/features/gym/types/models';
import { normalizeDateInput } from '@/shared/utils/timeFormat';
import TimerDial from '@/features/gym/components/TimerDial.vue';
import WorkoutSummaryModal from '@/features/gym/components/WorkoutSummaryModal.vue';
import { hapticHeavy, hapticLight, hapticMedium, hapticSuccess } from '@/shared/utils/haptics';
import { duckAndDing, showRestNotification, clearRestNotification } from '@/shared/utils/restTimerAudio';
import { scheduleRestTimerDing, cancelRestTimerDing } from '@/shared/utils/notifications';

import { getWorkoutExercises,getWorkoutSets,updateWorkoutSet,getWorkoutById,endWorkout,cancelWorkout, addSetToWorkoutExercise, getNextSetNumber, deleteWorkoutSet, deleteWorkoutExercise, getLatestCompletedSetsForExercise, updateWorkoutExerciseOrder, updateExerciseRestSeconds, getLatestBodyWeight } from '@/shared/db/app_db';

const router = useRouter();
// id from route
const route = useRoute();
const workoutId = Number(route.params.id);

// exercise data 

const workoutExercises = ref<WorkoutExercise[]>([]);


const loadWorkout = async () => {
  const workout = await getWorkoutById(workoutId);
  if (!workout) {
    router.replace('/tabs/Home');
    return;
  }
  startTime.value = normalizeDateInput(workout.time_start);

  const data = await getWorkoutExercises(workoutId);
  const bodyWeight = await getLatestBodyWeight();

  const [setsArray, previousSetsArray] = await Promise.all([
    Promise.all(data.map((ex: any) => getWorkoutSets(ex.id))),
    Promise.all(data.map((ex: any) => getLatestCompletedSetsForExercise(ex.exercise_id, workoutId))),
  ]);

  for (let i = 0; i < data.length; i++) {
    const isBodyweight = data[i].equipment === 'bodyweight';
    const bw = isBodyweight && bodyWeight ? bodyWeight : 0;
    const previousSetByNumber = new Map<number, any>(
      previousSetsArray[i].map((row: any) => [Number(row.set_number), row])
    );
    data[i].sets = setsArray[i].map((s: any) => {
      const storedWeight = Number(s.weight) || 0;
      const prevWeight = Number(previousSetByNumber.get(Number(s.set_number))?.weight) || 0;
      return {
        ...s,
        completed: !!s.completed,
        weight: storedWeight > 0 ? storedWeight : bw,
        previous_weight: prevWeight > 0 ? prevWeight : bw,
        previous_reps: Number(previousSetByNumber.get(Number(s.set_number))?.reps) || 0,
      };
    });
  }

  workoutExercises.value = data;
};

const moveExerciseUp = async (index: number) => {
  if (index === 0) return;
  await swapExercises(index, index - 1);
};

const moveExerciseDown = async (index: number) => {
  if (index === workoutExercises.value.length - 1) return;
  await swapExercises(index, index + 1);
};

const swapExercises = async (index1: number, index2: number) => {
  // Swap in UI
  [workoutExercises.value[index1], workoutExercises.value[index2]] =
  [workoutExercises.value[index2], workoutExercises.value[index1]];

  // Update ALL order_index values to ensure DB consistency
  for (let i = 0; i < workoutExercises.value.length; i++) {
    await updateWorkoutExerciseOrder(workoutExercises.value[i].id, i);
  }
};

// saving

const saveSet = async (set: any) => {
  await updateWorkoutSet(
  set.id,
  set.reps,
  set.weight,
  set.completed
);
};

const handleSetChange = async (exercise: any, set: any, event?: CustomEvent) => {
  const checked = (event as any)?.detail?.checked;
  const isChecked = typeof checked === 'boolean' ? checked : !!set.completed;
  set.completed = isChecked;
  hapticMedium();

  if (isChecked) {
    startRestTimer(Number(exercise.rest_seconds) || 60, exercise.name || '');
  } else {
    stopRestTimer();
    clearTimerState();
  }

  try {
    await saveSet(set);
  } catch (error) {
    console.error('Failed to save set state:', error);
  }
};

const editRestTime = async (exercise: any) => {
  const modal = await modalController.create({
    component: TimerDial,
    componentProps: {
      initialValue: exercise.rest_seconds || 60
    },
    cssClass: 'timer-dial-modal',
    breakpoints: [0, 0.5, 1],
    initialBreakpoint: 0.9,
  });

  await modal.present();

  const { data, role } = await modal.onDidDismiss();
  
  if (role === 'confirm' && data !== undefined) {
    exercise.rest_seconds = Number(data);
    await updateExerciseRestSeconds(Number(exercise.exercise_id), Number(data));
  }
};

const saveWorkout = async () => {
  hapticHeavy();
  const alert = await alertController.create({
    header: 'End Workout?',
    message: 'This will save the workout and return you to the home screen.',
    cssClass: 'app-confirm-alert',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'End Workout',
        role: 'destructive',
        handler: async () => {
          hapticSuccess();
          const achievedPRs = await endWorkout(workoutId);
          const durationStr = formatTime();
          if (interval) clearInterval(interval);
          interval = null;
          if (restInterval) clearInterval(restInterval);
          restInterval = null;
          clearTimerState();

          const completedSets = workoutExercises.value.flatMap(ex =>
            (ex.sets || []).filter((s: any) => s.completed)
          );
          const totalVolume = completedSets.reduce(
            (sum: number, s: any) => sum + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0
          );

          const modal = await modalController.create({
            component: WorkoutSummaryModal,
            componentProps: {
              duration: durationStr,
              totalVolume,
              exerciseCount: workoutExercises.value.length,
              setCount: completedSets.length,
              prs: achievedPRs,
            },
          });
          await modal.present();
          await modal.onDidDismiss();
          router.push('/tabs/Home');
        }
      }
    ]
  });

  await alert.present();
};

const handleCancelWorkout = async () => {
  const alert = await alertController.create({
    header: 'Cancel Workout?',
    message: 'Are you sure you want to cancel? This workout will not be saved.',
    cssClass: 'app-confirm-alert',
    buttons: [
      { text: 'No', role: 'cancel' },
      {
        text: 'Yes, Cancel',
        role: 'confirm',
        handler: async () => {
          await cancelWorkout(workoutId);
          if (interval) clearInterval(interval);
          interval = null;
          if (restInterval) clearInterval(restInterval);
          restInterval = null;
          clearTimerState();
          router.push('/tabs/Home');
        }
      }
    ]
  });

  await alert.present();
};

const handleRemoveSet = async (workoutExerciseId: number, setId: number) => {
  const alert = await alertController.create({
    header: 'Remove Set?',
    message: 'This will remove only this set from the exercise.',
    cssClass: 'app-confirm-alert',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Remove',
        role: 'destructive',
        handler: async () => {
          await deleteWorkoutSet(Number(setId));

          const currentExercise = workoutExercises.value.find(
            (ex) => Number(ex.id) === Number(workoutExerciseId)
          );
          if (!currentExercise) return;

          const updatedSets = (currentExercise.sets || [])
            .filter((set: any) => Number(set.id) !== Number(setId))
            .map((set: any, index: number) => ({
              ...set,
              set_number: index + 1
            }));

          if (updatedSets.length === 0) {
            await deleteWorkoutExercise(Number(workoutExerciseId));
            workoutExercises.value = workoutExercises.value.filter(
              (ex) => Number(ex.id) !== Number(workoutExerciseId)
            );
            return;
          }

          workoutExercises.value = workoutExercises.value.map((ex) => {
            if (Number(ex.id) !== Number(workoutExerciseId)) return ex;
            return {
              ...ex,
              sets: updatedSets
            };
          });
        }
      }
    ]
  });

  await alert.present();
};

// Open the exercise detail page (PRs, strength + volume charts)
const openExerciseStats = (exercise: any) => {
  hapticLight();
  router.push(`/exercise/${exercise.exercise_id}`);
};

// Add new exercise to workout
const addNewExercise = async () => {
  router.push({
    name: 'ExercisePicker',
    query: { workoutId: workoutId.toString() }
  });
};

// Add new set to existing exercise
const addNewSet = async (exercise: any) => {
  hapticLight();
  const nextSetNum = await getNextSetNumber(exercise.id);
  const previousSets = await getLatestCompletedSetsForExercise(exercise.exercise_id, workoutId);
  
  let defaultReps = 10;
  let defaultWeight = 0;
  let prevWeight = 0;
  let prevReps = 0;

  if (previousSets.length > 0) {
    const prevSet = previousSets.find((s: any) => Number(s.set_number) === nextSetNum) || previousSets[previousSets.length - 1];
    defaultReps = prevSet.reps;
    defaultWeight = prevSet.weight;
    prevWeight = Number(prevSet.weight) || 0;
    prevReps = Number(prevSet.reps) || 0;
  }

  const newSetId = await addSetToWorkoutExercise(
    exercise.id,
    nextSetNum,
    defaultReps,
    defaultWeight
  );

  if (newSetId) {
    // Add the new set directly to the exercise's sets array
    const ex = workoutExercises.value.find(e => e.id === exercise.id);
    if (ex) {
      if (!ex.sets) ex.sets = [];
      ex.sets.push({
        id: newSetId,
        set_number: nextSetNum,
        reps: defaultReps,
        weight: defaultWeight,
        completed: false,
        previous_weight: prevWeight,
        previous_reps: prevReps,
      });
    }
  }
};

const overloadHint = (exercise: any): string => {
  const sets: any[] = exercise?.sets ?? [];
  const maxWeight = Math.max(...sets.map((s: any) => Number(s.previous_weight) || 0));
  if (maxWeight <= 0) return '';
  const maxWeightSet = sets.find((s: any) => Number(s.previous_weight) === maxWeight);
  const prevReps = Number(maxWeightSet?.previous_reps) || 0;
  const suggested = Math.round((maxWeight * 1.025) / 2.5) * 2.5;
  return `Last: ${maxWeight} kg × ${prevReps} — try ${suggested} kg`;
};

const getSetPlaceholder = (exercise: any, currentSet: any, field: 'weight' | 'reps', fallback: string): string => {
  const prevKey = field === 'weight' ? 'previous_weight' : 'previous_reps';
  const previousValue = Number(currentSet?.[prevKey]);
  if (previousValue > 0) return String(previousValue);

  const sets: any[] = exercise?.sets || [];
  const currentIndex = sets.findIndex((set: any) => Number(set.id) === Number(currentSet.id));
  if (currentIndex > 0) {
    for (let i = currentIndex - 1; i >= 0; i--) {
      const v = Number(sets[i]?.[field]);
      if (v > 0) return String(v);
    }
  }
  return fallback;
};

const getWeightPlaceholder = (exercise: any, currentSet: any) => getSetPlaceholder(exercise, currentSet, 'weight', 'kg');
const getRepsPlaceholder = (exercise: any, currentSet: any) => getSetPlaceholder(exercise, currentSet, 'reps', 'reps');

//timer 
const startTime = ref<string | null>(null);
const seconds = ref(0);
let interval: any = null;

const startTimer = () => {
  if (!startTime.value || interval) return;
  interval = setInterval(() => {
    const start = new Date(startTime.value!).getTime();
    const now = Date.now();
    seconds.value = Math.max(0, Math.floor((now - start) / 1000));
  }, 1000);
};
const formatTime = () => {
  const hrs = Math.floor(seconds.value / 3600);
  const mins = Math.floor((seconds.value % 3600) / 60);
  const secs = seconds.value % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// Rest Timer
//
// Persistence model: the canonical state is the wall-clock `endTime`, stored in
// localStorage (NOT sessionStorage — sessionStorage is wiped when the app process
// is killed, so the timer would vanish on a full close). The JS interval is only
// for the on-screen countdown; "done" is derived from endTime so the timer stays
// correct even if the interval is throttled while backgrounded.
//
// Ding model: when the set is completed we schedule an OS-level local
// notification at endTime, so the ding fires reliably even if the app is fully
// closed (a JS timer/Web Audio beep can't run then). If the app is still alive
// when the timer ends, we instead play the in-app ducked ding (lowers other
// audio, dings, restores it) and cancel the pending notification so there's no
// double ding.
const REST_TIMER_KEY = 'restTimer';
const restTimer = ref({
  isActive: false,
  remaining: 0,
  total: 0
});
let restInterval: any = null;
let restEndTime = 0;
let restExerciseName = '';
let audioContext: AudioContext | null = null;

// Web-only fallback ding (dev). On native, duckAndDing() handles the sound.
const playBeep = () => {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {
    console.warn('Audio playback failed:', e);
  }
};

// Duck other audio + ding when the rest ends while the app is alive; fall back
// to the Web Audio beep when the native plugin isn't available (web/dev).
const playRestDing = async () => {
  const played = await duckAndDing();
  if (!played) playBeep();
};

const persistTimerState = () => {
  localStorage.setItem(REST_TIMER_KEY, JSON.stringify({ endTime: restEndTime, exerciseName: restExerciseName }));
};

const clearTimerState = () => {
  localStorage.removeItem(REST_TIMER_KEY);
  void cancelRestTimerDing();
  void clearRestNotification();
};

// (Re)post the ongoing countdown notification for the time remaining.
const showRestCountdown = () => {
  const remainingMs = Math.max(0, restEndTime - Date.now());
  if (remainingMs > 0) void showRestNotification(restExerciseName, remainingMs);
};

const tickRestTimer = () => {
  const remaining = Math.max(0, Math.ceil((restEndTime - Date.now()) / 1000));
  restTimer.value.remaining = remaining;
  if (remaining <= 0) {
    // App is alive at the end: ding in-app and cancel the scheduled notification
    // so it doesn't also fire.
    void playRestDing();
    stopRestTimer();
    clearTimerState();
  }
};

const restoreTimerState = () => {
  const saved = localStorage.getItem(REST_TIMER_KEY);
  if (!saved) return;

  try {
    const { endTime, exerciseName } = JSON.parse(saved);
    if (!Number.isFinite(endTime)) { clearTimerState(); return; }
    restExerciseName = typeof exerciseName === 'string' ? exerciseName : '';
    const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    if (remaining > 0) {
      // Resume the running timer; the notification scheduled before the app was
      // closed is still queued in the OS, so don't re-ding here.
      resumeRestTimer(endTime, remaining);
    } else {
      // It already finished while the app was closed — the notification dinged.
      clearTimerState();
    }
  } catch {
    clearTimerState();
  }
};

// Resume a timer from a known endTime without re-scheduling (used on restore).
const resumeRestTimer = (endTime: number, remaining: number) => {
  stopRestTimer();
  restEndTime = endTime;
  restTimer.value.total = remaining;
  restTimer.value.remaining = remaining;
  restTimer.value.isActive = true;
  showRestCountdown();
  restInterval = setInterval(tickRestTimer, 1000);
};

const startRestTimer = (seconds: number, exerciseName = '') => {
  hapticLight();
  // Stop any existing timer before starting a new one
  stopRestTimer();

  // Validate seconds input
  const restSeconds = Math.max(1, Number(seconds) || 60);

  restEndTime = Date.now() + restSeconds * 1000;
  restExerciseName = exerciseName;
  restTimer.value.total = restSeconds;
  restTimer.value.remaining = restSeconds;
  restTimer.value.isActive = true;
  persistTimerState();
  void scheduleRestTimerDing(new Date(restEndTime));
  showRestCountdown();

  restInterval = setInterval(tickRestTimer, 1000);
};

const stopRestTimer = () => {
  if (restInterval) clearInterval(restInterval);
  restInterval = null;
  restTimer.value.isActive = false;
};

const onSkipRestTimer = (event: Event) => {
  event.preventDefault();
  event.stopPropagation();

  // Force immediate UI close before interval cleanup.
  restTimer.value.remaining = 0;
  restTimer.value.total = 0;
  restTimer.value.isActive = false;

  stopRestTimer();
  clearTimerState();
};

const adjustRestTimer = (seconds: number) => {
  if (!restTimer.value.isActive) return;
  restEndTime = Math.max(Date.now(), restEndTime + seconds * 1000);
  restTimer.value.remaining = Math.max(0, Math.ceil((restEndTime - Date.now()) / 1000));
  persistTimerState();
  // Reschedule the OS ding and refresh the countdown notification.
  void scheduleRestTimerDing(new Date(restEndTime));
  showRestCountdown();
};

const formatRestTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const restProgress = computed(() => {
  if (restTimer.value.total === 0) return 0;
  return (restTimer.value.remaining / restTimer.value.total) * 100;
});


onIonViewWillEnter(async () => {
  await loadWorkout();
  startTimer();
  restoreTimerState();
});

onUnmounted(() => {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  if (restInterval) {
    clearInterval(restInterval);
    restInterval = null;
  }
  if (audioContext) {
    void audioContext.close().catch(() => undefined);
    audioContext = null;
  }
});

</script>
