<template>
  <ion-toolbar class="section-toolbar">
    <ion-segment :value="activeSegment" @ionChange="handleSegmentChange" scrollable>
      <ion-segment-button value="plan">
        <ion-label>Overview</ion-label>
      </ion-segment-button>
      <ion-segment-button value="goals">
        <ion-label>Goals</ion-label>
      </ion-segment-button>
      <ion-segment-button value="habits">
        <ion-label>Habits</ion-label>
      </ion-segment-button>
      <ion-segment-button value="calendar">
        <ion-label>Calendar</ion-label>
      </ion-segment-button>
    </ion-segment>
  </ion-toolbar>
</template>

<script setup lang="ts">
import { IonToolbar, IonSegment, IonSegmentButton, IonLabel } from '@ionic/vue';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const router = useRouter();
const route = useRoute();

const activeSegment = computed(() => {
  if (route.path === '/plan/goals')    return 'goals';
  if (route.path === '/plan/habits')   return 'habits';
  if (route.path === '/plan/calendar') return 'calendar';
  return 'plan';
});

const handleSegmentChange = (event: CustomEvent) => {
  const value = (event.detail as { value?: string }).value;
  if (!value) return;
  const target: Record<string, string> = {
    plan:     '/plan',
    goals:    '/plan/goals',
    habits:   '/plan/habits',
    calendar: '/plan/calendar',
  };
  const dest = target[value];
  if (dest && dest !== route.path) router.push(dest);
};
</script>

<style scoped>
.section-toolbar {
  --background: var(--ion-color-primary);
  --border-width: 0;
  --padding-top: 0;
  padding: 2px 8px 6px;
  margin-top: -2px;
}

ion-segment {
  width: 100%;
  --background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  padding: 4px;
}

ion-segment-button {
  --background: transparent;
  --background-checked: transparent;
  --color: rgba(255, 255, 255, 0.7);
  --color-checked: var(--ion-color-accent-red);
  --indicator-color: var(--ion-color-accent-red);
  min-height: 34px;
  border-radius: 999px;
  font-weight: 600;
}
</style>
