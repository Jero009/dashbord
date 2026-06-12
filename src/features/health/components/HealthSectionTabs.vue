<template>
  <ion-toolbar class="section-toolbar">
    <div class="seg-pill">
      <ion-segment :value="activeSegment" @ionChange="handleSegmentChange" scrollable>
        <ion-segment-button value="overview">
          <ion-label>Overview</ion-label>
        </ion-segment-button>
        <ion-segment-button value="sleep">
          <ion-label>Sleep</ion-label>
        </ion-segment-button>
        <ion-segment-button value="body">
          <ion-label>Body</ion-label>
        </ion-segment-button>
        <ion-segment-button value="circadian">
          <ion-label>Circadian</ion-label>
        </ion-segment-button>
      </ion-segment>
    </div>
  </ion-toolbar>
</template>

<script setup lang="ts">
import { IonToolbar, IonSegment, IonSegmentButton, IonLabel } from '@ionic/vue';
import { hapticLight } from '@/shared/utils/haptics';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const router = useRouter();
const route = useRoute();

const activeSegment = computed(() => {
  if (route.path.includes('/sleep'))     return 'sleep';
  if (route.path.includes('/body'))      return 'body';
  if (route.path.includes('/circadian')) return 'circadian';
  return 'overview';
});

const handleSegmentChange = (event: CustomEvent) => {
  const value = (event.detail as { value?: string }).value;
  if (!value) return;
  hapticLight();

  const target: Record<string, string> = {
    overview:  '/health',
    sleep:     '/health/sleep',
    body:      '/health/body',
    circadian: '/health/circadian',
  };

  const dest = target[value];
  if (dest && dest !== route.path) {
    router.push(dest);
  }
};
</script>

<style scoped>
.section-toolbar {
  --background: transparent;
  --border-width: 0;
  --box-shadow: none;
  --padding-top: 0px;
  padding: 2px 10px 6px;
  margin-top: -2px;
}

.seg-pill {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  padding: 6px;
  overflow: hidden;
}

ion-segment {
  width: 100%;
  --background: transparent;
}

ion-segment-button {
  --background: transparent;
  --background-checked: transparent;
  --color: rgba(255, 255, 255, 0.5);
  --color-checked: var(--ion-color-accent-red);
  --indicator-color: var(--ion-color-accent-red);
  min-height: 34px;
  border-radius: 999px;
  font-weight: 600;
}
</style>
