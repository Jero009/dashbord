<template>
  <!--
    Verdict VU bar — Glyph-LED meter encoding the daily briefing level, styled
    after the Nothing Glyph Bar: SQUARE segments, uniform size, small gaps,
    each lit in its own color. Segments bottom→top: red / yellow / green.
    Bottom-up fill = how hard the day is:
      recover → 1 lit (red) · normal → 2 lit (red+yellow) · push → 3 lit
    Overrides paint the WHOLE bar in one color: sick → solid red, deload →
    solid yellow. Null level → all segments unlit (powered-down LEDs).
    Unlit = the SAME hue at very low intensity (a dim LED, never grey).
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

  flex: none;
  display: flex;
  flex-direction: column-reverse; /* red at the bottom, green on top */
  gap: 3px;
  padding: 3px;
  background: rgba(var(--nt-ink), 0.05);
  border-radius: var(--nt-radius-sm);
}

/* Glyph-LED segments: squares with just-off-square corners, uniform size.
   No pill rounding — the Nothing Glyph Bar is square blocks. */
.vu-seg {
  flex: 1;
  aspect-ratio: 1;
  width: 14px;
  border-radius: 3px;
  /* Unlit = same hue at ~14% — a powered-down LED, still readable as
     red/yellow/green, clearly dimmer than any lit segment. */
  transition: background var(--nt-dur-std) var(--nt-ease-std);
}
.vu-seg:nth-child(1) { background: color-mix(in srgb, var(--vu-red) 14%, transparent); }
.vu-seg:nth-child(2) { background: color-mix(in srgb, var(--vu-yellow) 12%, transparent); }
.vu-seg:nth-child(3) { background: color-mix(in srgb, var(--vu-green) 13%, transparent); }

/* Lit = FULL brightness, unmistakable against the unlit tint */
.vu-seg:nth-child(1).is-lit { background: var(--vu-red); }
.vu-seg:nth-child(2).is-lit { background: var(--vu-yellow); }
.vu-seg:nth-child(3).is-lit { background: var(--vu-green); }

/* Overrides: the whole bar reads as one signal color */
.vu-bar--sick .vu-seg.is-lit { background: var(--vu-red); }
.vu-bar--deload .vu-seg.is-lit { background: var(--vu-yellow); }
</style>
