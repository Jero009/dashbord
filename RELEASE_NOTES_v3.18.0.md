# v3.18.0 — widget material fixes, plan-driven verdict, activity widget, new icon

## Fixes
- **Header line/band removed** — Ionic's default drop-shadow under the header
  drew a grey band across every page (all styles). Headers are now flat,
  borderless, shadowless — the Nothing way.
- **OS 5 widget translucency** — widget panels dropped from ~85% to ~55%
  opacity so your wallpaper actually shows through; hairline edge strengthened.
- **VU verdict bar is always colored** — unlit segments now glow dimly in
  their own color (dim red / dim yellow / dim green, like Nothing's Glyph
  LEDs) instead of grey, in the app and in the briefing widget.

## Briefing verdict: your plan is now the source of truth
- The Home briefing card and briefing widget take their verdict from the
  **active gym plan**: a deload week forces HOLD · deload (week N) no matter
  what the Hermes briefing said. Normal weeks keep the Hermes level; no plan
  = previous behavior.

## New
- **GitHub-style activity widget** — 8-week workout contribution grid
  (red-accent shades), updates on every Health Connect sync and instantly
  when you finish a workout. Classic + OS 5 skins.
- **HealthHeatmap moved to Analytics → Overview** (Workouts / Sick /
  Readiness layers with tap-a-day detail). Life Events stays on the Plan tab.
- **New launcher icon** — black background, white dot-matrix motif, one red
  accent dot. Nothing-style, monochrome-compatible.
- **Finance reset** — "Reset finance data" at the bottom of Finance →
  Overview wipes all accounts, transactions, investments, subscriptions,
  budgets and net-worth snapshots after a destructive confirm.

## Internal
- Briefing verdict resolution extracted to a pure, unit-tested helper
  (plan > Hermes level); 5 new tests (311 total).
