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
import {
  scheduleWeightReminder, scheduleHabitReminder, scheduleSleepReminder,
  scheduleCalendarReminders, scheduleSubscriptionReminders
} from '@/shared/utils/notifications'
import {
  getNotifWeightEnabled, getNotifWeightTime,
  getNotifHabitEnabled, getNotifHabitTime,
  getNotifSleepEnabled, getNotifSleepTime,
  getNotifCalendarEnabled, getNotifCalendarMinsBefore,
  getNotifSubscriptionEnabled, getNotifSubscriptionDaysBefore,
} from '@/shared/utils/userSettings'
import { initDB, getHabitsWithStatus, getCalendarEventsForDate, getFinanceSubscriptions } from '@/shared/db/app_db'
import { localDateISO } from '@/shared/utils/timeFormat'

onMounted(async () => {
  if (!Capacitor.isNativePlatform()) return
  // Startup notification scheduling must never crash the app — a failure in
  // initDB or any DB/notification call here should be logged, not propagated as
  // an unhandled rejection.
  try {
    await initDB()
    const today = localDateISO()

    if (getNotifWeightEnabled()) await scheduleWeightReminder(getNotifWeightTime())

    if (getNotifHabitEnabled()) {
      const habits = await getHabitsWithStatus(today)
      const incomplete = habits.filter((h: any) => h.completed !== 1).map((h: any) => h.name as string)
      await scheduleHabitReminder(getNotifHabitTime(), incomplete)
    }

    if (getNotifSleepEnabled()) await scheduleSleepReminder(getNotifSleepTime())

    if (getNotifCalendarEnabled()) {
      const events = await getCalendarEventsForDate(today)
      await scheduleCalendarReminders(events, getNotifCalendarMinsBefore())
    }

    if (getNotifSubscriptionEnabled()) {
      const subs = await getFinanceSubscriptions()
      await scheduleSubscriptionReminders(subs, getNotifSubscriptionDaysBefore())
    }
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
