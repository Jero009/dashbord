## v3.23.0

- **Budget pacing** — each budget now shows its projected month-end spend, with clear over-pace signaling. Closed months do not pretend to forecast.
- **Longer net-worth context** — switch the Overview trend between 30, 90, and 365 days. A stale range response can no longer overwrite your newer selection; failed loads stay visibly marked.
- **Health & Fitness cost per workout** — Analytics Review now shows spending in the Health & Fitness category per logged workout for the selected week or month, with an explicit no-workouts state.
- **More honest finance states** — Accounts, Investments, Budget, and Finance Analytics now distinguish a loading/database failure from genuinely having no data. Deleting a transaction now requires confirmation.
- **Less duplication** — removed the redundant Overview income/spend split and Analytics budget-vs-actual card. Category labels and local calendar formatting are consistent across Finance.
- **Verification** — independent GLM implementation and two independent GLM reviews passed; lint, 38 test files / 367 tests, production web build, and signed APK verification passed.
