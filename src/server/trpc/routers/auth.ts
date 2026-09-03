import { z } from "zod";
import { eq, like } from "drizzle-orm";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "@/server/trpc/trpc";
import { setSessionUser } from "@/server/auth";
import { users } from "@/server/db/schema";

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.user),
  listUsers: publicProcedure.query(({ ctx }) =>
    ctx.db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(like(users.email, "%@example.com"))
      .orderBy(users.email),
  ),
  switchUser: publicProcedure.input(z.object({ userId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const [user] = await ctx.db.select().from(users).where(eq(users.id, input.userId)).limit(1);
    if (!user) {
      throw new Error("Unknown user");
    }
    await setSessionUser(user.id);
    return user;
  }),
  pingProtected: protectedProcedure.query(({ ctx }) => ctx.user.id),
  pingAdmin: adminProcedure.query(({ ctx }) => ctx.user.id),
});
