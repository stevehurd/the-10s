# Production deployment and cutover

This application is deployed on Vercel, uses Supabase Auth and Postgres, and
keeps application schema history exclusively in versioned Prisma migrations.
Cloudflare manages DNS for `league-house.com`.

Production is not an extension of local development. Every external read and
write is a separately approved operation, and preview deployments must never
receive production credentials.

## Hard safety rules

- Never use `prisma db push` against a shared, restored, or production database.
- Never run `db:setup` or a development seed against production.
- Never point local development or preview deployments at production Supabase.
- Never migrate production before a verified backup and restored-copy rehearsal.
- Never change production DNS, Vercel, Supabase, cron, or secrets without explicit
  approval for that exact operation.
- Preserve the legacy 2025 `users`, `drafts`, and team W-L-T values as immutable
  source evidence until migration reconciliation is signed off.

## Environment boundaries

| Environment | Database and Auth | Secrets | Public hostname |
| --- | --- | --- | --- |
| Local | Development Supabase only | Runtime injection from the development 1Password item | `http://localhost:3000` |
| Preview/staging | Development or isolated staging Supabase | Vercel preview-scoped, never production | Optional `staging.league-house.com` |
| Production | Production Supabase only | Vercel production-scoped values | `https://league-house.com` |

Required variable names are documented in `.env.example`. Never copy secret
values into this document, source control, build logs, or screenshots.

## Gate 1: local readiness

This gate requires no production access.

- Run lint, type checking, tests, and the migration-history check.
- Complete the multi-user human draft rehearsal.
- Verify commissioner and member authorization, reconnect, pause/resume, undo,
  timeout autopick, concurrent picks, and final roster quotas.
- Confirm invitation delivery remains disabled unless every required setting is
  intentionally configured.
- Confirm the rollback owner and decision criteria in
  [the readiness checklist](docs/PRODUCTION_READINESS.md).

## Gate 2: read-only production inventory

Obtain explicit approval before accessing Vercel, Supabase, the production
database, or the production 1Password item—even for read-only inspection.

Record outside the repository:

- current Vercel production deployment identifier and source commit;
- current database provider, project, region, and schema state;
- counts for legacy users, teams, seasons, drafts, and games;
- the intended commissioner legacy user ID;
- current public hostname, Supabase Site URL, redirects, and scheduled jobs.

Do not print credentials, member emails, connection URLs, or provider payloads.

## Gate 3: backup and restored-copy rehearsal

Follow [the 2025 migration runbook](docs/MIGRATION_RUNBOOK.md). This gate needs
separate approval for the production backup and for access to the isolated
restore target.

1. Create a logical production backup without placing credentials on disk.
2. Record its timestamp, byte size, and SHA-256 checksum outside the repository.
3. Restore it into an isolated, non-production database.
4. Apply the reviewed Prisma migration history with `prisma migrate deploy`.
5. Run the 2025 data preflight, save its source fingerprint, then apply only to
   the restored copy.
6. Reconcile all 15 legacy players, ten roster slots per player, team ownership,
   2025 team records, leaderboard totals, and commissioner membership.
7. Prove the documented restore/rollback procedure works.

A failed or ambiguous reconciliation stops the release. It is never corrected
by rewriting the legacy source rows.

## Gate 4: staging validation

Deploy the candidate commit with an isolated database and non-production keys.
Do not attach `league-house.com` yet.

- Test passwordless sign-in and one synthetic legacy-player claim.
- Run a complete commissioner/member draft rehearsal on phone and desktop.
- Verify official and rehearsal draft isolation.
- Verify standings sync safety and sanitized failure reporting.
- Confirm no preview environment contains production secrets.

## Gate 5: domain and email preparation

Cloudflare remains the authoritative DNS provider.

- Add the application domain to Vercel, then add only the records Vercel reports
  as required to Cloudflare. Begin with DNS-only records.
- Use `league-house.com` as the canonical application hostname and redirect
  `www.league-house.com` to it.
- Verify `mail.league-house.com` as the dedicated Resend sending domain.
- Disable open and link tracking for authentication messages.
- Test Resend and Supabase SMTP with the development project first.
- Keep production invitations disabled until after cutover verification.

Adding DNS records, changing Supabase Auth URLs, and enabling outbound email are
three separate production-facing approvals.

## Gate 6: production cutover

Schedule a write freeze on the legacy application. Obtain explicit approval for
each of the backup, database migration, deployment, DNS, Auth configuration,
cron, and invitation operations.

1. Record the approved commit and current deployment.
2. Start the legacy write freeze.
3. Create and verify a fresh backup.
4. Re-run preflight and confirm its fingerprint matches the source at apply time.
5. Apply reviewed Prisma migrations with `prisma migrate deploy`.
6. Apply the 2025 data migration using the approved fingerprint and commissioner
   selector.
7. Require a passing reconciliation before deploying the application.
8. Deploy the approved commit and run authenticated smoke tests on its Vercel
   hostname.
9. Attach `league-house.com` and confirm TLS and the `www` redirect.
10. Set the production Supabase Site URL and exact redirect allowlist.
11. Verify commissioner/member sign-in, historical standings, rosters, and
    Keep/Release behavior.
12. Enable scheduled jobs, then invitations, only after all prior checks pass.

## Rollback decision

Before members enter new Keep/Release choices, rollback means restoring the
verified backup and directing the previous deployment to it. After new writes
begin, do not perform an improvised in-place rollback. Stop writes, preserve
evidence, and use the recorded recovery plan.

Rollback immediately for any of the following:

- missing or altered 2025 users, rosters, team records, or win totals;
- incorrect commissioner identity or broken member authorization;
- a migration reconciliation failure;
- production traffic reaching a development database or preview secrets;
- inability to complete or reverse the documented deployment safely.

## Post-cutover observation

- Retain backup metadata, migration output, and source fingerprint securely.
- Monitor authentication, invitation, draft, standings-sync, and cron failures.
- Observe the first real 2026 college standings rollover before trusting
  unattended updates.
- Keep completed seasons immutable unless an audited commissioner workflow
  explicitly reopens one.
