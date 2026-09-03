import { describe, expect, it } from "vitest";
import { decideApproval, earningsCents, remainingBudgetCents } from "@/server/domain/payout";
import { nextViews } from "@/server/jobs/ingest";
import { platformFromPostUrl, isUrlAllowedForCampaign } from "@/server/domain/post-url";

describe("payout math", () => {
  it("floors views into thousand buckets", () => {
    expect(earningsCents(0, 500)).toBe(0);
    expect(earningsCents(999, 500)).toBe(0);
    expect(earningsCents(1000, 500)).toBe(500);
    expect(earningsCents(2500, 1000)).toBe(2000);
  });

  it("never reports negative remaining budget", () => {
    expect(remainingBudgetCents(1000, 1500)).toBe(0);
  });

  it("blocks approvals that would exceed the ceiling", () => {
    const decision = decideApproval({
      totalBudget: 5_000,
      alreadySpent: 0,
      candidateEarnings: 5_000,
    });
    expect(decision.ok).toBe(true);
    if (decision.ok) {
      expect(decision.completes).toBe(true);
    }

    const over = decideApproval({
      totalBudget: 5_000,
      alreadySpent: 0,
      candidateEarnings: 5_001,
    });
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.code).toBe("BUDGET_EXCEEDED");
    }
  });
});

describe("post urls", () => {
  it("accepts platform-shaped URLs only when the campaign allows them", () => {
    expect(platformFromPostUrl("https://www.tiktok.com/@x/video/123")).toBe("tiktok");
    expect(isUrlAllowedForCampaign("https://www.youtube.com/shorts/abc", ["tiktok"])).toBeNull();
    expect(isUrlAllowedForCampaign("https://www.youtube.com/shorts/abc", ["youtube"])).toBe("youtube");
  });
});

describe("ingest helpers", () => {
  it("refuses downward view bumps", () => {
    expect(() => nextViews(10, -1)).toThrow();
    expect(nextViews(10, 5)).toBe(15);
  });
});
