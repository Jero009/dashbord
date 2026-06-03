# App Status

## What the app looks like

- Ionic + Vue dashboard with a dark, card-based UI.
- Top-level navigation uses section tabs and a shared dashboard top bar.
- Gym pages use tabbed navigation, big titles, and workout/template cards.
- Health and finance pages use summary cards plus simple form panels.
- The new `/home` route is a minimal landing page with the dashboard header and a short intro.

## Working features

### Shared

- App boots through `src/main.ts` and initializes local SQLite.
- Router is wired through `src/router/index.ts`.
- Local SQLite persistence is implemented in `src/shared/db/app_db.ts`.
- Native export/import support exists through Capacitor file/share APIs.

### Gym

- Home dashboard for workouts.
- Workout templates list with create/edit/delete flows.
- Exercise management with filtering and CRUD.
- Workout session flow with sets, reps, weights, and rest timer.
- Workout history and exercise detail views.
- Template builder, template editor, and exercise picker flows.

### Health

- Health overview with sleep and resting HR cards.
- Sleep tab with score, stages, efficiency, sleep HR, and respiratory rate.
- Manual metric entry for sleep and resting heart rate.
- Google Health Connect sync for sleep and resting heart rate on Android.
- Calendar page for events and recovery days.
- Habit tracker and goals tracking pages.

### Home

- Readiness circle based on sleep and resting HR.
- Day graph that shows readiness draining through the day.
- Quick links for sleep, calendar, habits, and goals.

### Finance

- Finance overview with net worth, accounts, investments, and subscriptions totals.
- Account creation and listing.
- Investment creation and listing.
- Subscription creation and listing.

## Planned / in progress

- Better health sync/history so metrics feel more like a full tracker.
- More finance analytics and richer editing flows.
- A fuller home dashboard instead of the current minimal landing page.
- Better native/web fallback handling for features that depend on SQLite or Capacitor.

## Notes

- Android minSdk is 26 because Google Health Connect requires it.
- SQLite is unavailable on web, so empty states are expected there.
- Some health and finance screens already show placeholder/pending language in the UI.
