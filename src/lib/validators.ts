import { z } from "zod";

export const PLATFORMS = ["tiktok", "instagram", "youtube"] as const;
export const platformSchema = z.enum(PLATFORMS);
export const campaignStatusSchema = z.enum(["draft", "active", "paused", "completed"]);
export const submissionStatusSchema = z.enum(["pending", "approved", "rejected", "paid"]);

export const campaignFormFieldsSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  platforms: z.array(platformSchema).min(1, "Pick at least one platform"),
  payoutPer1kViews: z.coerce.number().int().positive("Must be a positive integer (cents)"),
  totalBudget: z.coerce.number().int().positive("Must be a positive integer (cents)"),
  status: campaignStatusSchema,
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
});

export const campaignFormSchema = campaignFormFieldsSchema.refine(
  (value) => value.endsAt.getTime() > value.startsAt.getTime(),
  {
    message: "End must be after start",
    path: ["endsAt"],
  },
);

export const campaignUpdateSchema = campaignFormFieldsSchema
  .extend({ id: z.string().uuid() })
  .refine((value) => value.endsAt.getTime() > value.startsAt.getTime(), {
    message: "End must be after start",
    path: ["endsAt"],
  });

export type CampaignFormValues = z.infer<typeof campaignFormFieldsSchema>;

export const campaignListInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
  q: z.string().trim().optional(),
  status: campaignStatusSchema.optional(),
});

export const submitClipSchema = z.object({
  campaignId: z.string().uuid(),
  postUrl: z.string().trim().url("Must be a valid URL"),
});

export const rejectSubmissionSchema = z.object({
  submissionId: z.string().uuid(),
  reason: z.string().trim().min(3, "Give a short reason").max(500),
});

export const approveSubmissionSchema = z.object({
  submissionId: z.string().uuid(),
});
