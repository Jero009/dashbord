<template>
  <ion-app>
    <health-connect-auto-sync />
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import HealthConnectAutoSync from '@/shared/health/HealthConnectAutoSync.vue';
</script>
