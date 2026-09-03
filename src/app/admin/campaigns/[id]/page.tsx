"use client";

import Link from "next/link";
import { use, useState } from "react";
import { api } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { DailyViewsChart } from "@/components/daily-views-chart";
import { formatCents, formatInt } from "@/lib/utils";

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const detail = api.campaign.adminGet.useQuery({ id });
  const pending = api.submission.adminPending.useQuery({ campaignId: id });
  const utils = api.useUtils();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [banner, setBanner] = useState<string | null>(null);

  const approve = api.submission.adminApprove.useMutation({
    onSuccess: async (result) => {
      setBanner(
        result.completed
          ? "Approved. Remaining budget hit zero — campaign marked completed."
          : `Approved. Budget left: ${formatCents(result.remainingAfter)}.`,
      );
      await Promise.all([detail.refetch(), pending.refetch(), utils.campaign.adminList.invalidate()]);
    },
    onError: (error) => {
      const budget = error.data && "budget" in error.data ? (error.data as { budget?: { remaining: number; required: number } }).budget : undefined;
      if (budget) {
        setBanner(
          `Budget exceeded. Need ${formatCents(budget.required)}, only ${formatCents(budget.remaining)} left.`,
        );
      } else {
        setBanner(error.message);
      }
    },
  });

  const reject = api.submission.adminReject.useMutation({
    onSuccess: async () => {
      setRejectId(null);
      setReason("");
      setBanner("Rejected.");
      await pending.refetch();
    },
  });

  if (detail.isLoading || !detail.data) {
    return <p className="text-sm text-muted-foreground">Loading campaign…</p>;
  }

  const { campaign, totalApprovedViews, budgetSpent, budgetLeft, dailyViews } = detail.data;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{campaign.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge>{campaign.status}</Badge>
            {campaign.platforms.map((platform) => (
              <Badge key={platform} variant="outline">
                {platform}
              </Badge>
            ))}
          </div>
        </div>
        <Link className="rounded-md border px-3 py-2 text-sm" href={`/admin/campaigns/${campaign.id}/edit`}>
          Edit
        </Link>
      </div>

      {banner ? (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm" role="status">
          {banner}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Approved views</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatInt(totalApprovedViews)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Budget spent</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCents(budgetSpent)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Budget left</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCents(budgetLeft)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily views</CardTitle>
        </CardHeader>
        <CardContent>
          <DailyViewsChart data={dailyViews} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Review queue</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {(pending.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending submissions.</p>
          ) : (
            pending.data?.map((item) => (
              <div key={item.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-1 text-sm">
                    <a className="font-medium underline-offset-4 hover:underline" href={item.postUrl} target="_blank" rel="noreferrer">
                      {item.postUrl}
                    </a>
                    <p className="text-muted-foreground">
                      {item.creatorEmail} · {item.platform} · {formatInt(Number(item.views))} views
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={approve.isPending}
                      onClick={() => approve.mutate({ submissionId: item.id })}
                    >
                      Approve
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setRejectId(item.id)}>
                      Reject
                    </Button>
                  </div>
                </div>
                {rejectId === item.id ? (
                  <div className="mt-3 grid gap-2">
                    <Textarea
                      aria-label="Rejection reason"
                      placeholder="Rejection reason"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={reject.isPending || reason.trim().length < 3}
                      onClick={() => reject.mutate({ submissionId: item.id, reason })}
                    >
                      Confirm reject
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
