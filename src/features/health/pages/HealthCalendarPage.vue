<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <plan-section-tabs v-if="route.path.startsWith('/plan')" />
      <health-section-tabs v-else />
    </ion-header>
    <ion-content :fullscreen="true" class="cal-content">
      <div class="cal-shell">

        <!-- Month navigation -->
        <div class="month-nav">
          <button class="month-nav__btn" @click="prevMonth"><ion-icon :icon="chevronBackOutline" /></button>
          <span class="month-nav__label">{{ monthLabel }}</span>
          <button class="month-nav__btn" @click="nextMonth"><ion-icon :icon="chevronForwardOutline" /></button>
        </div>

        <!-- Day-of-week headers -->
        <div class="cal-grid">
          <div v-for="d in DOW" :key="d" class="cal-dow">{{ d }}</div>

          <!-- Padding cells -->
          <div v-for="n in leadingBlanks" :key="`b${n}`" class="cal-cell cal-cell--blank" />

          <!-- Day cells -->
          <div
            v-for="cell in calendarCells"
            :key="cell.dateStr"
            class="cal-cell"
            :class="{
              'cal-cell--today': cell.dateStr === todayStr,
              'cal-cell--selected': cell.dateStr === selectedDate,
            }"
            @click="selectDay(cell.dateStr)"
          >
            <span class="cal-cell__num">{{ cell.day }}</span>
            <div class="cal-cell__dots">
              <span v-if="cell.hasEvent" class="dot dot--event" />
              <span v-if="cell.hasHabit" class="dot dot--habit" />
            </div>
          </div>
        </div>

        <!-- Selected day detail -->
        <div class="day-detail">
          <p class="eyebrow">{{ selectedDateLabel }}</p>

          <!-- Events -->
          <div class="detail-card">
            <div class="detail-card__header">
              <h3>Events</h3>
              <button class="icon-btn" @click="showAddEvent ? (resetEventForm(), showAddEvent = false) : (showAddEvent = true)">
                <ion-icon v-if="showAddEvent" :icon="close" />
                <ion-icon v-else :icon="add" />
              </button>
            </div>

            <div v-if="showAddEvent" class="add-form">
              <input v-model="newTitle" class="form-input" placeholder="Event title" />
              <div class="form-row">
                <input v-model="newTimeStart" class="form-input form-input--time" type="time" title="Start time" />
                <span class="time-sep">–</span>
                <input v-model="newTimeEnd" class="form-input form-input--time" type="time" title="End time" />
              </div>
              <div class="form-row">
                <select v-model="newType" class="form-select">
                  <option value="general">General</option>
                  <option value="workout">Workout</option>
                  <option value="recovery">Recovery</option>
                  <option value="school">School</option>
                  <option value="sleep">Sleep</option>
                  <option value="reminder">Reminder</option>
                </select>
                <select v-model="newRecurrence" class="form-select">
                  <option value="none">No repeat</option>
                  <option value="daily">Every day</option>
                  <option value="weekly">Every week</option>
                </select>
              </div>
              <div v-if="newRecurrence !== 'none'" class="form-row">
                <label class="form-label">Ends on (optional)</label>
                <input v-model="newEndDate" class="form-input form-input--date" type="date" />
              </div>
              <div class="form-row form-row--end">
                <button class="save-btn" @click="saveEvent">Save</button>
              </div>
              <div v-if="newType === 'workout'" class="form-row workout-picker">
                <select v-model="newWorkoutTemplateId" class="form-select">
                  <option :value="null">No template</option>
                  <option
                    v-for="t in templates"
                    :key="t.id"
                    :value="t.id"
                  >
                    {{ t.name }}{{ t.id === recommendedTemplateId ? ' (recommended)' : '' }}
                  </option>
                </select>
              </div>
              <input v-model="newNotes" class="form-input" placeholder="Notes (optional)" />
            </div>

            <ul v-if="events.length" class="item-list">
              <li v-for="ev in events" :key="ev.id" class="item-row">
                <span class="item-tag" :class="`item-tag--${ev.type}`">{{ ev.type }}</span>
                <div class="item-body">
                  <strong>{{ ev.title }}</strong>
                  <span v-if="ev.time_start" class="item-note">
                    {{ ev.time_start }}{{ ev.time_end ? ' – ' + ev.time_end : '' }}
                  </span>
                  <span v-if="ev.recurrence && ev.recurrence !== 'none'" class="item-note item-note--recur">
                    {{ ev.recurrence === 'daily' ? 'Repeats daily' : 'Repeats weekly' }}
                  </span>
                  <span v-if="ev.notes" class="item-note">{{ ev.notes }}</span>
                </div>
                <button class="delete-btn" @click="removeEvent(ev)"><ion-icon :icon="close" /></button>
              </li>
            </ul>
            <p v-else class="empty-hint">No events on this day</p>
          </div>

          <!-- Habits -->
          <div class="detail-card">
            <div class="detail-card__header">
              <h3>Habits</h3>
            </div>
            <ul v-if="habits.length" class="item-list">
              <li
                v-for="h in habits"
                :key="h.id"
                class="habit-row"
                @click="toggleHabit(h)"
              >
                <div class="habit-check" :class="{ 'habit-check--done': h.completed === 1 }">
                  <ion-icon v-if="h.completed === 1" :icon="checkmark" />
                </div>
                <span class="habit-name">{{ h.name }}</span>
              </li>
            </ul>
            <p v-else class="empty-hint">No habits set up yet</p>
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
import { checkmark, close, add, chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import HealthSectionTabs from '@/features/health/components/HealthSectionTabs.vue';
import PlanSectionTabs from '@/features/plan/components/PlanSectionTabs.vue';
const route = useRoute();
import {
  addCalendarEvent,
  deleteCalendarEvent,
  stopCalendarEventAt,
  getCalendarEventsForDate,
  getCalendarEventDatesForMonth,
  getHabitCompletedDatesForMonth,
  getHabitsWithStatus,
  toggleHabitCompletion,
  getTemplates,
  getWorkouts,
} from '@/shared/db/app_db';
import { hapticHeavy, hapticLight, hapticMedium, hapticSelect } from '@/shared/utils/haptics';

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const todayStr = new Date().toISOString().slice(0, 10);
const now = new Date();
const viewYear = ref(now.getFullYear());
const viewMonth = ref(now.getMonth()); // 0-indexed
const selectedDate = ref(todayStr);

const events = ref<Record<string, any>[]>([]);
const habits = ref<Record<string, any>[]>([]);
const eventDates = ref<Set<string>>(new Set());
const habitDates = ref<Set<string>>(new Set());

const showAddEvent = ref(false);
const newTitle = ref('');
const newType = ref('general');
const newNotes = ref('');
const newTimeStart = ref('');
const newTimeEnd = ref('');
const newRecurrence = ref('none');
const newEndDate = ref('');

const templates = ref<{ id: number; name: string }[]>([]);
const newWorkoutTemplateId = ref<number | null>(null);
const recommendedTemplateId = ref<number | null>(null);

const monthLabel = computed(() => {
  return new Date(viewYear.value, viewMonth.value, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
});

const yearMonthStr = computed(() =>
  `${viewYear.value}-${String(viewMonth.value + 1).padStart(2, '0')}`
);

const leadingBlanks = computed(() =>
  new Date(viewYear.value, viewMonth.value, 1).getDay()
);

const calendarCells = computed(() => {
  const daysInMonth = new Date(viewYear.value, viewMonth.value + 1, 0).getDate();
  const cells = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yearMonthStr.value}-${String(d).padStart(2, '0')}`;
    cells.push({
      day: d,
      dateStr,
      hasEvent: eventDates.value.has(dateStr),
      hasHabit: habitDates.value.has(dateStr),
    });
  }
  return cells;
});

const selectedDateLabel = computed(() =>
  new Date(selectedDate.value + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
);

const prevMonth = () => {
  if (viewMonth.value === 0) { viewYear.value--; viewMonth.value = 11; }
  else viewMonth.value--;
};

const nextMonth = () => {
  if (viewMonth.value === 11) { viewYear.value++; viewMonth.value = 0; }
  else viewMonth.value++;
};

const selectDay = (dateStr: string) => {
  hapticSelect();
  selectedDate.value = dateStr;
};

const loadMonthDots = async () => {
  const [evDates, habDates] = await Promise.all([
    getCalendarEventDatesForMonth(yearMonthStr.value),
    getHabitCompletedDatesForMonth(yearMonthStr.value),
  ]);
  eventDates.value = new Set(evDates);
  habitDates.value = new Set(habDates);
};

const loadDayDetail = async () => {
  const [evs, habs] = await Promise.all([
    getCalendarEventsForDate(selectedDate.value),
    getHabitsWithStatus(selectedDate.value),
  ]);
  events.value = evs;
  habits.value = habs;
};

const computeRecommendation = async (timeStart: string) => {
  if (!templates.value.length) return;
  const workouts = await getWorkouts();

  const hourMatch = timeStart ? parseInt(timeStart.split(':')[0]) : null;

  const lastUsed: Record<number, string> = {};
  for (const w of workouts as any[]) {
    if (!w.id_workout_template || !w.time_end) continue;
    const wHour = new Date(w.time_start).getHours();
    if (hourMatch !== null && Math.abs(wHour - hourMatch) > 3) continue;
    const existing = lastUsed[w.id_workout_template];
    if (!existing || w.time_end > existing) {
      lastUsed[w.id_workout_template] = w.time_end;
    }
  }

  let recommended: number | null = null;
  let oldestDate = 'zzzz';
  for (const t of templates.value) {
    const last = lastUsed[t.id] ?? '0000';
    if (last < oldestDate) {
      oldestDate = last;
      recommended = t.id;
    }
  }
  recommendedTemplateId.value = recommended;
  if (recommended !== null && newWorkoutTemplateId.value === null) {
    newWorkoutTemplateId.value = recommended;
  }
};

watch([newType, newTimeStart], ([type, time]) => {
  if (type === 'workout') void computeRecommendation(time as string);
  else { recommendedTemplateId.value = null; newWorkoutTemplateId.value = null; }
});

const resetEventForm = () => {
  newTitle.value = '';
  newNotes.value = '';
  newType.value = 'general';
  newTimeStart.value = '';
  newTimeEnd.value = '';
  newWorkoutTemplateId.value = null;
  newRecurrence.value = 'none';
  newEndDate.value = '';
  recommendedTemplateId.value = null;
};

const saveEvent = async () => {
  hapticMedium();
  if (!newTitle.value.trim()) {
    const t = await toastController.create({ message: 'Add a title.', duration: 1800, color: 'warning' });
    await t.present();
    return;
  }
  await addCalendarEvent(
    newTitle.value.trim(),
    selectedDate.value,
    newType.value,
    newNotes.value.trim() || undefined,
    newTimeStart.value || undefined,
    newTimeEnd.value || undefined,
    newWorkoutTemplateId.value ?? undefined,
    newRecurrence.value,
    newEndDate.value || undefined
  );
  resetEventForm();
  showAddEvent.value = false;
  await Promise.all([loadDayDetail(), loadMonthDots()]);
};

function prevDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

const removeEvent = async (ev: Record<string, any>) => {
  hapticHeavy();
  const isRecurring = ev.recurrence && ev.recurrence !== 'none';
  const isOnOriginalDate = ev.date === selectedDate.value;
  if (isRecurring && !isOnOriginalDate) {
    await stopCalendarEventAt(ev.id, prevDay(selectedDate.value));
  } else {
    await deleteCalendarEvent(ev.id);
  }
  await Promise.all([loadDayDetail(), loadMonthDots()]);
};

const toggleHabit = async (h: Record<string, any>) => {
  hapticLight();
  await toggleHabitCompletion(h.id, selectedDate.value, h.completed !== 1);
  await Promise.all([loadDayDetail(), loadMonthDots()]);
};

watch(yearMonthStr, loadMonthDots);
watch(selectedDate, loadDayDetail);

onIonViewWillEnter(async () => {
  templates.value = await getTemplates();
  await Promise.all([loadMonthDots(), loadDayDetail()]);
});
</script>

<style scoped>
.cal-content {
  --background: #000;
}

.cal-shell {
  padding: 16px 16px 24px;
  display: grid;
  gap: 18px;
  max-width: 760px;
  margin: 0 auto;
}

/* Month navigation */
.month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.month-nav__label {
  font-size: 1.05rem;
  font-weight: 600;
  color: #fff;
}

.month-nav__btn {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.month-nav__btn ion-icon {
  font-size: 20px;
}

/* Calendar grid */
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}

.cal-dow {
  text-align: center;
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
  padding-bottom: 6px;
}

.cal-cell {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-radius: 10px;
  cursor: pointer;
  transition: background-color 150ms ease;
}

.cal-cell--blank {
  cursor: default;
}

.cal-cell--today .cal-cell__num {
  color: var(--ion-color-accent-red);
  font-weight: 600;
}

.cal-cell--selected {
  background: var(--ion-color-accent-red) !important;
}

.cal-cell--selected .cal-cell__num {
  color: #fff;
  font-weight: 600;
}

.cal-cell:not(.cal-cell--blank):not(.cal-cell--selected):hover {
  background: rgba(255, 255, 255, 0.08);
}

.cal-cell__num {
  font-size: 0.88rem;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1;
}

.cal-cell__dots {
  display: flex;
  gap: 2px;
  min-height: 5px;
}

.dot {
  width: 4px;
  height: 4px;
  border-radius: 999px;
}

.dot--event {
  background: var(--ion-color-accent-red);
}

.dot--habit {
  background: rgba(255, 255, 255, 0.5);
}

.cal-cell--selected .dot--event {
  background: #fff;
}

.cal-cell--selected .dot--habit {
  background: rgba(255, 255, 255, 0.85);
}

/* Day detail */
.eyebrow {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
}

.day-detail {
  display: grid;
  gap: 12px;
}

.detail-card {
  border-radius: 12px;
  background: var(--ion-color-primary);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 18px;
}

.detail-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.detail-card__header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #fff;
}

.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: none;
  color: #fff;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 150ms ease;
}

.icon-btn ion-icon {
  font-size: 20px;
}

/* Add form */
.add-form {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
  padding: 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
}

.form-row {
  display: flex;
  gap: 10px;
}

.form-input,
.form-select {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 10px 12px;
  color: #fff;
  font-size: 0.9rem;
  outline: none;
  box-sizing: border-box;
  transition: border-color 150ms ease;
}

.form-input:focus,
.form-select:focus {
  border-color: rgb(239, 68, 68);
}

.form-select {
  flex: 1;
}

.form-input::placeholder {
  color: rgba(255, 255, 255, 0.35);
}

.form-input--time {
  color-scheme: dark;
  flex: 1;
}

.form-input--date {
  color-scheme: dark;
  flex: 1;
}

.form-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  align-self: center;
  flex-shrink: 0;
  margin-right: 8px;
}

.time-sep {
  color: rgba(255, 255, 255, 0.5);
  font-size: 1rem;
  align-self: center;
  flex-shrink: 0;
}

.save-btn {
  padding: 10px 18px;
  border-radius: 8px;
  background: rgb(239, 68, 68);
  border: none;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 150ms ease;
}

.save-btn:hover {
  background: rgb(220, 38, 38);
}

/* Event list */
.item-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.item-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.item-tag {
  flex-shrink: 0;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.5);
  margin-top: 2px;
}

.item-tag--workout  { background: rgba(239, 68, 68, 0.15);  color: rgb(239, 68, 68); }
.item-tag--recovery { background: rgba(34, 197, 94, 0.15);  color: rgb(34, 197, 94); }
.item-tag--school   { background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.85); }
.item-tag--sleep    { background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.85); }
.item-tag--reminder { background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.85); }

.item-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-body strong {
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
}

.item-note {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
}

.delete-btn {
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

.delete-btn ion-icon {
  font-size: 20px;
}

.delete-btn:hover {
  color: rgba(255, 255, 255, 0.5);
}

/* Habit rows */
.habit-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
  min-height: 40px;
  cursor: pointer;
}

.habit-check {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 20px;
  color: #fff;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.habit-check--done {
  background: var(--ion-color-accent-red);
  border-color: var(--ion-color-accent-red);
}

.habit-name {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.85);
}

.empty-hint {
  margin: 0;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.5);
}

.form-row--end {
  justify-content: flex-end;
}

.item-note--recur {
  color: rgba(255, 255, 255, 0.5);
}
</style>
