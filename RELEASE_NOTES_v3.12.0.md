# v3.12.0 — Finance upgrade

Big update to the finance section:

## Fix
- Subscription due dates no longer drift one day earlier per period (UTC/local date bug) — calendar-day math everywhere
- Upcoming-bills horizon counted by calendar days, not UTC parse time

## New
- **CSV import** — bank (NLB-style: Datum/Opis/Znesek, SI dates + amounts) and PayPal statement profiles, auto-detected; duplicates skipped automatically; preview before import; imported transactions land on a chosen account
- **Bill-due notifications** — daily summary at 20:00 when bills are due within 3 days (toggle + time in Settings)
- Subscriptions auto-post from the Home screen too (skipped days no longer post late)
- **Account on transactions** — link transactions to an account; recent activity shows the account name
- Finance in "Export for AI analysis" — net worth, monthly cash flow, subscriptions, budget vs actual
- Quarterly billing cadence for subscriptions
- Optional CoinGecko demo key in Settings (crypto price rate limit)

## Refactor
- Net-worth trend and income-vs-spending charts moved to the shared chart standard (scrub + readout + haptics)
