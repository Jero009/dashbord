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
        <p v-if="deloadBanner" class="deload-banner">{{ deloadBanner }}</p>
        <div v-for="(ex, index) in workoutExercises" :key="ex.id" class="exercise-sliding-item">
          <ion-card class="exercise-card">
            <ion-card-header>
              <div class="exercise-header">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <div class="reorder-buttons">
                    <ion-button
                      fill="clear"
                      size="small"
                      aria-label="Move up"
                      @click="moveExerciseUp(index)"
                      :disabled="index === 0"
                      class="reorder-btn">
                      <ion-icon :icon="chevronUpOutline"></ion-icon>
                    </ion-button>
                    <ion-button
                      fill="clear"
                      size="small"
                      aria-label="Move down"
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
                    aria-label="Exercise stats"
                    @click="openExerciseStats(ex)">
                    <ion-icon :icon="statsChartOutline"></ion-icon>
                  </ion-button>
                  <ion-button
                    fill="clear"
                    size="small"
                    class="delete-exercise-btn"
                    aria-label="Remove exercise"
                    @click="handleRemoveExercise(ex)">
                    <ion-icon :icon="trashOutline"></ion-icon>
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
                  <ion-item-sliding class="set-sliding" v-for="set in ex.sets" :key="set.id">
                    <ion-item lines="none" class="set">
                      <ion-checkbox slot="start" v-model="set.completed" @ionChange="(ev) => handleSetChange(ex, set, ev)" class="checkbox"></ion-checkbox>
                      <div class="input-container metric-field">
                        <ion-input fill="outline" type="number" :placeholder="getWeightPlaceholder(ex, set)" v-model.number="set.weight" @ionBlur="saveSet(set)" class="input-small"></ion-input>
                        <span class="unit">Kg</span>
                      </div>
                      <div class="input-container metric-field">
                        <ion-input fill="outline" type="number" :placeholder="getRepsPlaceholder(ex, set)" v-model.number="set.reps" @ionBlur="saveSet(set)" class="input-small"></ion-input>
                        <span class="unit">reps</span>
                      </div>
                      <button class="rpe-chip" :class="{ 'rpe-chip--set': set.rpe != null, 'rpe-chip--prev': set.rpe == null && set.previous_rpe != null }" @click="pickRpe(set)">
                        <span class="rpe-chip__label">{{ getRpeLabel(set) }}</span>
                      </button>
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
                    Add set
                  </ion-button>
                </ion-card-content>
          </ion-card>
        </div>
      </div>

      <!-- Add Exercise Button -->
      <div class="add-exercise-container">
        <ion-button expand="block" @click="addNewExercise" class="add-exercise-btn">
          <ion-icon slot="start" :icon="addCircleOutline"></ion-icon>
          Add exercise
        </ion-button>
      </div>

      <div class="cancel-container">
        <ion-button class="button-red" expand="block" fill="outline" @click="handleCancelWorkout">Cancel</ion-button>
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
  font-family: var(--nt-font-display);
  color: var(--ion-color-accent-red);
  pointer-events: none;
}
.title {
  margin-left: 10px;
}
.btn-quickstart {
  --background: var(--ion-color-accent-red);
  --background-activated: var(--nt-accent-press);
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
  color: rgba(var(--nt-ink), 0.5);
}

.rest-settings {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(var(--nt-ink), 0.08);
  padding: 10px 12px;
  border-radius: 999px;
  font-size: 0.9rem;
  color: var(--ion-color-light);
  cursor: pointer;
  border: 1px solid rgba(var(--nt-ink), 0.1);
  box-shadow: none;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.rest-settings:active {
  background: rgba(var(--nt-ink), 0.08);
  border-color: rgba(var(--nt-ink), 0.12);
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
  background: rgba(var(--nt-ink), 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.set-sliding {
  margin-bottom: 6px;
  --background: transparent;
  background: transparent;
}
.input-small {
  width: 100%;
  height: 54px;
  --padding-start: 0;
  --padding-end: 0;
  --background: rgba(var(--nt-ink), 0.06);
  --border-color: rgba(var(--nt-ink), 0.1);
  --border-radius: 8px;
  text-align: center;
  --placeholder-color: rgba(var(--nt-ink), 0.35);
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

.rpe-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 52px;
  height: 54px;
  padding: 0 12px;
  background: rgba(var(--nt-ink), 0.06);
  border: 1px solid rgba(var(--nt-ink), 0.1);
  border-radius: 8px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 140ms;
}

.rpe-chip:active {
  background: rgba(var(--nt-ink), 0.12);
}

.rpe-chip__label {
  font-family: var(--nt-font-mono);
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(var(--nt-ink), 0.35);
  pointer-events: none;
}

.rpe-chip--set .rpe-chip__label {
  color: var(--nt-fg);
  font-size: 1rem;
}

.rpe-chip--prev .rpe-chip__label {
  font-size: 1rem;
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
  color: rgba(var(--nt-ink), 0.5);
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
  --background-activated: var(--nt-accent-press) !important;
  --color: var(--ion-color-light) !important;
  --color-activated: var(--ion-color-light) !important;
  --border-radius: 8px;
  font-weight: 600;
}

.add-set-btn {
  background: var(--ion-color-primary);
  margin-top: 10px;
  --border-radius: 8px;
  color: rgba(var(--nt-ink), 0.85);
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
  border-bottom: 1px solid rgba(var(--nt-ink), 0.08);
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
  color: rgba(var(--nt-ink), 0.5);
}

.rest-time {
  font-size: 1.8rem;
  font-weight: 700;
  font-family: var(--nt-font-display);
  color: var(--ion-color-accent-red);
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
  font-family: var(--nt-font-display);
}

.rest-progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 4px;
  background: var(--ion-color-accent-red);
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
  color: rgba(var(--nt-ink), 0.5);
}

.delete-exercise-btn {
  --padding-start: 4px;
  --padding-end: 4px;
  margin: 0;
  height: 28px;
}

.delete-exercise-btn ion-icon {
  font-size: 18px;
  color: var(--ion-color-accent-red);
}

ion-toast.pr-toast {
  --background: var(--nt-surface-2);
  --color: var(--nt-fg);
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
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent,IonButtons,IonButton,IonCard,IonCardHeader,IonCardContent,IonCheckbox,IonInput,IonCardTitle,onIonViewWillEnter, alertController, IonIcon, IonItemSliding, IonItemOptions, IonItemOption, IonItem, modalController, toastController, useBackButton } from '@ionic/vue';
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useRouter,useRoute } from 'vue-router';
import { addCircleOutline, addOutline, timerOutline, chevronUpOutline, chevronDownOutline, statsChartOutline, trashOutline } from 'ionicons/icons';
import type { WorkoutExercise } from '@/features/gym/types/models';
import RpePickerModal from '@/features/gym/components/RpePickerModal.vue';
import { normalizeDateInput, formatTime as formatElapsed } from '@/shared/utils/timeFormat';
import TimerDial from '@/features/gym/components/TimerDial.vue';
import WorkoutSummaryModal from '@/features/gym/components/WorkoutSummaryModal.vue';
import { hapticHeavy, hapticLight, hapticMedium, hapticSuccess } from '@/shared/utils/haptics';
import { duckAndDing, showRestNotification } from '@/shared/utils/restTimerAudio';
import { glyphRestDraw, glyphRestEnd, glyphRestStop, glyphRestRelease } from '@/shared/utils/restTimerGlyph';
import { scheduleRestTimerDing } from '@/shared/utils/notifications';
import {
  restTimerState,
  REST_TIMER_KEY,
  startRestTimer,
  cancelRestTimer,
  resumeRestTimer,
  readRestTimerRecord,
  restTimerRemaining,
  stopRestInterval,
} from '@/shared/composables/useRestTimer';

import { getWorkoutExercises,getWorkoutSets,updateWorkoutSet,getWorkoutById,endWorkout,cancelWorkout, addSetToWorkoutExercise, getNextSetNumber, deleteWorkoutSet, deleteWorkoutExercise, getLatestCompletedSetsForExercise, updateWorkoutExerciseOrders, updateExerciseRestSeconds, getLatestBodyWeight, setWorkoutSessionRpe, resequenceWorkoutSetNumbers } from '@/shared/db/app_db';
import { mirrorWorkoutToReceiver } from '@/shared/sync/workoutMirror';
import { formatRestTime } from '@/shared/utils/timeFormat';
import { isDeloadWeek, deloadWeightFor, deloadNotice } from '@/shared/utils/trainingPhase';

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
    const bw = isBodyweight ? (bodyWeight ?? null) : null;
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
        previous_rpe: previousSetByNumber.get(Number(s.set_number))?.rpe ?? null,
        rpe: s.rpe ?? null,
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

  // Update ALL order_index values to ensure DB consistency — one batched transaction
  await updateWorkoutExerciseOrders(
    workoutExercises.value.map((ex, i) => ({ id: ex.id, orderIndex: i }))
  );
};

// saving

const saveSet = async (set: any): Promise<boolean> => {
  try {
    await updateWorkoutSet(
      set.id,
      set.reps,
      set.weight,
      set.completed,
      set.rpe ?? null
    );
    return true;
  } catch (error) {
    console.error('Failed to save set:', error);
    return false;
  }
};

const pickRpe = async (set: any) => {
  hapticLight();
  const modal = await modalController.create({
    component: RpePickerModal,
    componentProps: { current: set.rpe ?? null },
    breakpoints: [0, 0.75, 1],
    initialBreakpoint: 0.75,
    cssClass: 'rpe-picker-modal',
  });
  await modal.present();
  const { data, role } = await modal.onDidDismiss();
  if (role !== 'confirm') return;
  set.rpe = data ?? null;
  await saveSet(set);
};

const handleSetChange = async (exercise: any, set: any, event?: CustomEvent) => {
  const checked = (event as any)?.detail?.checked;
  const isChecked = typeof checked === 'boolean' ? checked : !!set.completed;
  set.completed = isChecked;
  hapticMedium();

  if (isChecked) {
    startRestTimerWithDing(Number(exercise.rest_seconds) || 60, exercise.name || '');
  } else if (restTimer.value.isActive) {
    // Unchecking a set means the rest isn't warranted anymore — stop the timer
    // and cancel the scheduled OS ding instead of letting it ding for nothing.
    onSkipRestTimer(new Event('skip'));
  }

  const ok = await saveSet(set);
  if (!ok) {
    const t = await toastController.create({ message: 'save failed — check the set values', duration: 2000, color: 'danger' });
    await t.present();
  }
};

const editRestTime = async (exercise: any) => {
  const modal = await modalController.create({
    component: TimerDial,
    componentProps: {
      initialValue: exercise.rest_seconds || 60
    },
    cssClass: 'timer-dial-modal',
    breakpoints: [0, 0.9, 1],
    initialBreakpoint: 0.9,
  });

  await modal.present();

  const { data, role } = await modal.onDidDismiss();
  
  if (role === 'confirm' && data !== undefined) {
    exercise.rest_seconds = Number(data);
    await updateExerciseRestSeconds(Number(exercise.exercise_id), Number(data));
  }
};

// Optional post-workout session RPE (1–10) for sRPE training-load tracking.
// Resolves to a clamped number, or null if skipped / invalid.
const promptSessionRpe = async (): Promise<number | null> => {
  let resolveRpe: (value: number | null) => void;
  const result = new Promise<number | null>((resolve) => { resolveRpe = resolve; });
  const alert = await alertController.create({
    header: 'Session RPE',
    message: '1–10, optional',
    cssClass: 'app-confirm-alert',
    inputs: [
      { name: 'rpe', type: 'number', min: 1, max: 10, placeholder: 'RPE 1–10' },
    ],
    buttons: [
      { text: 'Skip', role: 'cancel', handler: () => resolveRpe(null) },
      {
        text: 'Save',
        handler: (data) => {
          const n = Number(data?.rpe);
          if (!Number.isFinite(n) || n <= 0) { resolveRpe(null); return; }
          resolveRpe(Math.min(10, Math.max(1, Math.round(n))));
        },
      },
    ],
  });
  await alert.present();
  alert.onDidDismiss().then(() => resolveRpe(null));
  return result;
};

const saveWorkout = async () => {
  hapticHeavy();
  const alert = await alertController.create({
    header: 'End workout?',
    cssClass: 'app-confirm-alert',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'End',
        role: 'destructive',
        handler: async () => {
          hapticSuccess();
          const sessionRpe = await promptSessionRpe();
          if (sessionRpe != null) await setWorkoutSessionRpe(workoutId, sessionRpe);
          const achievedPRs = await endWorkout(workoutId);
          // Mirror to the receiver (dirty-queued, retried offline) — background
          // concern, must never block or break the end-workout flow.
          void mirrorWorkoutToReceiver(workoutId);
          const durationStr = formatTime();
          if (interval) clearInterval(interval);
          interval = null;
          cancelRestTimer();

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
    header: 'Discard workout?',
    message: "won't be saved",
    cssClass: 'app-confirm-alert',
    buttons: [
      { text: 'Keep', role: 'cancel' },
      {
        text: 'Discard',
        role: 'confirm',
        handler: async () => {
          await cancelWorkout(workoutId);
          if (interval) clearInterval(interval);
          interval = null;
          cancelRestTimer();
          router.push('/tabs/Home');
        }
      }
    ]
  });

  await alert.present();
};

const handleRemoveSet = async (workoutExerciseId: number, setId: number) => {
  const alert = await alertController.create({
    header: 'Remove set?',
    cssClass: 'app-confirm-alert',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Remove',
        role: 'destructive',
        handler: async () => {
          await deleteWorkoutSet(Number(setId));
          await resequenceWorkoutSetNumbers(Number(workoutExerciseId));

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

// Remove an entire exercise (and all its sets) from the workout.
const handleRemoveExercise = async (exercise: any) => {
  const alert = await alertController.create({
    header: 'Remove exercise?',
    message: `removes "${exercise.name}" and its sets`,
    cssClass: 'app-confirm-alert',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Remove',
        role: 'destructive',
        handler: async () => {
          hapticHeavy();
          // workout_exercise_sets cascade-deletes (PRAGMA foreign_keys = ON).
          await deleteWorkoutExercise(Number(exercise.id));
          workoutExercises.value = workoutExercises.value.filter(
            (ex) => Number(ex.id) !== Number(exercise.id)
          );
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
let addingSetInFlight = false;
const addNewSet = async (exercise: any) => {
  if (addingSetInFlight) return;
  addingSetInFlight = true;
  try {
    hapticLight();
    const nextSetNum = await getNextSetNumber(exercise.id);
    const previousSets = await getLatestCompletedSetsForExercise(exercise.exercise_id, workoutId);

    let defaultReps = 10;
    let defaultWeight = 0;

    if (previousSets.length > 0) {
      const prevSet = previousSets.find((s: any) => Number(s.set_number) === nextSetNum) || previousSets[previousSets.length - 1];
      defaultReps = prevSet.reps;
      defaultWeight = prevSet.weight;
      // Deload weeks default new sets to the scaled-down weight, not last
      // time's number — the tap-through default IS the recommendation.
      if (isDeloadWeek()) {
        const deload = deloadWeightFor(Number(prevSet.weight) || 0);
        if (deload) defaultWeight = deload;
      }
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
        rpe: null,
      });
    }
  }
  } finally {
    addingSetInFlight = false;
  }
};

const overloadHint = (exercise: any): string => {
  const sets: any[] = exercise?.sets ?? [];
  const maxWeight = Math.max(...sets.map((s: any) => Number(s.previous_weight) || 0));
  if (maxWeight <= 0) return '';
  const maxWeightSet = sets.find((s: any) => Number(s.previous_weight) === maxWeight);
  const prevReps = Number(maxWeightSet?.previous_reps) || 0;
  // Deload weeks scale the suggestion down instead of suggesting progression.
  if (isDeloadWeek()) {
    const deload = deloadWeightFor(maxWeight);
    return deload ? `Deload — last ${maxWeight} kg × ${prevReps}, work around ${deload} kg` : `Deload week — keep it light`;
  }
  const suggested = Math.round((maxWeight * 1.025) / 2.5) * 2.5;
  return `Last: ${maxWeight} kg × ${prevReps} — try ${suggested} kg`;
};

// True once per workout session (page-lifetime flag): a deload banner on the
// first load is enough — repeating it per-exercise is noise.
const deloadBanner = deloadNotice();

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

const getRpeLabel = (set: any): string => {
  if (set?.rpe != null) return String(set.rpe);
  if (set?.previous_rpe != null) return String(set.previous_rpe);
  return 'RPE';
};

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
const formatTime = () => formatElapsed(seconds.value);

// Rest Timer
//
// The shared state, persistence and cancel paths live in
// `shared/composables/useRestTimer.ts` (all timer readers/writers — this page,
// GymHomePage and HomePage — route through it). This page OWNS the timer: start
// (from set completion), +/−15 s adjust, skip, and foreground expiry. The
// composable's `cancelRestTimer()` clears storage AND the OS ding + countdown
// notification everywhere.
//
// Ding model: when the set is completed we schedule an OS-level local
// notification (AlarmManager-backed exact alarm) at endTime, so the ding fires
// reliably even if the app is fully closed (a JS timer/Web Audio beep can't run
// then). If the app is still alive when the timer ends, we instead play the
// in-app ducked ding (lowers other audio, dings, restores it) and cancel the
// pending notification so there's no double ding.
const restTimer = restTimerState;
let restAppStateListener: { remove: () => Promise<void> } | null = null;
let restVisibilityHandler: (() => void) | null = null;
let restListenersTornDown = false;
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

// (Re)post the ongoing countdown notification for the time remaining.
const showRestCountdown = () => {
  const record = readRestTimerRecord();
  const remainingMs = record ? Math.max(0, record.endTime - Date.now()) : 0;
  if (remainingMs > 0) void showRestNotification(record!.exerciseName, remainingMs);
};

// Foreground expiry: the OS notification covers the closed/backgrounded case,
// so when the app is alive at zero we ding in-app and cancel the scheduled
// notification so it doesn't also fire.
const onRestExpired = () => {
  void playRestDing();
  void glyphRestEnd(); // flash the back matrix, then hand it back
};

const startRestTimerWithDing = (seconds: number, exerciseName = '') => {
  hapticLight();
  stopRestInterval();
  startRestTimer({ seconds, exerciseName, onExpire: onRestExpired });
  void scheduleRestTimerDing(new Date(readRestTimerRecord()!.endTime));
  showRestCountdown();
  void glyphRestDraw(1); // full dial on the Nothing back matrix
};

// Both the on-screen countdown and the Glyph dial are driven by the JS interval,
// which Android throttles/suspends while the app is backgrounded or the screen is
// off — exactly the face-down scenario the Glyph dial is meant for. So both freeze
// while we're away and the end-of-rest branch never runs. On resume, snap them
// back to the canonical wall-clock endTime: finish quietly if it already expired
// (the OS notification already dinged — don't double-ding), else resume ticking.
const resyncRestTimer = () => {
  if (!restTimer.value.isActive) return;
  const record = readRestTimerRecord();
  const remaining = record ? restTimerRemaining(record) : 0;
  if (remaining <= 0) {
    restTimer.value.remaining = 0;
    stopRestInterval();
    void glyphRestStop(); // hand the matrix back (no stale end-flash)
    cancelRestTimer();
  } else {
    restTimer.value.remaining = remaining;
    resumeRestTimer(undefined, onRestExpired);
    void glyphRestDraw(remaining / (restTimer.value.total || remaining));
  }
};

const restoreTimerState = () => {
  // Canonical record already re-armed by startRestTimer/composable; a record
  // that expired while the app was closed just clears (the OS ding fired).
  const record = readRestTimerRecord();
  if (!record) return;
  const remaining = restTimerRemaining(record);
  if (remaining > 0) {
    resumeRestTimer(undefined, onRestExpired);
    void glyphRestDraw(remaining / (restTimer.value.total || remaining));
  } else {
    cancelRestTimer();
  }
};

const onSkipRestTimer = (event: Event) => {
  event.preventDefault();
  event.stopPropagation();

  // Force immediate UI close before interval cleanup.
  restTimer.value.remaining = 0;
  restTimer.value.total = 0;
  restTimer.value.isActive = false;

  stopRestInterval();
  cancelRestTimer();
  void glyphRestStop(); // blank the back matrix
};

const adjustRestTimer = (seconds: number) => {
  if (!restTimer.value.isActive) return;
  const record = readRestTimerRecord();
  if (!record) return;
  const newEndTime = Math.max(Date.now(), record.endTime + seconds * 1000);
  const remaining = restTimerRemaining({ ...record, endTime: newEndTime });
  localStorage.setItem(
    REST_TIMER_KEY,
    JSON.stringify({ endTime: newEndTime, exerciseName: record.exerciseName, total: record.total }),
  );
  restTimer.value.remaining = remaining;
  // Reschedule the OS ding and refresh the countdown notification.
  void scheduleRestTimerDing(new Date(newEndTime));
  showRestCountdown();
  void glyphRestDraw(remaining / (record.total || remaining));
};

const restProgress = computed(() => {
  if (restTimer.value.total === 0) return 0;
  // +30s bumps `total` above what's left of the original bar; clamp so the
  // bar never overflows past full width.
  return Math.min(100, (restTimer.value.remaining / restTimer.value.total) * 100);
});

onIonViewWillEnter(async () => {
  await loadWorkout();
  startTimer();
  restoreTimerState();
});

// Hardware/browser back while a set edit is unsaved: flush pending set saves
// (blurred inputs commit on blur, but a back press can skip the blur) before
// leaving so nothing typed is lost. Registration is torn down automatically
// when the component unmounts.
useBackButton(10, async () => {
  await Promise.all(
    workoutExercises.value.flatMap((ex) =>
      (ex.sets || []).map((s) => saveSet(s))
    )
  );
});

// Re-sync the rest timer when the app returns to the foreground (picked the phone
// back up) — the interval that drives the countdown + Glyph dial is suspended
// while backgrounded/screen-off, so both freeze until we snap them to wall-clock.
onMounted(async () => {
  if (Capacitor.isNativePlatform()) {
    restAppStateListener = await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) resyncRestTimer();
    });
    // addListener is async — if we unmounted while awaiting, remove immediately.
    if (restListenersTornDown) {
      void restAppStateListener.remove();
      restAppStateListener = null;
    }
  } else if (typeof document !== 'undefined') {
    restVisibilityHandler = () => { if (!document.hidden) resyncRestTimer(); };
    document.addEventListener('visibilitychange', restVisibilityHandler);
  }
});

onUnmounted(() => {
  restListenersTornDown = true;
  if (restAppStateListener) {
    void restAppStateListener.remove();
    restAppStateListener = null;
  }
  if (restVisibilityHandler && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', restVisibilityHandler);
    restVisibilityHandler = null;
  }
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  stopRestInterval();
  if (audioContext) {
    void audioContext.close().catch(() => undefined);
    audioContext = null;
  }
  void glyphRestRelease(); // blank + release the Nothing back matrix
});

</script>
