<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <plan-section-tabs />
    </ion-header>
    <ion-content :fullscreen="true" class="planner-content">
      <div class="planner-shell">

        <!-- ============ GOALS ============ -->
        <div class="day-head day-head--section">
          <p class="eyebrow">Goals</p>
          <button class="icon-btn" @click="showAddGoal ? (resetGoalForm(), showAddGoal = false) : (showAddGoal = true)">
            <ion-icon :icon="showAddGoal ? closeOutline : addOutline" />
          </button>
        </div>

        <div v-if="showAddGoal" class="detail-card add-form">
          <input v-model="goalName" class="form-input" placeholder="Name" />
          <div class="form-row">
            <input v-model="goalTarget" class="form-input" type="number" inputmode="decimal" placeholder="Target" />
            <input v-model="goalDueDate" class="form-input form-input--time" type="date" title="Due date" />
          </div>
          <select v-model="goalLinkType" class="form-input form-select">
            <option value="">Manual</option>
            <option value="weight">Body weight</option>
            <option value="lift_pr">Lift PR</option>
            <option value="savings">Account balance</option>
          </select>
          <select v-if="goalLinkType === 'lift_pr'" v-model="goalLinkRef" class="form-input form-select">
            <option value="">Exercise…</option>
            <option v-for="ex in linkExerciseOptions" :key="ex.id" :value="String(ex.id)">{{ ex.name }}</option>
          </select>
          <select v-if="goalLinkType === 'savings'" v-model="goalLinkRef" class="form-input form-select">
            <option value="">Account…</option>
            <option v-for="a in linkAccountOptions" :key="a.id" :value="String(a.id)">{{ a.name }}</option>
          </select>
          <div class="form-row form-row--end">
            <button class="save-btn" @click="saveGoal">Add</button>
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
                <button class="delete-btn" aria-label="Delete goal" @click="removeGoal(g.id)"><ion-icon :icon="closeOutline" /></button>
              </div>
            </div>
          </div>
        </div>
        <p v-else-if="!completedGoals.length" class="empty-hint empty-hint--pad">No goals</p>

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
              <button class="delete-btn" aria-label="Delete goal" @click="removeGoal(g.id)"><ion-icon :icon="closeOutline" /></button>
            </li>
          </ul>
        </div>

      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonContent, IonIcon } from '@ionic/vue';
import { addOutline, closeOutline } from 'ionicons/icons';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import PlanSectionTabs from '@/features/plan/components/PlanSectionTabs.vue';
import { usePlanner } from '@/features/plan/composables/usePlanner';

const {
  fmtNum,
  activeGoals,
  completedGoals,
  goalProgress,
  goalDueLabel,
  linkedHabitCount,
  progressDrafts,
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
} = usePlanner();
</script>

<style scoped src="../../plan/planner.css"></style>
<style scoped>
.form-select {
  width: 100%;
  color-scheme: var(--nt-color-scheme);
  appearance: none;
  -webkit-appearance: none;
}

.link-hint {
  margin: 0;
  font-size: 0.78rem;
  color: var(--nt-text-dim);
}
</style>
