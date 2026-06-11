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
    path: '/health/planner',
    name: 'HealthPlanner',
    component: () => import('./pages/HealthPlannerPage.vue')
  },
  // Legacy routes — calendar, habits, and goals are merged into the planner.
  {
    path: '/health/calendar',
    redirect: '/health/planner'
  },
  {
    path: '/health/habits',
    redirect: '/health/planner'
  },
  {
    path: '/health/goals',
    redirect: '/health/planner'
  },
  {
    path: '/health/body',
    name: 'HealthBody',
    component: () => import('./pages/BodyPage.vue')
  }
];
