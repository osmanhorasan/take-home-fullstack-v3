"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/utils";
import type { CampaignFormValues } from "@/lib/validators";

const STATUSES = ["", "draft", "active", "paused", "completed"] as const;

export default function AdminCampaignsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("");
  const list = api.campaign.adminList.useQuery({
    page,
    pageSize: 10,
    q: q || undefined,
    status: status || undefined,
  });

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Server-paginated list with title search and status filter.</p>
        </div>
        <Link className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" href="/admin/campaigns/new">
          New campaign
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          aria-label="Search title"
          placeholder="Search title"
          value={q}
          onChange={(event) => {
            setPage(1);
            setQ(event.target.value);
          }}
          className="max-w-xs"
        />
        <select
          aria-label="Filter status"
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value as (typeof STATUSES)[number]);
          }}
        >
          <option value="">All statuses</option>
          {STATUSES.filter(Boolean).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Budget</th>
              <th className="px-3 py-2 font-medium">Payout / 1k</th>
            </tr>
          </thead>
          <tbody>
            {(list.data?.items ?? []).map((campaign) => (
              <tr key={campaign.id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <Link className="font-medium underline-offset-4 hover:underline" href={`/admin/campaigns/${campaign.id}`}>
                    {campaign.title}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <Badge variant="secondary">{campaign.status}</Badge>
                </td>
                <td className="px-3 py-2">{formatCents(campaign.totalBudget)}</td>
                <td className="px-3 py-2">{formatCents(campaign.payoutPer1kViews)}</td>
              </tr>
            ))}
            {list.data?.items.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-muted-foreground" colSpan={4}>
                  No campaigns match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => setPage((value) => value + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export type { CampaignFormValues };
