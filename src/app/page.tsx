"use client";

import Link from "next/link";
import { api } from "@/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  const me = api.auth.me.useQuery();

  if (me.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading session…</p>;
  }

  if (!me.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pick a user</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Use the switcher in the header. There is no real auth provider in this take-home.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Hello, {me.data.email}</h1>
      <p className="text-sm text-muted-foreground">Signed in as {me.data.role}.</p>
      {me.data.role === "admin" ? (
        <Link className="w-fit rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" href="/admin/campaigns">
          Go to campaigns
        </Link>
      ) : (
        <div className="flex gap-2">
          <Link className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" href="/creator/campaigns">
            Browse campaigns
          </Link>
          <Link className="rounded-md border px-4 py-2 text-sm" href="/creator/submissions">
            My submissions
          </Link>
        </div>
      )}
    </div>
  );
}
