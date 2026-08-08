import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import KeeperStatusCallout from '@/components/keeper-status-callout'
import { getCurrentAppUser } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'

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
      where: { seasonId, status: 'APPROVED' },
      include: { team: true },
    }),
    season.previousSeasonId
      ? prisma.teamSeasonRecord.findMany({ where: { seasonId: season.previousSeasonId } })
      : [],
    prisma.rosterSlot.findMany({
      where: { seasonId, teamId: { not: null } },
      select: {
        teamId: true,
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
      ? [[slot.teamId, slot.seasonParticipant.user.name] as const]
      : []),
  )
  const teams = eligibility.map(({ team }) => {
    const record = recordByTeam.get(team.id)
    const holder = holderByTeam.get(team.id)
    return {
      id: team.id,
      name: team.name,
      abbreviation: team.abbreviation,
      league: team.league === 'NFL' ? 'NFL' as const : 'COLLEGE' as const,
      conference: team.conference,
      division: team.division,
      logoUrl: team.logoUrl,
      wins: record?.wins ?? 0,
      losses: record?.losses ?? 0,
      ties: record?.ties ?? 0,
      available: !holder,
      unavailableReason: holder ? `Kept by ${holder}` : null,
    }
  })

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <Link className="text-sm font-semibold text-emerald-300 hover:text-emerald-200" href={`/?season=${season.id}`}>← Preseason hub</Link>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">{season.pool.name} · {season.name}</p>
        <h1 className="mt-2 text-3xl font-black">Draft preparation</h1>
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
  )
}
