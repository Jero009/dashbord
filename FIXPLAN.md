# Fix Plan — from GLM 5.3 audit (Sep 9 2026)

Rules for every batch:
- Verify each audit claim against the actual code before fixing (line numbers may drift).
- Follow AGENTS.md conventions. Nothing-OS design tokens (var(--nt-*)), no raw hex in Vue styles.
- No new dependencies. Smallest correct diff. Delete over add.
- After each batch: `npm run build` + `npm run test:unit --run` must pass.

## v3.7 additions (post-audit feature work)
- Hermes integration tab: DONE — `/hermes` (`src/features/hermes/`), recovery verdict + signal tiles + insights + latest Hermes messages; top bar extended to six tabs.
- Hermes→phone push channel: DONE — `src/shared/hermes/hermesPush.ts`, contract in `docs/HERMES_PUSH.md` (app polls the existing health receiver, type=hermes; delivers via the shared LocalNotifications pipeline).
- Homescreen widgets: STARTED — v3.9 ships the sleep-score widget (RemoteViews + DashboardWidget snapshot plugin, `SleepWidgetProvider`); more widgets deferred.

## v3.14.x additions (Hermes sync, post-release debugging)
- #30 Gym mirror timestamp consistency: DONE (two-part fix). v3.14 fixed the FORMAT (both sides ISO-8601); v3.19 fixed the root cause the format fix missed — `startWorkoutFromTemplate` omitted `time_start`, so SQLite's UTC `CURRENT_TIMESTAMP` filled it and the mirror parsed it as local (durations inflated by the UTC offset, started_at 2h early). `time_start` is now written as full local ISO-8601 at insert; regression test pins the ISO-offset round-trip (`workoutMirrorFormat.spec.ts`). NOTE: workouts logged BEFORE v3.19 keep their wrong mirrored started_at/duration in the receiver (true start was 2h later than shown).

## v3.19 debug-pass additions (2026-09-30, full-repo parallel audit — evidence in AUDIT_*.md, untracked)
- HistoryPage infinite scroll: DONE — pagination state was non-reactive, scroll never armed (only first 20 workouts ever shown).
- HR backfill truncation: DONE — plugin keeps the OLDEST samples at the cap; fetch now chunked into 3-day windows so every night gets sleep HR.
- UTC `date('now')` window boundaries: DONE — readiness history, review digest (sleep/readiness/spend/netThen), net-worth trend, monthly spending now take TS-computed local cutoff keys as SQL params.
- Rest-timer expiry off WorkoutPage: DONE — expiry no longer cancels the scheduled OS ding (`finalizeExpiredTimer`); Home/GymHome expiry handlers route through it.
- Hermes push seen-stamp: DONE — advances only to the last DELIVERED message; delivery stops at first failure; missing permission throws (messages were being lost forever).
- Transaction edit notes wipe: DONE — existing notes round-trip through the edit form.
- Subscription auto-post double-fire race: DONE — single in-flight pass shared across Home/Finance entry hooks.
- Low batch: CSV lone-CR rows (+test), per-pair FX TTL, `updatePlan` goal COALESCE, `localIsoWithOffset` date-only noon anchor, viewedMonth rollover resets (Budget/Analytics), ExercisePicker/Template double loaders, raw color literals → tokens (sweep complete, zero left).
- DEFERRED (verified, not fixed — see AUDIT_*.md): widget mirror keeps yesterday's values when a night is missing (needs Java-side "missing = fallback" redesign); O(n·m) sleep-HR window join (perf only); unscoped `<style>` blocks on 5 gym pages (collision risk, big diff); stale `todayKey` captures in TrainingLoadOverlay/HealthHeatmap after midnight; hermes notification-id collisions (~15-min congruence); `todayEvents` dead ref; ACWR 1500-day guard truncation.

## v3.23.0 finance polish (2026-10-02)
- Finance data honesty: DONE — Accounts, Investments, Budget and Finance Analytics now distinguish database errors from true empty states; net-worth range errors remain visible even when a stale chart is retained.
- Budget pacing: DONE — projected month-end spend per budget, including invalid/zero/day-boundary guards and no fabricated forecast for a closed month.
- Finance simplification: DONE — Overview duplicate income/spend split and Analytics duplicate budget-vs-actual list removed; category labels and local calendar display helpers centralized.
- Finance insight: DONE — Analytics Review shows Health & Fitness spend per logged workout, null-safe when no workouts exist; net-worth history supports 30/90/365-day ranges with stale-response protection.

## Batch 1 — HIGH bugs (code)
- #2 Ghost rest-timer ding: DONE (v3.7) — shared `useRestTimer` composable (`src/shared/composables/useRestTimer.ts`); WorkoutPage owns start/adjust/skip/expiry and schedules the AlarmManager-backed ding at timer start; GymHomePage + HomePage read the same canonical localStorage record and clear via `cancelRestTimer()` (cancels the OS ding + countdown notification everywhere); unit-tested in `tests/unit/useRestTimer.spec.ts`.
- #3 Session-RPE alert hang: `promptSessionRpe` (WorkoutPage.vue) must resolve on backdrop dismiss (onDidDismiss) so endWorkout always runs.
- #4 Unbounded queries: add LIMIT/date-bounds to getWorkouts, getBodyLogs, getWorkoutsByName; replace full-month transaction fetch with SUM aggregate in FinancePage; add ion-infinite-scroll to HistoryPage.
- #5 Divergent recovery systems: migrate Home recovery chip onto trainingLoad.ts/overtraining.ts/recoveryBaseline.ts; delete legacy computeTrainingLoad from insights.ts.
- #6 Loading/error states: add a minimal shared loading + error state per data card (no skeleton-per-item; one loading flag per page is fine). FinancePage: stop coercing failures to [] — show per-card error state.

## Batch 2 — HIGH data + cleanup
- #7 FX: add `currency` column to finance_investment (migration + export/import lists); convert to user currency at fetch time in prices.ts (add minimal FX rate fetch for non-matching currencies); investmentsTotal/net-worth then operate on converted values. If an FX fetch fails, keep last good value and surface it — never silently skip.
- #8 Dead code: delete getLatestSleepSummary, orphaned events param + eventDrain block in calculateBattery (and the always-+0 tile), circadianScore param if truly always neutral, todayEvents dead ref, orphaned habitStats functions + their spec, getExerciseStats, tests/unit/example.spec.ts. Update EXPORT lists only if table changes (none here).
- #13 Prices refresh hardening: timeout on fetchOneStock, always reset refreshing in finally, only set "Updated" when ≥1 write succeeded.

## Batch 3 — MEDIUM UX/consistency
- #9 Extract useCrudList composable + shared finance-list.css for Accounts/Investments/Subscriptions/Budget.
- #10 Error handling: guard workout end/cancel/set-delete chains, saveSet blur, refresher complete() in finally, Budget/Subscriptions loaders, HealthPage Promise.all, readiness upsert loop.
- #11 Budget math: leftToSpend compares budgeted categories only; unify ratio math in finance.ts; label budgets with their month.
- #12 Subscriptions: minimal auto-post — on app start / finance page enter, post due unpaid subscription payments as finance_transaction rows (idempotent via a last_posted marker).
- #14 Import/export: auto-backup export before import; location.reload() after import; fix file-picker MIME; export button in-progress state.
- #15 Remove duplicate onMounted/onIonViewWillEnter loaders (keep ionViewWillEnter; first load covered by it in Ionic).
- #16 Chart update-not-recreate where cheap (guard: only if it doesn't complicate — else skip and note).
- #17 Workout UX: +30s bumps total; unchecking set stops rest timer; confirm dialogs for history deletes; hardware-back guard for unsaved set edit. (Skip undo system + plate calculator — scope.)
- #18 HC feedback: permission toast offers openHealthConnectSettings/requestPermissions; auto-sync failure surfaces once; last-sync stamp updates on auto-sync.
- #19 Slim sleep query variant without timeline blobs; use it where timelines unused.
- #20 Confirm deletes on BodyPage + Budget deletes; same-date body entry → open edit.

## Batch 4 — LOW polish + docs
- #21 formatCurrency: minimumFractionDigits for small values (show cents when value < 1000 or when it has cents).
- #22 Dedupe helpers into shared utils (timeFormat, formatRestTime, showToast, validators, volume formatter).
- #23 Delete dead CSS blocks + dead handlers listed in audit.
- #24 Token drift fixes (var(--nt-font-display), no literal #fff; keep yellow only where data-encoding).
- #25 Rename gym HomePage.vue → GymHomePage.vue (update imports/routes).
- #26 Weekly goal through userSettings.ts, single source.
- #27 nextTick instead of 60ms sleep.
- #28 Single bulk UPDATE for adjacent reorder (or per-row but batched in one transaction).
- #29 recordNetWorthSnapshot: once per day (compare last snapshot date).
- #1 AGENTS.md: full rewrite against ACTUAL current code (post-debloat). Verify every documented module exists; document Plan/Cardio/Circadian removal, real tab bar, real feature list. Include useRestTimer + useCrudList conventions added above.

## Redundancy & visual audit — Batch 4 (2026-10-02, branch audit-fix-b4)
- Dead wrappers: DONE — unused `NtCard.vue`/`NtMetric.vue` deleted (`.nt-kicker`/`.nt-metric-tile` CSS kept).
- Dead exports: DONE — `getPlanById`, `updatePlan`, `archivePlan`, `getOpenPause`, `updateLifeEventEndDate`, singular `updateWorkoutExerciseOrder`, `chartGoalDataset`, `hapticWarning`, `glyphIsReady` deleted after zero-caller searches. Plural `updateWorkoutExerciseOrders` and native GlyphMatrix `isReady` transport preserved.
- Habit residue: DONE — `habitStats.ts` + spec deleted; live `shiftDate` moved to `timeFormat.ts` (TDD: `tests/unit/timeFormat.spec.ts`), `aiExport.ts` repointed.
- Unused plugins: DONE — `@capacitor/camera`, `@capacitor/status-bar` removed; `android.permission.CAMERA` dropped from manifest; `npx cap sync android` run. `@capacitor/keyboard` kept (needs device QA).
- Docs: DONE — AGENTS.md Plan-feature/routes corrections (this section). Battery simplification deferred to Batch 2 owners (Home/Health).
