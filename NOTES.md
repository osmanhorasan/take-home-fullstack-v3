# NOTES

## Setup

Needs Node 20+, pnpm, and Docker.

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open http://localhost:3000 and pick a user in the header switcher.

Useful extras:

```bash
pnpm test
pnpm ingest
```

Seed users: `admin@example.com`, `creator.a@example.com`, `creator.b@example.com`.

The seeded **Budget race** campaign has two pending clips at 5k views each and a $50 budget with $10 / 1k payout. Approving either one completes the campaign; the other should return a typed budget error.

## Concurrent approvals

Budget is a campaign-level resource, so approvals take `SELECT … FOR UPDATE` on the campaign row inside a transaction, then recompute spent from approved/paid submissions (latest metric per submission) and the candidate’s latest metric.

I considered:

- **Serializable transactions** — correct, but heavier and noisier under contention.
- **Optimistic version column** — fine, but needs an explicit retry path in the UI.
- **Advisory locks** — workable, less obvious than locking the row that owns the budget.

`FOR UPDATE` keeps the critical section obvious and makes the race test deterministic: exactly one of two simultaneous approvals succeeds when the budget covers only one payout. The loser gets `BUDGET_EXCEEDED` with remaining/required cents for the UI.

## Left out on purpose

- Real auth / email magic links / OAuth
- Marking submissions `paid` after payout (status exists; money is tracked from `approved` + metrics)
- Third-party social APIs (ingest fakes the sync)
- Fancy charts/libraries and custom branding
- Soft-delete / audit log

## First thing I’d fix with another day

Cap or reconcile spend when **post-approval** ingest grows views enough that theoretical earnings exceed `total_budget`. Today the hard ceiling is enforced at approval time (and campaign auto-completes when remaining hits zero after approve/ingest). A production system would also need a settlement rule for view growth after approval.

## AI tooling

Used Cursor heavily for scaffolding Next/tRPC/Drizzle wiring, UI chrome, and first-pass tests. I had to correct:

- treating pending submissions as budget-relevant only when metrics already exist (seed/tests insert pre-approval metrics; production ingest only touches approved rows)
- making ingest per-submission resilient instead of failing the whole run
- keeping money in integer cents end-to-end (forms included)
- verifying `FOR UPDATE` concurrency instead of trusting a non-locked read-modify-write

## Deploy note

Ship the repo publicly, run Postgres somewhere durable, set `DATABASE_URL` + `SESSION_SECRET`, run migrate + seed, host the Next app (Vercel or similar). Default subdomain is fine.
