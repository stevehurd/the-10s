#!/usr/bin/env node

import { PrismaClient } from '@prisma/client'
import {
  createPreflightReport,
  legacyFingerprint,
  legacyRosterNickname,
  rankLegacyParticipants,
  reconcileMigrationSnapshot,
} from './lib/legacy-2025-rehearsal.mjs'

const prisma = new PrismaClient()
const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const backupConfirmed = args.has('--backup-confirmed')
const summaryOnly = args.has('--summary-only')
const commissionerFlagIndex = process.argv.indexOf('--commissioner-email')
const commissionerEmail =
  commissionerFlagIndex >= 0 ? process.argv[commissionerFlagIndex + 1]?.trim().toLowerCase() : null
const commissionerUserIdFlagIndex = process.argv.indexOf('--commissioner-user-id')
const requestedCommissionerUserId = commissionerUserIdFlagIndex >= 0
  ? process.argv[commissionerUserIdFlagIndex + 1]?.trim()
  : null
const fingerprintFlagIndex = process.argv.indexOf('--source-fingerprint')
const expectedFingerprint =
  fingerprintFlagIndex >= 0 ? process.argv[fingerprintFlagIndex + 1]?.trim() : null

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function loadLegacyData(client = prisma) {
  // Read only columns guaranteed by the legacy schema. The generated Prisma
  // client targets the expanded schema and would otherwise select new columns
  // before their migrations exist in production.
  const seasons = await client.$queryRaw`
    SELECT
      s."id",
      s."year",
      s."name",
      s."status",
      NULL::timestamp AS "finalizedAt"
    FROM "seasons" s
    WHERE s."year" = 2025
  `
  assert(seasons.length === 1, `Expected exactly one 2025 season; found ${seasons.length}`)
  const season = seasons[0]

  const rawUsers = await client.$queryRaw`
    SELECT u."id", u."email", u."name"
    FROM "users" u
    WHERE EXISTS (
      SELECT 1
      FROM "drafts" d
      WHERE d."user_id" = u."id"
        AND d."season_id" = ${season.id}
    )
    ORDER BY u."name" ASC
  `
  const drafts = await client.$queryRaw`
    SELECT
      d."id",
      d."season_id" AS "seasonId",
      d."user_id" AS "userId",
      d."team_id" AS "teamId",
      d."round",
      d."pick_number" AS "pickNumber",
      d."is_keeper" AS "isKeeper"
    FROM "drafts" d
    WHERE d."season_id" = ${season.id}
    ORDER BY d."user_id" ASC, d."round" ASC
  `
  const teams = await client.$queryRaw`
    SELECT
      t."id",
      t."name",
      t."abbr" AS "abbreviation",
      t."conference",
      t."division",
      t."league",
      t."external_id" AS "externalId",
      t."logo_url" AS "logoUrl",
      t."wins",
      t."losses",
      COALESCE((to_jsonb(t) ->> 'ties')::integer, 0) AS "ties",
      COALESCE((to_jsonb(t) ->> 'active')::boolean, true) AS "active"
    FROM "teams" t
    ORDER BY t."league" ASC, t."name" ASC
  `
  const teamById = new Map(teams.map((team) => [team.id, team]))
  const draftsByUserId = new Map()
  for (const draft of drafts) {
    const userDrafts = draftsByUserId.get(draft.userId) ?? []
    userDrafts.push({ ...draft, team: teamById.get(draft.teamId) ?? null })
    draftsByUserId.set(draft.userId, userDrafts)
  }
  const users = rawUsers.map((user) => ({
    ...user,
    drafts: draftsByUserId.get(user.id) ?? [],
  }))
  assert(users.length > 0, 'No users exist')
  assert(teams.length > 0, 'No teams exist')

  return { season, users, teams }
}

async function migrate({ season, users, teams }, sourceFingerprint) {
  assert(
    Boolean(commissionerEmail) !== Boolean(requestedCommissionerUserId),
    'Provide exactly one of --commissioner-email or --commissioner-user-id with --apply',
  )
  assert(backupConfirmed, '--backup-confirmed is required with --apply')
  assert(expectedFingerprint, '--source-fingerprint is required with --apply')
  assert(
    expectedFingerprint === sourceFingerprint,
    'Source fingerprint does not match this preflight. Stop and create a new backup.',
  )
  const commissioner = requestedCommissionerUserId
    ? users.find((user) => user.id === requestedCommissionerUserId)
    : users.find((user) => user.email?.trim().toLowerCase() === commissionerEmail)
  assert(commissioner, requestedCommissionerUserId
    ? 'Commissioner user ID does not match a 2025 user'
    : 'Commissioner email does not match a 2025 user')
  const commissionerUserId = commissioner.id

  const standings = rankLegacyParticipants(users)

  const migratedAt = new Date()
  await prisma.$transaction(async (tx) => {
    const pool = await tx.pool.upsert({
      where: { slug: 'the-10s' },
      update: { name: "The 10's" },
      create: { name: "The 10's", slug: 'the-10s' },
    })

    await tx.season.update({
      where: { id: season.id },
      data: { poolId: pool.id, status: 'FINALIZED', finalizedAt: season.finalizedAt ?? migratedAt },
    })

    for (const team of teams) {
      await tx.teamSeasonRecord.upsert({
        where: { seasonId_teamId: { seasonId: season.id, teamId: team.id } },
        update: {
          wins: team.wins,
          losses: team.losses,
          ties: team.ties,
          source: 'LEGACY_2025_TOTAL',
          finalizedAt: season.finalizedAt ?? migratedAt,
        },
        create: {
          seasonId: season.id,
          teamId: team.id,
          wins: team.wins,
          losses: team.losses,
          ties: team.ties,
          source: 'LEGACY_2025_TOTAL',
          finalizedAt: season.finalizedAt ?? migratedAt,
        },
      })

      await tx.seasonTeamEligibility.upsert({
        where: { seasonId_teamId: { seasonId: season.id, teamId: team.id } },
        update: {
          status: team.active ? 'APPROVED' : 'INACTIVE',
          source: 'LEGACY_2025',
          nameSnapshot: team.name,
          abbreviationSnapshot: team.abbreviation,
          conferenceSnapshot: team.conference,
          divisionSnapshot: team.division,
          leagueSnapshot: team.league,
        },
        create: {
          seasonId: season.id,
          teamId: team.id,
          status: team.active ? 'APPROVED' : 'INACTIVE',
          source: 'LEGACY_2025',
          nameSnapshot: team.name,
          abbreviationSnapshot: team.abbreviation,
          conferenceSnapshot: team.conference,
          divisionSnapshot: team.division,
          leagueSnapshot: team.league,
          approvedAt: team.active ? new Date() : null,
        },
      })
    }

    for (const standing of standings) {
      const user = standing.user
      const rosterNickname = legacyRosterNickname(user.name)
      await tx.poolMembership.upsert({
        where: { poolId_userId: { poolId: pool.id, userId: user.id } },
        update: {
          status: 'ACTIVE',
          role: user.id === commissionerUserId ? 'COMMISSIONER' : 'MEMBER',
        },
        create: {
          poolId: pool.id,
          userId: user.id,
          status: 'ACTIVE',
          role: user.id === commissionerUserId ? 'COMMISSIONER' : 'MEMBER',
        },
      })

      let participant = await tx.seasonParticipant.findUnique({
        where: { seasonId_userId: { seasonId: season.id, userId: user.id } },
      })
      if (!participant) {
        const seat = await tx.poolSeat.create({
          data: { poolId: pool.id, label: rosterNickname },
        })
        participant = await tx.seasonParticipant.create({
          data: {
            seasonId: season.id,
            poolSeatId: seat.id,
            userId: user.id,
            finalRank: standing.finalRank,
            totalWins: standing.totalWins,
            nflWins: standing.nflWins,
            collegeWins: standing.collegeWins,
          },
        })
      } else {
        participant = await tx.seasonParticipant.update({
          where: { id: participant.id },
          data: {
            finalRank: standing.finalRank,
            totalWins: standing.totalWins,
            nflWins: standing.nflWins,
            collegeWins: standing.collegeWins,
          },
        })
      }

      await tx.poolSeat.updateMany({
        where: {
          id: participant.poolSeatId,
          OR: [
            { label: null },
            { label: { startsWith: '2025 seat ' } },
          ],
        },
        data: { label: rosterNickname },
      })

      const draftByRound = new Map(user.drafts.map((draft) => [draft.round, draft]))
      for (let number = 1; number <= 10; number += 1) {
        const draft = draftByRound.get(number)
        await tx.rosterSlot.upsert({
          where: {
            seasonParticipantId_number: {
              seasonParticipantId: participant.id,
              number,
            },
          },
          update: {
            teamId: draft?.teamId ?? null,
            inheritedTeamId: null,
            retentionChoice: 'HISTORICAL',
            source: 'HISTORICAL',
          },
          create: {
            seasonId: season.id,
            seasonParticipantId: participant.id,
            number,
            teamId: draft?.teamId ?? null,
            retentionChoice: 'HISTORICAL',
            source: 'HISTORICAL',
          },
        })
      }
    }

    const migratedParticipants = await tx.seasonParticipant.findMany({
      where: { seasonId: season.id },
      include: { poolSeat: true, rosterSlots: { include: { team: true } } },
    })
    const migratedRecords = await tx.teamSeasonRecord.findMany({ where: { seasonId: season.id } })
    const migratedSeason = await tx.season.findUnique({ where: { id: season.id } })
    const migratedMemberships = await tx.poolMembership.findMany({ where: { poolId: pool.id } })
    const reconciliationErrors = reconcileMigrationSnapshot(
      { season, users, teams },
      {
        participants: migratedParticipants,
        teamRecords: migratedRecords,
        season: migratedSeason,
        memberships: migratedMemberships,
      },
      { commissionerUserId },
    )
    assert(reconciliationErrors.length === 0, `Reconciliation failed: ${reconciliationErrors.join('; ')}`)
    const legacyAfterMigration = await loadLegacyData(tx)
    assert(
      legacyFingerprint(legacyAfterMigration) === sourceFingerprint,
      'Reconciliation failed: legacy source rows changed during migration',
    )

    await tx.auditEvent.create({
      data: {
        poolId: pool.id,
        seasonId: season.id,
        action: 'LEGACY_2025_IMPORTED',
        entityType: 'Season',
        entityId: season.id,
        data: {
          users: users.length,
          teams: teams.length,
          rosterAssignments: users.reduce((total, user) => total + user.drafts.length, 0),
          sourceFingerprint,
          reconciliation: 'PASSED',
        },
      },
    })
  }, {
    maxWait: 15_000,
    timeout: 120_000,
  })
}

async function main() {
  const data = await loadLegacyData()
  const report = createPreflightReport(data)
  const sourceFingerprint = report.sourceFingerprint

  console.log(summaryOnly ? `2025 season year: ${report.season.year}` : `2025 season: ${report.season.name}`)
  console.log(`Users: ${report.counts.users}`)
  console.log(`Teams: ${report.counts.teams}`)
  console.log(`Roster assignments: ${report.counts.rosterAssignments}`)
  console.log(`Source fingerprint: ${sourceFingerprint}`)

  if (report.warnings.length > 0) {
    if (summaryOnly) {
      console.warn(`Preflight warnings: ${report.warnings.length} (details suppressed)`)
    } else {
      console.warn('\nPreflight warnings:')
      for (const warning of report.warnings) console.warn(`- ${warning}`)
    }
  }

  if (!report.passed) {
    if (summaryOnly) {
      console.error(`Preflight failed with ${report.errors.length} error(s); details suppressed.`)
    } else {
      console.error('\nPreflight failed:')
      for (const error of report.errors) console.error(`- ${error}`)
    }
    process.exitCode = 1
    return
  }

  console.log('Preflight passed.')
  if (!apply) {
    console.log('No data was changed. Save this fingerprint with the verified backup and reconciliation report.')
    return
  }

  await migrate(data, sourceFingerprint)
  console.log('2025 data migration and reconciliation completed.')
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
