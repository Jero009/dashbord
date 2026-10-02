<template>
  <ion-toolbar class="section-toolbar">
    <div class="nt-segment-pill">
      <ion-segment :value="activeSegment" @ionChange="handleSegmentChange" scrollable>
        <ion-segment-button v-for="seg in segments" :key="seg.value" :value="seg.value">
          <ion-label>{{ seg.label }}</ion-label>
        </ion-segment-button>
      </ion-segment>
    </div>
  </ion-toolbar>
</template>

<!--
  Shared second-level section tabs (Analytics / Finance / Health previously
  carried three byte-identical clones). Data-driven: the caller supplies the
  segment list; active matching + haptic navigation live here.

  Matching: each segment activates when the current path equals `path` exactly
  (`exact: true` — the overview root, so '/analytics/gym' doesn't re-match it)
  or contains any of `match` (default [path]). Entries are checked in array
  order; overview must come first with `exact: true` because every sibling
  path contains it as a substring.

  Styling comes from the global `.nt-segment-pill` primitive (variables.css);
  this component ships no scoped styles.
-->
<script setup lang="ts">
import { IonToolbar, IonSegment, IonSegmentButton, IonLabel } from '@ionic/vue';
import { hapticLight } from '@/shared/utils/haptics';
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

export interface SectionTabSegment {
  /** Segment key, also the ion-segment-button value. */
  value: string;
  /** Visible label. */
  label: string;
  /** Path pushed on selection. */
  path: string;
  /** Substrings that activate this segment; defaults to [path]. */
  match?: string[];
  /** Match `path` exactly only (for the overview root). Defaults to false. */
  exact?: boolean;
}

const props = defineProps<{ segments: SectionTabSegment[] }>();

const route = useRoute();
const router = useRouter();

const isActive = (seg: SectionTabSegment): boolean =>
  seg.exact
    ? route.path === seg.path
    : (seg.match ?? [seg.path]).some((m) => route.path.includes(m));

// Unknown route → the first entry (the configured overview) stays active,
// mirroring the previous per-feature `return 'overview'` fallbacks.
const activeSegment = computed(() => props.segments.find(isActive)?.value ?? props.segments[0]?.value ?? '');

const handleSegmentChange = (event: CustomEvent) => {
  const value = (event.detail as { value?: string }).value;
  if (!value) return;
  hapticLight();

  const dest = props.segments.find((s) => s.value === value)?.path;
  if (dest && dest !== route.path) {
    // Swallow aborted/redirected navigations so they never surface as
    // unhandled rejections (same contract as DashboardTopBar).
    router.push(dest).catch(() => {});
  }
};
</script>

<style scoped>
.section-toolbar {
  --background: transparent;
  --border-width: 0;
  --box-shadow: none;
  --padding-top: 0;
  padding: 2px 10px 6px;
  margin-top: -2px;
}
</style>
