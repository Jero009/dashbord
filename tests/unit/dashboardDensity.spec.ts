import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const home = readFileSync('src/features/home/pages/HomePage.vue', 'utf8');
const hermes = readFileSync('src/features/hermes/pages/HermesPage.vue', 'utf8');

describe('dashboard information density', () => {
  it('keeps Home training signal to verdict plus one local reason', () => {
    expect(home).toContain('{{ trainingSignalVerdict }}');
    expect(home).toContain('{{ trainingSignalReason }}');
    expect(home).not.toContain('briefingLabel');
    expect(home).not.toContain('briefingExcerpt');
    expect(home).not.toContain('briefing-grade');
    expect(home).not.toContain('briefing-body');
    expect(home).toContain('void syncBriefing()');
    expect(home).not.toContain('await syncBriefing()');
  });

  it('removes recovery and signal duplicates from the Hermes inbox', () => {
    expect(hermes).not.toContain('<p class="nt-kicker">Today</p>');
    expect(hermes).not.toContain('<p class="nt-kicker">Signals</p>');
    expect(hermes).not.toContain('computeTodayRecovery');
    expect(hermes).not.toContain('recoveryLabel');
    expect(hermes).not.toContain('readinessVal');
    expect(hermes).not.toContain('acwrVal');
  });
});
