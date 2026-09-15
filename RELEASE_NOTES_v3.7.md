# v3.7 — Hermes on-device + rest-timer background fix

## New
- **Hermes tab** (top bar, `/hermes`): one page with today's recovery verdict, the signal tiles Hermes reads when drafting briefings (readiness, sleep score, ACWR, recovery z — the same compute services as Analytics), cross-domain insights, and the latest messages Hermes pushed
- **Hermes push channel** (`docs/HERMES_PUSH.md`): Hermes can drop notifications into the existing health receiver (type `hermes`), and the app polls for them and surfaces them as real Android notifications — reuses the Capacitor Local Notifications pipeline, no new dependencies, no server changes

## Fixed
- **Rest timer now always dings — including when the app is closed or backgrounded.** The ding is scheduled with the OS (AlarmManager-backed exact alarm) the moment the timer starts, and re-scheduled on ±15 s; it's cancelled everywhere the timer is cleared on-screen (skip, uncheck, workout end/discard, expiry, Gym/Home chips). All three pages now share one timer composable (`useRestTimer`), so the cancel paths can't drift again

## Landed since v3.6 (Vitals/graphs line)
- Sleep-window HRV folded into the sleep score (12.5 pts, RR-shaped)
- SpO₂ as an 8-point readiness input behind a data-density gate (≥14 days, SD ≤ 2.5)
- Vitals 90-day HRV toggle + aggregation tiles
- TrainingLoadOverlay + Analytics heatmap brought up to v3.x chart standards

**Full changelog:** v3.6...v3.7
