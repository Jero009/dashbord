import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import NtProgressRing from '@/shared/components/NtProgressRing.vue';

// The ring is the existing 120×120 / r=46 geometry: circumference ≈ 289 (2π·46).
const C = 289;

describe('NtProgressRing', () => {
  it('renders the fixed 120×120 / r=46 geometry', () => {
    const w = mount(NtProgressRing, { props: { ratio: 0.5 } });
    expect(w.find('svg').attributes('viewBox')).toBe('0 0 120 120');
    for (const sel of ['.nt-ring__track', '.nt-ring__progress']) {
      const c = w.find(sel);
      expect(c.exists()).toBe(true);
      expect(c.attributes('cx')).toBe('60');
      expect(c.attributes('cy')).toBe('60');
      expect(c.attributes('r')).toBe('46');
    }
  });

  it('clamps ratio at 0 (full dash offset)', () => {
    const w = mount(NtProgressRing, { props: { ratio: -0.5 } });
    expect(w.find('.nt-ring__progress').attributes('style')).toContain(
      `stroke-dashoffset: ${C}`
    );
  });

  it('clamps ratio at 1 (zero dash offset)', () => {
    const w = mount(NtProgressRing, { props: { ratio: 1.4 } });
    expect(w.find('.nt-ring__progress').attributes('style')).toContain(
      'stroke-dashoffset: 0'
    );
  });

  it('maps ratio to dash offset (0.25 → C − C·0.25)', () => {
    const w = mount(NtProgressRing, { props: { ratio: 0.25 } });
    expect(w.find('.nt-ring__progress').attributes('style')).toContain(
      `stroke-dashoffset: ${C - C * 0.25}`
    );
  });

  it('uses the custom color when given', () => {
    const w = mount(NtProgressRing, { props: { ratio: 0.5, color: 'rgb(1,2,3)' } });
    expect(w.find('.nt-ring__progress').attributes('style')).toContain(
      'stroke: rgb(1,2,3)'
    );
  });

  it('falls back to the accent red when no color is given', () => {
    const w = mount(NtProgressRing, { props: { ratio: 0.5 } });
    expect(w.find('.nt-ring__progress').attributes('style')).toContain(
      'stroke: var(--ion-color-accent-red)'
    );
  });

  it('renders center slot content inside the ring', () => {
    const w = mount(NtProgressRing, {
      props: { ratio: 0.5 },
      slots: { default: '<strong class="score">82</strong>' },
    });
    expect(w.find('.nt-ring__content strong.score').text()).toBe('82');
  });

  it('applies the optional size class to the root', () => {
    const w = mount(NtProgressRing, { props: { ratio: 0.5, sizeClass: 'ring-sm' } });
    expect(w.find('.nt-ring.ring-sm').exists()).toBe(true);
  });
});
