import { createCallerFactory, router } from "@/server/trpc/trpc";
import { authRouter } from "@/server/trpc/routers/auth";
import { campaignRouter } from "@/server/trpc/routers/campaigns";
import { submissionRouter } from "@/server/trpc/routers/submissions";

export const appRouter = router({
  auth: authRouter,
  campaign: campaignRouter,
  submission: submissionRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
