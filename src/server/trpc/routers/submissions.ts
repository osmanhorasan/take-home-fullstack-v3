import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, creatorProcedure, router } from "@/server/trpc/trpc";
import { campaigns, submissionMetrics, submissions, users } from "@/server/db/schema";
import { approveSubmissionSchema, rejectSubmissionSchema, submitClipSchema } from "@/lib/validators";
import { approveSubmission, BudgetExceededError, latestMetricViews } from "@/server/domain/budget";
import { earningsCents } from "@/server/domain/payout";
import { isUrlAllowedForCampaign } from "@/server/domain/post-url";

export const submissionRouter = router({
  adminPending: adminProcedure.input(z.object({ campaignId: z.string().uuid() })).query(({ ctx, input }) =>
    ctx.db
      .select({
        id: submissions.id,
        postUrl: submissions.postUrl,
        platform: submissions.platform,
        status: submissions.status,
        createdAt: submissions.createdAt,
        creatorEmail: users.email,
        views: sql<number>`coalesce((
          select ${submissionMetrics.views}
          from ${submissionMetrics}
          where ${submissionMetrics.submissionId} = ${submissions.id}
          order by ${submissionMetrics.capturedAt} desc
          limit 1
        ), 0)`,
      })
      .from(submissions)
      .innerJoin(users, eq(users.id, submissions.creatorId))
      .where(and(eq(submissions.campaignId, input.campaignId), eq(submissions.status, "pending")))
      .orderBy(submissions.createdAt),
  ),

  adminApprove: adminProcedure.input(approveSubmissionSchema).mutation(async ({ ctx, input }) => {
    try {
      return await approveSubmission(ctx.db, input.submissionId);
    } catch (error) {
      if (error instanceof BudgetExceededError) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: error.message,
          cause: error,
        });
      }
      throw error;
    }
  }),

  adminReject: adminProcedure.input(rejectSubmissionSchema).mutation(async ({ ctx, input }) => {
    const [updated] = await ctx.db
      .update(submissions)
      .set({
        status: "rejected",
        rejectionReason: input.reason,
        updatedAt: new Date(),
      })
      .where(and(eq(submissions.id, input.submissionId), eq(submissions.status, "pending")))
      .returning();
    if (!updated) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Only pending submissions can be rejected",
      });
    }
    return updated;
  }),

  creatorSubmit: creatorProcedure.input(submitClipSchema).mutation(async ({ ctx, input }) => {
    const [campaign] = await ctx.db.select().from(campaigns).where(eq(campaigns.id, input.campaignId)).limit(1);
    if (!campaign || campaign.status !== "active") {
      throw new TRPCError({ code: "NOT_FOUND", message: "Active campaign not found" });
    }
    const platform = isUrlAllowedForCampaign(input.postUrl, campaign.platforms);
    if (!platform) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "URL must be a real post on one of this campaign’s platforms",
      });
    }

    try {
      const [created] = await ctx.db
        .insert(submissions)
        .values({
          campaignId: campaign.id,
          creatorId: ctx.user.id,
          postUrl: input.postUrl.trim(),
          platform,
        })
        .returning();
      return created;
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code === "23505") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This URL is already submitted to this campaign",
        });
      }
      throw error;
    }
  }),

  creatorMine: creatorProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: submissions.id,
        postUrl: submissions.postUrl,
        platform: submissions.platform,
        status: submissions.status,
        rejectionReason: submissions.rejectionReason,
        createdAt: submissions.createdAt,
        campaignId: campaigns.id,
        campaignTitle: campaigns.title,
        payoutPer1kViews: campaigns.payoutPer1kViews,
      })
      .from(submissions)
      .innerJoin(campaigns, eq(campaigns.id, submissions.campaignId))
      .where(eq(submissions.creatorId, ctx.user.id))
      .orderBy(desc(submissions.createdAt));

    return Promise.all(
      rows.map(async (row) => {
        const views = await latestMetricViews(ctx.db, row.id);
        return {
          ...row,
          views,
          estimatedEarnings: earningsCents(views, row.payoutPer1kViews),
        };
      }),
    );
  }),

  creatorGet: creatorProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const [row] = await ctx.db
      .select()
      .from(submissions)
      .where(and(eq(submissions.id, input.id), eq(submissions.creatorId, ctx.user.id)))
      .limit(1);
    if (!row) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });
    }
    return row;
  }),
});
