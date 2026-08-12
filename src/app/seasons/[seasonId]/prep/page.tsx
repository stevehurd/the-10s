import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import KeeperStatusCallout from '@/components/keeper-status-callout'
import MemberHeader from '@/components/member-header'
import { getCurrentAppUser } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import {
  getPreparationTeamState,
  type PreparationEligibilityStatus,
} from '@/lib/seasons/preparation'

import PreparationBoard from './preparation-board'

export const dynamic = 'force-dynamic'

export default async function DraftPreparationPage({ params }: { params: Promise<{ seasonId: string }> }) {
  const { seasonId } = await params
  const context = await getCurrentAppUser()
  if (!context) redirect('/login')
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: { pool: { select: { id: true, name: true } } },
  })
  if (!season?.pool) notFound()
  const membership = context.appUser.memberships.find((entry) => entry.poolId === season.pool!.id)
  if (!membership) redirect('/')

  const [eligibility, priorRecords, heldSlots, viewerParticipant] = await Promise.all([
    prisma.seasonTeamEligibility.findMany({
      where: { seasonId },
      include: { team: true },
    }),
    season.previousSeasonId
      ? prisma.teamSeasonRecord.findMany({ where: { seasonId: season.previousSeasonId } })
      : [],
    prisma.rosterSlot.findMany({
      where: {
        seasonId,
        teamId: { not: null },
        retentionChoice: { in: ['KEEP', 'PENDING'] },
      },
      select: {
        teamId: true,
        retentionChoice: true,
        seasonParticipant: { select: { user: { select: { name: true } } } },
      },
    }),
    prisma.seasonParticipant.findUnique({
      where: { seasonId_userId: { seasonId, userId: context.appUser.id } },
      select: { decisionsSubmittedAt: true, decisionsLockedAt: true },
    }),
  ])
  const recordByTeam = new Map(priorRecords.map((record) => [record.teamId, record]))
  const holderByTeam = new Map(
    heldSlots.flatMap((slot) => slot.teamId
      ? [[slot.teamId, {
          name: slot.seasonParticipant.user.name,
          retentionChoice: slot.retentionChoice as 'KEEP' | 'PENDING',
        }] as const]
      : []),
  )
  const teams = eligibility.map((entry) => {
    const { status, team } = entry
    const record = recordByTeam.get(team.id)
    const holder = holderByTeam.get(team.id) ?? null
    const preparationState = getPreparationTeamState(
      status as PreparationEligibilityStatus,
      holder,
    )
    return {
      id: team.id,
      name: entry.nameSnapshot,
      abbreviation: entry.abbreviationSnapshot,
      league: team.league === 'NFL' ? 'NFL' as const : 'COLLEGE' as const,
      conference: entry.conferenceSnapshot,
      division: entry.divisionSnapshot,
      logoUrl: team.logoUrl,
      wins: record?.wins ?? 0,
      losses: record?.losses ?? 0,
      ties: record?.ties ?? 0,
      eligibilityStatus: status as PreparationEligibilityStatus,
      ...preparationState,
    }
  })

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <MemberHeader
        active="preparation"
        commissioner={membership.role === 'COMMISSIONER'}
        seasonId={season.id}
        userName={context.appUser.name}
      />
      <main className="px-4 py-6 sm:py-8">
        <div className="mx-auto max-w-7xl">
          <Link className="text-sm font-semibold text-blue-300 hover:text-blue-200" href={`/?season=${season.id}`}>← Preseason hub</Link>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-orange-300">{season.pool.name} · {season.name}</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Draft preparation</h1>
          <p className="mt-2 max-w-3xl text-slate-400">Compare the approved team pool using last season&apos;s record. Keeper decisions update availability automatically.</p>
          {viewerParticipant ? (
            <div className="mt-6">
              <KeeperStatusCallout
                locked={Boolean(viewerParticipant.decisionsLockedAt)}
                seasonId={season.id}
                submitted={Boolean(viewerParticipant.decisionsSubmittedAt)}
              />
            </div>
          ) : null}
          <PreparationBoard seasonId={season.id} teams={teams} />
        </div>
      </main>
    </div>
  )
}
