// Shared finance helpers used across the Finance feature pages so net-worth,
// liability and recurring-cost math stay identical everywhere (Overview, Accounts,
// Investments, Subscriptions, Analytics). Pure functions — no DB or Vue deps.

export type AccountRow = Record<string, any>;
export type InvestmentRow = Record<string, any>;
export type SubscriptionRow = Record<string, any>;

// Account types that represent money owed rather than money held. Their balance
// is entered as a positive "amount owed" and SUBTRACTED from net worth.
export const LIABILITY_ACCOUNT_TYPES = ['credit', 'loan'];

export const isLiabilityAccount = (account: AccountRow): boolean =>
  LIABILITY_ACCOUNT_TYPES.includes(String(account?.type));

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Cash + bank balances (assets only — liabilities excluded).
export const accountAssetsTotal = (accounts: AccountRow[]): number =>
  accounts.reduce((sum, a) => (isLiabilityAccount(a) ? sum : sum + num(a.balance)), 0);

// Sum of money owed across credit/loan accounts (returned as a positive number).
export const accountLiabilitiesTotal = (accounts: AccountRow[]): number =>
  accounts.reduce((sum, a) => (isLiabilityAccount(a) ? sum + num(a.balance) : sum), 0);

export const investmentsTotal = (investments: InvestmentRow[]): number =>
  investments.reduce((sum, i) => sum + num(i.value), 0);

export const investmentsCostBasis = (investments: InvestmentRow[]): number =>
  investments.reduce((sum, i) => sum + num(i.cost_basis), 0);

// Net worth = (cash/bank assets + investment value) − liabilities owed.
export const computeNetWorth = (
  accounts: AccountRow[],
  investments: InvestmentRow[]
): number =>
  accountAssetsTotal(accounts) + investmentsTotal(investments) - accountLiabilitiesTotal(accounts);

// Total assets side of the balance sheet (used for the assets/liabilities split bar).
export const computeTotalAssets = (
  accounts: AccountRow[],
  investments: InvestmentRow[]
): number => accountAssetsTotal(accounts) + investmentsTotal(investments);

// Normalise any billing cadence to an equivalent monthly cost.
export const monthlyCostOf = (sub: SubscriptionRow): number => {
  const amount = num(sub.amount);
  if (sub.cadence === 'yearly') return amount / 12;
  if (sub.cadence === 'weekly') return (amount * 52) / 12;
  return amount;
};

// Annualised cost of a single recurring item.
export const yearlyCostOf = (sub: SubscriptionRow): number => monthlyCostOf(sub) * 12;

const isActive = (sub: SubscriptionRow): boolean => String(sub.status ?? 'active') === 'active';

// Monthly outflow from active expense subscriptions only (income excluded).
export const subscriptionsMonthlyOutflow = (subs: SubscriptionRow[]): number =>
  subs.reduce(
    (sum, s) => (isActive(s) && s.direction !== 'income' ? sum + monthlyCostOf(s) : sum),
    0
  );

export const subscriptionsMonthlyInflow = (subs: SubscriptionRow[]): number =>
  subs.reduce(
    (sum, s) => (isActive(s) && s.direction === 'income' ? sum + monthlyCostOf(s) : sum),
    0
  );

// Active expense items due within the next `days`, soonest first. Items with no
// due date are skipped (we can't schedule them on the timeline).
export const upcomingBills = (subs: SubscriptionRow[], days = 14): SubscriptionRow[] => {
  const now = Date.now();
  const horizon = now + days * 86400000;
  return subs
    .filter((s) => isActive(s) && s.direction !== 'income' && s.next_due_date)
    .map((s) => ({ ...s, _due: new Date(String(s.next_due_date)).getTime() }))
    .filter((s) => Number.isFinite(s._due) && s._due <= horizon)
    .sort((a, b) => a._due - b._due);
};

// Savings rate as a 0–1 fraction (income kept rather than spent). Null when no income.
export const savingsRate = (income: number, expense: number): number | null => {
  if (income <= 0) return null;
  return Math.max(-1, Math.min(1, (income - expense) / income));
};

export interface CategoryMeta {
  value: string;
  label: string;
}

// Canonical expense categories (shared by Budget add-transaction + budgets).
export const EXPENSE_CATEGORIES: CategoryMeta[] = [
  { value: 'food', label: 'Food & Drink' },
  { value: 'groceries', label: 'Groceries' },
  { value: 'transport', label: 'Transport' },
  { value: 'housing', label: 'Housing' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'health', label: 'Health & Fitness' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'education', label: 'Education' },
  { value: 'other', label: 'Other' },
];

export const categoryLabel = (value: string): string =>
  EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ?? 'Other';

// Relative due label: "Today", "Tomorrow", "in 5d", "3d ago".
export const dueLabel = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'TBD';
  const target = new Date(String(dateStr));
  if (!Number.isFinite(target.getTime())) return 'TBD';
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(target) - startOfDay(new Date())) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0) return `in ${diffDays}d`;
  return `${Math.abs(diffDays)}d ago`;
};
