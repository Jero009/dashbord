<template>
  <ion-toolbar class="section-toolbar">
    <ion-segment :value="activeSegment" @ionChange="handleSegmentChange">
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
  </ion-toolbar>
</template>

<script setup lang="ts">
import { IonToolbar, IonSegment, IonSegmentButton, IonLabel } from '@ionic/vue';
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
  --padding-top: calc(env(safe-area-inset-top, 0px) + 10px);
  padding: 0 8px 8px;
}
</style>
