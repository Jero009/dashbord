<template>
  <div class="nt-metric-tile" :class="{ 'nt-metric-tile--full': full }">
    <span>{{ label }}</span>
    <strong>{{ value }}</strong>
  </div>
</template>

<script setup lang="ts">
// Shared card-primitive: metric tile (canonical global .nt-metric-tile style).
withDefaults(
  defineProps<{
    label: string;
    value: string | number;
    full?: boolean;
  }>(),
  { full: false }
);
</script>
