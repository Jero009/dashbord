# Gym Dashboard

A health and fitness tracking app built with Ionic + Vue 3, targeting Android via Capacitor. Tracks workouts, sleep, health metrics, body composition, calendar events, and finances — all stored locally with SQLite and synced from Android Health Connect.

## Features

- **Gym** — workout logging with templates, active session timer, progressive overload hints, and exercise history
- **Health** — readiness score, sleep scoring, Health Connect sync (steps, HR, sleep, respiratory rate), body log with photos, 14-day trend charts
- **Calendar** — event scheduling with types (workout, recovery, sleep, school, reminder, general), daily/weekly recurrence, and battery score modelling
- **Finance** — account tracking, investments, and subscription management
- **Google Drive backup** — daily automated DB export

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | Ionic 8 + Vue 3 |
| Native Runtime | Capacitor 8 (Android) |
| Database | SQLite via `@capacitor-community/sqlite` |
| Health Data | `@capgo/capacitor-health` (Android Health Connect) |
| Charts | Chart.js |
| Language | TypeScript 5 |
| Build | Vite 5 |
| Tests | Vitest (unit), Cypress (e2e) |

## Getting Started

### Prerequisites

- Node.js 18+
- Android Studio (for APK builds)
- Java 17+

### Install

```bash
npm install
```

### Development (web)

```bash
npm run dev
```

Opens at `http://localhost:5173`. SQLite is a no-op on web — DB calls return empty/null results.

### Android build

```bash
npm run build
npx cap sync
# Then open Android Studio: npx cap open android
```

**Order matters** — always run `npm run build` before `npx cap sync` or the stale `dist/` gets synced.

## Commands

```bash
npm run dev           # Vite dev server
npm run build         # TypeScript check + Vite production build
npm run lint          # ESLint
npm run test:unit     # Vitest unit tests
npm run test:unit -- src/path/file  # Single file
npm run test:e2e      # Cypress (requires dev server running)
```

## Project Structure

```
src/
├── features/          # Isolated feature modules
│   ├── gym/           # Workout tracking
│   ├── health/        # Health metrics & body log
│   ├── finance/       # Accounts & subscriptions
│   ├── home/          # Dashboard
│   └── settings/      # App settings
├── shared/
│   ├── db/app_db.ts   # Single SQLite instance — all DB functions
│   ├── health/        # Health Connect sync & scoring
│   └── utils/         # Formatting, backup, notifications
└── router/index.ts    # Merges lazy-loaded feature routes
```

Each feature module follows:

```
features/[name]/
├── routes.ts
├── pages/
└── components/
```

## Architecture Notes

- **No global state store** — state lives in Vue `ref`/`computed` local to each page
- **All DB access** goes through `src/shared/db/app_db.ts`; function names follow `upsert*`, `replace*`, `delete*`, `query*`, `get*`
- **Routes** are lazy-loaded and merged in `src/router/index.ts`
- **Health Connect** sync runs on app startup via `HealthConnectAutoSync.vue` (mounted in `App.vue`), with a 6 s retry for cold-start race conditions
- **Booleans** stored as `0`/`1` in SQLite

## Readiness & Sleep Scoring

The readiness score is a 100-point composite model:

| Component | Points |
|---|---|
| Sleep duration vs user target | 25 |
| Sleep efficiency | 20 |
| Deep sleep % (target ≥18%) | 12.5 |
| REM % (target ≥22%) | 12.5 |
| Bedtime timing variance (14-night rolling mean) | 15 |
| Respiratory rate vs 14-night baseline | 15 |

Rolling baselines require ≥3 prior nights and update after scoring so the current night doesn't influence its own score.

## Google Drive Backup

Triggered on app start and from Settings. Requires external Google Cloud setup:

1. Enable the Drive API in Google Cloud Console
2. Create an OAuth 2.0 client ID (Android)
3. Add the app's SHA-1 fingerprint to the OAuth client
4. The code in `src/shared/utils/driveBackup.ts` has no effect until this is done

## License

Private — all rights reserved.
