import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const drafts = await prisma.draft.findMany({
      where: {
        userId: params.userId
      },
      include: {
        team: true,
        season: true
      },
      orderBy: {
        round: 'asc'
      }
    })

    return NextResponse.json(drafts)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch user drafts' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const body = await request.json()
    const { teamId, round, seasonId } = body

    if (!teamId || !round || !seasonId) {
      return NextResponse.json(
        { error: 'teamId, round, and seasonId are required' },
        { status: 400 }
      )
    }

    // Check if user already has a pick for this round
    const existingPick = await prisma.draft.findFirst({
      where: {
        userId: params.userId,
        seasonId: seasonId,
        round: round
      }
    })

    if (existingPick) {
      return NextResponse.json(
        { error: `User already has a pick for round ${round}` },
        { status: 400 }
      )
    }

    // Check if team is already picked by this user
    const existingTeamPick = await prisma.draft.findFirst({
      where: {
        userId: params.userId,
        seasonId: seasonId,
        teamId: teamId
      }
    })

    if (existingTeamPick) {
      return NextResponse.json(
        { error: 'User has already picked this team' },
        { status: 400 }
      )
    }

    // Create the draft pick
    const draft = await prisma.draft.create({
      data: {
        userId: params.userId,
        teamId: teamId,
        seasonId: seasonId,
        round: round,
        pickNumber: round // Simple pick number for now
      },
      include: {
        team: true,
        season: true
      }
    })

    return NextResponse.json(draft)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create draft pick' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const draftId = searchParams.get('draftId')

    if (!draftId) {
      return NextResponse.json(
        { error: 'draftId is required' },
        { status: 400 }
      )
    }

    // Verify the draft belongs to this user
    const draft = await prisma.draft.findFirst({
      where: {
        id: draftId,
        userId: params.userId
      }
    })

    if (!draft) {
      return NextResponse.json(
        { error: 'Draft pick not found' },
        { status: 404 }
      )
    }

    await prisma.draft.delete({
      where: {
        id: draftId
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete draft pick' },
      { status: 500 }
    )
  }
}