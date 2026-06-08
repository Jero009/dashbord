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

`src/features/` holds isolated feature modules: **gym**, **health**, **finance**, **home**, **plan**. Each follows:

```
features/[name]/
├── routes.ts       # Vue Router config for this feature
├── pages/          # Route-level components
└── components/     # Components scoped to this feature
```

Routes are lazy-loaded and merged in `src/router/index.ts`.

### Shared Layer

`src/shared/` for cross-feature concerns:
- `db/app_db.ts` — single SQLite instance, all DB functions exported from here
- `health/` — Health Connect sync (`HealthConnectAutoSync.vue` is mounted in `App.vue` and runs on startup)
- `utils/` — formatting, type conversions
- `components/` — global UI components

### Data Flow

Pages call exported functions directly from `src/shared/db/app_db.ts` (e.g., `upsertReadinessScore()`, `replaceHealthMetric()`). No global state store — state lives in Vue `ref`/`computed` local to each page. Rest timer state uses `sessionStorage`.

### DB Conventions

- All DB access goes through `app_db.ts`; function names follow `upsert*`, `replace*`, `delete*`, `query*`, `get*`
- Booleans stored as `0`/`1`
- SQLite unavailable on web — DB calls must tolerate empty/null results

### Health Connect

- Syncs steps, sleep, heart rate, respiratory rate via `@capgo/capacitor-health`
- Check availability before calling — not present on all Android devices
- `HealthConnectAutoSync.vue` does an initial sync on mount, then retries after 6 s to recover from cold-start race conditions where HC isn't ready yet
- Readiness score is derived from sleep hours, sleep efficiency, sleep score, resting HR, sleep HR, respiratory rate, and steps
- Sleep score (`calculateSleepScore` in `healthConnect.ts`) is a 100-pt model: duration vs user target (25), efficiency (15), WASO/wake-after-sleep-onset (10), deep% at ≥18% target (10), REM% at ≥22% target (12.5), bedtime timing variance vs 14-night rolling mean (15), respiratory rate vs 14-night personal baseline (12.5). WASO sourced from `stageSummaries['awake']` minutes — no extra HC permissions. Rolling baselines require ≥3 prior nights and update after scoring so the current night doesn't influence its own result.
- User device: Amazfit Active 2 via Zepp Health → Health Connect. Provides sleep stages, HR, steps, respiratory rate. No HRV without device upgrade.

### Calendar Event Types, Recurrence & Battery Impact

`HealthCalendarPage.vue` supports event types: `general`, `workout`, `recovery`, `school`, `sleep`, `reminder`. Each type has a CSS tag color class (`item-tag--<type>`). `calculateBattery()` in `healthConnect.ts` applies `drainPerHour` per event: school=+2/hr (reduced from 5), sleep=−5/hr (others defined separately).

Calendar events have an `end_date` column for multi-day events. Smart delete: when deleting a recurring event, user is prompted to delete only that occurrence or all future occurrences.

Calendar events support a `recurrence` column: `none` | `daily` | `weekly`. `getCalendarEventsForDate` uses `strftime('%w', date)` matching for weekly recurrence. `getCalendarEventDatesForMonth` expands recurring events into month dot indicators. Any new event type must have a validated recurrence value (checked against allowlist in `addCalendarEvent`).

### Body Log Feature

- `body_log` table in `app_db.ts`: `id`, `date`, `weight_kg`, `notes`, `photo_path`
- DB functions: `insertBodyLog`, `getBodyLogs` (DESC order), `deleteBodyLog`, `BodyLogEntry` interface
- Photos stored via `@capacitor/filesystem` in `Directory.Data/body_photos/`; picked via `@capawesome/capacitor-file-picker`
- Route: `/health/body` → `BodyPage.vue`; "Body" tab added to `HealthSectionTabs.vue`
- `body_log` is included in both `EXPORT_DELETE_TABLES` and `EXPORT_INSERT_TABLES`; must remain in both if schema changes
- After a successful weight log for today, `BodyPage.vue` calls `dismissWeightReminder()` from `src/shared/utils/notifications.ts`

### Health Overview Page

`HealthPage.vue` uses plain `<div>` cards only (no `ion-card`). Sections: **battery hero** (full `calculateBattery()` score + color-coded bar + 3 mini tiles; loads `todayWorkouts` + `todayEvents` via `loadTodayContext`), sleep detail (5 metrics + insight line), body card (HR, resp rate, weight), activities list, 14-day readiness history SVG chart, compact sync button. DB function: `queryReadinessHistory(days)` in `app_db.ts`.

Health tab (`HealthSectionTabs.vue`) now shows: Overview / Sleep / Body / Circadian. Goals, Habits, and Calendar moved to the Plan tab.

### Plan Feature Module

`src/features/plan/` — routes: `/plan`, `/plan/goals`, `/plan/habits`, `/plan/calendar`. `PlanPage.vue` is the landing page with nav tiles. `PlanSectionTabs.vue` is the sub-nav (Overview/Goals/Habits/Calendar). `/plan/goals`, `/plan/habits`, `/plan/calendar` reuse the existing Health page components (`HealthGoalsPage`, `HealthHabitsPage`, `HealthCalendarPage`).

**Conditional sub-nav pattern**: `HealthGoalsPage`, `HealthHabitsPage`, and `HealthCalendarPage` each render `PlanSectionTabs` when served under `/plan/*`, and `HealthSectionTabs` otherwise — detected via `useRoute().path.startsWith('/plan')`.

**Tab order** in `DashboardTopBar.vue`: Home / Finance / Health / Plan / Gym (Gym is last; `scrollable` enabled). Active-tab check tests `/plan` before `/health` so `/plan/*` paths correctly highlight Plan.

### Sleep Hypnogram

`SleepPage.vue` uses a single SVG hypnogram (replaces old per-stage swimlane rows). Stages occupy fixed vertical bands top-to-bottom: Awake (yellow), REM (teal), Light (medium blue), Deep (dark blue). Vertical connector lines link transitions. Right-side labels: Aw/RE/Li/De. Removed computeds: `sleepStageLanes`, `stageClass`, `stageStyle`.

### Circadian Rhythm Module

`src/shared/health/circadian.ts` — pure computation engine (no DB, no Vue):
- `computeCircadianProfile(sessions, dayTypes)` — MSFsc chronotype, DLMO/CTmin estimates, sleep consistency, social jetlag
- `computeCircadianScore(sessions, rhrToday, rhrBaseline)` — 100-pt health score: consistency (35%), amplitude/RA (25%), efficiency (25%), recovery (15%)
- `computeAlertnessCurve(profile, wakeHour)` — two-process model (Borbély): Process C = `0.5 - 0.5*cos(phaseAngle)`, minimum at CTmin, maximum at CTmin+12h; Process S = exponential wake buildup / sleep decay
- `computeCircadianWindows(profile, wakeHour)` — timing windows: cognitive peak (CTmin+2 → CTmin+8), exercise morning (wake+0.5 → wake+2.5), exercise afternoon (wake+6 → wake+9), last meal, bedtime target. Windows are **wake-anchored**, not CTmin-anchored (CTmin too noisy for scheduling)
- `computeCircadianRecommendations(profile, windows, socialJetlag, workoutTimes)` — text nudges

**Guard**: both `computeAlertnessCurve` and `computeCircadianWindows` clamp `wakeHour` to `[4, 13]` — protects against UTC offset errors from HC timestamps producing nonsense wake times (1–3am).

**DB**: `circadian_log` table in `app_db.ts` (columns: `id, date, day_type, morning_light, wake_energy, noon_energy, evening_energy, notes`). Functions: `upsertCircadianLog`, `getCircadianLog(date)`, `getRecentCircadianLogs(days)`. Included in `EXPORT_DELETE_TABLES`, `EXPORT_INSERT_TABLES`, `deleteOrder`, `insertOrder`.

**Route**: `/health/circadian` → `CircadianPage.vue`. "Circadian" tab in `HealthSectionTabs.vue`.

**Battery integration**: `calculateBattery()` accepts optional 6th param `circadianScore: number | null = null`. When provided, applies a `0.90–1.00` multiplier to the base score (low circadian score = 10% reduction). `HealthPage.vue` computes and passes it.

**Notifications**: `scheduleCircadianNudges(morning, noon, cogPeakLabel)` in `notifications.ts` schedules IDs 8 (morning light) and 9 (cognitive peak).

### Google Drive Backup

`src/shared/utils/driveBackup.ts` — daily DB export to Google Drive via `@codetrix-studio/capacitor-google-auth`. Triggered on app start from `HealthConnectAutoSync.vue` and manually from `SettingsPage.vue`. Requires external Google Cloud setup (Drive API + OAuth client ID + SHA-1 fingerprint) before the code has any effect.

## Key Conventions

- `<script setup lang="ts">` for all components; no `reactive()` unless complex state demands it
- Import types with `import type { ... }`
- Use `@/` path alias for all imports (maps to `src/`)
- Use scoped styles in feature flow pages to prevent leakage
- `no-console` / `no-debugger` are warnings in dev, errors in production builds
- **Chart.js**: Always destroy chart instance in `onUnmounted`. Use `flush: 'post'` in `watch` callbacks that re-render charts. Unified style: `rgb(239,68,68)` line, `rgba(255,255,255,0.4)` ticks, `rgba(255,255,255,0.1)` grid, `animation: false`, dark tooltip.
- **DB nullable unique columns**: Never use `WHERE col = NULL`. Use `(col = ? OR (col IS NULL AND ? IS NULL))` pattern in `replaceHealthMetric` and any similar upsert.
- **New DB tables**: Always add to both `EXPORT_DELETE_TABLES` and `EXPORT_INSERT_TABLES` immediately.
- **Build + sync order**: `npm run build` THEN `npx cap sync` before any APK rebuild. Skipping build causes stale `dist/` to be synced.
- **Progressive overload hint**: `overloadHint(ex)` in `WorkoutPage.vue` — 2.5% weight increase rounded to nearest 2.5 kg, display-only.
- **Weekly digest**: `getWeeklyDigest()` in `app_db.ts` exists but its UI card was removed from `HomePage.vue` (broken). Do not re-add without verifying the function.
- **Battery score**: `calculateBattery()` in `healthConnect.ts` — shown as a tile on `HomePage.vue` (scores-row alongside Sleep Score) and as the hero on `HealthPage.vue`. `eventDrain` clamp lower bound is `-20` (not 0) — must stay negative to allow recovery/sleep events to benefit the score. Signature: `calculateBattery(workouts, events, sleep, hr, steps, circadianScore?)`.
- **Workout double-drain bug (fixed)**: `calculateBattery` previously drained for both workout events in the calendar AND the same workouts in the gym log. Fixed by only draining calendar events; gym-log workouts are NOT double-counted.
- **`toDateKey` uses local date**: `toDateKey(date)` extracts `YYYY-MM-DD` using `getFullYear/getMonth/getDate` (not `.toISOString().slice(0,10)`). Critical for steps sync — UTC slice was off-by-one for timezones ahead of UTC.
- **Steps sync query**: Uses a separate query window (7 days, 5000-record limit, `ascending: false`) so today's steps are always in range regardless of offset.
- **Haptics utility**: `src/shared/utils/haptics.ts` — `hapticLight`, `hapticMedium`, `hapticHeavy`, `hapticSuccess`, `hapticWarning`, `hapticError`, `hapticSelect`. All no-ops on web. Wire into interactive elements (buttons, tab taps, form submits) for native feel.
- **No raw unicode checkmarks/crosses in templates** — use ionicons (`ion-icon`) instead of `✓`, `×`, `✕`.
- **New DB tables**: Always add to both `EXPORT_DELETE_TABLES` and `EXPORT_INSERT_TABLES` AND to `deleteOrder`/`insertOrder` in `importDatabaseFromSQL`.
- **Plan page live snapshot**: `PlanPage.vue` shows a "Today" card with live habit completion count, next upcoming event, and active goal count — loaded from DB on mount.
- **Health overview additions**: Battery hero now shows drain breakdown tiles (workout drain, event drain, bonus). Sleep score tile has a colored left border indicating score level. Today's schedule strip shows upcoming events inline.

## Design System

**ALWAYS follow these rules when writing or editing any component.** Do not invent new patterns — extend existing ones.

### No emojis
Never use emoji characters anywhere in the UI — not in templates, not in labels, not as icon substitutes. Use text initials, abbreviations, or ionicons instead.

### Colors
- Background: `#000` (page), `var(--ion-color-primary)` (cards)
- Accent red: `rgb(239, 68, 68)` / `var(--ion-color-accent-red)` — primary interactive color
- Accent yellow: `rgb(255, 215, 0)` / `var(--ion-color-accent-yellow)` — active/live states only
- Success green: `rgb(34, 197, 94)` — positive states (ready, done)
- Subtle text: `rgba(255,255,255,0.5)` for labels, `rgba(255,255,255,0.85)` for values
- Borders: `rgba(255,255,255,0.08)` standard, `rgba(255,255,255,0.12)` hover

### Cards
- Background: `var(--ion-color-primary)` — never use `rgba(255,255,255,0.04)` for primary cards
- Border radius: `12px` for cards, `10px` for inner tiles, `8px` for inputs/buttons
- Padding: `18px` inside cards, `14px` inside metric tiles
- Gap between cards: `16px`, gap between tiles: `10–12px`
- No box-shadow on cards

### Typography / Labels
- Section label (above card title): `.section-kicker` — `0.72rem`, uppercase, `letter-spacing: 0.18em`, `rgba(255,255,255,0.5)`
- Date / secondary info: `.card-date` — `0.72rem`, `rgba(255,255,255,0.4)`
- Metric label: `0.75rem`, uppercase, `letter-spacing: 0.1em`, `rgba(255,255,255,0.5)`
- Metric value: `0.95rem–1rem`, `#fff`, `font-weight: 600`
- Timer / live value: `Doto` monospace font, yellow color

### Metric Tiles
```css
.card-metric {
  border-radius: 10px;
  padding: 12px 14px;
  background: rgba(255,255,255,0.05);
}
```
Grid: `repeat(2, 1fr)` default, `repeat(4, 1fr)` for workout stats on wide screens.

### Inputs / Forms
- Input: `background: rgba(255,255,255,0.06)`, `border: 1px solid rgba(255,255,255,0.1)`, `border-radius: 8px`, `color: #fff`
- Time inputs: add `color-scheme: dark`
- Primary button: `background: rgb(239,68,68)`, `border-radius: 8px`, no border

### Active / Live Cards
- Active workout card: `border: 2px solid rgba(255,215,0,0.35)`, gradient background, yellow timer in Doto font

### Habit / Checkbox Pattern
```css
/* 22–28px square, border-radius 6–8px */
/* Unchecked: border: 1.5px solid rgba(255,255,255,0.2) */
/* Checked: background + border-color: rgb(239,68,68) */
```

### Responsive
- Max content width: `760px` centered with `margin: 0 auto`
- Breakpoint: `600px` for side-by-side layouts within cards
- Breakpoint: `760px` for grid column changes

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

**MANDATORY rules — follow before any search or grep:**
- For ANY question about where something is defined, what a file exports, or how two files relate: run `graphify query "<question>"` FIRST. Do not grep until graphify returns insufficient results.
- Use `graphify path "<A>" "<B>"` to trace relationships between files or symbols (e.g. `graphify path "app_db" "HomePage"`).
- Use `graphify explain "<concept>"` to understand a domain concept across the codebase (e.g. `graphify explain "battery score"`).
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review when query/path/explain are insufficient.
- **After modifying code, run `graphify update .`** to keep the graph current (AST-only, no API cost). Do this before ending any session that changed files.
