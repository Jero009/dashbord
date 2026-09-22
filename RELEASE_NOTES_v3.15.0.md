## v3.15.0 — Morning briefing + verdict VU bar

### Morning briefing (Hermes side)
- Daily briefing now lands in the **morning** (~07:40 local; 10:30 refresh catches late-syncing sleep data)
- Headline-first: "Good day to push", "Take it easy today — recovery is low (RHR …)", "You might be getting sick — rest today", "Deload week (week N) — cut weights to ~65–70%"
- Deload weeks come from the 12 Week Year cycles (weeks 3/6/9/12)
- Every claim cites its numbers (sleep hours, HRV z, RHR z, ACWR)

### Verdict VU bar (app + widget)
- New single VU-meter-style bar: 3 segments, bottom-up red/yellow/green
- Fill = how hard the day is: 1 lit (red) = recover · 2 lit = normal · all 3 = push
- Sick day: whole bar solid red · Deload: whole bar solid yellow
- Rendered on the Home briefing card **and** inside the Hermes Briefing widget

### Fixed
- **Black text on grey** (Hermes tab and anywhere else): `--ion-text-color` was never defined, so Ionic's hard-coded `#000` fallback hit every unstyled element. Now defined in both themes — app-wide fix.

### Tests
- 244 unit tests green, lint clean, Java compile verified.
