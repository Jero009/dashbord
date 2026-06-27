<template>
  <ion-page>
    <ion-content>
      <div class="summary-shell">
        <p class="summary-kicker">Complete</p>

        <div class="tile-grid">
          <div class="tile">
            <span class="tile__label">Duration</span>
            <strong class="tile__value tile__value--display">{{ duration }}</strong>
          </div>
          <div class="tile">
            <span class="tile__label">Volume</span>
            <strong class="tile__value tile__value--display">{{ formattedVolume }}</strong>
          </div>
          <div class="tile">
            <span class="tile__label">Exercises</span>
            <strong class="tile__value tile__value--display">{{ exerciseCount }}</strong>
          </div>
          <div class="tile">
            <span class="tile__label">Sets</span>
            <strong class="tile__value tile__value--display">{{ setCount }}</strong>
          </div>
        </div>

        <div v-if="prs.length > 0" class="pr-card">
          <p class="pr-kicker">{{ prs.length === 1 ? 'PR' : `${prs.length} PRs` }}</p>
          <div class="pr-list">
            <div v-for="pr in prs" :key="pr.exercise_id" class="pr-row">
              <div class="pr-row__info">
                <span class="pr-row__name">{{ pr.exercise_name }}</span>
                <span class="pr-row__stat">{{ pr.pr_weight }} kg x {{ pr.pr_reps }}</span>
              </div>
              <span v-if="pr.is_new" class="pr-badge">NEW</span>
              <span v-else class="pr-badge pr-badge--improved">PR+</span>
            </div>
          </div>
        </div>

        <ion-button expand="block" class="done-btn" @click="dismiss">Done</ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonContent, IonButton, modalController } from '@ionic/vue';
import { computed } from 'vue';
import type { AchievedPR } from '@/shared/db/app_db';

const props = defineProps<{
  duration: string;
  totalVolume: number;
  exerciseCount: number;
  setCount: number;
  prs: AchievedPR[];
}>();

const formattedVolume = computed(() => {
  if (props.totalVolume >= 10000) return `${Math.round(props.totalVolume / 100) / 10}k`;
  return `${Math.round(props.totalVolume)}`;
});

const dismiss = () => modalController.dismiss();
</script>

<style scoped>
.summary-shell {
  display: grid;
  gap: 16px;
  padding: 32px 20px 24px;
  max-width: 500px;
  margin: 0 auto;
}

.summary-kicker {
  margin: 0;
  font-family: var(--nt-font-head);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  color: var(--nt-text-dim);
  text-align: center;
}

.tile-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 12px;
  background: rgba(var(--nt-ink), 0.05);
  border-radius: 10px;
  text-align: center;
}

.tile__label {
  font-family: var(--nt-font-head);
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--nt-text-dim);
}

.tile__value {
  font-family: var(--nt-font-display);
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--nt-fg);
  line-height: 1;
}

.tile__value--display {
  font-family: var(--nt-font-display);
}

.tile__detail {
  font-size: 0.68rem;
  color: rgba(var(--nt-ink), 0.4);
}

.pr-card {
  background: var(--ion-color-primary);
  border-radius: var(--nt-radius-md);
  padding: 16px;
  display: grid;
  gap: 12px;
  border: 1px solid rgba(215, 26, 33, 0.4);
}

.pr-kicker {
  margin: 0;
  font-family: var(--nt-font-head);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--ion-color-accent-red);
}

.pr-list {
  display: grid;
  gap: 8px;
}

.pr-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(var(--nt-ink), 0.04);
  border-radius: 8px;
}

.pr-row__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.pr-row__name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--nt-fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pr-row__stat {
  font-family: var(--nt-font-mono);
  font-size: 0.78rem;
  color: var(--nt-text-dim);
}

.pr-badge {
  font-family: var(--nt-font-head);
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: var(--nt-radius-pill);
  background: var(--ion-color-accent-red);
  color: var(--nt-on-accent);
  flex-shrink: 0;
}

.pr-badge--improved {
  background: transparent;
  border: 1px solid rgba(215, 26, 33, 0.6);
  color: var(--ion-color-accent-red);
}

.done-btn {
  --background: var(--ion-color-accent-red);
  --border-radius: 8px;
  margin-top: 8px;
}
</style>
