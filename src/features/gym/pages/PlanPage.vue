<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
    </ion-header>
    <ion-header collapse="condense">
      <ion-toolbar>
        <ion-title size="large">Plan</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <div class="plan-shell">
        <!-- 1. Active plan header -->
        <div v-if="activePlan" class="card plan-header" :class="{ 'plan-header--paused': !!openPause }">
          <div class="card-topline">
            <p class="nt-kicker">Active plan</p>
            <button v-if="!openPause" class="nt-chip nt-press" @click="openPauseSheet">
              <span class="nt-chip__dot" />
              Pause
            </button>
          </div>
          <strong class="plan-name">{{ activePlan.name }}</strong>
          <p v-if="activePlan.goal" class="plan-goal">{{ activePlan.goal }}</p>

          <template v-if="!openPause">
            <div class="dot-matrix" aria-label="Plan week progress">
              <span
                v-for="w in weeksTotal"
                :key="w"
                class="dot-matrix__dot"
                :class="{
                  'dot-matrix__dot--past': currentWeek !== null && w < currentWeek,
                  'dot-matrix__dot--now': currentWeek === w,
                  'dot-matrix__dot--deload': deloadWeeks.has(w),
                }"
              />
            </div>
            <div class="plan-stats">
              <span class="plan-stat">
                <small>Week</small>
                <strong class="plan-stat__num">{{ currentWeek ?? '—' }} / {{ weeksTotal }}</strong>
              </span>
              <span class="plan-stat" v-if="nextDeload">
                <small>Next deload</small>
                <strong>{{ formatWorkoutDate(nextDeload) }}</strong>
              </span>
            </div>
          </template>

          <template v-else>
            <p class="plan-paused-line">
              Plan paused · {{ reasonLabel(openPause.reason) }} · day {{ pauseDay }}
            </p>
            <ion-button expand="block" class="resume-btn" @click="resume">
              Resume plan
            </ion-button>
          </template>
        </div>

        <div v-else class="card plan-header">
          <p class="nt-kicker">Active plan</p>
          <p class="nt-empty">No active plan</p>
          <ion-button expand="block" class="create-btn" @click="router.push('/tabs/PlanBuilder')">
            Create plan
          </ion-button>
        </div>

        <!-- 2. Templates with done-counts -->
        <div v-if="activePlan" class="card">
          <p class="nt-kicker">Templates</p>
          <template v-if="templateRows.length > 0">
            <button
              v-for="row in templateRows"
              :key="row.id"
              class="tpl-row nt-press"
              @click="router.push('/tabs/Template')"
            >
              <span class="tpl-row__name">{{ row.name }}</span>
              <span class="tpl-row__count">{{ row.done }}×</span>
            </button>
          </template>
          <p v-else class="nt-empty">No workouts yet</p>
        </div>

        <!-- 3. Past plans -->
        <div v-if="pastPlans.length > 0" class="card">
          <p class="nt-kicker">Past plans</p>
          <template v-for="pp in pastPlans" :key="pp.plan.id">
            <button class="tpl-row nt-press" @click="togglePast(pp.plan.id)">
              <span class="tpl-row__name">{{ pp.plan.name }}</span>
              <span class="tpl-row__count">{{ pp.weeks }}w</span>
            </button>
            <div v-if="expandedPast === pp.plan.id" class="past-detail">
              <span>{{ pp.done }} workouts</span>
              <span>{{ pp.deloadsDone }} / {{ pp.deloadsTotal }} deloads</span>
              <span>{{ pp.start }} → {{ pp.end }}</span>
            </div>
          </template>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonHeader, IonContent, IonTitle, IonToolbar, IonButton,
  onIonViewWillEnter,
  modalController,
} from '@ionic/vue';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import {
  getPlanAdherence, getPlans, getPausesForPlan, getTemplates, resumePlan,
  planConfigOf, pauseSpansOf,
  type Plan, type PlanAdherence,
} from '@/shared/db/app_db';
import { deloadWeekNumbers, planWeeksTotal } from '@/shared/utils/planCalendar';
import { localDateISO } from '@/shared/utils/timeFormat';
import { formatWorkoutDate } from '@/shared/utils/timeFormat';
import { hapticLight, hapticMedium } from '@/shared/utils/haptics';
import { showToast } from '@/shared/utils/toast';
import {
  activePlan, openPause, currentWeek, weeksTotal, nextDeload, deloadWeeks,
  pauseDay, loadPlan, reloadPlan,
} from '@/features/gym/planStore';
import PauseSheet from '@/features/gym/components/PauseSheet.vue';

const router = useRouter();

const REASON_LABELS: Record<string, string> = {
  sick: 'Sick', recovery: 'Recovery', school: 'School', travel: 'Travel', other: 'Other',
};
const reasonLabel = (r: string) => REASON_LABELS[r] ?? 'Other';

// Template done-counts for the active plan.
const templateRows = ref<Array<{ id: number; name: string; done: number; tonnage: number }>>([]);

// v1 keeps it simple: expectation basis = one workout per week (done-counts only).
const expectedPerWeek = () => 1;

const loadTemplateRows = async (p: Plan) => {
  const pausesRows = await getPausesForPlan(p.id);
  const [adherence, templates] = await Promise.all([
    getPlanAdherence(p, pausesRows, expectedPerWeek()) as Promise<PlanAdherence>,
    getTemplates(true),
  ]);
  const nameOf = new Map(templates.map((t: any) => [Number(t.id), String(t.name)]));
  templateRows.value = adherence.doneCounts
    .filter((d) => d.templateId !== null)
    .map((d) => ({
      id: d.templateId as number,
      name: nameOf.get(d.templateId as number) ?? `Template ${d.templateId}`,
      done: d.done,
      tonnage: d.tonnage,
    }));
};

// Past plans (collapsed list; expand for final stats).
interface PastRow { plan: Plan; weeks: number; done: number; deloadsDone: number; deloadsTotal: number; start: string; end: string }
const pastPlans = ref<PastRow[]>([]);
const expandedPast = ref<number | null>(null);

const loadPastPlans = async () => {
  const all = await getPlans(true);
  const past = all.filter((p) => p.archived || p.id !== activePlan.value?.id);
  const rows: PastRow[] = [];
  for (const p of past.slice(0, 8)) {
    const pausesRows = await getPausesForPlan(p.id);
    const cfg = planConfigOf(p);
    const spans = pauseSpansOf(pausesRows);
    const total = planWeeksTotal(cfg, spans);
    const deloadsTotal = deloadWeekNumbers(cfg).size;
    const adherence = await getPlanAdherence(p, pausesRows, 1);
    // Deloads completed: for archived plans every scheduled week is past, so
    // count the deload weeks that exist in the derived sequence.
    const allDeloads = deloadWeekNumbers(cfg);
    const deloadsDone = p.archived || p.end_date < localDateISO()
      ? allDeloads.size
      : 0;
    rows.push({
      plan: p, weeks: total, done: adherence.totalDone,
      deloadsDone: p.archived ? deloadsDone : deloadsDone, deloadsTotal,
      start: p.start_date, end: p.end_date,
    });
  }
  pastPlans.value = rows;
};

const togglePast = (id: number) => {
  hapticLight();
  expandedPast.value = expandedPast.value === id ? null : id;
};

// ── Pause / resume (T11) ──────────────────────────────────────────────────────
const openPauseSheet = async () => {
  hapticLight();
  const modal = await modalController.create({
    component: PauseSheet,
    breakpoints: [0, 0.7, 1],
    initialBreakpoint: 0.7,
    cssClass: 'pause-sheet-modal',
  });
  await modal.present();
  const { data, role } = await modal.onDidDismiss<{ reason: string; note: string | null; startDate: string }>();
  if (role !== 'confirm' || !data || !activePlan.value) return;
  const { pausePlan } = await import('@/shared/db/app_db');
  await pausePlan(activePlan.value.id, data.reason, data.note, data.startDate);
  await reloadPlan();
  hapticMedium();
  showToast('plan paused');
};

const resume = async () => {
  if (!openPause.value) return;
  hapticMedium();
  await resumePlan(openPause.value.id);
  await reloadPlan();
  showToast('plan resumed', 'success');
};

onIonViewWillEnter(async () => {
  await loadPlan(true);
  if (activePlan.value) await loadTemplateRows(activePlan.value);
  await loadPastPlans();
});
</script>

<style scoped>
.plan-shell {
  padding: 16px;
  display: grid;
  gap: 16px;
  max-width: 760px;
  margin: 0 auto;
}

.card {
  background: var(--ion-color-primary);
  border-radius: var(--nt-radius-md);
  padding: 18px;
  display: grid;
  gap: 12px;
}

.card-topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.card-topline .nt-kicker {
  margin: 0;
}

.plan-name {
  font-family: var(--nt-font-head);
  font-size: 1.15rem;
  font-weight: 700;
}

.plan-goal {
  margin: 0;
  font-size: 0.85rem;
  color: var(--nt-text-dim);
}

.plan-header--paused {
  border: 1px solid color-mix(in srgb, var(--ion-color-accent-red) 40%, transparent);
}

.dot-matrix {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.dot-matrix__dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  border: 1px solid rgba(var(--nt-ink), 0.25);
  background: transparent;
}

.dot-matrix__dot--past {
  background: rgba(var(--nt-ink), 0.35);
  border-color: transparent;
}

.dot-matrix__dot--now {
  background: var(--ion-color-accent-red);
  border-color: var(--ion-color-accent-red);
}

.dot-matrix__dot--deload {
  border-style: dashed;
}

.plan-stats {
  display: flex;
  gap: 24px;
}

.plan-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.plan-stat small {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--nt-text-dim);
}

.plan-stat strong {
  font-family: var(--nt-font-display);
  font-size: 1.1rem;
  font-weight: 700;
}

.plan-paused-line {
  margin: 0;
  font-family: var(--nt-font-head);
  color: var(--ion-color-accent-red);
  font-weight: 600;
}

.resume-btn,
.create-btn {
  --background: var(--ion-color-accent-red);
  --border-radius: 8px;
  margin: 0;
}

.tpl-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 14px;
  background: rgba(var(--nt-ink), 0.05);
  border: none;
  border-radius: 10px;
  text-align: left;
  cursor: pointer;
}

.tpl-row__name {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(var(--nt-ink), 0.9);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tpl-row__count {
  font-family: var(--nt-font-display);
  font-weight: 700;
  color: var(--ion-color-accent-red);
}

.past-detail {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 4px 14px 8px;
  font-size: 0.75rem;
  color: var(--nt-text-dim);
}
</style>
