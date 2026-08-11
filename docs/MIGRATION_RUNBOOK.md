# 2025 production migration runbook

Do not run this procedure until a separate Supabase development project has passed the rehearsal and the repository owner explicitly approves production access.

## Credential-free synthetic rehearsal

Run this before using any backup, database URL, or 1Password item:

```sh
npm run migrate:2025-rehearsal
```

This command uses a fully synthetic legacy season and does not initialize Prisma or access a database. It prints a machine-readable report followed by deterministic tests. The rehearsal must report:

- `passed: true`
- `productionAccessed: false`
- `dataChanged: false`
- stable source fingerprints regardless of query ordering
- failures for duplicate ownership, invalid rounds or roster quotas, invalid W-L-T values, and reconciliation drift
- final ranks using total wins, best single NFL team, then best single college team
- exactly one intended active commissioner membership

The synthetic rehearsal proves the transformation rules and failure handling. It does not replace the restored-copy rehearsal below.

## Preconditions

- Record the current production deployment and database provider.
- Export a logical database backup and restore it into an isolated database.
- Record the backup location, creation timestamp, file size, and checksum outside the repository.
- Verify the restored counts for users, teams, seasons, drafts, and games.
- Configure the destination through runtime-injected credentials; do not save production credentials in the repository.
- Confirm the intended commissioner email outside logs and source control.

Store the production `DATABASE_URL` and non-pooling `DIRECT_URL` in a dedicated
1Password production item. Create the logical backup without writing credentials
to disk or stdout:

```sh
op run --account my.1password.com --env-file=.env.production.op -- \
  npm run backup:production -- \
  --output-dir "$HOME/Documents/Football Pool Backups" \
  --source-provider "CONFIRMED_DATABASE_PROVIDER" \
  --source-deployment "CONFIRMED_PRODUCTION_DEPLOYMENT"
```

The ignored `.env.production.op` file contains only 1Password references. The
backup command refuses an output directory inside the repository, uses
`pg_dump` from the `postgres:17-alpine` Docker image, writes an owner-readable
custom-format archive of the application-owned `public` schema, and creates a
sidecar JSON file with its operator-confirmed source labels, timestamp, byte
size, included schema, and SHA-256 checksum. Supabase-managed Auth data is not
included. The command never prints the connection URL or password.

Do not guess the source provider from an old deployment name. Confirm the
provider and deployment in their dashboards immediately before running the
backup, and copy those human-readable labels into the command.

Record every restored-copy rehearsal with:

- source deployment identifier and database provider
- backup creation time, byte size, and SHA-256 checksum
- isolated restore target identifier
- migration commit SHA
- preflight source fingerprint
- commissioner identity confirmation performed outside the report
- apply start/end timestamps and final reconciliation result
- rollback owner and tested restore command

Use [REHEARSAL_RECORD_TEMPLATE.md](./REHEARSAL_RECORD_TEMPLATE.md) for the
private operator record. Never commit a completed copy of that template.

## Rehearsal data and identity policy

Restore the archive into an explicitly approved, disposable staging database.
Do not restore it into the production database. Replacing synthetic staging data
is allowed only when the repository owner explicitly approves that destructive
rehearsal step; synthetic draft-harness data can be recreated later.

Retain these source values exactly so the owner can visually and numerically
compare the rehearsal with the 2025 application:

- player names
- roster nicknames, initially seeded from each production player name
- 2025 team selections and numbered draft slots
- NFL and college team identity
- team W-L-T totals, player win totals, and final rankings

Before connecting a web deployment to the restored copy, remove all contact and
authentication linkage from the application data: email addresses,
`auth_user_id` values, invitation timestamps/status, and invitation attempt
counts. The `public`-schema backup deliberately excludes Supabase Auth users and
sessions. Use the confirmed legacy user ID—not an email—to select the rehearsal
commissioner during migration. Create new rehearsal-only Supabase Auth accounts
after sanitization and link them through the normal invitation workflow.

The preview deployment must use rehearsal-only Supabase URL/key values and an
exact auth redirect allowlist. It must not receive production credentials,
production Resend credentials, or production scheduled jobs.

## Initial production autopick operations

The release owner accepted browser-triggered autopick for the initial launch;
no external draft scheduler is required. An authenticated draft-room client
requests the server-authoritative autopick after an active turn expires. The
commissioner must keep the draft room open during the official draft.

If every draft-room browser disconnects, the expired turn remains pending until
a participant reconnects and triggers the request or the commissioner resolves
the pick. The protected `/api/cron/draft-autopicks` worker remains available for
a future Vercel Pro or external scheduler, but it is intentionally unscheduled
for this cutover. The daily standings cron remains a separate requirement.

## Migration history baseline

Run `npm run migration:check` before every rehearsal or deployment. It verifies that each migration is committed, ordered, non-empty, unchanged from its reviewed SHA-256 manifest entry, and free of unmarked destructive statements. Database backup SQL remains ignored; only `prisma/migrations/**/migration.sql` is allowed through the repository ignore rules.

Use `npm run migration:inspect` only with an explicitly selected credential source. It performs read-only information-schema, aggregate table-count, and `_prisma_migrations` queries. The report contains no row-level member data, contact values, connection values, or credentials. Legacy databases without `_prisma_migrations` are reported as such rather than treated as an inspection failure.

The 2025 database was created with `prisma db push` and has no reliable Prisma migration history. The migration directory therefore contains:

1. `20250801000000_legacy_baseline`: the original schema for fresh databases.
2. `20260807000000_expansion_foundation`: additive expansion tables and columns.

For an existing verified 2025 database, mark only the legacy baseline as already applied:

```sh
npx prisma migrate resolve --applied 20250801000000_legacy_baseline
npx prisma migrate deploy
```

For a fresh empty development database, run `npx prisma migrate deploy` without resolving the baseline.

Never use `prisma db push` for this migration.

## Data preflight

The preflight is read-only and is the default behavior:

```sh
npm run migrate:2025-data
```

It verifies:

- A 2025 season exists.
- Every participant has ten unique numbered slots.
- Every roster contains two NFL and eight college teams.
- No team belongs to two participants.
- A SHA-256 fingerprint covers every 2025 roster owner, draft assignment, and team W-L-T total.

The migration refuses to apply when preflight fails.

Save the printed source fingerprint with the backup record. If production changes after the backup or preflight, the apply command will refuse to continue.

## Apply against a restored rehearsal database

After the schema migration and successful preflight:

```sh
npm run migrate:2025-data -- \
  --apply \
  --backup-confirmed \
  --source-fingerprint COPY_THE_PREFLIGHT_FINGERPRINT \
  --commissioner-email person@example.com
```

If the intended commissioner has no legacy email, use the immutable user ID
confirmed from the isolated restored copy instead:

```sh
npm run migrate:2025-data -- \
  --apply \
  --backup-confirmed \
  --source-fingerprint COPY_THE_PREFLIGHT_FINGERPRINT \
  --commissioner-user-id COPY_THE_CONFIRMED_LEGACY_USER_ID
```

Provide exactly one commissioner selector. The user-ID fallback assigns the
membership role without modifying the legacy `users` row or its source
fingerprint. Add verified sign-in emails afterward as a separate audited
onboarding operation.

The script is idempotent for the pool, memberships, participant records, team-season totals, eligibility, and roster slots. It never deletes or rewrites legacy `users`, `drafts`, or team W-L-T values. It marks the new 2025 season projection and team-season records finalized so later sync jobs refuse to change them. Before committing its transaction, it re-reads the legacy source rows, verifies their fingerprint is unchanged, and reconciles every participant, roster slot, team assignment, and win total. Any mismatch rolls back the entire data migration.

## Verification

Compare these values with the source export:

- `users` equals active 2025 participants plus any known administrative profiles.
- `season_participants` equals the number of 2025 roster owners.
- Each participant has exactly ten `roster_slots`.
- Each roster contains two NFL and eight college teams.
- The sum of roster wins matches the legacy leaderboard for every user.
- Every migrated pool seat initially uses the production player name as its roster nickname.
- `team_season_records` preserves each team's legacy total wins and losses.
- The 2025 season and every 2025 team-season record are finalized and rejected by future sync operations.
- Exactly one intended user has an active commissioner membership.
- The post-migration audit event records the source fingerprint and `reconciliation: PASSED`.

After 2025 passes reconciliation, create 2026 through the normal commissioner
season-creation UI. This is intentionally not part of the legacy migration. The
new season must begin in `SETUP` (preseason), inherit ten numbered roster slots
per returning participant, preserve keepers in their original slots, default the
first-round order to reverse 2025 standings, and initialize its college team pool
from the current SportsDataIO `LeagueHierarchy` feed. Do not mark 2026 active or
schedule an official draft during the data-import step.

The production rollover must use the same college team-pool workflow verified in
development. Run **Sync current FBS teams** only after the migrated 2025 season
has reconciled and 2026 exists. The sync must:

- leave the finalized 2025 eligibility snapshots and rosters unchanged;
- auto-approve teams whose name, abbreviation, conference, and division match
  their 2025 season snapshot;
- present only new, removed, or changed teams as commissioner exceptions;
- preserve audited, season-specific commissioner overrides on later syncs; and
- expose only approved 2026 teams to draft preparation and the official draft.

Record the provider total and exception breakdown. For the 2026 cutover, verify
138 active FBS teams and the eight-team Pac-12 membership observed in the
development rehearsal: Boise State, Colorado State, Fresno State, Oregon State,
San Diego State, Texas State, Utah State, and Washington State. Treat a different
provider result as a no-go requiring investigation, not as permission to edit
historical 2025 data.

For the eventual production cutover, pre-create each pool member with the correct
email through commissioner access. Their first verified Supabase email-link
sign-in atomically links `auth_user_id` to the migrated profile. During the
rehearsal, use only controlled rehearsal email addresses; do not reintroduce
real member contact data after sanitization.

## Rollback

Before production cutover, rollback means restoring the verified pre-migration backup and pointing the prior deployment at it. Do not attempt an in-place destructive rollback after users have entered Keep/Release decisions.

The additive expansion migration intentionally retains the legacy tables and columns so the old deployment can remain readable during rehearsal. Establish a write freeze before the production migration to avoid divergent records.
