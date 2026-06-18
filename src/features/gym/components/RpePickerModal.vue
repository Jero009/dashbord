<template>
  <div class="rpe-sheet">
    <div class="rpe-sheet__header">
      <p class="rpe-sheet__kicker">Rate of Perceived Exertion</p>
      <button v-if="current != null" class="rpe-clear" @click="select(null)">Clear</button>
    </div>
    <div class="rpe-list">
      <button
        v-for="opt in RPE_OPTIONS"
        :key="opt.value"
        class="rpe-row"
        :class="{ 'rpe-row--active': current === opt.value }"
        @click="select(opt.value)"
      >
        <strong class="rpe-row__num">{{ opt.value }}</strong>
        <div class="rpe-row__text">
          <span class="rpe-row__detail">{{ opt.detail }}</span>
          <span class="rpe-row__feel">{{ opt.feel }}</span>
        </div>
        <div v-if="current === opt.value" class="rpe-row__check"></div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { modalController } from '@ionic/vue';
import { RPE_OPTIONS } from '@/features/gym/types/rpe';

const props = defineProps<{ current: number | null }>();

const select = (value: number | null) => {
  modalController.dismiss(value, 'confirm');
};
</script>

<style scoped>
.rpe-sheet {
  background: var(--nt-surface);
  border-radius: var(--nt-radius-lg) var(--nt-radius-lg) 0 0;
  padding-bottom: env(safe-area-inset-bottom, 16px);
}

.rpe-sheet__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 20px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.rpe-sheet__kicker {
  margin: 0;
  font-family: var(--nt-font-head);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--nt-text-dim);
}

.rpe-clear {
  font-family: var(--nt-font-head);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ion-color-accent-red);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
}

.rpe-list {
  overflow-y: auto;
  max-height: 70vh;
  padding: 8px 0;
}

.rpe-row {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 14px 20px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background 140ms;
}

.rpe-row:active {
  background: rgba(255, 255, 255, 0.04);
}

.rpe-row--active {
  background: rgba(215, 26, 33, 0.08);
}

.rpe-row__num {
  font-family: var(--nt-font-display);
  font-size: 1.8rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.3);
  min-width: 36px;
  line-height: 1;
}

.rpe-row--active .rpe-row__num {
  color: var(--ion-color-accent-red);
}

.rpe-row__text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
}

.rpe-row__detail {
  font-family: var(--nt-font-head);
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.85);
}

.rpe-row--active .rpe-row__detail {
  color: #fff;
}

.rpe-row__feel {
  font-size: 0.78rem;
  color: var(--nt-text-dim);
  line-height: 1.4;
}

.rpe-row__check {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ion-color-accent-red);
  flex-shrink: 0;
}
</style>
