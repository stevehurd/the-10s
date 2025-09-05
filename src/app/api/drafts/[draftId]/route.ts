import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(
  request: Request,
  context: { params: Promise<{ draftId: string }> }
) {
  const params = await context.params
  try {
    const body = await request.json()
    const { teamId } = body

    if (!teamId) {
      return NextResponse.json(
        { error: 'TeamId is required' },
        { status: 400 }
      )
    }

    // Get the existing draft to check the season
    const existingDraft = await prisma.draft.findUnique({
      where: {
        id: params.draftId
      }
    })

    if (!existingDraft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      )
    }

    // Check if this team is already drafted in this season (by someone else)
    const teamAlreadyDrafted = await prisma.draft.findFirst({
      where: {
        teamId,
        seasonId: existingDraft.seasonId,
        id: { not: params.draftId } // Exclude the current draft
      }
    })

    if (teamAlreadyDrafted) {
      return NextResponse.json(
        { error: 'This team has already been drafted by someone else' },
        { status: 400 }
      )
    }

    const updatedDraft = await prisma.draft.update({
      where: {
        id: params.draftId
      },
      data: {
        teamId
      },
      include: {
        team: true,
        user: true,
        season: true
      }
    })

    return NextResponse.json(updatedDraft)
  } catch (error) {
    console.error('Draft update error:', error)
    return NextResponse.json(
      { error: 'Failed to update draft pick' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ draftId: string }> }
) {
  const params = await context.params
  try {
    await prisma.draft.delete({
      where: {
        id: params.draftId
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