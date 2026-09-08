import { describe, it, expect } from 'vitest';
import { padExtent, smoothPath, nearestXIndex } from '@/shared/utils/chartGeom';

describe('padExtent', () => {
  it('pads by ratio of range', () => {
    const [min, max] = padExtent([0, 100]);
    expect(min).toBeLessThan(0);
    expect(max).toBeGreaterThan(100);
    expect(max - min).toBeCloseTo(116, 5);
  });
  it('flat series gets a symmetric window', () => {
    const [min, max] = padExtent([50, 50]);
    expect(min).toBe(45);
    expect(max).toBe(55);
  });
  it('empty returns [0,1]', () => {
    expect(padExtent([])).toEqual([0, 1]);
  });
});

describe('smoothPath', () => {
  it('empty → empty string', () => {
    expect(smoothPath([], [])).toBe('');
  });
  it('single point → M only', () => {
    expect(smoothPath([5], [7])).toBe('M 5.00 7.00');
  });
  it('two points → straight line', () => {
    expect(smoothPath([0, 10], [0, 10])).toBe('M 0.00 0.00 L 10.00 10.00');
  });
  it('starts and ends on the data points', () => {
    const d = smoothPath([0, 5, 10, 15], [10, 5, 8, 2]);
    expect(d.startsWith('M 0.00 10.00')).toBe(true);
    expect(d.endsWith('15.00 2.00')).toBe(true);
  });
  it('contains bezier segments between points', () => {
    const d = smoothPath([0, 5, 10, 15], [10, 5, 8, 2]);
    expect(d.match(/C /g)?.length).toBe(3);
  });
});

describe('nearestXIndex', () => {
  it('finds nearest', () => {
    expect(nearestXIndex([0, 10, 20, 30], 12)).toBe(1);
    expect(nearestXIndex([0, 10, 20, 30], 25)).toBe(2);
  });
  it('empty series returns 0', () => {
    expect(nearestXIndex([], 5)).toBe(0);
  });
});
