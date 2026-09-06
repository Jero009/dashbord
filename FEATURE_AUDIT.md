# Feature Audit — Gym Dashboard

Deep-dive inventory of every feature in the app, as shipped on `main` (commit `095bde8`).
Basis: source tree under `src/`, routes, DB schema (`app_db.ts`, 3,677 LOC), shared modules, and docs/.

**App at a glance:** Ionic 8 + Vue 3 + Capacitor (Android), SQLite (`@capacitor-community/sqlite`), Health Connect (`@capgo/capacitor-health`), Chart.js, Vitest + Cypress. ~31k LOC across 81 source files, 7 feature modules, 23 DB tables, 33 routes, 4 bottom tabs in the Gym section.

> Corrections to the earlier quick audit: the **Plan** module is NOT dead — `/health/planner|calendar|habits|goals` are legacy redirects INTO Plan, and `usePlanner.ts` (984 LOC) is the real implementation. Goals/habits/calendar live under Plan, backed by Health pages.

---

## 1. Home (`src/features/home`, 2,332 LOC)

Single `HomePage.vue` (god-file) — the "today" dashboard. Sections:

- **Today header** — readiness score, battery score
- **Sleep card** — last night's sleep score, avg sleep, bedtime
- **Health row** — resting HR, steps, weight (from Health Connect sync)
- **Workout card** — last workout summary (sets, volume, duration), "active workout" banner with continue
- **This week** — workouts done vs target
- **Habits strip** — today's habits, done toggles
- **Schedule** — today's calendar events, "nothing scheduled" state
- **Circadian strip** — alertness curve, wake/noon/evening energy, morning-light log
- **Finance tile** — net worth
- **Start** — quick-start workout / log actions

**Verdict:** core. Needs splitting (2.3k LOC in one SFC), not cutting.

## 2. Gym (`src/features/gym`, ~7.5k LOC) — bottom tabs: Home / Template / Exercise / History

- **Gym Home** — active workout banner, last workout, recent PRs, this-week volume + rest day indication
- **Workout logging** (`WorkoutPage.vue`, 1,193 LOC) — live session from a template or blank:
  - Set logging (kg × reps), per-set RPE (RpePickerModal)
  - Progressive-overload hints, PR detection (`exercise_pr` table)
  - Rest timer with `TimerDial` (440 LOC), audio cues (`restTimerAudio`), glyph animation (`restTimerGlyph`)
  - Discard/keep confirm, workout summary modal (total kg, sets, PRs, duration)
- **Templates** — list, archive, delete; **TemplateBuilder** (create: pick exercises, sets, rep ranges) and **TemplateEditor** (edit existing), **ExercisePicker** flow pages
- **Exercises** — exercise library with add/rename, muscle-group + equipment association
- **Exercise detail** (`ExerciseDetailPage`, 609 LOC) — per-exercise: max weight, best Epley 1RM, top-set trend, volume per session, avg RPE, PR, session history
- **History** — past workouts, per-workout sets drill-down, delete

**DB:** `workout`, `workout_exercise`, `workout_exercise_sets`, `workout_template(+exercise)`, `exercise`, `exercise_pr`, `muscle_group`, `equipment`.

**Verdict:** the heart of the app. Keep all.

## 3. Health (`src/features/health`, ~6.5k LOC incl. shared/health)

- **Health overview** — readiness score (14-day chart), battery score, sleep-last-night card, steps/activity 7d, resting HR 14d, sleep HR, respiratory rate, Health Connect permission handling + sync trigger
- **Health Connect sync** (`healthConnect.ts`, 1,050 LOC) — pulls steps, HR (resting/sleep), sleep sessions + stages, respiratory rate; auto-sync component; permission flows
- **Sleep** (`SleepPage`, 948 LOC) — sleep score, stages timeline, bedtime/wake, efficiency, overnight HR, consistency (7 nights), streak, good-nights, 30-night history
- **Body** (`BodyPage`, 791 LOC) — weight log + measurements (chest/waist/hips/arm/thigh, body fat %), progress photos (camera + gallery), notes, history
- **Cardio** (`CardioPage`, 289 LOC) — exercise sessions from Health Connect: distance, calories, time, activity breakdown
- **Circadian** (`CircadianPage` 1,476 + `circadian.ts` 588 LOC) — chronotype model (MSFsc, DLMO, Tmin), social jetlag, day-type (work/free), alertness curve, energy logging (wake/noon/evening), morning-light + first/last meal + exercise timing logs, recommendations, amplitude/consistency metrics
- **Readiness / recovery engine** (shared): `recoveryBaseline.ts`, `recoveryTime.ts` (244 LOC), `trainingLoad.ts` (287 LOC, ACWR), `overtraining.ts`, `insights.ts` (239 LOC) — composite readiness score, recovery-time estimates, overtraining flags, generated text insights

**DB:** `health_metric`, `sleep_session`, `readiness_score`, `body_log`, `circadian_log`.

**Verdict:** keep overview/sleep/body + the recovery engine (feeds weekly review). **Circadian is the biggest single cut candidate** (~2.1k LOC: page + model + log table + home strip) — niche chronotype science; its energy/light logs overlap habit tracking. **Cardio overlaps** the health overview's activity data; fold into Health page or cut.

## 4. Plan (`src/features/plan`, ~1.6k LOC + pages hosted from health/)

- **PlanPage** — today's view: goals active, habits due today, events today, section nav
- **Goals** (`HealthGoalsPage`) — goals with types: body weight, lift PR, account balance, manual % complete; due dates; `goalProgress.ts` auto-progress from linked data
- **Habits** (`HealthHabitsPage`) — habit tracking: 7-day board, streaks, best streak, 10-week consistency, more/less direction habits
- **Calendar** (`HealthCalendarPage`, 651 LOC) — events with types (workout, recovery, sleep, school, reminder, general), day/week/month recurrence (`recurrence.ts`, 207 LOC: weekdays, every N, until-date, N-times), search, battery-score modelling of scheduled load
- **usePlanner** composable (984 LOC) — all calendar/goal/habit logic shared by the pages
- Legacy `/health/*` deep links redirect here

**DB:** `goal`, `habit`, `habit_log`, `calendar_event`.

**Verdict:** functionally this is a second life-OS inside the app. Habits+goals duplicate the 12-week-year scorecard (Obsidian + Discord) — dual-tracking is a documented failure mode. Calendar is a private duplicate of Google Calendar, which is already synced from eAsistent. Whole module is a **cut candidate** if you accept external systems as the source of truth. The 984-LOC composable is well-built but serves the duplication.

## 5. Finance (`src/features/finance`, ~4k LOC)

Six pages:
- **Overview** — net worth, assets/liabilities, this-month income/spent/saved, savings rate, top categories, recent activity
- **Accounts** — bank/cash/credit/loan accounts, institution, balances
- **Budget** — category budgets, limit vs spent, left-to-spend, cash-flow transaction log (income/expense)
- **Investments** — holdings (stock/crypto/fund/other), quantity, cost basis, current value, gain/loss, portfolio value, funded-from account
- **Subscriptions** — recurring items weekly/monthly/yearly, next-due, paused, overdue, per-month normalization, income items
- **Analytics** — income vs spending, budget vs actual, spending by category, net-worth change

**DB:** `finance_account`, `finance_transaction`, `finance_budget`, `finance_investment`, `finance_subscription`, `net_worth_snapshot`.

**Verdict:** biggest module by pages. No bank integration (manual entry; CSV import was discussed but not built). If transactions aren't being logged, all six pages render empty states. **Cut candidate** — or freeze as-is and stop maintaining.

## 6. Analytics (`src/features/analytics`, ~1.9k LOC)

- **Overview** — training load (acute 7d / chronic / ACWR ratio), weekly avg, generated insights
- **Gym** — training frequency, weekly tonnage, volume by muscle group, push/pull/legs balance, sets per week (less/more guidance)
- **Review** — week/month rollup: workouts, volume, avg sleep, readiness, habit consistency, finance (net worth change, spent vs budget)
- **TrainingLoadOverlay** (679 LOC) — charts overlaying load vs recovery

**Verdict:** Overview + Gym are genuinely useful for the PPLPP program (P/P/L balance is on-theme). Review overlaps the weekly-review ritual (Discord/Obsidian). Keep Gym+Overview, Review is optional.

## 7. Settings (`src/features/settings`, 1,041 LOC)

- Theme, currency, sleep goal (h), daily steps, goal weight, weekly workout target
- Notification toggles: weight, habit, sleep/wind-down, calendar event, subscription due, morning summary, weekly digest (`notifications.ts` 317 LOC + `notificationDigests.ts`)
- Health Connect system-permission management
- **Export backup / import backup** — full SQLite export/restore
- **"Plain-text for an AI" export** (`aiExport.ts`, 512 LOC) — date-aligned daily CSV timeline + profile/PR/habit/goal/body/finance summaries, designed to paste into an LLM. Has unit tests.

**Verdict:** keep. The AI export is the exact hook the planned backend/agent integration should reuse.

## 8. Shared infrastructure

- `app_db.ts` (3,677 LOC) — all 23 tables + every query. God-file; split before any major work
- `DashboardTopBar`, section-tab components per module
- Utils: currency, haptics, timeFormat, math, chart styling, glyph frames/matrix (timer animation)
- Health engine: recovery/training-load/insights/overtraining (all unit-tested)
- Tests: 17 files (recurrence, finance, recovery, circadian, insights, aiExport, goalProgress, glyphFrames, overtraining, …)

---

## Route map (33)

```
/home                      today dashboard
/workout/:id               active workout session
/exercise/:id              exercise detail (stats, PRs)
/tabs/{Home,Template,Exercise,History,ExercisePicker,TemplateBuilder,TemplateEditor/:id}
/health                    health overview
/health/{sleep,body,cardio,circadian}        → circadian = cut candidate
/health/{planner,calendar,habits,goals}      → legacy redirects into /plan
/plan                      today's plan hub
/plan/{goals,habits,calendar}                hosted health pages
/finance{,/budget,/accounts,/investments,/subscriptions,/analytics}
/analytics{,/gym,/review}
/settings
```

## Cut/keep summary

| Module | LOC | Call |
|---|---|---|
| Gym | ~7.5k | **Keep** — core |
| Health (overview, sleep, body, recovery engine) | ~4.4k | **Keep** — feeds weekly review |
| Home | 2.3k | Keep; split the file |
| Circadian | ~2.1k | **Cut** — niche, overlaps habits/light logs |
| Finance | ~4k | **Cut or freeze** — no data pipeline, manual-only |
| Plan (goals/habits/calendar) | ~2.9k | **Cut** — duplicates 12-week-year + Google Calendar systems |
| Analytics | ~1.9k | Keep Gym+Overview (~1.2k); Review optional (~300) |
| Cardio | ~300 | Fold into Health overview or cut |
| Settings + AI export | ~1.9k | Keep — AI export is the backend hook |

**Full cut scenario (circadian + finance + plan + cardio + review): ≈ −9.3k LOC (~30%), 4 nav areas fewer, 10 fewer DB tables.**

---

## Decision log (with user, 2026-09-06)

| Item | Decision |
|---|---|
| Circadian | **CUT NOW** — page + circadian.ts + circadian_log + Home circadian strip (strip doesn't sync with page) |
| Calendar | **KEEP, rework later** — become a synced view (Radicale/CalDAV feed per degoogle plan), not a private duplicate |
| Finance | **KEEP, rework later** — data-source decision required first (CSV import vs quick-add) before reworking pages |
| Analytics | **KEEP, improve** — first fixes: triceps missing from PPL balance, ACWR counting training days instead of calendar days |
| Plan module (hub, goals, habits, calendar page, usePlanner) | **CUT NOW** — calendar to be REBUILT later as synced Radicale/CalDAV view, not maintained as private duplicate |
| Analytics Review | **KEEP** — but connected to the backend/cron, AI-analyzed instead of algorithm-only; backend is secondary, app must work without it |
| Cardio page | **CUT NOW** — Health overview already shows the same Health Connect activity data |
| Progress photos (Body) | **CUT NOW** |
| Follow-on deletions | Home habits/circadian/schedule strips, notification toggles for cut modules, recurrence.ts, goalProgress.ts, usePlanner.ts, aiExport finance/circadian sections, DB tables goal/habit/habit_log/calendar_event/circadian_log |

**Running tally: ≈ −12.5k LOC (~40%), −16 DB tables, nav 7 → 4 (Gym, Health, Analytics, Settings).**


## Planned additions (agreed direction)

1. **Backend on the Hermes VM** (tailnet-only): GLM/zai proxy for an in-app AI pane (reusing `aiExport.ts`), Hermes chat proxy, phone→VM health/workout sync, push notifications (ntfy.sh transport preferred)
2. Keys stay on the VM — nothing shipped in the APK
