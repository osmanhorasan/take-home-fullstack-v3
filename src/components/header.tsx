"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/trpc/react";

export function Header() {
  const router = useRouter();
  const me = api.auth.me.useQuery();
  const users = api.auth.listUsers.useQuery();
  const switchUser = api.auth.switchUser.useMutation({
    onSuccess: async () => {
      await me.refetch();
      router.refresh();
      router.push("/");
    },
  });

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Clip campaigns
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm">
          {me.data?.role === "admin" ? (
            <Link className="underline-offset-4 hover:underline" href="/admin/campaigns">
              Campaigns
            </Link>
          ) : null}
          {me.data?.role === "creator" ? (
            <>
              <Link className="underline-offset-4 hover:underline" href="/creator/campaigns">
                Browse
              </Link>
              <Link className="underline-offset-4 hover:underline" href="/creator/submissions">
                My clips
              </Link>
            </>
          ) : null}
          <label className="flex items-center gap-2 text-muted-foreground">
            <span className="sr-only">Switch user</span>
            <select
              className="h-9 rounded-md border bg-background px-2 text-foreground"
              aria-label="Switch user"
              value={me.data?.id ?? ""}
              disabled={switchUser.isPending}
              onChange={(event) => {
                if (event.target.value) {
                  switchUser.mutate({ userId: event.target.value });
                }
              }}
            >
              <option value="" disabled>
                Pick a user
              </option>
              {(users.data ?? []).map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email} ({user.role})
                </option>
              ))}
            </select>
          </label>
        </nav>
      </div>
    </header>
  );
}
