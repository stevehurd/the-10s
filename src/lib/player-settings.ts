import { prisma } from '@/lib/db'
import { validatePlayerProfile } from '@/lib/player-settings-rules'

export async function getLatestPoolSeat(userId: string, poolId: string) {
  return prisma.seasonParticipant.findFirst({
    where: { userId, season: { poolId } },
    orderBy: [{ season: { year: 'desc' } }, { createdAt: 'desc' }],
    select: {
      poolSeatId: true,
      poolSeat: { select: { label: true } },
      season: { select: { year: true } },
    },
  })
}

export async function updatePlayerProfile(input: {
  actorUserId: string
  poolId: string
  name: string
  rosterNickname?: string | null
}) {
  const values = validatePlayerProfile(input)
  const membership = await prisma.poolMembership.findUnique({
    where: { poolId_userId: { poolId: input.poolId, userId: input.actorUserId } },
    select: { id: true, status: true },
  })
  if (!membership || membership.status !== 'ACTIVE') throw new Error('Active pool membership not found')

  const participant = await getLatestPoolSeat(input.actorUserId, input.poolId)
  if (!participant && values.rosterNickname) {
    throw new Error('A roster nickname can be added after you have a roster in this pool')
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: input.actorUserId },
      data: { name: values.name },
      select: { id: true, name: true },
    })
    if (participant) {
      await tx.poolSeat.update({
        where: { id: participant.poolSeatId },
        data: { label: values.rosterNickname },
      })
    }
    await tx.auditEvent.create({
      data: {
        poolId: input.poolId,
        actorUserId: input.actorUserId,
        action: 'PLAYER_PROFILE_UPDATED',
        entityType: 'User',
        entityId: input.actorUserId,
        data: { rosterNicknameSet: Boolean(values.rosterNickname) },
      },
    })
    return { ...user, rosterNickname: values.rosterNickname }
  })
}
