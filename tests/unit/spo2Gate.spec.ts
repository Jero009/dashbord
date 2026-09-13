import { describe, it, expect } from 'vitest';
import { calculateSpo2Score, isSpo2GateActive } from '@/shared/health/sleepJoin';

describe('Spo2Gate', () => {
  // Test data: 14 days of spo2 readings with stable variance (SD ≤ 2.5)
  const STABLE_SPO2 = Array.from({ length: 14 }, (_, i) => 95 + (i % 2));
  // Test data: 14 days with unstable variance (SD > 2.5) — wider swings
  const UNSTABLE_SPO2 = Array.from({ length: 14 }, (_, i) => i % 2 === 0 ? 90 : 98);
  // Test data: insufficient days (13)
  const SHORT_SPO2 = Array.from({ length: 13 }, (_, i) => 95 + (i % 2));

  describe('isSpo2GateActive', () => {
    it('returns true for ≥14 days of stable spo2 readings', () => {
      expect(isSpo2GateActive(STABLE_SPO2)).toBe(true);
    });

    it('returns false for <14 days of readings', () => {
      expect(isSpo2GateActive(SHORT_SPO2)).toBe(false);
    });

    it('returns false for stable readings with unstable variance', () => {
      expect(isSpo2GateActive(UNSTABLE_SPO2)).toBe(false);
    });
  });

  describe('calculateSpo2Score', () => {
    it('returns null when the gate is inactive', () => {
      expect(calculateSpo2Score(96, 95, SHORT_SPO2)).toBeNull();
    });

    it('scores 0 when the gate is active but no baseline exists', () => {
      expect(calculateSpo2Score(96, null, STABLE_SPO2)).toBe(0);
    });

    it('scores 0 when the gate is active but the reading is null', () => {
      expect(calculateSpo2Score(null, 95, STABLE_SPO2)).toBe(0);
    });

    it('scores 8 when the reading is at the baseline', () => {
      expect(calculateSpo2Score(95, 95, STABLE_SPO2)).toBe(8);
    });

    it('scores 0 when the reading is ≥3% below baseline', () => {
      expect(calculateSpo2Score(92, 95, STABLE_SPO2)).toBe(0);
    });

    it('scores 4 when the reading is 1.5% below baseline', () => {
      expect(calculateSpo2Score(93.5, 95, STABLE_SPO2)).toBe(4);
    });

    it('scores 4 when the reading is 1.5% above baseline', () => {
      expect(calculateSpo2Score(96.5, 95, STABLE_SPO2)).toBe(4);
    });

    it('scores 0 when the reading is ≥3% above baseline', () => {
      expect(calculateSpo2Score(98, 95, STABLE_SPO2)).toBe(0);
    });
  });
});