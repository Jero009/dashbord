import { ref, computed, reactive, watch } from 'vue';
import { onIonViewWillEnter, toastController, actionSheetController } from '@ionic/vue';
import { localDateISO } from '@/shared/utils/timeFormat';
import {
  addCalendarEvent,
  updateCalendarEvent,
  searchCalendarEvents,
  getCalendarEventsInRange,
  deleteCalendarEvent,
  stopCalendarEventAt,
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
  recomputeLinkedGoals,
  getExercises,
  getFinanceAccounts,
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
import { goalProgressFraction, type GoalLike } from '@/shared/utils/goalProgress';
import { cancelCalendarReminders } from '@/shared/utils/notifications';
import { recurrenceLabel } from '@/shared/utils/recurrence';

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Calendar view modes for the view switcher (month grid / week / day / agenda list).
export type CalendarViewMode = 'month' | 'week' | 'day' | 'agenda';

// Restrained data-encoding palette for event color-coding (Nothing-friendly:
// muted, one-per-purpose). Empty value = fall back to the event type's color.
const EVENT_COLORS = [
  { name: 'Default', value: '' },
  { name: 'Red', value: '#D71A21' },
  { name: 'Amber', value: '#E0A82E' },
  { name: 'Green', value: '#22C55E' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Violet', value: '#8B5CF6' },
  { name: 'Slate', value: '#94A3B8' },
];
const HEAT_COLORS = [
  'rgba(var(--nt-ink), 0.06)',
  'rgba(215, 26, 33,0.25)',
  'rgba(215, 26, 33,0.45)',
  'rgba(215, 26, 33,0.7)',
  'rgb(215, 26, 33)',
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
  const viewMode = ref<CalendarViewMode>('month');

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

  // ---- week / day / agenda views ----
  // Range events: every concrete occurrence within the currently-viewed window,
  // already expanded by the recurrence engine (each row carries its own `date`).
  const rangeEvents = ref<Record<string, any>[]>([]);

  // The 7 dates (Sun→Sat) of the week containing the selected date.
  const calWeekDates = computed(() => {
    const dow = new Date(selectedDate.value + 'T12:00:00').getDay();
    const start = shiftDate(selectedDate.value, -dow);
    return Array.from({ length: 7 }, (_, i) => shiftDate(start, i));
  });

  const weekRangeLabel = computed(() => {
    const a = new Date(calWeekDates.value[0] + 'T12:00:00');
    const b = new Date(calWeekDates.value[6] + 'T12:00:00');
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(a)} – ${fmt(b)}`;
  });

  // Per-day buckets for the week view.
  const weekColumns = computed(() =>
    calWeekDates.value.map((date) => ({
      date,
      day: Number(date.slice(8, 10)),
      dow: DOW[new Date(date + 'T12:00:00').getDay()],
      isToday: date === todayStr,
      events: rangeEvents.value.filter((e) => e.date === date),
    }))
  );

  // Upcoming events grouped by date (agenda view), only days that have events.
  const agendaGroups = computed(() => {
    const groups: { date: string; label: string; events: Record<string, any>[] }[] = [];
    const byDate = new Map<string, Record<string, any>[]>();
    for (const e of rangeEvents.value) {
      if (!byDate.has(e.date)) byDate.set(e.date, []);
      byDate.get(e.date)!.push(e);
    }
    for (const date of [...byDate.keys()].sort()) {
      groups.push({
        date,
        label: new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
        }),
        events: byDate.get(date)!,
      });
    }
    return groups;
  });

  const setViewMode = (mode: CalendarViewMode) => { viewMode.value = mode; };

  // Period navigation honouring the active view (month / week / day).
  const goPrev = () => {
    if (viewMode.value === 'month') prevMonth();
    else if (viewMode.value === 'week') selectedDate.value = shiftDate(selectedDate.value, -7);
    else if (viewMode.value === 'day') selectedDate.value = shiftDate(selectedDate.value, -1);
  };
  const goNext = () => {
    if (viewMode.value === 'month') nextMonth();
    else if (viewMode.value === 'week') selectedDate.value = shiftDate(selectedDate.value, 7);
    else if (viewMode.value === 'day') selectedDate.value = shiftDate(selectedDate.value, 1);
  };
  const periodLabel = computed(() =>
    viewMode.value === 'month' ? monthLabel.value
      : viewMode.value === 'week' ? weekRangeLabel.value
      : selectedDateLabel.value
  );

  // ---- goals ----
  const activeGoals = computed(() => goals.value.filter((g) => g.status !== 'completed'));
  const completedGoals = computed(() => goals.value.filter((g) => g.status === 'completed'));
  const goalsDueSelected = computed(() => activeGoals.value.filter((g) => g.due_date === selectedDate.value));
  const progressDrafts = reactive<Record<number, string>>({});

  const goalProgress = (g: Record<string, any>) => goalProgressFraction(g as GoalLike);

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
  const editingEventId = ref<number | null>(null); // null = adding, else editing this id
  const newTitle = ref('');
  const newType = ref('general');
  const newNotes = ref('');
  const newTimeStart = ref('');
  const newTimeEnd = ref('');
  const newAllDay = ref(false);
  const newColor = ref('');
  const newRecurrence = ref('none');
  const newRecurInterval = ref(1);
  const newRecurDays = ref<Set<number>>(new Set());
  const newRecurEnd = ref<'never' | 'until' | 'count'>('never');
  const newRecurUntil = ref('');
  const newRecurCount = ref<number | null>(null);
  const templates = ref<{ id: number; name: string }[]>([]);
  const newWorkoutTemplateId = ref<number | null>(null);
  const recommendedTemplateId = ref<number | null>(null);

  const toggleRecurDay = (i: number) => {
    const next = new Set(newRecurDays.value);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    newRecurDays.value = next;
  };

  // Resolve an event's display color: explicit custom color, else empty so the
  // CSS type class (item-tag--<type>) supplies it.
  const eventColor = (ev: Record<string, any>) => (ev.color ? String(ev.color) : '');
  const recurLabel = (ev: Record<string, any>) => recurrenceLabel(ev as any);

  // Overnight when the end time is at/before the start (e.g. 19:00 → 05:00):
  // the end belongs to the next day. Matches the battery-drain duration logic.
  const isOvernight = (ev: Record<string, any>) =>
    !ev.all_day && !!ev.time_start && !!ev.time_end && ev.time_end <= ev.time_start;

  // Single source of truth for an event's time label across all views, including
  // overnight segments: a "tail" shows the carried-over end; a spanning start
  // shows the (+1 day) marker.
  const eventTimeLabel = (ev: Record<string, any>) => {
    if (ev.all_day) return 'All day';
    if (ev.continued_from_prev_day) return `cont. until ${ev.time_end}`;
    if (!ev.time_start) return '';
    if (!ev.time_end) return String(ev.time_start);
    const range = `${ev.time_start} – ${ev.time_end}`;
    return (ev.continues_next_day || isOvernight(ev)) ? `${range} (+1 day)` : range;
  };

  // ---- day-view timeline (mirrors the HomePage schedule timeline) ----
  const HOUR_PX = 52;
  const parseHourStr = (t: string) => {
    const [h, m] = (t || '').split(':').map(Number);
    // A malformed time (empty or non-HH:MM) must not leak NaN into the day-view
    // SVG geometry — treat it as midnight.
    return Number.isFinite(h) ? h + (Number.isFinite(m) ? m : 0) / 60 : 0;
  };
  // Tail segments anchor at 00:00; overnight start segments run to 24:00.
  const segStartHour = (e: Record<string, any>) =>
    e.continued_from_prev_day ? 0 : parseHourStr(e.time_start);
  const segEndHour = (e: Record<string, any>) => {
    if (e.continued_from_prev_day) return parseHourStr(e.time_end);
    if (!e.time_end) return segStartHour(e) + 1;
    const end = parseHourStr(e.time_end);
    return end <= parseHourStr(e.time_start) ? 24 : end; // overnight → midnight
  };

  const timedDayEvents = computed(() => events.value.filter((e) => e.time_start && !e.all_day));

  const dayTlStart = computed(() => {
    const times = [
      ...timedDayEvents.value.map(segStartHour),
      ...dayHabits.value.filter((h) => h.time).map((h) => parseHourStr(h.time)),
    ];
    return times.length ? Math.max(0, Math.floor(Math.min(...times)) - 0.5) : 6;
  });
  const dayTlEnd = computed(() => {
    const times = [
      ...timedDayEvents.value.map(segEndHour),
      ...dayHabits.value.filter((h) => h.time).map((h) => parseHourStr(h.time) + 0.25),
    ];
    return times.length ? Math.min(24, Math.ceil(Math.max(...times)) + 0.5) : 22;
  });
  const dayHourToY = (h: number) => (h - dayTlStart.value) * HOUR_PX;
  const dayTlHeight = computed(() => (dayTlEnd.value - dayTlStart.value) * HOUR_PX);
  const dayVisibleHours = computed(() => {
    const s = Math.ceil(dayTlStart.value);
    const e = Math.floor(dayTlEnd.value);
    return Array.from({ length: Math.max(0, e - s + 1) }, (_, i) => s + i);
  });
  const dayTimedEvents = computed<Record<string, any>[]>(() =>
    timedDayEvents.value
      .map((e) => ({
        ...e,
        top: dayHourToY(segStartHour(e)),
        height: Math.max(34, (segEndHour(e) - segStartHour(e)) * HOUR_PX),
        timeLabel: eventTimeLabel(e),
      }))
      .sort((a, b) => a.top - b.top)
  );
  const dayTimedHabits = computed<Record<string, any>[]>(() =>
    dayHabits.value
      .filter((h) => h.time)
      .map((h) => ({ ...h, top: dayHourToY(parseHourStr(h.time)) }))
      .sort((a, b) => a.top - b.top)
  );
  const dayAllDayEvents = computed(() => events.value.filter((e) => e.all_day || !e.time_start));
  const dayHasTimeline = computed(() => dayTimedEvents.value.length > 0 || dayTimedHabits.value.length > 0);
  const dayNowY = computed(() => {
    if (selectedDate.value !== todayStr) return -1;
    const now = new Date();
    const h = now.getHours() + now.getMinutes() / 60;
    if (h < dayTlStart.value || h > dayTlEnd.value) return -1;
    return dayHourToY(h);
  });

  const computeRecommendation = async (timeStart: string) => {
    if (!templates.value.length) return;
    const workouts = await getWorkouts();
    const hourMatch = timeStart ? parseInt(timeStart.split(':')[0]) : null;

    const lastUsed: Record<number, string> = {};
    for (const w of workouts as any[]) {
      if (!w.id_workout_template || !w.time_end) continue;
      const startMs = new Date(w.time_start).getTime();
      if (hourMatch !== null) {
        if (!Number.isFinite(startMs)) continue;
        if (Math.abs(new Date(startMs).getHours() - hourMatch) > 3) continue;
      }
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
    editingEventId.value = null;
    newTitle.value = '';
    newNotes.value = '';
    newType.value = 'general';
    newTimeStart.value = '';
    newTimeEnd.value = '';
    newAllDay.value = false;
    newColor.value = '';
    newWorkoutTemplateId.value = null;
    newRecurrence.value = 'none';
    newRecurInterval.value = 1;
    newRecurDays.value = new Set();
    newRecurEnd.value = 'never';
    newRecurUntil.value = '';
    newRecurCount.value = null;
    recommendedTemplateId.value = null;
  };

  // Populate the form from an existing event row and switch into edit mode.
  const beginEditEvent = (ev: Record<string, any>) => {
    resetEventForm();
    editingEventId.value = ev.id;
    selectedDate.value = ev.base_date || ev.date;
    newTitle.value = ev.title ?? '';
    newNotes.value = ev.notes ?? '';
    newType.value = ev.type ?? 'general';
    newTimeStart.value = ev.time_start ?? '';
    newTimeEnd.value = ev.time_end ?? '';
    newAllDay.value = ev.all_day === 1 || ev.all_day === true;
    newColor.value = ev.color ?? '';
    newWorkoutTemplateId.value = ev.workout_template_id ?? null;
    newRecurrence.value = ev.recurrence ?? 'none';
    newRecurInterval.value = Number(ev.recur_interval) || 1;
    newRecurDays.value = ev.recur_days
      ? new Set(String(ev.recur_days).split(',').map(Number))
      : new Set();
    if (ev.recur_count) { newRecurEnd.value = 'count'; newRecurCount.value = Number(ev.recur_count); }
    else if (ev.end_date) { newRecurEnd.value = 'until'; newRecurUntil.value = ev.end_date; }
    else { newRecurEnd.value = 'never'; }
    showAddEvent.value = true;
  };

  const saveEvent = async () => {
    if (!newTitle.value.trim()) {
      const t = await toastController.create({ message: 'Add a title.', duration: 1800, color: 'warning' });
      await t.present();
      return;
    }
    const recurring = newRecurrence.value !== 'none';
    const payload = {
      title: newTitle.value.trim(),
      date: selectedDate.value,
      type: newType.value,
      notes: newNotes.value.trim() || null,
      timeStart: newTimeStart.value || null,
      timeEnd: newTimeEnd.value || null,
      allDay: newAllDay.value,
      color: newColor.value || null,
      workoutTemplateId: newWorkoutTemplateId.value ?? null,
      recurrence: newRecurrence.value,
      recurInterval: recurring ? newRecurInterval.value : 1,
      recurDays: recurring && newRecurrence.value === 'weekly' && newRecurDays.value.size
        ? [...newRecurDays.value].sort().join(',')
        : null,
      endDate: recurring && newRecurEnd.value === 'until' ? (newRecurUntil.value || null) : null,
      recurCount: recurring && newRecurEnd.value === 'count' ? (newRecurCount.value || null) : null,
    };
    if (editingEventId.value !== null) {
      // Re-scheduling can move the time; clear the old reminder so it re-arms.
      await cancelCalendarReminders([editingEventId.value]);
      await updateCalendarEvent(editingEventId.value, payload);
    } else {
      await addCalendarEvent(payload);
    }
    resetEventForm();
    showAddEvent.value = false;
    await Promise.all([loadDayDetail(), loadMonthDots(), loadRangeEvents()]);
  };

  const refreshAfterEventChange = () =>
    Promise.all([loadDayDetail(), loadMonthDots(), loadRangeEvents()]);

  // Delete an event. For a recurring series, ask whether to remove the whole
  // series or just this occurrence onward (the latter caps the series the day
  // before the selected occurrence via end_date — history is preserved).
  const removeEvent = async (ev: Record<string, any> | number) => {
    const id = typeof ev === 'number' ? ev : ev.id;
    const recurrence = typeof ev === 'number' ? null : ev.recurrence;

    if (!recurrence || recurrence === 'none') {
      await deleteCalendarEvent(id);
      await cancelCalendarReminders([id]); // stop any scheduled reminder firing
      await refreshAfterEventChange();
      return;
    }

    const sheet = await actionSheetController.create({
      header: 'Delete recurring event',
      cssClass: 'app-action-sheet',
      buttons: [
        { text: 'Delete all occurrences', role: 'destructive', data: 'all' },
        { text: 'Delete this and future occurrences', data: 'future' },
        { text: 'Cancel', role: 'cancel', data: 'cancel' },
      ],
    });
    await sheet.present();
    const { data } = await sheet.onDidDismiss();

    if (data === 'all') {
      await deleteCalendarEvent(id);
    } else if (data === 'future') {
      const base = (typeof ev === 'number' ? '' : (ev.base_date || ev.date)) as string;
      // Stopping at/before the first occurrence leaves nothing — delete the row.
      if (selectedDate.value <= base) await deleteCalendarEvent(id);
      else await stopCalendarEventAt(id, shiftDate(selectedDate.value, -1));
    } else {
      return; // cancelled
    }
    await cancelCalendarReminders([id]);
    await refreshAfterEventChange();
  };

  // Delete the event currently open in the edit form (used by the day-view
  // timeline, which has no per-row delete button). Reconstructs the minimal row
  // removeEvent needs to detect recurrence.
  const deleteEditingEvent = async () => {
    if (editingEventId.value === null) return;
    await removeEvent({
      id: editingEventId.value,
      recurrence: newRecurrence.value,
      base_date: selectedDate.value,
      date: selectedDate.value,
    });
    resetEventForm();
    showAddEvent.value = false;
  };

  // ---- search ----
  const searchQuery = ref('');
  const searchResults = ref<Record<string, any>[]>([]);
  let searchToken = 0;
  const runSearch = async () => {
    const token = ++searchToken;
    const q = searchQuery.value.trim();
    if (!q) { searchResults.value = []; return; }
    const res = await searchCalendarEvents(q);
    if (token !== searchToken) return;
    searchResults.value = res as Record<string, any>[];
  };
  watch(searchQuery, runSearch);

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
  // Optional link to live data: '' = manual goal, else weight | lift_pr | savings.
  const goalLinkType = ref<'' | 'weight' | 'lift_pr' | 'savings'>('');
  const goalLinkRef = ref('');
  // Picker options for lift_pr / savings links.
  const linkExerciseOptions = ref<{ id: number; name: string }[]>([]);
  const linkAccountOptions = ref<{ id: number; name: string }[]>([]);

  const resetGoalForm = () => {
    goalName.value = '';
    goalTarget.value = '';
    goalDueDate.value = '';
    goalLinkType.value = '';
    goalLinkRef.value = '';
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
    const linkType = goalLinkType.value || null;
    // lift_pr / savings need a chosen reference; weight needs none.
    const needsRef = linkType === 'lift_pr' || linkType === 'savings';
    if (needsRef && !goalLinkRef.value) {
      const t = await toastController.create({ message: 'Choose what to link this goal to.', duration: 1800, color: 'warning' });
      await t.present();
      return;
    }
    const linkRef = needsRef ? goalLinkRef.value : null;
    await addGoal(goalName.value.trim(), targetValue, goalDueDate.value || undefined, linkType, linkRef);
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
  // Monotonic tokens guard against out-of-order responses: rapid month-nav or
  // day-selection fires these concurrently, and a slow earlier query must not
  // overwrite the result of a later one.
  let monthDotsToken = 0;
  let dayDetailToken = 0;
  let rangeToken = 0;

  // Load expanded occurrences for the active view's window (week strip / agenda
  // horizon). Month uses dots and Day uses the day-detail list, so for those we
  // only need the selected day.
  const loadRangeEvents = async () => {
    const token = ++rangeToken;
    let start = selectedDate.value;
    let end = selectedDate.value;
    if (viewMode.value === 'week') { start = calWeekDates.value[0]; end = calWeekDates.value[6]; }
    else if (viewMode.value === 'agenda') { start = todayStr; end = shiftDate(todayStr, 45); }
    const res = await getCalendarEventsInRange(start, end);
    if (token !== rangeToken) return;
    rangeEvents.value = res as Record<string, any>[];
  };

  const loadMonthDots = async () => {
    const token = ++monthDotsToken;
    const [evDates, habDates, glDates] = await Promise.all([
      getCalendarEventDatesForMonth(yearMonthStr.value),
      getHabitCompletedDatesForMonth(yearMonthStr.value),
      getGoalDueDatesForMonth(yearMonthStr.value),
    ]);
    if (token !== monthDotsToken) return;
    eventDates.value = new Set(evDates);
    habitDates.value = new Set(habDates);
    goalDates.value = new Set(glDates);
  };

  const loadDayDetail = async () => {
    const token = ++dayDetailToken;
    const [evs, habs] = await Promise.all([
      getCalendarEventsForDate(selectedDate.value, true), // include overnight tails for the day view
      getHabitsWithStatus(selectedDate.value),
    ]);
    if (token !== dayDetailToken) return;
    events.value = evs;
    dayHabits.value = habs;
  };

  const loadHabitsAndGoals = async () => {
    // Refresh linked goals from live data (weight / lift PR / savings) before reading.
    await recomputeLinkedGoals();
    const [habs, gls, logs, exs, accts] = await Promise.all([
      getAllHabits(),
      getGoals(),
      getHabitLogsForRange(shiftDate(todayStr, -365), todayStr),
      getExercises(),
      getFinanceAccounts(),
    ]);
    allHabits.value = habs;
    goals.value = gls;
    linkExerciseOptions.value = (exs as { id: number; name: string }[]).map((e) => ({ id: e.id, name: e.name }));
    linkAccountOptions.value = (accts as { id: number; name: string }[]).map((a) => ({ id: a.id, name: a.name }));
    const sets = new Map<number, Set<string>>();
    for (const log of logs) {
      if (log.completed !== 1) continue;
      let set = sets.get(log.habit_id);
      if (!set) { set = new Set(); sets.set(log.habit_id, set); }
      set.add(log.date);
    }
    logSets.value = sets;
  };

  const loadAll = () => Promise.all([loadMonthDots(), loadDayDetail(), loadHabitsAndGoals(), loadRangeEvents()]);

  watch(yearMonthStr, loadMonthDots);
  watch(selectedDate, loadDayDetail);
  watch([viewMode, selectedDate], loadRangeEvents);

  onIonViewWillEnter(async () => {
    templates.value = await getTemplates();
    await loadAll();
  });

  return {
    // consts
    DOW,
    HEAT_COLORS,
    EVENT_COLORS,
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
    // view switching + week/day/agenda
    viewMode,
    setViewMode,
    goPrev,
    goNext,
    periodLabel,
    calWeekDates,
    weekRangeLabel,
    weekColumns,
    agendaGroups,
    rangeEvents,
    // search
    searchQuery,
    searchResults,
    runSearch,
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
    editingEventId,
    newTitle,
    newType,
    newNotes,
    newTimeStart,
    newTimeEnd,
    newAllDay,
    newColor,
    newRecurrence,
    newRecurInterval,
    newRecurDays,
    newRecurEnd,
    newRecurUntil,
    newRecurCount,
    toggleRecurDay,
    templates,
    newWorkoutTemplateId,
    recommendedTemplateId,
    resetEventForm,
    beginEditEvent,
    saveEvent,
    deleteEditingEvent,
    events,
    removeEvent,
    eventColor,
    recurLabel,
    isOvernight,
    eventTimeLabel,
    // day-view timeline
    dayTlHeight,
    dayVisibleHours,
    dayHourToY,
    dayTimedEvents,
    dayTimedHabits,
    dayAllDayEvents,
    dayHasTimeline,
    dayNowY,
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
    goalLinkType,
    goalLinkRef,
    linkExerciseOptions,
    linkAccountOptions,
    resetGoalForm,
    saveGoal,
    bumpGoal,
    setGoalProgress,
    completeGoal,
    removeGoal,
  };
}
