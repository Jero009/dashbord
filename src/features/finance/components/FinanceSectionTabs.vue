<template>
  <ion-toolbar class="section-toolbar">
    <div class="seg-pill">
      <ion-segment :value="activeSegment" @ionChange="handleSegmentChange" scrollable>
        <ion-segment-button value="overview">
          <ion-label>Overview</ion-label>
        </ion-segment-button>
        <ion-segment-button value="accounts">
          <ion-label>Accounts</ion-label>
        </ion-segment-button>
        <ion-segment-button value="investments">
          <ion-label>Investments</ion-label>
        </ion-segment-button>
        <ion-segment-button value="subscriptions">
          <ion-label>Subscriptions</ion-label>
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
  if (route.path.includes('/accounts')) return 'accounts';
  if (route.path.includes('/investments')) return 'investments';
  if (route.path.includes('/subscriptions')) return 'subscriptions';
  return 'overview';
});

const handleSegmentChange = (event: CustomEvent) => {
  const value = (event.detail as { value?: string }).value;
  if (!value) return;
  hapticLight();

  const target = {
    overview: '/finance',
    accounts: '/finance/accounts',
    investments: '/finance/investments',
    subscriptions: '/finance/subscriptions',
  }[value];

  if (target && target !== route.path) {
    router.push(target);
  }
};
</script>

<style scoped>
.section-toolbar {
  --background: var(--ion-color-primary);
  --border-width: 0;
  --box-shadow: none;
  --padding-top: 0px;
  padding: 2px 8px 6px;
  margin-top: -2px;
}

.seg-pill {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  padding: 4px;
  overflow: hidden;
}

ion-segment {
  width: 100%;
  --background: transparent;
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
