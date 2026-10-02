import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Canonical web stage colors (src/shared/utils/stageBarsGeom.ts STAGE_COLORS).
// The widget renders into a RemoteViews bitmap via ARGB_8888 Canvas/Paint, so
// the alpha channel is preserved — we deliberately keep the same fractional
// alpha as the web rgba() values instead of flattening to opaque ARGB.
const CANONICAL_ARGB: Record<string, number> = {
  deep: 0xF74560D8, // alpha 0.97 → F7, rgb(58,99,216)
  light: 0xF282AAFA, // alpha 0.95 → F2, rgb(130,170,250)
  rem: 0xF22DD4EE, // alpha 0.95 → F2, rgb(45,212,238)
};

const layoutDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../android/app/src/main/res/layout'
);

const javaPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../android/app/src/main/java/io/ionic/starter/SleepStagesWidgetProvider.java'
);

/** ARGB int literal → "0xAARRGGBB" unsigned hex, as it appears in the Java source. */
const argbHex = (v: number) => `0x${(v >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;

describe('SleepStagesWidgetProvider stage colors', () => {
  const src = readFileSync(javaPath, 'utf8');

  const constantValue = (name: string): number => {
    const m = src.match(new RegExp(`COLOR_${name}\\s*=\\s*(0x[0-9A-Fa-f]{8})`));
    expect(m, `COLOR_${name} constant not found in Java source`).toBeTruthy();
    return Number.parseInt(m![1], 16);
  };

  it('deep matches the canonical rgba(58,99,216,0.97)', () => {
    expect(argbHex(constantValue('DEEP'))).toBe(argbHex(CANONICAL_ARGB.deep));
  });

  it('light matches the canonical rgba(130,170,250,0.95)', () => {
    expect(argbHex(constantValue('LIGHT'))).toBe(argbHex(CANONICAL_ARGB.light));
  });

  it('rem matches the canonical rgba(45,212,238,0.95)', () => {
    expect(argbHex(constantValue('REM'))).toBe(argbHex(CANONICAL_ARGB.rem));
  });

  it('awake is the goal-gold equivalent (#FFD700 at alpha 0.95, matching the web awake band)', () => {
    expect(argbHex(constantValue('AWAKE'))).toBe('0xF2FFD700');
  });

  it('constants are still referenced by stageColor()', () => {
    for (const name of ['DEEP', 'LIGHT', 'REM', 'AWAKE']) {
      expect(src).toContain(`return COLOR_${name};`);
    }
  });
});

describe('widget classic/OS5 geometry parity', () => {
  const GEOM_ATTRS = [
    'android:id',
    'android:layout_width',
    'android:layout_height',
    'android:padding',
    'android:paddingTop',
    'android:paddingBottom',
    'android:paddingStart',
    'android:paddingEnd',
    'android:layout_margin',
    'android:layout_marginTop',
    'android:layout_marginBottom',
    'android:layout_marginStart',
    'android:layout_marginEnd',
    'android:textSize',
    'android:layout_weight',
    'android:orientation',
    'android:gravity',
  ];

  /** Ordered element signatures — id + geometry only; fonts/colors/background ignored. */
  const signatures = (file: string): string[] => {
    const txt = readFileSync(join(layoutDir, file), 'utf8');
    const out: string[] = [];
    for (const m of txt.matchAll(/<(\w+)\b([^>]*)>/g)) {
      const attrs = Object.fromEntries(
        [...m[2].matchAll(/([\w:]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])
      );
      const parts = GEOM_ATTRS.filter((k) => k in attrs).map((k) => `${k}=${attrs[k]}`);
      out.push(`${m[1]}|${parts.join('|')}`);
    }
    return out;
  };

  const pairs = readdirSync(layoutDir)
    .filter((f) => f.startsWith('widget_') && f.endsWith('.xml'))
    .filter((f) => !f.endsWith('_os5.xml'))
    .map((f) => [f, f.replace(/\.xml$/, '_os5.xml')])
    .filter(([, os5]) => readdirSync(layoutDir).includes(os5));

  it.each(pairs)('%s matches %s geometry (ids, sizes, padding, margins, text sizes)', (classic, os5) => {
    expect(signatures(os5)).toEqual(signatures(classic));
  });
});
