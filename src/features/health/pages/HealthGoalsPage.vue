<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <health-section-tabs />
    </ion-header>
    <ion-content :fullscreen="true" class="health-content">
      <div class="health-shell">
        <ion-card class="goal-card">
          <ion-card-header>
            <ion-card-title>Goals</ion-card-title>
            <ion-card-subtitle>Track progress across the year</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <ion-list>
              <ion-item>
                <ion-label position="stacked">Goal name</ion-label>
                <ion-input v-model="goalName"></ion-input>
              </ion-item>
              <ion-item>
                <ion-label position="stacked">Target value</ion-label>
                <ion-input v-model="goalTarget" type="number" inputmode="decimal"></ion-input>
              </ion-item>
              <ion-item>
                <ion-label position="stacked">Due date</ion-label>
                <ion-input v-model="goalDueDate" type="date"></ion-input>
              </ion-item>
            </ion-list>
            <ion-button expand="block" @click="saveGoal">Add goal</ion-button>
          </ion-card-content>
        </ion-card>

        <ion-card class="goal-card">
          <ion-card-header>
            <ion-card-title>Active goals</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <div v-if="goals.length" class="goal-list">
              <div v-for="goal in goals" :key="goal.id" class="goal-item">
                <div class="goal-header">
                  <div>
                    <h3>{{ goal.name }}</h3>
                    <p>Target {{ goal.target_value }} · Due {{ goal.due_date || 'TBD' }}</p>
                  </div>
                  <strong>{{ goal.current_value || 0 }}</strong>
                </div>
                <ion-progress-bar :value="goalProgress(goal)"></ion-progress-bar>
                <div class="goal-update">
                  <ion-input
                    v-model="progressDrafts[goal.id]"
                    type="number"
                    inputmode="decimal"
                    placeholder="Update progress"
                  ></ion-input>
                  <ion-button size="small" @click="updateProgress(goal)">Update</ion-button>
                </div>
              </div>
            </div>
            <p v-else class="empty-state">No goals yet.</p>
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
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonProgressBar,
  onIonViewWillEnter,
  toastController,
} from '@ionic/vue';
import { reactive, ref } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import HealthSectionTabs from '@/features/health/components/HealthSectionTabs.vue';
import { addGoal, getGoals, updateGoalProgress } from '@/shared/db/app_db';

const goalName = ref('');
const goalTarget = ref('');
const goalDueDate = ref('');
const goals = ref<Array<Record<string, any>>>([]);
const progressDrafts = reactive<Record<number, string>>({});

const loadGoals = async () => {
  goals.value = await getGoals();
  goals.value.forEach((goal) => {
    if (!(goal.id in progressDrafts)) {
      progressDrafts[goal.id] = String(goal.current_value ?? '');
    }
  });
};

const goalProgress = (goal: Record<string, any>) => {
  const target = Number(goal.target_value) || 0;
  const current = Number(goal.current_value) || 0;
  if (!target) return 0;
  return Math.min(1, current / target);
};

const saveGoal = async () => {
  if (!goalName.value.trim()) {
    const toast = await toastController.create({
      message: 'Goal name is required.',
      duration: 2000,
      color: 'warning',
    });
    await toast.present();
    return;
  }

  const targetValue = Number(goalTarget.value);
  if (!Number.isFinite(targetValue) || targetValue <= 0) {
    const toast = await toastController.create({
      message: 'Target must be a positive number.',
      duration: 2000,
      color: 'warning',
    });
    await toast.present();
    return;
  }

  await addGoal(goalName.value.trim(), targetValue, goalDueDate.value || undefined);
  goalName.value = '';
  goalTarget.value = '';
  goalDueDate.value = '';
  await loadGoals();

  const toast = await toastController.create({
    message: 'Goal added.',
    duration: 1800,
    color: 'success',
  });
  await toast.present();
};

const updateProgress = async (goal: Record<string, any>) => {
  const draft = progressDrafts[goal.id];
  const parsed = Number(draft);
  if (!Number.isFinite(parsed) || parsed < 0) {
    const toast = await toastController.create({
      message: 'Enter a valid progress value.',
      duration: 2000,
      color: 'warning',
    });
    await toast.present();
    return;
  }
  await updateGoalProgress(goal.id, parsed);
  await loadGoals();

  const toast = await toastController.create({
    message: 'Progress updated.',
    duration: 1800,
    color: 'success',
  });
  await toast.present();
};

onIonViewWillEnter(async () => {
  await loadGoals();
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

.goal-card {
  margin: 0;
  border-radius: 12px;
  background: var(--ion-color-primary);
}

.goal-list {
  display: grid;
  gap: 16px;
}

.goal-item h3 {
  margin: 0;
}

.goal-item p {
  margin: 4px 0 12px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.85rem;
}

.goal-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.goal-update {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.goal-update ion-input {
  flex: 1;
}

.empty-state {
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
}
</style>
