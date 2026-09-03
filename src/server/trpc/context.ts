import { getSessionUser } from "@/server/auth";
import { db } from "@/server/db";
import type { TRPCContext } from "@/server/trpc/trpc";

export async function createTRPCContext(): Promise<TRPCContext> {
  const user = await getSessionUser();
  return { db, user };
}
