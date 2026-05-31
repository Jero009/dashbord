# Copilot Instructions for Gym Dashboard

This is an Ionic + Vue 3 health and fitness tracking app with multiple feature modules, local SQLite storage, and Android Health Connect integration.

## Build, Test & Lint Commands

**Development**
```bash
npm run dev        # Start Vite dev server on http://localhost:5173
npm run build      # Compile TypeScript and build with Vite
npm run preview    # Preview production build locally
```

**Testing**
```bash
npm run test:unit  # Run Vitest unit tests
npm run test:e2e   # Run Cypress end-to-end tests (requires dev server running)
npm run test:unit -- --watch         # Watch mode for unit tests
npm run test:unit -- src/path/file   # Run tests for specific file
```

**Linting & Type Checking**
```bash
npm run lint       # Run ESLint
```

## High-Level Architecture

### Feature-Based Modular Structure

The app is organized into **isolated feature modules** under `src/features/`:
- **gym** - Workout templates, exercise tracking, timer dial
- **health** - Health Connect sync, readiness scores, wellness metrics
- **finance** - Account tracking, investments, subscriptions
- **home** - Dashboard aggregating data from other modules

Each feature follows this pattern:
```
features/[feature_name]/
├── routes.ts       # Vue Router configuration for feature
├── pages/          # Page-level components (matched to routes)
└── components/     # Reusable components within feature
```

Features are **self-contained**: routes and data belong to their module. Cross-feature data access goes through the shared layer.

### Shared Layer

`src/shared/` contains truly cross-cutting concerns:
- **db/** - SQLite database operations (schema, initialization, queries)
- **health/** - Health Connect integration and metric sync
- **components/** - Global UI components (not feature-specific)
- **utils/** - Helper functions (formatting, type conversions, etc.)

### Database Layer

SQLite is initialized on app startup via `src/shared/db/app_db.ts`:
- **Single database instance** managed by `initDB()` during app bootstrap (see `src/main.ts`)
- **Schema tables** include: habits, goals, workouts, finance accounts, health metrics, readiness scores, and calendar events
- **Data access pattern**: Feature pages/components call exported functions from `app_db.ts` (e.g., `upsertReadinessScore()`, `replaceHealthMetric()`)
- **Backup/restore** functionality: SQL statements are parsed and executed, supporting multi-statement backups

### Routing

Routes are imported and merged in `src/router/index.ts`:
```typescript
import { gymRoutes } from '@/features/gym/routes'
import { homeRoutes } from '@/features/home/routes'
// Routes merged into single router instance
```

Each feature exports its routes from `routes.ts` and uses **lazy loading** with dynamic imports.

### Mobile & Health Integration

- **Capacitor** handles native Android features (filesystem, haptics, app lifecycle)
- **@capgo/capacitor-health** syncs with Android Health Connect (steps, sleep, heart rate, respiratory rate)
- Health Connect sync runs automatically on app start via the `HealthConnectAutoSync.vue` component
- Synced metrics are stored in SQLite and used to calculate **readiness scores**

## Key Conventions

### TypeScript & Type Safety
- **Strict mode enabled** in `tsconfig.json`
- Use **Vue 3 `<script setup lang="ts">`** syntax (no `reactive()`/`ref()` unless necessary for complex state)
- Import types with explicit `type` keyword: `import type { HealthMetricType } from '@/...'`
- Avoid `any` where possible; define proper types for API responses and database records

### Path Aliases

Use `@/` alias for imports (configured in `vite.config.ts` and `tsconfig.json`):
```typescript
// ✅ Good
import { initDB } from '@/shared/db/app_db'
import type { Habit } from '@/shared/types'

// ❌ Avoid
import { initDB } from '../../../shared/db/app_db'
```

### Vue Components

- Use `<script setup lang="ts">` for composable, reactive components
- Keep component logic focused; complex state should be in composables or shared utilities
- Ionic Vue components (IonButton, IonCard, IonList, etc.) are used for UI consistency
- Props and events are explicitly typed

### Database Operations

- All database functions are exported from `src/shared/db/app_db.ts`
- Functions follow naming convention: `upsert*()`, `replace*()`, `delete*()`, `query*()`, `get*()`
- SQL parsing handles single-line comments (`--`) and quoted strings
- Boolean values are stored as `0` / `1` in SQLite
- Always provide appropriate error handling when calling database functions

### Linting & Code Style

- ESLint extends Vue 3 recommended and TypeScript recommended configs
- `no-console` and `no-debugger` are warnings in development, errors in production
- Vue deprecated features are intentionally relaxed (`vue/no-deprecated-slot-attribute: off`)
- `@typescript-eslint/no-explicit-any` is disabled; use `any` sparingly but pragmatically for external APIs

### Health Connect Sync

- Types: `HealthMetricType`, `HealthConnectAccessResult`, `HealthConnectSyncResult`
- Check availability before calling: Health Connect may not be available on all Android devices
- Sync results return both success status and count of synced records
- Readiness is calculated from: sleep hours, sleep efficiency, sleep score, resting HR, sleep HR, respiratory rate, and steps

## Testing Patterns

- Unit tests use **Vitest** with **jsdom** environment
- E2E tests use **Cypress** targeting `http://localhost:5173`
- Test files are co-located or in `tests/` directory depending on test type
- When running E2E tests, the dev server must be running (`npm run dev` in another terminal)

## Common Development Tasks

**Adding a new page to a feature:**
1. Create page component in `src/features/[feature]/pages/`
2. Add route to `src/features/[feature]/routes.ts`
3. Import/merge route in `src/router/index.ts` if not already imported

**Adding database operations:**
1. Define SQL in `src/shared/db/app_db.ts`
2. Export function with clear name and return type
3. Call function from components or pages

**Syncing health data:**
1. Use `HealthConnectAutoSync.vue` component (already in `App.vue`)
2. Or manually call functions from `src/shared/health/healthConnect.ts`
3. Always check availability and authorization status first
