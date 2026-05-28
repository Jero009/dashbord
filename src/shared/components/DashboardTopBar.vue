<template>
  <ion-toolbar class="dashboard-toolbar">
    <ion-segment :value="activeTab" @ionChange="handleSegmentChange">
      <ion-segment-button value="home">
        <ion-label>Home</ion-label>
      </ion-segment-button>
      <ion-segment-button value="finance">
        <ion-label>Finance</ion-label>
      </ion-segment-button>
      <ion-segment-button value="health">
        <ion-label>Health</ion-label>
      </ion-segment-button>
      <ion-segment-button value="gym">
        <ion-label>Gym</ion-label>
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

const activeTab = computed(() => {
  if (route.path.startsWith('/finance')) return 'finance';
  if (route.path.startsWith('/health')) return 'health';
  if (route.path.startsWith('/tabs') || route.path.startsWith('/workout') || route.path.startsWith('/exercise')) {
    return 'gym';
  }
  return 'home';
});

const handleSegmentChange = (event: CustomEvent) => {
  const value = (event.detail as { value?: string }).value;
  if (!value) return;

  const target = {
    home: '/home',
    finance: '/finance',
    health: '/health',
    gym: '/tabs/Home',
  }[value];

  if (target && target !== route.path) {
    router.push(target);
  }
};
</script>

<style scoped>
.dashboard-toolbar {
  --background: var(--ion-color-primary);
  --padding-top: calc(env(safe-area-inset-top, 0px) + 2px);
  padding: 4px 8px 6px;
}

ion-segment {
  width: 100%;
  --background: rgba(255, 255, 255, 0.04);
  border-radius: 999px;
  padding: 4px;
}

ion-segment-button {
  --background: transparent;
  --background-checked: transparent;
  --color: rgba(255, 255, 255, 0.7);
  --color-checked: var(--ion-color-danger);
  --indicator-color: var(--ion-color-danger);
  min-height: 34px;
  border-radius: 999px;
  font-weight: 600;
}
</style>
