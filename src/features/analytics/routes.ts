import type { RouteRecordRaw } from 'vue-router';

export const analyticsRoutes: Array<RouteRecordRaw> = [
  {
    path: '/analytics',
    name: 'Analytics',
    component: () => import('./pages/AnalyticsOverviewPage.vue')
  },
  {
    path: '/analytics/gym',
    name: 'AnalyticsGym',
    component: () => import('./pages/AnalyticsGymPage.vue')
  },
  {
    path: '/analytics/review',
    name: 'AnalyticsReview',
    component: () => import('./pages/AnalyticsReviewPage.vue')
  }
];
