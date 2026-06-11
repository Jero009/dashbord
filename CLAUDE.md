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

Pages call exported functions from `src/shared/db/app_db.ts` directly. No global state store — state lives in `ref`/`computed` local to each page. Rest timer state uses `sessionStorage`.

### DB Conventions

- All DB access goes through `app_db.ts`; function names follow `upsert*`, `replace*`, `delete*`, `query*`, `get*`
- Booleans stored as `0`/`1`
- SQLite unavailable on web — DB calls must tolerate empty/null results
- **New DB tables**: Add to `EXPORT_DELETE_TABLES`, `EXPORT_INSERT_TABLES`, `deleteOrder`, and `insertOrder` in `importDatabaseFromSQL` — all four lists.
- **Nullable unique columns**: Never `WHERE col = NULL`. Use `(col = ? OR (col IS NULL AND ? IS NULL))` in any upsert on a nullable unique column.

### Health Connect

- Syncs steps, sleep, heart rate, respiratory rate via `@capgo/capacitor-health`
- `HealthConnectAutoSync.vue` — initial sync on mount + 6 s retry for cold-start race condition
- **Core vs optional permissions**: only `HEALTH_CONNECT_CORE_READ_TYPES` (steps, sleep, restingHeartRate, heartRate, respiratoryRate) gate sync — checked via `hasCoreReadAccess()`. `'workouts'` (→ `READ_EXERCISE`) is requested but OPTIONAL; it only feeds activity-drain (`getRecentActivities`, which degrades to `[]`). Never re-add workouts to the core gate — the Amazfit produces no exercise sessions, so requiring it silently blocked all sync.
- `canAutoSyncHealthConnectMetrics` is wrapped in try/catch → returns `false` on any native rejection (never propagates to crash startup).
- Readiness score inputs: sleep hours, sleep efficiency, sleep score, resting HR, sleep HR, respiratory rate, steps
- Sleep score (`calculateSleepScore` in `healthConnect.ts`) — 100-pt model: duration vs target (25), efficiency (15), WASO (10), deep% ≥18% (10), REM% ≥22% (12.5), bedtime timing variance vs 14-night mean (15), respiratory rate vs 14-night baseline (12.5). Returns `number | null` — null when `timeAsleepHours < 1`.
- User device: Amazfit Active 2 via Zepp Health → Health Connect. Provides sleep stages, HR, steps, respiratory rate. No HRV without device upgrade.
- **`toDateKey` uses local date**: extracts `YYYY-MM-DD` using `getFullYear/getMonth/getDate` (NOT `.toISOString().slice(0,10)`). UTC slice was off-by-one for UTC+ timezones.
- **Steps sync**: separate query window (7 days, 5000-record limit, `ascending: false`) so today's steps are always in the result set.

### Battery Score

`calculateBattery(baseline, now, workouts, activities, events, circadianScore?)` in `healthConnect.ts`:
- Drains: time (gradual), workout (gym log), activity (HC activities — only when no gym workout today), events (calendar)
- `eventDrain` inner clamp is `(-5, 15)` per event; outer clamp is `(-20, 25)` — lower bound must stay negative to allow sleep/recovery events to benefit the score
- School events drain `+2/hr`. Sleep events drain `−5/hr`.
- Optional 6th param `circadianScore: number | null = null` applies a `0.90–1.00` multiplier to the baseline (irregular rhythm → up to 10% penalty). `HealthPage.vue` computes and passes it.
- Shown as hero on `HealthPage.vue` and as tile on `HomePage.vue`.

### Calendar Events

`HealthCalendarPage.vue` supports types: `general`, `workout`, `recovery`, `school`, `sleep`, `reminder`. CSS class: `item-tag--<type>`.

- `recurrence`: `none` | `daily` | `weekly`. Queries use `strftime('%w', date)` for weekly matching.
- `end_date TEXT` column: set by `stopCalendarEventAt(id, lastDate)` to end a recurring event from a date forward without deleting history. `getCalendarEventsForDate` filters `end_date IS NULL OR end_date >= ?`.
- New event types must pass the allowlist in `addCalendarEvent`. New event types need a drain rate in `calculateBattery`.

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

### Backup / Restore

Local SQL export/import only, via `SettingsPage.vue` (`exportDatabaseToSQL`/`importDatabaseFromSQL`). Google Drive auto-backup was removed — the `@codetrix-studio/capacitor-google-auth` plugin threw uncatchable native exceptions on startup when Play Services auth state was corrupted. Do not re-add cloud backup without an auth flow that can't crash the boot path.

### Health Connect Known Issues
- **READ_EXERCISE (resolved)**: previously, requiring the workouts/`READ_EXERCISE` grant gated all sync and an ungranted state could surface a native crash. Fixed two ways: (1) workouts decoupled from the core sync gate (see Health Connect section); (2) the plugin's `checkAuthorization`/`requestAuthorization`/`handlePermissionResult` coroutines are patched via **patch-package** (`patches/@capgo+capacitor-health+8.6.0.patch`) to wrap `getGrantedPermissions()`/`authorizationStatus()` in try/catch so a thrown exception rejects the JS promise instead of killing the process. The patch reapplies on `npm install` via the `postinstall` script; Android Studio compiles the patched Kotlin from `node_modules`.
- **patch-package**: native plugin patches live in `patches/`. After editing a file under `node_modules/<pkg>`, run `npx patch-package <pkg>` to regenerate the patch, then `npx cap sync`.

## Key Conventions

- `<script setup lang="ts">` for all components; no `reactive()` unless complex state demands it
- Import types with `import type { ... }`; use `@/` path alias for all imports
- Scoped styles in feature pages to prevent leakage
- `no-console` / `no-debugger` warnings in dev, errors in prod
- **Chart.js**: destroy in `onUnmounted`, `flush: 'post'` in chart-render watches. Style: `rgb(239,68,68)` line, `rgba(255,255,255,0.4)` ticks, `rgba(255,255,255,0.1)` grid, `animation: false`.
- **Build + sync order**: `npm run build` THEN `npx cap sync` before APK rebuild.
- **No raw unicode checkmarks/crosses** — use `ion-icon` instead of `✓`, `×`, `✕`.
- **No emojis** anywhere in the UI.
- **Progressive overload**: `overloadHint(ex)` in `WorkoutPage.vue` — 2.5% increase, rounded to nearest 2.5 kg, display-only.
- **Weekly digest**: `getWeeklyDigest()` exists in `app_db.ts` but UI was removed (broken). Do not re-add without verifying.
- **Haptics**: `src/shared/utils/haptics.ts` — `hapticLight/Medium/Heavy/Success/Warning/Error/Select`. All no-ops on web. Wire into all interactive elements. Light = navigation/toggles, Medium = save/submit, Heavy = start workout/delete, Success = after successful save, Select = picker/option select.
- **Section tabs**: all three section tab bars (`HealthSectionTabs`, `PlanSectionTabs`, `FinanceSectionTabs`) wrap `<ion-segment>` in a `<div class="seg-pill">` with `overflow: hidden; border-radius: 999px` — do NOT put border-radius directly on `ion-segment` (shadow DOM doesn't clip). Set `--background: transparent` on the segment.

## Design System

**ALWAYS follow these rules.** Do not invent new patterns — extend existing ones.

### Colors
- Background: `#000` (page), `var(--ion-color-primary)` (cards)
- Accent red: `rgb(239, 68, 68)` / `var(--ion-color-accent-red)` — primary interactive color
- Accent yellow: `rgb(255, 215, 0)` — active/live states only
- Success green: `rgb(34, 197, 94)` — positive states
- Labels: `rgba(255,255,255,0.5)`, values: `rgba(255,255,255,0.85)`
- Borders: `rgba(255,255,255,0.08)` standard, `rgba(255,255,255,0.12)` hover

### Cards & Tiles
- Card: `background: var(--ion-color-primary)`, `border-radius: 12px`, `padding: 18px`, no box-shadow
- Metric tile: `background: rgba(255,255,255,0.05)`, `border-radius: 10px`, `padding: 12px 14px`
- Gap between cards: `16px`, between tiles: `10–12px`

### Typography
- `.section-kicker`: `0.72rem`, uppercase, `letter-spacing: 0.18em`, `rgba(255,255,255,0.5)`
- Metric label: `0.75rem`, uppercase, `letter-spacing: 0.1em`, `rgba(255,255,255,0.5)`
- Metric value: `0.95rem–1rem`, `#fff`, `font-weight: 600`
- Timer/live value: `Doto` monospace, yellow

### Inputs / Buttons
- Input: `background: rgba(255,255,255,0.06)`, `border: 1px solid rgba(255,255,255,0.1)`, `border-radius: 8px`, `color: #fff`
- Time/date inputs: `color-scheme: dark`
- Primary button: `background: rgb(239,68,68)`, `border-radius: 8px`, no border

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
