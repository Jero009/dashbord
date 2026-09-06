# Bug Audit — user-reported + subagent findings (in progress)

> Companion to FEATURE_AUDIT.md. Status: gym + finance/analytics audits done, plan/calendar audit re-running (writes to BUG_AUDIT_PLAN.md), steps-bug root cause found (Health Connect plugin buckets rolling 24h windows from sync-time, not calendar days — fix = day-aligned queryAggregated calls + local-midnight keying).

## User-reported

### U1. Templates with the same name merge (confirmed in code)
- **Where:** `createTemplate` app_db.ts:1116 (bare INSERT, no name check); `workout_template` DDL app_db.ts:162 (no UNIQUE constraint); PPL seed app_db.ts:1085 (attaches by `lower(name) ... LIMIT 1`)
- **Symptom:** Two templates can share a name (separate rows, no guard). UI (Gym Home tiles, chart template dropdown) shows them identically — picking one is ambiguous. Seed re-runs can attach seed exercises to a user-created same-name template (`SELECT id ... lower(name) = lower(?) LIMIT 1`), i.e. content merges.
- **Fix:** UNIQUE constraint `name COLLATE NOCASE` on workout_template + migration merging existing duplicates; pre-insert existence check in createTemplate with a friendly alert; keep seed lookups scoped to seed-created rows.
- **Severity:** high (data ambiguity + possible content merge) · **Confidence:** high (verified)

## Gym module (subagent, 11 findings — full report in cache/delegation/subagent-summary-1)
1. Double-tap "Add set" → duplicate set_number (read-then-insert race, no constraint) — high
2. Removing a set renumbers UI only; DB keeps stale numbers → gaps, wrong previous-set hints — high
3. PR update ignores Epley 1RM (only raw weight/reps compared) — medium
4. Weekly workout count: UTC date string vs local week start — high
5. Home chart parses UTC time_start as local — wrong dates — medium
6. Template editor reload lacks ORDER BY order_index — reorder appears lost — medium
7. Double-tap template tile → two concurrent workouts, one orphaned — medium
8. Bodyweight substitution leaks into DB, inflates volume/PRs — medium
9. Workout duration includes time answering post-workout RPE prompt — low
10. Completed set with 0/NULL reps coerced to 1-rep max → false PR — low
11. Weight/reps saved only on blur — lost on app kill — low

## Finance/Analytics (subagent, 8 findings — full report in cache/delegation/subagent-summary-3)
1. PPL balance drops 'triceps' muscle group from percentages — medium
2. Overview ACWR counts training days, not calendar days (disagrees with Gym page EWMA) — medium
3. Review digest net-worth delta shows +0 when snapshots stale — low
4. Budget "Left to spend" shows fabricated negative with no budgets; counts unbudgeted spend — low
5. Foreign-currency stock quotes stored unconverted — medium
6. Local-date columns compared against UTC date('now') — off-by-one windows — low
7. upcomingBills includes forever-overdue bills; UTC vs local parse — low
8. Negative liability balances invert net worth math — low

## Health/steps
- Steps wrong: @capgo/capacitor-health queryAggregated buckets are rolling 24h windows anchored at sync-time minus 7d — not calendar days. Bucket boundaries move every sync (churn/double-count). Fix: per-day day-aligned aggregated queries [localMidnight, +1d), key by local date. (high confidence)

## Plan/calendar/habits — re-running, findings land in BUG_AUDIT_PLAN.md
