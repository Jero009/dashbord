# v3.16.0 — Seasonal Gym Plans

## New: Gym Plans
- Create a seasonal training plan (3–6 months): name, primary goal, start date, length (8–26 weeks), which templates belong to it.
- **Deload cadence is yours to set**: every N weeks (or off) + intensity % — replaces the hardcoded school-cycle calendar (which remains as fallback until your first plan exists).
- Plan tab: week counter, goal, next-deload date, per-template done counts, past plans browsable read-only.
- **Pause / Resume**: pause with a reason (Sick / Recovery / School / Travel / Other). The plan clock freezes and everything slides — deloads move, end date moves. School/travel pauses resume without a weight ramp; sick/recovery pauses cap prefill weights at ~85% for a couple of sessions ("back after X days" hint).
- Gym Home: plan strip (week + deload countdown, or paused state) + compact weight/tonnage trend chart of plan workouts with template filter.

## New: Health Heatmap + sickness catalog
- GitHub-style heatmap on Analytics with three layers: **Workouts / Sick / Readiness** — scrollable back through years, tap any day for detail (workouts, tonnage, readiness, events).
- Life-event log (sick with severity, recovery, school, travel…): starts today, grows forever — built for "how did being sick hit my training" over years. Plan pauses feed it automatically.
- Analytics: Plan progress card — adherence vs expected, deloads completed, trend with est-1RM overlay, sick/pause shading behind the tonnage line, per-template breakdown, first-week vs last-week lift comparison, pause log.

## Fixes
- Gym mirror timestamps now consistent ISO-8601 with offset + app-side duration (receiver-side workout durations were parsing wrong).
- Old 10-week heatmap replaced by the new full heatmap.

Nothing-OS theme throughout; 297 unit tests green.
