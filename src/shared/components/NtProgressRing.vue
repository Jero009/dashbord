<template>
  <div class="nt-ring" :class="sizeClass">
    <svg viewBox="0 0 120 120" class="nt-ring__svg" aria-hidden="true">
      <circle class="nt-ring__track" cx="60" cy="60" r="46" />
      <circle
        class="nt-ring__progress"
        cx="60" cy="60" r="46"
        :style="{ strokeDashoffset: dashOffset, stroke: resolvedColor }"
      />
    </svg>
    <div class="nt-ring__content">
      <slot />
    </div>
  </div>
</template>

<!--
  Shared 120×120 / r=46 progress ring (circumference 2π·46 ≈ 289).
  Migrated verbatim from the Home battery ring and Sleep score ring.
  Center content via the default slot; size/typography stay with the page
  through `sizeClass` + scoped styles.
-->
<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    /** 0–1 progress; clamped so the dash offset never over/under-shoots */
    ratio: number;
    /** progress stroke color; defaults to the accent red */
    color?: string;
    /** extra class on the root for page-level sizing */
    sizeClass?: string;
  }>(),
  { color: undefined, sizeClass: undefined }
);

const CIRCUMFERENCE = 289;

const dashOffset = computed(
  () => CIRCUMFERENCE - CIRCUMFERENCE * Math.min(1, Math.max(0, props.ratio))
);

const resolvedColor = computed(() => props.color ?? 'var(--ion-color-accent-red)');
</script>

<style scoped>
.nt-ring {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
}

.nt-ring__svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.nt-ring__track,
.nt-ring__progress {
  fill: none;
  stroke-width: 12;
}

.nt-ring__track {
  stroke: rgba(var(--nt-ink), 0.08);
}

.nt-ring__progress {
  stroke-linecap: round;
  stroke-dasharray: 289;
  transition: stroke-dashoffset var(--nt-dur-emph, 300ms) var(--nt-ease-decel, ease);
}

.nt-ring__content {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 6px;
  text-align: center;
}
</style>
