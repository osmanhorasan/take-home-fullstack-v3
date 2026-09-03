import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/server/domain/budget";
import { maybeCompleteCampaign } from "@/server/domain/budget";
import { submissionMetrics, submissions } from "@/server/db/schema";
import { utcDateString } from "@/server/domain/payout";

export type IngestResult = {
  processed: number;
  inserted: number;
  skipped: number;
  failures: { submissionId: string; error: string }[];
};

function bumpViews(previous: number): number {
  const bump = 250 + Math.floor(Math.random() * 2_500);
  return previous + bump;
}

/** Deterministic bump for tests. */
export function nextViews(previous: number, bump: number): number {
  if (bump < 0) throw new Error("views only go up");
  return previous + bump;
}

export async function runIngest(
  db: Db,
  options?: { day?: Date; bump?: number; failSubmissionId?: string },
): Promise<IngestResult> {
  const capturedAt = utcDateString(options?.day ?? new Date());
  const approved = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(eq(submissions.status, "approved"));

  const result: IngestResult = {
    processed: approved.length,
    inserted: 0,
    skipped: 0,
    failures: [],
  };

  for (const row of approved) {
    try {
      if (options?.failSubmissionId && row.id === options.failSubmissionId) {
        throw new Error("forced ingest failure");
      }

      const [existing] = await db
        .select({ id: submissionMetrics.id })
        .from(submissionMetrics)
        .where(
          and(eq(submissionMetrics.submissionId, row.id), eq(submissionMetrics.capturedAt, capturedAt)),
        )
        .limit(1);

      if (existing) {
        result.skipped += 1;
        continue;
      }

      const [latest] = await db
        .select({
          views: submissionMetrics.views,
          likes: submissionMetrics.likes,
          comments: submissionMetrics.comments,
        })
        .from(submissionMetrics)
        .where(eq(submissionMetrics.submissionId, row.id))
        .orderBy(desc(submissionMetrics.capturedAt))
        .limit(1);

      const previousViews = latest?.views ?? 0;
      const views =
        options?.bump !== undefined ? nextViews(previousViews, options.bump) : bumpViews(previousViews);
      const likes = (latest?.likes ?? 0) + (options?.bump !== undefined ? 1 : Math.floor(Math.random() * 40));
      const comments =
        (latest?.comments ?? 0) + (options?.bump !== undefined ? 1 : Math.floor(Math.random() * 10));

      await db.insert(submissionMetrics).values({
        submissionId: row.id,
        capturedAt,
        views,
        likes,
        comments,
      });
      result.inserted += 1;

      const [parent] = await db
        .select({ campaignId: submissions.campaignId })
        .from(submissions)
        .where(eq(submissions.id, row.id))
        .limit(1);
      if (parent) {
        await maybeCompleteCampaign(db, parent.campaignId);
      }
    } catch (error) {
      result.failures.push({
        submissionId: row.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
