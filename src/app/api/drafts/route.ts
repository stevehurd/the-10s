import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, teamId, round, seasonId } = body

    if (!userId || !teamId || !round || !seasonId) {
      return NextResponse.json(
        { error: 'UserId, teamId, round, and seasonId are required' },
        { status: 400 }
      )
    }

    // Check if this round is already taken for this user in this season
    const existingDraft = await prisma.draft.findFirst({
      where: {
        userId,
        round,
        seasonId
      }
    })

    if (existingDraft) {
      return NextResponse.json(
        { error: 'This round is already filled for this user' },
        { status: 400 }
      )
    }

    // Check if this team is already drafted in this season
    const teamAlreadyDrafted = await prisma.draft.findFirst({
      where: {
        teamId,
        seasonId
      }
    })

    if (teamAlreadyDrafted) {
      return NextResponse.json(
        { error: 'This team has already been drafted' },
        { status: 400 }
      )
    }

    const draft = await prisma.draft.create({
      data: {
        userId,
        teamId,
        round: parseInt(round),
        pickNumber: parseInt(round), // Using round number as pick number for simplicity
        seasonId
      },
      include: {
        team: true,
        user: true,
        season: true
      }
    })

    return NextResponse.json(draft)
  } catch (error) {
    console.error('Draft creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create draft pick' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const drafts = await prisma.draft.findMany({
      include: {
        team: true,
        user: true,
        season: true
      },
      orderBy: [
        { user: { name: 'asc' } },
        { round: 'asc' }
      ]
    })

    return NextResponse.json(drafts)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch drafts' },
      { status: 500 }
    )
  }
}