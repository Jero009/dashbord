<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <plan-section-tabs v-if="route.path.startsWith('/plan')" />
      <health-section-tabs v-else />
    </ion-header>
    <ion-content :fullscreen="true" class="habits-content">
      <div class="habits-shell">

        <!-- Header row -->
        <div class="habits-header">
          <div>
            <p class="eyebrow">Daily</p>
            <h2>Habits</h2>
          </div>
          <div class="date-nav">
            <button class="date-btn" @click="prevDay"><ion-icon :icon="chevronBackOutline" /></button>
            <span class="date-label">{{ displayDate }}</span>
            <button class="date-btn" @click="nextDay" :disabled="selectedDate >= todayStr"><ion-icon :icon="chevronForwardOutline" /></button>
          </div>
        </div>

        <!-- Habit list -->
        <div v-if="habits.length" class="habit-list">
          <div
            v-for="h in habits"
            :key="h.id"
            class="habit-card"
            :class="{ 'habit-card--done': h.completed === 1 }"
          >
            <button class="habit-check" @click="toggleHabit(h)">
              <ion-icon v-if="h.completed === 1" :icon="checkmark" class="check-icon" />
            </button>
            <div class="habit-info">
              <span class="habit-name">{{ h.name }}</span>
              <span class="habit-meta">{{ h.frequency }}{{ h.time ? ' · ' + h.time : '' }}</span>
            </div>
            <div class="habit-streak">
              <span class="streak-num">{{ streaks[h.id] ?? 0 }}</span>
              <span class="streak-label">day streak</span>
            </div>
            <button class="habit-delete" @click="removeHabit(h.id)"><ion-icon :icon="close" /></button>
          </div>
        </div>

        <div v-else class="empty-state">
          <p>No habits yet — add one below to start tracking.</p>
        </div>

        <!-- Progress summary -->
        <div v-if="habits.length" class="progress-bar-wrap">
          <div class="progress-bar-track">
            <div class="progress-bar-fill" :style="{ width: `${progressPct}%` }" />
          </div>
          <span class="progress-label">{{ doneCount }}/{{ habits.length }} done</span>
        </div>

        <!-- Add habit form -->
        <div class="add-section">
          <button class="add-toggle" @click="showForm = !showForm">
            {{ showForm ? 'Cancel' : 'Add habit' }}
          </button>

          <div v-if="showForm" class="add-form">
            <input v-model="newName" class="form-input" placeholder="Habit name" />
            <input v-model="newTime" class="form-input form-input--time" type="time" />
            <div class="freq-picker">
              <button
                class="freq-btn"
                :class="{ 'freq-btn--active': newFrequency === 'daily' }"
                @click="newFrequency = 'daily'"
              >Daily</button>
              <button
                class="freq-btn"
                :class="{ 'freq-btn--active': newFrequency === 'weekly' }"
                @click="newFrequency = 'weekly'"
              >Weekly</button>
            </div>
            <button class="save-btn" @click="saveHabit">Add habit</button>
          </div>
        </div>

      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonContent, IonIcon, onIonViewWillEnter, toastController } from '@ionic/vue';
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { checkmark, close, chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import HealthSectionTabs from '@/features/health/components/HealthSectionTabs.vue';
import PlanSectionTabs from '@/features/plan/components/PlanSectionTabs.vue';
const route = useRoute();
import {
  addHabit,
  deleteHabit,
  getHabitsWithStatus,
  toggleHabitCompletion,
  getRecentHabitLogs,
} from '@/shared/db/app_db';
import { hapticLight, hapticMedium, hapticSuccess } from '@/shared/utils/haptics';

const todayStr = new Date().toISOString().slice(0, 10);
const selectedDate = ref(todayStr);
const habits = ref<Record<string, any>[]>([]);
const streaks = ref<Record<number, number>>({});

const showForm = ref(false);
const newName = ref('');
const newFrequency = ref('daily');
const newTime = ref('');

const displayDate = computed(() =>
  new Date(selectedDate.value + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
);

const doneCount = computed(() => habits.value.filter((h) => h.completed === 1).length);
const progressPct = computed(() =>
  habits.value.length ? (doneCount.value / habits.value.length) * 100 : 0
);

const prevDay = () => {
  const d = new Date(selectedDate.value + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  selectedDate.value = d.toISOString().slice(0, 10);
};

const nextDay = () => {
  const d = new Date(selectedDate.value + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  selectedDate.value = d.toISOString().slice(0, 10);
};

const computeStreak = (logs: { date: string; completed: number }[], anchorDate: string): number => {
  const logMap = new Map(logs.map((l) => [l.date, l.completed]));
  let streak = 0;
  const d = new Date(anchorDate + 'T12:00:00');
  for (let i = 0; i < 60; i++) {
    const ds = d.toISOString().slice(0, 10);
    if (logMap.get(ds) === 1) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
};

const loadHabits = async () => {
  habits.value = await getHabitsWithStatus(selectedDate.value);
  const newStreaks: Record<number, number> = {};
  await Promise.all(
    habits.value.map(async (h) => {
      const logs = await getRecentHabitLogs(h.id, 60);
      newStreaks[h.id] = computeStreak(logs, selectedDate.value);
    })
  );
  streaks.value = newStreaks;
};

const toggleHabit = async (h: Record<string, any>) => {
  const completing = h.completed !== 1;
  if (completing) {
    hapticSuccess();
  } else {
    hapticLight();
  }
  await toggleHabitCompletion(h.id, selectedDate.value, completing);
  await loadHabits();
};

const removeHabit = async (id: number) => {
  await deleteHabit(id);
  await loadHabits();
};

const saveHabit = async () => {
  hapticMedium();
  if (!newName.value.trim()) {
    const t = await toastController.create({ message: 'Enter a habit name.', duration: 1800, color: 'warning' });
    await t.present();
    return;
  }
  await addHabit(newName.value.trim(), newFrequency.value, 1, newTime.value || undefined);
  newName.value = '';
  newTime.value = '';
  showForm.value = false;
  await loadHabits();
};

watch(selectedDate, loadHabits);
onIonViewWillEnter(loadHabits);
</script>

<style scoped>
.habits-content {
  --background: #000;
}

.habits-shell {
  padding: 16px 16px 24px;
  max-width: 760px;
  margin: 0 auto;
  display: grid;
  gap: 16px;
}

.habits-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.habits-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #fff;
}

.eyebrow {
  margin: 0 0 6px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
}

/* Date navigation */
.date-nav {
  display: flex;
  align-items: center;
  gap: 6px;
}

.date-label {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.85);
  min-width: 80px;
  text-align: center;
}

.date-btn {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.date-btn ion-icon {
  font-size: 20px;
}

.date-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

/* Habit list */
.habit-list {
  display: grid;
  gap: 10px;
}

.habit-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: border-color 150ms ease;
}

.habit-card--done {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.05);
}

.habit-check {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  position: relative;
  transition: background-color 150ms ease, border-color 150ms ease;
}

/* extend tap target to 40x40 without changing visual size */
.habit-check::after {
  content: '';
  position: absolute;
  inset: -6px;
}

.habit-card--done .habit-check {
  background: var(--ion-color-accent-red);
  border-color: var(--ion-color-accent-red);
}

.check-icon {
  color: #fff;
  font-size: 20px;
}

.habit-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.habit-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
}

.habit-meta {
  font-size: 0.72rem;
  text-transform: capitalize;
  color: rgba(255, 255, 255, 0.5);
}

.habit-streak {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 36px;
}

.streak-num {
  font-size: 1rem;
  font-weight: 600;
  color: var(--ion-color-accent-red);
  line-height: 1;
}

.streak-label {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
}

.habit-delete {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.25);
  line-height: 1;
  cursor: pointer;
  min-width: 40px;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.habit-delete ion-icon {
  font-size: 20px;
}

.habit-delete:hover {
  color: rgba(255, 255, 255, 0.5);
}

/* Progress bar */
.progress-bar-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-bar-track {
  flex: 1;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--ion-color-accent-red);
}

.progress-label {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
}

/* Add section */
.add-section {
  display: grid;
  gap: 12px;
}

.add-toggle {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.5);
  padding: 12px;
  font-size: 0.9rem;
  cursor: pointer;
  text-align: center;
  width: 100%;
  transition: border-color 150ms ease;
}

.add-toggle:hover {
  border-color: rgba(255, 255, 255, 0.12);
}

.add-form {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.form-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 10px 14px;
  color: #fff;
  font-size: 0.9rem;
  outline: none;
  box-sizing: border-box;
  transition: border-color 150ms ease;
}

.form-input:focus {
  border-color: rgb(239, 68, 68);
}

.form-input::placeholder {
  color: rgba(255, 255, 255, 0.35);
}

.form-input--time {
  color-scheme: dark;
}

.freq-picker {
  display: flex;
  gap: 10px;
}

.freq-btn {
  flex: 1;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.freq-btn--active {
  background: var(--ion-color-accent-red);
  border-color: var(--ion-color-accent-red);
  color: #fff;
}

.save-btn {
  padding: 12px;
  border-radius: 8px;
  background: rgb(239, 68, 68);
  border: none;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 150ms ease;
}

.save-btn:hover {
  background: rgb(220, 38, 38);
}

.empty-state {
  padding: 24px 16px;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.9rem;
}

.empty-state p {
  margin: 0;
}
</style>
