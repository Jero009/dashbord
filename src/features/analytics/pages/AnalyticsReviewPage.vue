<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <analytics-section-tabs />
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="analytics-shell">
        <!-- Period header + compact switch (a filter control, not a nav-style bar) -->
        <div class="review-head">
          <p class="section-kicker">Your review</p>
          <div class="period-switch" role="group" aria-label="Review period">
            <button
              type="button"
              class="period-switch__btn"
              :class="{ 'is-active': period === 'week' }"
              :aria-pressed="period === 'week'"
              @click="setPeriod('week')"
            >Week</button>
            <button
              type="button"
              class="period-switch__btn"
              :class="{ 'is-active': period === 'month' }"
              :aria-pressed="period === 'month'"
              @click="setPeriod('month')"
            >Month</button>
          </div>
        </div>

        <!-- Training & health -->
        <div class="card">
          <p class="section-kicker">Training &amp; health</p>
          <div class="tile-grid tile-grid--4">
            <div class="tile">
              <span class="tile__label">Workouts</span>
              <strong class="tile__value">{{ digest.workoutCount }}</strong>
            </div>
            <div class="tile">
              <span class="tile__label">Volume</span>
              <strong class="tile__value">{{ formatVolume(digest.totalVolume) }}</strong>
            </div>
            <div class="tile">
              <span class="tile__label">Avg sleep</span>
              <strong class="tile__value">{{ digest.avgSleepScore ?? '—' }}</strong>
            </div>
            <div class="tile">
              <span class="tile__label">Readiness</span>
              <strong class="tile__value">{{ digest.avgReadiness ?? '—' }}</strong>
              <small v-if="digest.readinessTrend !== null" class="tile__detail" :class="trendClass">
                {{ digest.readinessTrend > 0 ? '+' : '' }}{{ digest.readinessTrend }}
              </small>
            </div>
          </div>
        </div>

        <!-- Habits & goals -->
        <div class="card">
          <p class="section-kicker">Habits &amp; goals</p>
          <div class="bar-row">
            <span class="bar-row__label">Habit consistency</span>
            <span class="bar-row__value">{{ digest.habitRate !== null ? Math.round(digest.habitRate * 100) + '%' : '—' }}</span>
          </div>
          <div class="prog-bar"><div class="prog-bar__fill" :style="{ width: pct(digest.habitRate) }"></div></div>

          <div class="bar-row">
            <span class="bar-row__label">Goal progress ({{ digest.activeGoals }} active)</span>
            <span class="bar-row__value">{{ digest.avgGoalProgress !== null ? Math.round(digest.avgGoalProgress * 100) + '%' : '—' }}</span>
          </div>
          <div class="prog-bar"><div class="prog-bar__fill" :style="{ width: pct(digest.avgGoalProgress) }"></div></div>
        </div>

        <!-- Finance -->
        <div class="card">
          <p class="section-kicker">Finance</p>
          <div class="bar-row">
            <span class="bar-row__label">Spent vs budget</span>
            <span class="bar-row__value" :class="{ 'bar-row__value--over': overBudget }">
              {{ formatCurrency(digest.spent) }}<template v-if="digest.budget !== null"> / {{ formatCurrency(digest.budget) }}</template>
            </span>
          </div>
          <div v-if="digest.budget !== null" class="prog-bar">
            <div class="prog-bar__fill" :class="{ 'prog-bar__fill--over': overBudget }" :style="{ width: spendPct }"></div>
          </div>
          <div class="bar-row">
            <span class="bar-row__label">Net worth change</span>
            <span class="bar-row__value" :class="netClass">
              <template v-if="digest.netWorthDelta !== null">{{ digest.netWorthDelta > 0 ? '+' : '' }}{{ formatCurrency(digest.netWorthDelta) }}</template>
              <template v-else>—</template>
            </span>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonContent, onIonViewWillEnter } from '@ionic/vue';
import { ref, computed } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import AnalyticsSectionTabs from '@/features/analytics/components/AnalyticsSectionTabs.vue';
import { getReviewDigest, type ReviewDigest } from '@/shared/db/app_db';
import { formatCurrency } from '@/shared/utils/currency';
import { hapticLight } from '@/shared/utils/haptics';

const period = ref<'week' | 'month'>('week');
const digest = ref<ReviewDigest>({
  period: 'week', workoutCount: 0, totalVolume: 0, avgSleepScore: null, avgReadiness: null,
  readinessTrend: null, habitRate: null, netWorthDelta: null, spent: 0, budget: null,
  activeGoals: 0, avgGoalProgress: null,
});

const trendClass = computed(() => ({
  'tile__detail--up': (digest.value.readinessTrend ?? 0) > 0,
  'tile__detail--down': (digest.value.readinessTrend ?? 0) < 0,
}));

const overBudget = computed(() => digest.value.budget !== null && digest.value.spent > digest.value.budget);
const spendPct = computed(() => {
  if (!digest.value.budget) return '0%';
  return `${Math.min(100, (digest.value.spent / digest.value.budget) * 100)}%`;
});
const netClass = computed(() => ({
  'bar-row__value--pos': (digest.value.netWorthDelta ?? 0) > 0,
  'bar-row__value--over': (digest.value.netWorthDelta ?? 0) < 0,
}));

const pct = (v: number | null) => `${Math.round((v ?? 0) * 100)}%`;
const formatVolume = (v: number) => (v >= 10000 ? `${Math.round(v / 100) / 10}k` : `${Math.round(v)}`);

const load = async () => {
  digest.value = await getReviewDigest(period.value).catch(() => digest.value);
};

const setPeriod = (value: 'week' | 'month') => {
  if (period.value === value) return;
  hapticLight();
  period.value = value;
  load();
};

onIonViewWillEnter(load);
</script>

<style scoped>
.analytics-shell {
  padding: 16px;
  display: grid;
  gap: 16px;
  max-width: 760px;
  margin: 0 auto;
  width: min(100%, 760px);
}

.card {
  background: var(--ion-color-primary);
  border-radius: var(--nt-radius-md);
  padding: 18px;
  display: grid;
  gap: 12px;
}

.section-kicker {
  margin: 0;
  font-family: var(--nt-font-head);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--nt-text-dim);
}

/* Period control: a small content-width switch, distinct from the red-underline
   nav pills (top bar / section tabs) — active = filled chip, not an indicator. */
.review-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 2px;
}

.period-switch {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: rgba(var(--nt-ink), 0.05);
  border-radius: var(--nt-radius-pill);
}

.period-switch__btn {
  appearance: none;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 6px 16px;
  border-radius: var(--nt-radius-pill);
  font-family: var(--nt-font-head);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 600;
  color: var(--nt-text-dim);
  transition: background var(--nt-dur-micro) var(--nt-ease-decel),
    color var(--nt-dur-micro) var(--nt-ease-decel);
}

.period-switch__btn.is-active {
  background: var(--nt-surface-2);
  color: var(--nt-fg);
}

.period-switch__btn:active {
  opacity: 0.7;
}

.tile-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 14px;
  background: rgba(var(--nt-ink), 0.05);
  border-radius: 10px;
  text-align: center;
}

.tile__label {
  font-family: var(--nt-font-head);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--nt-text-dim);
}

.tile__value {
  font-family: var(--nt-font-display);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--nt-fg);
}

.tile__detail {
  font-size: 0.7rem;
  color: rgba(var(--nt-ink), 0.6);
}

.tile__detail--up { color: var(--nt-data-positive); }
.tile__detail--down { color: var(--ion-color-accent-red); }

.bar-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.bar-row__label {
  font-size: 0.85rem;
  color: rgba(var(--nt-ink), 0.7);
}

.bar-row__value {
  font-family: var(--nt-font-mono);
  font-size: 0.9rem;
  color: var(--nt-fg);
}

.bar-row__value--pos { color: var(--nt-data-positive); }
.bar-row__value--over { color: var(--ion-color-accent-red); }

.prog-bar {
  height: 8px;
  border-radius: var(--nt-radius-pill);
  background: rgba(var(--nt-ink), 0.06);
  overflow: hidden;
}

.prog-bar__fill {
  height: 100%;
  background: var(--ion-color-accent-red);
  border-radius: var(--nt-radius-pill);
}

.prog-bar__fill--over {
  background: var(--ion-color-accent-red);
}
</style>
