# v3.11 — Sleep Battery + Sleep Stages widgets

Two new home-screen widgets alongside the existing sleep-score widget:

- **Sleep Battery widget (4×2):** speedometer-style ring gauge rendering the sleep score as a battery percentage — gold arc, red below 40, dot-matrix % in the center. Stats row: total sleep, bedtime, waketime.
- **Sleep Stages widget (4×2):** total / deep / REM dot-matrix readouts + horizontal stacked timeline of the night's stages in the fixed stage palette, with bedtime→wake axis ticks and legend.

Both render from the same snapshot the app pushes after every Health Connect sync (extended with bedtime/waketime, deep/REM minutes, stage segments). Ring is pre-rendered to a bitmap; timeline uses weighted RemoteViews cells (API 31+ proportional, older = equal widths). Tap opens the app.

## Audit items
- FIXPLAN #2 (homescreen widgets) — expanded from 1 to 3 widgets
