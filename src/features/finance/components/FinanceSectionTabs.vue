<template>
  <SectionTabs :segments="segments" />
</template>

<script setup lang="ts">
import SectionTabs from '@/shared/components/SectionTabs.vue';

// Thin wrapper: the shared SectionTabs owns matching, haptics and navigation.
// Overview is exact-match so '/finance/analytics' doesn't re-activate it by substring.
const segments = [
  { value: 'overview', label: 'Overview', path: '/finance', exact: true },
  { value: 'budget', label: 'Budget', path: '/finance/budget' },
  { value: 'analytics', label: 'Analytics', path: '/finance/analytics' },
  { value: 'accounts', label: 'Accounts', path: '/finance/accounts' },
  { value: 'investments', label: 'Investments', path: '/finance/investments' },
  { value: 'subscriptions', label: 'Subscriptions', path: '/finance/subscriptions' },
];
</script>
