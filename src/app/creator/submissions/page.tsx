"use client";

import { api } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import { formatCents, formatInt } from "@/lib/utils";

export default function MySubmissionsPage() {
  const list = api.submission.creatorMine.useQuery();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">My submissions</h1>
        <p className="text-sm text-muted-foreground">Status, latest views, and estimated earnings from the newest metric row.</p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-3 py-2 font-medium">Campaign</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Views</th>
              <th className="px-3 py-2 font-medium">Est. earnings</th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <div className="font-medium">{row.campaignTitle}</div>
                  <a className="text-xs text-muted-foreground underline-offset-4 hover:underline" href={row.postUrl} target="_blank" rel="noreferrer">
                    {row.postUrl}
                  </a>
                </td>
                <td className="px-3 py-2">
                  <Badge variant={row.status === "rejected" ? "destructive" : "secondary"}>{row.status}</Badge>
                  {row.rejectionReason ? (
                    <p className="mt-1 text-xs text-muted-foreground">{row.rejectionReason}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2">{formatInt(row.views)}</td>
                <td className="px-3 py-2">{formatCents(row.estimatedEarnings)}</td>
              </tr>
            ))}
            {list.data?.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-muted-foreground" colSpan={4}>
                  No submissions yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
