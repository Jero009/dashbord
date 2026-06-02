<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <health-section-tabs />
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
            <button class="date-btn" @click="prevDay">‹</button>
            <span class="date-label">{{ displayDate }}</span>
            <button class="date-btn" @click="nextDay" :disabled="selectedDate >= todayStr">›</button>
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
              <span v-if="h.completed === 1" class="check-icon">✓</span>
            </button>
            <div class="habit-info">
              <span class="habit-name">{{ h.name }}</span>
              <span class="habit-meta">{{ h.frequency }}{{ h.time ? ' · ' + h.time : '' }}</span>
            </div>
            <div class="habit-streak">
              <span class="streak-num">{{ streaks[h.id] ?? 0 }}</span>
              <span class="streak-label">day streak</span>
            </div>
            <button class="habit-delete" @click="removeHabit(h.id)">×</button>
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
            {{ showForm ? '✕ Cancel' : '+ Add habit' }}
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
import { IonPage, IonHeader, IonContent, onIonViewWillEnter, toastController } from '@ionic/vue';
import { ref, computed, watch } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import HealthSectionTabs from '@/features/health/components/HealthSectionTabs.vue';
import {
  addHabit,
  deleteHabit,
  getHabitsWithStatus,
  toggleHabitCompletion,
  getRecentHabitLogs,
} from '@/shared/db/app_db';

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
  await toggleHabitCompletion(h.id, selectedDate.value, h.completed !== 1);
  await loadHabits();
};

const removeHabit = async (id: number) => {
  await deleteHabit(id);
  await loadHabits();
};

const saveHabit = async () => {
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
  padding: 1rem 1rem 3rem;
  max-width: 520px;
  margin: 0 auto;
  display: grid;
  gap: 1rem;
}

.habits-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.habits-header h2 {
  margin: 0;
  font-size: 1.4rem;
  color: #fff;
}

.eyebrow {
  margin: 0 0 0.2rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.5);
}

/* Date navigation */
.date-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-label {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.7);
  min-width: 80px;
  text-align: center;
}

.date-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.date-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

/* Habit list */
.habit-list {
  display: grid;
  gap: 0.6rem;
}

.habit-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: border-color 0.2s;
}

.habit-card--done {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.05);
}

.habit-check {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1.5px solid rgba(255, 255, 255, 0.2);
  background: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, border-color 0.15s;
}

.habit-card--done .habit-check {
  background: rgb(239, 68, 68);
  border-color: rgb(239, 68, 68);
}

.check-icon {
  color: #fff;
  font-size: 0.85rem;
}

.habit-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.habit-name {
  font-size: 0.95rem;
  color: #fff;
}

.habit-meta {
  font-size: 0.72rem;
  text-transform: capitalize;
  color: rgba(255, 255, 255, 0.4);
}

.habit-streak {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 36px;
}

.streak-num {
  font-size: 1rem;
  font-weight: 700;
  color: rgb(239, 68, 68);
  line-height: 1;
}

.streak-label {
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.35);
  text-align: center;
}

.habit-delete {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.2);
  font-size: 1.3rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
}

.habit-delete:hover {
  color: rgba(255, 255, 255, 0.6);
}

/* Progress bar */
.progress-bar-wrap {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.progress-bar-track {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 2px;
  background: rgb(239, 68, 68);
  transition: width 0.3s ease;
}

.progress-label {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
}

/* Add section */
.add-section {
  display: grid;
  gap: 0.75rem;
}

.add-toggle {
  background: rgba(255, 255, 255, 0.04);
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  color: rgba(255, 255, 255, 0.5);
  padding: 0.75rem;
  font-size: 0.88rem;
  cursor: pointer;
  text-align: center;
  width: 100%;
  transition: background 0.15s;
}

.add-toggle:hover {
  background: rgba(255, 255, 255, 0.07);
}

.add-form {
  display: grid;
  gap: 0.65rem;
  padding: 1rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.form-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 0.6rem 0.85rem;
  color: #fff;
  font-size: 0.9rem;
  outline: none;
  box-sizing: border-box;
}

.form-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.form-input--time {
  color-scheme: dark;
}

.freq-picker {
  display: flex;
  gap: 0.5rem;
}

.freq-btn {
  flex: 1;
  padding: 0.5rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s;
}

.freq-btn--active {
  background: rgb(239, 68, 68);
  border-color: rgb(239, 68, 68);
  color: #fff;
}

.save-btn {
  padding: 0.65rem;
  border-radius: 8px;
  background: rgb(239, 68, 68);
  border: none;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.empty-state {
  padding: 2rem 1rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.35);
  font-size: 0.88rem;
}

.empty-state p {
  margin: 0;
}
</style>
