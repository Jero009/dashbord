# Cross-Cutting Audit — dashbord (2026-10-01, GLM pass)

Scope: package/config, Android manifest + Gradle + native bridges, permissions, storage/export/import, HTTP/sync boundaries, accessibility semantics, lifecycle cleanup, large-query/render paths, test coverage. Baseline verified: `npm run test:unit --run` → **31 files / 320 tests passed**; `npm run build` → **built in 40.5s** (only the pre-existing >500 kB chunk warning). Repo left untouched except this file; no source edits, no commits.

Pre-existing branch state respected: `HomePage.vue` modified, `RELEASE_NOTES_v3.21.1.md` + `AUDIT_VISUAL_2026-10-01.md` untracked — not used as findings.

---

## Findings

### F1 — SpO₂ is never wired into readiness sync, and the 8-slot base floor silently deflates every persisted readiness score
- **Category:** data-correctness / cross-module contract
- **Severity:** HIGH · **Confidence:** high
- **File:** `src/shared/health/healthConnect.ts:953-964` (readinessInputs) vs `:139-152` (scorer)
- **Evidence:** The scorer treats SpO₂ as one of "the 8 scored inputs": `scoredInputs = [... inputs.hrv, inputs.spo2 ?? null]` → `base = 24 * (presentCount / scoredInputs.length)`. But the ONLY caller that persists readiness — the sync loop's `readinessInputs` object (lines 953-964) — passes `sleepHours, sleepEfficiency, sleepScore, restingHr, sleepHeartRate, respiratoryRate, hrv, steps, rhrBaseline, sleepHrBaseline, respiratoryRateBaseline, hrvBaseline` and **omits `spo2`, `spo2Baseline`, `spo2Readings` entirely**. `inputs.spo2` is `undefined`, so `inputs.spo2 ?? null` is always `null` in `scoredInputs`.
- **Failure/impact:** `presentCount` can never exceed 7/8, so the base floor caps at **21 instead of 24** — every persisted `readiness_score` row is up to 3 points lower than the documented model, permanently, for all users (even ones with full SpO₂ data synced as `health_metric` rows by the same sync). It also contradicts `AGENTS.md` ("SpO₂ readiness input … 8-point input") and `spo2Gate.spec.ts`, which unit-tests `calculateSpo2Score` that no production caller ever reaches. `steps` (line 106, passed at 961) is likewise accepted by `ReadinessInputs` but never referenced by the scoring body — dead input confirming the wiring gap. HomePage/HealthPage fallback paths don't pass spo2 either, so a manual recompute can't recover the missing points.
- **Reproduction/proof:** grep confirms the only `spo2Readings`/`spo2Baseline` references in `src/` are inside the scorer and `sleepJoin.ts` (pure); none at any call site. Call the scorer with all 7 other inputs non-null: `base = 24 × 7/8 = 21`.
- **Fix direction:** Seed a rolling SpO₂ baseline from `getHealthMetricValuesBefore('spo2', …)` + the day's `spo2` value and the prior-14-day readings array into `readinessInputs` (mirror the HRV seeding already at lines 936-951); or, if SpO₂ is deferred, shrink `scoredInputs` to the 7 wired inputs and update AGENTS.md so docs match behavior.

### F2 — `allowBackup="true"` with no `dataExtractionRules`: health/finance DB and API keys ride Android cloud backup
- **Category:** security / permissions-boundary
- **Severity:** MEDIUM · **Confidence:** medium
- **File:** `android/app/src/main/AndroidManifest.xml:5` (`android:allowBackup="true"`, no `android:dataExtractionRules`, no `android:fullBackupContent`)
- **Evidence:** The app stores the receiver write key (`receiver_write_key`, `userSettings.ts:106`) and CoinGecko key in `localStorage`, and all health + finance history in an unencrypted SQLite DB (`capacitor.config.ts`: `androidIsEncryption: false`). Auto Backup includes the app's internal `databases/` directory by default, and WebView/localStorage state under the data dir on restore paths.
- **Failure/impact:** On Android 12+ with default rules, the entire tracking DB is copied to the user's Google Drive device backup unencrypted and auto-restored onto any replacement device — a boundary the app otherwise enforces carefully (HTTPS-only receiver, key never committed). An exfiltrated or shared cloud backup leaks gym/health/finance history plus the receiver's write credential (which allows POSTing forged `gym_workout`/`hermes` rows).
- **Reproduction/proof:** `adb shell bmgr` backup/restore cycle, or inspect the resulting device backup payload.
- **Fix direction:** Add `dataExtractionRules` excluding `database/` and `app_webview/` (or disable `allowBackup`), consistent with the app's local-first threat model; the in-app SQL export already provides the sanctioned backup path.

### F3 — FileProvider exposes the entire external-storage root (`path="."`)
- **Category:** security / Android config
- **Severity:** MEDIUM · **Confidence:** medium
- **File:** `android/app/src/main/res/xml/file_paths.xml:3` — `<external-path name="my_images" path="." />` (and `cache-path path="."`)
- **Evidence:** The provider is declared `grantUriPermissions="true"` and is the share path used by Capacitor Filesystem when exporting the SQL backup (`SettingsPage.vue` → `Share.share({ url: writeResult.uri })`).
- **Failure/impact:** The `external-path` root maps to the top of shared storage; any URI the app grants (backup SQL — full life-log data — or body photos) lets the receiving app request reads far outside the intended file. Over-broad grant surface with no benefit: backups are written to `Documents/`.
- **Fix direction:** Scope to `<external-path name="docs" path="Documents/" />` (plus `Pictures/` for body photos) and a named cache subdir.

### F4 — PlanPage past-plans load: O(plans × workouts) query storm on every page entry (N+1 per plan)
- **Category:** large-query/render path
- **Severity:** MEDIUM · **Confidence:** high
- **Files:** `src/features/gym/pages/PlanPage.vue:165-196` (`loadPastPlans`), `src/shared/db/app_db.ts:1309-1357` (`getWorkoutsForPlan`, `getPlanWorkoutSeries`)
- **Evidence:** `loadPastPlans()` loops `past.slice(0, 8)` and awaits `getPlanAdherence(p, pausesRows, 1)` per plan. Each `getPlanAdherence` → `getWorkoutsForPlan` → `getWorkouts(1000)` (full 1000-row fetch, JS-filtered) — and `getPlanWorkoutSeries` additionally issues **one aggregate query per workout id** (`for (const wid of ids) { await db.query(…) }`, app_db.ts:1347-1356).
- **Failure/impact:** Page entry can run 8 full `getWorkouts(1000)` fetches plus hundreds of per-workout round-trips through the Capacitor SQLite bridge (each ~ms-tens-of-ms native hop) → multi-second jank on the plan tab on long-lived installs; identical payloads re-fetched 8+ times per view-enter. Distinct from the already-deferred sleep-HR O(n·m) join.
- **Fix direction:** Fetch workouts once, pass the shared list into the plan filters; replace the per-workout loop in `getPlanWorkoutSeries` with one `GROUP BY we.workout_id` aggregate (the pattern already used in `getSessionLoads`).

### F5 — `SCHEDULE_EXACT_ALARM` declared but never requested; on Android 14+ it is denied by default, silently downgrading the rest-timer ding and bill alerts to inexact
- **Category:** permissions / notifications lifecycle
- **Severity:** LOW-MEDIUM · **Confidence:** medium
- **Files:** `android/app/src/main/AndroidManifest.xml:92`; `src/shared/utils/notifications.ts:72-99` (`scheduleRestTimerDing`), `:108-127` (`scheduleBillAlert`)
- **Evidence:** Target SDK 36 (`android/variables.gradle`). The Capacitor local-notifications plugin checks `alarmManager.canScheduleExactAlarms()` and falls back to inexact/in-window scheduling when false (verified in `node_modules/@capacitor/local-notifications/.../LocalNotificationManager.java:380`). No code path ever calls `ACTION_REQUEST_SCHEDULE_EXACT_ALARM` or surfaces the degraded state.
- **Failure/impact:** On Android 14+ the special alarm permission is off by default, so the core rest-timer contract ("OS fires the alert even if the app is backgrounded or killed") degrades to batched-alarm timing — the ding can land minutes late mid-set — with no user-visible hint. The `HealthConnect` exercise-permission nag (HealthPage) shows the pattern exists in-app for a sibling problem.
- **Fix direction:** Check exact-alarm grant once in Settings/Workout first run and offer `LocalNotifications`' exact-alarm intent (the plugin exposes the action); or accept inexact and drop the manifest permission for clarity.

### F6 — `markSubscriptionPaid` has no in-flight guard: double-tap duplicates the transaction
- **Category:** ordinary-logic / race (cross-cutting with the fixed auto-poster race)
- **Severity:** LOW · **Confidence:** medium
- **File:** `src/shared/db/app_db.ts:2870-2893`
- **Evidence:** Reads `last_posted_date`/`next_due_date`, then inserts the transaction, then stamps — non-transactionally. The auto-poster got a shared `postDueSubscriptionsInFlight` promise for exactly this interleaving (comment at 2910-2915); `markSubscriptionPaid` did not. UI wires it to a plain `@click` (`FinanceSubscriptionsPage.vue:290`).
- **Failure/impact:** Two taps before the first write lands → both reads see `last_posted_date !== due` → two identical `finance_transaction` rows; monthly spend and budget math double-count.
- **Fix direction:** Share the same in-flight pattern, or do read+insert+stamp in one `executeSet` transaction keyed on the pre-read `last_posted_date`.

---

## Coverage inventory (areas inspected)

| Area | Inspected | Verdict |
|---|---|---|
| package.json / capacitor.config / Gradle / variables.gradle | ✅ | versions aligned (Capacitor 8, compileSdk 36, minSdk 26), keystore fallback sane, no stray deps |
| Android manifest permissions | ✅ | minimal set; see F2/F5 for the two real gaps |
| Native bridges (GlyphMatrix, RestTimerAudio, DashboardWidgetPlugin, widget providers, WidgetTheme) | ✅ | init timeout guards, focus release, SecurityException soft-fail, missing-field fallback — acceptable |
| DB init/migrations (app_db.ts, all 3855 lines) | ✅ | all 22 created tables present in **both** EXPORT_DELETE_TABLES and EXPORT_INSERT_TABLES (verified programmatically); nullable-unique upserts use the `(col = ? OR NULL)` pattern; dedupe migrations idempotent |
| Export/import round-trip | ✅ | parser handles escaped quotes/`--` in strings, strips BEGIN/COMMIT, unknown-table passthrough, FK off/on, rollback on failure — acceptable; pre-import auto-backup present in Settings |
| HTTP/sync boundaries (receiverSync, workoutMirror, hermesPush, prices.ts) | ✅ | never-throw contracts, dirty queue, stamp-advance-only-on-delivered, FX per-pair TTL — matches FIXPLAN closures |
| Health Connect sync (healthConnect.ts full) | ✅ | optional reads `.catch`-wrapped; core gating correct; UTC/local fixes in place — except F1 |
| Widget snapshot merge (widgetBridge) | ✅ | two-producer merge mirror works; covered by widgetSnapshotMerge.spec |
| Rest timer (useRestTimer + RestTimerAudio + notifications) | ✅ | expiry vs cancel paths correct; except F5 (exact-alarm) |
| Auto-sync lifecycle (HealthConnectAutoSync.vue) | ✅ | all timers/listeners removed on unmount incl. the awaited-listener race — clean |
| Hermes kill switch (App.vue, router, DashboardTopBar, HermesPage, WorkoutPage) | ✅ | consistently enforced at all five entry points |
| Notification ID allocation | ✅ | weight=1/sleep=3/rest=20/bill=30 disjoint from Hermes 100-999; the Hermes 900-modulo collision is already a documented deferred item (FIXPLAN v3.19) — not re-filed |
| Large queries elsewhere | ✅ | getWorkouts limit-bounded; sleep summaries slim variant used; HistoryPage paginated (fixed v3.19) — except F4 |
| Accessibility semantics | ✅ | 50 aria-labels across .vue files; icon-only controls (settings gear, mark-paid) labeled; low role usage is consistent with Ionic components supplying semantics — no concrete failure found |
| Test coverage | ✅ | 31 spec files / 320 tests green; pure modules (sleepJoin, planCalendar, financeDates, receiverSync payloads, workout mirror format, widget merge, spo2 gate) covered — gap noted under F1 (tested function unreachable from prod) |

## Explicit non-findings (checked, acceptable)
- Export/import table lists, ordering, and transaction semantics (verified by cross-check script — no drift).
- `parseSqlStatements` quote/comment/CR handling (lone-CR fix already tested).
- Receiver write key never leaves `localStorage` → header only over Tailscale HTTPS; repo stays clean.
- `CapacitorHttp` usage sites (prices, receiverSync, hermesPush): timeouts, JSON-parse guards, graceful degradation all present.
- Steps aggregation's 30 sequential awaits — deliberate, commented tradeoff, not a regression.
- `todayEvents` dead ref and stale `todayKey` overlays — already in FIXPLAN DEFERRED; not duplicated.
- Widget "missing = fallback" Java-side redesign — already DEFERRED; not duplicated.
- Theme token usage: no raw hex introduced in inspected styles.
