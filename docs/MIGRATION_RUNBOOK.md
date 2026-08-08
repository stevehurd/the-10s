# 2025 production migration runbook

Do not run this procedure until a separate Supabase development project has passed the rehearsal and the repository owner explicitly approves production access.

## Preconditions

- Record the current production deployment and database provider.
- Export a logical database backup and restore it into an isolated database.
- Record the backup location, creation timestamp, file size, and checksum outside the repository.
- Verify the restored counts for users, teams, seasons, drafts, and games.
- Configure the destination through runtime-injected credentials; do not save production credentials in the repository.
- Confirm the intended commissioner email outside logs and source control.

## Migration history baseline

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

The script is idempotent for the pool, memberships, participant records, team-season totals, eligibility, and roster slots. It never deletes or rewrites legacy `users`, `drafts`, or team W-L-T values. It marks the new 2025 season projection and team-season records finalized so later sync jobs refuse to change them. Before committing its transaction, it re-reads the legacy source rows, verifies their fingerprint is unchanged, and reconciles every participant, roster slot, team assignment, and win total. Any mismatch rolls back the entire data migration.

## Verification

Compare these values with the source export:

- `users` equals active 2025 participants plus any known administrative profiles.
- `season_participants` equals the number of 2025 roster owners.
- Each participant has exactly ten `roster_slots`.
- Each roster contains two NFL and eight college teams.
- The sum of roster wins matches the legacy leaderboard for every user.
- `team_season_records` preserves each team's legacy total wins and losses.
- The 2025 season and every 2025 team-season record are finalized and rejected by future sync operations.
- Exactly one intended user has an active commissioner membership.
- The post-migration audit event records the source fingerprint and `reconciliation: PASSED`.

Pre-create each pool member with the correct email through commissioner access. Their first verified Supabase OTP sign-in atomically links `auth_user_id` to the migrated profile.

## Rollback

Before production cutover, rollback means restoring the verified pre-migration backup and pointing the prior deployment at it. Do not attempt an in-place destructive rollback after users have entered Keep/Release decisions.

The additive expansion migration intentionally retains the legacy tables and columns so the old deployment can remain readable during rehearsal. Establish a write freeze before the production migration to avoid divergent records.
