export function earningsCents(views: number, payoutPer1kViews: number): number {
  if (views < 0 || payoutPer1kViews < 0) {
    throw new Error("views and payout must be non-negative");
  }
  return Math.floor(views / 1000) * payoutPer1kViews;
}

export function remainingBudgetCents(totalBudget: number, spent: number): number {
  return Math.max(0, totalBudget - spent);
}

export type BudgetDecision =
  | { ok: true; spentAfter: number; remainingAfter: number; completes: boolean }
  | { ok: false; code: "BUDGET_EXCEEDED"; spent: number; remaining: number; required: number };

export function decideApproval(input: {
  totalBudget: number;
  alreadySpent: number;
  candidateEarnings: number;
}): BudgetDecision {
  const { totalBudget, alreadySpent, candidateEarnings } = input;
  const remaining = remainingBudgetCents(totalBudget, alreadySpent);
  if (candidateEarnings > remaining) {
    return {
      ok: false,
      code: "BUDGET_EXCEEDED",
      spent: alreadySpent,
      remaining,
      required: candidateEarnings,
    };
  }
  const spentAfter = alreadySpent + candidateEarnings;
  const remainingAfter = remainingBudgetCents(totalBudget, spentAfter);
  return {
    ok: true,
    spentAfter,
    remainingAfter,
    completes: remainingAfter === 0,
  };
}

export function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function eachUtcDateInclusive(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cursor.getTime() <= last.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}
