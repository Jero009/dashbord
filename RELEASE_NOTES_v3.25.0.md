# dashbord v3.25.0 — Finance, steps, and workout fixes

- Recurring expenses and income now have proper expense categories; existing subscriptions retain their category. Missed periods require an explicit choice to record the oldest or catch up all, rather than silently posting on page entry.
- Recurring posts and schedule updates are atomic and idempotent per due period. Weekly payments now roll across month and year boundaries correctly.
- Today's steps are read by local date instead of showing the newest older count. Successful zero-step days and failed Health Connect reads are handled separately; step sync is not blocked by unrelated metric permissions.
- The workout deload notice has a compact styled presentation. Hardware Back now continues after saving sets, and rapid Start again taps cannot create duplicate active workouts.
- Finance navigation and recurring rows fit mobile screens better; Home and Health metric grids are balanced.

Verification: lint, 397 unit tests, web production build, Android release build and APK signing checks. Native Health Connect and populated finance behavior on Jernej's phone remain to be confirmed after installation. No account-transfer feature or automatic account-balance mutation was added.
