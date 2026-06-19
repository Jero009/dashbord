# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ionic + Vue 3 health and fitness tracking app with local SQLite storage and Android Health Connect integration. Runs as a Capacitor Android app; the web target is used for development only (SQLite is a no-op on web).

## Commands

```bash
npm run dev           # Vite dev server at http://localhost:5173
npm run build         # TypeScript compile + Vite build
npm run lint          # ESLint
npm run test:unit     # Vitest unit tests (add --run for non-watch)
npm run test:unit -- src/path/file   # Single file
npm run test:e2e      # Cypress (requires dev server running separately)
```

## Architecture

### Feature Modules

`src/features/` — isolated modules: **gym**, **health**, **finance**, **home**, **plan**. Each has `routes.ts`, `pages/`, `components/`. Routes are lazy-loaded and merged in `src/router/index.ts`.

### Shared Layer

`src/shared/` for cross-feature concerns:
- `db/app_db.ts` — single SQLite instance, all DB functions exported from here
- `health/` — Health Connect sync (`HealthConnectAutoSync.vue` mounted in `App.vue`, runs on startup)
- `utils/` — formatting, type conversions, haptics, notifications
- `components/` — global UI components

### Data Flow

Pages call exported functions from `src/shared/db/app_db.ts` directly. No global state store — state lives in `ref`/`computed` local to each page. Rest timer state persists in `localStorage` (survives a full app close — see Rest Timer below).

### DB Conventions

- All DB access goes through `app_db.ts`; function names follow `upsert*`, `replace*`, `delete*`, `query*`, `get*`
- Booleans stored as `0`/`1`
- SQLite unavailable on web — DB calls must tolerate empty/null results
- **New DB tables**: Add to `EXPORT_DELETE_TABLES`, `EXPORT_INSERT_TABLES`, `deleteOrder`, and `insertOrder` in `importDatabaseFromSQL` — all four lists.
- **Nullable unique columns**: Never `WHERE col = NULL`. Use `(col = ? OR (col IS NULL AND ? IS NULL))` in any upsert on a nullable unique column.

### Health Connect

- Syncs steps, sleep, heart rate, respiratory rate via `@capgo/capacitor-health`
- `HealthConnectAutoSync.vue` — initial sync on mount + 6 s retry for cold-start race condition
- Readiness score inputs: sleep hours, sleep efficiency, sleep score, resting HR, sleep HR, respiratory rate, steps
- Sleep score (`calculateSleepScore` in `healthConnect.ts`) — 100-pt model: duration vs target (25), efficiency (15), WASO (10), deep% ≥18% (10), REM% ≥22% (12.5), bedtime timing variance vs 14-night mean (15), respiratory rate vs 14-night baseline (12.5). Returns `number | null` — null when `timeAsleepHours < 1`.
- User device: Amazfit Active 2 via Zepp Health → Health Connect. Provides sleep stages, HR, steps, respiratory rate. No HRV without device upgrade.
- **`toDateKey` uses local date**: extracts `YYYY-MM-DD` using `getFullYear/getMonth/getDate` (NOT `.toISOString().slice(0,10)`). UTC slice was off-by-one for UTC+ timezones.
- **Steps sync**: separate query window (7 days, 5000-record limit, `ascending: false`) so today's steps are always in the result set.

### Planner (separate Calendar / Habits / Goals pages, shared logic)

Calendar, Habits, and Goals are **three separate pages** under the Plan tab, all backed by one composable so they share identical logic:
- **`src/features/plan/composables/usePlanner.ts`** — single source of truth: all calendar-event, habit (with streak stats) and goal state/actions/loaders. Each page destructures only the slice it renders.
- **`src/features/plan/planner.css`** — shared styles, scoped per page via `<style scoped src="../../plan/planner.css">`.
- `HealthCalendarPage` (`/plan/calendar`) — month grid (dots: red=event, white=habit done, yellow=goal due) + selected-day detail (events + scheduled habits + goal deadlines).
- `HealthHabitsPage` (`/plan/habits`) — habit board (7-day week strip with toggles, expandable per-habit stats: current streak, best streak, 30-day completion rate, 28-day mini grid, edit form) + 10-week consistency heatmap.
- `HealthGoalsPage` (`/plan/goals`) — goals with progress bars, linked-habit counts, due labels, completed list.
- `PlanPage` (`/plan`) — "Today" snapshot overview. Tabs: `PlanSectionTabs` (Overview / Goals / Habits / Calendar).
- Legacy `/health/planner`, `/health/calendar`, `/health/habits`, `/health/goals` redirect to `/plan` and `/plan/{calendar,habits,goals}`. There is no longer a merged `HealthPlannerPage`, and Health's section tabs no longer include "Planner".

- `habit.days_of_week` — comma-separated JS weekday digits (Sunday=0), NULL/empty = every day. `getHabitsWithStatus(date)` only returns habits scheduled on that date's weekday.
- `habit.goal_id` — habit-goal link: `toggleHabitCompletion` moves the linked goal's `current_value` by ±1 on real state changes (all callers, including HomePage, get this behavior). `deleteGoal` clears `goal_id` on linked habits.
- Streak math lives in `src/shared/utils/habitStats.ts` (`currentStreak`, `bestStreak`, `completionRate`, `isScheduledOn`) — unscheduled days never break a streak; an incomplete *today* doesn't either. Unit tests in `tests/unit/habitStats.spec.ts`.
- `goal.status`: `active` | `completed`. `getGoalDueDatesForMonth` feeds the yellow calendar dots.

### Training Load vs Recovery Overlay

Three pure-TS services in `src/shared/health/` (no DB/Vue deps, unit-tested in `tests/unit/{trainingLoad,recoveryBaseline,overtraining}.spec.ts`):
- **`trainingLoad.ts`** — `sessionRpeLoad(rpe, durationMin)`, `computeDailyLoads(sessions)` (per-day `volumeLoad = Σ reps×weight` and `rpeLoad = Σ rpe×duration`, null when no RPE that day), `selectLoadMetric`/`dailyLoadValue`, `computeAcwrSeries(dailyLoads, {acuteDays=7, chronicDays=28, minChronicDays=14, metric='auto', endDate})`. **One consistent unit per series** (never mixes sRPE+volume): `auto` picks `'rpe'` only when *every* training day has an RPE load, else `'volume'` — `AcwrPoint.metric` records which. Acute/chronic are **average daily loads** over gap-filled windows (rest days = 0), so ACWR ≈ 1.0 in steady state. **`endDate`** extends the series across rest days so acute load decays (detraining shows up instead of freezing at the last workout) — the component passes today. `acwrFlag`: `<0.8` detraining · `0.8–1.3` optimal · `1.3–1.5` caution · `>1.5` high_risk.
- **`recoveryBaseline.ts`** — `computeRecoverySeries(readings, metric)` for `metric: 'hrv' | 'rhr'`. Trailing 7/28-reading means, 28-reading sample SD, raw `z = (v−mean28)/sd28`, and **`recoveryZ`** (sign-normalised so **negative = worse recovery**: HRV uses raw z, RHR uses `−z` since elevated RHR is bad). HRV-ready — fed by RHR today; drop in an `hrv` health_metric and it switches automatically.
- **`overtraining.ts`** — `evaluateOvertraining(points)` → `{status: 'green'|'yellow'|'red', overreaching, acwr, consecutiveLowRecovery, reasons}`. **Red** = ACWR > 1.5 AND `recoveryZ ≤ −1.0` for 2+ consecutive (trailing) days. Yellow = a single warning. `acwrZoneLabel(acwr)` helper.

**Data**: `workout.session_rpe REAL` (nullable, added via migration block; auto-handled by export/import). Set by `setWorkoutSessionRpe(id, rpe)` — optional 1–10 prompt in `WorkoutPage` end-workout flow. `getSessionLoads(days)` → per-workout `{date, duration_minutes, session_rpe, volume}`; `getHealthMetricDailySeries(type, days)` → one averaged value/date ascending (RHR today, `hrv`-ready).

**UI**: `src/features/analytics/components/TrainingLoadOverlay.vue` — mounted on `AnalyticsGymPage`. Custom **SVG dual-axis chart** (not Chart.js): load bars color-coded by ACWR zone (detraining=dim white, optimal=green, caution=gold, high_risk=red) + overlaid recovery-z polyline. Day N+1's recovery point is drawn at the **left edge of its bar** (= right edge of bar N) so the load→recovery lag reads at a glance. Status banner green/yellow/red — plus a neutral **'unknown'** ("Load tracked") state when no recovery signal exists, so it never shows a falsely confident green. HRV only takes over from RHR at ≥14 readings (`HRV_TAKEOVER_MIN`). Loads on mount + `onIonViewWillEnter`. ACWR/acute/chronic/recovery-z tiles, window selector 28/56/90 days.

### Battery Score

`calculateBattery(baseline, now, workouts, activities, events, circadianScore?)` in `healthConnect.ts`:
- Drains: time (gradual), workout (gym log), activity (HC activities — only when no gym workout today), events (calendar)
- `eventDrain` inner clamp is `(-5, 15)` per event; outer clamp is `(-20, 25)` — lower bound must stay negative to allow sleep/recovery events to benefit the score
- School events drain `+2/hr`. Sleep events drain `−5/hr`.
- Optional 6th param `circadianScore: number | null = null` applies a `0.90–1.00` multiplier to the baseline (irregular rhythm → up to 10% penalty). `HealthPage.vue` computes and passes it.
- Shown as hero on `HealthPage.vue` and as tile on `HomePage.vue`.

### Calendar Events

`HealthCalendarPage.vue` supports types: `general`, `workout`, `recovery`, `school`, `sleep`, `reminder`. CSS class: `item-tag--<type>`.

- **Views**: month grid / week (7-day columns w/ event chips) / **day (HomePage-style schedule timeline)** / agenda (next 45 days grouped by date). `viewMode` + `setViewMode`/`goPrev`/`goNext`/`periodLabel` in `usePlanner`. The selected-day detail card renders under month/week/day (not agenda). Day view renders a scrollable hour grid (`dayTlHeight`/`dayVisibleHours`/`dayHourToY`/`dayTimedEvents`/`dayTimedHabits`/`dayAllDayEvents`/`dayNowY` in `usePlanner`, `HOUR_PX=52`) mirroring HomePage's timeline — all-day strip, hour gridlines, now-line, absolutely-positioned event blocks + habit pills. Tapping a block opens the edit form (which has a Delete button, since the day view has no per-row delete); the plain event list only shows under month/week.
- **Recurrence engine** — `src/shared/utils/recurrence.ts` (pure TS, unit-tested in `tests/unit/recurrence.spec.ts`). Types: `none` | `daily` | `weekly` | `weekdays` | `monthly` | `yearly`. Columns: `recur_interval` (every-N, default 1), `recur_days` (weekly: comma weekday digits Sun=0, empty = start weekday), `recur_count` (cap # occurrences), `end_date` (inclusive "until"). Monthly skips short months (no 31st in Feb); yearly skips Feb 29 in non-leap years (RRULE semantics, not clamped). `eventOccursOn(ev, date)`, `expandOccurrencesInMonth`, `expandOccurrencesInRange`, `recurrenceLabel`. DB queries (`getCalendarEventsForDate`, `getCalendarEventDatesForMonth`, `getCalendarEventsInRange`) expand via this engine in JS, NOT strftime.
- **All-day** (`all_day` 0/1) — nulls `time_start`/`time_end`. **Color** (`color` TEXT) — custom hex overrides the type CSS class via inline style (`tagStyle`/`chipStyle`); empty = type color. Palette `EVENT_COLORS` in `usePlanner`.
- **Overnight events (spanning)** — when `time_end <= time_start` (e.g. 19:00→05:00) the end is the next day, and the event is **split into two dated segments**: a `start` segment (start→24:00 on day D) and a `tail` segment (00:00→end on day D+1). Done in `expandEventSegments` in `app_db.ts`; segments carry `seg`/`continues_next_day`/`continued_from_prev_day`/`base_date`. `getCalendarEventsForDate(date, includeOvernightTails=false)` adds tails only when the flag is set (calendar passes `true`; battery/reminder/digest callers use the default so they still see one row on the start day). `getCalendarEventsInRange`/`getCalendarEventDatesForMonth` always split (calendar-only). `eventTimeLabel`/`isOvernight` render `(+1 day)` / `cont. until HH:MM`. `calculateBattery` and HomePage timeline independently roll overnight ends to midnight.
- **Editing**: `beginEditEvent(ev)` populates the shared add-form and switches to edit mode (`editingEventId`); `saveEvent` branches to `updateCalendarEvent` vs `addCalendarEvent`. Editing a recurring occurrence edits the whole series (anchored to `base_date`; no per-occurrence exceptions).
- **Deleting**: `removeEvent(ev)` (takes the row, not just id). Non-recurring → direct delete. Recurring → action sheet: "Delete all occurrences" (`deleteCalendarEvent`) vs "Delete this and future occurrences" (`stopCalendarEventAt(id, selectedDate − 1 day)` to cap the series, preserving past history; deletes the row outright if stopping at/before `base_date`).
- **Search**: `searchCalendarEvents(query)` (title+notes LIKE) → `searchQuery`/`searchResults` in `usePlanner`; results replace the views while the box is non-empty.
- `addCalendarEvent`/`updateCalendarEvent` take a single `CalendarEventInput` object (not positional args). Type allowlist + recurrence allowlist enforced in `calendarEventColumnValues`.
- `getCalendarEventsInRange(start,end)` returns concrete occurrences, each row carrying its occurrence `date` plus the original `base_date`.
- `end_date TEXT`: also set by `stopCalendarEventAt(id, lastDate)` to end a recurring event from a date forward without deleting history.
- New event types must pass the allowlist. New event types need a drain rate in `calculateBattery`. New `calendar_event` columns are auto-handled by export/import (PRAGMA + `SELECT *`), but must be added to the migration block in `initDB`.

### Body Log

- `body_log` table: `id, date, weight_kg, notes, photo_path`
- Photos: `@capacitor/filesystem` in `Directory.Data/body_photos/`, picked via `@capawesome/capacitor-file-picker`
- Route: `/health/body` → `BodyPage.vue`. After logging weight, calls `dismissWeightReminder()`.

### Health Overview Page

`HealthPage.vue` — `<div>` cards only (no `ion-card`). Sections: battery hero (drain breakdown tiles + Train/Study badges), sleep detail (score + 4 metrics + insight), body (resting HR, steps, weight), today's schedule strip, 14-day readiness SVG chart, sync button. `HealthSectionTabs.vue` tabs: **Overview / Sleep / Body / Circadian**.

### Plan Feature Module

`src/features/plan/` — routes `/plan`, `/plan/goals`, `/plan/habits`, `/plan/calendar`. `PlanPage.vue` shows a live "Today" snapshot card (habits done, next event, active goals). `/plan/goals`, `/plan/habits`, `/plan/calendar` reuse Health page components.

**Conditional sub-nav**: `HealthGoalsPage`, `HealthHabitsPage`, `HealthCalendarPage` render `PlanSectionTabs` under `/plan/*`, `HealthSectionTabs` otherwise — detected via `route.path.startsWith('/plan')`.

**Tab order** in `DashboardTopBar.vue`: Home / Finance / Health / Plan / Gym. Active-tab check tests `/plan` before `/health`.

### Sleep Hypnogram

`SleepPage.vue` — single SVG hypnogram. Fixed vertical bands (top→bottom): Awake (yellow), REM (teal), Light (blue), Deep (dark blue). Connector lines between stage transitions. Right-side labels: Aw/RE/Li/De. Stage name aliases handle Health Connect variants (`sleeping`, `out_of_bed`, `unknown`). `wakeHour` clamped to `[4, 13]` to guard UTC offset errors.

### Circadian Rhythm Module

`src/shared/health/circadian.ts` — pure TS computation, no DB or Vue:
- `computeCircadianProfile(sessions, dayTypes)` — MSFsc chronotype, DLMO/CTmin estimates, sleep consistency, social jetlag. Needs ≥3 sessions; free-day flag needed for accurate MSFsc.
- `computeCircadianScore(sessions, rhrToday, rhrBaseline)` — 0–100: consistency 35%, amplitude 25%, efficiency 25%, recovery 15%
- `computeAlertnessCurve(profile, wakeHour)` — two-process model. Process C = `0.5 - 0.5*cos(phaseAngle)`, minimum at CTmin, maximum at CTmin+12h. Process S = exponential buildup/decay.
- `computeCircadianWindows(profile, wakeHour)` — timing windows **anchored to wake time** (not CTmin — too noisy): morning exercise = wake+0.5h→wake+2.5h, afternoon = wake+6h→wake+9h, cognitive peak = CTmin+2h→CTmin+8h.
- `computeCircadianRecommendations(...)` — text nudges

**Guard**: `computeAlertnessCurve` and `computeCircadianWindows` clamp `wakeHour` to `[4, 13]`.

**DB**: `circadian_log` table — `id, date, day_type, energy_wake, energy_noon, energy_evening, meal_first, meal_last, morning_light, notes`. Functions: `upsertCircadianLog`, `getCircadianLog(date)`, `getRecentCircadianLogs(days)`. In all 4 export/import lists.

**Route**: `/health/circadian` → `CircadianPage.vue`. "Circadian" tab in `HealthSectionTabs.vue`.

**Notifications**: `scheduleCircadianNudges(morning, noon, cogPeakLabel)` in `notifications.ts` — IDs 8 (morning) and 9 (noon).

**HomePage integration**: alertness curve SVG card with zone bands + contextual daily log widget (shows different fields by time of day: morning = day type + morning light + wake energy; noon = noon energy; evening = evening energy). Auto-saves on tap.

**CircadianPage layout (redesigned 2026-06-13)**: Alertness curve + schedule merged into one horizontally-scrollable card. SVG uses `HOUR_PX = 52` (52px/hour, 1248px total). Y-axis labels (High/Mid/Low) pinned left outside the scroll container. Three rows inside the scrollable area: (1) SVG curve with sleep/exercise/focus bands and now-line; (2) activity blocks row (absolutely positioned `tl-block` divs); (3) event pins row (Last meal, Dim screens at DLMO, Bedtime). A single white vertical `now-line` runs through all rows at `currentHour * HOUR_PX`. Auto-scrolls to `(currentHour - 2) * HOUR_PX` on load. Score card uses horizontal mini-bars per component instead of tile grid. Recommendations card shows `socialJetlagWarning` when present.

### Health Connect Known Issues
- **READ_EXERCISE SecurityException**: `@capgo/capacitor-health` declares `READ_EXERCISE` and reads `ExerciseSessionRecord` internally. After any HC permission reset, this permission may not be granted, causing a native SecurityException that kills the process. The app does not use exercise data but cannot prevent the plugin read. **Workaround**: user must manually grant Exercise permission in HC settings. A proper fix requires forking the plugin.

### Rest Timer (WorkoutPage)

Completing a set starts the rest timer in `WorkoutPage.vue`. Designed to survive a full app close and to ding audibly even when the app is backgrounded/killed:
- **Canonical state is `endTime`** (wall-clock ms), stored in `localStorage` under `restTimer`. Not `sessionStorage` (wiped on process kill). The JS `setInterval` is display-only; `tickRestTimer` derives `remaining` from `endTime` each second, so a throttled background tab stays correct.
- **Ding when closed**: `scheduleRestTimerDing(endTime)` (`notifications.ts`, ID 20) arms an OS local notification at the end time on `startRestTimer`/`adjustRestTimer`. Cancelled on skip/stop/end via `cancelRestTimerDing()`.
- **Ding when alive (duck-then-ding)**: if the app is foreground at end, `tickRestTimer` calls `duckAndDing()` (`src/shared/utils/restTimerAudio.ts` → native `RestTimerAudio` plugin) which requests transient `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK` so other audio (music) ducks while a `ToneGenerator` ding plays, then restores it. It also cancels the pending notification to avoid a double ding. Web/dev falls back to the Web Audio `playBeep`.
- **Live countdown notification**: `showRestNotification(exerciseName, durationMs)` (native plugin) posts an ongoing notification with a system **chronometer** counting down (no per-second JS) and the current exercise name as the body. `setTimeoutAfter` self-clears it at zero even if the app was killed. (Re)posted on start/adjust/resume; cleared via `clearRestNotification()` inside `clearTimerState`. `exerciseName` is persisted in localStorage so the text survives a restore.
- **Native plugin**: `android/app/src/main/java/io/ionic/starter/RestTimerAudio.java` (methods `duckAndDing`, `showRestNotification`, `clearRestNotification`; channel `rest_timer`, notification ID 21), registered in `MainActivity.onCreate` via `registerPlugin`. Small icon resolved by name (`ic_stat_icon_config_sample`, merged from LocalNotifications) with `android.R.drawable.ic_lock_idle_alarm` fallback. After any change, `npm run build` → `npx cap sync` → rebuild APK.
- `restoreTimerState` (on view enter) resumes a running timer without re-dinging; an already-expired timer just clears (the notification already fired while closed).

## Key Conventions

- `<script setup lang="ts">` for all components; no `reactive()` unless complex state demands it
- Import types with `import type { ... }`; use `@/` path alias for all imports
- Scoped styles in feature pages to prevent leakage
- `no-console` / `no-debugger` warnings in dev, errors in prod
- **Chart.js**: destroy in `onUnmounted`, `flush: 'post'` in chart-render watches. **All chart styling comes from `src/shared/utils/chartStyle.ts`** — spread `chartLineDataset` (red primary series), `chartDimDataset` (dim dashed secondary: forecasts, goal lines), `chartTooltip`, `chartTicks`, `chartGrid` into configs instead of literals. CSS vars don't resolve in canvas, which is why the module holds raw rgb values. `animation: false`, `maintainAspectRatio: false` (give the canvas wrapper a fixed height). SVG charts match: red `rgb(215, 26, 33)` line, `rgba(215, 26, 33, 0.15)` area, `rgba(255,255,255,0.4)` axis labels, dim white dashed now/forecast lines.
- **Build + sync order**: `npm run build` THEN `npx cap sync` before APK rebuild.
- **No raw unicode checkmarks/crosses** — use `ion-icon` instead of `✓`, `×`, `✕`.
- **No emojis** anywhere in the UI.
- **Progressive overload**: `overloadHint(ex)` in `WorkoutPage.vue` — 2.5% increase, rounded to nearest 2.5 kg, display-only.
- **Workout summary modal**: `WorkoutSummaryModal.vue` is shown via `modalController` after `saveWorkout()`. Receives `{ duration, totalVolume, exerciseCount, setCount, prs: AchievedPR[] }`. PR badge: `is_new=true` → solid red "NEW"; `is_new=false` → outline red "PR+". `WorkoutPage` calls `await modal.onWillDismiss()` before navigating home so the user sees the card.
- **Bodyweight pre-fill**: `loadWorkout` in `WorkoutPage.vue` calls `getLatestBodyWeight()` and pre-fills set `weight`/`previous_weight` for exercises whose equipment is `bodyweight`.
- **ExercisePicker caller routing**: `ExercisePickerPage` uses `route.query.from` to determine return path. `from=TemplateBuilder` → stores selection in `localStorage('selectedExerciseForTemplate')` and pushes back to `TemplateBuilder`. Callers must clear the key after reading. No global store involved.
- **Weekly digest**: `getWeeklyDigest()` exists in `app_db.ts` but UI was removed (broken). Do not re-add without verifying.
- **Haptics**: `src/shared/utils/haptics.ts` — `hapticLight/Medium/Heavy/Success/Warning/Error/Select`. All no-ops on web. Wire into all interactive elements. Light = navigation/toggles, Medium = save/submit, Heavy = start workout/delete, Success = after successful save, Select = picker/option select.
- **Section tabs**: all three section tab bars (`HealthSectionTabs`, `PlanSectionTabs`, `FinanceSectionTabs`) wrap `<ion-segment>` in a `<div class="seg-pill">` with `overflow: hidden; border-radius: 999px` — do NOT put border-radius directly on `ion-segment` (shadow DOM doesn't clip). Set `--background: transparent` on the segment AND on the `.section-toolbar` (a grey toolbar background reads as a full-width bar behind the pill).

## Design System — Nothing OS aesthetic

**ALWAYS follow these rules.** Do not invent new patterns — extend existing ones. The system is a Nothing-OS-inspired language: near-monochrome surfaces, ONE red accent used as a signal (not decoration), dot-matrix display type for numerics only, borderless cards (surfaces separate by background contrast), mechanical motion. All tokens live in `src/theme/variables.css` as `--nt-*` custom properties — **use tokens, never raw hex**, except in Chart.js configs where CSS vars don't resolve.

### Colors
- Page background: `var(--nt-bg)` (`#0A0A0A`, near-black). Cards: `var(--nt-surface)` (`#1A1A1A` — grey, not black) via `var(--ion-color-primary)`. Elevated/pressed: `var(--nt-surface-2)` (`#242424`).
- **Nothing red** `#D71A21` / `rgb(215, 26, 33)` — `var(--nt-accent)` = `var(--ion-color-accent-red)`. The ONLY accent. Used as a *signal*: live/recording states (rest timer, active workout), destructive actions, active tab, key highlights. Pressed shade: `var(--nt-accent-press)` (`#B21319` / `rgb(178, 19, 25)`).
- **No yellow in UI chrome.** Live/active states are red (Glyph logic: red LED = recording). Gold `#FFD700` (`var(--nt-data-goal)`) survives ONLY as a data-encoding color: calendar goal dots, planner goal tags, BodyPage goal line, hypnogram Awake band.
- Success green `rgb(34, 197, 94)` (`var(--nt-data-positive)`) — data semantics only (scores, positive deltas), never buttons/chrome.
- Labels: `var(--nt-text-dim)` (`rgba(255,255,255,0.5)`), values: `rgba(255,255,255,0.85)`–`#fff`
- Borders: **cards and tiles are borderless** — never add hairline borders to surface containers. `var(--nt-border)` (`rgba(255,255,255,0.08)`) / `var(--nt-border-strong)` (`0.12`) survive only on inputs, outline buttons, and chips. Colored borders (red live/destructive, gold goal-due, green positive) remain as signals.
- Monochrome glow, never colored neon: active emphasis uses `.nt-glow-active` (white `box-shadow` bloom, `var(--nt-glow)`).

### Typography
- Body/UI text: `Inter` (`var(--nt-font-body)`, default via `--ion-font-family`)
- Headings, labels, kickers, buttons, chips: `Space Grotesk` (`var(--nt-font-head)`), usually UPPERCASE with `letter-spacing: var(--nt-tracking-label)` (0.12em)
- **Dot-matrix face `Doto` (`var(--nt-font-display)`) is seasoning, not body**: big numerics, timers, metric readouts, clock-like displays ONLY. Never body or long text.
- Tabular/mono numerics: `Space Mono` (`var(--nt-font-mono)`)
- `.section-kicker`: `0.72rem`, uppercase, `letter-spacing: 0.18em`, `var(--nt-text-dim)` — never accent-colored
- Metric label: `0.75rem`, uppercase, `letter-spacing: 0.1em+`, `var(--nt-text-dim)`
- Metric value: `0.95rem–1rem`, `#fff`, `font-weight: 600`; hero metrics in `Doto`
- Timer/live value: `Doto`, **red** (`var(--ion-color-accent-red)`)
- Fonts are self-hosted SIL OFL 1.1 via `@fontsource/*` imports in `main.ts` + local `Doto` TTF. Never ship Nothing's proprietary NDot/NType fonts.

### Cards & Tiles
- Card: `background: var(--ion-color-primary)`, **no border**, `border-radius: var(--nt-radius-md)` (16px), `padding: 18px`, no box-shadow. Hover/pressed surface: `var(--nt-surface-2)`.
- Metric tile: `background: rgba(255,255,255,0.05)`, `border-radius: 10px`, `padding: 12px 14px`, no border
- Selected/live card: red hairline (`border-color: var(--ion-color-accent-red)` or rgba thereof) — when a card needs a state border, give the base `border: 1px solid transparent` so layout doesn't shift
- Gap between cards: `16px`, between tiles: `10–12px`
- Status chips: use `.nt-chip` (pill, hairline, uppercase micro-label) + `.nt-chip__dot` (red dot = live/alert)
- Optional dot-grid substrate behind hero sections: `.nt-dotgrid`

### Spacing / Radius / Motion tokens
- Spacing on an 8px base: `--nt-space-1..6` (4/8/12/16/24/32)
- Radius: `--nt-radius-sm` 8px (chips, inputs), `--nt-radius-md` 16px (cards, buttons), `--nt-radius-lg` 24px (sheets, modals), `--nt-radius-pill` 999px (pills, toggles)
- Motion: micro `var(--nt-dur-micro)` (140ms) + `var(--nt-ease-decel)`; standard `var(--nt-dur-std)` (280ms) + `var(--nt-ease-std)`. Dot/LED animations use `steps()` for a mechanical scanning feel (`.nt-loading-dot`).

### Inputs / Buttons
- Input: `background: rgba(255,255,255,0.06)`, `border: 1px solid rgba(255,255,255,0.1)`, `border-radius: var(--nt-radius-sm)`, `color: #fff`
- Time/date inputs: `color-scheme: dark`
- Primary button: `background: rgb(215, 26, 33)`, `border-radius: 8px`, no border. Red is for the page's key/destructive action — secondary actions use hairline-outline transparent buttons (`.button-yellow` is now this secondary style; `.button-white` = high-contrast solid).
- Pressed state: `opacity: 0.7` or `var(--nt-surface-2)`

### Responsive
- Max content width: `760px` centered
- Breakpoints: `600px` (side-by-side within cards), `760px` (grid column changes)

## graphify

Knowledge graph at `graphify-out/`.

**MANDATORY — run before any grep or source browsing:**
- `graphify query "<question>"` — broad context, nearest neighbors first
- `graphify path "<A>" "<B>"` — trace relationships between files/symbols
- `graphify explain "<concept>"` — full explanation of a concept across the codebase
- `graphify-out/GRAPH_REPORT.md` — only for broad architecture review when query/explain are insufficient
- **After modifying code**: `graphify update .` to keep the graph current (AST-only, no API cost).
