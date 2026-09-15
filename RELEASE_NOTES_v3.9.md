# v3.9 — sleep score home-screen widget

## Added
- **Sleep score widget** (3×1, Nothing-styled): true-black rounded card showing last night's sleep score in the dot-matrix face, with the night's date, a ▲/▼ 7-day delta, and tap-to-open. Resizeable horizontal/vertical.
- Architecture: the app pushes a compact JSON snapshot to a new native `DashboardWidget` plugin after **every** Health Connect sync (auto and manual); the plugin persists it and triggers the widget redraw. The provider reads the persisted snapshot directly, so the widget shows the last known score even after a reboot before the app is opened — no background polling, no battery cost.
- Widget fonts bundled natively (Doto + Space Grotesk) — matches the in-app Nothing-OS typography.

## Notes
- The widget shows `-- / NO DATA` until the first sync after installing this build.
- Sleep-score data unchanged — same pipeline, same scores; the widget mirrors what Health shows.

**Full changelog:** v3.8...v3.9
