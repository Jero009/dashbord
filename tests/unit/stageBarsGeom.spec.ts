import { describe, it, expect } from 'vitest';
import {
  buildStageBars,
  nearestNightIndex,
  STAGE_STACK_ORDER,
  STAGE_COLORS,
  type StageNight,
} from '@/shared/utils/stageBarsGeom';

const night = (over: Partial<StageNight> = {}): StageNight => ({
  date: '2026-09-01',
  deep: 90,
  rem: 100,
  light: 240,
  awake: 20,
  ...over,
});

describe('buildStageBars', () => {
  it('stacks segments bottom→top in deep→light→rem→awake order', () => {
    const bars = buildStageBars([night()], 300, 100);
    expect(bars).toHaveLength(1);
    const segs = bars[0].segments;
    expect(segs.map((s) => s.stage)).toEqual(['deep', 'light', 'rem', 'awake']);
    // stacked: each segment's bottom edge equals the one below its top edge
    expect(segs[0].y).toBeCloseTo(segs[1].y + segs[1].h, 5);
    expect(segs[1].y).toBeCloseTo(segs[2].y + segs[2].h, 5);
    expect(segs[2].y).toBeCloseTo(segs[3].y + segs[3].h, 5);
    // top of the stack touches the chart top; first segment sits on the x-axis
    expect(segs[3].y).toBeCloseTo(0, 5);
    expect(segs[0].y + segs[0].h).toBeCloseTo(100, 5);
  });

  it('normalizes every night to the full chart height', () => {
    const bars = buildStageBars(
      [night({ deep: 10, rem: 10, light: 10, awake: 10 }), night()],
      300,
      100
    );
    for (const bar of bars) {
      const total = bar.segments.reduce((s, seg) => s + seg.h, 0);
      expect(total).toBeCloseTo(100, 5);
    }
  });

  it('segment heights are proportional to stage minutes', () => {
    const bars = buildStageBars([night()], 300, 100);
    // total 450 min in 100px → 90min deep = 20px
    expect(bars[0].segments[0].h).toBeCloseTo((90 / 450) * 100, 5);
  });

  it('skips empty nights (no visible bar) while keeping slot alignment', () => {
    const bars = buildStageBars(
      [night(), night({ deep: 0, rem: 0, light: 0, awake: 0 }), night()],
      300,
      100
    );
    // empty middle night produces a bar with no segments — nothing renders
    expect(bars).toHaveLength(3);
    expect(bars[1].segments).toHaveLength(0);
    // outer nights keep their slot positions
    expect(bars[0].x).toBeLessThan(bars[2].x);
    expect(bars[0].x).toBeCloseTo(20, 5);
    expect(bars[2].x).toBeCloseTo(220, 5);
  });

  it('returns nothing when all nights are empty or inputs are degenerate', () => {
    expect(buildStageBars([], 300, 100)).toEqual([]);
    expect(buildStageBars([night({ deep: 0, rem: 0, light: 0, awake: 0 })], 300, 100)).toEqual([]);
    expect(buildStageBars([night()], 0, 100)).toEqual([]);
    expect(buildStageBars([night()], 300, 0)).toEqual([]);
  });

  it('only emits stages with positive minutes', () => {
    const bars = buildStageBars([night({ awake: 0 })], 300, 100);
    expect(bars[0].segments.map((s) => s.stage)).toEqual(['deep', 'light', 'rem']);
  });

  it('bar width is ~60% of slot spacing', () => {
    const bars = buildStageBars([night(), night()], 300, 100);
    const slot = 150;
    expect(bars[0].x).toBeCloseTo((slot - slot * 0.6) / 2, 5);
    expect(bars[1].x).toBeCloseTo(slot + (slot - slot * 0.6) / 2, 5);
  });
});

describe('nearestNightIndex', () => {
  it('maps x to the correct slot including edges', () => {
    // 4 slots of 100px over 400px
    expect(nearestNightIndex(0, 4, 400)).toBe(0);
    expect(nearestNightIndex(99, 4, 400)).toBe(0);
    expect(nearestNightIndex(100, 4, 400)).toBe(1);
    expect(nearestNightIndex(250, 4, 400)).toBe(2);
    expect(nearestNightIndex(399, 4, 400)).toBe(3);
  });

  it('clamps out-of-surface coordinates', () => {
    expect(nearestNightIndex(-50, 4, 400)).toBe(0);
    expect(nearestNightIndex(999, 4, 400)).toBe(3);
  });

  it('handles degenerate inputs', () => {
    expect(nearestNightIndex(10, 0, 400)).toBe(-1);
    expect(nearestNightIndex(10, 4, 0)).toBe(-1);
  });
});

describe('stage encoding', () => {
  it('uses the fixed stack order and hypnogram colors', () => {
    expect(STAGE_STACK_ORDER).toEqual(['deep', 'light', 'rem', 'awake']);
    expect(STAGE_COLORS.deep).toBe('rgba(58,99,216,0.97)');
    expect(STAGE_COLORS.light).toBe('rgba(130,170,250,0.95)');
    expect(STAGE_COLORS.rem).toBe('rgba(45,212,238,0.95)');
    expect(STAGE_COLORS.awake).toBe('var(--nt-data-goal)');
  });
});
