<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
    </ion-header>
    <ion-content :fullscreen="true" class="dashboard-content">
      <div class="dashboard-shell">
        <h1 class="dashboard-title">Finance</h1>
        <ion-card class="dashboard-card">
          <ion-card-header>
            <ion-card-title>Spending overview</ion-card-title>
            <ion-card-subtitle>Coming soon</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            Add your budgets, income, and monthly summaries here.
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
