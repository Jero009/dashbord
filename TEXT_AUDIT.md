# TEXT_AUDIT.md

Text reduction audit for the Ionic + Vue dashboard. Goal: match the Nothing-OS
language — hierarchy, big numbers, single-word labels, glyphs over prose.

**Tags**
- **ESSENTIAL** — data label, critical verb, or required text. Keep.
- **REDUCIBLE** — wordy; can be a fragment / single word / number.
- **REPLACEABLE** — unambiguous; can become an icon/glyph + aria-label.
- **REMOVABLE** — redundant helper, obvious instruction, marketing/decorative filler.

For REDUCIBLE/REPLACEABLE the proposed replacement is given as `current → proposed`.
Anything genuinely ambiguous is flagged **⚠ DECIDE**.

> **STOP — review gate.** This is Phase 1 only. No edits have been made. Please
> review, then approve (all, or per-section) before I apply Phase 2.

---

## Cross-cutting patterns (apply everywhere)

| Pattern | Rule |
|---|---|
| Toasts / alerts | terse, lowercase, no `!`, no "Try again", no period. `Saved!` → `saved` |
| Buttons / CTAs | verb only, 1–2 words. `Add account` → `Add`, `Add habit` → `Add` |
| Input helper / hint `<p>` lines | remove unless they prevent a real error |
| Empty states | one short fragment, no instructions |
| `… quality` / `… reminder` suffixes | drop the redundant noun where context already says it |

---

## Navigation & shells (all ESSENTIAL — keep)

- **DashboardTopBar.vue** — `Home / Finance / Health / Plan / Gym / Analytics`. Keep. Settings gear already icon-only (has no aria-label — **add `aria-label="Settings"`**, a11y gap).
- **TabsPage.vue** — `Home / Template / Exercise / History` (icon + label). Keep.
- **AnalyticsSectionTabs / FinanceSectionTabs / HealthSectionTabs / PlanSectionTabs** — single-word segment labels. Keep all.

---

## Gym feature

### gym/pages/HomePage.vue
| String | Tag | Change |
|---|---|---|
| `Last workout` / `Active workout` (kicker) | ESSENTIAL | keep |
| `Time` / `Total load` / `Completed` (tiles) | ESSENTIAL | keep |
| `Workout` (timer caption) / `Rest` | ESSENTIAL | keep |
| `This week` | ESSENTIAL | keep |
| tile `Workout` over template name | REMOVABLE | drop the literal `<span>Workout</span>` kicker — the name is the content |
| `Recent PRs` / `30 days` | ESSENTIAL | keep |
| `Select template` (placeholder) | REDUCIBLE | `Select template → Template` |

### gym/pages/WorkoutPage.vue
| String | Tag | Change |
|---|---|---|
| `Workout` (title), `stop` | ESSENTIAL | keep (`stop` already terse) |
| `Add Set` | REDUCIBLE | `Add Set → Add set` (sentence case; or icon-only — has icon already, **keep label for clarity**) |
| `Add Exercise` | REDUCIBLE | `Add Exercise → Add exercise` |
| `Cancel Workout` (button) | REDUCIBLE | `Cancel Workout → Cancel` |
| `Resting` (overlay label) | ESSENTIAL | keep |
| `Skip` / `-15s` / `+15s` | ESSENTIAL | keep |
| alert `End Workout?` / `Saves the workout and returns home.` | REDUCIBLE | header `End workout?`; **remove** message body (obvious) |
| alert `Cancel Workout?` / `This workout won't be saved.` | REDUCIBLE | header `Discard workout?`; message → `won't be saved` |
| buttons `Yes, Cancel` / `No` | REDUCIBLE | `Discard` / `Keep` |
| alert `Remove Set?` / `Removes only this set.` | REDUCIBLE | header `Remove set?`; **remove** body |
| alert `Remove Exercise?` / `Removes "X" and all of its sets.` | REDUCIBLE | header `Remove exercise?`; body → `removes "X" and its sets` |
| alert `Session RPE` / `How hard was this session? (1–10, optional)` | REDUCIBLE | keep header; body → `1–10, optional` |
| button `Skip` / `Save` (RPE) | ESSENTIAL | keep |

### gym/components/WorkoutSummaryModal.vue
| String | Tag | Change |
|---|---|---|
| `Workout complete` (kicker) | REDUCIBLE | `Workout complete → Complete` |
| `Duration / Volume / Exercises / Sets done` | ESSENTIAL | `Sets done → Sets` (REDUCIBLE) |
| `kg lifted` (detail) | REMOVABLE | drop — `Volume` label + value already says it |
| `Personal record` / `N personal records` | REDUCIBLE | `Personal record → PR`; `N personal records → N PRs` |
| `NEW` / `PR+` badges | ESSENTIAL | keep |
| `Done` | ESSENTIAL | keep |

### gym/components/RpePickerModal.vue
| String | Tag | Change |
|---|---|---|
| `Rate of Perceived Exertion` (kicker) | REDUCIBLE | `→ RPE` |
| `Clear` | ESSENTIAL | keep |
| per-row `detail` / `feel` copy | ESSENTIAL | keep (these *are* the RPE scale meaning) |

### gym/components/TimerDial.vue
| String | Tag | Change |
|---|---|---|
| `Set Rest Time` (h2) | REDUCIBLE | `→ Rest time` |
| `seconds` (input label) | REMOVABLE | drop — dial shows `Ns` already |
| `Cancel` / `Confirm` | ESSENTIAL | keep |

### gym/pages/TemplatePage.vue
| String | Tag | Change |
|---|---|---|
| title `TEMPLATE` / large `Template` | ESSENTIAL | keep |
| `Archived` chip | ESSENTIAL | keep |
| `{n} sets {n} reps` | ESSENTIAL | keep |
| buttons `Delete` / `Edit` / `Archive` / `Unarchive` | ESSENTIAL | keep |
| alert `Delete Template?` / `Delete "X"? This can't be undone.` | REDUCIBLE | header `Delete template?`; body → `"X" — can't be undone` |

### gym/pages/ExercisePage.vue
| String | Tag | Change |
|---|---|---|
| title `EXERCISES`, `Add exercise`, modal `Add exercise` | ESSENTIAL | keep |
| `Enter exercise name` (placeholder) | REDUCIBLE | `→ Name` |
| `Select muscle group` / `Select equipment` (placeholders) | REDUCIBLE | `→ Muscle group` / `→ Equipment` |
| `Filter by muscle group` (placeholder) | REDUCIBLE | `→ Muscle group` |
| `Cancel` / `Add` / `Rename` | ESSENTIAL | keep |
| alert `Rename Exercise` | REDUCIBLE | `→ Rename` |

### gym/pages/HistoryPage.vue
| String | Tag | Change |
|---|---|---|
| title `HISTORY`, `Delete` | ESSENTIAL | keep |
| alert `Delete Workout?` / `Delete this workout from history?` | REDUCIBLE | header `Delete workout?`; **remove** body |
| `Invalid time` (fallback) | ESSENTIAL | keep (error guard) |

### gym/pages/ExerciseDetailPage.vue
| String | Tag | Change |
|---|---|---|
| `Personal record`, `Strength`, `Volume per session`, `Recent sessions` | ESSENTIAL | keep (section kickers) |
| `Max weight / Est. 1RM / Achieved / Epley` | ESSENTIAL | keep |
| `No record yet.` | REDUCIBLE | `→ No record` |
| `No sessions in this window.` | REDUCIBLE | `→ No sessions` |
| `Last {n} days` | ESSENTIAL | keep |
| `Top set` / `Est. 1RM` (legend) | ESSENTIAL | keep |
| `No history yet.` | REDUCIBLE | `→ No history` |

### gym/pages/flows/ExercisePickerPage.vue
| String | Tag | Change |
|---|---|---|
| `EXERCISES` / `Filter by muscle group` | REDUCIBLE | placeholder `→ Muscle group` |
| `All` | ESSENTIAL | keep |

### gym/pages/flows/TemplateBuilderPage.vue & TemplateEditorPage.vue
| String | Tag | Change |
|---|---|---|
| `CREATE TEMPLATE` / `Create Template` / `EDIT TEMPLATE` | ESSENTIAL | keep (one each — note duplicate large+small titles, harmless) |
| `Cancel` / `Save` | ESSENTIAL | keep |
| `Template name` (placeholder) | REDUCIBLE | `→ Name` |
| `Add exercise` | ESSENTIAL | keep |
| `Sets` / `Reps` placeholders + floating labels | ESSENTIAL | keep (but placeholder duplicates the floating label → **REMOVABLE placeholder**) |
| `Remove` | ESSENTIAL | keep |

---

## Health feature

### health/pages/HealthPage.vue
| String | Tag | Change |
|---|---|---|
| `Battery` / `Sleep · last night` / `Body` / `Today's schedule` | ESSENTIAL | keep |
| `Train` / `Study` badges | ESSENTIAL | keep |
| drain labels `Time / Workout / Activity / Events` | ESSENTIAL | keep |
| `Heart rate · last 14 days` / `Avg resting` | ESSENTIAL | keep |
| `Not enough heart rate data yet — sync Health Connect to populate` | REDUCIBLE | `→ No heart-rate data yet` |
| `No readiness data yet — sync Health Connect to populate` | REDUCIBLE | `→ No readiness data yet` |
| sleepInsight strings (`Respiratory rate elevated — monitor for illness`, `Efficiency below target — aim for 85%+`, `Sleep under 7 h — recovery may be limited`, `Strong sleep — recovery looks good`, `Sleep looks solid`) | REDUCIBLE | shorten to fragments: `resp. rate elevated`, `efficiency below 85%`, `under 7 h sleep`, `strong sleep`, `sleep solid` — **⚠ DECIDE**: these are the one genuinely "insight" sentence; keep informative tone or go terse? |
| `Health Connect` kicker / `healthConnectStatus` text / `Sync now` / `Syncing...` | ESSENTIAL | keep; `Syncing... → Syncing…` (ellipsis char) |
| toast `Synced N records.` | REDUCIBLE | `→ synced N records` |
| toast `Permissions not granted yet.` | REDUCIBLE | `→ permission needed` |
| toast `Health Connect unavailable.` | REDUCIBLE | `→ health connect unavailable` |

### health/pages/SleepPage.vue
| String | Tag | Change |
|---|---|---|
| `Sleep score`, `Sleep stages`, `Stages`, `Heart rate overnight` | ESSENTIAL | keep |
| metric captions `Asleep / In bed / Efficiency / Bedtime / Wake / HR / Resp.` | ESSENTIAL | keep |
| `Sync Health Connect` / `Syncing…` (button) | REDUCIBLE | `Sync Health Connect → Sync` |
| `Consistency · 7 nights` / `Score / Streak / Good nights` | ESSENTIAL | keep |
| `History · 30 nights` | ESSENTIAL | keep |
| empty states `No stage timeline yet` / `No stage data` / `No HR data yet` / `No history yet` | REDUCIBLE | `→ No stages` / `No stages` / `No HR data` / `No history` |
| toast `Synced N health records.` | REDUCIBLE | `→ synced N records` |
| toast `Grant Health Connect access to read sleep data.` | REDUCIBLE | `→ grant health connect access` |
| toast `Unable to sync sleep data.` | REDUCIBLE | `→ sync failed` |

### health/pages/BodyPage.vue
| String | Tag | Change |
|---|---|---|
| `Log weight` (kicker) | ESSENTIAL | keep |
| field labels `Date / Weight (kg) / Waist (cm) / …` | ESSENTIAL | keep |
| `Optional` (notes placeholder) | REMOVABLE | drop — field is self-evidently optional |
| `Camera` / `Gallery` / `Remove` / `Save` | ESSENTIAL | keep |
| `History` / `vs previous` | ESSENTIAL | keep |
| empty `No entries yet. Log your first weight above.` | REDUCIBLE | `→ No entries yet` |
| toast `Saved!` | REDUCIBLE | `→ saved` |
| toast `Enter a valid weight.` | REDUCIBLE | `→ invalid weight` |
| toast `Already logged for this date.` | REDUCIBLE | `→ already logged` |
| toast `Failed to save. Try again.` | REDUCIBLE | `→ save failed` |

### health/pages/CircadianPage.vue
| String | Tag | Change |
|---|---|---|
| `Loading circadian data...` | REDUCIBLE | `→ Loading…` |
| `Chronotype` / metric labels | ESSENTIAL | keep |
| `{quality} quality` badge | REDUCIBLE | drop word `quality` → just `{quality}` (badge context is clear) |
| metric subs `7-night average`, `est. sleep drive start`, `deepest sleep marker`, `MSFsc chronotype`, `work vs free-day offset` | REMOVABLE/REDUCIBLE | **remove** the sub-captions that restate the label (`7-night average` can stay once; `est. sleep drive start` → `est.`) — **⚠ DECIDE** how much explanation to keep on this data-dense page |
| `Today — scroll to explore` | REDUCIBLE | `→ Today` (the scroll affordance is visual) |
| `Not enough sleep data yet` | REDUCIBLE | `→ Not enough data` |
| `Right now:` | REDUCIBLE | `→ Now` |
| `nowActivityLabel` sentences (`Cognitive peak — deep work time`, `Wind down — no more eating`, `Rest / low-intensity time`, `Morning exercise window`, `Afternoon exercise window`) | REDUCIBLE | `→ Deep work`, `Wind down`, `Rest`, `Morning exercise`, `Afternoon exercise` |
| `Circadian health score` | REDUCIBLE | `→ Health score` (page already circadian) |
| `Recommendations` | ESSENTIAL | keep |
| `Today's log` / `Log today` / `Edit` / `Cancel` | ESSENTIAL | keep |
| form labels `Day type / Energy at wake / …` | ESSENTIAL | keep |
| `Got outdoor light before 9 AM` | REDUCIBLE | `→ Morning light` |
| `No entry for today.` | REDUCIBLE | `→ No entry` |
| toast `Day logged.` | REDUCIBLE | `→ logged` |

### health/pages/CardioPage.vue
| String | Tag | Change |
|---|---|---|
| `Activity` / tiles | ESSENTIAL | keep |
| `Loading...` | REDUCIBLE | `→ Loading…` |
| `No activities found for the past N days. Make sure Exercise permission is granted in Health Connect settings.` | REDUCIBLE | `→ No activities. Check Exercise permission in Health Connect.` (keep the permission hint — it's a real fix, but trim) |

### health/pages/HealthGoalsPage.vue
| String | Tag | Change |
|---|---|---|
| `Goals` / `Completed` | ESSENTIAL | keep |
| `Goal name` / `Target value` (placeholders) | REDUCIBLE | `→ Name` / `→ Target` |
| select options `Manual progress / Track body weight / Track lift PR (est. 1RM) / Track account balance` | REDUCIBLE | `→ Manual / Body weight / Lift PR / Account balance` |
| `Select exercise…` / `Select account…` | REDUCIBLE | `→ Exercise…` / `→ Account…` |
| `Progress updates automatically from your data.` | REMOVABLE | drop hint |
| `Add goal` (button) | REDUCIBLE | `→ Add` |
| `+1 / Set / Done` | ESSENTIAL | keep |
| `No goals yet.` | REDUCIBLE | `→ No goals` |
| `N linked habit(s)` / `done` tag | ESSENTIAL | keep |

### health/pages/HealthHabitsPage.vue
| String | Tag | Change |
|---|---|---|
| `Habit board · last 7 days` | REDUCIBLE | `→ Habits · 7 days` |
| `Habit name` (placeholder) | REDUCIBLE | `→ Name` |
| `No linked goal` (option) | REDUCIBLE | `→ No goal` |
| `Linking a goal adds +1 progress each time the habit is completed.` | REMOVABLE | drop hint |
| `Add habit` (button) | REDUCIBLE | `→ Add` |
| stat tiles `Streak / Best / 30-day` | ESSENTIAL | keep |
| `Delete / Save` | ESSENTIAL | keep |
| `No habits yet.` | REDUCIBLE | `→ No habits` |
| `Consistency · last 10 weeks` / `Less` / `More` | ESSENTIAL | keep (`last 10 weeks → 10 weeks` REDUCIBLE) |

### health/pages/HealthCalendarPage.vue
| String | Tag | Change |
|---|---|---|
| view tabs, `Search events` placeholder | REDUCIBLE | placeholder `→ Search` |
| `Results` / `No events match "X"` | REDUCIBLE | empty → `No matches` |
| `Nothing scheduled in the next 45 days` | REDUCIBLE | `→ Nothing scheduled` |
| `Today` button | ESSENTIAL | keep |
| `goal due` / `Events` / `Habits` / `Schedule` | ESSENTIAL | keep |
| `Editing event` banner | REDUCIBLE | `→ Editing` |
| `Event title` (placeholder) | REDUCIBLE | `→ Title` |
| `All-day` | ESSENTIAL | keep |
| type/recur `<option>`s (`General/Workout/…`, `No repeat/Daily/…`, `Never ends/Until date/After N times`) | ESSENTIAL | keep (option semantics) |
| `No template` | ESSENTIAL | keep |
| `Notes (optional)` (placeholder) | REDUCIBLE | `→ Notes` |
| `Save / Update / Delete` | ESSENTIAL | keep |
| `No events on this day` / `Nothing scheduled this day` / `No habits scheduled this day` | REDUCIBLE | `→ No events` / `Nothing scheduled` / `No habits` |
| `times` placeholder (recur count) | ESSENTIAL | keep (tiny, clarifies field) |

---

## Plan feature

### plan/pages/PlanPage.vue
| String | Tag | Change |
|---|---|---|
| `Today · {date}` / `Events today` / `Sections` | ESSENTIAL | keep |
| `Habits / Goals active / No events` | ESSENTIAL | keep |
| nav hints `{n} active`, `{n}/{n} done today`, `{n} events today / No events today` | REDUCIBLE | `→ {n} active`, `{n}/{n} done`, `{n} today / —` — trim `today`/`done today` |

---

## Finance feature

### finance/pages/FinancePage.vue
| String | Tag | Change |
|---|---|---|
| `Net worth` | ESSENTIAL | keep |
| `Accounts + investments` (sub) | REMOVABLE | drop — the two tiles below show exactly this |
| tile labels `Subscriptions / mo`, `Spent this month`, `Budget left` | REDUCIBLE | `→ Subs/mo`, `Spent`, `Left` |

### finance/pages/FinanceAccountsPage.vue
| String | Tag | Change |
|---|---|---|
| `Add account` (kicker) | ESSENTIAL | keep |
| field labels `Account name / Type / Institution / Balance` | ESSENTIAL | `Account name → Name` (REDUCIBLE) |
| account-type options `Cash/Bank/Credit/Loan` | ESSENTIAL | keep |
| `Add account` (button) | REDUCIBLE | `→ Add` |
| `N total` (count) | REDUCIBLE | `→ N` |
| `No institution` meta | REMOVABLE | drop fallback — show just type when absent |
| `No accounts yet.` | REDUCIBLE | `→ No accounts` |
| toasts `Account name is required.` / `Enter a valid balance.` / `Could not save account.` / `Account added.` | REDUCIBLE | `→ name required` / `invalid balance` / `save failed` / `added` |

### finance/pages/FinanceInvestmentsPage.vue
| String | Tag | Change |
|---|---|---|
| `Add investment` / fields | ESSENTIAL | keep |
| `Select account` placeholder / `No account` | REDUCIBLE | `→ Account` / keep `No account` |
| `Add investment` (button) | REDUCIBLE | `→ Add` |
| `N holdings` | REDUCIBLE | `→ N` |
| `No investments yet.` | REDUCIBLE | `→ No investments` |
| toasts `Investment name is required.` / `Enter valid amounts.` / `Could not save investment.` / `Investment added.` | REDUCIBLE | `→ name required` / `invalid amount` / `save failed` / `added` |

### finance/pages/FinanceSubscriptionsPage.vue
| String | Tag | Change |
|---|---|---|
| `Add recurring` / `Recurring` | ESSENTIAL | keep |
| options `Payment/Income`, `Monthly/Yearly/Weekly` | ESSENTIAL | keep |
| `Next due date` label | REDUCIBLE | `→ Next due` |
| `Add recurring` (button) | REDUCIBLE | `→ Add` |
| `N active` | REDUCIBLE | `→ N` |
| `Overdue` / `Due soon` badges | ESSENTIAL | keep |
| `TBD` due fallback | ESSENTIAL | keep |
| toasts `Subscription name is required.` / `Enter an amount above zero.` / `Could not save subscription.` / `Recurring item added.` | REDUCIBLE | `→ name required` / `amount required` / `save failed` / `added` |

### finance/pages/FinanceBudgetPage.vue
| String | Tag | Change |
|---|---|---|
| `Cash flow` / `Budgets` / `Add transaction` / `Transactions` | ESSENTIAL | keep |
| `Left to spend` / metric labels `Income/Spent/Net/Budgeted` | ESSENTIAL | keep |
| `N categories` / `N this month` | REDUCIBLE | `→ N` |
| `{x} over` / `{x} left` (budget foot) | ESSENTIAL | keep |
| category option labels (`Food & Drink`, `Health & Fitness`, …) | ESSENTIAL | keep |
| `Monthly limit` label | REDUCIBLE | `→ Limit` |
| buttons `Set budget` / `Add transaction` / `Expense` / `Income` | REDUCIBLE | `Set budget → Set`; `Add transaction → Add` |
| `No budgets yet.` / `No transactions logged for {month}.` | REDUCIBLE | `→ No budgets` / `No transactions` |

### finance/pages/FinanceAnalyticsPage.vue
| String | Tag | Change |
|---|---|---|
| `Spending by category` / `Budget vs actual` / `Income vs spending` | ESSENTIAL | keep |
| `Spent` (donut center) / legends `Spending/Income` | ESSENTIAL | keep |
| `No expenses recorded this month.` | REDUCIBLE | `→ No expenses` |
| `Set monthly budgets to track them here.` | REMOVABLE | `→ No budgets set` |
| `Not enough history for a trend yet.` | REDUCIBLE | `→ Not enough history` |

---

## Analytics feature

### analytics/pages/AnalyticsOverviewPage.vue
| String | Tag | Change |
|---|---|---|
| `Today` / `Training load` / `Insights` | ESSENTIAL | keep |
| tiles `Acute (7d) / Weekly avg / ACWR` | ESSENTIAL | keep |
| `recovery.reason` sentences (`Load is spiking above your recent baseline — injury risk rises here.`, `Below your usual load — room to add volume.`, `No recent training — ease back in gradually.`, `Load is in the sustainable range.`) | REDUCIBLE | trim to fragments: `Load spiking — injury risk`, `Below usual — add volume`, `No recent training`, `Sustainable range` |
| `Log a few more weeks of workouts to track acute vs chronic load.` | REDUCIBLE | `→ Need more workout history` |
| `Insights appear once there's enough overlapping sleep, heart-rate and training history.` | REDUCIBLE | `→ Not enough data yet` |

### analytics/pages/AnalyticsGymPage.vue
| String | Tag | Change |
|---|---|---|
| section kickers `Training load`, `Volume by muscle group`, `Push / Pull / Legs balance`, `Weekly tonnage`, `Training frequency` | ESSENTIAL | keep |
| tiles `Volume/Sets/Workouts/Per week` | ESSENTIAL | keep |
| empties `No completed sets in this window.` / `Not enough history yet.` / `No workouts logged yet.` | REDUCIBLE | `→ No sets` / `Not enough history` / `No workouts` |
| `Less` / `More` heat legend | ESSENTIAL | keep |

### analytics/pages/AnalyticsReviewPage.vue
| String | Tag | Change |
|---|---|---|
| `Your review` (kicker) | REDUCIBLE | `→ Review` |
| `Week` / `Month` switch | ESSENTIAL | keep |
| `Training & health`, `Habits & goals`, `Finance` | ESSENTIAL | keep |
| bar labels `Habit consistency`, `Goal progress (N active)`, `Spent vs budget`, `Net worth change` | ESSENTIAL | keep |

### analytics/components/TrainingLoadOverlay.vue
| String | Tag | Change |
|---|---|---|
| `Load vs recovery` / `Recommendations` | ESSENTIAL | keep |
| tiles `ACWR / Acute 7d / Chronic 28d / {signal} z / Recovery time` | ESSENTIAL | keep |
| `vs 28d base` (detail) | ESSENTIAL | keep |
| legend `Detraining/Optimal/Caution/High risk` | ESSENTIAL | keep |
| `statusReason` sentences | REDUCIBLE | trim (see component) — fragments not sentences |
| `Each recovery point sits one day right of the load it responds to — read a low dip just after a tall red bar as fatigue catching up.` (lag-note) | REMOVABLE | **remove** — explanatory paragraph, exactly the kind of prose to cut |
| `Log a few workouts (and let recovery sync) to build the overlay.` | REDUCIBLE | `→ Log workouts to build the overlay` |

---

## Settings

### settings/pages/SettingsPage.vue
| String | Tag | Change |
|---|---|---|
| `Preferences / Goals & targets / Notifications / Data & sync` | ESSENTIAL | keep |
| `System follows your device's light/dark setting.` (hint) | REMOVABLE | drop |
| `Applies to all finance amounts` (sub) | REMOVABLE | drop |
| row subs `Hours per night`, `Step target`, `Kilograms`, `Training target` | REMOVABLE | drop — label + numeric input are self-evident |
| `Save targets` button | REDUCIBLE | `→ Save` |
| `Manage goals` | ESSENTIAL | keep |
| `System permission` / `Required for reminders` | REDUCIBLE | sub `→` drop (or `Required`) |
| notif subs (`Daily log reminder`, `Incomplete habits`, `Wind down alert`, `Before events`, `Before renewal`, `Daily readiness + agenda`, `Week-in-review recap`) | REDUCIBLE | trim to ≤2 words each, or **remove** where title is clear (`Weight reminder` + `Daily log reminder` is redundant → drop sub) — **⚠ DECIDE**: keep one-word subs or remove entirely? |
| `Allow` | ESSENTIAL | keep |
| `Export backup / Import backup` | ESSENTIAL | keep |
| `Export for AI analysis` / `Plain-text summary to paste into an AI` / `Preparing…` | REDUCIBLE | sub `→ Plain-text for an AI` or drop |
| `Steps, sleep, heart rate` (HC sub) | REMOVABLE | drop |
| alert `Import SQL Backup?` / `This replaces all current data.` | REDUCIBLE | header `Import backup?`; body → `replaces all data` |
| alert `Import Failed` / `Could not read the file.` / `Could not open file picker.` | REDUCIBLE | header `Import failed`; body → `couldn't read file` / `couldn't open picker` |
| toasts `Saved` / `Sync failed` / `Notifications allowed` / `Permission denied or not available` | REDUCIBLE | `Notifications allowed → notifications on`; `Permission denied or not available → permission denied` |
| Share titles/text `SQL Backup`/`Workout backup file`/`AI insights export`/`Tracking data for AI analysis` | ESSENTIAL | keep (OS share sheet metadata) |

---

## Accessibility gaps found (must fix when reducing)

These icon-only controls already exist or will be created — ensure `aria-label`:
- **DashboardTopBar** settings gear — no label. Add `aria-label="Settings"`.
- WorkoutPage reorder / stats / delete icon buttons — **no labels**. Add `Move up`, `Move down`, `Stats`, `Remove exercise`.
- SleepPage / HealthPage chart date-nav arrows — verify labels.
- BodyPage delete `<ion-icon close>` button — add `aria-label="Delete entry"`.
- Any label→icon swap in Phase 2 must ship with an `aria-label`.

(HealthCalendarPage, HealthGoalsPage, FinanceBudgetPage icon buttons already have `aria-label` — good.)

---

## Suggested commit grouping for Phase 2

1. Toasts/alerts terse pass (all features) — one commit.
2. Gym screens (Workout, Template, Exercise, History, Summary).
3. Health screens (Health, Sleep, Body, Circadian, Cardio).
4. Plan screens (Goals, Habits, Calendar, Plan).
5. Finance screens (all).
6. Analytics screens + overlay.
7. Settings.
8. a11y aria-label sweep.

Awaiting approval (whole report or per-section) before editing.
