## v3.15.1 — deload-aware workouts + VU bar color fix

### Deload weeks now reach the workout player
- Banner under the workout header: "Deload week (week 3) — suggest ~68% of last time"
- Per-exercise hint swaps progression for deload: "Deload — last 80 kg × 5, work around 52.5 kg"
- **New sets default to the deload weight** — the pre-filled number IS the recommendation, rounded down to 2.5 kg steps (err light)
- Calendar mirrors the briefing's 12-week cycles (weeks 3/6/9/12, cycles Sep 7 / Dec 7 / Mar 8) — app and Hermes can never disagree

### Fixed: widget VU bar rendered grey
- The segments were tinted over a 12%-alpha drawable — the tint composited down to grey on black. Segments now swap between opaque red/yellow/green drawables directly.

### Tests
- 258 unit tests green (14 new for the deload calendar/rounding), lint clean, Java compile verified.
