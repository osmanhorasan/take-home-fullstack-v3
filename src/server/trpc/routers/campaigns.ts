import { and, count, desc, eq, ilike, inArray } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, creatorProcedure, router } from "@/server/trpc/trpc";
import { campaigns, submissionMetrics, submissions } from "@/server/db/schema";
import { campaignFormSchema, campaignListInputSchema, campaignUpdateSchema } from "@/lib/validators";
import { campaignSpentCents } from "@/server/domain/budget";
import { eachUtcDateInclusive, earningsCents, remainingBudgetCents } from "@/server/domain/payout";

export const campaignRouter = router({
  adminList: adminProcedure.input(campaignListInputSchema).query(async ({ ctx, input }) => {
    const filters = and(
      input.status ? eq(campaigns.status, input.status) : undefined,
      input.q ? ilike(campaigns.title, `%${input.q}%`) : undefined,
    );
    const [{ total }] = await ctx.db.select({ total: count() }).from(campaigns).where(filters);
    const items = await ctx.db
      .select()
      .from(campaigns)
      .where(filters)
      .orderBy(desc(campaigns.createdAt))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize);
    return { items, total, page: input.page, pageSize: input.pageSize };
  }),

  adminGet: adminProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const [campaign] = await ctx.db.select().from(campaigns).where(eq(campaigns.id, input.id)).limit(1);
    if (!campaign) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
    }

    const spent = await campaignSpentCents(ctx.db, campaign.id, campaign.payoutPer1kViews);
    const remaining = remainingBudgetCents(campaign.totalBudget, spent);

    const approved = await ctx.db
      .select({ id: submissions.id })
      .from(submissions)
      .where(and(eq(submissions.campaignId, campaign.id), eq(submissions.status, "approved")));

    const ids = approved.map((row) => row.id);
    let totalApprovedViews = 0;
    const viewsByDay = new Map<string, number>();

    if (ids.length > 0) {
      const metrics = await ctx.db
        .select()
        .from(submissionMetrics)
        .where(inArray(submissionMetrics.submissionId, ids));

      const latest = new Map<string, { day: string; views: number }>();
      for (const metric of metrics) {
        const day = String(metric.capturedAt);
        viewsByDay.set(day, (viewsByDay.get(day) ?? 0) + metric.views);
        const prev = latest.get(metric.submissionId);
        if (!prev || day > prev.day) {
          latest.set(metric.submissionId, { day, views: metric.views });
        }
      }
      totalApprovedViews = [...latest.values()].reduce((sum, row) => sum + row.views, 0);
    }

    const series = eachUtcDateInclusive(campaign.startsAt, campaign.endsAt).map((date) => ({
      date,
      views: viewsByDay.get(date) ?? 0,
    }));

    return {
      campaign,
      totalApprovedViews,
      budgetSpent: spent,
      budgetLeft: remaining,
      estimatedIfFullyViewed: earningsCents(totalApprovedViews, campaign.payoutPer1kViews),
      dailyViews: series,
    };
  }),

  adminCreate: adminProcedure.input(campaignFormSchema).mutation(async ({ ctx, input }) => {
    const [created] = await ctx.db
      .insert(campaigns)
      .values({
        title: input.title,
        platforms: input.platforms,
        payoutPer1kViews: input.payoutPer1kViews,
        totalBudget: input.totalBudget,
        status: input.status,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      })
      .returning();
    return created;
  }),

  adminUpdate: adminProcedure.input(campaignUpdateSchema).mutation(async ({ ctx, input }) => {
      const { id, ...values } = input;
      const [updated] = await ctx.db
        .update(campaigns)
        .set({
          title: values.title,
          platforms: values.platforms,
          payoutPer1kViews: values.payoutPer1kViews,
          totalBudget: values.totalBudget,
          status: values.status,
          startsAt: values.startsAt,
          endsAt: values.endsAt,
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, id))
        .returning();
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }
      return updated;
    }),

  creatorListActive: creatorProcedure.query(({ ctx }) =>
    ctx.db
      .select()
      .from(campaigns)
      .where(eq(campaigns.status, "active"))
      .orderBy(desc(campaigns.startsAt)),
  ),

  creatorGet: creatorProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const [campaign] = await ctx.db.select().from(campaigns).where(eq(campaigns.id, input.id)).limit(1);
    if (!campaign || campaign.status !== "active") {
      throw new TRPCError({ code: "NOT_FOUND", message: "Active campaign not found" });
    }
    return campaign;
  }),
});
