"use client";

import { use } from "react";
import { api } from "@/trpc/react";
import { CampaignForm } from "@/components/campaign-form";

export default function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const detail = api.campaign.adminGet.useQuery({ id });

  if (!detail.data) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const campaign = detail.data.campaign;

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Edit campaign</h1>
      <CampaignForm
        campaignId={campaign.id}
        defaultValues={{
          title: campaign.title,
          platforms: campaign.platforms,
          payoutPer1kViews: campaign.payoutPer1kViews,
          totalBudget: campaign.totalBudget,
          status: campaign.status,
          startsAt: campaign.startsAt,
          endsAt: campaign.endsAt,
        }}
      />
    </div>
  );
}
