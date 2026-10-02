## v3.22.1

- **Compact Home training signal** — now shows only the traffic-light glyph, one verdict (`GO`, `OK`, `HOLD`, `REST`, or `SICK`), and one short local reason. Removed stale receiver text, date, and grade copy.
- **Cleaner Hermes inbox** — removed the redundant Today verdict and Signals metric cards; detailed recovery remains in Analytics while Hermes keeps Insights, Grades, and pushed messages.
- **Offline-first verdict** — Home resolves and renders the local training signal before contacting the Hermes receiver, so an offline receiver cannot hide or delay the card.
- **Cleanup** — removed obsolete Home grade-sync UI and the now-unused `briefingIsToday` helper.
- **Verification** — 38 test files / 350 tests passed, lint and production build passed, and both changed routes rendered headlessly without console or page errors.
