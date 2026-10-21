import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('audit UI and workout regression contracts', () => {
  it('flushes set edits and continues the Ionic back chain', () => {
    const source = read('src/features/gym/pages/WorkoutPage.vue');
    expect(source).toContain('useBackButton(10, async (processNextHandler) =>');
    expect(source).toContain('processNextHandler();');
  });

  it('styles the deload notice with design tokens', () => {
    const source = read('src/features/gym/pages/WorkoutPage.vue');
    expect(source).toMatch(/\.deload-banner\s*\{/);
    expect(source).toContain('background: var(--nt-tile)');
    expect(source).toContain('color: var(--nt-text-dim)');
  });

  it('guards repeat-last-workout while a start is in flight', () => {
    const home = read('src/features/home/pages/HomePage.vue');
    const db = read('src/shared/db/app_db.ts');
    expect(home).toContain('if (startingRepeat.value) return;');
    expect(db).toContain('if (startWorkoutInFlight) return startWorkoutInFlight;');
  });

  it('keeps the active shared section tab visible', () => {
    const tabs = read('src/shared/components/SectionTabs.vue');
    expect(tabs).toContain('scrollIntoView');
    expect(tabs).toContain("inline: 'center'");
  });

  it('balances the reported dashboard metric grids', () => {
    const home = read('src/features/home/pages/HomePage.vue');
    const health = read('src/features/health/pages/HealthPage.vue');
    expect(home).toMatch(/\.week-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,/);
    expect(health).toContain('.metric-grid--3col { grid-template-columns: repeat(2, 1fr); }');
  });

  it('gives recurring rows a stacked mobile layout and usable action targets', () => {
    const recurring = read('src/features/finance/pages/FinanceSubscriptionsPage.vue');
    expect(recurring).toContain('@media (max-width: 600px)');
    expect(recurring).toContain('min-width: 40px');
    expect(recurring).toContain('flex-direction: column');
    expect(recurring).toContain('box-sizing: border-box');
    expect(recurring).toContain('width: 100%');
  });

  it('prevents a repeated payment tap from advancing another period', () => {
    const recurring = read('src/features/finance/pages/FinanceSubscriptionsPage.vue');
    expect(recurring).toContain('if (postingIds.value.has(id)) return;');
    expect(recurring).toContain(':disabled="postingIds.has(Number(sub.id))"');
  });
});
