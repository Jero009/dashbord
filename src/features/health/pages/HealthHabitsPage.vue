<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <health-section-tabs />
    </ion-header>
    <ion-content :fullscreen="true" class="health-content">
      <div class="health-shell">
        <ion-card class="habit-card">
          <ion-card-header>
            <ion-card-title>Habit tracker</ion-card-title>
            <ion-card-subtitle>Stay consistent every day</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <ion-item>
              <ion-label position="stacked">Date</ion-label>
              <ion-input v-model="selectedDate" type="date"></ion-input>
            </ion-item>
          </ion-card-content>
        </ion-card>

        <ion-card class="habit-card">
          <ion-card-header>
            <ion-card-title>Add habit</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list>
              <ion-item>
                <ion-label position="stacked">Habit name</ion-label>
                <ion-input v-model="habitName"></ion-input>
              </ion-item>
              <ion-item>
                <ion-label position="stacked">Frequency</ion-label>
                <ion-select v-model="habitFrequency">
                  <ion-select-option value="daily">Daily</ion-select-option>
                  <ion-select-option value="weekly">Weekly</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item>
                <ion-label position="stacked">Target</ion-label>
                <ion-input v-model="habitTarget" type="number" inputmode="numeric"></ion-input>
              </ion-item>
            </ion-list>
            <ion-button expand="block" @click="saveHabit">Add habit</ion-button>
          </ion-card-content>
        </ion-card>

        <ion-card class="habit-card">
          <ion-card-header>
            <ion-card-title>Habits for {{ selectedDate }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list v-if="habits.length">
              <ion-item v-for="habit in habits" :key="habit.id">
                <ion-checkbox slot="start" :checked="habit.completed === 1" @ionChange="toggleHabit(habit)"></ion-checkbox>
                <ion-label>
                  <h3>{{ habit.name }}</h3>
                  <p>{{ habit.frequency }} · target {{ habit.target }}</p>
                </ion-label>
              </ion-item>
            </ion-list>
            <p v-else class="empty-state">No habits yet.</p>
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
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonList,
  IonButton,
  IonCheckbox,
  onIonViewWillEnter,
  toastController,
} from '@ionic/vue';
import { ref, watch } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import HealthSectionTabs from '@/features/health/components/HealthSectionTabs.vue';
import { addHabit, getHabitsWithStatus, toggleHabitCompletion } from '@/shared/db/app_db';

const selectedDate = ref(new Date().toISOString().slice(0, 10));
const habitName = ref('');
const habitFrequency = ref('daily');
const habitTarget = ref('1');
const habits = ref<Array<Record<string, any>>>([]);

const loadHabits = async () => {
  habits.value = await getHabitsWithStatus(selectedDate.value);
};

const saveHabit = async () => {
  if (!habitName.value.trim()) {
    const toast = await toastController.create({
      message: 'Habit name is required.',
      duration: 2000,
      color: 'warning',
    });
    await toast.present();
    return;
  }

  const targetValue = Number(habitTarget.value);
  if (!Number.isFinite(targetValue) || targetValue <= 0) {
    const toast = await toastController.create({
      message: 'Target must be a positive number.',
      duration: 2000,
      color: 'warning',
    });
    await toast.present();
    return;
  }

  await addHabit(habitName.value.trim(), habitFrequency.value, targetValue);
  habitName.value = '';
  habitTarget.value = '1';
  await loadHabits();

  const toast = await toastController.create({
    message: 'Habit added.',
    duration: 1800,
    color: 'success',
  });
  await toast.present();
};

const toggleHabit = async (habit: Record<string, any>) => {
  await toggleHabitCompletion(habit.id, selectedDate.value, habit.completed !== 1);
  await loadHabits();
};

watch(selectedDate, async () => {
  await loadHabits();
});

onIonViewWillEnter(async () => {
  await loadHabits();
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

.habit-card {
  margin: 0;
  border-radius: 12px;
  background: var(--ion-color-primary);
}

.empty-state {
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
}
</style>
