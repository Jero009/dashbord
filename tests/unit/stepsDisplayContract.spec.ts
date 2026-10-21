import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('today step display contract', () => {
  it('native aggregation reports success separately from an empty result', () => {
    const manager = read('node_modules/@capgo/capacitor-health/android/src/main/java/app/capgo/plugin/health/HealthManager.kt');
    const persistedPatch = read('patches/@capgo+capacitor-health+8.6.0.patch');
    expect(manager).toContain('put("successful", successful)');
    expect(persistedPatch).toContain('put("successful", successful)');
  });

  it('queries health metrics by exact local date', () => {
    const db = read('src/shared/db/app_db.ts');
    expect(db).toContain('export async function getHealthMetricForDate');
    expect(db).toMatch(/WHERE type = \? AND date = \?/);
  });

  it('replaces a metric atomically so a failed insert cannot erase the old value', () => {
    const db = read('src/shared/db/app_db.ts');
    const replaceBody = db.slice(db.indexOf('export async function replaceHealthMetric'), db.indexOf('export async function getLatestHealthMetric'));
    expect(replaceBody).toContain('db.executeSet([');
    expect(replaceBody).not.toContain('await addHealthMetric');
  });

  it.each([
    'src/features/home/pages/HomePage.vue',
    'src/features/health/pages/HealthPage.vue',
  ])('%s reads steps for today instead of the latest historical row', (path) => {
    const source = read(path);
    expect(source).toContain("getHealthMetricForDate('steps', localDateISO())");
    expect(source).not.toContain("getLatestHealthMetric('steps')");
  });
});
