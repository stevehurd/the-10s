import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import { draftErrorResponse } from '@/lib/draft/http'
import { submitRetentionDecisions } from '@/lib/seasons/setup'

export async function GET(
  _request: Request,
  context: { params: Promise<{ seasonId: string }> },
) {
  try {
    const { seasonId } = await context.params
    const season = await prisma.season.findUnique({ where: { id: seasonId } })
    if (!season?.poolId) return NextResponse.json({ error: 'Season not found' }, { status: 404 })

    const authorization = await authorizeApi('MEMBER', season.poolId)
    if (!authorization.authorized) return authorization.response

    const participants = await prisma.seasonParticipant.findMany({
      where: { seasonId },
      orderBy: { baseDraftOrder: 'asc' },
      include: {
        user: { select: { id: true, name: true } },
        rosterSlots: {
          orderBy: { number: 'asc' },
          include: { team: true, inheritedTeam: true },
        },
      },
    })
    const previousRecords = season.previousSeasonId
      ? await prisma.teamSeasonRecord.findMany({ where: { seasonId: season.previousSeasonId } })
      : []
    const recordByTeam = new Map(previousRecords.map((record) => [record.teamId, record]))

    const viewerParticipant = participants.find(
      (participant) => participant.userId === authorization.appUser.id,
    )

    return NextResponse.json({
      season,
      viewerParticipantId: viewerParticipant?.id ?? null,
      viewerIsCommissioner: authorization.membership.role === 'COMMISSIONER',
      participants: viewerParticipant ? [viewerParticipant].map((participant) => ({
        ...participant,
        rosterSlots: participant.rosterSlots.map((slot) => ({
          ...slot,
          priorRecord: slot.inheritedTeamId
            ? recordByTeam.has(slot.inheritedTeamId)
              ? {
                  wins: recordByTeam.get(slot.inheritedTeamId)!.wins,
                  losses: recordByTeam.get(slot.inheritedTeamId)!.losses,
                  ties: recordByTeam.get(slot.inheritedTeamId)!.ties,
                }
              : null
            : null,
        })),
      })) : [],
    })
  } catch (error) {
    return draftErrorResponse(error)
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ seasonId: string }> },
) {
  try {
    const { seasonId } = await context.params
    const season = await prisma.season.findUnique({ where: { id: seasonId } })
    if (!season?.poolId) return NextResponse.json({ error: 'Season not found' }, { status: 404 })

    const authorization = await authorizeApi('MEMBER', season.poolId)
    if (!authorization.authorized) return authorization.response
    const body = await request.json()
    const ownParticipant = await prisma.seasonParticipant.findUnique({
      where: { seasonId_userId: { seasonId, userId: authorization.appUser.id } },
    })
    const participantId =
      authorization.membership.role === 'COMMISSIONER' && typeof body.participantId === 'string'
        ? body.participantId
        : ownParticipant?.id
    if (!participantId) {
      return NextResponse.json({ error: 'You are not a participant in this season' }, { status: 403 })
    }

    const participant = await submitRetentionDecisions({
      seasonId,
      participantId,
      actorUserId: authorization.appUser.id,
      actorIsCommissioner: authorization.membership.role === 'COMMISSIONER',
    })
    revalidatePath('/')
    revalidatePath('/admin/draft')
    revalidatePath(`/admin/seasons/${seasonId}/setup`)
    revalidatePath(`/seasons/${seasonId}/keepers`)
    return NextResponse.json(participant)
  } catch (error) {
    return draftErrorResponse(error)
  }
}
