<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <plan-section-tabs />
    </ion-header>
    <ion-content :fullscreen="true" class="planner-content">
      <div class="planner-shell">

        <!-- ============ HABIT BOARD ============ -->
        <div class="day-head day-head--section">
          <p class="eyebrow">Habit board · last 7 days</p>
          <button class="icon-btn" @click="showAddHabit ? (resetHabitForm(), showAddHabit = false) : (showAddHabit = true)">
            <ion-icon :icon="showAddHabit ? closeOutline : addOutline" />
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
                <ion-icon v-if="isDone(h.id, d)" :icon="checkmarkOutline" />
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
        <p v-else class="empty-hint empty-hint--pad">No habits yet.</p>

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
  HEAT_COLORS,
  isScheduledOn,
  todayStr,
  activeGoals,
  streakFor,
  bestStreakFor,
  rateFor,
  isDone,
  weekDates,
  last28Dates,
  dowShort,
  heatCells,
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
} = usePlanner();
</script>

<style scoped src="../../plan/planner.css"></style>
