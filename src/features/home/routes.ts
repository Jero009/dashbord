import type { RouteRecordRaw } from 'vue-router';

export const homeRoutes: Array<RouteRecordRaw> = [
  {
    path: '/home',
    name: 'DashboardHome',
    component: () => import('./pages/HomePage.vue'),
  },
];
