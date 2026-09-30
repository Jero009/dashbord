# Gym feature audit — READ-ONLY (2026-09-30)

Baseline: `npm run test:unit -- --run` → **31 test files, 318 tests, all passed** (30.97s). Repo clean at `3e8d56c`.

## finding
**title:** HistoryPage `canLoadMore` computed has no reactive deps — infinite scroll permanently disabled
**file:line:** src/features/gym/pages/HistoryPage.vue:228 (with 486–489)
**symptom:** `nextIndex` and `allWorkouts` are plain module-level `let` variables, not refs. The computed records zero reactive deps, so Vue caches its first evaluation forever. First evaluation happens on initial render when `allWorkouts.length === 0` → `canLoadMore` is frozen at `false` → `<ion-infinite-scroll :disabled="!canLoadMore">` never activates. History shows only the first PAGE_SIZE=20 workouts, ever; re-renders triggered by `workouts.value` updates read the cached `false`.
**evidence:** `const canLoadMore = computed(() => nextIndex < allWorkouts.length);` — `let allWorkouts ... = []; let nextIndex = 0;` (no `.value`/ref anywhere). Matches the "computed() with no reactive dep caching forever (pagination flags)" pitfall exactly.
**severity:** high
**confidence:** high

## finding
**title:** Rest timer expiry outside WorkoutPage is silent — Home's onExpire cancels the scheduled OS ding instead of letting it fire
**file:line:** src/features/gym/pages/GymHomePage.vue:268–271 (with src/shared/composables/useRestTimer.ts resumeRestTimer)
**symptom:** Whoever last called `resumeRestTimer` owns the single shared interval. After the user navigates Workout → Home (or Home → any other tab, since tab pages stay alive), GymHomePage's `restoreActiveRestTimer()` re-arms the interval with `onExpire = () => clearActiveRestTimer()`. When the rest hits zero while the user is NOT on WorkoutPage, `cancelRestTimer()` runs, which cancels the OS-scheduled ding (`cancelRestTimerDing`) and clears the countdown notification — but no in-app ding plays either (only WorkoutPage's `onRestExpired` dings). Result: a completed set's rest alarm never sounds unless the user is sitting on WorkoutPage at expiry.
**evidence:** `const restoreActiveRestTimer = () => { resumeRestTimer(undefined, () => clearActiveRestTimer()); };` — expire path goes through `cancelRestTimer()` which does `void cancelRestTimerDing()`. On-expire is not an explicit user stop, so the "every clearer gets the cancel-the-alarm path" contract swallows the alarm.
**severity:** medium
**confidence:** high

## finding
**title:** Volume chart scrub selection not reset on timeFrame dataset swap — readout goes blank/stale
**file:line:** src/features/gym/pages/ExerciseDetailPage.vue:303–313
**symptom:** `volumeScrub.selectedIdx` persists when `timeFrame` changes and `historyData` shrinks (e.g. 365d → 30d). The plugin's draw is bounds-guarded (`idx >= opts.count() return`), but the readout row is not: `volumeActiveIdx = selectedIdx ?? last` keeps the old index, so `chartLabels()[idx] ?? ''` renders an empty date and `historyData.value[idx]` is undefined → value shows `—` until the user scrubs again. Contrast TrendChart (shared comp) which nulls `scrubIdx` on pointer-up for exactly this reason ("pts can shrink … stale index").
**evidence:** `const volumeActiveIdx = computed(() => volumeScrub.selectedIdx.value ?? Math.max(historyData.value.length - 1, 0)); const volumeReadoutDate = computed(() => chartLabels()[volumeActiveIdx.value] ?? '');` — no watch resets `volumeScrub.selectedIdx` after `loadExerciseData()`.
**severity:** low
**confidence:** high

## finding
**title:** ExercisePickerPage: onMounted + onIonViewWillEnter double loaders
**file:line:** src/features/gym/pages/flows/ExercisePickerPage.vue:240–248
**symptom:** `LoadExercises()` + `getMuscleGroups()` run twice on first page open (onMounted fires, then ionViewWillEnter fires). GymHomePage removed the same pattern with a comment ("a separate onMounted loader ran everything twice on page open"); this page still has it.
**evidence:** `onMounted(() => { LoadExercises(); getMuscleGroups()… }); onIonViewWillEnter(() => { LoadExercises(); getMuscleGroups()… });`
**severity:** low
**confidence:** high

## finding
**title:** TemplatePage: onMounted + onIonViewWillEnter double load, each an N+1 per template
**file:line:** src/features/gym/pages/TemplatePage.vue:309–314 (loadTemplates N+1 at 234–249)
**symptom:** `loadTemplates()` runs twice on first entry; each run does one `getTemplateExercises` query per template sequentially. Doubled on every view re-enter too.
**evidence:** `onMounted(() => { loadTemplates(); }); onIonViewWillEnter(() => { loadTemplates(); });` and `for (const template of data) { const exercises = await getTemplateExercises(template.id); … }`
**severity:** low
**confidence:** high

## finding
**title:** getAllExercisePRs() unbounded (no LIMIT), loaded wholesale on every ExercisePage view-enter
**file:line:** src/shared/db/app_db.ts:3517–3527 (caller src/features/gym/pages/ExercisePage.vue:288–296)
**symptom:** `SELECT ep.*, e.name … FROM exercise_pr ep JOIN exercise …` with no LIMIT and no day window; ExercisePage maps the full result into a PR map on every `LoadExercises()` (every view enter + every pull-to-refresh + after each add/rename). PR rows grow unboundedly with training history.
**evidence:** `export async function getAllExercisePRs() { … ORDER BY ep.date_achieved DESC }` — no LIMIT clause (other gym getters in the same file all use LIMIT).
**severity:** low
**confidence:** high

## finding
**title:** Unscoped `<style>` blocks with generic class names (leak/collision risk)
**file:line:** src/features/gym/pages/WorkoutPage.vue:141; src/features/gym/pages/GymHomePage.vue:459; src/features/gym/pages/TemplatePage.vue:60; src/features/gym/pages/ExercisePage.vue:95; src/features/gym/pages/TabsPage.vue:59
**symptom:** Five gym pages use unscoped `<style>` with generic selectors: WorkoutPage (`.timer`, `.title`, `.exercise-card`, `.set`, `.input-small`, `.rest-settings`, …), GymHomePage (`.home-shell`, `.weekly-card`, `.top-cards`, …), TemplatePage (`.card-template`, `.template-shell`, `.template-content`), ExercisePage (`.exercise-content`, `.exercise-shell`), TabsPage (element selectors `ion-tab-bar`/`ion-tab-button`, arguably intentional). Concrete collision: ExercisePage's global `.exercise-content { --padding-top: 16px; … }` hits ExercisePickerPage's scoped `.exercise-content` div class (vars cascade to that subtree).
**evidence:** `<style>` (no `scoped`) at all five locations; grep: only these 5 files in src/features/gym use unscoped style blocks.
**severity:** low
**confidence:** high

## finding
**title:** Raw color literals in gym feature (file list for separate sweep)
**file:line:** src/features/gym/pages/flows/ExercisePickerPage.vue:114,116,117
**symptom:** Hardcoded `rgba(255,255,255,…)` literals instead of `rgba(var(--nt-ink), …)` tokens in the searchbar styling. Only occurrence found in src/features/gym (grep for hex + `rgba(<digit>` excluding `var(`).
**evidence:** `--background: rgba(255, 255, 255, 0.06); --placeholder-color: rgba(255, 255, 255, 0.4); --icon-color: rgba(255, 255, 255, 0.4);`
**severity:** low
**confidence:** high

## finding
**title:** Date.now()-inside-computed staleness (deload countdown label, pause day counter)
**file:line:** src/features/gym/pages/GymHomePage.vue:375–380; src/features/gym/planStore.ts:55–61
**symptom:** `deloadCountdownLabel` and `pauseDay` read `Date.now()` with no reactive time source, so they only recompute when plan refs change — the "in 1 wk" → "this week" flip and the "day N" counter go stale within a long-lived session (day/midnight rollover not picked up until the plan store reloads).
**evidence:** `const days = Math.round((new Date(\`${nextDeload.value}T00:00:00\`).getTime() - Date.now()) / 86_400_000);` — computed with only `nextDeload` as dep; same shape in `pauseDay`.
**severity:** low
**confidence:** medium

## finding
**title:** resolvedDeloadConfig() double-invoked in WorkoutPage setup races the plan cache → duplicate plan/pause queries
**file:line:** src/features/gym/pages/WorkoutPage.vue:936–949
**symptom:** `resolvedDeloadConfig()` is called twice at setup (phaseCfg + deloadBanner). Both see `cachedPlan === undefined` before the first await resolves (single-threaded: call A suspends at `await getActivePlan`, call B runs synchronously right after and also sees undefined), so the active-plan and pause queries run twice. Harmless but wasteful; a `cachedPlanLoading` promise would fix it.
**evidence:** `if (cachedPlan === undefined) { cachedPlan = await getActivePlan(now); cachedPauses = … }` in trainingPhase.ts:95–98 — check-then-await without memoizing the in-flight promise.
**severity:** info
**confidence:** high

---
## Checklist items verified CLEAN (no finding)
- **Rest timer canonical storage / single owner:** all clearers route through `cancelRestTimer()`; GymHomePage/History teardown only `stopRestInterval()`; WorkoutPage `resyncRestTimer` snaps to wall-clock on foreground and does NOT re-ding if expired while backgrounded (OS ding already fired). No ghost double-ding on restore.
- **Session RPE flow:** `alert.onDidDismiss().then(() => resolveRpe(null))` guarantees `promptSessionRpe` resolves on backdrop dismiss → `endWorkout(workoutId)` always runs; `void mirrorWorkoutToReceiver(workoutId)` and widget push are correctly fire-and-forget.
- **Hardware back guard:** `useBackButton(10, …)` flushes all set saves before leaving WorkoutPage.
- **Deload/pause math:** planCalendar is pure whole-day `setDate` arithmetic (no month arithmetic → no year overflow); `pausedDaysBefore`/open-pause freeze consistent; 85% ramp and deload prefill both `Math.max(2.5, floor(x/2.5)*2.5)` with `capped < weight` guards — no 0-kg or overweight prefill.
- **Chart scrub haptics:** `useChartScrub.select()` fires `hapticLight` only on index change; TimerDial throttles to 60 ms.
- **Deload caching:** `initResolvedPlan`/`invalidatePlanCache` wired through `planStore.reloadPlan()` on every plan/pause write.
