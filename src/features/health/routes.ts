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
  // Planning lives under the Plan tab as separate Calendar / Habits / Goals
  // pages (all sharing the same logic via usePlanner). These legacy /health
  // paths redirect there so old deep links keep working.
  {
    path: '/health/planner',
    redirect: '/plan'
  },
  {
    path: '/health/calendar',
    redirect: '/plan/calendar'
  },
  {
    path: '/health/habits',
    redirect: '/plan/habits'
  },
  {
    path: '/health/goals',
    redirect: '/plan/goals'
  },
  {
    path: '/health/body',
    name: 'HealthBody',
    component: () => import('./pages/BodyPage.vue')
  },
  {
    path: '/health/circadian',
    name: 'HealthCircadian',
    component: () => import('./pages/CircadianPage.vue')
  }
];
