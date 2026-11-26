import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const home = readFileSync('src/features/home/pages/HomePage.vue', 'utf8');

describe('dashboard information density', () => {
  it('keeps Home training signal to verdict plus one local reason', () => {
    expect(home).toContain('{{ trainingSignalVerdict }}');
    expect(home).toContain('{{ trainingSignalReason }}');
    expect(home).not.toContain('briefingLabel');
    expect(home).not.toContain('briefingExcerpt');
    expect(home).not.toContain('briefing-grade');
    expect(home).not.toContain('briefing-body');
  });

  it('resolves the training signal fully locally (no receiver round-trip)', () => {
    expect(home).not.toContain('syncBriefing');
    expect(home).not.toContain('getCachedBriefing');
    expect(home).not.toContain('briefingStore');
    expect(home).toContain('resolveBriefingVerdict(');
    // Always pushes a level — updateWidgetFields drops null fields, which
    // would leave the native widget on a stale glyph.
    expect(home).toContain('briefingLevel: resolved.level');
  });
});
