<template>
  <!--
    Verdict VU bar — single vertical audio-visualizer-style meter encoding the
    daily briefing level. Segments bottom→top: red / yellow / green (VU-meter
    order). Bottom-up fill = how hard the day is:
      recover → 1 lit (red) · normal → 2 lit (red+yellow) · push → 3 lit
    Overrides paint the WHOLE bar in one color: sick → solid red, deload →
    solid yellow. Null level → dim bar (legacy briefing / no data).
    Colors are data encoding (goal-red/green semantics), same tokens app-wide.
  -->
  <div class="vu-bar" :class="`vu-bar--${level ?? 'none'}`" aria-hidden="true">
    <i v-for="seg in 3" :key="seg" class="vu-seg" :class="litSegments >= seg ? 'is-lit' : ''" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { BriefingLevel } from '@/shared/sync/briefingStore';

const props = defineProps<{ level: BriefingLevel | null }>();

const litSegments = computed(() => {
  switch (props.level) {
    case 'push': return 3;
    case 'normal': return 2;
    case 'recover': return 1;
    case 'sick': return 3;
    case 'deload': return 3;
    default: return 0;
  }
});
</script>

<style scoped>
.vu-bar {
  --vu-red: var(--nt-accent);
  --vu-yellow: var(--nt-data-goal);
  --vu-green: var(--nt-data-positive);
  --vu-dim: rgba(var(--nt-ink), 0.12);

  flex: none;
  display: flex;
  flex-direction: column-reverse; /* red at the bottom, green on top */
  gap: 2px;
  width: 10px;
  height: 34px;
  padding: 2px;
  background: rgba(var(--nt-ink), 0.05);
  border-radius: var(--nt-radius-pill);
}

.vu-seg {
  flex: 1;
  border-radius: 3px;
  background: var(--vu-dim);
  transition: background var(--nt-dur-std) var(--nt-ease-std);
}

/* Bottom-up fill: red → yellow → green */
.vu-seg:nth-child(1).is-lit { background: var(--vu-red); }
.vu-seg:nth-child(2).is-lit { background: var(--vu-yellow); }
.vu-seg:nth-child(3).is-lit { background: var(--vu-green); }

/* Overrides: the whole bar reads as one signal color */
.vu-bar--sick .vu-seg.is-lit { background: var(--vu-red); }
.vu-bar--deload .vu-seg.is-lit { background: var(--vu-yellow); }
</style>
