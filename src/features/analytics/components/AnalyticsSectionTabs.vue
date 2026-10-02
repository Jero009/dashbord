<template>
  <SectionTabs :segments="segments" />
</template>

<script setup lang="ts">
import SectionTabs from '@/shared/components/SectionTabs.vue';

// Thin wrapper: the shared SectionTabs owns matching, haptics and navigation.
const segments = [
  { value: 'overview', label: 'Overview', path: '/analytics', exact: true },
  { value: 'gym', label: 'Gym', path: '/analytics/gym' },
  { value: 'review', label: 'Review', path: '/analytics/review' },
];
</script>
