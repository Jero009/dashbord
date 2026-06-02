# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ionic + Vue 3 health and fitness tracking app with local SQLite storage and Android Health Connect integration. Runs as a Capacitor Android app; the web target is used for development only (SQLite is a no-op on web).

## Commands

```bash
npm run dev           # Vite dev server at http://localhost:5173
npm run build         # TypeScript compile + Vite build
npm run lint          # ESLint
npm run test:unit     # Vitest unit tests (add --run for non-watch)
npm run test:unit -- src/path/file   # Single file
npm run test:e2e      # Cypress (requires dev server running separately)
```

## Architecture

### Feature Modules

`src/features/` holds isolated feature modules: **gym**, **health**, **finance**, **home**. Each follows:

```
features/[name]/
├── routes.ts       # Vue Router config for this feature
├── pages/          # Route-level components
└── components/     # Components scoped to this feature
```

Routes are lazy-loaded and merged in `src/router/index.ts`.

### Shared Layer

`src/shared/` for cross-feature concerns:
- `db/app_db.ts` — single SQLite instance, all DB functions exported from here
- `health/` — Health Connect sync (`HealthConnectAutoSync.vue` is mounted in `App.vue` and runs on startup)
- `utils/` — formatting, type conversions
- `components/` — global UI components

### Data Flow

Pages call exported functions directly from `src/shared/db/app_db.ts` (e.g., `upsertReadinessScore()`, `replaceHealthMetric()`). No global state store — state lives in Vue `ref`/`computed` local to each page. Rest timer state uses `sessionStorage`.

### DB Conventions

- All DB access goes through `app_db.ts`; function names follow `upsert*`, `replace*`, `delete*`, `query*`, `get*`
- Booleans stored as `0`/`1`
- SQLite unavailable on web — DB calls must tolerate empty/null results

### Health Connect

- Syncs steps, sleep, heart rate, respiratory rate via `@capgo/capacitor-health`
- Check availability before calling — not present on all Android devices
- Readiness score is derived from sleep hours, sleep efficiency, sleep score, resting HR, sleep HR, respiratory rate, and steps
- Sleep score (`calculateSleepScore` in `healthConnect.ts`) is a 100-pt model: duration vs user target (25), efficiency (20), deep% at ≥18% target (12.5), REM% at ≥22% target (12.5), bedtime timing variance vs 14-night rolling mean (15), respiratory rate vs 14-night personal baseline (15). Rolling baselines require ≥3 prior nights and update after scoring so the current night doesn't influence its own result.

## Key Conventions

- `<script setup lang="ts">` for all components; no `reactive()` unless complex state demands it
- Import types with `import type { ... }`
- Use `@/` path alias for all imports (maps to `src/`)
- Use scoped styles in feature flow pages to prevent leakage
- `no-console` / `no-debugger` are warnings in dev, errors in production builds

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
