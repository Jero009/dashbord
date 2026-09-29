# v3.18.6

## Briefing verdict — race fix
- `loadAll` now awaits `loadRecovery()` before `loadBriefing()`. Previously both ran concurrently, so the briefing verdict usually resolved on a null recovery snapshot and silently degraded to "OK/normal" — including the level pushed to the briefing widget. Card, recovery chip, and widget now always agree.

## Local verdict engine (carried from 68d02ae, now shipping correctly)
- Fully in-app verdict: sick (life_event) > deload (plan week) > recovery engine (EWMA ACWR + recovery z + readiness). No Hermes-pushed level is consumed.
- Widget snapshot always receives a level so a sick→healthy flip clears the stale glyph.
