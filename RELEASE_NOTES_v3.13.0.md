# v3.13.0 — Hardening update

Three parallel code audits (44 findings, 19 verified + fixed):

## Fixed (bugs that silently broke features)
- **PRs never recorded** — the query crashed on every workout end (invalid aggregate in subquery), so PR history/celebrations were permanently empty
- **Sleep summaries broken** — query selected a non-existent column; Analytics sleep stats and Hermes page sleep data always rendered empty
- **Rest timer killed by visiting Home/Gym tab** — entering Home while a rest was running cancelled the timer and its OS ding entirely
- **Readiness inflated 12 points** — HealthPage passed sleep efficiency as 0-100 where the scorer expects 0-1

## Hardened (edge cases)
- CSV import: native file reading fixed (content:// paths), cancel no longer wedges the buttons, UTF-8 BOM stripped, impossible dates (31.02.) rejected, ambiguous amounts (1,234 = 1234 not 1.234), batch insert is now all-or-nothing
- Bill alerts: overdue bills label correctly ("2d ago" not "in -2d"), toggle-off disarms pending alerts, default now OFF (opt-in like other reminders)
- Weight/sleep reminders check notification permission before scheduling (Android 13+)
- Goal weight/sleep goal changes in Settings now apply immediately to Home/Sleep without app restart
- Scrub marker reset on release (no stray dot when switching to shorter data)
- Recovery verdict shows a neutral hint instead of "green light to push" with no data
- -0 no longer renders as "-€0"; corrupt stored goal weight no longer yields NaN
