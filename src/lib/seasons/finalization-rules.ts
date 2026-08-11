import { compareStandings } from '../standings-ranking.ts'

type FinalizationParticipant = {
  id: string
  user: { name: string }
  rosterSlots: Array<{
    number: number
    teamId: string | null
    team: { league: string } | null
  }>
}

type FinalizationRecord = {
  teamId: string
  wins: number
}

export type FinalStanding = {
  participantId: string
  name: string
  rank: number
  totalWins: number
  nflWins: number
  collegeWins: number
  bestNflTeamWins: number
  bestCollegeTeamWins: number
}

export function buildFinalizationReview(input: {
  seasonStatus: string
  participants: FinalizationParticipant[]
  records: FinalizationRecord[]
  officialDraftStatus?: string | null
}) {
  const issues: string[] = []
  const recordByTeam = new Map(input.records.map((record) => [record.teamId, record]))

  if (input.seasonStatus !== 'ACTIVE' && input.seasonStatus !== 'FINALIZED') {
    issues.push('Only an active season can be finalized')
  }
  if (input.participants.length === 0) issues.push('The season has no participants')
  if (input.officialDraftStatus && input.officialDraftStatus !== 'COMPLETED') {
    issues.push('The official draft is not complete')
  }

  const ranked = input.participants.map((participant) => {
    const assignedSlots = participant.rosterSlots.filter((slot) => slot.teamId && slot.team)
    const nflSlots = assignedSlots.filter((slot) => slot.team?.league === 'NFL')
    const collegeSlots = assignedSlots.filter((slot) => slot.team?.league === 'COLLEGE')

    if (participant.rosterSlots.length !== 10 || assignedSlots.length !== 10) {
      issues.push(`${participant.user.name} does not have 10 assigned roster slots`)
    }
    if (nflSlots.length !== 2 || collegeSlots.length !== 8) {
      issues.push(`${participant.user.name} must have exactly 2 NFL and 8 college teams`)
    }

    let totalWins = 0
    let nflWins = 0
    let collegeWins = 0
    let bestNflTeamWins = 0
    let bestCollegeTeamWins = 0
    for (const slot of assignedSlots) {
      const record = recordByTeam.get(slot.teamId!)
      if (!record) {
        issues.push(`${participant.user.name} has a roster team without a season record`)
        continue
      }
      totalWins += record.wins
      if (slot.team?.league === 'NFL') {
        nflWins += record.wins
        bestNflTeamWins = Math.max(bestNflTeamWins, record.wins)
      } else if (slot.team?.league === 'COLLEGE') {
        collegeWins += record.wins
        bestCollegeTeamWins = Math.max(bestCollegeTeamWins, record.wins)
      }
    }

    return {
      participantId: participant.id,
      name: participant.user.name,
      totalWins,
      nflWins,
      collegeWins,
      bestNflTeamWins,
      bestCollegeTeamWins,
      rankingName: participant.user.name,
    }
  }).sort(compareStandings)

  return {
    issues: [...new Set(issues)],
    standings: ranked.map((standing, index): FinalStanding => ({
      participantId: standing.participantId,
      name: standing.name,
      rank: index + 1,
      totalWins: standing.totalWins,
      nflWins: standing.nflWins,
      collegeWins: standing.collegeWins,
      bestNflTeamWins: standing.bestNflTeamWins,
      bestCollegeTeamWins: standing.bestCollegeTeamWins,
    })),
  }
}
