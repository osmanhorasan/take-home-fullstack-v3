"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { use } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { api } from "@/trpc/react";
import { submitClipSchema } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type FormValues = z.infer<typeof submitClipSchema>;

export default function SubmitClipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const campaign = api.campaign.creatorGet.useQuery({ id });
  const form = useForm<FormValues>({
    resolver: zodResolver(submitClipSchema),
    defaultValues: { campaignId: id, postUrl: "" },
  });
  const submit = api.submission.creatorSubmit.useMutation({
    onSuccess: () => router.push("/creator/submissions"),
  });

  if (!campaign.data) {
    return <p className="text-sm text-muted-foreground">Loading campaign…</p>;
  }

  return (
    <div className="grid max-w-xl gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Submit to {campaign.data.title}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          {campaign.data.platforms.map((platform) => (
            <Badge key={platform} variant="outline">
              {platform}
            </Badge>
          ))}
        </div>
      </div>
      <form
        className="grid gap-3"
        onSubmit={form.handleSubmit((values) => submit.mutate(values))}
      >
        <div className="grid gap-2">
          <Label htmlFor="postUrl">Post URL</Label>
          <Input
            id="postUrl"
            placeholder="https://www.tiktok.com/@user/video/123"
            {...form.register("postUrl")}
          />
          {form.formState.errors.postUrl ? (
            <p className="text-sm text-destructive">{form.formState.errors.postUrl.message}</p>
          ) : null}
        </div>
        {submit.error ? <p className="text-sm text-destructive">{submit.error.message}</p> : null}
        <Button type="submit" disabled={submit.isPending}>
          Submit clip
        </Button>
      </form>
    </div>
  );
}
