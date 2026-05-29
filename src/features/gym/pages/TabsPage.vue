<template>
  <ion-page>
    <ion-header>
      <DashboardTopBar />
    </ion-header>
    <ion-tabs>
      <ion-router-outlet></ion-router-outlet>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="Home" href="/tabs/Home" >
          <ion-icon aria-hidden="true" :icon="home" />
          <ion-label>Home</ion-label>
        </ion-tab-button>


        <ion-tab-button tab="Template" href="/tabs/Template" >
          <ion-icon aria-hidden="true" :icon="add" />
          <ion-label>Template</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="Exercise" href="/tabs/Exercise" >
          <ion-icon aria-hidden="true" :icon="body" />
          <ion-label>Exercise</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="History" href="/tabs/History" >
          <ion-icon aria-hidden="true" :icon="time" />
          <ion-label>History</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { IonTabBar, IonTabButton, IonTabs, IonLabel, IonIcon, IonPage, IonRouterOutlet, IonHeader } from '@ionic/vue';
import { home, add, time, body } from 'ionicons/icons';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
</script>
<style>
ion-tab-bar {
  --background: rgba(255, 255, 255, 0.03);
  --border: 0;
  padding: 6px 10px calc(env(safe-area-inset-bottom, 0px) + 6px);
  transition: background 0.3s ease;
}

ion-router-outlet {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0.95;
  }
  to {
    opacity: 1;
  }
}

ion-tab-button {
  --color: rgba(255, 255, 255, 0.68);
  --color-selected: var(--ion-color-danger);
  --ripple-color: transparent;
  min-height: 56px;
  border-radius: 16px;
  transition: background 0.3s ease, color 0.3s ease;
}

ion-tab-button.tab-selected {
  background: rgba(239, 68, 68, 0.1);
}
</style>
