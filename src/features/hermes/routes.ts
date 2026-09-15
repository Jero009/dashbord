import type { RouteRecordRaw } from 'vue-router';

export const hermesRoutes: Array<RouteRecordRaw> = [
  {
    path: '/hermes',
    name: 'Hermes',
    component: () => import('./pages/HermesPage.vue')
  }
];
