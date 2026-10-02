<template>
  <SectionTabs :segments="segments" />
</template>

<script setup lang="ts">
import SectionTabs from '@/shared/components/SectionTabs.vue';

// Thin wrapper: the shared SectionTabs owns matching, haptics and navigation.
const segments = [
  { value: 'overview', label: 'Overview', path: '/health', exact: true },
  { value: 'sleep', label: 'Sleep', path: '/health/sleep' },
  { value: 'body', label: 'Body', path: '/health/body' },
  { value: 'vitals', label: 'Vitals', path: '/health/vitals' },
];
</script>
