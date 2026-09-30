# AUDIT — home + hermes + analytics + settings (read-only, 2026-09-30)

Baseline: `npm run test:unit -- --run` → 31 files / 318 tests, all passed.

Checked and found OK (invariants hold):
- HomePage loadAll ordering: `await loadRecovery()` (HomePage.vue:681) precedes the parallel batch containing `loadBriefing()` (line 687); loadBriefing reads `recovery.value` with the "guaranteed set" comment (line 292). Invariant intact.
- resolveBriefingVerdict consumes NO pushed Hermes level — ladder is sick > deload > local recovery engine only (briefingVerdict.ts:63-97); HomePage overwrites `level` with `resolved.level` (HomePage.vue:295-303).
- Widget push: HomePage always pushes `briefingLevel: resolved.level` (non-null, HomePage.vue:308-313); widgetBridge merges over the localStorage snapshot mirror and re-stamps themeStyle on every push (widgetBridge.ts:31-48), so full-replace on the Java side can't blank sibling widgets.
- Battery chart destroyed in onUnmounted (HomePage.vue:731); GymPage chart destroyed in onUnmounted (AnalyticsGymPage.vue:543); windowDays watch uses flush:'post' (GymPage:537).
- Settings: notification toggles default OFF (`=== '1'`, userSettings.ts); scheduleDailyReminder checks permission before schedule (notifications.ts:48-56); import flow exports an auto-backup to Documents before `importDatabaseFromSQL` and reloads after success (SettingsPage.vue:546-564).
- Double-loader on HomePage fixed (onMounted no longer calls loadAll, HomePage.vue:734-739); all styles in audited files are `<style scoped>`; heatmap/life-event queries are limit-bounded with a 4000-day sick-map cap.

---

## finding

**title:** getReviewDigest (+ queryReadinessHistory, getNetWorthHistory, queryMonthlySpending) compute day boundaries with UTC `date('now')` against local date keys

- **file:line:** src/shared/db/app_db.ts:2576-2584 (getReviewDigest), 2541 (queryReadinessHistory), 3099 (getNetWorthHistory), 3120 (queryMonthlySpending)
- **symptom:** In UTC+2 between local midnight and 02:00, `date('now')` evaluates to the previous local day, so the rolling "last 7/30 days" windows end one day early: sleep/readiness averages, spend totals, and net-worth deltas silently drop the newest local day. The project invariant (checklist + localDateISO docblock in timeFormat.ts) says day keys must be computed in TS via localDateISO and passed as params — workout/volume subqueries in the same function do use `'localtime'`, the sleep/readiness/finance/net-worth ones don't.
- **evidence:** `db.query(\`SELECT AVG(score) AS v FROM sleep_session WHERE score IS NOT NULL AND date >= date('now', ?);\`, [since])` (app_db.ts:2578) and `... WHERE date >= date('now', ?);` [`-${days} days`] (app_db.ts:2541, 3099) — while line 2576 uses `date(time_start, 'localtime') >= date('now', ?, 'localtime')` in the same function.
- **severity:** medium
- **confidence:** high (pattern certain; user-visible impact bounded to the UTC-offset hours around local midnight)

## finding

**title:** Battery "event drain" is inert — `todayEvents` ref has no writer since the debloat commit removed the calendar loader

- **file:line:** src/features/home/pages/HomePage.vue:432 (ref), 462, 615 (consumers)
- **symptom:** `todayEvents` is declared and passed into `calculateBattery` (battery computed, line 462) and `buildBatteryChart` (line 615), but nothing ever assigns it — commit f660f31 ("Debloat") deleted the `getCalendarEventsForDate(todayStr).then((evs) => { todayEvents.value = evs; })` loader. The event-drain term in healthConnect.ts (line 1093-1098) always reduces over an empty array, `drainParts` can never show the "−N events" component, and the battery timeline chart never reflects calendar events. Dead state + a silently regressed advertised battery input.
- **evidence:** `const todayEvents = ref<Record<string, any>[]>([]);` (line 432); grep for `todayEvents.value =` returns only reads at 462 and 615; `git show f660f31 -- src/features/home/pages/HomePage.vue` shows `-    getCalendarEventsForDate(todayStr).then((evs) => { todayEvents.value = evs; }),`
- **severity:** low
- **confidence:** high

## finding

**title:** TrainingLoadOverlay and HealthHeatmap capture `todayKey = localDateISO()` once at setup — goes stale across midnight on kept-alive pages

- **file:line:** src/features/analytics/components/TrainingLoadOverlay.vue:229; src/features/analytics/components/HealthHeatmap.vue:90
- **symptom:** Both components are mounted under Ionic kept-alive pages (AnalyticsGymPage / AnalyticsOverviewPage). If the app stays open (or is resumed without process death) past local midnight, the overlay's ACWR/recovery axis still ends at yesterday and the heatmap keeps painting today's cell as "future" until the component is torn down and remounted. AnalyticsGymPage/AnalyticsOverviewPage/HermesPage all recompute `localDateISO()` per load — these two don't.
- **evidence:** `const todayKey = localDateISO();` (TrainingLoadOverlay.vue:229, HealthHeatmap.vue:90) with no refresh on `onIonViewWillEnter`; contrast AnalyticsGymPage.vue:414/448/529 which call `localDateISO()` inside the load path.
- **severity:** low
- **confidence:** high (stale capture is certain; impact requires an open app across midnight)

## finding

**title:** Hermes push notification IDs can collide for messages ~16.7 min apart, silently dropping a notification

- **file:line:** src/shared/hermes/hermesPush.ts:85
- **symptom:** `id = ID_HERMES_BASE + ((msg.receivedAt % 1000) + seq) % 900`. Two messages whose receivedAt values differ by exactly 1000 s map to the same base id, and when one poll delivers both (limit=5 spans a >1000 s gap), the second schedule() with the same id replaces the first on Android — the comment's claim "keeps distinct messages from overwriting each other" doesn't hold.
- **evidence:** `id: ID_HERMES_BASE + ((msg.receivedAt % 1000) + seq) % 900,` with comment "Stable per-message id: arrival second + seq keeps distinct messages from overwriting each other".
- **severity:** low
- **confidence:** medium (math certain; requires a same-poll gap of exactly N×1000 s, rare in practice)

## finding

**title:** AnalyticsGymPage and HealthHeatmap load() without a stale-response token — TrainingLoadOverlay has one, they don't

- **file:line:** src/features/analytics/pages/AnalyticsGymPage.vue:281-296, 534-541; src/features/analytics/components/HealthHeatmap.vue:158-213
- **symptom:** GymPage's `loadAll` runs from both the windowDays watcher and `onIonViewWillEnter`; rapid window-switch + re-entry can let a slower earlier query resolve last and render the wrong window's muscle-volume/frequency data (checklist: "scrub state not reset on data swap" / double-loader class). TrainingLoadOverlay guards this with a monotonic `loadToken` (lines ~576-600); HealthHeatmap only checks its `cancelled` flag once, before the plans/pauses follow-up queries, and has no token at all.
- **evidence:** TrainingLoadOverlay.vue: `let loadToken = 0; const load = async () => { const token = ++loadToken; ... if (token !== loadToken) return; ... }` vs AnalyticsGymPage.vue:281 `const loadAll = async () => { const [volume, tonnage, freq] = await Promise.all([...]); muscleVolume.value = volume; ...` with no token.
- **severity:** low
- **confidence:** medium (race window real but narrow)

## finding

**title:** Deload verdict reason interpolates a dead constant: `${Math.round(67.5)}` always renders "68%"

- **file:line:** src/shared/utils/briefingVerdict.ts:79
- **symptom:** The deload reason string interpolates `Math.round(67.5)` — a compile-time constant (68). Either a leftover placeholder where a computed target-percentage was intended, or pointless obfuscation of a literal; if a real per-plan target was meant, the widget/card shows a hardcoded 68% for every deload.
- **evidence:** ``reason: `Planned deload — work around ${Math.round(67.5)}% of last time.` ``
- **severity:** low
- **confidence:** high (code fact; intent unverifiable in a read-only audit)
