# Comprehensive Codebase Analysis

> Authoritative deep-dive of the entire app, written from a full read of the source
> (June 2026, branch `main` @ `97b64a0`, v1.0.0). Intended as the primary onboarding
> document for AI agents and developers. Where this document and the older files in
> `docs/` disagree (`ARCHITECTURE.md` still calls this a "single-feature gym app"),
> **this document and `CLAUDE.md` win**.

---

## 1. What this app is

A **personal life-dashboard Android app** (single user, no server, no accounts) built with
**Ionic 8 + Vue 3 + Capacitor 8**. It tracks:

- **Gym**: workout templates, live workout sessions, sets/reps/weight, rest timers, PRs/1RM, history
- **Health**: sleep (scored, staged), readiness score, "battery" energy model, body weight + photos, habits, goals, calendar with recurrence
- **Finance**: accounts, investments, subscriptions, net worth
- **Home**: a unified dashboard aggregating all of the above into a daily view

There is **no backend API**. The "backend" is:

| Layer | Technology |
|---|---|
| Persistence | Local SQLite via `@capacitor-community/sqlite` (database name: `workout_db`) |
| Health data | Android **Health Connect** via `@capgo/capacitor-health` |
| Reminders | `@capacitor/local-notifications` |
| Photos/files | `@capacitor/filesystem`, `@capacitor/camera`, `@capawesome/capacitor-file-picker` |
| Settings | `localStorage` (transient state in `sessionStorage`) |

The web build (`npm run dev`) is **development-only**: `initDB()` returns `null` on web and
every DB function starts with `if (!db) return <empty>`, so all pages render with empty data.

Naming trivia that will confuse you otherwise: the repo is `dashbord` (sic), `package.json`
name is `gym`, the Capacitor `appId` is still `io.ionic.starter`, and the SQLite database
is `workout_db`. These are historical; the product is the dashboard app.

---

## 2. Boot sequence

```
index.html → src/main.ts
  ├─ createApp(App).use(IonicVue).use(router)
  ├─ router.isReady()
  ├─ await initDB()            ← creates/migrates entire schema (src/shared/db/app_db.ts)
  └─ app.mount('#app')

src/App.vue (root component)
  ├─ mounts <HealthConnectAutoSync/>  (renderless, see §6.3)
  ├─ <ion-router-outlet> with custom 220ms/180ms fade transition
  └─ onMounted (native only): re-initDB + schedule all enabled notification
     reminders (weight, habit w/ today's incomplete names, sleep, calendar, subscription)
```

`src/router/index.ts` merges per-feature route arrays: `/` redirects to `/home`, then
`homeRoutes`, `financeRoutes`, `healthRoutes`, `gymRoutes`, `settingsRoutes`. All routes
are lazy-loaded (`() => import(...)`).

### Full route table

| Path | Page | Notes |
|---|---|---|
| `/` | redirect → `/home` | |
| `/home` | `features/home/pages/HomePage.vue` | Main dashboard ("DashboardHome") |
| `/finance` | `FinancePage.vue` | Net-worth overview |
| `/finance/accounts` | `FinanceAccountsPage.vue` | |
| `/finance/investments` | `FinanceInvestmentsPage.vue` | |
| `/finance/subscriptions` | `FinanceSubscriptionsPage.vue` | |
| `/health` | `HealthPage.vue` | Readiness/sleep/body overview |
| `/health/sleep` | `SleepPage.vue` | |
| `/health/calendar` | `HealthCalendarPage.vue` | |
| `/health/habits` | `HealthHabitsPage.vue` | |
| `/health/goals` | `HealthGoalsPage.vue` | |
| `/health/body` | `BodyPage.vue` | Weight log + photos |
| `/tabs/` | `gym/pages/TabsPage.vue` | Gym tab shell (bottom tab bar) |
| `/tabs/Home` | gym `HomePage.vue` | Gym dashboard |
| `/tabs/Template` | `TemplatePage.vue` | |
| `/tabs/Exercise` | `ExercisePage.vue` | |
| `/tabs/History` | `HistoryPage.vue` | |
| `/tabs/ExercisePicker` | `flows/ExercisePickerPage.vue` | Multi-context picker (see §5.2) |
| `/tabs/TemplateBuilder` | `flows/TemplateBuilderPage.vue` | |
| `/tabs/TemplateEditor/:id` | `flows/TemplateEditorPage.vue` | |
| `/workout/:id` | `WorkoutPage.vue` | Live workout session (outside tabs) |
| `/exercise/:id` | `ExerciseDetailPage.vue` | PR + history chart (outside tabs) |
| `/settings` | `SettingsPage.vue` | |

Top-level navigation is `src/shared/components/DashboardTopBar.vue` (segment: Home /
Finance / Health / Gym + a separate Settings icon button). It maps the current path
prefix to the active segment (`/tabs`, `/workout`, `/exercise` all count as "gym").
The health and finance features each have their own secondary segment bar
(`HealthSectionTabs.vue`, `FinanceSectionTabs.vue`).

---

## 3. Data layer — `src/shared/db/app_db.ts` (2,309 lines)

**The single most important file.** One module-level `db: SQLiteDBConnection | null`;
every exported function guards `if (!db)`. Pages import functions directly — there is
no repository/store abstraction and **no global state library** anywhere in the app.

### 3.1 Schema (created/migrated in `initDB()`)

`initDB()` is idempotent and acts as the migration system: `CREATE TABLE IF NOT EXISTS`
for everything, followed by `PRAGMA table_info` checks + `ALTER TABLE ADD COLUMN` for
columns added later, plus one-time data fixes. `PRAGMA foreign_keys = ON`.

**Gym tables**

| Table | Columns (key ones) | Notes |
|---|---|---|
| `workout_template` | id, name, created_at | |
| `workout_template_exercise` | id, id_workout_template (CASCADE), id_exercise (CASCADE), set_number, rep_number, order_index | |
| `workout` | id, id_workout_template (SET NULL), **name** (added via migration, denormalized from template), time_start (default now), time_end (NULL = active!), total_kg | An "active workout" is simply `time_end IS NULL` |
| `workout_exercise` | id, workout_id (CASCADE), exercise_id (CASCADE), order_index | |
| `workout_exercise_sets` | id, workout_exercise_id (CASCADE), set_number, reps, weight, created_at, completed (0/1) | |
| `exercise` | id, name, id_muscle_group, id_equipment, rest_seconds | |
| `muscle_group`, `equipment` | id, name UNIQUE | Seeded: 6 muscle groups, 6 equipment types |
| `exercise_pr` | id, exercise_id UNIQUE (CASCADE), pr_weight, pr_reps, one_rep_max, date_achieved, workout_id (SET NULL) | One PR row per exercise |

**Health tables**

| Table | Columns | Notes |
|---|---|---|
| `health_metric` | id, date, type, value, unit, source, created_at | Generic key/value time series. Types in use: `steps`, `sleep_duration`, `sleep_time_in_bed`, `sleep_efficiency`, `sleep_score`, `sleep_heart_rate`, `respiratory_rate`, `resting_heart_rate`, `sleep_stage_<stage>` |
| `readiness_score` | **date PK**, score, inputs_json, created_at | Upserted via `ON CONFLICT(date)` |
| `sleep_session` | **date PK**, bedtime, waketime, time_asleep_hours, time_in_bed_hours, efficiency (0–1), score (0–100), sleep_hr, respiratory_rate, stage_{deep,light,rem,awake,asleep}_min, **hr_timeline_json** (`[{t,v,o}]`), **stage_timeline_json** (`[{s,start,end,dur}]`), source | Created in a separate `execute` after the main block |
| `habit` | id, name, frequency ('daily'), target, **time** (migrated), created_at | |
| `habit_log` | id, habit_id (CASCADE), date, completed (0/1), UNIQUE(habit_id, date) | |
| `goal` | id, name, target_value, current_value, due_date, status ('active'), created_at | |
| `calendar_event` | id, title, date, type ('general'), notes, **time_start**, **time_end**, **workout_template_id**, **recurrence** ('none') — last four migrated | Types: `general`, `workout`, `recovery`, `school`, `sleep`, `reminder`. Recurrence allowlist `none|daily|weekly` is validated in `addCalendarEvent` |
| `body_log` | id, date, weight_kg, notes, photo_path | Photo path is relative to `Directory.Data` |

**Finance tables**

| Table | Columns |
|---|---|
| `finance_account` | id, name, type ('cash'\|bank\|credit\|loan), institution, balance, updated_at |
| `finance_investment` | id, name, type ('stock'\|crypto\|fund\|other), quantity, value, updated_at |
| `finance_subscription` | id, name, amount, cadence ('monthly'\|yearly\|weekly), next_due_date, status |
| `net_worth_snapshot` | **date PK**, total_assets, total_liabilities (write path exists — `addNetWorthSnapshot` — but no page currently calls it) |

**Seed data** (inside `initDB`, all guarded with NOT EXISTS / `INSERT OR IGNORE`):
~77 exercises across 6 muscle groups, plus 4 starter templates `PULL A`, `PUSH A`,
`PULL B`, `PUSH B` fully populated with exercises. `initDB` also runs one-time cleanup:
case-insensitive exercise dedup (re-pointing FKs to the canonical id), template-exercise
dedup, backfill of `workout.name` from templates, and a dedup of `health_metric` rows
accumulated by a historical `= NULL` bug in `replaceHealthMetric` (keeps max id per
`(date, type, source)`).

### 3.2 Function inventory (grouped; all exported from `app_db.ts`)

- **Lookup**: `getMuscleGroups`, `getEquipment`
- **Templates**: `createTemplate` (returns lastId), `getTemplates`, `getTemplateById`, `renameTemplate`, `deleteTemplate`, `addExerciseToTemplate`, `getTemplateExercises` (ordered), `getTemplateExercisesByTemplateId` (unordered), `editTemplateExercises(rowId, sets, reps, order)`, `deleteTemplateExercise(rowId)`
- **Exercises**: `addExercise`, `renameExercise`, `updateExerciseRestSeconds`, `getExercises` (joined with muscle_group/equipment names)
- **Workout session**: `startWorkoutFromTemplate` (copies template exercises; pre-fills each set with reps/weight from the most recent completed workout containing that exercise, falling back to template reps + weight 0), `getActiveWorkout` / `hasActiveWorkout` (`time_end IS NULL`), `getWorkoutById`, `getWorkoutExercises`, `getWorkoutSets`, `updateWorkoutSet`, `addExerciseToWorkout` (copies previous sets or creates `defaultSetNumber` defaults), `addSetToWorkoutExercise`, `deleteWorkoutSet`, `deleteWorkoutExercise`, `updateWorkoutExerciseOrder`, `getNextWorkoutOrderIndex`, `getNextSetNumber`, `endWorkout` (sets time_end, then `saveWorkoutTotalKg` = Σ reps×weight of completed sets, then `updateExercisePRs`), `cancelWorkout` (plain DELETE — also used by HistoryPage to delete past workouts)
- **Workout queries**: `getWorkouts` (completed only, DESC), `getLatestWorkout`, `getTodayCompletedWorkouts`, `getWorkoutsByName(templateId)` (chart data), `getWorkoutsByTemplate` (latest workout per template), `getWorkoutHistoryExercises` (per-workout: completed-set count + max reps), `getLatestCompletedSetsForExercise(exerciseId, excludeWorkoutId?)`, `getLatestCompletedSetDefaultsForExercise` (falls back to `{reps: 10, weight: 0}`)
- **PRs**: `updateExercisePRs(workoutId)` (Epley 1RM = weight × (1 + reps/30); updates only if heavier, or same weight + more reps), `getExercisePR`, `getAllExercisePRs`, `getExerciseHistory(exerciseId, limitDays=90)` (daily max weight + volume, keyed off `wes.created_at`), `getExerciseStats`
- **Health metrics**: `addHealthMetric`, `replaceHealthMetric` (DELETE-then-INSERT keyed on `(date, type, source)` using the NULL-safe pattern `(source = ? OR (source IS NULL AND ? IS NULL))`), `getLatestHealthMetric(type)`, `getRecentHealthMetrics`, `getHealthMetricsForDate`
- **Readiness**: `upsertReadinessScore(date, score, inputs)`, `getReadinessScore(date)`, `getLatestReadinessScore`, `queryReadinessHistory(days=14)`
- **Sleep sessions**: `upsertSleepSession` (full ON CONFLICT(date) upsert), `getSleepSession(date)`, `getLatestSleepSession`, `getRecentSleepSessions(limit=14)`; `SleepSessionRecord` interface exported here
- **Habits**: `addHabit(name, frequency, target, time?)`, `deleteHabit`, `getHabitsWithStatus(date)` (LEFT JOIN log), `toggleHabitCompletion` (upsert), `getRecentHabitLogs(habitId, days)`, `getHabitCompletedDatesForMonth(yearMonth)`
- **Goals**: `addGoal`, `getGoals`, `updateGoalProgress(goalId, currentValue, status?)`
- **Calendar**: `addCalendarEvent(title, date, type, notes?, timeStart?, timeEnd?, workoutTemplateId?, recurrence?)`, `getCalendarEventsForDate(date)` — matches exact date OR `daily` recurrence started earlier OR `weekly` with same `strftime('%w')` day-of-week; `getCalendarEventDatesForMonth(yearMonth)` — expands recurring events into dot-indicator dates (JS `getDay()` at `T12:00:00`); `deleteCalendarEvent`
- **Body log**: `insertBodyLog`, `getBodyLogs` (DESC), `deleteBodyLog`, `bulkInsertBodyLog` (INSERT OR IGNORE, used by the Better-Weight import); `BodyLogEntry` interface
- **Finance**: `addFinanceAccount`, `getFinanceAccounts`, `addFinanceInvestment`, `getFinanceInvestments`, `addFinanceSubscription`, `getFinanceSubscriptions`, `addNetWorthSnapshot`, `getLatestNetWorthSnapshot` (no UI yet for the last two)
- **Digest**: `getWeeklyDigest()` → `{avgSleep, avgSteps, avgReadiness, workoutCount, readinessTrend}` (7-day averages; trend = this-week avg readiness − prior-week, rounded)
- **Backup**: `exportDatabaseToSQL()` → `{fileName: 'fitness-app-backup-<timestamp>.sql', sql}` — data-only dump: `DELETE FROM` each table in `EXPORT_DELETE_TABLES` (FK-safe child→parent order), then `INSERT` rows for each table in `EXPORT_INSERT_TABLES` (parent→child); `importDatabaseFromSQL(sql)` — parses statements (quote-aware splitter, strips comments/BEGIN/COMMIT), classifies DELETE/INSERT per table, replays them in hardcoded FK-safe order inside a transaction with FK off, rolls back on error

**⚠️ Known import bug (verified, June 2026):** `importDatabaseFromSQL` has its *own*
hardcoded `deleteOrder`/`insertOrder` arrays which are **missing `sleep_session`,
`body_log`, and `exercise_pr`** (all present in the EXPORT lists). Statements for tables
not in `insertOrder` are captured into the map but never executed, so restoring a backup
silently drops sleep sessions, body logs, and PRs. Any schema change must keep
`EXPORT_DELETE_TABLES`, `EXPORT_INSERT_TABLES`, **and both arrays inside
`importDatabaseFromSQL`** in sync.

---

## 4. Health Connect service — `src/shared/health/healthConnect.ts` (924 lines)

All scoring/energy models live here, not in pages. Android-only:
`isHealthConnectAvailable()` is literally `platform === 'android'`.

### 4.1 Permission / availability flow
`HEALTH_CONNECT_READ_TYPES = ['steps','sleep','restingHeartRate','heartRate','respiratoryRate','workouts']`.
- `requestHealthConnectPermissions()` → `{available, granted, reason?, status?}` (granted = ALL types authorized)
- `canAutoSyncHealthConnectMetrics()` → silent check (no prompt), used by autosync
- `openHealthConnectSettings()` — deep link for the user to fix permissions

### 4.2 `syncHealthConnectMetrics(daysBack = 30)` — the main pipeline
1. Reads all 5 sample types for the window in parallel (limit 1000 each).
2. Buckets samples by date key (`YYYY-MM-DD`); steps sum per day; sleep keyed by **endDate** (a night belongs to its wake-up date); HR/resting-HR/resp-rate averaged per day.
3. Writes day metrics via `replaceHealthMetric(date, type, value, unit, 'health-connect')`.
4. **Sleep, in chronological order** (so rolling baselines accumulate): for each night computes the sleep summary + score (see 4.3), writes `sleep_duration` / `sleep_time_in_bed` / `sleep_efficiency` (as 0–100) / `sleep_score` / per-stage `sleep_stage_<name>` metrics / `sleep_heart_rate`, builds compact JSON timelines, and `upsertSleepSession(...)`. Rolling state (bedtime minutes, resp rates; window 14, requires ≥3 prior nights) is pushed **after** scoring so a night never influences its own baseline. Bedtime variance is wrap-around-aware (23:50 vs 00:10 = 20 min).
5. For each date with sleep or resting-HR data: computes readiness (4.4) and `upsertReadinessScore`.
Returns `{available, granted, synced}` (count of metric writes).

### 4.3 Sleep score model — `calculateSleepScore` (100 pts)
| Component | Max | Rule |
|---|---|---|
| Duration | 25 | `(asleepHours / userTarget) × 25`, target = `getSleepGoalHours()` (default 8) |
| Efficiency | 20 | `efficiency × 20` |
| Deep sleep | 12.5 | `(deepPct / 0.18) × 12.5` — full credit at ≥18% of sleep time |
| REM | 12.5 | `(remPct / 0.22) × 12.5` — full credit at ≥22% |
| Bedtime consistency | 15 | `15 − (varianceMin / 60) × 15` vs 14-night rolling mean (0 at ≥60 min) |
| Respiratory deviation | 15 | `15 − (|rr − baseline| / 3) × 15` vs 14-night personal baseline (0 at ≥3 bpm) |

Missing data → half credit for that component (6.25 / 7.5). `timeAsleepHours` comes from
stage minutes excluding `awake`/`inBed`; if no stages, falls back to in-bed duration
(efficiency then = 1.0).

### 4.4 Readiness score — `calculateReadinessScore(inputs)`
Base 24 + components, clamped 0–100:
sleepHours `(h/8)×18` (max 18) • efficiency `×12` (max 12) • sleepScore `(s/100)×22` (max 22)
• restingHr `16 − |hr−60|×1.2` (max 16, **6 if null**) • sleepHR `12 − |hr−55|×0.8` (max 12, 4 if null)
• respRate `8 − |rr−14.5|×1.4` (max 8, 3 if null) • **minus** step penalty `(steps − stepGoal)/1500` (max 10).

`applyReadinessDrain(base, now)`: linear decay starting 06:00, max −35 pts over a
16-hour window. Pages always apply this before displaying a readiness number.

### 4.5 Battery model — `calculateBattery(baseline, now, workouts, activities, events)`
Returns `{score, baseline, drains{time,workout,activity,event}, readyToTrain, readyToStudy, status}`.
- **time**: `baseline − applyReadinessDrain(baseline, now)`
- **workout** (today's gym sessions, cap 35): per workout `min(durationMin/3, 20) + min(totalKg/300, 15)`
- **activity** (today's HC workouts, cap 30): per activity `max(min(durMin/3, 20), min(calories/50, 20))`
- **event** (calendar events already started, cap 25): elapsed hours × per-type rate — `sleep −5/h`, `recovery −2/h`, `workout +6/h`, `school +5/h`, `reminder 0`, other/general `+4/h`; per-event clamp [−5, +15]; untimed events drain nothing; events without end assume 1 h
- score = baseline − all drains, clamped 0–100. `readyToTrain ≥60`, `readyToStudy ≥40`; status: Peak ≥70 / Good ≥55 / Low ≥35 / Recharge.

### 4.6 Other exports
`getLatestSleepSummary(daysBack=14)` (live HC read, used less now that `sleep_session` is
persisted), `getRecentActivities(daysBack=7)` → `ActivitySummary[]` from `Health.queryWorkouts`
(swallows errors → `[]`), `readHealthMetrics` (generic sample reader), and the
`ReadinessInputs` / `SleepSummary` / `BatteryResult` / `ActivitySummary` types.

---

## 5. Feature modules — page by page

State management everywhere: local `ref`/`computed` in `<script setup lang="ts">`, data
loaded in `onIonViewWillEnter` (so it refreshes on tab re-entry; plain `onMounted` is not
enough with Ionic's page caching). Chart.js instances are destroyed in `onUnmounted`.

### 5.1 Home (`/home` — features/home/pages/HomePage.vue, 1,448 lines, the biggest page)
The daily mission-control. Sections:
- **Weight card**: today's weight, quick-log input (`insertBodyLog`), delta vs `getGoalWeightKg()`, 7-day Chart.js sparkline.
- **Battery card**: baseline = stored readiness for today (or latest, or computed from raw metrics) → `calculateBattery(...)` with today's completed workouts (`getTodayCompletedWorkouts`), HC activities, and today's calendar events. SVG progress ring, drain breakdown list ("How it drains"), Ready-to-train/study chips.
- **Battery timeline**: Chart.js line, hours 06:00–23:00, `calculateBattery` evaluated per hour; solid red for past, dashed gray projection for future.
- **Active workout card**: live HH:MM:SS elapsed timer + rest-timer mirror read from `sessionStorage.restTimer`; "back to workout" navigation.
- **Last workout card**: `getLatestWorkout` + exercises; "Start again" → `startWorkoutFromTemplate`.
- **Weekly digest card**: `getWeeklyDigest()` averages + readiness trend (±N colored).
- **Day schedule**: vertical timeline (56 px/hour, computed range default 06–22) of today's events, habits (toggleable), completed workouts and HC activities; red "now" line updated every 60 s; untimed items in an "all-day" strip.

### 5.2 Gym (`/tabs/*`, `/workout/:id`, `/exercise/:id`)
- **TabsPage**: ion-tabs shell, 4 tabs, custom fade transition.
- **gym HomePage** (`/tabs/Home`): active-workout banner with elapsed + rest timer (restored from `sessionStorage.restTimer` via stored `endTime`), weekly progress dots vs goal (`localStorage.homeWeeklyGoal`, default 4), template grid to start workouts (`startWorkoutFromTemplate` → `/workout/:id`), total-kg Chart.js line per template (`getWorkoutsByName`, 300 ms debounce).
- **WorkoutPage** (`/workout/:id`): the live session. Loads exercises + sets + previous-workout placeholders. Checking a set saves it and starts the rest timer (`exercise.rest_seconds`); timer persists in `sessionStorage.restTimer` as `{remaining,total,endTime}`, recovers after navigation/reload from `endTime`, plays an 800 Hz Web-Audio beep at 0, has ±15 s and Skip controls. `overloadHint(ex)`: previous max weight × 1.025 rounded to nearest 2.5 kg, display-only ("Last: X kg × Y — try Z kg"). Exercise reorder via up/down buttons (persists every `order_index`), swipe-to-delete sets (renumbers remaining), add exercise → ExercisePicker with `?workoutId=`. End/Cancel both confirm via alert, clear timers + `sessionStorage.restTimer`, route to `/tabs/Home`. Rest-duration editing uses **TimerDial.vue** in a sheet modal (SVG dial 1–240 s, drag with `atan2` angle math, presets [15,30,45,60,90,120,180,240], `Haptics.selectionChanged()` throttled to 60 ms, native only) → `updateExerciseRestSeconds`.
- **TemplatePage**: lists templates with nested exercises, delete (confirm alert), edit → TemplateEditor, create → TemplateBuilder.
- **TemplateBuilder / TemplateEditor**: name + draggable (`vuedraggable`) exercise list with sets/reps inputs. Adding an exercise round-trips through ExercisePicker using the **`localStorage.selectedExerciseForTemplate` bridge** (JSON, cleared after read). Editor distinguishes new rows (`id === 0` → INSERT) from existing (UPDATE via `editTemplateExercises`); deletions are batched in `removedExerciseRowIds` and applied on save; `order_index` is reassigned sequentially on save. Both validate: name required, ≥1 exercise, no duplicates, sets/reps > 0.
- **ExercisePickerPage** (`/tabs/ExercisePicker`): three behaviors — `?workoutId=` adds to the active workout (next order index + previous-set defaults) and returns to `/workout/:id`; `?templateId=` writes the localStorage bridge and returns to the editor; no params navigates to `/exercise/:id` detail.
- **ExercisePage** (`/tabs/Exercise`): exercise library with muscle-group filter, add-exercise modal (default rest 60 s), rename via alert, PR badges from `getAllExercisePRs`.
- **ExerciseDetailPage** (`/exercise/:id`): PR card (weight, reps, stored 1RM, date), dual-axis Chart.js (weight left axis yellow, volume÷100 right axis red) over a 30/60/90-day selector, stats (workout count, avg weight, max volume).
- **HistoryPage** (`/tabs/History`): completed workouts with durations (`formatDuration`) and per-exercise completed-set counts; delete reuses `cancelWorkout`.
- `types/models.ts`: all gym TS interfaces (Exercise, WorkoutTemplate, Workout, WorkoutExercise(+Set), ExercisePR, ExerciseStats, history types).

### 5.3 Health (`/health/*`)
- **HealthPage** (overview): readiness hero (stored today's score → fallback latest → fallback computed from latest metrics; always passed through `applyReadinessDrain`; labels ≥80 "Ready to push" / ≥60 "Steady day" / else "Take it easy"), 3 mini tiles, sleep card (5 metrics + priority-ordered insight line: resp>17 illness warning → efficiency<80 → sleep<7h → score≥85 praise → default), body card (HR, resp, latest weight), HC activities list (7 days), **14-day readiness SVG chart** (hand-rolled polyline/polygon, clickable points with tooltip, needs ≥2 points), compact sync button (`requestHealthConnectPermissions` → `syncHealthConnectMetrics`, or `openHealthConnectSettings` when unavailable). Plain `<div>` cards only — no `ion-card` on this page by convention.
- **SleepPage**: reads persisted `sleep_session` rows (`getRecentSleepSessions(30)`, `getSleepSession(date)`), day navigation across available dates. Score ring (SVG stroke-dashoffset), stage timeline lanes rendered from `stage_timeline_json` (offset/width percentages; lanes ordered deep/rem/light/asleep/awake/inBed), stage minute/share summary, 7-night consistency (good night = ≥7 h AND score ≥70; streak scans back ≤60 days), sleep-HR chart from `hr_timeline_json` (clickable points), 30-night score history SVG.
- **BodyPage**: weight log form (date-unique, weight>0), optional photo via Camera (quality 80, base64) or FilePicker; photos written to `Directory.Data/body_photos/<timestamp>.<ext>` (mkdir recursive, ignore-exists), path stored in `body_log.photo_path`; thumbnails read back as data-URLs; full-screen viewer; deleting an entry also deletes the file (ignore-missing). Chart.js weight line with optional dashed goal line (`getGoalWeightKg`), range selector 30/90/180/all, points hidden when >60 entries. After logging today's weight calls `dismissWeightReminder()`.
- **HealthCalendarPage**: month grid (computed, Sun-first, leading blanks), red dots = event dates (`getCalendarEventDatesForMonth`, recurring events expanded), faint dots = habit-complete dates. Day panel: events (typed tag colors `item-tag--<type>`) + habit toggles. Add-event form: title, time range, type, recurrence, notes, and — when type=`workout` — a template picker with a **recommendation** (templates filtered by ±3 h time-of-day match of past usage, then least-recently-used).
- **HealthHabitsPage**: per-date habit list (cannot navigate to future), toggle completion, streak per habit (consecutive completed days scanning back from selected date, max 60, via `getRecentHabitLogs(id, 60)`), add form (name, optional time, frequency), progress bar X/Y done.
- **HealthGoalsPage**: simple goals CRUD-lite — add (name, target>0, optional due date), list with progress bars (`min(1, current/target)`), per-goal update input → `updateGoalProgress`.

### 5.4 Finance (`/finance/*`)
Simplest module; **add + list only, no edit/delete UI yet**.
- **FinancePage**: net worth = Σ account balances + Σ investment values; metric tiles (accounts, investments, subscriptions/mo, holdings count); `Intl.NumberFormat` USD, 0 decimals.
- **Accounts / Investments / Subscriptions pages**: one form + list each, mapping 1:1 onto `addFinance*` / `getFinance*`. Validation: name required, numeric fields finite.
- Note: the subscriptions/month tile sums `amount` regardless of cadence (yearly/weekly are not normalized to monthly).

### 5.5 Settings (`/settings` — SettingsPage.vue)
- **Health targets**: sleep goal (4–14 h), step goal (1000–30000), goal weight — via `userSettings` setters.
- **Health Connect**: manual sync button with result toast + last-sync time.
- **Data import**: one-time "Better Weight" history import (452 hardcoded entries) → `bulkInsertBodyLog`; guarded by `localStorage.body_history_imported_v1`.
- **Gym**: weekly workout goal action-sheet (1–12) → `localStorage.homeWeeklyGoal`.
- **Notifications**: toggles + times for weight/habit/sleep reminders, calendar lead minutes (0/15/30/60), subscription lead days (1/3/7). Enabling requests permission (`requestNotificationPermission`) and immediately (re)schedules via `notifications.ts`.
- **DB backup**: export (`exportDatabaseToSQL` → web: blob download; native: write to `Directory.Documents` + native Share sheet) and import (web file input / native FilePicker with SQL mime types, confirm alert, `importDatabaseFromSQL` — see the import bug in §3.2).

---

## 6. Shared utilities

### 6.1 `notifications.ts` (`@capacitor/local-notifications`, all no-op on web)
Stable IDs: weight=1, habit=2, sleep=3, calendar=4000+eventId, subscription=5000+subId.
Daily repeating reminders (`schedule.at` next occurrence of HH:MM, `repeats: true, every: 'day'`)
for weight/habit/sleep; one-shot reminders for calendar events (fire `minsBefore` before
`time_start`; untimed events skipped) and subscriptions (09:00, `daysBefore` days before
`next_due_date`). Each scheduler cancels its previous IDs first. `dismissWeightReminder()`
removes the *delivered* weight notification (called by BodyPage after logging today).
`cancelAllNotifications()` exists. Scheduling happens at app start (App.vue) and whenever
the user changes settings.

### 6.2 `userSettings.ts` — typed accessors over localStorage
`setting_sleep_goal_hours` (8.0) • `setting_step_goal` (10000) • `setting_goal_weight_kg` (null)
• `notif_weight_enabled/_time` (08:00) • `notif_habit_enabled/_time` (09:00)
• `notif_sleep_enabled/_time` (22:30) • `notif_calendar_enabled` / `notif_calendar_mins` (15)
• `notif_sub_enabled` / `notif_sub_days` (3). Booleans stored as `'1'`/`'0'`.

### 6.3 `HealthConnectAutoSync.vue` (renderless, mounted in App.vue)
Sync orchestrator: sync on mount → retry once after **6 s** (HC cold-start race) →
every 30 min interval → on app foreground (`App.addListener('appStateChange')` native /
`visibilitychange` web). Guards: `syncing` mutex + 10-minute minimum gap (`minSyncGapMs`).
Only syncs if `canAutoSyncHealthConnectMetrics()` (no permission prompts from autosync).
Also fires `runDailyBackupIfNeeded()` on mount. Cleans everything up in `onUnmounted`.

### 6.4 `timeFormat.ts`
`toTimestamp` (epoch numbers, ISO, space-separated datetimes; **appends `Z` when no
timezone present** — DB CURRENT_TIMESTAMP values are UTC), `normalizeDateInput`,
`formatDuration(start, end)` → `"Xh Ym Zs"`, `formatTime(sec)` → `HH:MM:SS`,
`formatWorkoutDate` → "Mon D" or "No session yet".

---

## 7. Client-side storage map

**sessionStorage**
- `restTimer` — `{remaining, total, endTime}` JSON; the single source of truth for the rest
  timer across WorkoutPage, gym HomePage and dashboard HomePage. Remaining time is always
  recomputed from `endTime`, so it survives reload.

**localStorage**
- All keys in §6.2 (settings/notifications)
- `homeWeeklyGoal` — weekly workout target (default 4)
- `selectedExerciseForTemplate` — transient JSON bridge ExercisePicker → Template Builder/Editor (cleared on read)
- `body_history_imported_v1` — one-time import guard

---

## 8. Android / native specifics

- `capacitor.config.ts`: appId `io.ionic.starter`, appName `gym`, webDir `dist`, SQLite unencrypted.
- `android/`: minSdk 26, targetSdk 36, versionName 1.0. Manifest permissions: INTERNET,
  CAMERA, READ_MEDIA_IMAGES, READ_EXTERNAL_STORAGE (≤32), POST_NOTIFICATIONS,
  RECEIVE_BOOT_COMPLETED, SCHEDULE_EXACT_ALARM. Health Connect permissions are merged
  in by the `@capgo/capacitor-health` plugin manifest.
- **Build order matters**: `npm run build` (vue-tsc + vite) **then** `npx cap sync`
  before any APK build — otherwise stale `dist/` ships.

---

## 9. Build, test, CI, tooling

- `npm run dev` (Vite, :5173) • `npm run build` (vue-tsc + vite build) • `npm run lint` (ESLint flat-ish `.eslintrc.cjs`, vue3-essential + TS; `no-console`/`no-debugger` warn in dev, error in prod)
- `npm run test:unit` — Vitest (jsdom, globals). Coverage today: **one spec** (`tests/unit/example.spec.ts`) testing `timeFormat` only.
- `npm run test:e2e` — Cypress (needs dev server running; baseUrl :5173). One smoke test asserting the dashboard renders "Readiness" / "How it drains" headings.
- CI: `.github/workflows/copilot-setup-steps.yml` only (env setup for Copilot agents: Node 20, npm ci, Playwright, sqlite3). **No build/lint/test CI gate exists.**
- `docs/`: AI_CONTEXT.md, API.md, APP_STATUS.md, ARCHITECTURE.md, DB_SCHEMA.md, DESIGN.md, UI_STRUCTURE.md — **partially stale** (written when only the gym feature existed; DB_SCHEMA.md misses health/finance tables). `database_visual structure/` holds schema PNGs (V1–V3).
- `CLAUDE.md` is current and binding — especially the **design system** (colors, card specs, typography, no-emoji rule) and DB conventions. It references a `graphify` knowledge graph (`graphify-out/`); that tool/dir is not present in fresh clones — fall back to this document and direct reading.

---

## 10. Conventions checklist (enforce when editing)

1. `<script setup lang="ts">`, `import type`, `@/` alias, scoped styles in feature pages.
2. All DB access through `app_db.ts`; names `upsert*` / `replace*` / `delete*` / `query*` / `get*` / `add*`; booleans 0/1; every function tolerates `db === null`.
3. New tables → add to `EXPORT_DELETE_TABLES` + `EXPORT_INSERT_TABLES` **and** the order arrays inside `importDatabaseFromSQL` (see §3.2 bug).
4. Nullable unique columns: never `= NULL`; use the `(col = ? OR (col IS NULL AND ? IS NULL))` pattern.
5. Schema changes go into `initDB()` as idempotent `CREATE IF NOT EXISTS` / PRAGMA-checked `ALTER TABLE`.
6. Chart.js: destroy in `onUnmounted`, `flush: 'post'` watchers, `animation: false`, red line `rgb(239,68,68)`, ticks `rgba(255,255,255,0.4)`, grid `rgba(255,255,255,0.1)`, dark tooltip.
7. Load data in `onIonViewWillEnter`, not just `onMounted` (Ionic caches pages).
8. New calendar event types need: allowlist consideration, a `item-tag--<type>` CSS class, and a `drainPerHour` rate in `calculateBattery`.
9. No emojis in UI. Follow the design tokens in CLAUDE.md (cards `var(--ion-color-primary)`, radius 12/10/8, accent red interactive, yellow = live/active only, Doto font for timers).
10. Health Connect calls: check availability/authorization first; everything must degrade gracefully on web and on Android devices without HC.

## 11. Quirks & gotchas (hard-won knowledge)

- **Active workout = `workout.time_end IS NULL`.** `cancelWorkout` is a plain DELETE and doubles as history deletion.
- `endWorkout` is the only place totals and PRs are computed (`saveWorkoutTotalKg`, `updateExercisePRs`); only `completed = 1` sets count.
- `getExerciseHistory` groups by `workout_exercise_sets.created_at`, not workout time — sets created but edited later keep their creation date.
- Sleep nights are keyed by **wake-up date**; sleep sync must stay chronological or rolling baselines (bedtime variance, resp baseline) silently degrade.
- Day-of-week recurrence is computed two ways: SQL `strftime('%w', date)` (UTC) in `getCalendarEventsForDate` vs JS `getDay()` at local noon in `getCalendarEventDatesForMonth` — a known edge-case mismatch near timezone boundaries.
- DB timestamps from `CURRENT_TIMESTAMP` have no timezone marker; `timeFormat.toTimestamp` compensates by assuming UTC. Use those helpers instead of `new Date(raw)`.
- Readiness displayed anywhere = stored/computed baseline **minus** `applyReadinessDrain`. Don't display raw stored scores.
- The dashboard battery timeline calls `calculateBattery` once per hour slot (≈18×) with no memoization — keep it cheap.
- Rest timer lives in `sessionStorage` and is read by three different pages; change the shape in all of them or not at all.
- Subscriptions "per month" tile doesn't normalize yearly/weekly cadences.
- `net_worth_snapshot` and `getWorkoutsByTemplate` have no UI callers yet (groundwork).
- `src/components/ExploreContainer.vue` is leftover Ionic scaffolding — unused.
