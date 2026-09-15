# v3.8 — gym charts up to v3.x scrub standard

## Changed
- **Every remaining gym chart now has the v3.x scrub interaction** — whole-surface finger scrub, hairline + marker at the selected index, readout row that defaults to the latest point and follows the finger, `hapticLight` on selected-index change:
  - **Exercise detail** (`/exercise/:id`): Strength chart (top set + est. 1RM) is now a TrendChart with a dim overlay line for the 1RM estimate; Volume-per-session bar chart keeps Chart.js rendering but gained the shared scrub (new `useChartScrub` composable) with a readout row
  - **Gym Home** (`/tabs/Home`): the per-template tonnage line chart is now a TrendChart (reactive to the template selector, no Chart.js canvas)
  - **Analytics Gym** (`/analytics/gym`): Weekly tonnage is now a TrendChart; Volume-by-muscle-group keeps its horizontal Chart.js bars but gained the same vertical scrub + readout row
- `TrendChart.vue` gained an optional `overlayPts` prop — a secondary dim dashed line sharing the main series' x-axis and y-extent (used for est. 1RM over top set)
- Data pipelines and the Chart.js `.update()`-in-place pattern are unchanged; floating tooltips on scrubbed charts are replaced by the readout row

## Landed since v3.7
- TrainingLoadOverlay + Analytics heatmap brought up to v3.x chart standards (in v3.7)
- Gym charts (exercise detail, gym home, analytics gym) brought up to v3.x chart standards (this release)

**Full changelog:** v3.7...v3.8
