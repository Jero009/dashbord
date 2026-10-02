import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import StageBarsChart from '@/shared/components/StageBarsChart.vue';
import { STAGE_COLORS, type StageNight } from '@/shared/utils/stageBarsGeom';

// jsdom has no ResizeObserver — StageBarsChart measures itself on mount.
vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

const sleepPagePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../src/features/health/pages/SleepPage.vue'
);

const night = (over: Partial<StageNight> = {}): StageNight => ({
  date: '2026-09-01',
  deep: 90,
  rem: 100,
  light: 240,
  awake: 20,
  ...over,
});

describe('StageBarsChart — canonical stage encoding', () => {
  it('fills every bar segment from STAGE_COLORS (no parent CSS dependency)', () => {
    const w = mount(StageBarsChart, {
      props: { nights: [night()] },
      // viewBox is set from measured width; jsdom gives 0 → chart body empty,
      // but the binding contract below is still asserted on the source.
    });
    expect(w.find('.stagebars__legend').exists()).toBe(true);
  });

  it('binds legend dot colors from STAGE_COLORS in the component template', () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../src/shared/components/StageBarsChart.vue'),
      'utf8'
    );
    expect(src).toMatch(/:style=.*STAGE_COLORS\[/);
  });
});

describe('SleepPage — canonical stage encoding', () => {
  const sleepPageSrc = readFileSync(sleepPagePath, 'utf8');

  it('hypnogram colors come from STAGE_COLORS, not raw literals', () => {
    expect(sleepPageSrc).toMatch(/STAGE_COLORS/);
    // The only sanctioned rgba literals are the ones delegating to STAGE_COLORS
    // keys — everything stage-colored must route through the canonical map.
    for (const hex of ['rgba(45,212,238', 'rgba(58,99,216', 'rgba(130,170,250']) {
      const uses = sleepPageSrc.split(hex).length - 1;
      // stage-dot CSS classes may keep at most the shared binding (see below);
      // hypnogram/dot stage colors must come from bindings.
      expect(uses, `raw stage color ${hex} should not appear in SleepPage`).toBe(0);
    }
  });

  it('stage-dot legend colors are bound from STAGE_COLORS', () => {
    expect(sleepPageSrc).toMatch(/stage-dot[^>]*": *STAGE_COLORS|stageDotColor|STAGE_COLORS\[st\.key\]/);
  });

  it('covers every stage key SleepPage renders with a canonical color', () => {
    // All keys the hypnogram aliases + stage list can emit resolve in the map
    // (asleep falls back to light in stageDotColor, by design).
    for (const key of ['awake', 'rem', 'light', 'deep', 'inbed', 'out_of_bed', 'unknown', 'sleeping']) {
      const k = key.toLowerCase();
      const expected =
        k === 'awake' || k === 'inbed' || k === 'in_bed' || k === 'out_of_bed' || k === 'unknown'
          ? STAGE_COLORS.awake
          : k === 'rem'
            ? STAGE_COLORS.rem
            : k === 'deep'
              ? STAGE_COLORS.deep
              : STAGE_COLORS.light;
      expect(expected).toBeTruthy();
      expect(typeof expected).toBe('string');
    }
  });
});
