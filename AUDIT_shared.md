# Audit — src/shared (app_db, sync, widget, utils, composables, hermesPush)

Baseline: `npm run test:unit -- --run` → 31 test files, 318 tests, all passing (~17.4s). HEAD 3e8d56c.

## finding
**title:** workout.time_start stored as UTC-naive but parsed as local → wrong duration/started_at in receiver mirror and plan-day mapping
**file:line:** src/shared/sync/workoutMirror.ts:74-85; src/shared/db/app_db.ts:1751-1755 (insert w/o time_start → DEFAULT CURRENT_TIMESTAMP), 1317-1319 (getWorkoutsForPlan)
**symptom:** `startWorkoutFromTemplate` inserts workout without `time_start`, so SQLite `DEFAULT CURRENT_TIMESTAMP` (UTC, naive `YYYY-MM-DD HH:MM:SS`) is used. `buildPayloadForWorkout` re-parses it with `.replace(' ', 'T')` and no timezone → JS reads it as LOCAL time, while `time_end` (ISO-Z from `endWorkout`) is parsed correctly. `duration_minutes` is inflated by the UTC offset (2h in Slovenia; e.g. a 4h session reports 6h), and `started_at` (via `localIsoWithOffset(start)`) is offset by the same amount. Same mis-parse in `getWorkoutsForPlan` (app_db.ts:1317) can shift a late-evening workout into the wrong plan day.
**evidence:** app_db.ts:1751 `INSERT INTO workout (id_workout_template, name) VALUES (?, ?)` (no time_start column → UTC default); workoutMirror.ts:74 `String(w.time_start).includes('T') || String(w.time_start).endsWith('Z') ? String(w.time_start) : String(w.time_start).replace(' ', 'T')` — UTC-naive falls into the local-parse branch; FIXPLAN #30 comment claims "Emit BOTH as full ISO-8601 with the local offset" but the start instant is wrong by the offset.
**severity:** high
**confidence:** high

## finding
**title:** SQL `date('now')` (UTC) compared against localDateISO-keyed columns → off-by-hours window boundaries
**file:line:** src/shared/db/app_db.ts:2541 (queryReadinessHistory), 2578-2584 (getReviewDigest sleep/readiness/spending/netThen), 3099 (getNetWorthHistory), 3120 (queryMonthlySpending)
**symptom:** `readiness_score.date`, `sleep_session.date`, `finance_transaction.date`, `net_worth_snapshot.date` are written as local calendar keys (`localDateISO`) but filtered with SQL `date('now', '-N days')`, which is UTC. In UTC+X timezones the boundary is off by the offset (Slovenia: up to 3h in summer): between local midnight and 02:00-03:00, `date('now')` is still "yesterday", so day-window edges, month start (`'start of month'`), and the net-worth "then" snapshot select the wrong row/day. Note the same file already documents this exact class of bug and avoids it in `postDueSubscriptions` (line 2877-2879).
**evidence:** app_db.ts:2541 `WHERE date >= date('now', ?)` with param `` `-${days} days` `` vs writers using `localDateISO()` (e.g. recordNetWorthSnapshot:3060, upsertReadinessScore callers); contrast app_db.ts:2877 "Local calendar date — never toISOString().slice(0,10)".
**severity:** medium
**confidence:** high

## finding
**title:** widgetBridge null-drop means widget fields can never be cleared → stale data shown forever
**file:line:** src/shared/widget/widgetBridge.ts:28-31 (mergeAndBuild), 96-111 (sleepStateToFields)
**symptom:** When a sleep sync produces null fields (no score/hours for last night), `sleepStateToFields` omits them and `mergeAndBuild` only deletes null/undefined/NaN from the merged map — the *previous* day's values survive in the snapshot mirror and keep being pushed. The sleep widget shows yesterday's score/hours indefinitely instead of the Java-side "missing → fallback" path. The pitfall is acknowledged in the design comment but the mirror makes "drop null" equivalent to "keep old value".
**evidence:** widgetBridge.ts:30 `if (v === null || v === undefined || ...) delete merged[k]` operates on `{ ...readSnapshotMirror(), ...fields }` — a field absent from `fields` is inherited from the mirror; sleepStateToFields only sets keys `if (state.sleepScore !== null)` etc.
**severity:** medium
**confidence:** medium

## finding
**title:** startWorkoutFromTemplate multi-insert is not transactional; failure leaves an orphaned active workout
**file:line:** src/shared/db/app_db.ts:1744-1808 (also resequenceWorkoutSetNumbers:1949-1963, seedPplSplitTemplates:1472-1515 loops)
**symptom:** Workout + N workout_exercise + N×set inserts run as awaited loops under one outer try/catch that rethrows. A failure mid-loop (e.g. FK/unique error on one exercise) leaves a half-created workout with `time_end IS NULL`; `getActiveWorkout()` then returns the orphan and can block starting a real session. Checklist guidance: bulk writes via `executeSet` or per-row try/catch. Same pattern (unguarded awaited update loop) in `resequenceWorkoutSetNumbers`.
**evidence:** app_db.ts:1764-1801 nested `await conn.run(...)` loops with a single catch at 1804; contrast `updateWorkoutExerciseOrders` (2021-2025) and `addFinanceTransactionsBulk` (2035-2040) which correctly use `executeSet`.
**severity:** medium
**confidence:** medium

## finding
**title:** hermesPush advances the seen stamp past messages whose delivery failed or was skipped
**file:line:** src/shared/hermes/hermesPush.ts:103-112 (pollAndDeliverHermes), 79-80 (deliverNotification permission gate)
**symptom:** Per-message `try { deliverNotification } catch {}` counts failures as non-delivered but the stamp is still advanced to `newest` from ALL fetched messages, so a message whose `LocalNotifications.schedule` threw is never retried. Additionally, when permission is not granted, `deliverNotification` returns silently (line 80) yet the caller increments `delivered` and marks the message seen — the message is permanently lost once permission is later granted.
**evidence:** hermesPush.ts:111 `const newest = messages.reduce((max, m) => Math.max(max, m.receivedAt), seen); if (newest > seen) markSeenAt(newest)` runs regardless of delivery failures; :80 `if (display !== 'granted') return` inside a function whose caller does `delivered += 1` after it resolves.
**severity:** medium
**confidence:** high

## finding
**title:** updatePlan partial update wipes goal to NULL (only field not COALESCE-guarded)
**file:line:** src/shared/db/app_db.ts:1153-1164
**symptom:** Every optional field in the UPDATE uses `COALESCE(?, col)` except `goal = ?`, bound as `input.goal !== undefined ? input.goal : null`. Any caller performing a partial update that omits `goal` clears it. No in-repo callers currently (grep), so latent, but the asymmetry contradicts the function's `Partial<...>` contract.
**evidence:** app_db.ts:1154-1160 `goal = ?,` vs `start_date = COALESCE(?, start_date), ...`; :1164 `input.goal !== undefined ? input.goal : null`.
**severity:** low
**confidence:** high

## finding
**title:** resumeRestTimer expired path leaves stale record and never removes/cancels pending ding
**file:line:** src/shared/composables/useRestTimer.ts:132-135
**symptom:** When `resumeRestTimer` finds a record with `remaining <= 0` it sets shared state inactive but does not `localStorage.removeItem(REST_TIMER_KEY)` and does not cancel a possibly still-scheduled OS ding / countdown notification (`cancelRestTimer` does both). The stale record also survives process restarts until the next start/cancel.
**evidence:** useRestTimer.ts:132-134 `if (remaining <= 0) { restTimerState.value = {...}; return ... }` — no removeItem, no `cancelRestTimerDing()`/`clearRestNotification()`, unlike cancelRestTimer (72-78).
**severity:** low
**confidence:** high

## finding
**title:** localIsoWithOffset treats date-only strings as UTC midnight → previous day west of UTC
**file:line:** src/shared/utils/timeFormat.ts:61-66
**symptom:** For a string without 'T'/'Z' and without a space (e.g. `'2026-09-30'`), `value.replace(' ', 'T')` is a no-op and `new Date('2026-09-30')` parses as UTC midnight per spec; rendering it back as local wall clock yields `2026-09-29T19:00:00-05:00` in the Americas. Callers currently pass timestamps (with time) so it's latent, but the JSDoc claims naive strings are "read as LOCAL" without carving out the date-only case (contrast `parseLocalDate` which anchors at local noon for exactly this reason).
**evidence:** timeFormat.ts:65 `new Date(/T|Z/.test(value) ? value : value.replace(' ', 'T'))`; verified `new Date('2026-09-30')` → UTC midnight (node repro).
**severity:** low
**confidence:** high

## finding
**title:** Hermes notification IDs collide across messages ~15 minutes apart
**file:line:** src/shared/hermes/hermesPush.ts:85
**symptom:** `id = 100 + ((receivedAt % 1000) + seq) % 900` — any two messages whose arrival seconds are congruent mod 900 (~15 min) and same seq overwrite each other on Android (same notification id replaces). With polls every 10 min, a burst of messages can drop earlier ones. Acknowledged as a range tradeoff in the comment, but the modulus guarantees collisions rather than merely risking them.
**evidence:** hermesPush.ts:85 `id: ID_HERMES_BASE + ((msg.receivedAt % 1000) + seq) % 900`.
**severity:** low
**confidence:** medium

## Verified clean (checklist items with no issue)
- EXPORT_DELETE_TABLES / EXPORT_INSERT_TABLES / deleteOrder / insertOrder all match the 22 actual tables (grep CREATE TABLE vs lists); import mirrors export lists exactly (app_db.ts:3218-3219).
- Correlated-subquery aggregates (updateExercisePRs, getExerciseHistory) use ORDER BY/LIMIT pattern, not MAX() in WHERE — prepare-time error avoided.
- replaceHealthMetric nullable `source` delete uses `(source = ? OR (source IS NULL AND ? IS NULL))` correctly.
- pullIncremental: 2h overlap, callers dedupe by receivedAt, stamp from row received_at (not parsed items) — all per spec; dirty workout queue has JSON guard and clears only on flush success.
- Analytics queries (queryVolumeByMuscleGroup etc.) compare UTC `created_at` against UTC `toISOString()` cutoff — internally consistent.
- widgetBridge snapshot is merged over the mirror (not full-replaced) and themeStyle is always explicit.
- useTheme persists both axes (`app_theme`, `app_theme_style` classic|os5) and registers prefers-color-scheme listener with legacy fallback.
