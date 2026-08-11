# Production readiness checklist

This is the release record for moving the expanded Football Pool application to
production. Check an item only when evidence exists. Store credentials, member
emails, database URLs, backup archives, and provider exports outside the
repository.

## Release identity

- [ ] Release owner identified
- [ ] Approved Git commit recorded
- [ ] Current production deployment recorded
- [ ] Intended commissioner legacy user ID confirmed privately
- [ ] Maintenance/write-freeze window agreed
- [ ] Rollback owner identified

## Local and automated verification

- [x] Lint passes without new warnings
- [x] Type checking passes
- [x] Full test suite passes
- [x] Prisma migration-history checksum check passes
- [x] Synthetic 2025 migration rehearsal passes
- [x] No unrelated working-tree changes are included

## Human draft rehearsal

Release owner elected to skip this manual rehearsal for checkpoint `6e91c61`
on 2026-08-11. The items remain deliberately unchecked and must be treated as
accepted release risk at the final GO/NO-GO decision.

- [ ] Commissioner and member use separate authenticated browser sessions
- [ ] Waiting member can star teams and queue one private pick
- [ ] Waiting member cannot submit another participant's pick
- [ ] Commissioner can start, pause, resume, and pick for a participant
- [ ] Every new turn receives the full configured clock
- [ ] Expired turn produces one correct quota-aware autopick when browser and worker requests race
- [ ] Refresh/reconnect reconstructs canonical draft state
- [ ] Simultaneous selection attempts commit exactly one pick
- [ ] Undo restores the correct turn and team availability
- [ ] Completed draft creates exactly 2 NFL and 8 FBS teams per roster
- [ ] Rehearsal completion does not change official rosters
- [ ] Phone-sized draft flow is usable

## Read-only production inventory

- [x] Exact read-only access approved
- [x] Database provider/project and region recorded privately
- [x] Legacy users, teams, seasons, drafts, and games counted
- [x] Current schema/migration state recorded
- [x] Current Vercel deployment and production hostname recorded
- [x] Isolated production Supabase Auth project created
- [x] Current Supabase Auth Site URL and redirects recorded
- [x] Current scheduled jobs recorded
- [x] No secret or member contact value entered logs or artifacts

## Backup and restored-copy rehearsal

- [x] Production backup explicitly approved
- [x] Backup timestamp, size, and SHA-256 checksum recorded privately
- [x] Backup metadata names the dashboard-confirmed provider/deployment and includes only `public`
- [x] Backup restored into an isolated database
- [x] Restore target proven not to be production
- [x] Player names retained; emails, auth links, and invitation metadata removed before preview access
- [x] Reviewed Prisma migrations deploy successfully to the restored copy
- [x] 2025 preflight passes and source fingerprint is saved
- [x] 2025 data migration applies successfully to the restored copy
- [x] All 15 legacy profiles reconcile
- [x] Every participant has ten unique numbered roster slots
- [x] Every roster reconciles to exactly 2 NFL and 8 FBS teams
- [x] Team ownership and 2025 W-L-T values match the source
- [x] Every participant's total wins match the legacy leaderboard
- [x] Exactly one intended commissioner membership exists
- [x] Completed 2025 records reject mutation
- [x] 2026 FBS sync uses SportsDataIO `LeagueHierarchy`
- [x] Unchanged 2026 FBS teams auto-approve and only additions/removals/detail changes require review
- [x] 2026 provider result reports 138 active FBS teams and the expected eight-team Pac-12
- [x] Re-running the 2026 FBS sync preserves audited commissioner overrides
- [x] 2025 eligibility snapshots and rosters remain unchanged after the 2026 sync
- [ ] Restore-based rollback has been tested

## Staging

- [x] Candidate deployed with isolated non-production Supabase
- [x] Preview/staging environment contains no production credentials
- [x] Passwordless sign-in works
- [x] Synthetic legacy-player invitation and claim works
- [ ] Complete multi-user draft rehearsal passes
- [x] Standings synchronization safety checks pass
- [ ] Authenticated phone and desktop smoke tests pass

## Domain and transactional email

- [ ] Vercel reports the required Cloudflare DNS records
- [ ] `league-house.com` is configured as the canonical hostname
- [ ] `www.league-house.com` redirects to the canonical hostname
- [ ] TLS is valid on both hostnames
- [ ] `mail.league-house.com` passes Resend SPF and DKIM verification
- [ ] Authentication email open/link tracking is disabled
- [x] Resend SMTP works with development Supabase
- [x] Resend SMTP is configured in production Supabase
- [x] Supabase email template matches the chosen passwordless-link flow
- [ ] Production invitation delivery remains disabled

## Production cutover

- [x] Backup operation approved
- [ ] Schema/data migration approved
- [ ] Vercel production deployment approved
- [ ] Cloudflare DNS change approved
- [ ] Supabase Auth URL change approved
- [ ] Scheduled-job change approved
- [x] Production autopick resilience chosen: browser-triggered autopick accepted for initial launch
- [ ] Invitation enablement approved
- [ ] Legacy application write freeze started
- [ ] Fresh backup checksum verified
- [ ] Source fingerprint unchanged at migration apply time
- [ ] Schema and 2025 data migrations reconcile successfully
- [ ] Approved application commit deployed
- [ ] Vercel-hostname smoke test passes before DNS cutover
- [ ] Production Site URL is `https://league-house.com`
- [ ] Production redirect allowlist uses exact URLs
- [ ] Commissioner sign-in and authorization pass
- [ ] Member sign-in and authorization pass
- [ ] Historical 2025 standings, rosters, and totals pass spot checks
- [ ] Production 2026 college team-pool result matches the approved rehearsal evidence
- [ ] Only approved 2026 college teams appear in draft preparation and the official draft
- [ ] Keep/Release writes only to the intended upcoming season
- [ ] Scheduled jobs enabled and observed
- [x] Browser-only autopick limitation explicitly accepted for the official draft
- [ ] One invitation successfully completes before bulk invitations
- [ ] Write freeze ended only after every required check passes

## Post-cutover

- [ ] Backup and migration evidence retained securely
- [ ] Authentication and invitation failures monitored
- [ ] Draft and cron failures monitored
- [ ] Standings-sync failures monitored
- [ ] First 2026 CFB rollover and eight-team Pac-12 membership manually verified
- [ ] Rollback window formally closed by the release owner

## Release decision

- [ ] **GO** — all required evidence is present
- [ ] **NO-GO** — writes remain frozen or the previous deployment remains active

Notes must contain no credentials or private member information:

```text
2026-08-11 staging release candidate
- Git checkpoint: 6e91c61
- Vercel commit status: successful
- Staging hostname and immutable preview returned identical Next.js asset manifests
- Authenticated staging dashboard loaded with migrated 2025 and preseason 2026
- Season navigation displayed the correct 2025 completed view
- College team pool: 138 active FBS, 127 auto-approved, 11 review exceptions
- Pac-12: eight expected 2026 members
- Automated evidence: lint, typecheck, 102-test suite, migration checksum, production build
- Synthetic migration rehearsal: passed without database access or writes
- Manual multi-user draft rehearsal: skipped by release owner; remains unchecked
- Autopick operations: browser-triggered model accepted; no external scheduler for initial launch
- Production read-only inventory: 15 users, 168 teams, 1 season, 150 drafts, 0 games
- Production schema: legacy tables present; expansion tables absent
- Production migration history: completed `20250902141401_init`; repository baseline not yet resolved
- Current production application: Vercel `main` at `abf4a79`; hostname `the-10s.vercel.app`
- Current production schedule: standings sync daily at 06:00 UTC; no draft autopick cron
- Production Supabase Auth project: `League House Production`, `us-east-1`, active and isolated from development
- Production Supabase Auth Site URL: `https://league-house.com`
- Production Supabase Auth redirect allowlist: `https://league-house.com/auth/confirm`
- Production Auth provider settings match the tested development flow: email enabled, phone disabled, signups and email confirmation enabled
- Production custom SMTP: enabled with the expected Resend sender, host, port, username, and encrypted password; delivery test remains pending
- Production database deployment recorded privately; provider dashboard identity matched the production connection before backup
- Fresh owner-only `public`-schema backup created successfully; archive and checksum metadata are retained outside the repository
```
