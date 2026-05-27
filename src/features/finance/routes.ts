import type { RouteRecordRaw } from 'vue-router';

export const financeRoutes: Array<RouteRecordRaw> = [
  {
    path: '/finance',
    name: 'Finance',
    component: () => import('./pages/FinancePage.vue')
  },
  {
    path: '/finance/accounts',
    name: 'FinanceAccounts',
    component: () => import('./pages/FinanceAccountsPage.vue')
  },
  {
    path: '/finance/investments',
    name: 'FinanceInvestments',
    component: () => import('./pages/FinanceInvestmentsPage.vue')
  },
  {
    path: '/finance/subscriptions',
    name: 'FinanceSubscriptions',
    component: () => import('./pages/FinanceSubscriptionsPage.vue')
  }
];
