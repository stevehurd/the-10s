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

- [ ] Lint passes without new warnings
- [ ] Type checking passes
- [ ] Full test suite passes
- [ ] Prisma migration-history checksum check passes
- [ ] Synthetic 2025 migration rehearsal passes
- [ ] No unrelated working-tree changes are included

## Human draft rehearsal

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

- [ ] Exact read-only access approved
- [ ] Database provider/project and region recorded privately
- [ ] Legacy users, teams, seasons, drafts, and games counted
- [ ] Current schema/migration state recorded
- [ ] Current Vercel deployment and production hostname recorded
- [ ] Current Supabase Auth Site URL and redirects recorded
- [ ] Current scheduled jobs recorded
- [ ] No secret or member contact value entered logs or artifacts

## Backup and restored-copy rehearsal

- [ ] Production backup explicitly approved
- [ ] Backup timestamp, size, and SHA-256 checksum recorded privately
- [ ] Backup metadata names the dashboard-confirmed provider/deployment and includes only `public`
- [ ] Backup restored into an isolated database
- [ ] Restore target proven not to be production
- [ ] Player names retained; emails, auth links, and invitation metadata removed before preview access
- [ ] Reviewed Prisma migrations deploy successfully to the restored copy
- [ ] 2025 preflight passes and source fingerprint is saved
- [ ] 2025 data migration applies successfully to the restored copy
- [ ] All 15 legacy profiles reconcile
- [ ] Every participant has ten unique numbered roster slots
- [ ] Every roster reconciles to exactly 2 NFL and 8 FBS teams
- [ ] Team ownership and 2025 W-L-T values match the source
- [ ] Every participant's total wins match the legacy leaderboard
- [ ] Exactly one intended commissioner membership exists
- [ ] Completed 2025 records reject mutation
- [ ] 2026 FBS sync uses SportsDataIO `LeagueHierarchy`
- [ ] Unchanged 2026 FBS teams auto-approve and only additions/removals/detail changes require review
- [ ] 2026 provider result reports 138 active FBS teams and the expected eight-team Pac-12
- [ ] Re-running the 2026 FBS sync preserves audited commissioner overrides
- [ ] 2025 eligibility snapshots and rosters remain unchanged after the 2026 sync
- [ ] Restore-based rollback has been tested

## Staging

- [ ] Candidate deployed with isolated non-production Supabase
- [ ] Preview/staging environment contains no production credentials
- [ ] Passwordless sign-in works
- [ ] Synthetic legacy-player invitation and claim works
- [ ] Complete multi-user draft rehearsal passes
- [ ] Standings synchronization safety checks pass
- [ ] Authenticated phone and desktop smoke tests pass

## Domain and transactional email

- [ ] Vercel reports the required Cloudflare DNS records
- [ ] `league-house.com` is configured as the canonical hostname
- [ ] `www.league-house.com` redirects to the canonical hostname
- [ ] TLS is valid on both hostnames
- [ ] `mail.league-house.com` passes Resend SPF and DKIM verification
- [ ] Authentication email open/link tracking is disabled
- [ ] Resend SMTP works with development Supabase
- [ ] Supabase email template matches the chosen passwordless-link flow
- [ ] Production invitation delivery remains disabled

## Production cutover

- [ ] Backup operation approved
- [ ] Schema/data migration approved
- [ ] Vercel production deployment approved
- [ ] Cloudflare DNS change approved
- [ ] Supabase Auth URL change approved
- [ ] Scheduled-job change approved
- [ ] Production autopick resilience chosen: Vercel Pro cron, external scheduler, or documented browser-only acceptance
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
- [ ] Server-side autopick worker observed, or browser-only limitation explicitly accepted for the official draft
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

```
