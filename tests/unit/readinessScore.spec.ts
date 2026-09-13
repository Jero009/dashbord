import { describe, expect, it } from 'vitest';
import { calculateReadinessScore, type ReadinessInputs } from '@/shared/health/healthConnect';

const fullInputs: ReadinessInputs = {
  sleepHours: 8,
  sleepEfficiency: 0.6,   // fixtures kept mid-range so every variant stays
  sleepScore: 40,         // under the 100 clamp and score diffs stay visible
  restingHr: 55,
  sleepHeartRate: 50,
  respiratoryRate: 14.5,
  hrv: 65,
  steps: 8000,
  rhrBaseline: 55,
  sleepHrBaseline: 50,
  respiratoryRateBaseline: 14.5,
  hrvBaseline: 65,
};

describe('calculateReadinessScore', () => {
  it('returns 0–100 for full inputs', () => {
    const s = calculateReadinessScore(fullInputs);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });

  it('full healthy inputs score high (≥70)', () => {
    expect(calculateReadinessScore(fullInputs)).toBeGreaterThanOrEqual(70);
  });

  it('all-null scored inputs → 0 (base floor scales to 0)', () => {
    const empty: ReadinessInputs = {
      sleepHours: null, sleepEfficiency: null, sleepScore: null,
      restingHr: null, sleepHeartRate: null, respiratoryRate: null,
      hrv: null, steps: null,
      rhrBaseline: null, sleepHrBaseline: null, respiratoryRateBaseline: null,
      hrvBaseline: null,
    };
    expect(calculateReadinessScore(empty)).toBe(0);
  });

  it('each null scored input drops the base floor by 1/7', () => {
    // All components at their max: nulling one input loses its component score
    // AND 1/7 of the base. Compare one-null vs full with matched components.
    const withNullHrv: ReadinessInputs = { ...fullInputs, hrv: null, hrvBaseline: fullInputs.hrvBaseline };
    const full = calculateReadinessScore(fullInputs);
    const nullHrv = calculateReadinessScore(withNullHrv);
    // HRV at baseline scores exactly 5; nulling it loses 5 component pts + 24/7 base pts
    expect(full - nullHrv).toBeCloseTo(5 + 24 / 7, 0);
  });

  it('HRV exactly at baseline → 5 pts', () => {
    const atBaseline = calculateReadinessScore(fullInputs);
    const below = calculateReadinessScore({ ...fullInputs, hrv: 52 }); // -20%
    expect(atBaseline - below).toBeCloseTo(5, 0);
  });

  it('HRV −20% vs baseline → 0 HRV pts but counts as present (real data)', () => {
    // −20% reading scores 0 component pts yet keeps the 7/7 base floor —
    // unlike a missing reading (6/7 base), so null − atBaseline ≠ null − below.
    const s = calculateReadinessScore({ ...fullInputs, hrv: 52 });
    const noHrv = calculateReadinessScore({ ...fullInputs, hrv: null });
    expect(s).toBe(85); // 7/8 base (21) + components 64.4 + hrv 0 → round(85.4)
    expect(noHrv).toBe(82); // 6/8 base (18) + components 64.4 → round(82.4)
  });

  it('HRV +20% vs baseline → 10 pts (cap of the ratio rule)', () => {
    const s = calculateReadinessScore({ ...fullInputs, hrv: 78 });
    const atBaseline = calculateReadinessScore({ ...fullInputs, hrv: 65 });
    expect(s - atBaseline).toBe(5); // 10 vs 5
  });

  it('missing hrvBaseline → HRV contributes 0 pts but still presence-counted', () => {
    // A reading without a baseline is real data: 0 component pts, 7/7 base floor.
    const s = calculateReadinessScore({ ...fullInputs, hrvBaseline: null });
    const noHrv = calculateReadinessScore({ ...fullInputs, hrv: null });
    expect(s).toBe(85); // 7/8 base with spo2 absent
    expect(noHrv).toBe(82);
  });

  it('steps never affect the score', () => {
    expect(calculateReadinessScore({ ...fullInputs, steps: 25000 }))
      .toBe(calculateReadinessScore({ ...fullInputs, steps: null }));
  });
});
