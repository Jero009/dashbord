# v3.6 — Vitals: HRV, SpO₂, VO₂ max

## New
- **Vitals tab** (Health → Vitals): three new trend charts — heart-rate variability (30 days, with recovery z-score vs your baseline), oxygen saturation (30 days), VO₂ max (90 days with delta)
- **HRV is now synced** from Health Connect and drives scoring:
  - Readiness (battery) now uses HRV as a 7th input, scored against your personal 14-day baseline (±20% ratio → 0–10 pts)
  - The recovery signal in Analytics → Gym (ACWR overlay, overtraining banner) and the Home recovery chip automatically switch from RHR to HRV once 14+ days of HRV data exist
- SpO₂ and VO₂ max are synced and displayed (deliberately display-only — Amazfit spot-check data is too sparse to score honestly)
- Health page Body card shows today's HRV + a Vitals shortcut

## Changed
- Readiness model re-weighted (sleep score 22→18, resting HR 16→12, HRV +10, base floor now over 7 inputs) — the next sync re-scores the trailing 30 days with the new formula
- HRV/SpO₂/VO₂ max reads are optional permissions: revoking any of them never blocks core sync

## Notes
- Give the app 1–2 overnight wears to collect HRV before the recovery signal flips from RHR
- Sleep score is unchanged in this release

**Full changelog:** v3.5...v3.6
