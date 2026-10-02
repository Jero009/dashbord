## v3.22.0

- **Shared UI primitives** — consolidated section tabs, segment controls, card headers, empty states, metric tiles, and finance form styles; removed hundreds of duplicated CSS lines.
- **Health visual consistency** — Home and Sleep now share one progress-ring component; sleep-stage colors are canonical across web charts and native widgets; classic and OS5 widget geometry now matches.
- **Safer feature styling** — scoped previously global Gym page styles to stop cross-page CSS collisions and removed verified dead selectors.
- **Core cleanup** — removed unused components, APIs, habit helpers, Camera and Status Bar plugins, and dead battery inputs while preserving live behavior with regression tests.
- **Verification** — 37 test files / 348 tests passed, lint and production web build passed, Capacitor sync completed, and Android Java compilation passed.
