# Release notes v3.19.0 — full-repo debug pass

Extensive debugging session: 5 parallel read-only audits over every feature module + the shared core, every finding re-verified against the code before fixing. Evidence files: `AUDIT_finance.md`, `AUDIT_gym.md`, `AUDIT_health.md`, `AUDIT_pages.md`, `AUDIT_shared.md`.

## Fixed — high
- **Workout mirror showed wrong durations/times.** Root cause of the old "120 min for a 4-second test" bug beyond the format fix: new workouts were stored with SQLite's UTC `CURRENT_TIMESTAMP` and parsed as local — durations inflated by the UTC offset (a ~37-min session mirrored as 157 min) and start times 2 h early. `time_start` is now written as full local ISO-8601; regression test pins the round-trip. Workouts logged before this release keep their wrong mirrored values in the receiver history.
- **Gym history only ever showed the first 20 workouts.** The infinite scroll's pagination state was non-reactive, so the scroll never armed. History now pages through everything.
- **30-day sync lost sleep HR on recent nights.** The Health Connect bridge silently keeps the *oldest* samples when a read exceeds its cap — a 30-day backfill returned only ~3.5 days of heart rate. HR is now fetched in 3-day chunks so every night keeps its sleep-HR join.

## Fixed — medium
- Day windows (review digest, readiness history, net-worth trend, monthly spending chart) used UTC `date('now')` against local date keys — between local midnight and 02:00 they dropped the newest day / picked the wrong month on the 1st. All cutoffs are now computed on the local calendar.
- Rest timer expiring while not on the workout page cancelled its own alarm — no ding ever fired. Expiry now finalises state and lets the scheduled OS ding ring.
- Hermes push messages could be lost forever if delivery failed or notification permission was missing (the seen-stamp advanced past them). Failed deliveries now retry on the next poll.
- Editing any transaction wiped its (invisible) notes field — imported notes like "PayPal fee 1.20" survived edits now.
- Concurrent Home/Finance page entries could double-post a due subscription period. Auto-posting is now single-flight.

## Fixed — polish
- CSV import: lone-CR (old Mac) line endings no longer collapse the file into one row (+ regression test).
- FX rates: the 1-hour TTL actually expires per currency pair now.
- Plan updates can no longer wipe the plan goal on partial edits.
- Budget/Analytics pages follow month rollovers instead of showing the stale month.
- Exercise picker & template pages no longer double-load on open.
- Visual sweep: last raw color literals replaced with design tokens (unlit VU segments, search bar, Hermes tiles) — zero raw literals left in features/shared components.

## Known deferred (verified, logged in FIXPLAN.md)
Widget snapshot keeps yesterday's sleep values when a night is missing; sleep-HR window join is O(nights × samples) (perf only); unscoped styles on 5 gym pages; stale "today" captures on analytics components across midnight; Hermes notification-id collision corner case.
