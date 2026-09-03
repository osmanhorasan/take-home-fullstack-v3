"use client";

import Link from "next/link";
import { api } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/utils";

export default function CreatorCampaignsPage() {
  const list = api.campaign.creatorListActive.useQuery();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Active campaigns</h1>
        <p className="text-sm text-muted-foreground">Submit a clip URL that matches one of the campaign platforms.</p>
      </div>
      <div className="grid gap-4">
        {(list.data ?? []).map((campaign) => (
          <Card key={campaign.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle>{campaign.title}</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatCents(campaign.payoutPer1kViews)} / 1k views · budget {formatCents(campaign.totalBudget)}
                </p>
              </div>
              <Link
                className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
                href={`/creator/campaigns/${campaign.id}/submit`}
              >
                Submit clip
              </Link>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {campaign.platforms.map((platform) => (
                <Badge key={platform} variant="outline">
                  {platform}
                </Badge>
              ))}
            </CardContent>
          </Card>
        ))}
        {list.data?.length === 0 ? <p className="text-sm text-muted-foreground">No active campaigns right now.</p> : null}
      </div>
    </div>
  );
}
