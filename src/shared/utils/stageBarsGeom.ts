import { clamp } from '@/shared/utils/math';

/** One night's stage composition, minutes per stage. */
export interface StageNight {
  date: string;
  deep: number;
  rem: number;
  light: number;
  awake: number;
}

/** A single stacked segment in chart coordinates. */
export interface StageSegment {
  /** stage key, stacking order deep -> light -> rem -> awake */
  stage: 'deep' | 'light' | 'rem' | 'awake';
  y: number;
  h: number;
}

/** One night's rendered bar: x position plus its stacked segments bottom→top. */
export interface StageBar {
  x: number;
  /** index into the source nights array (for readout joining) */
  idx: number;
  segments: StageSegment[];
}

export const STAGE_STACK_ORDER = ['deep', 'light', 'rem', 'awake'] as const;

/** Stage colors — identical encoding to the hypnogram/stage dots (theme contract). */
export const STAGE_COLORS: Record<(typeof STAGE_STACK_ORDER)[number], string> = {
  deep: 'rgba(58,99,216,0.97)',
  light: 'rgba(130,170,250,0.95)',
  rem: 'rgba(45,212,238,0.95)',
  awake: 'var(--nt-data-goal)',
};

/**
 * Build the stacked bars for the chart.
 * - Nights with zero total minutes are skipped entirely (honest gap, not zero-height).
 * - Each night gets one slot even when neighbours are skipped, so bars stay aligned
 *   with their position in the night sequence.
 */
export function buildStageBars(
  nights: StageNight[],
  width: number,
  height: number,
  slotPadPx = 0
): StageBar[] {
  const total = nights.reduce(
    (s, n) => s + n.deep + n.rem + n.light + n.awake, 0);
  if (!nights.length || total <= 0 || width <= 0 || height <= 0) return [];

  const slot = width / nights.length;
  const barW = Math.max(slot * 0.6 - slotPadPx, 1);

  return nights.map((n, idx) => {
    const nightTotal = n.deep + n.rem + n.light + n.awake;
    const x = slot * idx + (slot - barW) / 2;
    const segments: StageSegment[] = [];
    let yBottom = height;
    if (nightTotal > 0) {
      for (const stage of STAGE_STACK_ORDER) {
        const minutes = n[stage];
        if (minutes <= 0) continue;
        const h = (minutes / nightTotal) * height;
        yBottom -= h;
        segments.push({ stage, y: yBottom, h });
      }
    }
    return { x, idx, segments };
  });
}

/**
 * Map a pointer x position to the index of the nearest night slot.
 * The whole surface is the touch target; edges clamp to the first/last slot.
 */
export function nearestNightIndex(x: number, count: number, width: number): number {
  if (count <= 0 || width <= 0) return -1;
  const slot = width / count;
  return clamp(Math.floor(x / slot), 0, count - 1);
}
