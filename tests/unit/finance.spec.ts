import { describe, test, expect } from 'vitest';
import {
  isLiabilityAccount,
  accountAssetsTotal,
  accountLiabilitiesTotal,
  computeNetWorth,
  computeTotalAssets,
  investmentsTotal,
  investmentsCostBasis,
  monthlyCostOf,
  yearlyCostOf,
  subscriptionsMonthlyOutflow,
  subscriptionsMonthlyInflow,
  upcomingBills,
  savingsRate,
  categoryLabel,
  dueLabel,
} from '@/features/finance/finance';

const accounts = [
  { type: 'cash', balance: 500 },
  { type: 'bank', balance: 4500 },
  { type: 'credit', balance: 1200 }, // liability
  { type: 'loan', balance: 8000 },   // liability
];

const investments = [
  { value: 10000, cost_basis: 7000 },
  { value: 2000, cost_basis: 2500 },
];

describe('account / net-worth math', () => {
  test('liability detection', () => {
    expect(isLiabilityAccount({ type: 'credit' })).toBe(true);
    expect(isLiabilityAccount({ type: 'loan' })).toBe(true);
    expect(isLiabilityAccount({ type: 'cash' })).toBe(false);
    expect(isLiabilityAccount({ type: 'bank' })).toBe(false);
  });

  test('assets exclude liabilities; liabilities summed positive', () => {
    expect(accountAssetsTotal(accounts)).toBe(5000);
    expect(accountLiabilitiesTotal(accounts)).toBe(9200);
  });

  test('net worth subtracts liabilities, total assets adds investments', () => {
    // assets 5000 + investments 12000 − liabilities 9200 = 7800
    expect(computeNetWorth(accounts, investments)).toBe(7800);
    expect(computeTotalAssets(accounts, investments)).toBe(17000);
  });

  test('handles non-numeric balances gracefully', () => {
    expect(accountAssetsTotal([{ type: 'cash', balance: 'oops' }])).toBe(0);
    expect(computeNetWorth([], [])).toBe(0);
  });
});

describe('investments', () => {
  test('value and cost-basis totals', () => {
    expect(investmentsTotal(investments)).toBe(12000);
    expect(investmentsCostBasis(investments)).toBe(9500);
  });
});

describe('subscription cadence normalisation', () => {
  test('monthly / yearly / weekly to monthly', () => {
    expect(monthlyCostOf({ amount: 10, cadence: 'monthly' })).toBe(10);
    expect(monthlyCostOf({ amount: 120, cadence: 'yearly' })).toBe(10);
    expect(monthlyCostOf({ amount: 10, cadence: 'weekly' })).toBeCloseTo((10 * 52) / 12, 6);
  });

  test('yearly cost is monthly × 12', () => {
    expect(yearlyCostOf({ amount: 10, cadence: 'monthly' })).toBe(120);
  });

  test('monthly outflow counts only active expenses', () => {
    const subs = [
      { amount: 10, cadence: 'monthly', direction: 'expense', status: 'active' },
      { amount: 120, cadence: 'yearly', direction: 'expense', status: 'active' }, // +10
      { amount: 99, cadence: 'monthly', direction: 'expense', status: 'paused' }, // excluded
      { amount: 2000, cadence: 'monthly', direction: 'income', status: 'active' }, // excluded
    ];
    expect(subscriptionsMonthlyOutflow(subs)).toBe(20);
    expect(subscriptionsMonthlyInflow(subs)).toBe(2000);
  });

  test('missing status defaults to active', () => {
    expect(subscriptionsMonthlyOutflow([{ amount: 5, cadence: 'monthly', direction: 'expense' }])).toBe(5);
  });
});

describe('upcomingBills', () => {
  const iso = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  };

  test('returns active expense items within the horizon, soonest first', () => {
    const subs = [
      { id: 1, amount: 10, direction: 'expense', status: 'active', next_due_date: iso(10) },
      { id: 2, amount: 20, direction: 'expense', status: 'active', next_due_date: iso(3) },
      { id: 3, amount: 30, direction: 'expense', status: 'active', next_due_date: iso(40) }, // beyond 14d
      { id: 4, amount: 40, direction: 'income', status: 'active', next_due_date: iso(2) },   // income
      { id: 5, amount: 50, direction: 'expense', status: 'paused', next_due_date: iso(1) },  // paused
      { id: 6, amount: 60, direction: 'expense', status: 'active', next_due_date: null },     // no date
    ];
    const bills = upcomingBills(subs, 14);
    expect(bills.map((b) => b.id)).toEqual([2, 1]);
  });
});

describe('savingsRate', () => {
  test('fraction of income kept', () => {
    expect(savingsRate(1000, 600)).toBeCloseTo(0.4, 6);
    expect(savingsRate(1000, 1200)).toBeCloseTo(-0.2, 6);
  });

  test('null when no income; clamped to [-1, 1]', () => {
    expect(savingsRate(0, 500)).toBeNull();
    expect(savingsRate(100, 1000)).toBe(-1);
  });
});

describe('labels', () => {
  test('categoryLabel falls back to Other', () => {
    expect(categoryLabel('food')).toBe('Food & Drink');
    expect(categoryLabel('nonsense')).toBe('Other');
  });

  test('dueLabel relative wording', () => {
    const iso = (offsetDays: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offsetDays);
      return d.toISOString().slice(0, 10);
    };
    expect(dueLabel(iso(0))).toBe('Today');
    expect(dueLabel(iso(1))).toBe('Tomorrow');
    expect(dueLabel(iso(-1))).toBe('Yesterday');
    expect(dueLabel(iso(5))).toBe('in 5d');
    expect(dueLabel(iso(-3))).toBe('3d ago');
    expect(dueLabel(null)).toBe('TBD');
  });
});
