#!/usr/bin/env node

import { PrismaClient } from '@prisma/client'
import {
  createPreflightReport,
  legacyFingerprint,
  rankLegacyStandings,
  reconcileMigrationSnapshot,
} from './lib/legacy-2025-rehearsal.mjs'

const prisma = new PrismaClient()
const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const backupConfirmed = args.has('--backup-confirmed')
const commissionerFlagIndex = process.argv.indexOf('--commissioner-email')
const commissionerEmail =
  commissionerFlagIndex >= 0 ? process.argv[commissionerFlagIndex + 1]?.trim().toLowerCase() : null
const fingerprintFlagIndex = process.argv.indexOf('--source-fingerprint')
const expectedFingerprint =
  fingerprintFlagIndex >= 0 ? process.argv[fingerprintFlagIndex + 1]?.trim() : null

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function loadLegacyData(client = prisma) {
  const seasons = await client.season.findMany({ where: { year: 2025 } })
  assert(seasons.length === 1, `Expected exactly one 2025 season; found ${seasons.length}`)
  const season = seasons[0]

  const users = await client.user.findMany({
    where: { drafts: { some: { seasonId: season.id } } },
    include: {
      drafts: {
        where: { seasonId: season.id },
        include: { team: true },
        orderBy: { round: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })
  assert(users.length > 0, 'No users exist')

  const teams = await client.team.findMany({ orderBy: [{ league: 'asc' }, { name: 'asc' }] })
  assert(teams.length > 0, 'No teams exist')

  return { season, users, teams }
}

async function migrate({ season, users, teams }, sourceFingerprint) {
  assert(commissionerEmail, '--commissioner-email is required with --apply')
  assert(backupConfirmed, '--backup-confirmed is required with --apply')
  assert(expectedFingerprint, '--source-fingerprint is required with --apply')
  assert(
    expectedFingerprint === sourceFingerprint,
    'Source fingerprint does not match this preflight. Stop and create a new backup.',
  )
  assert(
    users.some((user) => user.email?.trim().toLowerCase() === commissionerEmail),
    'Commissioner email does not match a 2025 user',
  )

  const standings = rankLegacyStandings(users)

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

    for (const [index, standing] of standings.entries()) {
      const user = standing.user
      await tx.poolMembership.upsert({
        where: { poolId_userId: { poolId: pool.id, userId: user.id } },
        update: {
          status: 'ACTIVE',
          role: user.email?.trim().toLowerCase() === commissionerEmail ? 'COMMISSIONER' : 'MEMBER',
        },
        create: {
          poolId: pool.id,
          userId: user.id,
          status: 'ACTIVE',
          role: user.email?.trim().toLowerCase() === commissionerEmail ? 'COMMISSIONER' : 'MEMBER',
        },
      })

      let participant = await tx.seasonParticipant.findUnique({
        where: { seasonId_userId: { seasonId: season.id, userId: user.id } },
      })
      if (!participant) {
        const seat = await tx.poolSeat.create({
          data: { poolId: pool.id, label: `2025 seat ${index + 1}` },
        })
        participant = await tx.seasonParticipant.create({
          data: {
            seasonId: season.id,
            poolSeatId: seat.id,
            userId: user.id,
            finalRank: index + 1,
            totalWins: standing.totalWins,
            nflWins: standing.nflWins,
            collegeWins: standing.collegeWins,
          },
        })
      } else {
        participant = await tx.seasonParticipant.update({
          where: { id: participant.id },
          data: {
            finalRank: index + 1,
            totalWins: standing.totalWins,
            nflWins: standing.nflWins,
            collegeWins: standing.collegeWins,
          },
        })
      }

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
      include: { rosterSlots: { include: { team: true } } },
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
      { commissionerEmail },
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
  })
}

async function main() {
  const data = await loadLegacyData()
  const report = createPreflightReport(data)
  const sourceFingerprint = report.sourceFingerprint

  console.log(`2025 season: ${report.season.name}`)
  console.log(`Users: ${report.counts.users}`)
  console.log(`Teams: ${report.counts.teams}`)
  console.log(`Roster assignments: ${report.counts.rosterAssignments}`)
  console.log(`Source fingerprint: ${sourceFingerprint}`)

  if (report.warnings.length > 0) {
    console.warn('\nPreflight warnings:')
    for (const warning of report.warnings) console.warn(`- ${warning}`)
  }

  if (!report.passed) {
    console.error('\nPreflight failed:')
    for (const error of report.errors) console.error(`- ${error}`)
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
