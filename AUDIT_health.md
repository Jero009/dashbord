# Health feature + shared health services audit (READ-ONLY)

Baseline: `npm run test:unit -- --run` → 31 files / 318 tests, all passing.

Scope: src/features/health/** + src/shared/health/** (incl. HealthConnectAutoSync.vue, healthConnect.ts, sleepJoin.ts, trainingLoad.ts, recoveryBaseline.ts, overtraining.ts, recoveryTime.ts, todayRecovery.ts, insights.ts, vitalsAggregate.ts) + touched cross-file call sites (notifications.ts, userSettings.ts, app_db.ts, plugin internals).

## finding
**Title:** Sleep HR window join is O(n·m) per night — 30-night sync scans 144k samples ~30 times
**File:line:** src/shared/health/healthConnect.ts:688 (sleepWindowHeartRate call in sleep loop); src/shared/health/sleepJoin.ts:36-41
**Symptom:** `sleepWindowHeartRate(sample, heartRateSamples)` does a linear `filter` over the full HR array for every night in the sync window, and it is called again per-night in the readiness loop via `sleepWindowHeartRateAverage`. With ~1440 HR samples/day from the Amazfit and a 30-day window (~43k samples; 5000-sample bridge cap mitigates but doesn't remove the cost), a manual 30-day sync performs ~60+ full-array scans plus 30 more for the readiness pass. Not incorrect output, but a sync-latency/jank risk on low-end phones inside `handleSync`/pull-to-refresh on the main thread.
**Evidence:** sleepJoin.ts:40 `return hrSamples.filter((s) => s.time >= startMs && s.time <= endMs);` called once per sorted sleep entry (healthConnect.ts:688 `const sleepHrSamples = sleepWindowHeartRateLocal(latestSample);`) and again per readiness date (healthConnect.ts:889).
**Severity:** low
**Confidence:** high (mechanism verified in code; magnitude depends on device sample density)

## finding
**Title:** `localDayWindow` returns UTC-shifted ISO strings — comment claims device-local anchoring but `dateKey` is derived from local getters, so it is consistent; however the window edges sent to Health Connect are correct and the key matches. No defect after verification.
**File:line:** src/shared/health/healthConnect.ts:366-377
**Symptom:** Checked specifically for the UTC-drift pitfall class: `start.setHours(0,0,0,0)` anchors local midnight; `toISOString()` converts back to the same instant; `toDateKey(start.toISOString())` uses local `getFullYear/getMonth/getDate` so the key equals the local date. Window and key agree.
**Evidence:** toDateKey (healthConnect.ts:352-360) uses local date getters, not `toISOString().slice(0,10)`.
**Severity:** info (no defect — documented verification)
**Confidence:** high

## finding
**Title:** `SleepPage.goToPrevDay/goToNextDay` can race: two rapid taps await `getSleepSession` out of order
**File:line:** src/features/health/pages/SleepPage.vue:331-349
**Symptom:** Each nav handler sets `selectedDate` synchronously then awaits the DB fetch before assigning `summary`. Two fast taps can resolve in reverse order (older night's fetch resolves last), leaving `summary` showing a different night than `selectedDate` label. Self-heals on next `loadSleep()` but the ring/stages/timeline can briefly disagree with the date label.
**Evidence:** `selectedDate.value = sessionDates.value[idx + 1]; const record = await getSleepSession(selectedDate.value); summary.value = record ? sessionToSummary(record) : null;` — no guard against interleaved invocations.
**Severity:** low
**Confidence:** medium (logic verified; actual out-of-order resolution depends on sqlite round-trip timing)

## finding
**Title:** HealthPage `loadReadiness` reads metrics refs set by `loadMetrics` — race only if ordering changes; currently serialized. Verified OK, but `loadBaselines` swallow-catch means HRV silently missing.
**File:line:** src/features/health/pages/HealthPage.vue:477-480
**Symptom:** `onIonViewWillEnter` correctly awaits the parallel loaders before `loadReadiness()`; no double-loader (only `onIonViewWillEnter`, no `onMounted` duplicate). Noted `loadBaselines` catch-all `catch { /* baselines stay null */ }` silently degrades readiness inputs to null baselines — matches graceful-degradation design, flagged for awareness only.
**Evidence:** healthConnect.ts comment contract and HealthPage.vue:477-480 single hook; no `onMounted` present.
**Severity:** info (no defect)
**Confidence:** high

## finding
**Title:** `readinessDates`/`sleepEfficiency` double-conversion risk in HealthPage fallback scorer — verified correctly converted (÷100 before `calculateReadinessScore`)
**File:line:** src/features/health/pages/HealthPage.vue:377
**Symptom:** Checked the 0–100 vs 0–1 pitfall: the live-scorer path divides the stored percent by 100 before calling `calculateReadinessScore` (`sleepEfficiency.value / 100`), matching the scorer's 0–1 contract (`inputs.sleepEfficiency * 12`). The sync-time caller (healthConnect.ts:924) passes `sleepSummary.efficiency` which is already 0–1. No mismatch found.
**Evidence:** healthConnect.ts:121 `clamp(inputs.sleepEfficiency * 12, 0, 12)`; HealthPage.vue:377 `sleepEfficiency.value === null ? null : sleepEfficiency.value / 100`.
**Severity:** info (no defect)
**Confidence:** high

## finding
**Title:** Manual sync paths advance `lastHcSyncAt` themselves — verified consistent; but HealthPage pull-to-refresh and `handleConnect` do NOT advance the stamp, so the next auto-sync re-reads a full 30-day window unnecessarily
**File:line:** src/features/health/pages/HealthPage.vue:482-492, 509
**Symptom:** SleepPage `handleSync` calls `setLastHcSyncAt(Date.now())` after `syncHealthConnectMetrics()` (SleepPage.vue:382), and `syncHealthConnectMetrics` never touches the stamp (correct contract). But HealthPage's `handleRefresh` and `handleConnect` both run a full default 30-day `syncHealthConnectMetrics()` without updating `lastHcSyncAt`. After a big manual pull-to-refresh sync, `HealthConnectAutoSync` still computes `daysBack` from the stale (older) stamp — up to a full 30-day re-read on the next background tick even though nothing changed. Wasted work, no data corruption (replace/upsert is idempotent).
**Evidence:** HealthPage.vue:484 `await syncHealthConnectMetrics();` with no `setLastHcSyncAt` anywhere in the file (grep confirmed); SleepPage.vue:382 has it.
**Severity:** low
**Confidence:** high

## finding
**Title:** HR fetch `limit: 5000, ascending: true` truncates by keeping the OLDEST samples, contradicting the in-code claim that "newest days win"
**File:line:** src/shared/health/healthConnect.ts:544-550
**Symptom:** The comment says "fetch oldest->newest with the max limit and let the newest days win when truncated". But Health Connect's `ReadRecordsRequest` has no sortOrder argument here — the plugin pages records in Health Connect's default order (time ascending for `readSamples` per plugin docs/behavior), and the loop stops once `fetched >= limit` (HealthManager.kt:400 `while (pageToken != null && (limit <= 0 || fetched < limit))`). When 30 days of continuous HR (~43k samples at 1440/day) exceeds 5000, the query returns the FIRST 5000 samples — the oldest ~3.5 days — and the newest ~26 days never arrive at all. Sleep-window HR joins then find no samples for recent nights: exactly the regression the comment claims was fixed. Truncation also silently drops the most recent data, so a first-ever sync's "today" night has no sleep HR.
**Evidence:** healthConnect.ts:548 `limit: 5000, ascending: true` + comment "let the newest days win when truncated"; HealthManager.kt:387-400 paginates from the start and stops at the limit — there is no reverse/`sortOrder` handling for readSamples in the plugin (HealthPlugin.kt:171-196 passes limit/ascending only to queryWorkouts-style paths; HeartRate readRecords has no sort parameter at HealthManager.kt:159).
**Severity:** high
**Confidence:** medium-high (plugin source shows no ascending reorder for readSamples; the `ascending` flag reaching readRecords is ignored — mislead documented in the code itself. If the plugin did honor ascending by returning oldest-first, the comment's intent fails identically: cap keeps oldest 5000.)

## finding
**Title:** `applyReadinessDrain` uses device-local 6 AM anchor — consistent across devices; verified no UTC drift
**File:line:** src/shared/health/healthConnect.ts:168-183
**Symptom:** Checked the calendar-day pitfall: `setHours(6,0,0,0)` is device-local, and `calculateBattery` is always invoked with local `new Date()`. Date math is instant-based, not string-sliced. No drift.
**Evidence:** healthConnect.ts:170 `start.setHours(6, 0, 0, 0);`.
**Severity:** info (no defect)
**Confidence:** high

## finding
**Title:** `calculateReadinessScore` presence counting treats `undefined` optional inputs as absent — verified correctly normalized
**File:line:** src/shared/health/healthConnect.ts:146-152
**Symptom:** Checked the `?? null` normalization pitfall: `scoredInputs` maps `inputs.spo2 ?? null` explicitly; all other inputs are required non-optional fields typed `| null`, and both call sites (healthConnect.ts:922-935, HealthPage.vue:374-388) pass explicit `null`, never `undefined`, for missing metrics. `filter((v) => v !== null)` therefore counts correctly. Note: `steps` is intentionally NOT in scoredInputs (no steps score component exists) — matches the scorer.
**Evidence:** healthConnect.ts:149 `inputs.hrv, inputs.spo2 ?? null,` and HealthPage.vue passes literal `null` fields.
**Severity:** info (no defect)
**Confidence:** high

## finding
**Title:** LocalNotifications: all schedule paths call `checkPermissions()` before `schedule()` — pitfall class verified clean
**File:line:** src/shared/utils/notifications.ts:45-59, 72-87, 108-123
**Symptom:** The known pitfall (Android 13+ `schedule()` rejection) is handled: every `scheduleDailyReminder`, `scheduleRestTimerDing`, and `scheduleBillAlert` awaits `LocalNotifications.checkPermissions()` and returns early when not granted. No unguarded `LocalNotifications.schedule` anywhere in the touched scope (grep).
**Evidence:** notifications.ts:48-49, 76-77, 112-113.
**Severity:** info (no defect)
**Confidence:** high

## finding
**Title:** `upsertReadinessScore` inside the readiness loop is not try/caught — one bad row aborts remaining readiness days
**File:line:** src/shared/health/healthConnect.ts:937-940
**Symptom:** Every other write in `syncHealthConnectMetrics` (steps, sleep, RHR, RR, vitals) is individually try/caught with a console.error so one failure can't kill the rest of the sync. The readiness `await upsertReadinessScore(...)` is not: a DB error on day 14 of 30 throws out of `syncHealthConnectMetrics`, skipping `pushSleepWidgetSnapshot`/`pushActivityWidgetSnapshot` and surfacing as a generic "sync failed" — while steps/sleep metrics for days 15–30 are silently skipped in that pass (they'll be re-read next sync, but widget pushes are lost for this sync).
**Evidence:** healthConnect.ts:937 `await upsertReadinessScore(date, calculateReadinessScore(readinessInputs), {...})` — the only unguarded await in the write phase.
**Severity:** low
**Confidence:** high (asymmetry verified against all sibling loops)

## finding
**Title:** `getRecentSleepSessionSummaries` (used by analytics over sleep) omits `hrv` column while sibling `getSleepSessionsBefore` selects `*` — readiness seed path uses the right one. Verified OK; noted for the record.
**File:line:** src/shared/db/app_db.ts:2488-2499
**Symptom:** Checked the baseline-seeding path used by `syncHealthConnectMetrics`: it calls `getSleepSessionsBefore` (`SELECT *`), which includes `sleep_hr`, `respiratory_rate`, `hrv`. No defect.
**Evidence:** app_db.ts:2507.
**Severity:** info (no defect)
**Confidence:** high

## finding
**Title:** SleepPage hypnogram + HR chart scrub state: charts re-keyed by selectedDate (`:key="selectedDate ?? 'none'"` only on hero) — TrendChart instances receive new `pts` without remount; scrub/bounds behavior depends on TrendChart watching props
**File:line:** src/features/health/pages/SleepPage.vue:155-163, 431-437
**Symptom:** The checklist item "reset chart scrub state when series swaps; bounds-check pts[idx]" — the HR/duration/score TrendCharts get a brand-new `pts` array when the user navigates nights (computed from `summary.value`), without a `:key`. If TrendChart keeps internal scrub/hover index state across prop swaps, a stale index could point outside the new (possibly shorter) array. TrendChart internals are outside this audit's file scope (src/shared/components), but the call site does nothing to force reset; only the hero body is keyed. Verify TrendChart resets `activeIdx`/hover on `pts` change (out of scope file — not read).
**Evidence:** SleepPage.vue:155-163 `<trend-chart v-if="heartRatePts.length" :pts="heartRatePts" ...>` with no `:key`; heartRatePts changes wholly per selected night.
**Severity:** low
**Confidence:** low (call-site evidence only; depends on TrendChart internals not audited)

## finding
**Title:** Insights `pearson` correlation uses positional pairing from `alignPairs` — dates aligned correctly via map; verified OK
**File:line:** src/shared/health/insights.ts:81-93
**Symptom:** Checklist date-drift class: pairing is by exact YYYY-MM-DD string key from both series, both produced by `localDateISO`/`toDateKey` (local). No `toISOString().slice` found anywhere in the compute chain (grep).
**Evidence:** insights.ts:82-92; grep for `toISOString().slice` returned no hits in scope.
**Severity:** info (no defect)
**Confidence:** high

## finding
**Title:** `computeAcwrSeries` `enumerateDates` guard caps at 1500 days silently — >4y history truncates the series tail without warning
**File:line:** src/shared/health/trainingLoad.ts:255-264
**Symptom:** The 3-year guard silently truncates: for a user with >1500 days between first workout and today, `dates` stops ~4 years in, and the returned series' last point is NOT `endDate`/today. `todayRecovery.computeTodayRecovery` then reads `lastDefined(acwrSeries.map(p => p.acwr))` — a stale ACWR from years ago instead of null/today's, potentially rendering a wrong "train/maintain/recover" verdict today. Realistically only bites after 4+ years of app usage with the first session retained.
**Evidence:** trainingLoad.ts:259 `for (let guard = 0; cur <= end && guard < 1500; guard++)`; todayRecovery.ts:29-33 takes `lastDefined(...)`.
**Severity:** low
**Confidence:** medium (logic verified; requires extreme history length)

## finding
**Title:** `BodyPage.chartPts` range cutoff uses `e.date >= cutoff` string compare on local YYYY-MM-DD — verified consistent; `trendDelta` reads entries[0]/[1] assuming DB newest-first. Verified OK against `ORDER BY date DESC`.
**File:line:** src/features/health/pages/BodyPage.vue:172-188, 211-214
**Symptom:** Both checklist classes checked: dates are local keys compared lexicographically (safe for fixed-width YYYY-MM-DD), and `entries` comes from `getBodyLogs()` (newest-first per app_db ORDER BY), so `entries[0].weight_kg - entries[1].weight_kg` is latest vs previous. No defect.
**Evidence:** BodyPage.vue:178, 213; app_db.ts body-log query ordering (DESC).
**Severity:** info (no defect)
**Confidence:** high

## finding
**Title:** VitalsPage `hrvSignalDisplay` recomputes the full 90-day recovery series on every render — computed with reactive dep, correct; perf note only
**File:line:** src/features/health/pages/VitalsPage.vue:201-208
**Symptom:** Checklist "computed with no reactive dep" — this computed reads `hrvSeries.value`, a ref, so it's reactive and correct. It rebuilds the entire `computeRecoverySeries` (28-day windowed SD per point) whenever the series or range changes; with ≤90 points this is negligible. Not a bug.
**Evidence:** VitalsPage.vue:203.
**Severity:** info (no defect)
**Confidence:** high

## finding
**Title:** HRV sync-loop writes `sleepSummary.efficiency` (0–1) to `sleep_efficiency` metric as percent ×100 — verified consistent with HealthPage ÷100 read path
**File:line:** src/shared/health/healthConnect.ts:744
**Symptom:** The stored `sleep_efficiency` metric is 0–100 (`(sleepSummary.efficiency * 100).toFixed(0)`), and HealthPage divides by 100 before scoring. HealthPage's `sleepEfficiencyDisplay` shows `Math.round(sleepEfficiency.value)%` — percent display of a percent value. Consistent end-to-end; flagged only because it's the exact unit-conversion class from the checklist and was verified clean.
**Evidence:** healthConnect.ts:744; HealthPage.vue:260, 377.
**Severity:** info (no defect)
**Confidence:** high
