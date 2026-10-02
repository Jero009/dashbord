# Redundancy & visual-consistency audit — dashbord (zai, 2026-10-01)

Baseline: `npm run lint` clean · `npm run test:unit -- --run` 31 files / **320 passed** · `npm run build` exit 0.
Scope swept: `src/features/**`, `src/shared/**`, `src/theme/*.css`, `tests/`, `android/app/src/main/{java,res}`. No source files modified. Pre-existing working-tree changes (HomePage.vue, RELEASE_NOTES_v3.21.1.md, AUDIT_VISUAL_2026-10-01.md) untouched.

---

## F1 — Three feature SectionTabs components are copy-paste clones
**Severity: MED** · Confidence: HIGH · Est. deletion: **~160 LOC**

- `src/features/analytics/components/AnalyticsSectionTabs.vue:1-84`
- `src/features/finance/components/FinanceSectionTabs.vue:1-98`
- `src/features/health/components/HealthSectionTabs.vue:1-89`

Evidence: the `<style scoped>` blocks are **byte-identical** (same md5 `a2a0b86…` after normalizing feature names; unnormalized `<style>`-to-EOF also identical). Script logic is the same pattern: `activeSegment` computed from `route.path.includes(...)`, `handleSegmentChange` with hapticLight + route map + `router.push`. Only the segment value/label list and the route map differ.

Why the primitive suffices: a single `SectionTabs.vue` taking `segments: {value, label, path}[]` and deriving `activeSegment` from the current path covers all three. This is exactly the shape the repo already used to dedupe finance page primitives in v3.21.1.

Smallest change: one shared component in `src/shared/components/`, three pages swap the import and pass their segment array.

Rejected alternative: merging them into DashboardTopBar — no, these are per-feature second-level tabs, genuinely distinct from the global tab bar.

## F2 — seg-pill/ion-segment CSS duplicated 4× (incl. DashboardTopBar)
**Severity: MED** · Confidence: HIGH · Est. deletion: **~70 LOC**

- `src/shared/components/DashboardTopBar.vue:145-165` (`.seg-pill`, `ion-segment`, `ion-segment-button`)
- `src/features/analytics/components/AnalyticsSectionTabs.vue:63-84` — byte-identical block
- `src/features/finance/components/FinanceSectionTabs.vue` — byte-identical block
- `src/features/health/components/HealthSectionTabs.vue` — byte-identical block
- Near-copy variant: `src/features/analytics/components/HealthHeatmap.vue:234-243` (`.seg-pill` + `.heat-seg`, same token recipe, minor deltas)

Evidence (DashboardTopBar = SectionTabs, verbatim): `background: var(--nt-tile); border-radius: 999px; padding: 6px;` and the full `ion-segment-button` override set (`--color-checked: var(--ion-color-accent-red)`, `min-height: 34px`, `border-radius: 999px`).

Smallest change: promote `.seg-pill` + segment-button overrides to a global class in `src/theme/variables.css` (next to `.nt-kicker`/`.nt-metric-tile`); delete the four scoped copies. F1 removes three of the four anyway; DashboardTopBar and HealthHeatmap still benefit.

## F3 — Ring gauge implemented twice (HomePage readiness ring vs SleepPage sleep ring)
**Severity: MED** · Confidence: HIGH · Est. deletion: **~60 LOC**

- `src/features/home/pages/HomePage.vue:63-76` (markup), `1118-1176` (`.readiness-ring*` CSS) + `.battery-ring` at `881-887`
- `src/features/health/pages/SleepPage.vue:23-32` (markup), `715-775` (`.sleep-ring*` CSS)

Evidence: same SVG recipe in both — `viewBox="0 0 120 120"`, two `<circle cx=60 cy=60 r=46>`, `stroke-width: 12`, `stroke-dasharray: 289`, `transform: rotate(-90deg)`, track `rgba(var(--nt-ink), 0.08)`, progress `var(--ion-color-accent-red)` with round linecap, absolutely-centered content (`strong` numeral + `span` label), same font treatment. Differences are only the drive mechanism (HomePage binds `strokeDashoffset` inline; SleepPage uses a `--score` CSS var — both are `289 - 289·ratio`) and max width 260 vs 200.

Smallest change: one shared `NtRing.vue` (props: `ratio`, `color?`, slot for center content) — or the even lazier cut: keep two components' markup but move the ~55 lines of shared ring CSS into one global `.nt-ring` class. Doto-numeral display stays per-skin via existing tokens, so skin-agnosticism is preserved.

## F4 — `.card-topline` re-declared scoped in 5 pages despite canonical global in finance.css
**Severity: MED** · Confidence: HIGH · Est. deletion: **~30 LOC**

Canonical: `src/theme/finance.css:32-37` — `display:flex; justify-content:space-between; align-items:center; gap:12px;`

Scoped copies that shadow it (v3.21.1 explicitly forbids re-declaring these — "a scoped copy silently shadows the global and re-opens the drift"):
- `src/features/home/pages/HomePage.vue:831-836` (same, minus the gap-12 global it duplicates)
- `src/features/gym/pages/GymHomePage.vue:608-613`
- `src/features/gym/pages/PlanPage.vue:247-251` (+ `.card-topline .nt-kicker` margin reset at 253-255)
- `src/features/health/pages/SleepPage.vue:629-634` (**drifted**: `margin-bottom:16px`, no gap)
- `src/features/health/pages/VitalsPage.vue:246-252` (**drifted**: `gap:8px; margin-bottom:14px`)

The drift is visible: Sleep/Vitals add their own bottom margins instead of the shell gap — the exact failure mode finance.css was created to stop.

Smallest change: delete the five scoped blocks; if Sleep/Vitals want breathing room after the topline, add one margin utility or fold it into the card body gap. (Note: finance.css is loaded globally in main.ts, so the class resolves on every page, not just finance pages.)

## F5 — Empty-state text styled 7 different ways next to canonical `.nt-empty`
**Severity: LOW-MED** · Confidence: HIGH · Est. deletion: **~35 LOC**

Canonical: `.nt-empty` — `src/theme/variables.css:759-763` (`margin:0; font-size:0.9rem; color:var(--nt-text-dim)`). 12 feature files already use it.

Parallel unshared copies:
- `.empty-copy` ×5: `AnalyticsOverviewPage.vue:449-454`, `ExerciseDetailPage.vue:549-553`, `FinanceAnalyticsPage.vue:453-456`, `TrainingLoadOverlay.vue:804`, `HermesPage.vue:454-457` (**drifted**: 0.8rem + `--nt-text-dim` vs siblings' `rgba(var(--nt-ink),0.6)` 0.9rem)
- `.empty-hint`: `HealthPage.vue:678`
- `.empty-text`: `BodyPage.vue:529-533`

All are the same declaration set (margin 0 / dim ink / 0.8–0.9rem) with minor drift. Smallest change: swap the class names to `nt-empty` in markup and delete the seven scoped blocks; keep any one-off line-height where it matters.

## F6 — Stage colors: raw literals duplicated in SleepPage vs canonical `STAGE_COLORS`
**Severity: MED (encoding-drift risk, standing-rule violation)** · Confidence: HIGH · Est. deletion: **~10 LOC**

Canonical: `src/shared/utils/stageBarsGeom.ts:31-36` — `STAGE_COLORS` ("identical encoding to the hypnogram/stage dots (theme contract)"), already consumed by `StageBarsChart.vue:22`.

SleepPage re-declares the same palette as raw literals instead of importing it:
- `src/features/health/pages/SleepPage.vue:543-548` (`rgba(255,215,0,.95)`, `rgba(45,212,238,.95)`, `rgba(58,99,216,.97)`, `rgba(130,170,250,.95)`)
- `src/features/health/pages/SleepPage.vue:849-853` (`.stage-dot--*`, same values again — second copy inside the same file)
- `src/shared/components/StageBarsChart.vue:45-47` renders legend dots via the **same class names** but relies on SleepPage's scoped `.stage-dot` CSS — those rules are scoped to SleepPage (`data-v-657160ec`, confirmed in the built `SleepPage-Dbv0b3_M.css`), so StageBarsChart's legend dots only get colored when both mount on SleepPage. Fragile coupling.

Smallest change: export the dot CSS as a small global block (or have StageBarsChart inline `STAGE_COLORS[stage]` as `:style`), and make SleepPage bind `STAGE_COLORS[key]` instead of its two literal sets. Kills ~10 LOC and removes a cross-file scoped-CSS dependency.

## F7 — Widget stage palette contradicts the app-wide stage encoding
**Severity: MED** · Confidence: MEDIUM-HIGH (needs owner call on which side is canonical) · Est. deletion: ~0 (fix is recolor)

- `android/app/src/main/java/io/ionic/starter/SleepStagesWidgetProvider.java:28-33` — `COLOR_DEEP=0xFF384860`, `COLOR_LIGHT=0xFF71717A`, `COLOR_REM=0xFFE5C158`, `COLOR_AWAKE=0xFFD71A21` under the comment "Fixed app-wide stage colors (match the Vue charts)".

They don't match: app deep = `rgb(58,99,216)` (blue) vs widget `rgb(56,72,96)` (grey-blue); app REM = cyan `rgb(45,212,238)` vs widget gold `rgb(228,193,88)`; app awake = **gold** (`--nt-data-goal`) vs widget **red**. Awake↔REM hues are effectively swapped/different — the same night renders a different color code in the app and on the widget. This violates the standing "data colors identical everywhere (stage colors are fixed app-wide)" rule. Smallest change: decide the canonical palette (the Vue one, since it's token-driven) and port exact ARGBs into the provider.

## F8 — widget_sleep_battery classic vs OS5 geometry drift
**Severity: MED (AGENTS.md: skins must be geometry-identical)** · Confidence: HIGH · Est. deletion: 0 (align values)

`android/app/src/main/res/layout/widget_sleep_battery.xml` vs `widget_sleep_battery_os5.xml` differ beyond fonts/colors:
- root `padding` 14dp vs 16dp; ring `layout_marginStart` 14dp vs 16dp
- score `textSize` 26sp vs 24sp

All four other widget pairs (activity, briefing, sleep, sleep_stages) diff to **0** geometry lines. Per the skill/AGENTS rule ("a geometry fix landed in only one of the pair ships a mismatched other skin"), these three values should be aligned (14dp / 26sp is the classic baseline; OS5 should keep it and only swap fonts/colors/background).

## F9 — Dead exports: 6 app_db functions + 3 shared utils with zero references
**Severity: LOW-MED (dead code)** · Confidence: HIGH (name-grepped across `src/`, `tests/`, including `db.`-prefixed wildcard usage) · Est. deletion: **~120 LOC**

Every symbol below appears exactly once repo-wide — its own export line:
- `src/shared/db/app_db.ts:1114` `getPlanById` · `:1138` `updatePlan` · `:1179` `archivePlan` · `:1194` `getOpenPause` · `:1288` `updateLifeEventEndDate` · `:2008` `updateWorkoutExerciseOrder` (note: the *plural* `updateWorkoutExerciseOrders` at :2019 IS used)
- `src/shared/utils/chartStyle.ts:64` `chartGoalDataset`
- `src/shared/utils/glyphMatrix.ts:92` `glyphIsReady`
- `src/shared/utils/haptics.ts:10` `hapticWarning`

Caveat before deleting: these are Plan-feature CRUD primitives from the v3.16 build; if the upcoming "briefing reads plan config from receiver" work plans to call them, keep that one. Otherwise delete (git history preserves them). `chartGoalDataset` was superseded by TrendChart's `goal` prop.

## F10 — HomePage `todayEvents` ref is never populated (dead path through battery compute)
**Severity: LOW** · Confidence: HIGH · Est. deletion: **~8 LOC**

`src/features/home/pages/HomePage.vue:443` declares `todayEvents = ref([])`; there are **zero** assignments (`grep -c 'todayEvents.value\s*='` → 0). It flows into `calculateBattery` at :473 and the battery chart at :626, so the event-drain branch (`healthConnect.ts:1124-1136`) can never contribute. Already known to FIXPLAN ("todayEvents dead ref", DEFERRED) — reconfirmed still true. Smallest change: drop the ref, pass `[]` literal at both call sites, or delete the `events` parameter if the calendar feature is confirmed gone (it is — no Plan/Calendar module per AGENTS.md).

## F11 — `.range-btn` chart-range chips duplicated with divergent active styles
**Severity: LOW-MED (visual inconsistency)** · Confidence: HIGH · Est. deletion: **~25 LOC**

- `src/features/health/pages/VitalsPage.vue:254-273`: `.range-selector`/`.range-btn`/`.range-btn.active` — active = **outline** (`border-color: var(--nt-fg)`)
- `src/features/health/pages/BodyPage.vue:562-586`: `.chart-range-btns`/`.range-btn`/`.range-btn--active` — active = **red fill** (`background: var(--ion-color-accent-red)`)

Same control, same page-feature (health), two different visual encodings of "selected". One shared chip (or the existing pill pattern) with a single active treatment; ~25 LOC and one inconsistency removed.

## F12 — AnalyticsOverviewPage `.tile` re-implements `.nt-metric-tile`
**Severity: LOW** · Confidence: HIGH · Est. deletion: **~20 LOC**

`src/features/analytics/pages/AnalyticsOverviewPage.vue:364-395` (`.tile-grid`/`.tile`/`.tile__label`/`.tile__value`) vs `src/theme/variables.css:737-756` (`.nt-metric-tile`): same `padding: 12px 14px`, `background: var(--nt-tile)`, `border-radius: 10px`, uppercase dim label. The local copy centers content and adds a 3-col grid (the global has `--full` modifier instead). Same parallel copy pattern appears in `AnalyticsGymPage.vue`, `AnalyticsReviewPage.vue`, `TrainingLoadOverlay.vue`, `WorkoutSummaryModal.vue`, `ExerciseDetailPage.vue`, `HermesPage.vue` (all use `class="tile"` markup — verify each before migrating; the shared class needs a centered variant or pages keep their grid wrapper only).

## F13 — SleepPage hypnogram legend duplicates StageBarsChart legend
**Severity: LOW** · Confidence: HIGH · Est. deletion: **~15 LOC**

`src/features/health/pages/SleepPage.vue:108-112` + CSS `809-821` vs `src/shared/components/StageBarsChart.vue:44-48` + CSS `229-241`: identical markup shape (`<i class="stage-dot stage-dot--{key}">` + label) and near-identical CSS (`display:flex; gap:12px; font-size:0.68rem; color:rgba(var(--nt-ink),0.5)`). Merge with F6's shared stage-dot/legend block: one global `.stage-legend` + `.stage-dot--*` set, two consumers.

## F14 — TimerDial bypasses the haptics util
**Severity: LOW** · Confidence: HIGH · Est. deletion: ~2 LOC

`src/features/gym/components/TimerDial.vue:97` imports `Haptics` from `@capacitor/haptics` and calls `Haptics.selectionChanged()` directly (:222). Every other consumer (27 files) routes through `hapticSelect()` in `src/shared/utils/haptics.ts`, which no-ops off-native. Smallest change: swap to `hapticSelect()`, drop the import.

---

## Tempting consolidations REJECTED (YAGNI)

1. **TrainingLoadOverlay's hand-rolled SVG scrub → useChartScrub**: not actually duplication — `useChartScrub` is Chart.js-canvas-specific (scale pixel math, `chart.draw()`); the overlay is pure SVG with a uniform slot grid. Forcing it under the composable means inventing an abstraction with two backends for two callers. The overlay already honors the contract (haptic-on-change, capture, readout). Leave it; its comment even says it mirrors TrendChart's select pattern.
2. **HomePage battery Chart.js line → TrendChart**: the past/future split with two datasets joined at "now" is expressible via `overlayPts`, but this was already reviewed in earlier passes; the chart also gates on `baseline` and uses `chartLineDataset/chartDimDataset` shared configs. Borderline — defer unless the chart is being touched anyway.
3. **Merging `queryMonthlySpending`/`getFinanceMonthTotals`/`getFinanceTransactionsForMonth`**: distinct return shapes (rows vs totals vs rows-for-edit); merging would create a flag-param monster. No.
4. **FinanceBudgetPage budget-vs-actual duplication**: explicitly kept per AGENTS.md (carries the edit/delete flow). Still no.
5. **Unifying the two widget *snapshot* providers' draw code**: `SleepStagesWidgetProvider.drawTimeline` is already static+shared-ready; cross-provider extraction of battery-ring drawing would touch all four providers for one caller each. No.
6. **`clamp` re-inlines** (11 sites of `Math.max(a, Math.min(b, x))` in .ts compute files): real, but each is one line in hot pure functions inside files that already import from `math.ts` elsewhere; a mechanical sweep churns tested scoring code for zero behavioral gain. Note it, don't churn it now.
7. **Deleting NtCard.vue/NtMetric.vue vs adopting them**: NtCard/NtMetric (`src/shared/components/NtCard.vue:1-4`, `NtMetric.vue:1-17`) are imported **nowhere** — pages use the global `.nt-kicker`/`.nt-metric-tile` classes directly, which AGENTS.md calls canonical. Either delete both wrappers (~35 LOC, my recommendation: they're unused scaffolding) or start adopting them — but "keep an unused wrapper of a canonical class" is the worst of the three. Listed here rather than as F15 because the owner should pick a direction.

## Totals
- Findings: **14** (F1–F14) + 1 decision item (NtCard/NtMetric)
- Estimated deletable/consolidatable LOC: **~560** (160+70+60+30+35+10+120+8+25+20+15+35 ≈ 588 minus overlap between F1/F2 ≈ 560)
- Highest-value order: F2+F1 (one shared pill/tabs pass) → F4 (shadowed globals, active rule violation) → F3 → F6+F13 (encoding integrity) → F7/F8 (widget parity) → rest.
