import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { User } from "@/server/db/schema";
import { db } from "@/server/db";
import { BudgetExceededError } from "@/server/domain/budget";

export type TRPCContext = {
  db: typeof db;
  user: User | null;
};

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const cause = error.cause;
    return {
      ...shape,
      data: {
        ...shape.data,
        budget:
          cause instanceof BudgetExceededError
            ? {
                code: cause.code,
                remaining: cause.remaining,
                required: cause.required,
                spent: cause.spent,
              }
            : undefined,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;

export const router = t.router;
export const publicProcedure = t.procedure;

const enforceUser = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Pick a user in the switcher" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = publicProcedure.use(enforceUser);

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
  }
  return next({ ctx });
});

export const creatorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "creator") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Creator only" });
  }
  return next({ ctx });
});
