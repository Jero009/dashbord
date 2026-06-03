<template>
  <ion-toolbar class="dashboard-toolbar">
    <ion-segment :value="activeTab" @ionChange="handleSegmentChange" scrollable>
      <ion-segment-button value="home">
        <ion-label>Home</ion-label>
      </ion-segment-button>
      <ion-segment-button value="finance">
        <ion-label>Finance</ion-label>
      </ion-segment-button>
      <ion-segment-button value="health">
        <ion-label>Health</ion-label>
      </ion-segment-button>
      <ion-segment-button value="plan">
        <ion-label>Plan</ion-label>
      </ion-segment-button>
      <ion-segment-button value="gym">
        <ion-label>Gym</ion-label>
      </ion-segment-button>
    </ion-segment>
    <div slot="end" class="toolbar-end">
      <button class="settings-btn" :class="{ 'settings-btn--active': isSettings }" @click="goToSettings">
        <ion-icon :icon="settingsOutline" />
      </button>
    </div>
  </ion-toolbar>
</template>

<script setup lang="ts">
import { IonToolbar, IonSegment, IonSegmentButton, IonLabel, IonIcon } from '@ionic/vue';
import { settingsOutline } from 'ionicons/icons';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const router = useRouter();
const route = useRoute();

const activeTab = computed(() => {
  if (route.path.startsWith('/plan'))    return 'plan';
  if (route.path.startsWith('/finance')) return 'finance';
  if (route.path.startsWith('/health'))  return 'health';
  if (route.path.startsWith('/tabs') || route.path.startsWith('/workout') || route.path.startsWith('/exercise')) return 'gym';
  return 'home';
});

const isSettings = computed(() => route.path === '/settings');

const handleSegmentChange = (event: CustomEvent) => {
  const value = (event.detail as { value?: string }).value;
  if (!value) return;

  const target = {
    home: '/home',
    finance: '/finance',
    health: '/health',
    gym: '/tabs/Home',
    plan: '/plan',
  }[value];

  if (target && target !== route.path) {
    router.push(target);
  }
};

const goToSettings = () => {
  if (route.path !== '/settings') {
    router.push('/settings');
  }
};
</script>

<style scoped>
.dashboard-toolbar {
  --background: transparent;
  --border-width: 0;
  --padding-top: calc(env(safe-area-inset-top, 0px) + 2px);
  padding: 4px 8px 6px;
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

.toolbar-end {
  display: flex;
  align-items: center;
  padding-right: 4px;
}

.settings-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: 22px;
  border-radius: 6px;
}

.settings-btn--active {
  color: var(--ion-color-accent-red);
}

.settings-btn ion-icon {
  font-size: 22px;
}
</style>
