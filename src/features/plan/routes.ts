import type { RouteRecordRaw } from 'vue-router'

export const planRoutes: RouteRecordRaw[] = [
  {
    path: '/plan',
    name: 'Plan',
    component: () => import('./pages/PlanPage.vue'),
  },
  {
    path: '/plan/goals',
    component: () => import('@/features/health/pages/HealthGoalsPage.vue'),
  },
  {
    path: '/plan/habits',
    component: () => import('@/features/health/pages/HealthHabitsPage.vue'),
  },
  {
    path: '/plan/calendar',
    component: () => import('@/features/health/pages/HealthCalendarPage.vue'),
  },
]
