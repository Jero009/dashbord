import type { RouteRecordRaw } from 'vue-router';

export const homeRoutes: Array<RouteRecordRaw> = [
  {
    path: '/home',
    name: 'Home',
    component: () => import('./pages/HomePage.vue')
  }
];