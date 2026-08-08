#!/usr/bin/env node

import { PrismaClient } from '@prisma/client'
import { createHash } from 'node:crypto'

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

function legacyFingerprint({ season, users, teams }) {
  const snapshot = {
    season: { id: season.id, year: season.year },
    users: users
      .map((user) => ({ id: user.id, name: user.name, email: user.email }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    drafts: users
      .flatMap((user) =>
        user.drafts.map((draft) => ({
          id: draft.id,
          userId: draft.userId,
          teamId: draft.teamId,
          round: draft.round,
          pickNumber: draft.pickNumber,
          isKeeper: draft.isKeeper,
        })),
      )
      .sort((left, right) => left.id.localeCompare(right.id)),
    teams: teams
      .map((team) => ({
        id: team.id,
        name: team.name,
        league: team.league,
        wins: team.wins,
        losses: team.losses,
        ties: team.ties,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  }
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
}

function validateLegacyData({ users }) {
  const errors = []

  for (const user of users) {
    const rounds = new Set(user.drafts.map((draft) => draft.round))
    if (rounds.size !== user.drafts.length) errors.push(`${user.name} has duplicate round assignments`)
    if (user.drafts.length !== 10) errors.push(`${user.name} has ${user.drafts.length} teams instead of 10`)

    const nfl = user.drafts.filter((draft) => draft.team.league === 'NFL').length
    const college = user.drafts.filter((draft) => draft.team.league === 'COLLEGE').length
    if (nfl !== 2 || college !== 8) {
      errors.push(`${user.name} has ${nfl} NFL and ${college} college teams instead of 2 and 8`)
    }

    for (const draft of user.drafts) {
      if (draft.round < 1 || draft.round > 10) {
        errors.push(`${user.name} has an invalid round ${draft.round}`)
      }
    }
  }

  const assignments = users.flatMap((user) =>
    user.drafts.map((draft) => ({ teamId: draft.teamId, owner: user.name })),
  )
  const ownerByTeam = new Map()
  for (const assignment of assignments) {
    const existingOwner = ownerByTeam.get(assignment.teamId)
    if (existingOwner) {
      errors.push(`A team is assigned to both ${existingOwner} and ${assignment.owner}`)
    }
    ownerByTeam.set(assignment.teamId, assignment.owner)
  }

  return errors
}

function calculateStanding(user) {
  let totalWins = 0
  let nflWins = 0
  let collegeWins = 0

  for (const draft of user.drafts) {
    totalWins += draft.team.wins
    if (draft.team.league === 'NFL') nflWins += draft.team.wins
    if (draft.team.league === 'COLLEGE') collegeWins += draft.team.wins
  }

  return { user, totalWins, nflWins, collegeWins }
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

  const standings = users.map(calculateStanding).sort((left, right) => {
    return (
      right.totalWins - left.totalWins ||
      right.nflWins - left.nflWins ||
      right.collegeWins - left.collegeWins ||
      left.user.name.localeCompare(right.user.name)
    )
  })

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
    assert(
      migratedParticipants.length === users.length,
      `Reconciliation failed: expected ${users.length} participants, found ${migratedParticipants.length}`,
    )
    const participantByUserId = new Map(
      migratedParticipants.map((participant) => [participant.userId, participant]),
    )
    for (const user of users) {
      const participant = participantByUserId.get(user.id)
      assert(participant, `Reconciliation failed: ${user.name} has no season participant`)
      assert(
        participant.rosterSlots.length === user.drafts.length,
        `Reconciliation failed: ${user.name} roster slot count differs from legacy drafts`,
      )
      const legacyTeamByRound = new Map(user.drafts.map((draft) => [draft.round, draft.teamId]))
      for (const slot of participant.rosterSlots) {
        assert(
          slot.teamId === legacyTeamByRound.get(slot.number),
          `Reconciliation failed: ${user.name} slot ${slot.number} team differs`,
        )
      }
      const standing = calculateStanding(user)
      assert(participant.totalWins === standing.totalWins, `Reconciliation failed: ${user.name} total wins differ`)
      assert(participant.nflWins === standing.nflWins, `Reconciliation failed: ${user.name} NFL wins differ`)
      assert(participant.collegeWins === standing.collegeWins, `Reconciliation failed: ${user.name} college wins differ`)
    }
    const migratedRecords = await tx.teamSeasonRecord.findMany({ where: { seasonId: season.id } })
    const recordCount = migratedRecords.length
    assert(
      recordCount === teams.length,
      `Reconciliation failed: expected ${teams.length} team records, found ${recordCount}`,
    )
    const recordByTeamId = new Map(migratedRecords.map((record) => [record.teamId, record]))
    for (const team of teams) {
      const record = recordByTeamId.get(team.id)
      assert(record, `Reconciliation failed: ${team.name} has no 2025 team record`)
      assert(
        record.wins === team.wins && record.losses === team.losses && record.ties === team.ties,
        `Reconciliation failed: ${team.name} W-L-T differs from the legacy source`,
      )
      assert(record.finalizedAt, `Reconciliation failed: ${team.name} record is not finalized`)
    }
    const migratedSeason = await tx.season.findUnique({ where: { id: season.id } })
    assert(
      migratedSeason?.status === 'FINALIZED' && migratedSeason.finalizedAt,
      'Reconciliation failed: the 2025 season is not finalized',
    )
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
  const errors = validateLegacyData(data)
  const sourceFingerprint = legacyFingerprint(data)

  console.log(`2025 season: ${data.season.name}`)
  console.log(`Users: ${data.users.length}`)
  console.log(`Teams: ${data.teams.length}`)
  console.log(`Roster assignments: ${data.users.reduce((total, user) => total + user.drafts.length, 0)}`)
  console.log(`Source fingerprint: ${sourceFingerprint}`)

  if (errors.length > 0) {
    console.error('\nPreflight failed:')
    for (const error of errors) console.error(`- ${error}`)
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
