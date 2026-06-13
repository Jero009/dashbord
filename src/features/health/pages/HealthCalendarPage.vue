<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <plan-section-tabs />
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
              <ion-icon :icon="showAddEvent ? closeOutline : addOutline" />
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
              <button class="delete-btn" aria-label="Delete event" @click="removeEvent(ev.id)"><ion-icon :icon="closeOutline" /></button>
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

      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonContent, IonIcon } from '@ionic/vue';
import { addOutline, closeOutline, checkmarkOutline } from 'ionicons/icons';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import PlanSectionTabs from '@/features/plan/components/PlanSectionTabs.vue';
import { usePlanner } from '@/features/plan/composables/usePlanner';

const {
  DOW,
  todayStr,
  selectedDate,
  monthLabel,
  leadingBlanks,
  calendarCells,
  selectedDateLabel,
  prevMonth,
  nextMonth,
  goalsDueSelected,
  fmtNum,
  linkedGoalName,
  streakFor,
  dayHabits,
  dayDoneCount,
  dayProgressPct,
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
  toggleHabit,
} = usePlanner();
</script>

<style scoped src="../../plan/planner.css"></style>
