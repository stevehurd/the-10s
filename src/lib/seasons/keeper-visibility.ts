export type KeeperVisibilityParticipant = {
  decisionsLockedAt: Date | string | null
}

export function areKeeperSelectionsRevealed(
  participants: readonly KeeperVisibilityParticipant[],
) {
  return participants.length > 0 && participants.every((participant) => participant.decisionsLockedAt)
}

export function canSeeParticipantKeeperSelections(input: {
  allSelectionsRevealed: boolean
  participantUserId: string
  viewerUserId: string
}) {
  return input.allSelectionsRevealed || input.participantUserId === input.viewerUserId
}
