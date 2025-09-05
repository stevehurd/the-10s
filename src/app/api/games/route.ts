import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const seasonId = searchParams.get('seasonId')

    const where = seasonId ? { seasonId } : {}

    const games = await prisma.game.findMany({
      where,
      include: {
        homeTeam: true,
        awayTeam: true,
        winner: true,
        season: true
      },
      orderBy: [
        { week: 'asc' },
        { gameDate: 'asc' }
      ]
    })

    return NextResponse.json(games)
  } catch (error) {
    console.error('Failed to fetch games:', error)
    return NextResponse.json(
      { error: 'Failed to fetch games' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      seasonId,
      homeTeamId,
      awayTeamId,
      gameDate,
      week,
      gameType = 'REGULAR',
      homeScore,
      awayScore,
      winnerId,
      status = 'SCHEDULED',
      externalId
    } = body

    if (!seasonId || !homeTeamId || !awayTeamId || !gameDate || !week) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const game = await prisma.game.create({
      data: {
        seasonId,
        homeTeamId,
        awayTeamId,
        gameDate: new Date(gameDate),
        week: parseInt(week),
        gameType,
        homeScore: homeScore ? parseInt(homeScore) : null,
        awayScore: awayScore ? parseInt(awayScore) : null,
        winnerId: winnerId || null,
        status,
        externalId
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        winner: true,
        season: true
      }
    })

    return NextResponse.json(game)
  } catch (error) {
    console.error('Failed to create game:', error)
    return NextResponse.json(
      { error: 'Failed to create game' },
      { status: 500 }
    )
  }
}