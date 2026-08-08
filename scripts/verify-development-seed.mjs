#!/usr/bin/env node

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const developmentPoolSlug = 'the-10s-development'

function assertCount(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, found ${actual}`)
  }
  console.log(`✓ ${label}: ${actual}`)
}

function assertRange(label, actual, minimum, maximum) {
  if (actual < minimum || actual > maximum) {
    throw new Error(`${label}: expected ${minimum}-${maximum}, found ${actual}`)
  }
  console.log(`✓ ${label}: ${actual}`)
}

try {
  const pool = await prisma.pool.findUnique({
    where: { slug: developmentPoolSlug },
    select: { id: true },
  })
  if (!pool) throw new Error('Synthetic development pool was not found')

  const currentSeason = await prisma.season.findFirst({
    where: { poolId: pool.id, year: 2026 },
    select: { id: true },
  })
  if (!currentSeason) throw new Error('2026 development season was not found')

  const [seasons, memberships, commissioners, participants, rosterSlots, eligibility, demoRosterSlots] =
    await Promise.all([
      prisma.season.count({ where: { poolId: pool.id } }),
      prisma.poolMembership.count({ where: { poolId: pool.id, status: 'ACTIVE' } }),
      prisma.poolMembership.count({
        where: { poolId: pool.id, status: 'ACTIVE', role: 'COMMISSIONER' },
      }),
      prisma.seasonParticipant.count({ where: { season: { poolId: pool.id } } }),
      prisma.rosterSlot.count({ where: { season: { poolId: pool.id } } }),
      prisma.seasonTeamEligibility.findMany({
        where: { seasonId: currentSeason.id },
        select: { source: true, leagueSnapshot: true },
      }),
      prisma.rosterSlot.count({
        where: { season: { poolId: pool.id }, team: { name: { startsWith: 'Demo ' } } },
      }),
    ])

  assertCount('seasons', seasons, 2)
  assertCount('active memberships', memberships, 15)
  assertCount('commissioners', commissioners, 1)
  assertCount('season participants', participants, 30)
  assertCount('roster slots', rosterSlots, 300)
  const sportsDataMode = eligibility.some((entry) => entry.source === 'SPORTSDATAIO')
  if (sportsDataMode) {
    assertCount('SportsDataIO NFL teams', eligibility.filter((entry) => entry.leagueSnapshot === 'NFL').length, 32)
    assertRange('SportsDataIO FBS teams', eligibility.filter((entry) => entry.leagueSnapshot === 'COLLEGE').length, 120, 160)
    assertCount('placeholder roster slots', demoRosterSlots, 0)
    console.log('Real-team development seed is internally consistent.')
  } else {
    assertCount('fixture teams', eligibility.length, 162)
    console.log('Synthetic development seed is internally consistent.')
  }
} finally {
  await prisma.$disconnect()
}
