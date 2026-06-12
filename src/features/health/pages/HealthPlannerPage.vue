<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <health-section-tabs />
    </ion-header>
    <ion-content :fullscreen="true" class="planner-content">
      <div class="planner-shell">

        <!-- ============ MONTH CALENDAR ============ -->
        <div class="month-nav">
          <button class="month-nav__btn" @click="prevMonth">&#8249;</button>
          <span class="month-nav__label">{{ monthLabel }}</span>
          <button class="month-nav__btn" @click="nextMonth">&#8250;</button>
        </div>

        <div class="cal-grid">
          <div v-for="d in DOW" :key="d" class="cal-dow">{{ d }}</div>
          <div v-for="n in leadingBlanks" :key="`b${n}`" class="cal-cell cal-cell--blank" />
          <div
            v-for="cell in calendarCells"
            :key="cell.dateStr"
            class="cal-cell"
            :class="{
              'cal-cell--today': cell.dateStr === todayStr,
              'cal-cell--selected': cell.dateStr === selectedDate,
            }"
            @click="selectedDate = cell.dateStr"
          >
            <span class="cal-cell__num">{{ cell.day }}</span>
            <div class="cal-cell__dots">
              <span v-if="cell.hasEvent" class="dot dot--event" />
              <span v-if="cell.hasHabit" class="dot dot--habit" />
              <span v-if="cell.hasGoal" class="dot dot--goal" />
            </div>
          </div>
        </div>

        <!-- ============ SELECTED DAY ============ -->
        <div class="day-head">
          <p class="eyebrow">{{ selectedDateLabel }}</p>
          <button v-if="selectedDate !== todayStr" class="today-btn" @click="selectedDate = todayStr">
            Today
          </button>
        </div>

        <!-- Goal deadlines on this day -->
        <div v-if="goalsDueSelected.length" class="detail-card detail-card--goal-due">
          <ul class="item-list">
            <li v-for="g in goalsDueSelected" :key="g.id" class="item-row">
              <span class="item-tag item-tag--goal">goal due</span>
              <div class="item-body">
                <strong>{{ g.name }}</strong>
                <span class="item-note">{{ fmtNum(g.current_value) }} / {{ fmtNum(g.target_value) }}</span>
              </div>
            </li>
          </ul>
        </div>

        <!-- Events -->
        <div class="detail-card">
          <div class="detail-card__header">
            <h3>Events</h3>
            <button class="icon-btn" @click="showAddEvent ? (resetEventForm(), showAddEvent = false) : (showAddEvent = true)">
              {{ showAddEvent ? '✕' : '+' }}
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
            <div v-if="newType === 'workout'" class="form-row">
              <select v-model="newWorkoutTemplateId" class="form-select">
                <option :value="null">No template</option>
                <option v-for="t in templates" :key="t.id" :value="t.id">
                  {{ t.name }}{{ t.id === recommendedTemplateId ? ' (recommended)' : '' }}
                </option>
              </select>
            </div>
            <input v-model="newNotes" class="form-input" placeholder="Notes (optional)" />
            <div class="form-row form-row--end">
              <button class="save-btn" @click="saveEvent">Save</button>
            </div>
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
              <button class="delete-btn" @click="removeEvent(ev.id)">×</button>
            </li>
          </ul>
          <p v-else class="empty-hint">No events on this day</p>
        </div>

        <!-- Habits for the selected day -->
        <div class="detail-card">
          <div class="detail-card__header">
            <h3>Habits</h3>
            <span v-if="dayHabits.length" class="header-count">{{ dayDoneCount }}/{{ dayHabits.length }}</span>
          </div>
          <div v-if="dayHabits.length" class="day-progress">
            <div class="day-progress__fill" :style="{ width: `${dayProgressPct}%` }" />
          </div>
          <ul v-if="dayHabits.length" class="item-list">
            <li v-for="h in dayHabits" :key="h.id" class="habit-row" @click="toggleHabit(h, selectedDate)">
              <div class="habit-check" :class="{ 'habit-check--done': h.completed === 1 }">
                <span v-if="h.completed === 1">✓</span>
              </div>
              <div class="habit-row__info">
                <span class="habit-name">{{ h.name }}</span>
                <span v-if="h.time || linkedGoalName(h)" class="habit-sub">
                  {{ h.time || '' }}{{ h.time && linkedGoalName(h) ? ' · ' : '' }}{{ linkedGoalName(h) }}
                </span>
              </div>
              <div class="habit-streak">
                <span class="streak-num">{{ streakFor(h, selectedDate) }}</span>
                <span class="streak-label">streak</span>
              </div>
            </li>
          </ul>
          <p v-else class="empty-hint">No habits scheduled this day</p>
        </div>

        <!-- ============ HABIT BOARD ============ -->
        <div class="day-head day-head--section">
          <p class="eyebrow">Habit board · last 7 days</p>
          <button class="icon-btn" @click="showAddHabit ? (resetHabitForm(), showAddHabit = false) : (showAddHabit = true)">
            {{ showAddHabit ? '✕' : '+' }}
          </button>
        </div>

        <div v-if="showAddHabit" class="detail-card add-form">
          <input v-model="habitName" class="form-input" placeholder="Habit name" />
          <div class="dow-picker">
            <button
              v-for="(label, i) in DOW"
              :key="i"
              class="dow-chip"
              :class="{ 'dow-chip--active': habitDays.has(i) }"
              @click="toggleHabitDay(i)"
            >{{ label }}</button>
          </div>
          <div class="form-row">
            <input v-model="habitTime" class="form-input form-input--time" type="time" title="Reminder time" />
            <select v-model="habitGoalId" class="form-select">
              <option :value="null">No linked goal</option>
              <option v-for="g in activeGoals" :key="g.id" :value="g.id">→ {{ g.name }}</option>
            </select>
          </div>
          <p class="form-hint">Linking a goal adds +1 progress each time the habit is completed.</p>
          <div class="form-row form-row--end">
            <button class="save-btn" @click="saveHabit">Add habit</button>
          </div>
        </div>

        <div v-if="allHabits.length" class="detail-card board-card">
          <div class="board-grid" :style="{ gridTemplateColumns: `minmax(0,1fr) repeat(7, 30px)` }">
            <span class="board-corner" />
            <span v-for="d in weekDates" :key="d" class="board-dow" :class="{ 'board-dow--today': d === todayStr }">
              {{ dowShort(d) }}
            </span>

            <template v-for="h in allHabits" :key="h.id">
              <button class="board-name" @click="expandedHabitId = expandedHabitId === h.id ? null : h.id">
                <span class="board-name__text">{{ h.name }}</span>
                <span class="board-name__streak">{{ streakFor(h, todayStr) }}</span>
              </button>
              <button
                v-for="d in weekDates"
                :key="`${h.id}-${d}`"
                class="board-cell"
                :class="{
                  'board-cell--done': isDone(h.id, d),
                  'board-cell--off': !isScheduledOn(h, d),
                }"
                :disabled="!isScheduledOn(h, d)"
                @click="toggleHabit(h, d)"
              >
                <span v-if="isDone(h.id, d)">✓</span>
                <span v-else-if="!isScheduledOn(h, d)" class="board-cell__dash">–</span>
              </button>

              <!-- Expanded habit detail -->
              <div v-if="expandedHabitId === h.id" class="board-expand">
                <div class="stat-tiles">
                  <div class="stat-tile">
                    <span>Streak</span>
                    <strong>{{ streakFor(h, todayStr) }}d</strong>
                  </div>
                  <div class="stat-tile">
                    <span>Best</span>
                    <strong>{{ bestStreakFor(h) }}d</strong>
                  </div>
                  <div class="stat-tile">
                    <span>30-day</span>
                    <strong>{{ rateFor(h) }}</strong>
                  </div>
                </div>
                <div class="mini-grid">
                  <span
                    v-for="d in last28Dates"
                    :key="d"
                    class="mini-cell"
                    :class="{
                      'mini-cell--done': isDone(h.id, d),
                      'mini-cell--off': !isScheduledOn(h, d),
                    }"
                  />
                </div>
                <div class="edit-form">
                  <input v-model="editName" class="form-input" placeholder="Habit name" />
                  <div class="dow-picker">
                    <button
                      v-for="(label, i) in DOW"
                      :key="i"
                      class="dow-chip"
                      :class="{ 'dow-chip--active': editDays.has(i) }"
                      @click="toggleEditDay(i)"
                    >{{ label }}</button>
                  </div>
                  <div class="form-row">
                    <input v-model="editTime" class="form-input form-input--time" type="time" title="Reminder time" />
                    <select v-model="editGoalId" class="form-select">
                      <option :value="null">No linked goal</option>
                      <option v-for="g in activeGoals" :key="g.id" :value="g.id">→ {{ g.name }}</option>
                    </select>
                  </div>
                  <div class="form-row form-row--end">
                    <button class="ghost-btn ghost-btn--danger" @click="removeHabit(h.id)">Delete</button>
                    <button class="save-btn" @click="saveHabitEdit(h.id)">Save</button>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
        <p v-else class="empty-hint empty-hint--pad">No habits yet — add one above to start tracking.</p>

        <!-- ============ CONSISTENCY HEATMAP ============ -->
        <template v-if="allHabits.length">
          <div class="day-head day-head--section">
            <p class="eyebrow">Consistency · last 10 weeks</p>
          </div>
          <div class="detail-card heat-card">
            <div class="heat-grid">
              <span
                v-for="cell in heatCells"
                :key="cell.date"
                class="heat-cell"
                :class="{ 'heat-cell--future': cell.future }"
                :style="cell.future ? {} : { background: cell.color }"
                :title="`${cell.date}: ${cell.label}`"
              />
            </div>
            <div class="heat-legend">
              <span class="heat-legend__label">Less</span>
              <span v-for="(c, i) in HEAT_COLORS" :key="i" class="heat-cell heat-cell--legend" :style="{ background: c }" />
              <span class="heat-legend__label">More</span>
            </div>
          </div>
        </template>

        <!-- ============ GOALS ============ -->
        <div class="day-head day-head--section">
          <p class="eyebrow">Goals</p>
          <button class="icon-btn" @click="showAddGoal ? (resetGoalForm(), showAddGoal = false) : (showAddGoal = true)">
            {{ showAddGoal ? '✕' : '+' }}
          </button>
        </div>

        <div v-if="showAddGoal" class="detail-card add-form">
          <input v-model="goalName" class="form-input" placeholder="Goal name" />
          <div class="form-row">
            <input v-model="goalTarget" class="form-input" type="number" inputmode="decimal" placeholder="Target value" />
            <input v-model="goalDueDate" class="form-input form-input--time" type="date" title="Due date" />
          </div>
          <div class="form-row form-row--end">
            <button class="save-btn" @click="saveGoal">Add goal</button>
          </div>
        </div>

        <div v-if="activeGoals.length" class="goal-list">
          <div v-for="g in activeGoals" :key="g.id" class="detail-card goal-card">
            <div class="goal-card__top">
              <div class="goal-card__title">
                <strong>{{ g.name }}</strong>
                <span class="goal-meta">
                  {{ goalDueLabel(g) }}{{ linkedHabitCount(g.id) ? ` · ${linkedHabitCount(g.id)} linked habit${linkedHabitCount(g.id) === 1 ? '' : 's'}` : '' }}
                </span>
              </div>
              <span class="goal-pct">{{ Math.round(goalProgress(g) * 100) }}%</span>
            </div>
            <div class="goal-bar">
              <div class="goal-bar__fill" :style="{ width: `${goalProgress(g) * 100}%` }" />
            </div>
            <div class="goal-card__bottom">
              <span class="goal-values">{{ fmtNum(g.current_value) }} / {{ fmtNum(g.target_value) }}</span>
              <div class="goal-actions">
                <button class="ghost-btn" @click="bumpGoal(g, 1)">+1</button>
                <input
                  v-model="progressDrafts[g.id]"
                  class="form-input form-input--mini"
                  type="number"
                  inputmode="decimal"
                  placeholder="Set"
                />
                <button class="ghost-btn" @click="setGoalProgress(g)">Set</button>
                <button class="ghost-btn ghost-btn--success" @click="completeGoal(g)">Done</button>
                <button class="delete-btn" @click="removeGoal(g.id)">×</button>
              </div>
            </div>
          </div>
        </div>
        <p v-else-if="!completedGoals.length" class="empty-hint empty-hint--pad">No goals yet.</p>

        <div v-if="completedGoals.length" class="detail-card completed-card">
          <div class="detail-card__header">
            <h3>Completed</h3>
            <span class="header-count">{{ completedGoals.length }}</span>
          </div>
          <ul class="item-list">
            <li v-for="g in completedGoals" :key="g.id" class="item-row">
              <span class="item-tag item-tag--done">done</span>
              <div class="item-body">
                <strong class="goal-done-name">{{ g.name }}</strong>
                <span class="item-note">{{ fmtNum(g.current_value) }} / {{ fmtNum(g.target_value) }}</span>
              </div>
              <button class="delete-btn" @click="removeGoal(g.id)">×</button>
            </li>
          </ul>
        </div>

      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonContent, onIonViewWillEnter, toastController } from '@ionic/vue';
import { ref, computed, reactive, watch } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import { localDateISO } from '@/shared/utils/timeFormat';
import HealthSectionTabs from '@/features/health/components/HealthSectionTabs.vue';
import {
  addCalendarEvent,
  deleteCalendarEvent,
  getCalendarEventsForDate,
  getCalendarEventDatesForMonth,
  getHabitCompletedDatesForMonth,
  getGoalDueDatesForMonth,
  getHabitsWithStatus,
  getAllHabits,
  getHabitLogsForRange,
  toggleHabitCompletion,
  addHabit,
  updateHabit,
  deleteHabit,
  addGoal,
  getGoals,
  updateGoalProgress,
  incrementGoalProgressBy,
  deleteGoal,
  getTemplates,
  getWorkouts,
} from '@/shared/db/app_db';
import {
  isScheduledOn,
  shiftDate,
  currentStreak,
  bestStreak,
  completionRate,
} from '@/shared/utils/habitStats';

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const HEAT_COLORS = [
  'rgba(255,255,255,0.06)',
  'rgba(239,68,68,0.25)',
  'rgba(239,68,68,0.45)',
  'rgba(239,68,68,0.7)',
  'rgb(239,68,68)',
];

const todayStr = localDateISO();
const now = new Date();
const viewYear = ref(now.getFullYear());
const viewMonth = ref(now.getMonth());
const selectedDate = ref(todayStr);

// ---- data stores ----
const events = ref<Record<string, any>[]>([]);
const dayHabits = ref<Record<string, any>[]>([]);
const allHabits = ref<Record<string, any>[]>([]);
const goals = ref<Record<string, any>[]>([]);
const eventDates = ref<Set<string>>(new Set());
const habitDates = ref<Set<string>>(new Set());
const goalDates = ref<Set<string>>(new Set());
// habit_id -> set of completed dates over the last year
const logSets = ref<Map<number, Set<string>>>(new Map());

// ---- month grid ----
const monthLabel = computed(() =>
  new Date(viewYear.value, viewMonth.value, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
);
const yearMonthStr = computed(() => `${viewYear.value}-${String(viewMonth.value + 1).padStart(2, '0')}`);
const leadingBlanks = computed(() => new Date(viewYear.value, viewMonth.value, 1).getDay());

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
      hasGoal: goalDates.value.has(dateStr),
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

// ---- goals ----
const activeGoals = computed(() => goals.value.filter((g) => g.status !== 'completed'));
const completedGoals = computed(() => goals.value.filter((g) => g.status === 'completed'));
const goalsDueSelected = computed(() => activeGoals.value.filter((g) => g.due_date === selectedDate.value));
const progressDrafts = reactive<Record<number, string>>({});

const goalProgress = (g: Record<string, any>) => {
  const target = Number(g.target_value) || 0;
  if (!target) return 0;
  return Math.min(1, (Number(g.current_value) || 0) / target);
};

const fmtNum = (v: unknown) => {
  const n = Number(v) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

const goalDueLabel = (g: Record<string, any>) => {
  if (!g.due_date) return 'No due date';
  const diff = Math.round(
    (new Date(g.due_date + 'T12:00:00').getTime() - new Date(todayStr + 'T12:00:00').getTime()) / 86400000
  );
  if (diff < 0) return `Overdue by ${-diff}d`;
  if (diff === 0) return 'Due today';
  return `${diff}d left`;
};

const linkedHabitCount = (goalId: number) =>
  allHabits.value.filter((h) => h.goal_id === goalId).length;

const linkedGoalName = (h: Record<string, any>) => {
  if (h.goal_id === null || h.goal_id === undefined) return '';
  const goal = goals.value.find((x) => x.id === h.goal_id);
  return goal ? `→ ${goal.name}` : '';
};

// ---- habit stats ----
const logsFor = (habitId: number) => logSets.value.get(habitId) ?? new Set<string>();
const streakFor = (h: Record<string, any>, anchor: string) => currentStreak(h, logsFor(h.id), anchor);
const bestStreakFor = (h: Record<string, any>) => {
  const start = String(h.created_at ?? todayStr).slice(0, 10);
  return bestStreak(h, logsFor(h.id), start < shiftDate(todayStr, -365) ? shiftDate(todayStr, -365) : start, todayStr);
};
const rateFor = (h: Record<string, any>) => {
  const created = String(h.created_at ?? todayStr).slice(0, 10);
  const from = created > shiftDate(todayStr, -29) ? created : shiftDate(todayStr, -29);
  const rate = completionRate(h, logsFor(h.id), from, todayStr);
  return rate === null ? '—' : `${Math.round(rate * 100)}%`;
};
const isDone = (habitId: number, date: string) => logsFor(habitId).has(date);

// ---- week strip / mini grid ----
const weekDates = computed(() => {
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) dates.push(shiftDate(todayStr, -i));
  return dates;
});
const last28Dates = computed(() => {
  const dates: string[] = [];
  for (let i = 27; i >= 0; i--) dates.push(shiftDate(todayStr, -i));
  return dates;
});
const dowShort = (date: string) => DOW[new Date(date + 'T12:00:00').getDay()];

const dayDoneCount = computed(() => dayHabits.value.filter((h) => h.completed === 1).length);
const dayProgressPct = computed(() =>
  dayHabits.value.length ? (dayDoneCount.value / dayHabits.value.length) * 100 : 0
);

// ---- consistency heatmap (10 weeks, GitHub style: columns = weeks, rows = weekdays) ----
const heatCells = computed(() => {
  const todayDow = new Date(todayStr + 'T12:00:00').getDay();
  const weekStart = shiftDate(todayStr, -todayDow); // this week's Sunday
  const gridStart = shiftDate(weekStart, -7 * 9);
  const cells: { date: string; color: string; label: string; future: boolean }[] = [];
  // CSS grid fills row by row: row = weekday, column = week
  for (let dow = 0; dow < 7; dow++) {
    for (let week = 0; week < 10; week++) {
      const date = shiftDate(gridStart, week * 7 + dow);
      if (date > todayStr) {
        cells.push({ date, color: '', label: '', future: true });
        continue;
      }
      let scheduled = 0;
      let done = 0;
      for (const h of allHabits.value) {
        if (String(h.created_at ?? '').slice(0, 10) > date) continue;
        if (!isScheduledOn(h, date)) continue;
        scheduled++;
        if (isDone(h.id, date)) done++;
      }
      const ratio = scheduled === 0 ? 0 : done / scheduled;
      const bucket = ratio === 0 ? 0 : ratio < 0.34 ? 1 : ratio < 0.67 ? 2 : ratio < 1 ? 3 : 4;
      cells.push({
        date,
        color: HEAT_COLORS[bucket],
        label: scheduled === 0 ? 'no habits scheduled' : `${done}/${scheduled} habits`,
        future: false,
      });
    }
  }
  return cells;
});

// ---- event form ----
const showAddEvent = ref(false);
const newTitle = ref('');
const newType = ref('general');
const newNotes = ref('');
const newTimeStart = ref('');
const newTimeEnd = ref('');
const newRecurrence = ref('none');
const templates = ref<{ id: number; name: string }[]>([]);
const newWorkoutTemplateId = ref<number | null>(null);
const recommendedTemplateId = ref<number | null>(null);

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
  recommendedTemplateId.value = null;
};

const saveEvent = async () => {
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
    newRecurrence.value
  );
  resetEventForm();
  showAddEvent.value = false;
  await Promise.all([loadDayDetail(), loadMonthDots()]);
};

const removeEvent = async (id: number) => {
  await deleteCalendarEvent(id);
  await Promise.all([loadDayDetail(), loadMonthDots()]);
};

// ---- habit form ----
const showAddHabit = ref(false);
const habitName = ref('');
const habitTime = ref('');
const habitDays = ref<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6]));
const habitGoalId = ref<number | null>(null);
const expandedHabitId = ref<number | null>(null);

const editName = ref('');
const editTime = ref('');
const editDays = ref<Set<number>>(new Set());
const editGoalId = ref<number | null>(null);

const toggleHabitDay = (i: number) => {
  const next = new Set(habitDays.value);
  if (next.has(i)) { if (next.size > 1) next.delete(i); }
  else next.add(i);
  habitDays.value = next;
};
const toggleEditDay = (i: number) => {
  const next = new Set(editDays.value);
  if (next.has(i)) { if (next.size > 1) next.delete(i); }
  else next.add(i);
  editDays.value = next;
};

const daysToString = (days: Set<number>) =>
  days.size === 7 ? undefined : [...days].sort().join(',');

const resetHabitForm = () => {
  habitName.value = '';
  habitTime.value = '';
  habitDays.value = new Set([0, 1, 2, 3, 4, 5, 6]);
  habitGoalId.value = null;
};

const saveHabit = async () => {
  if (!habitName.value.trim()) {
    const t = await toastController.create({ message: 'Enter a habit name.', duration: 1800, color: 'warning' });
    await t.present();
    return;
  }
  const dow = daysToString(habitDays.value);
  await addHabit(
    habitName.value.trim(),
    dow ? 'custom' : 'daily',
    1,
    habitTime.value || undefined,
    dow,
    habitGoalId.value ?? undefined
  );
  resetHabitForm();
  showAddHabit.value = false;
  await loadAll();
};

watch(expandedHabitId, (id) => {
  if (id === null) return;
  const h = allHabits.value.find((x) => x.id === id);
  if (!h) return;
  editName.value = h.name;
  editTime.value = h.time ?? '';
  editDays.value = h.days_of_week
    ? new Set(String(h.days_of_week).split(',').map(Number))
    : new Set([0, 1, 2, 3, 4, 5, 6]);
  editGoalId.value = h.goal_id ?? null;
});

const saveHabitEdit = async (id: number) => {
  if (!editName.value.trim()) return;
  await updateHabit(
    id,
    editName.value.trim(),
    editTime.value || undefined,
    daysToString(editDays.value),
    editGoalId.value ?? undefined
  );
  expandedHabitId.value = null;
  await loadAll();
};

const removeHabit = async (id: number) => {
  await deleteHabit(id);
  expandedHabitId.value = null;
  await loadAll();
};

const toggleHabit = async (h: Record<string, any>, date: string) => {
  if (date > todayStr) return;
  const done = isDone(h.id, date);
  await toggleHabitCompletion(h.id, date, !done);
  await loadAll();
};

// ---- goal form / actions ----
const showAddGoal = ref(false);
const goalName = ref('');
const goalTarget = ref('');
const goalDueDate = ref('');

const resetGoalForm = () => {
  goalName.value = '';
  goalTarget.value = '';
  goalDueDate.value = '';
};

const saveGoal = async () => {
  if (!goalName.value.trim()) {
    const t = await toastController.create({ message: 'Goal name is required.', duration: 1800, color: 'warning' });
    await t.present();
    return;
  }
  const targetValue = Number(goalTarget.value);
  if (!Number.isFinite(targetValue) || targetValue <= 0) {
    const t = await toastController.create({ message: 'Target must be a positive number.', duration: 1800, color: 'warning' });
    await t.present();
    return;
  }
  await addGoal(goalName.value.trim(), targetValue, goalDueDate.value || undefined);
  resetGoalForm();
  showAddGoal.value = false;
  await loadAll();
};

const bumpGoal = async (g: Record<string, any>, delta: number) => {
  await incrementGoalProgressBy(g.id, delta);
  await loadAll();
};

const setGoalProgress = async (g: Record<string, any>) => {
  const parsed = Number(progressDrafts[g.id]);
  if (!Number.isFinite(parsed) || parsed < 0) {
    const t = await toastController.create({ message: 'Enter a valid progress value.', duration: 1800, color: 'warning' });
    await t.present();
    return;
  }
  await updateGoalProgress(g.id, parsed);
  progressDrafts[g.id] = '';
  await loadAll();
};

const completeGoal = async (g: Record<string, any>) => {
  await updateGoalProgress(g.id, Number(g.current_value) || 0, 'completed');
  await loadAll();
};

const removeGoal = async (id: number) => {
  await deleteGoal(id);
  await loadAll();
};

// ---- loaders ----
const loadMonthDots = async () => {
  const [evDates, habDates, glDates] = await Promise.all([
    getCalendarEventDatesForMonth(yearMonthStr.value),
    getHabitCompletedDatesForMonth(yearMonthStr.value),
    getGoalDueDatesForMonth(yearMonthStr.value),
  ]);
  eventDates.value = new Set(evDates);
  habitDates.value = new Set(habDates);
  goalDates.value = new Set(glDates);
};

const loadDayDetail = async () => {
  const [evs, habs] = await Promise.all([
    getCalendarEventsForDate(selectedDate.value),
    getHabitsWithStatus(selectedDate.value),
  ]);
  events.value = evs;
  dayHabits.value = habs;
};

const loadHabitsAndGoals = async () => {
  const [habs, gls, logs] = await Promise.all([
    getAllHabits(),
    getGoals(),
    getHabitLogsForRange(shiftDate(todayStr, -365), todayStr),
  ]);
  allHabits.value = habs;
  goals.value = gls;
  const sets = new Map<number, Set<string>>();
  for (const log of logs) {
    if (log.completed !== 1) continue;
    let set = sets.get(log.habit_id);
    if (!set) { set = new Set(); sets.set(log.habit_id, set); }
    set.add(log.date);
  }
  logSets.value = sets;
};

const loadAll = () => Promise.all([loadMonthDots(), loadDayDetail(), loadHabitsAndGoals()]);

watch(yearMonthStr, loadMonthDots);
watch(selectedDate, loadDayDetail);

onIonViewWillEnter(async () => {
  templates.value = await getTemplates();
  await loadAll();
});
</script>

<style scoped>
.planner-content {
  --background: #000;
}

.planner-shell {
  padding: 1rem 1rem 3rem;
  display: grid;
  gap: 0.85rem;
  max-width: 560px;
  margin: 0 auto;
}

/* Month navigation */
.month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.month-nav__label {
  font-size: 1.05rem;
  font-weight: 600;
  color: #fff;
}

.month-nav__btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 1.4rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

/* Calendar grid */
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.cal-dow {
  text-align: center;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
  padding-bottom: 4px;
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
  transition: background 0.15s;
}

.cal-cell--blank {
  cursor: default;
}

.cal-cell--today .cal-cell__num {
  color: var(--ion-color-accent-red);
  font-weight: 700;
}

.cal-cell--selected {
  background: var(--ion-color-accent-red) !important;
}

.cal-cell--selected .cal-cell__num {
  color: #fff;
  font-weight: 700;
}

.cal-cell:not(.cal-cell--blank):not(.cal-cell--selected):hover {
  background: rgba(255, 255, 255, 0.06);
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
  border-radius: 50%;
}

.dot--event { background: var(--ion-color-accent-red); }
.dot--habit { background: rgba(255, 255, 255, 0.5); }
.dot--goal  { background: rgb(255, 215, 0); }

.cal-cell--selected .dot--event { background: rgba(255, 255, 255, 0.9); }
.cal-cell--selected .dot--habit { background: rgba(255, 255, 255, 0.6); }

/* Section heads */
.eyebrow {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
}

.day-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.4rem;
}

.day-head--section {
  margin-top: 1rem;
}

.today-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.72rem;
  padding: 4px 10px;
  cursor: pointer;
}

/* Cards */
.detail-card {
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 1rem;
}

.detail-card--goal-due {
  border-color: rgba(255, 215, 0, 0.25);
}

.detail-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.detail-card__header h3 {
  margin: 0;
  font-size: 0.95rem;
  color: #fff;
}

.header-count {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.5);
}

.icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: none;
  color: #fff;
  font-size: 1.1rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

/* Forms */
.add-form {
  display: grid;
  gap: 0.5rem;
}

.form-row {
  display: flex;
  gap: 0.5rem;
}

.form-row--end {
  justify-content: flex-end;
}

.form-input,
.form-select {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 0.55rem 0.75rem;
  color: #fff;
  font-size: 0.9rem;
  outline: none;
  box-sizing: border-box;
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

.form-input--mini {
  width: 64px;
  padding: 0.35rem 0.5rem;
  font-size: 0.8rem;
}

.form-hint {
  margin: 0;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.35);
}

.time-sep {
  color: rgba(255, 255, 255, 0.4);
  font-size: 1rem;
  align-self: center;
  flex-shrink: 0;
}

.save-btn {
  padding: 0.55rem 1.1rem;
  border-radius: 8px;
  background: var(--ion-color-accent-red);
  border: none;
  color: #fff;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.ghost-btn {
  padding: 0.35rem 0.7rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.ghost-btn--success {
  border-color: rgba(34, 197, 94, 0.4);
  color: rgb(34, 197, 94);
}

.ghost-btn--danger {
  border-color: rgba(239, 68, 68, 0.4);
  color: var(--ion-color-accent-red);
}

/* Day-of-week picker */
.dow-picker {
  display: flex;
  gap: 0.35rem;
}

.dow-chip {
  flex: 1;
  padding: 0.4rem 0;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.dow-chip--active {
  background: var(--ion-color-accent-red);
  border-color: var(--ion-color-accent-red);
  color: #fff;
}

/* Item lists (events, goal deadlines) */
.item-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}

.item-row {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
}

.item-tag {
  flex-shrink: 0;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.6);
  margin-top: 2px;
}

.item-tag--workout  { background: rgba(239, 68, 68, 0.2);   color: var(--ion-color-accent-red); }
.item-tag--recovery { background: rgba(52, 211, 153, 0.15); color: rgb(52, 211, 153); }
.item-tag--school   { background: rgba(96, 165, 250, 0.18); color: rgb(96, 165, 250); }
.item-tag--sleep    { background: rgba(167, 139, 250, 0.18); color: rgb(167, 139, 250); }
.item-tag--reminder { background: rgba(251, 191, 36, 0.15); color: rgb(251, 191, 36); }
.item-tag--goal     { background: rgba(255, 215, 0, 0.15);  color: rgb(255, 215, 0); }
.item-tag--done     { background: rgba(34, 197, 94, 0.15);  color: rgb(34, 197, 94); }

.item-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-body strong {
  font-size: 0.9rem;
  color: #fff;
}

.goal-done-name {
  text-decoration: line-through;
  color: rgba(255, 255, 255, 0.55) !important;
}

.item-note {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.5);
}

.item-note--recur {
  color: rgba(255, 215, 0, 0.7);
}

.delete-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.3);
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
}

.delete-btn:hover {
  color: rgba(255, 255, 255, 0.7);
}

/* Day habits */
.day-progress {
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.day-progress__fill {
  height: 100%;
  border-radius: 2px;
  background: var(--ion-color-accent-red);
  transition: width 0.3s ease;
}

.habit-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.35rem 0;
  cursor: pointer;
}

.habit-check {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 1.5px solid rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 0.85rem;
  color: #fff;
  transition: background 0.15s, border-color 0.15s;
}

.habit-check--done {
  background: var(--ion-color-accent-red);
  border-color: var(--ion-color-accent-red);
}

.habit-row__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.habit-name {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.85);
}

.habit-sub {
  font-size: 0.72rem;
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
  color: var(--ion-color-accent-red);
  line-height: 1;
}

.streak-label {
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.35);
}

/* Habit board */
.board-card {
  padding: 0.85rem;
  overflow-x: auto;
}

.board-grid {
  display: grid;
  gap: 4px 3px;
  align-items: center;
}

.board-corner {
  min-width: 0;
}

.board-dow {
  text-align: center;
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.4);
}

.board-dow--today {
  color: var(--ion-color-accent-red);
  font-weight: 700;
}

.board-name {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  background: none;
  border: none;
  padding: 0 0.25rem 0 0;
  cursor: pointer;
  text-align: left;
  min-width: 0;
}

.board-name__text {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.85);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.board-name__streak {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--ion-color-accent-red);
  flex-shrink: 0;
}

.board-cell {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: 1.5px solid rgba(255, 255, 255, 0.15);
  background: none;
  color: #fff;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin: 0 auto;
  transition: background 0.15s, border-color 0.15s;
}

.board-cell--done {
  background: var(--ion-color-accent-red);
  border-color: var(--ion-color-accent-red);
}

.board-cell--off {
  border-color: rgba(255, 255, 255, 0.05);
  cursor: default;
}

.board-cell__dash {
  color: rgba(255, 255, 255, 0.15);
}

.board-expand {
  grid-column: 1 / -1;
  display: grid;
  gap: 0.6rem;
  padding: 0.75rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  margin-bottom: 0.35rem;
}

.stat-tiles {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.stat-tile {
  border-radius: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.05);
}

.stat-tile span {
  display: block;
  margin-bottom: 4px;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.5);
}

.stat-tile strong {
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
}

.mini-grid {
  display: grid;
  grid-template-columns: repeat(14, 1fr);
  gap: 3px;
}

.mini-cell {
  aspect-ratio: 1;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.06);
}

.mini-cell--done {
  background: var(--ion-color-accent-red);
}

.mini-cell--off {
  background: rgba(255, 255, 255, 0.02);
}

.edit-form {
  display: grid;
  gap: 0.5rem;
}

/* Heatmap */
.heat-card {
  display: grid;
  gap: 0.6rem;
}

.heat-grid {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 3px;
}

.heat-cell {
  aspect-ratio: 1;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.06);
}

.heat-cell--future {
  background: transparent;
}

.heat-cell--legend {
  width: 10px;
  height: 10px;
  aspect-ratio: auto;
}

.heat-legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
}

.heat-legend__label {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.35);
  margin: 0 4px;
}

/* Goals */
.goal-list {
  display: grid;
  gap: 0.6rem;
}

.goal-card {
  display: grid;
  gap: 0.6rem;
}

.goal-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.goal-card__title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.goal-card__title strong {
  font-size: 0.95rem;
  color: #fff;
}

.goal-meta {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.45);
}

.goal-pct {
  font-size: 1rem;
  font-weight: 700;
  color: var(--ion-color-accent-red);
  flex-shrink: 0;
}

.goal-bar {
  height: 5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.goal-bar__fill {
  height: 100%;
  border-radius: 3px;
  background: var(--ion-color-accent-red);
  transition: width 0.3s ease;
}

.goal-card__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.goal-values {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.6);
}

.goal-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.completed-card {
  opacity: 0.8;
}

.empty-hint {
  margin: 0;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.35);
}

.empty-hint--pad {
  padding: 0.5rem 0.25rem;
}
</style>
