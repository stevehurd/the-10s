export function serverDraftDeadline(pickSeconds: number, nowMs = Date.now()) {
  return new Date(nowMs + pickSeconds * 1_000)
}

export function localDraftDeadline(pickSeconds: number, nowMs = Date.now()) {
  return new Date(nowMs + pickSeconds * 1_000)
}

export function displayedDraftSeconds(
  deadlineAt: string | Date | null,
  pickSeconds: number,
  nowMs = Date.now(),
) {
  if (!deadlineAt) return null
  const deadlineMs = deadlineAt instanceof Date ? deadlineAt.getTime() : new Date(deadlineAt).getTime()
  return Math.min(pickSeconds, Math.max(0, Math.ceil((deadlineMs - nowMs) / 1_000)))
}
