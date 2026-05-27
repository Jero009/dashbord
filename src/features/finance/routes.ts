import type { RouteRecordRaw } from 'vue-router';

export const financeRoutes: Array<RouteRecordRaw> = [
  {
    path: '/finance',
    name: 'Finance',
    component: () => import('./pages/FinancePage.vue'),
  },
];
