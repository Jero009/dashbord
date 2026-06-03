<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <plan-section-tabs v-if="route.path.startsWith('/plan')" />
      <health-section-tabs v-else />
    </ion-header>
    <ion-content :fullscreen="true" class="health-content">
      <div class="health-shell">
        <ion-card class="goal-card">
          <div class="card-topline">
            <p class="section-kicker">Add goal</p>
            <span class="card-sub">Track progress across the year</span>
          </div>
          <div class="form-fields">
            <div class="field-group">
              <label class="field-label">Goal name</label>
              <ion-input v-model="goalName" class="styled-input"></ion-input>
            </div>
            <div class="field-group">
              <label class="field-label">Target value</label>
              <ion-input v-model="goalTarget" type="number" inputmode="decimal" class="styled-input"></ion-input>
            </div>
            <div class="field-group">
              <label class="field-label">Due date</label>
              <ion-input v-model="goalDueDate" type="date" class="styled-input"></ion-input>
            </div>
          </div>
          <ion-button expand="block" class="add-btn" @click="saveGoal">Add goal</ion-button>
        </ion-card>

        <ion-card class="goal-card">
          <div class="card-topline">
            <p class="section-kicker">Active goals</p>
            <span class="card-sub">{{ goals.length }} goal{{ goals.length === 1 ? '' : 's' }}</span>
          </div>
          <div v-if="goals.length" class="goal-list">
            <div v-for="goal in goals" :key="goal.id" class="goal-item">
              <div class="goal-item__header">
                <strong class="goal-item__name">{{ goal.name }}</strong>
                <span class="goal-item__current">{{ goal.current_value || 0 }}</span>
              </div>
              <div class="card-metrics">
                <div class="card-metric">
                  <span>Target</span>
                  <strong>{{ goal.target_value }}</strong>
                </div>
                <div class="card-metric">
                  <span>Current</span>
                  <strong>{{ goal.current_value || 0 }}</strong>
                </div>
                <div class="card-metric">
                  <span>Due</span>
                  <strong>{{ goal.due_date || 'TBD' }}</strong>
                </div>
              </div>
              <ion-progress-bar :value="goalProgress(goal)"></ion-progress-bar>
              <div class="goal-update">
                <ion-input
                  v-model="progressDrafts[goal.id]"
                  type="number"
                  inputmode="decimal"
                  placeholder="Update progress"
                  class="styled-input"
                ></ion-input>
                <ion-button size="small" class="update-btn" @click="updateProgress(goal)">Update</ion-button>
              </div>
            </div>
          </div>
          <p v-else class="empty-state">No goals yet.</p>
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
  IonInput,
  IonButton,
  IonProgressBar,
  onIonViewWillEnter,
  toastController,
} from '@ionic/vue';
import { reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import HealthSectionTabs from '@/features/health/components/HealthSectionTabs.vue';
import PlanSectionTabs from '@/features/plan/components/PlanSectionTabs.vue';
const route = useRoute();
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
  max-width: 760px;
  margin: 0 auto;
  padding: 16px;
  display: grid;
  gap: 16px;
}

.goal-card {
  margin: 0;
  border-radius: 12px;
  background: var(--ion-color-primary);
  padding: 18px;
  display: grid;
  gap: 16px;
}

.card-topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.section-kicker {
  margin: 0;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: rgba(255, 255, 255, 0.45);
}

.card-sub {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.45);
}

.form-fields {
  display: grid;
  gap: 10px;
}

.field-group {
  display: grid;
  gap: 6px;
}

.field-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.5);
}

.styled-input {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  --color: #fff;
  --placeholder-color: rgba(255, 255, 255, 0.35);
  --padding-start: 12px;
  --padding-end: 12px;
  --padding-top: 10px;
  --padding-bottom: 10px;
  min-height: 44px;
}

.add-btn {
  --background: var(--ion-color-accent-red);
  --background-activated: rgb(220, 50, 50);
  --border-radius: 8px;
  --box-shadow: none;
  margin: 0;
}

.goal-list {
  display: grid;
  gap: 16px;
}

.goal-item {
  display: grid;
  gap: 10px;
}

.goal-item__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.goal-item__name {
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
}

.goal-item__current {
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
}

.card-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.card-metric {
  border-radius: 10px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.05);
}

.card-metric span {
  display: block;
  margin-bottom: 6px;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.5);
}

.card-metric strong {
  display: block;
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
}

.goal-update {
  display: flex;
  gap: 8px;
  align-items: center;
}

.goal-update .styled-input {
  flex: 1;
}

.update-btn {
  --background: var(--ion-color-accent-red);
  --background-activated: rgb(220, 50, 50);
  --border-radius: 8px;
  --box-shadow: none;
}

.empty-state {
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
}
</style>
