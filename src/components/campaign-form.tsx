"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { useRouter } from "next/navigation";
import { campaignFormSchema, type CampaignFormValues } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/trpc/react";
import { toDatetimeLocal } from "@/lib/utils";
import { PLATFORMS } from "@/lib/validators";

const STATUSES = ["draft", "active", "paused", "completed"] as const;

export function CampaignForm({
  defaultValues,
  campaignId,
}: {
  defaultValues?: CampaignFormValues;
  campaignId?: string;
}) {
  const router = useRouter();
  const now = new Date();
  const later = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema) as Resolver<CampaignFormValues>,
    defaultValues: defaultValues ?? {
      title: "",
      platforms: ["tiktok"],
      payoutPer1kViews: 500,
      totalBudget: 10_000,
      status: "draft",
      startsAt: now,
      endsAt: later,
    },
  });

  const create = api.campaign.adminCreate.useMutation({
    onSuccess: (campaign) => router.push(`/admin/campaigns/${campaign.id}`),
  });
  const update = api.campaign.adminUpdate.useMutation({
    onSuccess: (campaign) => router.push(`/admin/campaigns/${campaign.id}`),
  });

  const selected = form.watch("platforms");

  return (
    <form
      className="grid max-w-xl gap-4"
      onSubmit={form.handleSubmit((values) => {
        if (campaignId) {
          update.mutate({ ...values, id: campaignId });
        } else {
          create.mutate(values);
        }
      })}
    >
      <div className="grid gap-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...form.register("title")} />
        {form.formState.errors.title ? (
          <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
        ) : null}
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Platforms</legend>
        <div className="flex flex-wrap gap-3">
          {PLATFORMS.map((platform) => (
            <label key={platform} className="flex items-center gap-2 text-sm capitalize">
              <input
                type="checkbox"
                checked={selected.includes(platform)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...selected, platform]
                    : selected.filter((item) => item !== platform);
                  form.setValue("platforms", next, { shouldValidate: true });
                }}
              />
              {platform}
            </label>
          ))}
        </div>
        {form.formState.errors.platforms ? (
          <p className="text-sm text-destructive">{form.formState.errors.platforms.message}</p>
        ) : null}
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor="payout">Payout per 1k views (cents)</Label>
        <Input id="payout" type="number" min={1} step={1} {...form.register("payoutPer1kViews")} />
        {form.formState.errors.payoutPer1kViews ? (
          <p className="text-sm text-destructive">{form.formState.errors.payoutPer1kViews.message}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="budget">Total budget (cents)</Label>
        <Input id="budget" type="number" min={1} step={1} {...form.register("totalBudget")} />
        {form.formState.errors.totalBudget ? (
          <p className="text-sm text-destructive">{form.formState.errors.totalBudget.message}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          className="h-10 rounded-md border bg-background px-3 text-sm"
          {...form.register("status")}
        >
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="startsAt">Starts</Label>
        <Input
          id="startsAt"
          type="datetime-local"
          defaultValue={toDatetimeLocal(form.getValues("startsAt"))}
          onChange={(event) => form.setValue("startsAt", new Date(event.target.value), { shouldValidate: true })}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="endsAt">Ends</Label>
        <Input
          id="endsAt"
          type="datetime-local"
          defaultValue={toDatetimeLocal(form.getValues("endsAt"))}
          onChange={(event) => form.setValue("endsAt", new Date(event.target.value), { shouldValidate: true })}
        />
        {form.formState.errors.endsAt ? (
          <p className="text-sm text-destructive">{form.formState.errors.endsAt.message}</p>
        ) : null}
      </div>

      {(create.error || update.error) && (
        <p className="text-sm text-destructive">{create.error?.message ?? update.error?.message}</p>
      )}

      <Button type="submit" disabled={create.isPending || update.isPending}>
        {campaignId ? "Save campaign" : "Create campaign"}
      </Button>
    </form>
  );
}
