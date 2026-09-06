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
    path: '/health/body',
    name: 'HealthBody',
    component: () => import('./pages/BodyPage.vue')
  }
];
