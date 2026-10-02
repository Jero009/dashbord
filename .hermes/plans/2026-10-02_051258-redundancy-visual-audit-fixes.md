# Dashbord Redundancy & Visual Audit Fix Plan

> **For Hermes:** Execute with sequential ZAI subagents, one batch per fresh agent. Parent verifies every diff, runs the full gate, and commits each accepted batch. Never run fixers in parallel in this shared worktree.

**Goal:** Implement every safe, verified finding from `AUDIT_REDUNDANCY_ZAI_2026-10-01.md` and the verified follow-up checks in this session, removing dead code and collapsing parallel visual implementations without changing app behavior.

**Architecture:** Reuse the existing global design-system layer (`variables.css`, `charts.css`, `finance.css`) instead of introducing a component framework. Extract only repeated UI with three or more consumers. Keep deliberate custom charts and feature-specific CRUD logic. Fix native-widget parity separately from Vue/CSS so each batch remains reviewable and reversible.

**Tech Stack:** Vue 3 `<script setup>`, Ionic 8, TypeScript, Vitest, Capacitor Android, Java/AppWidget RemoteViews, CSS custom properties.

---

## Locked decisions

1. Scope is the redundancy/visual audit only. Do not implement unrelated findings from `AUDIT_LOGIC_ZAI_2026-10-01.md` or `AUDIT_CROSSCUTTING_ZAI_2026-10-01.md`.
2. No new dependencies.
3. No generic CRUD framework. Finance consolidation is CSS plus tiny proven helpers only.
4. `TrainingLoadOverlay` stays custom SVG; Home battery timeline stays Chart.js.
5. Delete unused `NtCard.vue` and `NtMetric.vue`; canonical primitives remain CSS classes.
6. Vue sleep-stage colors are canonical. Native widget colors must match them.
7. Classic and OS5 widget layouts must be geometry-identical; fonts/colors/backgrounds may differ.
8. Preserve the current uncommitted `HomePage.vue` training-signal/Hermes-toggle changes exactly. Agents may edit other HomePage regions but must not revert or rewrite that diff.
9. Do not build/publish an APK, bump versions, push, or create a GitHub release in this plan. Release is a separate user request.
10. All ZAI fixers edit but do not commit. Parent inspects and commits accepted batches.

## Existing dirty-tree protection

Before Batch 1, parent must:

1. Save `git diff -- src/features/home/pages/HomePage.vue` to the scratch directory for comparison.
2. Record `git status --short`.
3. Treat all existing untracked audit/release-note files as user state; never delete or stage them accidentally.
4. Use explicit `git add <batch files>` rather than `git add -A`.
5. After every batch touching HomePage, compare the training-signal diff against the saved patch.

---

## Batch 1 — Design-system primitives and section tabs

**ZAI agent scope:** shared UI primitives, section tabs, global CSS, finance form CSS. No health chart/widget code and no DB cleanup.

### Task 1.1: Add regression coverage for shared section tabs

**Files:**
- Create: `tests/unit/sectionTabs.spec.ts`
- Create: `src/shared/components/SectionTabs.vue`

**RED:** Write tests that mount a shared tabs component with a three-entry route list and verify:
- the correct segment is active for a nested route;
- changing segment pushes the mapped path once;
- unknown routes fall back to the configured overview entry;
- no navigation occurs when selecting the current path.

Run: `npm run test:unit -- --run tests/unit/sectionTabs.spec.ts`
Expected before implementation: FAIL because `SectionTabs.vue` does not exist.

**GREEN:** Implement the smallest data-driven component. Props: `segments: { value: string; label: string; path: string; match?: string[] }[]`, optional `fallback`. Keep haptic navigation through `hapticLight`.

### Task 1.2: Replace the three cloned tab components

**Files:**
- Modify: `src/features/analytics/components/AnalyticsSectionTabs.vue`
- Modify: `src/features/finance/components/FinanceSectionTabs.vue`
- Modify: `src/features/health/components/HealthSectionTabs.vue`

Each file becomes a thin wrapper that passes its route map to `SectionTabs`, or pages import `SectionTabs` directly if that produces less code. Preserve labels, routes, active matching, accessibility, scrollability, and haptic behavior.

Delete the three byte-identical style blocks.

### Task 1.3: Consolidate shared segment-pill CSS

**Files:**
- Modify: `src/theme/variables.css`
- Modify: `src/shared/components/SectionTabs.vue`
- Modify: `src/shared/components/DashboardTopBar.vue`
- Modify only if necessary: `src/features/analytics/components/HealthHeatmap.vue`

Promote the proven `.seg-pill`/segment-button recipe to a namespaced global primitive (`.nt-segment-pill`) and apply it to SectionTabs and DashboardTopBar. HealthHeatmap may use the base plus a compact modifier; do not force its 30px control to the main 34px height.

### Task 1.4: Consolidate card/topline/empty/tile primitives

**Files:**
- Modify: `src/theme/variables.css`
- Modify affected feature pages listed in audit F4/F5/F12

Add only these minimal global primitives:
- `.nt-card`: canonical surface/radius/padding, no feature-specific gap;
- `.nt-card-topline`: flex/space-between/alignment/gap and nested `.nt-kicker { margin: 0; }`;
- use existing `.nt-empty` and `.nt-metric-tile`; add at most one centered/large modifier if required.

Replace exact page-local copies and delete shadowing CSS. Do not convert every card in the app mechanically; migrate only audit-verified identical copies.

### Task 1.5: Finish finance CSS consolidation

**Files:**
- Modify: `src/theme/finance.css`
- Modify: `src/features/finance/pages/FinanceAccountsPage.vue`
- Modify: `src/features/finance/pages/FinanceInvestmentsPage.vue`
- Modify: `src/features/finance/pages/FinanceSubscriptionsPage.vue`
- Modify: `src/features/finance/pages/FinanceBudgetPage.vue`
- Modify: `src/features/finance/pages/FinancePage.vue`

Move only literal duplicate rules into `finance.css`: `.finance-content`, `.form-fields--inline`, `.styled-input/.styled-select`, focus state, `.add-btn`, `.metric-positive`, `.metric-negative`, `.link-btn`, `.field-label`. Keep feature-specific rules such as `.list-item__figs` and `.list-item__gain` scoped.

### Batch 1 verification

- `npm run test:unit -- --run tests/unit/sectionTabs.spec.ts`
- `npm run lint`
- `npm run test:unit -- --run`
- `npm run build`
- Grep confirms the three old tab components contain no copied segment CSS.
- Grep confirms finance pages do not re-declare selectors moved to `finance.css`.
- Parent reviews `git diff`, verifies HomePage training-signal diff is preserved, then commits explicit files:
  - `refactor(ui): consolidate shared visual primitives`

---

## Batch 2 — Health visuals, ring, stage palette, and widgets

**ZAI agent scope:** health/home visual duplication plus native sleep widgets. Do not touch finance or DB APIs.

### Task 2.1: Test a shared progress-ring component

**Files:**
- Create: `tests/unit/NtProgressRing.spec.ts`
- Create: `src/shared/components/NtProgressRing.vue`

**RED:** Test ratio clamping at 0 and 1, expected circumference/dash offset, custom color, and center slot rendering.

Run targeted test and confirm expected failure before implementation.

**GREEN:** Implement the existing 120×120/r46 ring only. Props: `ratio`, optional `color`, optional `sizeClass`; center content via slot. Do not add animation APIs or configuration not used by Home/Sleep.

### Task 2.2: Migrate Home and Sleep rings

**Files:**
- Modify: `src/features/home/pages/HomePage.vue`
- Modify: `src/features/health/pages/SleepPage.vue`

Replace duplicate SVG/CSS with `NtProgressRing`. Preserve Home battery color and Sleep score transition. Remove dead `.readiness-ring` wrapper and redundant CSS geometry declarations. Preserve the existing HomePage training-signal diff exactly.

### Task 2.3: Create one stage-color source for web UI

**Files:**
- Modify: `src/shared/utils/stageBarsGeom.ts`
- Modify: `src/shared/components/StageBarsChart.vue`
- Modify: `src/features/health/pages/SleepPage.vue`
- Add/modify tests: `tests/unit/stageBarsGeom.spec.ts`

**RED:** Extend stage-geometry tests to pin the four canonical colors and verify every stage key maps to a color.

**GREEN:** Import/use `STAGE_COLORS` in SleepPage hypnogram and dot styles via bindings. StageBarsChart must own or directly bind its legend-dot color; it must not depend on parent scoped CSS. Consolidate duplicate legend layout into a shared global `.nt-stage-legend` rule only if both consumers remain identical after migration.

### Task 2.4: Align native widget stage colors

**Files:**
- Modify: `android/app/src/main/java/io/ionic/starter/SleepStagesWidgetProvider.java`
- Create or modify a static-source regression test under `tests/unit/` that reads the Java constants and compares them with the canonical expected ARGB values.

Canonical Android values must correspond to Vue:
- deep `rgba(58,99,216,0.97)`
- light `rgba(130,170,250,0.95)`
- REM `rgba(45,212,238,0.95)`
- awake goal-gold equivalent

Use opaque ARGB only if RemoteViews bitmap rendering cannot use the alpha semantics; document the deliberate alpha choice in one comment.

### Task 2.5: Enforce classic/OS5 widget geometry parity

**Files:**
- Modify: `android/app/src/main/res/layout/widget_sleep_battery_os5.xml`
- Modify: `tests/unit/widgetThemeStyle.spec.ts`

**RED:** Add a geometry-parity assertion for classic/OS5 layout pairs: same IDs and same layout dimensions, padding, margins and text sizes; ignore font family, colors and background drawable.

Confirm it fails on sleep-battery 14/16dp padding, 14/16dp margin, and 26/24sp score size.

**GREEN:** Make OS5 geometry equal to classic while preserving OS5 fonts/colors/background.

### Task 2.6: Unify range and sync controls

**Files:**
- Modify: `src/features/health/pages/VitalsPage.vue`
- Modify: `src/features/health/pages/BodyPage.vue`
- Modify: `src/features/health/pages/HealthPage.vue`
- Modify: `src/features/health/pages/SleepPage.vue`
- Modify global CSS only if a shared class is justified.

Use one neutral selected-state style for chart-range filters. Use existing primary/outline button conventions for Health Connect sync, choosing the same variant for the same action. Replace raw green in `HealthPage.vue` with `--nt-data-positive` plus `color-mix()`.

### Batch 2 verification

- targeted new tests RED then GREEN;
- `npm run lint && npm run test:unit -- --run && npm run build`;
- `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 ./gradlew :app:compileDebugJavaWithJavac` from `android/`;
- grep SleepPage for old raw stage-color literals: zero except sanctioned computed SVG values if technically required and documented;
- diff every `widget_*` vs `widget_*_os5` pair for geometry parity;
- parent verifies HomePage training-signal patch preservation and commits:
  - `refactor(health): unify rings, stage encoding, and controls`

---

## Batch 3 — Gym style isolation and dead UI cleanup

**ZAI agent scope:** gym feature only plus haptics helper usage. No shared primitive redesign.

### Task 3.1: Add style-isolation regression test

**Files:**
- Create: `tests/unit/featureStyleScope.spec.ts`

**RED:** Read every `src/features/**/*.vue` file and fail when it contains a plain `<style>` block without `scoped`. Allow no exceptions unless documented in the test.

Confirm current failure lists exactly the five known pages:
- `WorkoutPage.vue`
- `TemplatePage.vue`
- `GymHomePage.vue`
- `TabsPage.vue`
- `ExercisePage.vue`

### Task 3.2: Scope the five gym pages

Change `<style>` to `<style scoped>` in those files. Verify selectors that intentionally target Ionic overlay DOM are already global elsewhere or convert only those selectors to `:global(...)`; do not blindly scope modal/action-sheet rules that need global reach.

Specifically verify HomePage no longer receives GymHome `.active-card` width/min-height/position and Template/Exercise generic selectors cannot leak.

### Task 3.3: Delete verified dead CSS and use haptic helper

**Files:**
- Modify: `src/features/gym/pages/WorkoutPage.vue`
- Modify: `src/features/gym/pages/ExercisePage.vue`
- Modify: `src/features/gym/components/TimerDial.vue`

Delete only selectors verified to have zero template/script/dynamic-class use:
- `.btn-quickstart`
- `.exercise-slide-host`
- `ion-toast.pr-toast` and header rule
- `.exercise-hero__copy h2`

Replace direct `Haptics.selectionChanged()` with `hapticSelect()` and remove the direct Capacitor import.

### Batch 3 verification

- targeted style-scope test RED then GREEN;
- grep each deleted selector across repo: zero;
- `npm run lint && npm run test:unit -- --run && npm run build`;
- parent commits explicit files:
  - `refactor(gym): isolate page styles and remove dead UI code`

---

## Batch 4 — Dead TypeScript, components, dependencies, and docs

**ZAI agent scope:** deletions only. Every deletion must be preceded by a fresh repo-wide usage search. Skip anything that gained a caller in prior batches.

### Task 4.1: Delete unused component wrappers

**Files:**
- Delete: `src/shared/components/NtCard.vue`
- Delete: `src/shared/components/NtMetric.vue`

Re-verify zero imports/usages after previous batches. Do not delete `.nt-kicker` or `.nt-metric-tile` CSS.

### Task 4.2: Delete dead exports

**Files:**
- Modify: `src/shared/db/app_db.ts`
- Modify: `src/shared/utils/chartStyle.ts`
- Modify: `src/shared/utils/haptics.ts`
- Modify: `src/shared/utils/glyphMatrix.ts`

Fresh-search and delete only zero-caller symbols:
- `getPlanById`
- `updatePlan`
- `archivePlan`
- `getOpenPause`
- `updateLifeEventEndDate`
- singular `updateWorkoutExerciseOrder`
- `chartGoalDataset`
- `hapticWarning`
- `glyphIsReady`

Do not delete plural `updateWorkoutExerciseOrders` or native GlyphMatrix `isReady` transport method.

### Task 4.3: Remove dead habit feature residue

**Files:**
- Modify or delete: `src/shared/utils/habitStats.ts`
- Modify: `src/shared/utils/timeFormat.ts`
- Modify: `src/shared/utils/aiExport.ts`
- Modify/delete corresponding dead-only sections in `tests/unit/habitStats.spec.ts`
- Add a focused `shiftDate` test under `timeFormat` tests if one does not exist.

Move live `shiftDate` into `timeFormat.ts`. Delete `HabitLike`, `isScheduledOn`, `currentStreak`, `bestStreak`, `completionRate` after fresh searches confirm only self-tests use them.

### Task 4.4: Simplify dead battery inputs

**Files:**
- Modify: `src/features/home/pages/HomePage.vue`
- Modify: `src/features/health/pages/HealthPage.vue`
- Modify: `src/shared/health/healthConnect.ts`
- Modify/add battery tests in the existing health test file.

Before behavior change, write tests pinning current battery output for representative baseline/workout/activity inputs with empty events/null circadian. Then remove:
- `todayEvents` ref and casts;
- event parameter/branch if no real caller exists;
- circadian parameter/branch if no real caller exists;
- dead `circadianDrain`/`eventDrain` fields only if not rendered or exported elsewhere.

The resulting outputs for all live callers must remain identical.

### Task 4.5: Remove unused Capacitor plugins

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `android/app/src/main/AndroidManifest.xml`
- Regenerate Capacitor Android files with `npx cap sync android`

Fresh-search then remove:
- `@capacitor/camera`
- `@capacitor/status-bar`
- camera permission if no remaining feature needs it

Do **not** remove `@capacitor/keyboard` without device QA.

### Task 4.6: Correct stale architecture documentation

**Files:**
- Modify: `AGENTS.md`
- Modify: `FIXPLAN.md`

Update the false statements that there is no Plan feature/Plan tab. Document the live Plan routes/components and mark the redundancy-audit items completed by batch/commit. Do not rewrite unrelated historical sections.

### Batch 4 verification

- Fresh grep for every deleted symbol/package.
- `npm install --package-lock-only` only if needed to normalize lockfile after dependency removal.
- `npm run lint && npm run test:unit -- --run && npm run build`.
- `npx cap sync android` and Java compile gate.
- Parent verifies HomePage training-signal patch preservation and commits:
  - `refactor(core): delete unused APIs and dependencies`

---

## Batch 5 — Independent ZAI review and final acceptance

**Agent scope:** report-only review of the accumulated diff. No edits, no commits.

Review for:
- behavior changes hidden inside visual refactors;
- scoped CSS that no longer reaches Ionic overlays;
- shared CSS specificity regressions;
- route matching errors in SectionTabs;
- HomePage training-signal diff loss;
- native widget palette/geometry mismatch;
- imports orphaned by deletions;
- accidental deletion of live plan/Hermes/Glyph paths;
- audit items claimed complete but still present.

Parent then fixes any confirmed review findings itself or dispatches one focused ZAI correction agent. Two consecutive unusable/no-diff agent runs means parent finishes manually.

## Final acceptance gate

1. `git diff --check`
2. `npm run lint`
3. `npm run test:unit -- --run` — all tests pass, count must be reported
4. `npm run build`
5. `npx cap sync android`
6. `cd android && JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 ./gradlew :app:compileDebugJavaWithJavac`
7. Programmatic audit checks:
   - no unscoped `<style>` in `src/features/**/*.vue`;
   - no imports/usages of deleted components/symbols/packages;
   - no scoped copies of selectors promoted to global primitives;
   - all widget skin pairs have identical IDs and geometry;
   - stage colors match across Vue and Java;
   - current HomePage training-signal/Hermes-toggle behavior remains in diff/history.
8. `git status -sb` and explicit list of commits/files changed.
9. Do not claim APK/release/push; those are outside this plan.

## Expected commits

1. `refactor(ui): consolidate shared visual primitives`
2. `refactor(health): unify rings, stage encoding, and controls`
3. `refactor(gym): isolate page styles and remove dead UI code`
4. `refactor(core): delete unused APIs and dependencies`
5. Optional focused correction commit only if review finds a verified issue.

## Risks

- **CSS specificity:** moving scoped rules global can change cascade order. Verify rendered selectors and use namespaced classes, not `!important`.
- **Ionic overlays:** scoped styles do not reach controller-created overlays; keep those rules global or use approved global classes.
- **Dirty HomePage:** agent whole-file rewrites could destroy the current training-signal fix. Use targeted patches and compare against saved diff after every Home-touching batch.
- **Widget colors:** alpha in SVG/CSS and Android bitmap paints is not represented identically. Match hue semantics first and document any necessary opacity difference.
- **Dead Plan APIs:** deletion is safe by current call graph, but git history remains the recovery path. Fresh-search before deletion because earlier batches may introduce callers.
- **Dependency removal:** Capacitor-generated Android files must be refreshed with `npx cap sync android`; package.json-only removal is incomplete.

## Execution status

Completed and verified on 2026-10-02:
- Batches 1–4 implemented and committed.
- Independent three-slice review completed; the one blocking widget-color mismatch was corrected.
- Final acceptance passed: lint, 37 test files / 348 tests, web build, Capacitor sync, and Android Java compile.
