<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <plan-section-tabs />
    </ion-header>
    <ion-content :fullscreen="true" class="planner-content">
      <div class="planner-shell">

        <!-- ============ VIEW SWITCHER ============ -->
        <div class="cal-views">
          <button
            v-for="v in viewTabs"
            :key="v.value"
            class="cal-view-tab"
            :class="{ 'cal-view-tab--active': viewMode === v.value }"
            @click="setViewMode(v.value)"
          >{{ v.label }}</button>
        </div>

        <!-- ============ SEARCH ============ -->
        <div class="cal-search">
          <ion-icon :icon="searchOutline" class="cal-search__icon" />
          <input v-model="searchQuery" class="cal-search__input" placeholder="Search events" />
          <button v-if="searchQuery" class="cal-search__clear" aria-label="Clear search" @click="searchQuery = ''">
            <ion-icon :icon="closeOutline" />
          </button>
        </div>

        <!-- ============ SEARCH RESULTS ============ -->
        <div v-if="searchQuery" class="detail-card">
          <div class="detail-card__header"><h3>Results</h3><span class="header-count">{{ searchResults.length }}</span></div>
          <ul v-if="searchResults.length" class="item-list">
            <li v-for="ev in searchResults" :key="ev.id" class="item-row" @click="beginEditEvent(ev)">
              <span class="item-tag" :class="`item-tag--${ev.type}`" :style="tagStyle(ev)">{{ ev.type }}</span>
              <div class="item-body">
                <strong>{{ ev.title }}</strong>
                <span class="item-note">{{ ev.date }}{{ ev.time_start ? ' · ' + ev.time_start : '' }}</span>
                <span v-if="ev.notes" class="item-note">{{ ev.notes }}</span>
              </div>
            </li>
          </ul>
          <p v-else class="empty-hint">No events match "{{ searchQuery }}"</p>
        </div>

        <!-- ============ VIEWS (hidden while searching) ============ -->
        <template v-if="!searchQuery">
          <!-- period nav -->
          <div class="month-nav">
            <button class="month-nav__btn" @click="goPrev">&#8249;</button>
            <span class="month-nav__label">{{ periodLabel }}</span>
            <button class="month-nav__btn" @click="goNext">&#8250;</button>
          </div>

          <!-- MONTH GRID -->
          <div v-if="viewMode === 'month'" class="cal-grid">
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

          <!-- WEEK VIEW -->
          <div v-else-if="viewMode === 'week'" class="week-view">
            <div
              v-for="col in weekColumns"
              :key="col.date"
              class="week-col"
              :class="{ 'week-col--today': col.isToday, 'week-col--selected': col.date === selectedDate }"
              @click="selectedDate = col.date"
            >
              <div class="week-col__head">
                <span class="week-col__dow">{{ col.dow }}</span>
                <span class="week-col__day">{{ col.day }}</span>
              </div>
              <div class="week-col__events">
                <div
                  v-for="ev in col.events"
                  :key="ev.id + '-' + ev.date"
                  class="week-chip"
                  :class="`item-tag--${ev.type}`"
                  :style="chipStyle(ev)"
                  @click.stop="beginEditEvent(ev)"
                >
                  <span v-if="!ev.all_day && ev.time_start" class="week-chip__time">{{ ev.time_start }}{{ isOvernight(ev) ? ' +1' : '' }}</span>
                  <span v-else-if="ev.all_day" class="week-chip__time">all-day</span>
                  <span class="week-chip__title">{{ ev.title }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- AGENDA VIEW -->
          <div v-else-if="viewMode === 'agenda'" class="agenda-view">
            <div v-if="!agendaGroups.length" class="detail-card">
              <p class="empty-hint">Nothing scheduled in the next 45 days</p>
            </div>
            <div v-for="grp in agendaGroups" :key="grp.date" class="agenda-group">
              <div class="agenda-group__date" :class="{ 'agenda-group__date--today': grp.date === todayStr }">
                {{ grp.label }}
              </div>
              <ul class="item-list">
                <li v-for="ev in grp.events" :key="ev.id + '-' + ev.date" class="item-row" @click="beginEditEvent(ev)">
                  <span class="item-tag" :class="`item-tag--${ev.type}`" :style="tagStyle(ev)">{{ ev.type }}</span>
                  <div class="item-body">
                    <strong>{{ ev.title }}</strong>
                    <span class="item-note">{{ eventTimeLabel(ev) || 'No time' }}</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <!-- ============ SELECTED DAY (month / week / day) ============ -->
          <template v-if="viewMode !== 'agenda'">
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
                <button class="icon-btn" :aria-label="showAddEvent ? 'Close form' : 'Add event'" @click="onToggleForm">
                  <ion-icon :icon="showAddEvent ? closeOutline : addOutline" />
                </button>
              </div>

              <div v-if="showAddEvent" class="add-form">
                <div v-if="editingEventId !== null" class="edit-banner">Editing event</div>
                <input v-model="newTitle" class="form-input" placeholder="Event title" />

                <label class="allday-row">
                  <input type="checkbox" v-model="newAllDay" />
                  <span>All-day</span>
                </label>

                <div v-if="!newAllDay" class="form-row">
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
                    <option value="daily">Daily</option>
                    <option value="weekdays">Weekdays</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                <!-- Recurrence detail -->
                <template v-if="newRecurrence !== 'none' && newRecurrence !== 'weekdays'">
                  <div class="form-row recur-interval">
                    <span class="recur-label">Every</span>
                    <input v-model.number="newRecurInterval" class="form-input form-input--num" type="number" min="1" />
                    <span class="recur-label">{{ intervalUnit }}</span>
                  </div>
                </template>

                <div v-if="newRecurrence === 'weekly'" class="recur-days">
                  <button
                    v-for="(d, i) in DOW"
                    :key="d"
                    type="button"
                    class="recur-day"
                    :class="{ 'recur-day--on': newRecurDays.has(i) }"
                    @click="toggleRecurDay(i)"
                  >{{ d }}</button>
                </div>

                <template v-if="newRecurrence !== 'none'">
                  <div class="form-row recur-end">
                    <select v-model="newRecurEnd" class="form-select">
                      <option value="never">Never ends</option>
                      <option value="until">Until date</option>
                      <option value="count">After N times</option>
                    </select>
                    <input v-if="newRecurEnd === 'until'" v-model="newRecurUntil" class="form-input form-input--time" type="date" />
                    <input v-if="newRecurEnd === 'count'" v-model.number="newRecurCount" class="form-input form-input--num" type="number" min="1" placeholder="times" />
                  </div>
                </template>

                <div v-if="newType === 'workout'" class="form-row">
                  <select v-model="newWorkoutTemplateId" class="form-select">
                    <option :value="null">No template</option>
                    <option v-for="t in templates" :key="t.id" :value="t.id">
                      {{ t.name }}{{ t.id === recommendedTemplateId ? ' (recommended)' : '' }}
                    </option>
                  </select>
                </div>

                <!-- Color picker -->
                <div class="color-row">
                  <button
                    v-for="c in EVENT_COLORS"
                    :key="c.name"
                    type="button"
                    class="color-swatch"
                    :class="{ 'color-swatch--on': newColor === c.value, 'color-swatch--default': c.value === '' }"
                    :style="c.value ? { background: c.value } : {}"
                    :title="c.name"
                    @click="newColor = c.value"
                  >
                    <ion-icon v-if="newColor === c.value" :icon="checkmarkOutline" />
                  </button>
                </div>

                <input v-model="newNotes" class="form-input" placeholder="Notes (optional)" />
                <div class="form-row form-row--end">
                  <button v-if="editingEventId !== null" class="delete-text-btn" @click="deleteEditingEvent">Delete</button>
                  <button class="save-btn" @click="saveEvent">{{ editingEventId !== null ? 'Update' : 'Save' }}</button>
                </div>
              </div>

              <ul v-if="viewMode !== 'day' && events.length" class="item-list">
                <li v-for="ev in events" :key="ev.id + '-' + (ev.seg || 'x')" class="item-row">
                  <span class="item-tag" :class="`item-tag--${ev.type}`" :style="tagStyle(ev)">{{ ev.type }}</span>
                  <div class="item-body">
                    <strong>{{ ev.title }}</strong>
                    <span v-if="eventTimeLabel(ev)" class="item-note">{{ eventTimeLabel(ev) }}</span>
                    <span v-if="recurLabel(ev)" class="item-note item-note--recur">{{ recurLabel(ev) }}</span>
                    <span v-if="ev.notes" class="item-note">{{ ev.notes }}</span>
                  </div>
                  <button class="icon-btn" aria-label="Edit event" @click="beginEditEvent(ev)"><ion-icon :icon="createOutline" /></button>
                  <button class="delete-btn" aria-label="Delete event" @click="removeEvent(ev)"><ion-icon :icon="closeOutline" /></button>
                </li>
              </ul>
              <p v-else-if="viewMode !== 'day'" class="empty-hint">No events on this day</p>
            </div>

            <!-- DAY VIEW: HomePage-style schedule timeline -->
            <div v-if="viewMode === 'day'" class="detail-card">
              <div class="detail-card__header"><h3>Schedule</h3></div>

              <div v-if="dayAllDayEvents.length" class="allday-strip">
                <div
                  v-for="ev in dayAllDayEvents"
                  :key="ev.id + '-' + (ev.seg || 'x')"
                  class="allday-pill"
                  :class="`item-tag--${ev.type}`"
                  :style="tagStyle(ev)"
                  @click="beginEditEvent(ev)"
                >{{ ev.title }}</div>
              </div>

              <div v-if="dayHasTimeline" class="day-view__scroll">
                <div class="day-view__inner" :style="{ height: dayTlHeight + 'px' }">
                  <div v-for="h in dayVisibleHours" :key="h" class="hour-mark" :style="{ top: dayHourToY(h) + 'px' }">
                    <span class="hour-label">{{ String(h).padStart(2, '0') }}:00</span>
                    <div class="hour-line" />
                  </div>
                  <div v-if="dayNowY >= 0" class="now-line" :style="{ top: dayNowY + 'px' }"><div class="now-dot" /></div>
                  <div
                    v-for="ev in dayTimedEvents"
                    :key="ev.id + '-' + (ev.seg || 'x')"
                    class="ev-block"
                    :class="`ev-block--${ev.type}`"
                    :style="evBlockStyle(ev)"
                    @click="beginEditEvent(ev)"
                  >
                    <strong class="ev-title">{{ ev.title }}</strong>
                    <span class="ev-time">{{ ev.timeLabel }}</span>
                  </div>
                  <div
                    v-for="h in dayTimedHabits"
                    :key="'h' + h.id"
                    class="habit-pill"
                    :class="{ 'habit-pill--done': h.completed === 1 }"
                    :style="{ top: h.top + 'px' }"
                    @click="toggleHabit(h, selectedDate)"
                  >
                    <span class="habit-pill__check"><ion-icon :icon="h.completed === 1 ? checkmarkOutline : ellipseOutline" /></span>
                    {{ h.name }}{{ h.time ? ', ' + h.time : '' }}
                  </div>
                </div>
              </div>
              <p v-else-if="!dayAllDayEvents.length" class="empty-hint">Nothing scheduled this day</p>
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
                    <ion-icon v-if="h.completed === 1" :icon="checkmarkOutline" />
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
          </template>
        </template>

      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonPage, IonHeader, IonContent, IonIcon } from '@ionic/vue';
import { addOutline, closeOutline, checkmarkOutline, searchOutline, createOutline, ellipseOutline } from 'ionicons/icons';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import PlanSectionTabs from '@/features/plan/components/PlanSectionTabs.vue';
import { usePlanner, type CalendarViewMode } from '@/features/plan/composables/usePlanner';

const {
  DOW,
  EVENT_COLORS,
  todayStr,
  selectedDate,
  leadingBlanks,
  calendarCells,
  selectedDateLabel,
  // views
  viewMode,
  setViewMode,
  goPrev,
  goNext,
  periodLabel,
  weekColumns,
  agendaGroups,
  // search
  searchQuery,
  searchResults,
  // goals / habits
  goalsDueSelected,
  fmtNum,
  linkedGoalName,
  streakFor,
  dayHabits,
  dayDoneCount,
  dayProgressPct,
  toggleHabit,
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
} = usePlanner();

const viewTabs: { value: CalendarViewMode; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
  { value: 'agenda', label: 'Agenda' },
];

const onToggleForm = () => {
  if (showAddEvent.value) { resetEventForm(); showAddEvent.value = false; }
  else { resetEventForm(); showAddEvent.value = true; }
};

const intervalUnit = computed(() => {
  const n = newRecurInterval.value;
  const unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[newRecurrence.value] ?? '';
  return n === 1 ? unit : unit + 's';
});

// Custom color overrides the type's class color; otherwise the class supplies it.
const tagStyle = (ev: Record<string, any>) =>
  ev.color ? { background: ev.color, color: '#fff', borderColor: ev.color } : {};
const chipStyle = (ev: Record<string, any>) =>
  ev.color ? { borderLeftColor: ev.color } : {};
// Timeline block: position + height plus an optional custom-color background.
const evBlockStyle = (ev: Record<string, any>) => ({
  top: ev.top + 'px',
  height: ev.height + 'px',
  ...(ev.color ? { background: ev.color, color: '#fff' } : {}),
});
</script>

<style scoped src="../../plan/planner.css"></style>
<style scoped>
/* View switcher — flat underline tabs (no boxes, so the row doesn't read as
   four repeated pills). Active tab = red text + red underline. */
.cal-views {
  display: flex;
  gap: 22px;
  margin-bottom: 14px;
  padding: 0 2px;
  border-bottom: 1px solid var(--nt-border);
}
.cal-view-tab {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px; /* sit on top of the container's bottom border */
  padding: 9px 0;
  font-family: var(--nt-font-head);
  text-transform: uppercase;
  letter-spacing: var(--nt-tracking-label);
  font-size: 0.72rem;
  color: var(--nt-text-dim);
  cursor: pointer;
  transition: color var(--nt-dur-micro) var(--nt-ease-decel);
}
.cal-view-tab--active {
  color: var(--ion-color-accent-red);
  border-bottom-color: var(--ion-color-accent-red);
}

/* Search */
.cal-search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--nt-border-strong);
  border-radius: var(--nt-radius-sm);
  padding: 8px 12px;
  margin-bottom: 12px;
}
.cal-search__icon { color: var(--nt-text-dim); font-size: 1rem; flex-shrink: 0; }
.cal-search__input {
  flex: 1;
  background: transparent;
  border: none;
  color: #fff;
  font-family: var(--nt-font-body);
  font-size: 0.9rem;
  outline: none;
}
.cal-search__clear {
  background: transparent; border: none; color: var(--nt-text-dim);
  display: flex; align-items: center; cursor: pointer;
}

/* Week view */
.week-view {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  margin-bottom: 16px;
}
.week-col {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 8px 4px;
  min-height: 96px;
  border: 1px solid transparent;
  cursor: pointer;
}
.week-col--today { background: var(--nt-surface-2); }
.week-col--selected { border-color: var(--ion-color-accent-red); }
.week-col__head { text-align: center; margin-bottom: 6px; }
.week-col__dow {
  display: block; font-family: var(--nt-font-head); font-size: 0.6rem;
  text-transform: uppercase; letter-spacing: 0.08em; color: var(--nt-text-dim);
}
.week-col__day { display: block; font-family: var(--nt-font-display); font-size: 0.95rem; color: #fff; }
.week-col__events { display: flex; flex-direction: column; gap: 4px; }
.week-chip {
  border-left: 3px solid var(--ion-color-accent-red);
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 3px 4px;
  font-size: 0.6rem;
  line-height: 1.2;
  overflow: hidden;
}
.week-chip__time { display: block; color: var(--nt-text-dim); font-family: var(--nt-font-mono); }
.week-chip__title { display: block; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Agenda view */
.agenda-view { display: flex; flex-direction: column; gap: 16px; margin-bottom: 16px; }
.agenda-group__date {
  font-family: var(--nt-font-head);
  text-transform: uppercase;
  letter-spacing: var(--nt-tracking-label);
  font-size: 0.72rem;
  color: var(--nt-text-dim);
  margin-bottom: 8px;
}
.agenda-group__date--today { color: var(--ion-color-accent-red); }

/* Form additions */
.edit-banner {
  font-family: var(--nt-font-head); text-transform: uppercase; letter-spacing: var(--nt-tracking-label);
  font-size: 0.68rem; color: var(--ion-color-accent-red); margin-bottom: 4px;
}
.allday-row {
  display: flex; align-items: center; gap: 8px;
  font-size: 0.85rem; color: rgba(255, 255, 255, 0.85); margin: 2px 0;
}
.allday-row input { width: 18px; height: 18px; accent-color: var(--ion-color-accent-red); }
.form-input--num { width: 70px; text-align: center; }
.recur-interval, .recur-end { align-items: center; gap: 8px; }
.recur-label { font-size: 0.8rem; color: var(--nt-text-dim); }
.recur-days { display: flex; gap: 4px; flex-wrap: wrap; }
.recur-day {
  flex: 1; min-width: 34px; padding: 6px 0; border-radius: var(--nt-radius-sm);
  background: rgba(255, 255, 255, 0.06); border: 1px solid var(--nt-border-strong);
  color: var(--nt-text-dim); font-family: var(--nt-font-head); font-size: 0.68rem;
  text-transform: uppercase; cursor: pointer;
}
.recur-day--on {
  background: var(--ion-color-accent-red); color: #fff; border-color: var(--ion-color-accent-red);
}
.color-row { display: flex; gap: 8px; margin: 4px 0; flex-wrap: wrap; }
.color-swatch {
  width: 28px; height: 28px; border-radius: 999px; border: 1px solid var(--nt-border-strong);
  display: flex; align-items: center; justify-content: center; cursor: pointer;
  color: #fff; font-size: 0.8rem;
}
.color-swatch--default {
  background: repeating-linear-gradient(45deg, rgba(255,255,255,0.12), rgba(255,255,255,0.12) 3px, transparent 3px, transparent 6px);
}
.color-swatch--on { box-shadow: var(--nt-glow); }
.item-note--recur { color: var(--ion-color-accent-red); }
.delete-text-btn {
  background: transparent; border: 1px solid var(--ion-color-accent-red);
  color: var(--ion-color-accent-red); border-radius: var(--nt-radius-sm);
  padding: 0 16px; font-family: var(--nt-font-head); text-transform: uppercase;
  letter-spacing: var(--nt-tracking-label); font-size: 0.72rem; margin-right: auto; cursor: pointer;
}

/* ===== Day-view timeline (mirrors HomePage schedule) ===== */
.allday-strip { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.allday-pill {
  font-family: var(--nt-font-head); text-transform: uppercase; letter-spacing: 0.06em;
  font-size: 0.68rem; padding: 5px 10px; border-radius: 999px;
  background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.85); cursor: pointer;
}
.day-view__scroll { overflow-y: auto; max-height: 420px; border-radius: 10px; }
.day-view__inner { position: relative; }
.hour-mark { position: absolute; left: 0; right: 0; display: flex; align-items: flex-start; pointer-events: none; }
.hour-label {
  width: 40px; flex-shrink: 0; font-size: 0.72rem; color: rgba(255, 255, 255, 0.25);
  text-align: right; padding-right: 10px; margin-top: -0.45em; line-height: 1; font-family: var(--nt-font-mono);
}
.hour-line { flex: 1; height: 1px; background: rgba(255, 255, 255, 0.08); }
.now-line {
  position: absolute; left: 40px; right: 0; height: 2px;
  background: var(--ion-color-accent-red); pointer-events: none; display: flex; align-items: center; z-index: 3;
}
.now-dot { width: 7px; height: 7px; border-radius: 999px; background: var(--ion-color-accent-red); margin-left: -3px; flex-shrink: 0; }
.ev-block {
  position: absolute; left: 48px; right: 4px; border-radius: 10px; padding: 6px 10px;
  overflow: hidden; background: rgba(255, 255, 255, 0.08); cursor: pointer; z-index: 2;
}
.ev-block--workout  { background: rgba(215, 26, 33, 0.25); }
.ev-block--recovery { background: rgba(34, 197, 94, 0.15); }
.ev-block--school   { background: rgba(59, 130, 246, 0.18); }
.ev-block--sleep    { background: rgba(255, 255, 255, 0.05); }
.ev-block--reminder { background: rgba(255, 255, 255, 0.08); }
.ev-title { display: block; font-size: 0.9rem; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ev-time { display: block; font-size: 0.72rem; color: rgba(255, 255, 255, 0.5); margin-top: 1px; }
.habit-pill {
  position: absolute; left: 48px; right: 4px; height: 24px; border-radius: 999px; padding: 0 10px;
  display: flex; align-items: center; gap: 6px; font-size: 0.72rem; color: rgba(255, 255, 255, 0.85);
  background: rgba(215, 26, 33, 0.15); border: 1px solid rgba(215, 26, 33, 0.3); cursor: pointer;
  overflow: hidden; white-space: nowrap; z-index: 2;
}
.habit-pill--done { background: rgba(215, 26, 33, 0.28); }
.habit-pill__check { display: flex; align-items: center; color: var(--ion-color-accent-red); }
.habit-pill__check ion-icon { font-size: 15px; }
</style>
