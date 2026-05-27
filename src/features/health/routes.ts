import type { RouteRecordRaw } from 'vue-router';

export const healthRoutes: Array<RouteRecordRaw> = [
  {
    path: '/health',
    name: 'Health',
    component: () => import('./pages/HealthPage.vue'),
  },
];
