# Release notes v3.5

## Sleep
- New: 30-night sleep stage composition chart — stacked deep / light / REM / awake per night, scrubbable with per-night readout and haptic ticks.
- Sleep history split into duration (with goal line) and score (goal 70) trend charts.
- Overnight heart rate chart gains average line + min/max range labels.
- Hypnogram: stage legend, smoother same-stage merging, wake-up spike width now reflects time awake, better empty state.
- Sleep score ring animates in and counts up.

## Feel & consistency (Nothing OS, smoother)
- Shared card primitives (kicker / metric tile / empty state) replace 17 hand-copied page styles — consistent spacing and type app-wide.
- Press feedback (`nt-press`) + haptics on nav pills, sync button, date nav, quick actions.
- Day-switch fade+rise on the sleep page; staggered dot-pulse sync button state.
- All motion uses theme tokens; `prefers-reduced-motion` respected.

## Health Connect sync — bug fixes
- Fixed: sleep heart rate was only fetched for the last 7 days, so nights older than that permanently had no sleep HR / HR timeline and degraded readiness scores. HR now covers the full 30-day sync window.
- Fixed: respiratory rate was bucketed by calendar day, splitting overnight sessions at midnight. Sleep-session RR is now matched to the sleep window (full-night average).
- Auto-sync is now incremental (days since last sync + 2-day overlap) instead of re-reading all 30 days every 30 minutes — far fewer Health Connect queries per sync. Manual syncs still cover the full 30 days.
- Sync logic extracted to a tested pure module (new unit tests for the sleep/HR/RR window join).
