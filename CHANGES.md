# CHANGES.md

Phase 2 text reduction — what was cut/condensed per screen. Follows the
Nothing-OS rules in `TEXT_AUDIT.md`, with the refined insight rule:
**keep the so-what, cut the restatement** (warnings keep their consequence;
positive insights can lose it). Health-data sync failures keep retry-implying
wording. Every icon that replaced/lost text got an `aria-label`.

Build verified green (`vue-tsc` typecheck + `vite build`).

## Commit 1 — toasts & alerts (all features)
- Lowercased to Nothing-tone fragments; removed `!`, periods, and "please try again".
- `Saved!` → `saved`, `Account added.` → `added`, `Could not save account.` → `save failed`, etc.
- Confirm dialogs trimmed: `End Workout?` (+ body removed), `Cancel Workout?` → `Discard workout?` with `Keep`/`Discard` buttons, `Delete Template?` body → `"X" — can't be undone`.
- Health sync kept recoverability: `permission needed`, `health connect unavailable`, `sync failed`.

## Commit 2 — gym screens
- Buttons verb-only: `Cancel Workout` → `Cancel`; `Add Set`/`Add Exercise` → sentence case.
- Placeholders to single words: `Enter exercise name` → `Name`, `Select muscle group` → `Muscle group`, `Template name` → `Name`; dropped duplicate `Sets`/`Reps` placeholders (floating labels remain).
- Summary modal: `Workout complete` → `Complete`, `Sets done` → `Sets`, dropped `kg lifted`, `N personal records` → `N PRs`.
- `Rate of Perceived Exertion` → `RPE`; `Set Rest Time` → `Rest time` (`seconds` → `s`).
- Empty states → fragments (`No record`, `No sessions`, `No history`). Removed redundant "Workout" tile kicker.

## Commit 3 — health screens
- Sleep insights kept but de-restated: `Sleep under 7 h — recovery may be limited` → `Recovery may be limited`; `Strong sleep — recovery looks good` → `Strong sleep`; resp-rate warning keeps "watch for illness".
- Empty/sync labels trimmed: `Sync Health Connect` → `Sync`, `No stage timeline yet` → `No stages`, `Loading...` → `Loading…`.
- Circadian: `{quality} quality` → `{quality}`; dropped the two `7-night average` subs (restated label) but kept jargon-defining subs (DLMO/Tmin/MSFsc); `Today — scroll to explore` → `Today`; now-activity labels shortened (`Cognitive peak — deep work time` → `Deep work`), wind-down keeps `stop eating`.
- Body: dropped `Optional` notes placeholder and "Log your first weight above".
- Cardio: collapsed the two-sentence empty to `No activities. Check Exercise permission in Health Connect.`

## Commit 4 — plan screens
- Goal/habit form placeholders → `Name`/`Target`; link options de-verbed (`Track body weight` → `Body weight`); dropped both helper hints; `Add goal`/`Add habit` → `Add`.
- `Habit board · last 7 days` → `Habits · 7 days`, `Consistency · last 10 weeks` → `· 10 weeks`.
- Calendar: `Search events` → `Search`, `Event title` → `Title`, `Notes (optional)` → `Notes`, `Editing event` → `Editing`; day/agenda empties → fragments.
- PlanPage nav hints trimmed (`N/N done today` → `N/N done`, `N events today` → `N today`).

## Commit 5 — finance screens
- Add buttons → `Add`; count chips to bare numbers (`5 holdings` → `5`).
- Field labels/placeholders shortened (`Account name` → `Name`, `Next due date` → `Next due`, `Monthly limit` → `Limit`, `Select account` → `Account`).
- Dropped net-worth subtitle and the `No institution` fallback; tile labels (`Spent this month` → `Spent`, `Budget left` → `Left`, `Subscriptions / mo` → `Subs/mo`).
- Empty states → fragments across budget/accounts/investments/subscriptions/analytics.

## Commit 6 — analytics screens + overlay
- Load notes de-restated (`Load is spiking above your recent baseline — injury risk rises here.` → `Load spiking — injury risk rises`).
- Empty states → fragments; `Your review` → `Review`.
- Overlay: removed the explanatory lag-note paragraph; `Log a few workouts (and let recovery sync)…` → `Log workouts to build the overlay`; trimmed the no-recovery status reason.

## Commit 7 — settings
- Dropped redundant row subs (`Hours per night`, `Kilograms`, `Step target`, `Training target`), the theme hint, `Applies to all finance amounts`, and `Required for reminders`.
- `Save targets` → `Save`.
- Notification subs: kept the ones conveying timing/condition (`Before events`, `Before renewal`, `Incomplete habits`, `Wind down alert`, `Readiness + agenda`); dropped the tautological ones (`Daily log reminder`, `Week-in-review recap`).
- HC fallback sub `Steps, sleep, heart rate` → `Not synced`; AI export sub trimmed.

## Commit 8 — accessibility sweep
- Added `aria-label` to icon-only controls that had none or lost their text:
  Settings gear, workout move-up/down + stats + remove-exercise, sleep day-nav arrows, calendar + finance month-nav arrows, body delete, rest-timer seconds input.

## Not touched (intentionally)
- Section tabs, metric/data labels, event-type and recurrence option semantics, PR badges, status words (`Peak`/`Good`/`Low`), OS share-sheet metadata — all ESSENTIAL.
- Recovery `reason` strings sourced from `shared/health/insights.ts` (not a `.vue` component, outside the stated scope).
