import type { RouteRecordRaw } from 'vue-router';

export const healthRoutes: Array<RouteRecordRaw> = [
  {
    path: '/health',
    name: 'Health',
    component: () => import('./pages/HealthPage.vue')
  },
  {
    path: '/health/sleep',
    name: 'HealthSleep',
    component: () => import('./pages/SleepPage.vue')
  },
  {
    path: '/health/calendar',
    name: 'HealthCalendar',
    component: () => import('./pages/HealthCalendarPage.vue')
  },
  {
    path: '/health/habits',
    name: 'HealthHabits',
    component: () => import('./pages/HealthHabitsPage.vue')
  },
  {
    path: '/health/goals',
    name: 'HealthGoals',
    component: () => import('./pages/HealthGoalsPage.vue')
  }
];
