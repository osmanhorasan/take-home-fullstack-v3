import { config } from "dotenv";
config({ path: ".env" });

import { db, sql } from "@/server/db";
import { campaigns, submissionMetrics, submissions, users } from "@/server/db/schema";

async function main() {
  await db.delete(submissionMetrics);
  await db.delete(submissions);
  await db.delete(campaigns);
  await db.delete(users);

  const [admin] = await db
    .insert(users)
    .values({ email: "admin@example.com", role: "admin" })
    .returning();
  const [creatorA] = await db
    .insert(users)
    .values({ email: "creator.a@example.com", role: "creator" })
    .returning();
  const [creatorB] = await db
    .insert(users)
    .values({ email: "creator.b@example.com", role: "creator" })
    .returning();

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 10);

  const [race] = await db
    .insert(campaigns)
    .values({
      title: "Budget race (seed)",
      platforms: ["tiktok", "instagram"],
      payoutPer1kViews: 1_000,
      totalBudget: 5_000,
      status: "active",
      startsAt: start,
      endsAt: end,
    })
    .returning();

  const [steady] = await db
    .insert(campaigns)
    .values({
      title: "Always-on YouTube",
      platforms: ["youtube"],
      payoutPer1kViews: 250,
      totalBudget: 50_000,
      status: "active",
      startsAt: start,
      endsAt: end,
    })
    .returning();

  await db.insert(campaigns).values({
    title: "Draft only",
    platforms: ["tiktok"],
    payoutPer1kViews: 100,
    totalBudget: 1_000,
    status: "draft",
    startsAt: start,
    endsAt: end,
  });

  const [pendingA] = await db
    .insert(submissions)
    .values({
      campaignId: race.id,
      creatorId: creatorA.id,
      postUrl: "https://www.tiktok.com/@creatora/video/1111111111111111111",
      platform: "tiktok",
      status: "pending",
    })
    .returning();

  const [pendingB] = await db
    .insert(submissions)
    .values({
      campaignId: race.id,
      creatorId: creatorB.id,
      postUrl: "https://www.instagram.com/reel/SeedReelAAAA/",
      platform: "instagram",
      status: "pending",
    })
    .returning();

  const day = start.toISOString().slice(0, 10);
  await db.insert(submissionMetrics).values([
    { submissionId: pendingA.id, capturedAt: day, views: 5_000, likes: 120, comments: 12 },
    { submissionId: pendingB.id, capturedAt: day, views: 5_000, likes: 90, comments: 8 },
  ]);

  const [approved] = await db
    .insert(submissions)
    .values({
      campaignId: steady.id,
      creatorId: creatorA.id,
      postUrl: "https://www.youtube.com/shorts/SeedShort1",
      platform: "youtube",
      status: "approved",
    })
    .returning();

  await db.insert(submissionMetrics).values({
    submissionId: approved.id,
    capturedAt: day,
    views: 12_400,
    likes: 400,
    comments: 33,
  });

  console.log(
    JSON.stringify(
      {
        admin: admin.email,
        creators: [creatorA.email, creatorB.email],
        tip: "Approve either pending clip on Budget race — the other should hit BUDGET_EXCEEDED.",
      },
      null,
      2,
    ),
  );

  }

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
