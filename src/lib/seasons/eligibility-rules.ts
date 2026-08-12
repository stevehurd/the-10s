import type { TeamSyncData } from '../team-data-types'

export type EligibilityChangeKind = 'UNCHANGED' | 'CHANGED' | 'ADDED'

export interface EligibilitySnapshot {
  nameSnapshot: string
  abbreviationSnapshot: string
  conferenceSnapshot: string | null
  divisionSnapshot: string | null
}

interface ExistingEligibility extends EligibilitySnapshot {
  status: string
  source: string
  reviewReason: string | null
}

export function classifyEligibilityChange(
  previous: EligibilitySnapshot | null,
  current: TeamSyncData,
): {
  kind: EligibilityChangeKind
  status: 'APPROVED' | 'REVIEW'
  reason: string | null
} {
  if (!previous) {
    return { kind: 'ADDED', status: 'REVIEW', reason: 'New FBS team for this season' }
  }

  const changes: string[] = []
  if (previous.nameSnapshot !== current.name) {
    changes.push(`Name: ${previous.nameSnapshot} → ${current.name}`)
  }
  if (previous.abbreviationSnapshot !== current.abbreviation) {
    changes.push(`Abbreviation: ${previous.abbreviationSnapshot} → ${current.abbreviation}`)
  }
  if (previous.conferenceSnapshot !== current.conference) {
    changes.push(
      `Conference: ${previous.conferenceSnapshot ?? 'None'} → ${current.conference ?? 'None'}`,
    )
  }
  if (previous.divisionSnapshot !== current.division) {
    changes.push(`Division: ${previous.divisionSnapshot ?? 'None'} → ${current.division ?? 'None'}`)
  }

  if (changes.length === 0) {
    return { kind: 'UNCHANGED', status: 'APPROVED', reason: null }
  }
  return { kind: 'CHANGED', status: 'REVIEW', reason: changes.join('; ') }
}

export function resolveCollegeEligibilitySync(input: {
  previous: EligibilitySnapshot | null
  existing: ExistingEligibility | null
  current: TeamSyncData
  auditedCommissionerStatus?: 'APPROVED' | 'INACTIVE' | null
}) {
  const { existing, current } = input
  if (
    existing &&
    ((existing.source === 'COMMISSIONER_OVERRIDE' &&
      (existing.status === 'APPROVED' || existing.status === 'INACTIVE')) ||
      input.auditedCommissionerStatus)
  ) {
    return {
      kind: 'OVERRIDDEN' as const,
      status: input.auditedCommissionerStatus ?? existing.status,
      source: 'COMMISSIONER_OVERRIDE',
      reviewReason: existing.reviewReason,
      nameSnapshot: existing.nameSnapshot,
      abbreviationSnapshot: existing.abbreviationSnapshot,
      conferenceSnapshot: existing.conferenceSnapshot,
      divisionSnapshot: existing.divisionSnapshot,
    }
  }

  const change = classifyEligibilityChange(input.previous, current)
  return {
    kind: change.kind,
    status: change.status,
    source: 'SPORTSDATAIO',
    reviewReason: change.reason,
    nameSnapshot: current.name,
    abbreviationSnapshot: current.abbreviation,
    conferenceSnapshot: current.conference,
    divisionSnapshot: current.division,
  }
}

export function normalizeEligibilityOverride(input: {
  status: unknown
  conference: unknown
  note: unknown
}) {
  if (input.status !== 'APPROVED' && input.status !== 'INACTIVE') {
    throw new Error('Status must be APPROVED or INACTIVE')
  }
  if (typeof input.conference !== 'string') throw new Error('Conference is required')
  const conference = input.conference.trim()
  if (!conference || conference.length > 80) {
    throw new Error('Conference must be between 1 and 80 characters')
  }
  if (typeof input.note !== 'string') throw new Error('Correction reason is required')
  const note = input.note.trim()
  if (note.length < 3 || note.length > 300) {
    throw new Error('Correction reason must be between 3 and 300 characters')
  }
  return { status: input.status, conference, note }
}
