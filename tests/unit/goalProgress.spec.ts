import { describe, it, expect } from 'vitest';
import { goalDirection, goalProgressFraction, goalReached } from '@/shared/utils/goalProgress';

describe('goalProgress', () => {
  it('treats a weight goal starting above target as a decrease goal', () => {
    const g = { link_type: 'weight', target_value: 75, current_value: 76, start_value: 80 };
    expect(goalDirection(g)).toBe('down');
    // started 80, target 75 (span 5), now 76 → 4 kg lost of 5 = 80%
    expect(goalProgressFraction(g)).toBeCloseTo(0.8, 5);
    expect(goalReached(g)).toBe(false);
  });

  it('completes a weight-loss goal when the scale reaches the target', () => {
    const g = { link_type: 'weight', target_value: 75, current_value: 75, start_value: 80 };
    expect(goalReached(g)).toBe(true);
    expect(goalProgressFraction(g)).toBe(1);
  });

  it('completes a weight-loss goal when the scale drops below the target', () => {
    const g = { link_type: 'weight', target_value: 75, current_value: 74, start_value: 80 };
    expect(goalReached(g)).toBe(true);
    expect(goalProgressFraction(g)).toBe(1);
  });

  it('treats a weight goal starting below target as a gain goal', () => {
    const g = { link_type: 'weight', target_value: 80, current_value: 76, start_value: 72 };
    expect(goalDirection(g)).toBe('up');
    expect(goalReached(g)).toBe(false);
    expect(goalProgressFraction(g)).toBeCloseTo(0.95, 5); // 76/80
  });

  it('keeps lift_pr and savings as increase goals even when above target', () => {
    const pr = { link_type: 'lift_pr', target_value: 100, current_value: 110, start_value: 120 };
    expect(goalDirection(pr)).toBe('up');
    expect(goalReached(pr)).toBe(true);
    const save = { link_type: 'savings', target_value: 1000, current_value: 500, start_value: 1200 };
    expect(goalDirection(save)).toBe('up');
    expect(goalReached(save)).toBe(false);
    expect(goalProgressFraction(save)).toBeCloseTo(0.5, 5);
  });

  it('manual goal with no start_value counts up to target', () => {
    const g = { link_type: null, target_value: 10, current_value: 4, start_value: null };
    expect(goalDirection(g)).toBe('up');
    expect(goalProgressFraction(g)).toBeCloseTo(0.4, 5);
    expect(goalReached({ ...g, current_value: 10 })).toBe(true);
  });

  it('manual goal whose first entry exceeds target becomes a decrease goal', () => {
    const g = { link_type: null, target_value: 75, current_value: 76, start_value: 76 };
    expect(goalDirection(g)).toBe('down');
    expect(goalReached(g)).toBe(false);
    expect(goalReached({ ...g, current_value: 75 })).toBe(true);
  });

  it('clamps progress to [0,1]', () => {
    const over = { link_type: 'weight', target_value: 75, current_value: 70, start_value: 80 };
    expect(goalProgressFraction(over)).toBe(1);
    const under = { link_type: 'weight', target_value: 75, current_value: 85, start_value: 80 };
    expect(goalProgressFraction(under)).toBe(0);
  });
});
