import { notFound } from 'next/navigation'

import DraftRoom, {
  type DraftState,
  type Participant,
  type RosterSlot,
  type Team,
  type Turn,
} from '@/app/draft/[sessionId]/draft-room'

export const dynamic = 'force-dynamic'

const availableTeams: Team[] = [
  team('phi', 'Philadelphia Eagles', 'PHI', 'NFL', null, 'NFC East', 14, 3),
  team('buf', 'Buffalo Bills', 'BUF', 'NFL', null, 'AFC East', 13, 4),
  team('det', 'Detroit Lions', 'DET', 'NFL', null, 'NFC North', 12, 5),
  team('kc', 'Kansas City Chiefs', 'KC', 'NFL', null, 'AFC West', 11, 6),
  team('osu', 'Ohio State', 'OSU', 'COLLEGE', 'Big Ten', null, 14, 2),
  team('uga', 'Georgia', 'UGA', 'COLLEGE', 'SEC', null, 13, 2),
  team('ore', 'Oregon', 'ORE', 'COLLEGE', 'Big Ten', null, 13, 1),
  team('tex', 'Texas', 'TEX', 'COLLEGE', 'SEC', null, 13, 3),
  team('psu', 'Penn State', 'PSU', 'COLLEGE', 'Big Ten', null, 13, 3),
  team('nd', 'Notre Dame', 'ND', 'COLLEGE', 'Independent', null, 14, 2),
  team('clem', 'Clemson', 'CLEM', 'COLLEGE', 'ACC', null, 10, 4),
  team('asu', 'Arizona State', 'ASU', 'COLLEGE', 'Big 12', null, 11, 3),
]

const keeperTeams = [
  team('bal', 'Baltimore Ravens', 'BAL', 'NFL', null, 'AFC North', 12, 5),
  team('gb', 'Green Bay Packers', 'GB', 'NFL', null, 'NFC North', 11, 6),
  team('bama', 'Alabama', 'ALA', 'COLLEGE', 'SEC', null, 9, 4),
  team('miami', 'Miami', 'MIA', 'COLLEGE', 'ACC', null, 10, 3),
]

const names = ['Alex Morgan', 'Jordan Lee', 'Sam Rivera', 'Taylor Brooks']

function team(
  id: string,
  name: string,
  abbreviation: string,
  league: string,
  conference: string | null,
  division: string | null,
  wins: number,
  losses: number,
): Team {
  return { id, name, abbreviation, league, conference, division, logoUrl: null, priorRecord: { wins, losses, ties: 0 } }
}

function slot(participantId: string, number: number, keeper: Team | null): RosterSlot {
  return {
    id: `${participantId}-slot-${number}`,
    number,
    retentionChoice: keeper ? 'KEEP' : 'RELEASE',
    source: keeper ? 'KEEPER' : 'DRAFT',
    team: keeper,
    inheritedTeam: keeper,
  }
}

function createDemoState(): DraftState {
  const participants: Participant[] = names.map((name, index) => {
    const id = `participant-${index + 1}`
    return {
      id,
      baseDraftOrder: index + 1,
      user: { id: `user-${index + 1}`, name },
      rosterSlots: Array.from({ length: 10 }, (_, slotIndex) => {
        const number = slotIndex + 1
        const keeper = number === index + 1 ? keeperTeams[index] : null
        return slot(id, number, keeper)
      }),
    }
  })

  const turns: Turn[] = []
  for (let round = 1; round <= 10; round += 1) {
    const ordered = round % 2 === 1 ? participants : [...participants].reverse()
    for (const participant of ordered) {
      const rosterSlot = participant.rosterSlots[round - 1]
      if (rosterSlot.team) continue
      turns.push({
        id: `turn-${turns.length}`,
        round,
        overallIndex: turns.length,
        status: 'PENDING',
        deadlineAt: null,
        seasonParticipantId: participant.id,
        seasonParticipant: { user: participant.user },
        rosterSlot,
        selection: null,
      })
    }
  }

  const alreadyPicked = [
    team('min', 'Minnesota Vikings', 'MIN', 'NFL', null, 'NFC North', 14, 3),
    team('bsu', 'Boise State', 'BSU', 'COLLEGE', 'Mountain West', null, 12, 2),
  ]
  for (let index = 0; index < alreadyPicked.length; index += 1) {
    turns[index] = {
      ...turns[index],
      status: 'COMPLETED',
      selection: { selectionType: 'MANUAL', team: alreadyPicked[index] },
    }
  }
  const current = turns[2]
  turns[2] = {
    ...current,
    status: 'ACTIVE',
    deadlineAt: new Date(Date.now() + 90_000).toISOString(),
  }

  return {
    session: {
      id: 'local-demo',
      name: '2026 Draft Rehearsal',
      mode: 'REHEARSAL',
      orderType: 'SNAKE',
      status: 'LIVE',
      pickSeconds: 90,
      startsAt: null,
      meetingUrl: null,
      currentTurnIndex: current.overallIndex,
      revision: 3,
      season: { id: 'demo-season', year: 2026, name: '2026 Season' },
    },
    viewerParticipantId: participants[0].id,
    viewerIsCommissioner: true,
    currentTurnId: current.id,
    participants,
    turns,
    availableTeams,
    unavailableTeams: alreadyPicked.map((pickedTeam, index) => ({
      ...pickedTeam,
      unavailableReason: `Selected by ${turns[index].seasonParticipant.user.name}`,
    })),
  }
}

export default function DemoPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <DraftRoom demo initialState={createDemoState()} sessionId="local-demo" />
}
