<template>
  <ion-toolbar class="section-toolbar">
    <ion-segment :value="activeSegment" @ionChange="handleSegmentChange">
      <ion-segment-button value="overview">
        <ion-label>Overview</ion-label>
      </ion-segment-button>
      <ion-segment-button value="calendar">
        <ion-label>Calendar</ion-label>
      </ion-segment-button>
      <ion-segment-button value="habits">
        <ion-label>Habits</ion-label>
      </ion-segment-button>
      <ion-segment-button value="goals">
        <ion-label>Goals</ion-label>
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
  if (route.path.includes('/calendar')) return 'calendar';
  if (route.path.includes('/habits')) return 'habits';
  if (route.path.includes('/goals')) return 'goals';
  return 'overview';
});

const handleSegmentChange = (event: CustomEvent) => {
  const value = (event.detail as { value?: string }).value;
  if (!value) return;

  const target = {
    overview: '/health',
    calendar: '/health/calendar',
    habits: '/health/habits',
    goals: '/health/goals',
  }[value];

  if (target && target !== route.path) {
    router.push(target);
  }
};
</script>

<style scoped>
.section-toolbar {
  --background: var(--ion-color-primary);
  padding: 0 8px 8px;
}
</style>
