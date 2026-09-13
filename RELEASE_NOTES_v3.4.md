# v3.4 — Polish & docs: audit items #9 and #1 remain open, all code findings closed

Follow-up to v3.3. Finishes every remaining code item from the Sep 9 audit
(LOW polish batch) plus the two partial items. 11 more fixes, all verified
with build + 127 unit tests green.

## Fixes & improvements
- **Workout UX (#17)**: hardware/browser back on WorkoutPage now flushes
  unsaved set edits before leaving — nothing typed is lost.
- **Currency (#21)**: small values show cents (sub-$1 crypto no longer "$0").
- **Helper dedupe (#22)**: shared `showToast` + `formatRestTime` utils replace
  per-page copies.
- **Dead CSS (#23)**: unused styles removed across pages.
- **Design tokens (#24)**: raw `#fff`/'Doto' literals replaced with
  `var(--nt-*)` tokens.
- **GymHomePage (#25)**: the gym tab's HomePage renamed to GymHomePage (was
  colliding with the home tab's HomePage in searches and imports).
- **Weekly goal (#26)**: reads through userSettings accessors — single source.
- **nextTick (#27)**: replaced a magic 60 ms setTimeout before chart build.
- **Reorder batching (#28)**: exercise reorders commit in one batched
  transaction instead of N sequential UPDATEs.
- **Snapshot throttle (#29)**: net-worth snapshot writes at most once per day
  (was: every page visit).

## Notes
- #9 (finance CRUD composable refactor) remains deliberately deferred — pure
  dedup, no behavior change.
- #1 (AGENTS.md rewrite) was skipped this release; the dev doc still mentions
  some removed modules. Code impact: none.

**Full changelog**: v3.3.0..v3.4 covers 24 of the 29 audit findings.
