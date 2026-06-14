// Direction-aware goal progress + completion. A goal can either count UP toward
// its target (manual count goals, lift PRs, savings) or count DOWN toward it
// (weight loss). Direction is inferred so that a weight goal of 75 starting at
// 76 reads as "1 kg to go" and completes when the scale reaches 75 — not the
// other way around.
//
// `start_value` (captured at goal creation / first progress entry) anchors the
// direction: for weight and manual goals, start > target means a decrease goal.
// lift PRs and savings are always increase goals (higher is better), even if the
// current value already exceeds the target.

export interface GoalLike {
  target_value: number | string;
  current_value?: number | string | null;
  start_value?: number | string | null;
  link_type?: string | null;
}

export function goalDirection(g: GoalLike): 'up' | 'down' {
  if (g.link_type === 'lift_pr' || g.link_type === 'savings') return 'up';
  const start = g.start_value;
  if (start != null && Number(start) > Number(g.target_value)) return 'down';
  return 'up';
}

export function goalProgressFraction(g: GoalLike): number {
  const target = Number(g.target_value);
  const current = Number(g.current_value) || 0;
  if (!Number.isFinite(target)) return 0;

  if (goalDirection(g) === 'down') {
    const start = Number(g.start_value);
    const span = start - target;
    if (!(span > 0)) return current <= target ? 1 : 0;
    return Math.max(0, Math.min(1, (start - current) / span));
  }

  if (target <= 0) return 0;
  return Math.min(1, current / target);
}

export function goalReached(g: GoalLike): boolean {
  const target = Number(g.target_value);
  const current = Number(g.current_value) || 0;
  if (!Number.isFinite(target)) return false;
  return goalDirection(g) === 'down' ? current <= target : current >= target;
}
