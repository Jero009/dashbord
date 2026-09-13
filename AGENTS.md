# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, OpenCode, Cursor, Aider, etc.) when working with code in this repository.

> **Single source of truth.** A legacy `CLAUDE.md` previously duplicated this file; it has been removed.

## Project Overview

Ionic + Vue 3 health and fitness tracking app with local SQLite storage and Android Health Connect integration. Runs as a Capacitor Android app; the web target is used for development only (SQLite is a no-op on web).

## Commands

```bash
npm run dev           # Vite dev server at http://localhost:5173
npm run build         # TypeScript compile + Vite build
npm run lint          # ESLint (must be clean before commit)
npm run test:unit     # Vitest unit tests (add --run for non-watch)
npm run test:unit -- src/path/file   # Single file
npm run test:e2e      # Cypress (requires dev server running separately)
```

## Architecture

### Feature Modules

`src/features/` — isolated modules: **gym**, **health**, **home**, **finance**, **analytics**, **settings**. Each has `routes.ts`, `pages/`, and most have `components/`. Routes are lazy-loaded and merged in `src/router/index.ts`.

There is **no Plan/Calendar/Habits/Goals feature, no Circadian module, and no Cardio page** — these were removed in earlier debloat passes. Don't reintroduce them or reference them in docs/code.

### Shared Layer

`src/shared/` for cross-feature concerns:
- `db/app_db.ts` — single SQLite instance, all DB functions exported from here
- `health/` — Health Connect sync + pure-TS compute services (`healthConnect.ts`, `trainingLoad.ts`, `recoveryBaseline.ts`, `overtraining.ts`, `recoveryTime.ts`, `todayRecovery.ts`, `insights.ts`), plus `HealthConnectAutoSync.vue` (mounted in `App.vue`, syncs on startup)
- `utils/` — formatting (`timeFormat.ts`, `currency.ts`), user settings accessors (`userSettings.ts`), toasts (`toast.ts`), haptics, notifications, AI export (`aiExport.ts`), rest-timer support (`restTimerAudio.ts`, `restTimerGlyph.ts`), Glyph bridge (`glyphMatrix.ts`, `glyphFrames.ts`), chart helpers (`chartStyle.ts`, `chartGeom.ts`), `math.ts` (clamp etc.), `habitStats.ts`
- `composables/useTheme.ts` — light/dark/system theme
- `components/` — `DashboardTopBar.vue` (global tab bar), `TrendChart.vue` (standard SVG trend chart)

### Top Bar (the app's only tab navigation)

`DashboardTopBar.vue` — segment pill with **Home / Finance / Health / Gym / Analytics** + a settings gear. Targets: `/home`, `/finance`, `/health`, `/tabs/Home` (gym), `/analytics`. Active-tab check tests `/analytics` → `/finance` → `/health` → `/tabs|/workout|/exercise` (gym) → else home. There is no Plan tab.

### Routes

- `/home` — HomePage (features/home): daily dashboard
- `/finance` (+ `/budget`, `/analytics`, `/accounts`, `/investments`, `/subscriptions`)
- `/health` (+ `/sleep`, `/body`)
- `/workout/:id`, `/exercise/:id` — workout player, exercise detail
- `/tabs/` (gym): Home (GymHomePage), Template, Exercise, History, ExercisePicker, TemplateBuilder, TemplateEditor/:id
- `/analytics` (+ `/gym`, `/review`)
- `/settings`

### Data Flow

Pages call exported functions from `src/shared/db/app_db.ts` directly. No global state store — state lives in `ref`/`computed` local to each page. Rest timer state persists in `localStorage` (survives a full app close — see Rest Timer below).

### DB Conventions

- All DB access goes through `app_db.ts`; function names follow `upsert*`, `replace*`, `delete*`, `query*`, `get*`
- Booleans stored as `0`/`1`
- SQLite unavailable on web — DB calls must tolerate empty/null results
- **New DB tables**: Add to `EXPORT_DELETE_TABLES`, `EXPORT_INSERT_TABLES`, `deleteOrder`, and `insertOrder` in `importDatabaseFromSQL` — all four lists.
- **Nullable unique columns**: Never `WHERE col = NULL`. Use `(col = ? OR (col IS NULL AND ? IS NULL))` in any upsert on a nullable unique column.
- **Bulk writes**: prefer `db.executeSet([...])` over N sequential `db.run` calls (see `updateWorkoutExerciseOrders` for the reorder pattern).
- `recordNetWorthSnapshot` writes at most once per day (checks today's snapshot first, plus `ON CONFLICT(date)` upsert).

### Shared helpers — use them, don't re-inline

- `showToast(message, color?, duration?)` in `utils/toast.ts` — all toasts
- `formatRestTime` / `formatDuration` / `formatWorkoutDate` / `localDateISO` / `normalizeDateInput` / `parseLocalDate` in `utils/timeFormat.ts`
- `formatCurrency(value)` in `utils/currency.ts` — whole units except small fractional values (shows cents under 1000 so sub-$1 crypto doesn't read "$0"); currency from `getCurrency()`
- User-set numbers via accessors in `utils/userSettings.ts`: `getWeeklyWorkoutGoal`, `getSleepGoalHours`, `getStepGoal`, `getGoalWeightKg`, `getCurrency`. Raw `localStorage` reads for these values are not allowed.
- `clamp` in `utils/math.ts` — all clamping in compute code

### Health Connect

- Syncs steps, sleep, heart rate (continuous, per-minute Amazfit data is downsampled), resting HR, respiratory rate, HRV, SpO₂, VO₂ max via `@capgo/capacitor-health`
- **Core vs optional reads**: `HEALTH_CONNECT_CORE_READ_TYPES` = steps, sleep, restingHeartRate, heartRate, respiratoryRate — these gate sync. `HEALTH_CONNECT_OPTIONAL_READ_TYPES` = workouts, heartRateVariability, oxygenSaturation, vo2Max — requested so users *can* grant them, but they must never gate core sync: a permission reset on any optional read leaves core metrics syncing (each optional read is `.catch`-wrapped and each write try/caught).
- **Vitals storage**: one averaged `health_metric` row per local day per type — `hrv` (ms), `spo2` (percent), `vo2max` (ml/kg/min) — via `averageByDay` (`src/shared/health/vitalsAggregate.ts`, unit-tested). No new tables; export/import untouched.
- **HRV readiness input**: `calculateReadinessScore` has 7 scored inputs — sleep hours/8×18, efficiency×12, sleep score/100×18, RHR vs baseline 12, sleep HR 12, respiratory rate 8, **HRV ratio vs personal baseline 10** (`5 + ((hrv − baseline)/baseline) × 25`, clamped 0–10; at-baseline = 5). HRV baseline = trailing 14-day mean of prior `hrv` rows (≥3 required). A reading without a baseline scores 0 but still counts as present in the base floor. Weight re-split from the 6-input model (sleep score 22→18, RHR 16→12 freed 10 for HRV); the first sync after this change rescues the trailing window with the new formula.
- **Sleep score (A.1)**: `calculateSleepScore` now includes an HRV component (~12.5 pts, mirrored respiratory-rate shape: `6.25` half-score when either HRV or its rolling baseline is missing; 0 pts at ≥50% below personal baseline; clamped 0–12.5). Window HRV averaged via `hrvWithinWindowAverage` (`sleepJoin.ts`, tested) is stored in `sleep_session.hrv` (nullable REAL, migration block + exported in all four SQL lists). The first sync after this change rescues the trailing window with the new score — **rescore note: sleep-score values for the trailing window shift once.** Sleep score deliberately excludes HRV scoring when `hrv` rows are sparse (half-credit, graceful).
- **Vitals tab**: `/health/vitals` (`VitalsPage.vue`, 4th "Vitals" segment in `HealthSectionTabs`) — HRV (30d + recovery z), SpO₂ (30d, display-only — Amazfit spot checks are sparse), VO₂ max (90d, display-only) trend cards.
- `HealthConnectAutoSync.vue` — initial sync on mount + retry for cold-start race condition; manual re-sync button on Settings and HealthPage
- Readiness score (`calculateReadinessScore`) — 6 scored signals with per-signal caps (sleep hours/8×18, efficiency×12, sleep score/100×22, RHR vs baseline 16, sleep HR 12, respiratory rate 8) plus a base floor of 24 scaled by how many inputs are present. **Steps is synced and stored but NOT scored** (passed into `ReadinessInputs` for completeness only).
- Sleep score (`calculateSleepScore` in `healthConnect.ts`, private) — 100-pt model: duration vs `getSleepGoalHours()` target (25), efficiency (15), WASO (10, neutral 5 without stage data), deep% ≥18% (10), REM% ≥22% (12.5), bedtime-timing variance (15, neutral 7.5), respiratory rate vs personal baseline (12.5, neutral 6.25). Returns `number | null` — null when `timeAsleepHours < 1`.
- User device: Amazfit Active 2 via Zepp Health → Health Connect. Sleep stages, HR, steps, respiratory rate. No HRV without device upgrade.
- **`toDateKey` uses local date**: extracts `YYYY-MM-DD` using `getFullYear/getMonth/getDate` (NOT `.toISOString().slice(0,10)`). UTC slice was off-by-one for UTC+ timezones.
- **Sync window semantics**: `syncHealthConnectMetrics({ daysBack })` — manual syncs and first-ever syncs use the full 30 days (the repair path); `HealthConnectAutoSync` narrows to `min(30, daysSince(lastHcSyncAt) + 2)` (2-day overlap heals edits/clock skew), and a manual sync also advances the `lastHcSyncAt` stamp. Sleep HR and sleep-session RR are joined to each night's sleep window (bedtime→waketime) via pure helpers in `shared/health/sleepJoin.ts` (unit-tested), not bucketed by calendar day. Continuous-HR fetch spans the whole sync window but is capped by the bridge limit (5000 samples ≈ 3.5 full days), so a first 30-day backfill may lack HR on older nights; nightly incremental syncs cover every night going forward.

### Battery Score

`calculateBattery(baseline, now, workouts, activities, events, circadianScore = null)` in `healthConnect.ts`:
- Drains: time (gradual, readiness-shaped), workout (gym log), activity (HC workouts — capped 0–30), events (already-started same-day events; overnight windows roll to next day)
- The `events` param is still in the signature but **no caller currently feeds it real data** (the calendar feature is gone; `HomePage` passes an always-empty ref and `HealthPage` an empty array)
- `circadianScore` param survives with a 0.90–1.00 multiplier but defaults to `null` (no-op) — no caller passes it since the Circadian module was removed
- Shown as hero on `HomePage` (with an 06:00–23:00 Chart.js timeline split past/future at the current hour) and on `HealthPage`

### Training Load & Recovery Services (src/shared/health/)

Pure-TS services + one "today verdict" (no DB/Vue deps; unit-tested in `tests/unit/{trainingLoad,recoveryBaseline,overtraining,recoveryTime,insights}.spec.ts`):
- **`trainingLoad.ts`** — `sessionRpeLoad(rpe, durationMin)`, `computeDailyLoads(sessions)` (per-day `volumeLoad = Σ reps×weight`, `rpeLoad = Σ rpe×duration`), `selectLoadMetric`/`dailyLoadValue`, `computeAcwrSeries(dailyLoads, {acuteDays=7, chronicDays=28, minChronicDays=14, metric='auto', method='ewma', coupling='uncoupled', endDate})`. **One consistent unit per series** (`auto` = `'rpe'` only when every training day has RPE load, else `'volume'`; `AcwrPoint.metric` records which). EWMA (λ=2/(N+1)) is default; `method='rolling'` = classic SMA. `endDate` extends the series across rest days so acute load decays. `acwrFlag`: `<0.8` detraining · `0.8–1.3` optimal · `1.3–1.5` caution · `>1.5` high_risk.
- **`recoveryBaseline.ts`** — `computeRecoverySeries(readings, 'hrv'|'rhr')`: trailing 7/28 means, 28-SD, `recoveryZ` sign-normalised (**negative = worse recovery**: HRV raw z, RHR `−z`). Fed by RHR today; HRV-ready.
- **`overtraining.ts`** — `evaluateOvertraining(points)` → `{status: 'green'|'yellow'|'red', ...}`. Red = ACWR > 1.5 AND recoveryZ ≤ −1.0 for 2+ consecutive days. `acwrZoneLabel(acwr)` helper.
- **`recoveryTime.ts`** — Garmin-style hours-until-recovered countdown (NOT a 0–100 score). `estimateRecoveryHours({rpeLoad, volumeLoad, recoveryZ, sleepScore})`, `recoveryTimeStatus(...)` → live `remainingHours`/`readyAt`/`label`. `aggregateLatestTrainingDay(sessions)` sums the most recent training day (two-a-days add).
- **`todayRecovery.ts`** — `computeTodayRecovery(...)`: single "today" verdict (EWMA ACWR + recovery z) shared by the Home recovery chip AND Analytics overview, so the two pages can never disagree. Built from the same services the overlay charts.
- **`insights.ts`** — `computeInsights({sleepHours, rhr, readiness, dailyVolume})`: Pearson-correlation cross-domain insights (sleep↔volume, RHR↔readiness, weekly sleep vs target), warnings ranked first, capped at 4. The legacy SMA `computeTrainingLoad`/`computeRecoveryRecommendation` were removed — use `todayRecovery.ts`/`trainingLoad.ts` instead.

**Data**: `workout.session_rpe REAL` (nullable, migration block; export/import-safe). Set by `setWorkoutSessionRpe(id, rpe)` — optional 1–10 prompt in `WorkoutPage` end-workout flow. `getSessionLoads(days)` → per-workout `{date, time_end, duration_minutes, session_rpe, volume}`; `getHealthMetricDailySeries(type, days)` → one averaged value/date ascending (also feeds sleep_score to recovery time).

**UI**: `src/features/analytics/components/TrainingLoadOverlay.vue` on `AnalyticsGymPage` — custom SVG dual-axis chart (load bars color-coded by ACWR zone + recovery-z polyline), green/yellow/red status banner, ACWR/acute/chronic/recovery-z tiles, full-width Recovery-time tile, 28/56/90-day selector. Loads on mount + `onIonViewWillEnter`. HRV only takes over from RHR at ≥14 readings (`HRV_TAKEOVER_MIN`).

### Gym Feature

- GymHomePage (tab): last-workout card, weekly workout-goal dots (goal via `getWeeklyWorkoutGoal()`), active-rest-timer chip (reads the same localStorage `restTimer` state WorkoutPage writes, cancels the OS ding if the rest ends there)
- WorkoutPage (`/workout/:id`): set editing with blur-commit + **hardware/browser back guard** (`useBackButton`) that flushes unsaved set edits before leaving; progressive overload `overloadHint` (2.5% rounded to nearest 2.5 kg, display-only); rest timer (below); end-workout → session RPE prompt → `WorkoutSummaryModal` via `modalController` (await `onDidDismiss` before navigating)
- Exercise reorder persists via `updateWorkoutExerciseOrders` — one `executeSet` transaction, not N updates
- ExercisePicker: `route.query.from` routing; `from=TemplateBuilder` stores selection in `localStorage('selectedExerciseForTemplate')` and the caller must clear the key after reading
- History: paginated (`ion-infinite-scroll`) + alert-confirm deletes
- Exercise detail: PR history, Chart.js progress charts

### Rest Timer (WorkoutPage)

Completing a set starts the rest timer. Designed to survive a full app close and ding when backgrounded/killed:
- **Canonical state is `endTime`** (wall-clock ms) in `localStorage` under `restTimer`. The JS `setInterval` is display-only; remaining derives from `endTime` each second.
- **Ding when closed**: `scheduleRestTimerDing(endTime)` (ID 20) arms an OS notification; cancelled via `cancelRestTimerDing()` on skip/stop/end/clear.
- **Ding when alive (duck-then-ding)**: foreground expiry calls `duckAndDing()` (`utils/restTimerAudio.ts` → native plugin, `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`, 300 ms pre-duck, ToneGenerator ding), cancelling the pending notification. Web falls back to Web Audio.
- **Glyph countdown (foreground only)**: `glyphRestDraw/End/Stop/Release` push the countdown to the Nothing back matrix (`utils/restTimerGlyph.ts`); frames built by `restRingFrame(fraction)` in `glyphFrames.ts` (unit-tested). App-matrix mode is foreground-only — the notification covers backgrounded; `resyncRestTimer` re-renders on return to foreground (appStateChange listener native / visibilitychange web).
- **Live countdown notification**: `showRestNotification(exerciseName, durationMs)` posts an ongoing chronometer notification, self-clears at zero; cleared in `clearTimerState`. Exercise name persisted in localStorage.
- **Native plugin**: `android/app/src/main/java/io/ionic/starter/RestTimerAudio.java` (channel `rest_timer`, ID 21), registered in `MainActivity.onCreate`. After any change: `npm run build` → `npx cap sync` → rebuild APK.
- `restoreTimerState` (on view enter) resumes without re-dinging; an expired timer just clears.
- GymHomePage renders the same timer as a chip with stop/adjust, and cancels the OS ding/notification when the rest ends or is cleared there.

### Glyph Matrix (Nothing back display)

Bridge to the dot-matrix LED display on the Nothing Phone (4a) Pro / Phone (3). TS/Java plugin is transport only; the rest timer is the one consumer today.
- **SDK**: `android/app/libs/glyph-matrix-sdk-2.0.aar`, package `com.nothing.ketchum`, wired in `android/app/build.gradle`.
- **minSdk conflict**: AAR declares minSdk 33, app is 26 — resolved with `<uses-sdk tools:overrideLibrary="com.nothing.thirdparty"/>` in `AndroidManifest.xml`. **Do not bump the app's minSdk.** Needs the `com.nothing.ketchum.permission.ENABLE` permission.
- **Native plugin**: `GlyphMatrix.java` (registered in `MainActivity.onCreate`), app-matrix mode (`setAppMatrixFrame`), device auto-detected (4a Pro / Phone (3)), 5 s connect timeout so JS never hangs on non-Nothing devices. Methods: `init`/`draw`/`clear`/`turnOff`/`getMatrixLength`/`isReady`/`deinit`.
- **TS bridge**: `utils/glyphMatrix.ts` — all no-op/falsy off-device.
- **Frame format**: row-major per-LED brightness 0–255; 4a Pro = 13×13 = 169 LEDs. Size arrays with `glyphMatrixLength()`.
- **Constraints**: app-matrix needs Nothing OS 20250801+; only drives while foreground. After native changes: `npm run build` → `npx cap sync` → rebuild APK; verify Java with `cd android && JAVA_HOME=/opt/android-studio/jbr ./gradlew :app:compileDebugJavaWithJavac` (a green `npm run build` does NOT check Java).
- **Frame geometry**: pure generators in `glyphFrames.ts` — `restRingFrame(fraction, side=13)` (clock-style countdown dial), `fullFrame()`, `blankFrame()`. Add new patterns here.

### Home Page (features/home)

Daily dashboard: battery hero (drain breakdown + Chart.js past/future timeline), "This week" digest card (`getReviewDigest('week')` → links to Analytics Review), last-workout hero card with Start-again, weight card (quick log, goal delta via `getGoalWeightKg()`, 7-day TrendChart sparkline), recovery chip (`computeTodayRecovery`), active-workout banner, active rest-timer chip.

### Health Feature

- `HealthPage.vue` — `<div>` cards only (no ion-card). Battery hero, sleep detail, body (RHR/steps/weight), readiness chart. `HealthSectionTabs.vue` tabs: **Overview / Sleep / Body**. No Circadian, no Cardio.
- `SleepPage.vue` (`/health/sleep`) — Zepp-style stepped hypnogram: capsule bars per stage + step connectors, Awake as upward spikes (`HYP_SPIKE_TOP/BOTTOM`) above the band, bottom time axis (`hypTimeAxis`). Stage aliases handle HC variants (`sleeping`, `out_of_bed`, `unknown`). `wakeHour` clamped to `[4, 13]`.
- `BodyPage.vue` (`/health/body`) — `body_log`: weight, notes, waist/chest/hips/arm/thigh cm, body-fat %. Same-date entry opens the existing entry for edit. After logging, calls `dismissWeightReminder()`. (`photo_path` column exists in the schema but no photo UI — don't document one.)

### Finance Feature

- **Shared math** in `features/finance/finance.ts` (pure TS): `computeNetWorth`/`computeTotalAssets`, `accountAssetsTotal`/`accountLiabilitiesTotal` (`LIABILITY_ACCOUNT_TYPES = ['credit','loan']`, entered positive and subtracted), `investmentsTotal`/`investmentsCostBasis`, `monthlyCostOf`/`yearlyCostOf`, `subscriptionsMonthlyOutflow`/`Inflow`, `upcomingBills(subs, days)`, `savingsRate`, `EXPENSE_CATEGORIES`/`categoryLabel`, `dueLabel`. **All pages and `recordNetWorthSnapshot` must use these.**
- **Overview** — net-worth hero + 30-day delta, net-worth trend (from `net_worth_snapshot` via `getNetWorthHistory(days)`), assets-vs-liabilities split, cash flow + savings rate, upcoming bills, top categories, recent activity (`getRecentFinanceTransactions`). Also auto-posts due unpaid subscriptions (`last_posted_date`-idempotent) on page enter.
- **CRUD** — add/edit (inline `editingId`)/delete (`alertController` confirm) on accounts, investments, subscriptions; budget add/edit/delete. `deleteFinanceAccount` clears `account_id` on linked rows. Subscriptions: pause/resume (`status`, excluded from totals), income vs expense.
- **Live prices** — `prices.ts` `fetchInvestmentPrices(holdings)` via `CapacitorHttp` (bypasses WebView CORS; web may CORS-fail, degrades gracefully). Crypto → CoinGecko (ticker→id map `CRYPTO_IDS`, priced in user currency); stocks/funds → Yahoo chart endpoint. **FX**: quotes in a foreign currency are converted to the user's currency when a rate is available (`fxConverted`), and flagged `fxFailed` (never silently skipped) when conversion fails. Refresh recomputes `value = quantity × price`, persists via `updateInvestmentPrice(id, value, lastPrice)`. `cost_basis` → gain/loss per holding + portfolio total. Needs `android.permission.INTERNET` (already in manifest).
- **DB**: `finance_investment.cost_basis/symbol/last_price`, `finance_subscription.status/last_posted_date` — migration block + export/import-safe. `recordNetWorthSnapshot` is liability-aware and writes at most once per day.

### Analytics Feature

- Overview — cross-domain insight cards (`computeInsights`) + today's recovery verdict (`computeTodayRecovery`)
- Gym — workout-frequency heatmap (`queryWorkoutFrequency(weeks)`) + TrainingLoadOverlay
- Review — weekly/monthly cross-domain digest (`getReviewDigest('week'|'month')`; the older `getWeeklyDigest()` is removed — always use `getReviewDigest`)

### Settings Feature

Theme (light/dark/system via `useTheme`), notification reminders (weight/sleep, via `utils/notifications.ts`), manual Health Connect sync (`syncHealthConnectMetrics`), SQL export/import (auto-backup before import, `location.reload()` after), and "Export for AI analysis" (`buildAiExport({days=120})` in `utils/aiExport.ts` — daily-timeline CSV + profile/training-load/PRs/body sections; unit-tested in `tests/unit/aiExport.spec.ts`).

## Key Conventions

- `<script setup lang="ts">` for all components; no `reactive()` unless complex state demands it
- Import types with `import type { ... }`; use `@/` path alias for all imports
- Scoped styles in feature pages to prevent leakage
- `no-console` / `no-debugger` warnings in dev, errors in prod; `npm run lint` must stay clean
- **Chart.js**: destroy in `onUnmounted`, `flush: 'post'` in chart-render watches. **All chart styling comes from `utils/chartStyle.ts`** — spread `chartLineDataset`, `chartDimDataset`, `chartBarDataset`, `chartGoalDataset`, `chartTooltip`, `chartTicks`, `chartGrid`, `chartDonutPalette()`; never inline colors (CSS vars don't resolve in canvas). `animation: false`, `maintainAspectRatio: false` with a fixed-height canvas wrapper. SVG charts match: red `rgb(215, 26, 33)` line, `rgba(215, 26, 33, 0.15)` area, `rgba(255,255,255,0.4)` axis labels.
- **Build + sync order**: `npm run build` THEN `npx cap sync` before APK rebuild.
- **No raw unicode checkmarks/crosses** — use `ion-icon` instead of `✓`, `×`, `✕`.
- **No emojis** anywhere in the UI.
- **Haptics**: `utils/haptics.ts` — `hapticLight/Medium/Heavy/Success/Warning/Error/Select`. All no-ops on web. Light = navigation/toggles, Medium = save/submit, Heavy = start workout/delete, Success = after save, Select = picker select.
- **Section tabs** (`HealthSectionTabs`, `FinanceSectionTabs`, `AnalyticsSectionTabs`) and the top bar wrap `<ion-segment>` in `<div class="seg-pill">` with `overflow: hidden; border-radius: 999px` — never put border-radius directly on `ion-segment` (shadow DOM doesn't clip). `--background: transparent` on segment and toolbar.

## Chart Standard

- **`TrendChart.vue`** — standard line/area trend chart (SVG). Props: `pts` (`{label, value, pos?}` oldest→newest), `unit`, `size` (`xs`/`sm`/`md`), `goal`, `showAvg`, `format`. Scrub to read values; `touch-action: pan-y`. Use for every simple single-series trend.
- **`theme/charts.css`** (imported once in `main.ts`) — global `.chart-frame` (+`--short`/`--tall`), `.chart-legend`, `.chart-empty`. Never re-declare in scoped styles.
- **`utils/chartStyle.ts`** / **`utils/chartGeom.ts`** — Chart.js presets / pure geometry helpers (`chartGeom` unit-tested).
- Chart.js stays for: bar charts, donuts, the battery timeline's past/future split. Hypnogram and TrainingLoadOverlay are deliberately custom — keep them.

## Design System — Nothing OS aesthetic

**ALWAYS follow these rules.** Nothing-OS-inspired: near-monochrome surfaces, ONE red accent as signal, dot-matrix type for numerics only, borderless cards, mechanical motion. Tokens live in `theme/variables.css` as `--nt-*` custom properties — **use tokens, never raw hex or raw font names**, except Chart.js configs and SVG-compute code where vars don't resolve. Light theme flips the same tokens via `html.theme-light` (set by `useTheme`); a single token swap re-skins both.

### Colors
- Page background `var(--nt-bg)` (true black in dark), cards `var(--ion-color-primary)` / `var(--nt-surface)`, elevated `var(--nt-surface-2)`
- **Nothing red** `var(--nt-accent)` — the ONLY accent, used as signal (live/recording, destructive, active tab). Pressed: `var(--nt-accent-press)`.
- **No yellow in UI chrome.** Gold (`var(--nt-data-goal)`) survives ONLY as data encoding: goal lines/dots, hypnogram Awake band.
- Success green `var(--nt-data-positive)` — data semantics only, never buttons/chrome.
- Labels `var(--nt-text-dim)`, values white — reference via tokens (`var(--nt-text)` / `--nt-white`), not literal `#fff`.
- Cards/tiles are borderless; `var(--nt-border)`/`--nt-border-strong` only on inputs, outline buttons, chips.
- Monochrome glow only: `.nt-glow-active`.

### Typography
- Body/UI + headings/labels: `Space Grotesk` (`var(--nt-font-body)` / `--nt-font-head`); labels uppercase with `letter-spacing: var(--nt-tracking-label)`
- **`Doto` = `var(--nt-font-display)`** — big numerics, timers, readouts ONLY. Never body text, never the raw string `Doto` in a Vue file.
- Mono numerics: `Space Mono` (`var(--nt-font-mono)`)
- `.section-kicker`: 0.72rem, uppercase, `var(--nt-text-dim)`, never accent-colored
- Fonts self-hosted SIL OFL 1.1 via `@fontsource/*` in `main.ts` + local Doto TTF in `variables.css`. Never ship Nothing's NDot/NType fonts.

### Cards & Tiles
- Card: `background: var(--ion-color-primary)`, no border, `border-radius: var(--nt-radius-md)`, 18px padding, no box-shadow
- Metric tile: `rgba(255,255,255,0.05)` surface, 10px radius
- Selected/live card: red hairline; give the base `border: 1px solid transparent` so layout doesn't shift
- Status chips: `.nt-chip` + `.nt-chip__dot` (red dot = live/alert)

### Spacing / Radius / Motion
- Spacing `--nt-space-1..6` (4/8/12/16/24/32); radius `--nt-radius-sm/md/lg/pill` (8/16/24/999)
- Motion: `var(--nt-dur-micro)`+`--nt-ease-decel`, `--nt-dur-std`+`--nt-ease-std`; LED animations use `steps()`

### Inputs / Buttons
- Input: dark translucent surface, hairline border, `var(--nt-radius-sm)`; time/date inputs `color-scheme: dark`
- Primary button: red, radius 8px, no border — red only for the page's key/destructive action; secondary = hairline-outline transparent (`.button-yellow` style), `.button-white` = high-contrast solid
- Pressed: `opacity: 0.7` or `var(--nt-surface-2)`

### Responsive
- Max content width 760px centered; breakpoints 600px / 760px

## graphify

`graphify-out/` holds a knowledge graph of the codebase. Where the `graphify` CLI is installed: `graphify query "..."` for broad context, `graphify path "A" "B"` to trace relationships, and `graphify update .` after modifying code (AST-only, no API cost) to keep it current. If the CLI is unavailable, ignore it and use normal search.
