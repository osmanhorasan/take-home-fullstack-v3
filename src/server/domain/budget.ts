import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { TRPCError } from "@trpc/server";
import * as schema from "@/server/db/schema";
import { campaigns, submissionMetrics, submissions } from "@/server/db/schema";
import { decideApproval, earningsCents } from "@/server/domain/payout";

export type Db = PostgresJsDatabase<typeof schema>;

const COUNTING_STATUSES = ["approved", "paid"] as const;

export class BudgetExceededError extends Error {
  readonly code = "BUDGET_EXCEEDED" as const;
  constructor(
    readonly remaining: number,
    readonly required: number,
    readonly spent: number,
  ) {
    super("Approving this clip would exceed the campaign budget");
    this.name = "BudgetExceededError";
  }
}

export async function latestMetricViews(db: Db, submissionId: string): Promise<number> {
  const [row] = await db
    .select({ views: submissionMetrics.views })
    .from(submissionMetrics)
    .where(eq(submissionMetrics.submissionId, submissionId))
    .orderBy(desc(submissionMetrics.capturedAt))
    .limit(1);
  return row?.views ?? 0;
}

export async function campaignSpentCents(db: Db, campaignId: string, payoutPer1k: number): Promise<number> {
  const approved = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(
      and(eq(submissions.campaignId, campaignId), inArray(submissions.status, [...COUNTING_STATUSES])),
    );

  let spent = 0;
  for (const row of approved) {
    const views = await latestMetricViews(db, row.id);
    spent += earningsCents(views, payoutPer1k);
  }
  return spent;
}

export async function approveSubmission(db: Db, submissionId: string) {
  return db.transaction(async (tx) => {
    const [pending] = await tx
      .select()
      .from(submissions)
      .where(eq(submissions.id, submissionId))
      .limit(1);

    if (!pending) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });
    }
    if (pending.status !== "pending") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Only pending submissions can be approved",
      });
    }

    // Serialize approvals that share a campaign budget.
    await tx.execute(sql`select id from "campaign" where id = ${pending.campaignId} for update`);

    const [campaign] = await tx
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, pending.campaignId))
      .limit(1);

    if (!campaign) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
    }

    const views = await latestMetricViews(tx, pending.id);
    const alreadySpent = await campaignSpentCents(tx, campaign.id, campaign.payoutPer1kViews);
    const candidateEarnings = earningsCents(views, campaign.payoutPer1kViews);
    const decision = decideApproval({
      totalBudget: campaign.totalBudget,
      alreadySpent,
      candidateEarnings,
    });

    if (!decision.ok) {
      throw new BudgetExceededError(decision.remaining, decision.required, decision.spent);
    }

    const [updated] = await tx
      .update(submissions)
      .set({ status: "approved", rejectionReason: null, updatedAt: new Date() })
      .where(and(eq(submissions.id, pending.id), eq(submissions.status, "pending")))
      .returning();

    if (!updated) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Submission was already reviewed",
      });
    }

    if (decision.completes) {
      await tx
        .update(campaigns)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(campaigns.id, campaign.id));
    }

    return {
      submission: updated,
      spentAfter: decision.spentAfter,
      remainingAfter: decision.remainingAfter,
      completed: decision.completes,
    };
  });
}

export async function maybeCompleteCampaign(db: Db, campaignId: string) {
  await db.transaction(async (tx) => {
    const [campaign] = await tx
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .for("update")
      .limit(1);
    if (!campaign) return;
    if (campaign.status === "completed" || campaign.status === "draft") return;
    const spent = await campaignSpentCents(tx, campaign.id, campaign.payoutPer1kViews);
    if (spent >= campaign.totalBudget) {
      await tx
        .update(campaigns)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(campaigns.id, campaign.id));
    }
  });
}
