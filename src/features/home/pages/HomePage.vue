<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
    </ion-header>
    <ion-content :fullscreen="true" class="dashboard-content">
      <div class="dashboard-shell">
        <h1 class="dashboard-title">Personal Dashboard</h1>
        <ion-card class="dashboard-card">
          <ion-card-header>
            <ion-card-title>Welcome back</ion-card-title>
            <ion-card-subtitle>Your overview hub</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            Use the top tabs to jump between finance, health, and gym.
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent } from '@ionic/vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
</script>

<style scoped>
.dashboard-content {
  --padding-top: 16px;
  --padding-bottom: 24px;
}

.dashboard-shell {
  padding: 16px;
  display: grid;
  gap: 16px;
}

.dashboard-title {
  margin: 0;
  font-size: 1.4rem;
}

.dashboard-card {
  margin: 0;
  border-radius: 12px;
  background: var(--ion-color-primary);
}
</style>
