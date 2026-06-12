import { ref, computed, reactive, watch } from 'vue';
import { onIonViewWillEnter, toastController } from '@ionic/vue';
import { localDateISO } from '@/shared/utils/timeFormat';
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

/**
 * Shared Planner logic (calendar events, habits + streak stats, goals).
 * Backs the separate Calendar / Habits / Goals pages so they all use the
 * same updated logic. Each page renders only the slice of state it needs.
 */
export function usePlanner() {
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

  return {
    // consts
    DOW,
    HEAT_COLORS,
    isScheduledOn,
    // month grid
    todayStr,
    selectedDate,
    monthLabel,
    leadingBlanks,
    calendarCells,
    selectedDateLabel,
    prevMonth,
    nextMonth,
    // goals
    activeGoals,
    completedGoals,
    goalsDueSelected,
    progressDrafts,
    goalProgress,
    fmtNum,
    goalDueLabel,
    linkedHabitCount,
    linkedGoalName,
    // habit stats
    streakFor,
    bestStreakFor,
    rateFor,
    isDone,
    // week strip / heatmap
    weekDates,
    last28Dates,
    dowShort,
    dayHabits,
    dayDoneCount,
    dayProgressPct,
    heatCells,
    // event form
    showAddEvent,
    newTitle,
    newType,
    newNotes,
    newTimeStart,
    newTimeEnd,
    newRecurrence,
    templates,
    newWorkoutTemplateId,
    recommendedTemplateId,
    resetEventForm,
    saveEvent,
    events,
    removeEvent,
    // habit form
    showAddHabit,
    habitName,
    habitTime,
    habitDays,
    habitGoalId,
    expandedHabitId,
    editName,
    editTime,
    editDays,
    editGoalId,
    allHabits,
    toggleHabitDay,
    toggleEditDay,
    resetHabitForm,
    saveHabit,
    saveHabitEdit,
    removeHabit,
    toggleHabit,
    // goal form / actions
    showAddGoal,
    goalName,
    goalTarget,
    goalDueDate,
    resetGoalForm,
    saveGoal,
    bumpGoal,
    setGoalProgress,
    completeGoal,
    removeGoal,
  };
}
