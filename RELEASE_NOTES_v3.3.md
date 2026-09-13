# v3.3 — Audit fixes: 20 of 29 findings resolved

GLM 5.3 audited the whole app (29 findings) on Sep 9; this release fixes the
HIGH + MEDIUM items by hand (the agent runs were unreliable, so every fix was
written and verified manually — build + 127 unit tests green at each commit).

## High-priority bug fixes
- **Rest-timer ghost ding (#2)** — cancelling/finishing a rest on the Home
  pages now cancels the scheduled OS notification; no more dings for rests
  that already ended on screen.
- **RPE prompt hang (#3)** — dismissing the session-RPE alert no longer leaves
  the workout stuck active.
- **Unbounded queries (#4)** — workout/body-log queries get LIMITs; Finance
  overview aggregates month totals in SQL; History page paginates (20/page)
  instead of N+1-loading the entire history.
- **One recovery system (#5)** — Home recovery chip, Analytics hero and the
  training-load overlay all share the same EWMA-ACWR + recovery-z verdict
  (`todayRecovery.ts`); legacy SMA math deleted. Same day can no longer say
  "Train hard" on one page and red-risk on another.
- **Finance loading/error states (#6)** — page-level loading dots and
  per-card "Couldn't load" errors; DB failures no longer masquerade as
  "no data".
- **FX conversion (#7)** — stock/fund quotes are converted to your currency at
  fetch time (frankfurter.app, cached); failures are flagged, not silent.
- **Prices refresh hardening (#13)** — 15 s timeout, honest "updated HH:MM"
  stamp, partial-failure toasts.

## Fixes & improvements
- Dead code deletion (#8): orphaned sleep-summary + exercise-stats functions.
- Error handling (#10): blur-save failures toast; refresh spinners always
  complete.
- Budget math (#11): "Left to spend" compares budgeted categories only, with
  an explicit unbudgeted-spend note and the month in the label.
- Subscription auto-post (#12): due subscription periods now post as
  transactions (idempotent, catches up missed periods).
- Safe import/export (#14): automatic pre-import backup, page reload after
  import, double-tap export guard.
- Chart updates (#16): charts update in place instead of being destroyed and
  recreated on every view entry.
- Workout UX (#15, #17): no more double initial load; unchecking a set stops
  the rest timer; rest-progress bar no longer overflows on +30s.
- Health Connect feedback (#18): auto-sync failures surface once via toast;
  "last sync" stamp stays current.
- Sleep query slimmed (#19): analytics stops fetching unused timeline blobs.
- Body log (#20): delete confirmations; logging a date twice opens edit mode
  instead of dead-ending.

## Deferred (deliberate)
- #9 (finance CRUD composable refactor) — pure dedup, high regression risk,
  no behavior gain. Revisit if the finance pages need feature work anyway.
- #21–#29 LOW polish items remain open; see FIXPLAN.md.
