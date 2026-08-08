# Repository operating rules

These instructions apply to every AI agent and automated coding tool working in this repository.

## Product invariants

- A season roster has exactly 10 numbered slots: 2 NFL teams and 8 active FBS college teams.
- A kept team remains in the same numbered slot in the following season.
- Releasing a team opens that numbered slot for the corresponding draft round.
- Returning participants must release at least 1 NFL team and 2 college teams unless a commissioner records an override.
- Draft order starts with the previous season's lowest-ranked pool seat and snakes each round. Participants with a keeper in a round are skipped.
- Completed-season standings and rosters are immutable unless a commissioner explicitly reopens the season and the change is audited.
- NFL regular-season and postseason wins count. College regular-season, conference championship, bowl, and playoff wins count. Ties are recorded but do not count as wins.
- SportsDataIO remains the operational source for NFL and FBS team/standings data. Refactors must preserve the characterized scoring results.

## Secrets and external systems

- Never read, print, copy, summarize, or transmit values from `.env*`, the process environment, 1Password, Vercel, Supabase, or another credential store without explicit user approval for that exact action.
- It is acceptable to inspect documented variable names in `.env.example`. Do not inspect local secret-file keys as a shortcut.
- Never run `op read`, `op run`, `op inject`, `printenv`, `env`, `vercel env pull`, or an equivalent secret-retrieval command without explicit approval.
- Never place credentials in source code, fixtures, logs, screenshots, issues, commits, or generated artifacts.
- Browser-exposed variables must be intentionally prefixed `NEXT_PUBLIC_`. Supabase secret/service-role keys are server-only.
- Production database access, migrations, deployments, cron changes, secret rotation, and production data exports require explicit user approval.
- Local development and automated tests must use development credentials and isolated data.

## Database changes

- Use versioned Prisma migrations; do not use `prisma db push` against shared or production databases.
- Prisma is the sole owner of the application schema. Do not create a parallel Supabase migration history for `public` application tables.
- Before a destructive or data-transforming migration, document backup, verification, and rollback steps.
- Preserve stable team identity and historical season records. Never overwrite a prior season when syncing a new one.
- Treat the legacy 2025 `users`, `drafts`, and team W-L-T fields as immutable source evidence until production migration reconciliation is signed off.
- Put concurrency invariants in database constraints as well as application validation.

## Verification gates

- Run lint, type checking, and relevant tests before handing off changes.
- Draft-engine changes require deterministic unit tests, including keeper skipping, snake order, roster quotas, autopick, ties, and simultaneous-pick protection.
- Sports-data changes require fixture-based regression tests for both NFL and college totals.
- Authorization changes require anonymous/member/commissioner access tests.
- Do not weaken, skip, or delete a failing safety test merely to make a build pass.

## Change discipline

- Preserve unrelated user changes in the working tree.
- Prefer small, reviewable migrations and commits.
- Do not deploy, push, merge, or mutate production unless the user asks for that action.
- Treat rehearsal drafts as permanently separate from official drafts; rehearsal selections can never be promoted into official roster records.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
