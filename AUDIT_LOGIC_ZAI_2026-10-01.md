# Logic Bug Audit — dashbord (2026-10-01, zai/GLM pass)

Scope: deep data-flow audit of correctness, state, persistence, date/time, async, lifecycle,
database, Health Connect, finance, gym, notification, widget and import/export paths.
Baseline before audit: `npm run test:unit --run` → **31 files / 320 tests PASS**;
`npm run build` → **exit 0** (`✓ built in 22.74s`).
Known/deferred issues listed in FIXPLAN.md (widget stale-fallback, stale `todayKey` in
TrainingLoadOverlay/HealthHeatmap, hermes id collisions, O(n·m) sleep-HR join, ACWR 1500-day
guard, `todayEvents` dead ref) were **not** re-reported unless a new facet was found.

---

## Verified findings

### 1. SpO₂ is fetched, stored and documented as a readiness input, but never wired into the sync's readiness computation — every synced readiness score is structurally understated

- **Severity:** MEDIUM · **Confidence:** HIGH (static, mechanical)
- **Files:** `src/shared/health/healthConnect.ts:953-966` (readinessInputs construction), `:139-142` (spo2Score), `:146-152` (scoredInputs / base floor), `:875-885` (spo2 rows written but never read back)
- **Symptom:** `calculateReadinessScore` supports an 8-point SpO₂ input (`spo2`, `spo2Baseline`, `spo2Readings`) and `AGENTS.md` documents it as live ("SpO₂ readiness input: calculateReadinessScore now includes SpO₂ as an 8-point input"). The sync loop fetches `oxygenSaturation` samples, persists per-day `spo2` health_metric rows, but the `readinessInputs` object passed to `upsertReadinessScore` contains **no `spo2`, `spo2Baseline`, or `spo2Readings` keys at all** — there is not even a rolling SpO₂ baseline accumulator (RHR/HR/RR/HRV each have one; SpO₂ does not).
- **Trigger/reproduction:** Any device with 30 days of granted SpO₂ data. Every readiness_score row written by sync (i.e. all of them) has spo2 = 0 pts.
- **Evidence quote:**
  ```ts
  const readinessInputs = {
        sleepHours: sleepSummary?.timeAsleepHours ?? sleepHours,
        ...
        hrv: hrvByDate.get(date) ?? null,
        steps: stepsByDate.get(date) ?? null,
        rhrBaseline, sleepHrBaseline, respiratoryRateBaseline: rrBaseline, hrvBaseline,
      };   // ← no spo2*, ever
  ```
  and in the scorer: `const scoredInputs = [... 8 entries including inputs.spo2 ?? null]` →
  `base = 24 * (presentCount / scoredInputs.length)`.
- **Data/control-flow explanation:** Two consequences. (a) `spo2Score` is always the `undefined-readings → calculateSpo2Score(spo2 ?? null, baseline ?? null, [])` path → gate inactive (`length < 14`) → 0 pts forever. (b) Because `inputs.spo2 ?? null` is always `null` in `scoredInputs`, `presentCount` caps at 7/8, so the base floor caps at **21 instead of 24** — every readiness score, even on a fully-measured day with stable SpO₂ history, is biased ~3 points low, which feeds the battery baseline, `readinessLow <45` recovery verdicts, and Analytics/Home chips.
- **Why tests miss it:** `tests/unit/readinessScore.spec.ts` tests the scorer directly with `spo2` inputs supplied; nothing tests that the *sync caller* actually supplies them.
- **Fix direction:** In the readiness loop, accumulate a rolling SpO₂ baseline (mirror `rollingHrvValues`: seed from `getHealthMetricValuesBefore('spo2', …)`), pass `spo2: spo2ByDate.get(date)`, the baseline, and the trailing reading array into `readinessInputs`.

### 2. HomePage quick weight-log inserts a new `body_log` row unconditionally — duplicate same-date entries, bypassing the app's own same-date-edit convention

- **Severity:** MEDIUM · **Confidence:** HIGH (static, callers traced end-to-end)
- **Files:** `src/features/home/pages/HomePage.vue:356-366` (`logQuickWeight` → `insertBodyLog`); convention in `src/features/health/pages/BodyPage.vue:245-260` (`existing && !editingEntryId` → open for edit, never double-insert)
- **Symptom:** Tapping quick-log weight on Home twice in one day creates two `body_log` rows with the same `date`. BodyPage's documented same-date behavior ("Same-date entry opens the existing entry for edit") only de-duplicates inside BodyPage's own save path.
- **Trigger/reproduction:** Home → type weight → Log → repeat with a corrected value → two rows for today.
- **Evidence quote (HomePage):**
  ```ts
  const logQuickWeight = async () => {
    ...
    await insertBodyLog({ date: todayStr, weight_kg: val });   // no same-date check
  ```
- **Data/control-flow explanation:** Consumers read "the" entry for a date by first-match or arbitrary tie-break: `getBodyLogs` orders `date DESC, id DESC` so HealthPage `logs[0]` picks the newest id, but `HomePage.loadTodayWeight` uses `logs.find(e => e.date === todayStr)` (first in that order = also newest id) while `getLatestBodyWeight()` (`ORDER BY date DESC LIMIT 1`, no id tiebreak) can return either row depending on scan order — goal-delta and trend views can disagree; the weight sparkline also gains a phantom same-day point.
- **Why tests miss it:** No unit/UI test covers the Home quick-log path; BodyPage's same-date logic is page-local.
- **Fix direction:** In `logQuickWeight`, look up an existing entry for `todayStr` and call `updateBodyLog(existing.id, …)` instead of `insertBodyLog` (mirror BodyPage).

### 3. VitalsPage renders the SpO₂ "7-day mean" with the hardcoded HRV unit — "97 ms" instead of "%"

- **Severity:** LOW (user-visible display correctness) · **Confidence:** HIGH
- **Files:** `src/features/health/pages/VitalsPage.vue:82` (tile), `:159-163` (`meanDisplay`)
- **Symptom:** The SpO₂ card's 7-day-mean tile appends `ms` (the HRV unit) to a SpO₂ percentage; the 30-day-mean tile right below correctly shows `%` via `spo2MeanDisplay`.
- **Evidence quote:**
  ```html
  <div class="nt-metric-tile"><span>7-day mean</span>
    <strong>{{ meanDisplay(spo2Pts.slice(-7)) }}</strong>   <!-- line 82 -->
  ```
  ```ts
  const meanDisplay = (pts) => { ... return `${...} ms`; };  // unit baked in
  ```
- **Why tests miss it:** Pure template/computed formatting, no unit test on the page.
- **Fix direction:** Parameterize `meanDisplay(pts, unit)` or add a `spo2Mean7Display` computed that formats with `%`.

### 4. `queryWorkoutFrequency` and `getSessionLoads` string-compare local-offset `time_start` values against UTC-naive cutoffs — window boundary off by the UTC offset

- **Severity:** LOW-MEDIUM · **Confidence:** HIGH on mechanism, bounded real-world impact
- **Files:** `src/shared/db/app_db.ts:3730-3742` (`queryWorkoutFrequency`: `WHERE w.time_start >= ?` with `daysAgo.toISOString().replace('T',' ').slice(0,19)`), `:3788-3809` (`getSessionLoads`, same pattern; also `ORDER BY w.time_start ASC` at `:3808`)
- **Symptom:** Since v3.19, `time_start` is written as local ISO **with offset** (`2026-09-23T18:04:38+02:00`, `startWorkoutFromTemplate` at `app_db.ts:1755-1757`), while the cutoff is a UTC-naive `YYYY-MM-DD HH:MM:SS` string. Lexicographic SQL comparison therefore compares *local wall-clock text* against *UTC text*: a workout whose true UTC instant falls 0–offset hours before the cutoff is wrongly included (and symmetrically at `ORDER BY`, mixed UTC-naive legacy rows and offset rows sort by incomparable clocks).
- **Trigger/reproduction:** Slovenia (UTC+2). Cutoff `2026-09-30 23:00:00`; workout `time_start = '2026-10-01T00:10:00+02:00'` (= 22:10 UTC, *before* the cutoff) → string `'2026-10-01T…' > '2026-09-30 23:00:00'` → included. Errors the 56/90-day ACWR/recovery windows by up to 2–3 h at the boundary and can misorder sessions in `getSessionLoads`.
- **Why tests miss it:** `workoutMirrorFormat.spec.ts` pins the wire format round-trip, not the SQL window comparisons; unit tests never run against SQLite strings.
- **Fix direction:** Pass a TS-computed cutoff in the *same* format family as stored values (compare `date(w.time_start,'localtime') >= ?` with a local date key, like `getReviewDigest` already does, or normalize cutoffs to local-key day boundaries).

### 5. Hermes push poll can permanently drop messages: seen-stamp advances to the newest fetched row while the fetch window is capped (limit 5)

- **Severity:** LOW · **Confidence:** HIGH (control-flow, no runtime trace)
- **Files:** `src/shared/hermes/hermesPush.ts:100-124` (`pollAndDeliverHermes`), `:49-71` (`fetchHermesMessages(limit = 5)`); same pattern in `src/shared/sync/receiverSync.ts:167-189` (`pullIncremental`, `MAX_PULL_ROWS = 50`)
- **Symptom:** `fetchHermesMessages(5)` returns only the 5 newest receiver rows. If ≥6 messages arrive between 10-minute polls, the stamp advances to the newest delivered message (`markSeenAt(lastDeliveredAt)`), so on the next poll the older overflow messages are filtered out by `m.receivedAt > seen` — they are never delivered and never retried. `pullIncremental` has the identical truncation for grades/briefings (stamp = newest of the ≤50 fetched rows).
- **Evidence quote:** `const fresh = messages.filter((m) => m.receivedAt > seen)` … `if (lastDeliveredAt > seen) markSeenAt(lastDeliveredAt)` — combined with `url: ...&limit=${Math.max(1, limit)}` where limit = 5, nothing re-reads rows older than the returned window.
- **Data/control-flow explanation:** The overlap/dedupe design (2-hour overlap, callers dedupe by `receivedAt`) assumes the fetch window always covers everything newer than the stamp. A capped newest-N fetch breaks that assumption exactly when it matters (burst arrival), silently losing the *oldest* messages — the opposite of the documented "delivery stops at first failure; messages are never lost" contract for the permission case.
- **Why tests miss it:** `receiverSync.spec.ts` tests parsing/stamp math on supplied row arrays; no test simulates more arrivals than the fetch limit between polls.
- **Fix direction:** Advance the stamp only to the oldest fetched row when the result set is at/below the limit is wrong — instead: detect a full page (`messages.length === limit`) and set the stamp to the *minimum* delivered `receivedAt − 1` (or loop until a short page), so the remainder is re-fetched next poll.

---

## Needs reproduction (suspected, not proven — do NOT treat as findings)

### N1. `markSubscriptionPaid` races `postDueSubscriptions` (no shared in-flight guard)
- `src/shared/db/app_db.ts:2870-2893` vs `:2926-2971`. The double-fire fix added a shared `postDueSubscriptionsInFlight` promise, but `markSubscriptionPaid` does its own read→insert→stamp sequence outside that guard. A user tapping "Mark paid" on the Subscriptions page while a Home/Finance `onIonViewWillEnter` auto-post pass is mid-flight for the same subscription could double-post the period (both read `last_posted_date !== due` before either stamps). Needs a live interleaving to confirm; plausible only in a narrow window.

### N2. Legacy (pre-v3.19) UTC-naive `time_start` parsed as local in `getWorkoutsForPlan`
- `src/shared/db/app_db.ts:1317` (`new Date(timeStart.includes('T') || /(?:Z|[+-]\d{2}:?\\d{2})$/.test(timeStart) ? timeStart : timeStart.replace(' ', 'T'))`). Old rows are `CURRENT_TIMESTAMP` (UTC-naive); parsing them as **local** shifts the instant by the UTC offset, so a late-evening legacy workout (≥22:00 local, stored 20:xx–22:xx UTC) gets `localDateISO` of the *previous* day → wrong `planDayIndex`/adherence attribution for pre-v3.19 history. FIXPLAN v3.19 acknowledges the mirror-side symptom but not this in-app plan-window one. Needs a device DB with pre-v3.19 rows to demonstrate; self-heals as legacy rows age out of a plan window.

---

## Explicitly checked and found correct (not re-reported)
- `replaceHealthMetric` NULL-source upsert, `parseSqlStatements` quote/comment handling, import delete/insert ordering + auto-backup + reload, `parseCSV` lone-CR and BOM, `normalizeImportDate/Amount` SI formats, budget left-to-spend category matching, `nextDueAfter` month-end clamps, `recordNetWorthSnapshot` once-per-day idempotency, `postDueSubscriptions` in-flight guard, `getReviewDigest` local cutoff keys, `toDateKey` local-date semantics, steps per-local-day windows, HR 3-day chunked backfill, rest-timer canonical `endTime` state machine (expiry vs cancel paths on all three pages), `promptSessionRpe` backdrop-dismiss resolution, FX per-pair TTL, price-refresh timeout/`writesOk` gating, `scheduleBillAlert` re-arm/disarm lifecycle, `resumeRestTimer` expired-record handling, widget snapshot merge mirror, `localIsoWithOffset` date-only noon anchor.
