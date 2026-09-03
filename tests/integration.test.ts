import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, sql } from "@/server/db";
import { campaigns, submissionMetrics, submissions, users } from "@/server/db/schema";
import { approveSubmission, BudgetExceededError } from "@/server/domain/budget";
import { createCaller } from "@/server/trpc/root";
import { runIngest } from "@/server/jobs/ingest";

async function seedUsers() {
  const [admin] = await db
    .insert(users)
    .values({ email: `admin+${Date.now()}@test.local`, role: "admin" })
    .returning();
  const [creatorA] = await db
    .insert(users)
    .values({ email: `creator.a+${Date.now()}@test.local`, role: "creator" })
    .returning();
  const [creatorB] = await db
    .insert(users)
    .values({ email: `creator.b+${Date.now()}@test.local`, role: "creator" })
    .returning();
  return { admin, creatorA, creatorB };
}

describe("budget, concurrency, access, ingest", () => {
  beforeAll(async () => {
    // Connectivity check — migrations must already be applied.
    await sql`select 1`;
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("enforces the budget ceiling on approval", async () => {
    const { admin, creatorA } = await seedUsers();
    const start = new Date("2026-01-01T00:00:00.000Z");
    const end = new Date("2026-01-15T00:00:00.000Z");
    const [campaign] = await db
      .insert(campaigns)
      .values({
        title: "Ceiling",
        platforms: ["tiktok"],
        payoutPer1kViews: 1_000,
        totalBudget: 1_000,
        status: "active",
        startsAt: start,
        endsAt: end,
      })
      .returning();
    const [submission] = await db
      .insert(submissions)
      .values({
        campaignId: campaign.id,
        creatorId: creatorA.id,
        postUrl: "https://www.tiktok.com/@a/video/2222222222222222222",
        platform: "tiktok",
      })
      .returning();
    await db.insert(submissionMetrics).values({
      submissionId: submission.id,
      capturedAt: "2026-01-02",
      views: 2_500,
      likes: 1,
      comments: 1,
    });

    await expect(approveSubmission(db, submission.id)).rejects.toBeInstanceOf(BudgetExceededError);
    void admin;
  });

  it("allows only one concurrent approval when budget covers a single payout", async () => {
    const { creatorA, creatorB } = await seedUsers();
    const start = new Date("2026-02-01T00:00:00.000Z");
    const end = new Date("2026-02-15T00:00:00.000Z");
    const [campaign] = await db
      .insert(campaigns)
      .values({
        title: "Race",
        platforms: ["tiktok", "instagram"],
        payoutPer1kViews: 1_000,
        totalBudget: 5_000,
        status: "active",
        startsAt: start,
        endsAt: end,
      })
      .returning();

    const [one] = await db
      .insert(submissions)
      .values({
        campaignId: campaign.id,
        creatorId: creatorA.id,
        postUrl: "https://www.tiktok.com/@a/video/3333333333333333333",
        platform: "tiktok",
      })
      .returning();
    const [two] = await db
      .insert(submissions)
      .values({
        campaignId: campaign.id,
        creatorId: creatorB.id,
        postUrl: "https://www.instagram.com/reel/RaceReelBBBB/",
        platform: "instagram",
      })
      .returning();

    await db.insert(submissionMetrics).values([
      { submissionId: one.id, capturedAt: "2026-02-02", views: 5_000, likes: 1, comments: 1 },
      { submissionId: two.id, capturedAt: "2026-02-02", views: 5_000, likes: 1, comments: 1 },
    ]);

    const outcomes = await Promise.allSettled([
      approveSubmission(db, one.id),
      approveSubmission(db, two.id),
    ]);

    const fulfilled = outcomes.filter((item) => item.status === "fulfilled");
    const rejected = outcomes.filter((item) => item.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.status === "rejected" && rejected[0].reason).toBeInstanceOf(BudgetExceededError);

    const [updated] = await db.select().from(campaigns).where(eq(campaigns.id, campaign.id));
    expect(updated.status).toBe("completed");
  });

  it("keeps creator submissions isolated by ownership", async () => {
    const { creatorA, creatorB } = await seedUsers();
    const start = new Date("2026-03-01T00:00:00.000Z");
    const end = new Date("2026-03-15T00:00:00.000Z");
    const [campaign] = await db
      .insert(campaigns)
      .values({
        title: "Owned",
        platforms: ["youtube"],
        payoutPer1kViews: 100,
        totalBudget: 10_000,
        status: "active",
        startsAt: start,
        endsAt: end,
      })
      .returning();
    const [owned] = await db
      .insert(submissions)
      .values({
        campaignId: campaign.id,
        creatorId: creatorA.id,
        postUrl: "https://www.youtube.com/watch?v=abcdefghijk",
        platform: "youtube",
      })
      .returning();

    const callerB = createCaller({ db, user: creatorB });
    await expect(callerB.submission.creatorGet({ id: owned.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    const callerA = createCaller({ db, user: creatorA });
    const mine = await callerA.submission.creatorGet({ id: owned.id });
    expect(mine.id).toBe(owned.id);
  });

  it("leaves metrics unchanged on a repeated ingest for the same day", async () => {
    const { creatorA } = await seedUsers();
    const start = new Date("2026-04-01T00:00:00.000Z");
    const end = new Date("2026-04-15T00:00:00.000Z");
    const [campaign] = await db
      .insert(campaigns)
      .values({
        title: "Ingest",
        platforms: ["tiktok"],
        payoutPer1kViews: 100,
        totalBudget: 100_000,
        status: "active",
        startsAt: start,
        endsAt: end,
      })
      .returning();
    const [submission] = await db
      .insert(submissions)
      .values({
        campaignId: campaign.id,
        creatorId: creatorA.id,
        postUrl: "https://www.tiktok.com/@a/video/4444444444444444444",
        platform: "tiktok",
        status: "approved",
      })
      .returning();

    const day = new Date("2026-04-05T12:00:00.000Z");
    const first = await runIngest(db, { day, bump: 1000 });
    expect(first.inserted).toBeGreaterThanOrEqual(1);
    const [before] = await db
      .select()
      .from(submissionMetrics)
      .where(eq(submissionMetrics.submissionId, submission.id));

    const second = await runIngest(db, { day, bump: 9999 });
    expect(second.skipped).toBeGreaterThanOrEqual(1);
    const [after] = await db
      .select()
      .from(submissionMetrics)
      .where(eq(submissionMetrics.submissionId, submission.id));
    expect(after.views).toBe(before.views);
  });

  it("continues ingesting after a single submission failure", async () => {
    const { creatorA } = await seedUsers();
    const start = new Date("2026-05-01T00:00:00.000Z");
    const end = new Date("2026-05-15T00:00:00.000Z");
    const [campaign] = await db
      .insert(campaigns)
      .values({
        title: "Partial ingest",
        platforms: ["tiktok"],
        payoutPer1kViews: 100,
        totalBudget: 100_000,
        status: "active",
        startsAt: start,
        endsAt: end,
      })
      .returning();
    const [a] = await db
      .insert(submissions)
      .values({
        campaignId: campaign.id,
        creatorId: creatorA.id,
        postUrl: "https://www.tiktok.com/@a/video/5555555555555555555",
        platform: "tiktok",
        status: "approved",
      })
      .returning();
    const [b] = await db
      .insert(submissions)
      .values({
        campaignId: campaign.id,
        creatorId: creatorA.id,
        postUrl: "https://www.tiktok.com/@a/video/6666666666666666666",
        platform: "tiktok",
        status: "approved",
      })
      .returning();

    const day = new Date("2026-05-06T12:00:00.000Z");
    const result = await runIngest(db, { day, bump: 500, failSubmissionId: a.id });
    expect(result.failures.some((item) => item.submissionId === a.id)).toBe(true);
    expect(result.inserted).toBeGreaterThanOrEqual(1);
    const metrics = await db
      .select()
      .from(submissionMetrics)
      .where(eq(submissionMetrics.submissionId, b.id));
    expect(metrics.length).toBe(1);
  });
});
