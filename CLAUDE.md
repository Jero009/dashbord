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

## Design System

**ALWAYS follow these rules when writing or editing any component.** Do not invent new patterns — extend existing ones.

### No emojis
Never use emoji characters anywhere in the UI — not in templates, not in labels, not as icon substitutes. Use text initials, abbreviations, or ionicons instead.

### Colors
- Background: `#000` (page), `var(--ion-color-primary)` (cards)
- Accent red: `rgb(239, 68, 68)` / `var(--ion-color-accent-red)` — primary interactive color
- Accent yellow: `rgb(255, 215, 0)` / `var(--ion-color-accent-yellow)` — active/live states only
- Success green: `rgb(34, 197, 94)` — positive states (ready, done)
- Subtle text: `rgba(255,255,255,0.5)` for labels, `rgba(255,255,255,0.85)` for values
- Borders: `rgba(255,255,255,0.08)` standard, `rgba(255,255,255,0.12)` hover

### Cards
- Background: `var(--ion-color-primary)` — never use `rgba(255,255,255,0.04)` for primary cards
- Border radius: `12px` for cards, `10px` for inner tiles, `8px` for inputs/buttons
- Padding: `18px` inside cards, `14px` inside metric tiles
- Gap between cards: `16px`, gap between tiles: `10–12px`
- No box-shadow on cards

### Typography / Labels
- Section label (above card title): `.section-kicker` — `0.72rem`, uppercase, `letter-spacing: 0.18em`, `rgba(255,255,255,0.5)`
- Date / secondary info: `.card-date` — `0.72rem`, `rgba(255,255,255,0.4)`
- Metric label: `0.75rem`, uppercase, `letter-spacing: 0.1em`, `rgba(255,255,255,0.5)`
- Metric value: `0.95rem–1rem`, `#fff`, `font-weight: 600`
- Timer / live value: `Doto` monospace font, yellow color

### Metric Tiles
```css
.card-metric {
  border-radius: 10px;
  padding: 12px 14px;
  background: rgba(255,255,255,0.05);
}
```
Grid: `repeat(2, 1fr)` default, `repeat(4, 1fr)` for workout stats on wide screens.

### Inputs / Forms
- Input: `background: rgba(255,255,255,0.06)`, `border: 1px solid rgba(255,255,255,0.1)`, `border-radius: 8px`, `color: #fff`
- Time inputs: add `color-scheme: dark`
- Primary button: `background: rgb(239,68,68)`, `border-radius: 8px`, no border

### Active / Live Cards
- Active workout card: `border: 2px solid rgba(255,215,0,0.35)`, gradient background, yellow timer in Doto font

### Habit / Checkbox Pattern
```css
/* 22–28px square, border-radius 6–8px */
/* Unchecked: border: 1.5px solid rgba(255,255,255,0.2) */
/* Checked: background + border-color: rgb(239,68,68) */
```

### Responsive
- Max content width: `760px` centered with `margin: 0 auto`
- Breakpoint: `600px` for side-by-side layouts within cards
- Breakpoint: `760px` for grid column changes

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

**MANDATORY rules — follow before any search or grep:**
- For ANY question about where something is defined, what a file exports, or how two files relate: run `graphify query "<question>"` FIRST. Do not grep until graphify returns insufficient results.
- Use `graphify path "<A>" "<B>"` to trace relationships between files or symbols (e.g. `graphify path "app_db" "HomePage"`).
- Use `graphify explain "<concept>"` to understand a domain concept across the codebase (e.g. `graphify explain "battery score"`).
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review when query/path/explain are insufficient.
- **After modifying code, run `graphify update .`** to keep the graph current (AST-only, no API cost). Do this before ending any session that changed files.
