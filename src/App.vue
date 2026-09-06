<template>
  <ion-app>
    <health-connect-auto-sync />
    <ion-router-outlet :animation="fadeTransition" />
  </ion-app>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { IonApp, IonRouterOutlet, createAnimation } from '@ionic/vue';
import type { AnimationBuilder } from '@ionic/vue';
import HealthConnectAutoSync from '@/shared/health/HealthConnectAutoSync.vue';
import { Capacitor } from '@capacitor/core'
import { scheduleWeightReminder, scheduleSleepReminder } from '@/shared/utils/notifications'
import { getNotifWeightEnabled, getNotifWeightTime, getNotifSleepEnabled, getNotifSleepTime } from '@/shared/utils/userSettings'
import { initDB } from '@/shared/db/app_db'

onMounted(async () => {
  if (!Capacitor.isNativePlatform()) return
  // Startup notification scheduling must never crash the app — a failure in
  // initDB or any DB/notification call here should be logged, not propagated as
  // an unhandled rejection.
  try {
    await initDB()

    if (getNotifWeightEnabled()) await scheduleWeightReminder(getNotifWeightTime())

    if (getNotifSleepEnabled()) await scheduleSleepReminder(getNotifSleepTime())
  } catch (error) {
    console.error('Startup notification scheduling failed:', error)
  }
})

const fadeTransition: AnimationBuilder = (_, opts) => {
  const enter = createAnimation()
    .addElement(opts.enteringEl)
    .duration(220)
    .easing('cubic-bezier(0.4, 0, 0.2, 1)')
    .fromTo('opacity', '0', '1')
    .fromTo('transform', 'translate3d(0, 6px, 0)', 'translate3d(0, 0, 0)');

  const leave = createAnimation()
    .addElement(opts.leavingEl)
    .duration(180)
    .easing('cubic-bezier(0.4, 0, 1, 1)')
    .fromTo('opacity', '1', '0')
    .fromTo('transform', 'translate3d(0, 0, 0)', 'translate3d(0, -4px, 0)');

  return createAnimation().addAnimation([enter, leave]);
};
</script>
