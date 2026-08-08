export function validateCompleteDraftOrder(
  currentParticipantIds: string[],
  orderedParticipantIds: string[],
): string | null {
  if (currentParticipantIds.length !== orderedParticipantIds.length) {
    return 'Draft order must contain every participant exactly once'
  }
  const current = new Set(currentParticipantIds)
  const submitted = new Set(orderedParticipantIds)
  if (submitted.size !== orderedParticipantIds.length) {
    return 'Draft order contains a duplicate participant'
  }
  if (submitted.size !== current.size || orderedParticipantIds.some((id) => !current.has(id))) {
    return 'Draft order contains an unknown participant'
  }
  return null
}
