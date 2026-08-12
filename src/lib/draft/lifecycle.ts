export type DraftTiming = {
  mode: string
  status: string
  startsAt: Date | string | null
}

export function isOfficialDraftDue(draft: DraftTiming, now = new Date()) {
  return Boolean(
    draft.mode === 'OFFICIAL' &&
    draft.status === 'SCHEDULED' &&
    draft.startsAt &&
    new Date(draft.startsAt).getTime() <= now.getTime(),
  )
}

export function canMemberEnterDraftRoom(draft: DraftTiming, now = new Date()) {
  return draft.mode !== 'OFFICIAL' || draft.status !== 'SCHEDULED' || isOfficialDraftDue(draft, now)
}
