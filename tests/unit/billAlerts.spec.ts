import { describe, test, expect } from 'vitest';
import { dueWithin, billAlertBody } from '@/features/finance/billAlerts';

const iso = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('dueWithin', () => {
  test('includes today/tomorrow/3d, soonest first', () => {
    const subs = [
      { name: 'Spotify', amount: 11, direction: 'expense', status: 'active', next_due_date: iso(3) },
      { name: 'Netflix', amount: 13.99, direction: 'expense', status: 'active', next_due_date: iso(1) },
      { name: 'Cloud', amount: 5, direction: 'expense', status: 'active', next_due_date: iso(0) },
    ];
    const alerts = dueWithin(subs, 3);
    expect(alerts?.map((a) => a.name)).toEqual(['Cloud', 'Netflix', 'Spotify']);
    expect(alerts?.[1].label).toBe('tomorrow');
  });

  test('excludes beyond horizon, paused, income, missing date', () => {
    const subs = [
      { name: 'Far', amount: 1, direction: 'expense', status: 'active', next_due_date: iso(4) },
      { name: 'Paused', amount: 2, direction: 'expense', status: 'paused', next_due_date: iso(1) },
      { name: 'Salary', amount: 3, direction: 'income', status: 'active', next_due_date: iso(1) },
      { name: 'NoDate', amount: 4, direction: 'expense', status: 'active', next_due_date: null },
    ];
    expect(dueWithin(subs, 3)).toBeNull();
  });

  test('overdue subs are included (they still need paying)', () => {
    const subs = [
      { name: 'Late', amount: 9, direction: 'expense', status: 'active', next_due_date: iso(-2) },
    ];
    const alerts = dueWithin(subs, 3);
    expect(alerts?.length).toBe(1);
    expect(alerts?.[0].name).toBe('Late');
  });

  test('null when empty', () => {
    expect(dueWithin([], 3)).toBeNull();
  });
});

describe('billAlertBody', () => {
  test('lists names with labels and total', () => {
    expect(
      billAlertBody([
        { name: 'Netflix', label: 'tomorrow', amount: 13.99 },
        { name: 'Spotify', label: 'in 3d', amount: 11 },
      ])
    ).toBe('Netflix (tomorrow), Spotify (in 3d) — 24.99 due within 3 days');
  });

  test('integer total renders without decimals', () => {
    expect(billAlertBody([{ name: 'Cloud', label: 'today', amount: 5 }])).toBe(
      'Cloud (today) — 5 due within 3 days'
    );
  });
});
