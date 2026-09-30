# Finance feature audit — src/features/finance/** (+ finance queries in src/shared/db/app_db.ts)

Baseline: `npm run test:unit` → 31 test files / 318 tests, all passing.

## finding: Editing a transaction silently wipes its notes
- file:line: src/features/finance/pages/FinanceBudgetPage.vue:432 (with src/shared/db/app_db.ts:2952)
- symptom: Opening "Edit transaction" on any imported row (e.g. PayPal import with `notes = "PayPal fee 1.20"`) and pressing Save destroys the note. The edit form has no notes field and the save path hard-codes `undefined`, which `updateFinanceTransaction` stores as NULL (`notes ?? null`), overwriting the existing value.
- evidence: `await updateFinanceTransaction(editingTransactionId.value, transactionDate.value, transactionName.value.trim(), category, amount, transactionType.value, undefined, transactionAccountId.value)` — 7th arg (notes) is `undefined`; DB: `SET date = ?, name = ?, category = ?, amount = ?, type = ?, notes = ?, account_id = ? WHERE id = ?` with `[date, name, category, amount, type, notes ?? null, accountId ?? null, id]`.
- severity: MED
- confidence: HIGH

## finding: Finance SQL uses UTC `date('now')` day/month boundaries, diverging from local-date keys in UTC+2
- file:line: src/shared/db/app_db.ts:3099 (getNetWorthHistory), src/shared/db/app_db.ts:3120 (queryMonthlySpending)
- symptom: Transaction dates and net-worth snapshot dates are stored as local-date keys via `localDateISO()`, but the window filters are computed from SQLite's UTC clock. Between 00:00–02:00 local (Slovenia, UTC+2) on the 1st of a month, `date('now','start of month', ?)` still resolves to the *previous* UTC month, so the Analytics "Income vs spending" trend misses the just-started local month and shows a shifted 6-month window; similarly `getNetWorthHistory`'s `date('now', '-N days')` start boundary is off by a day in the evening. The rest of the codebase deliberately avoids this class of bug (comments in app_db.ts:2877-2879, financeDates.ts).
- evidence: `WHERE date >= date('now', ?)` `[`-${days} days`]` (line 3099); `WHERE date >= date('now', 'start of month', ?)` `[`-${months - 1} months`]` (line 3120). Contrast with `getFinanceMonthTotals` / `queryCategorySpending`, which correctly take a local `monthKey` param.
- severity: MED
- confidence: HIGH (mechanism certain; impact limited to boundary hours/days)

## finding: parseCSV never terminates a row on lone CR — CR-only files parse as one giant row
- file:line: src/features/finance/import/parseCSV.ts:67-68
- symptom: The `\r` branch only does `i++` and relies on a following `\n` to call `pushRow()`. For files with lone-CR line endings every row is concatenated into a single row, so profile header detection and `mapRows` fail ("no mappable rows" or garbage mapping). The inline comment claims the opposite behavior.
- evidence: `} else if (ch === '\r') { i++; // consume \r\n or lone \r as row end` — no `pushRow()` in this branch; `pushRow()` is only reached from the `'\n'` branch (line 69-71).
- severity: MED
- confidence: HIGH (code contradicts its own comment); likelihood low (CR-only files are rare)

## finding: postDueSubscriptions check-then-act race allows duplicate auto-posted transactions
- file:line: src/shared/db/app_db.ts:2875-2912 (called from src/features/home/pages/HomePage.vue:700 and src/features/finance/pages/FinancePage.vue:310)
- symptom: The idempotency guard is read `last_posted_date`, then insert, then stamp — with `await` gaps between. Two loaders can run concurrently (quick Home↔Finance navigation; HomePage also calls it on entry). Interleaving A-read → B-read → A-insert → B-insert posts the same period twice; `last_posted_date` ends correct but a duplicate finance_transaction row remains. There is no UNIQUE constraint on (subscription-period) to backstop it.
- evidence: `const subs = await getFinanceSubscriptions();` … `if (s.last_posted_date === due) {…}` … `await addFinanceTransaction(due, …)` … `await db.run('UPDATE finance_subscription SET last_posted_date = ?, …')` — classic TOCTOU across awaited calls, invoked from two page entry hooks with `.catch(() => {})`.
- severity: MED
- confidence: MED (window is small but real; no DB constraint mitigates it)

## finding: DB errors on Analytics/Investments/Accounts pages render as "no data" with no failure flag
- file:line: src/features/finance/pages/FinanceAnalyticsPage.vue:173-174,183; src/features/finance/pages/FinanceInvestmentsPage.vue:226-227; src/features/finance/pages/FinanceAccountsPage.vue:173-174
- symptom: All loads use `.catch(() => [])`. Unlike FinancePage (which has the `settled()`/`failed` per-card flags), a broken SQL statement here is indistinguishable from an empty ledger — the user sees "No expenses", "No investments", "No accounts yet" forever with no error hint. The checklist notes always-empty results usually mean broken SQL, not missing data.
- evidence: `queryCategorySpending(viewedMonth.value).catch(() => [])`, `getFinanceBudgets().catch(() => [])`, `queryMonthlySpending(6).catch(() => [])`, `getFinanceInvestments().catch(() => [])`, `getFinanceAccounts().catch(() => [])`.
- severity: LOW
- confidence: HIGH

## finding: Global `fxCacheAt` timestamp keeps all cached FX rates fresh indefinitely
- file:line: src/features/finance/prices.ts:107-122
- symptom: TTL check is `fxCache.has(key) && Date.now() - fxCacheAt < FX_TTL_MS`, but `fxCacheAt` is a single shared timestamp updated on *every* set. With ≥2 foreign quote currencies fetched in the same refresh (typical stock+fund portfolio), each new pair resets the clock, so the older pair never expires — portfolio values keep being converted with a stale ECB rate for the whole app session instead of ≤1h.
- evidence: `let fxCacheAt = 0;` … `if (fxCache.has(key) && Date.now() - fxCacheAt < FX_TTL_MS) return fxCache.get(key)!;` … on each successful fetch: `fxCache.set(key, rate); fxCacheAt = Date.now();`
- severity: LOW
- confidence: HIGH

## finding: Kept-alive Budget/Analytics pages never reset viewedMonth on re-entry
- file:line: src/features/finance/pages/FinanceBudgetPage.vue:278; src/features/finance/pages/FinanceAnalyticsPage.vue:133
- symptom: `viewedMonth` is initialized once at setup time (`ref(localMonthKey(new Date()))`) and `onIonViewWillEnter` never recomputes it. Ionic keeps these pages alive in the router outlet, so after a month rollover (or resuming the app in a new month) the Budget page silently re-loads and displays the *old* month's transactions as if current; the user must notice the header and tap "next". Only the Analytics "next" button becoming enabled hints at it.
- evidence: `const viewedMonth = ref(toLocalDateKey(new Date()).slice(0, 7));` (Budget:278) / `const viewedMonth = ref(localMonthKey(new Date()));` (Analytics:133); loaders `loadBudgetData`/`loadMonth` reuse `viewedMonth.value` without ever resetting it on `onIonViewWillEnter`.
- severity: LOW
- confidence: HIGH
