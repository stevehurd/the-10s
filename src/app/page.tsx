import Link from 'next/link'

import DraftCountdown from '@/components/draft-countdown'
import KeeperStatusCallout from '@/components/keeper-status-callout'
import MemberHeader from '@/components/member-header'
import SeasonSelector from '@/components/season-selector'
import TeamMark from '@/components/team-mark'
import { getCurrentAppUser } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import { editableRosterNickname, playerDisplayName } from '@/lib/player-settings-rules'
import { compareStandings } from '@/lib/standings-ranking'

export const dynamic = 'force-dynamic'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; preview?: string; seeded?: string }>
}) {
  const context = await getCurrentAppUser()
  if (!context) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <div className="mx-auto max-w-xl rounded-2xl border border-amber-300/30 bg-amber-300/10 p-6">
          Your sign-in is valid, but it has not been linked to a pool profile yet. Ask a commissioner to finish your invitation.
        </div>
      </main>
    )
  }

  const membership = context.appUser.memberships[0]
  if (!membership) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <MemberHeader active="dashboard" commissioner={false} userName={context.appUser.name} />
        <main className="p-6">
          <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/5 p-6">
            Your account does not have an active pool membership.
          </div>
        </main>
      </div>
    )
  }

  const query = await searchParams
  const seasons = await prisma.season.findMany({
    where: { poolId: membership.poolId },
    orderBy: { year: 'desc' },
  })
  const selectedSeason =
    seasons.find((season) => season.id === query.season) ?? seasons[0] ?? null

  if (!selectedSeason) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <MemberHeader
          active="dashboard"
          commissioner={membership.role === 'COMMISSIONER'}
          userName={context.appUser.name}
        />
        <main className="p-6">
          <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/5 p-6">
            <h1 className="text-2xl font-semibold">{membership.pool.name}</h1>
            <p className="mt-2 text-slate-400">A commissioner has not created a season yet.</p>
          </div>
        </main>
      </div>
    )
  }

  const [participants, records, officialDraft, priorRecords] = await Promise.all([
    prisma.seasonParticipant.findMany({
      where: { seasonId: selectedSeason.id },
      include: {
        user: { select: { id: true, name: true } },
        poolSeat: { select: { label: true } },
        rosterSlots: { include: { team: true }, orderBy: { number: 'asc' } },
      },
    }),
    prisma.teamSeasonRecord.findMany({ where: { seasonId: selectedSeason.id } }),
    prisma.draftSession.findFirst({
      where: {
        seasonId: selectedSeason.id,
        mode: 'OFFICIAL',
        status: { not: 'CANCELED' },
      },
      orderBy: { createdAt: 'desc' },
    }),
    selectedSeason.previousSeasonId
      ? prisma.teamSeasonRecord.findMany({ where: { seasonId: selectedSeason.previousSeasonId } })
      : [],
  ])
  const recordByTeam = new Map(records.map((record) => [record.teamId, record]))
  const priorRecordByTeam = new Map(priorRecords.map((record) => [record.teamId, record]))
  const standings = participants
    .map((participant) => {
      let totalWins = 0
      let nflWins = 0
      let collegeWins = 0
      let bestNflTeamWins = 0
      let bestCollegeTeamWins = 0
      for (const slot of participant.rosterSlots) {
        if (!slot.teamId || !slot.team) continue
        const wins = recordByTeam.get(slot.teamId)?.wins ?? 0
        totalWins += wins
        if (slot.team.league === 'NFL') {
          nflWins += wins
          bestNflTeamWins = Math.max(bestNflTeamWins, wins)
        }
        if (slot.team.league === 'COLLEGE') {
          collegeWins += wins
          bestCollegeTeamWins = Math.max(bestCollegeTeamWins, wins)
        }
      }
      return {
        ...participant,
        totalWins,
        nflWins,
        collegeWins,
        bestNflTeamWins,
        bestCollegeTeamWins,
        rankingName: participant.user.name,
      }
    })
    .sort(compareStandings)
  const viewerParticipant = standings.find(
    (participant) => participant.userId === context.appUser.id,
  )
  const previewAllowed =
    membership.role === 'COMMISSIONER' && membership.pool.slug === 'the-10s-development'
  const previewPhase = previewAllowed && ['preseason', 'active', 'complete'].includes(query.preview ?? '')
    ? query.preview
    : null
  const displayedSeasonStatus = previewPhase === 'preseason'
    ? 'SETUP'
    : previewPhase === 'active'
      ? 'ACTIVE'
      : previewPhase === 'complete'
        ? 'FINALIZED'
        : selectedSeason.status
  const isPreseason = displayedSeasonStatus === 'SETUP' || displayedSeasonStatus === 'DRAFT'
  const isComplete = displayedSeasonStatus === 'FINALIZED'
  const isInSeason = displayedSeasonStatus === 'ACTIVE'
  const showKeeperTracker = isPreseason
  const keeperTracker = [...participants]
    .sort(
      (left, right) =>
        (left.baseDraftOrder ?? Number.MAX_SAFE_INTEGER) -
          (right.baseDraftOrder ?? Number.MAX_SAFE_INTEGER) ||
        left.user.name.localeCompare(right.user.name),
    )
    .map((participant) => ({
      id: participant.id,
      name: playerDisplayName(participant.user.name, participant.poolSeat.label),
      playerName: participant.user.name,
      hasNickname: Boolean(editableRosterNickname(participant.poolSeat.label)),
      isViewer: participant.userId === context.appUser.id,
      submitted: Boolean(participant.decisionsSubmittedAt),
      keptTeams: participant.rosterSlots
        .filter((slot) => slot.retentionChoice === 'KEEP' && slot.team)
        .map((slot) => ({
          id: slot.team!.id,
          name: slot.team!.name,
          abbreviation: slot.team!.abbreviation,
          logoUrl: slot.team!.logoUrl,
          league: slot.team!.league,
          slot: slot.number,
        })),
    }))
  const submittedKeeperCount = keeperTracker.filter((participant) => participant.submitted).length
  const rosterRecordByTeam = isPreseason ? priorRecordByTeam : recordByTeam
  const champion = isComplete ? standings[0] ?? null : null
  const championNickname = champion ? editableRosterNickname(champion.poolSeat.label) : null

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <MemberHeader
        active="dashboard"
        commissioner={membership.role === 'COMMISSIONER'}
        seasonId={selectedSeason.id}
        userName={context.appUser.name}
      />

      <div className="mx-auto max-w-7xl px-4 py-5 sm:py-7">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-300">{membership.pool.name}</p>
            <h2 className="mt-1 text-2xl font-semibold sm:text-3xl">{selectedSeason.name}</h2>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-300">
              {isPreseason ? 'Preseason' : isComplete ? 'Season complete' : 'In season'}
            </p>
          </div>
          <SeasonSelector seasons={seasons} selectedSeasonId={selectedSeason.id} />
        </div>

        {previewAllowed ? (
          <section className="mb-6 rounded-2xl border border-dashed border-white/15 bg-white/5 p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">Development preview</p>
                <p className="mt-1 text-sm text-slate-400">Preview dashboard phases without changing any season data.</p>
                {query.seeded === 'dashboard-states' ? <p className="mt-2 text-sm font-bold text-emerald-300">Stress-test seasons are ready in the season selector.</p> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
              <nav aria-label="Preview dashboard phase" className="flex flex-wrap gap-2">
                {[
                  { label: 'Actual', value: null },
                  { label: 'Preseason', value: 'preseason' },
                  { label: 'In Season', value: 'active' },
                  { label: 'Complete', value: 'complete' },
                ].map((option) => {
                  const selected = previewPhase === option.value
                  const href = option.value
                    ? `/?season=${selectedSeason.id}&preview=${option.value}`
                    : `/?season=${selectedSeason.id}`
                  return (
                    <Link
                      aria-current={selected ? 'page' : undefined}
                      className={`rounded-lg px-3 py-2 text-sm font-bold transition ${selected ? 'bg-blue-600' : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}
                      href={href}
                      key={option.label}
                    >
                      {option.label}
                    </Link>
                  )
                })}
              </nav>
              <form action="/api/admin/seed-dashboard-states" method="post">
                <button className="rounded-lg border border-blue-500/30 px-3 py-2 text-sm font-bold text-blue-300 transition hover:bg-blue-500/10" type="submit">Seed stress-test seasons</button>
              </form>
              </div>
            </div>
          </section>
        ) : null}

        {isPreseason ? (
          <section className="mb-6 overflow-hidden rounded-3xl border border-blue-500/30 bg-blue-500/10 p-5 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-300">Draft headquarters</p>
                <h3 className="mt-3 text-2xl font-black sm:text-3xl">Get ready for the {selectedSeason.year} draft</h3>
                <p className="mt-3 max-w-2xl text-slate-300">Finalize keepers, review the snake order, and build a shortlist from the best available NFL and college teams.</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link className="w-full rounded-xl bg-blue-600 px-5 py-3 text-center font-black text-white sm:w-auto" href={`/seasons/${selectedSeason.id}/prep`}>Open draft preparation</Link>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Official draft</p>
                {officialDraft ? (
                  <>
                    {officialDraft.startsAt ? <p className="mt-2 text-lg font-bold">{officialDraft.startsAt.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</p> : null}
                    <DraftCountdown draftHref={`/draft/${officialDraft.id}`} meetingUrl={officialDraft.meetingUrl} startsAt={officialDraft.startsAt?.toISOString() ?? null} status={officialDraft.status} />
                  </>
                ) : (
                  <><p className="mt-2 text-xl font-bold">Official draft not created</p><p className="mt-2 text-sm text-slate-400">The commissioner is still preparing the draft.</p></>
                )}
                <p className="mt-4 border-t border-white/10 pt-4 text-sm text-slate-400">{officialDraft ? `${officialDraft.pickSeconds}-second pick clock · ${officialDraft.status.toLowerCase()}` : 'Official draft has not been created yet.'}</p>
              </div>
            </div>
          </section>
        ) : null}

        {champion ? (
          <section className="mb-7 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 text-center sm:p-7">
            <p className="text-5xl">🏆</p>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.24em] text-blue-300">{selectedSeason.year} champion</p>
            <h3 className="mt-2 break-words text-3xl font-black sm:text-4xl">{playerDisplayName(champion.user.name, champion.poolSeat.label)}</h3>
            {championNickname ? <p className="mt-1 text-sm font-semibold text-slate-400">{champion.user.name}</p> : null}
            <p className="mt-2 text-lg text-slate-300">{champion.totalWins} wins</p>
          </section>
        ) : isInSeason ? (
          <section className="mb-7 rounded-2xl border border-blue-300/20 bg-blue-300/10 px-5 py-4"><p className="text-xs font-bold uppercase tracking-wider text-blue-200">Season in progress</p><p className="mt-1 text-sm text-slate-300">Standings include every recorded NFL and college win for this season.</p></section>
        ) : null}

        {isPreseason && viewerParticipant ? (
          <section className="mb-6">
            <KeeperStatusCallout
              locked={Boolean(viewerParticipant.decisionsLockedAt)}
              seasonId={selectedSeason.id}
              submitted={Boolean(viewerParticipant.decisionsSubmittedAt)}
            />
          </section>
        ) : null}

        {isPreseason ? (
          <section className="mb-7 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><h3 className="text-lg font-semibold">Round-one draft order</h3><p className="text-sm text-slate-400">Last place from last season picks first; round two reverses the order.</p></div><span className="text-xs font-bold uppercase tracking-wider text-slate-500">Snake draft</span></div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {keeperTracker.map((participant, index) => <div className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${participant.isViewer ? 'border-blue-500/30 bg-blue-500/10' : 'border-white/5 bg-slate-950/30'}`} key={participant.id}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 text-sm font-black">{index + 1}</span><div className="min-w-0"><p className="truncate font-semibold">{participant.name}{participant.isViewer ? ' · You' : ''}</p>{participant.hasNickname ? <p className="truncate text-xs text-slate-500">{participant.playerName}</p> : null}</div></div>)}
            </div>
          </section>
        ) : null}

        {showKeeperTracker ? (
          <section className="mb-7 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="flex flex-col justify-between gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-lg font-semibold">Keep/Release tracker</h3>
                <p className="text-sm text-slate-400">
                  Submitted keeper lists are visible to everyone in the league.
                </p>
              </div>
              <div className="shrink-0 rounded-full bg-emerald-300/10 px-3 py-1.5 text-sm font-bold text-emerald-300">
                {submittedKeeperCount} of {keeperTracker.length} submitted
              </div>
            </div>
            <div className="divide-y divide-white/5">
              {keeperTracker.map((participant) => (
                <article className={participant.isViewer ? 'bg-blue-500/5' : ''} key={participant.id}>
                  <div className="flex items-start justify-between gap-3 px-4 py-4 sm:items-center sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {participant.name}{participant.isViewer ? ' · You' : ''}
                      </p>
                      {participant.hasNickname ? <p className="truncate text-xs text-slate-500">{participant.playerName}</p> : null}
                      <p className="mt-0.5 text-xs text-slate-500">
                        {participant.submitted
                          ? `${participant.keptTeams.length} team${participant.keptTeams.length === 1 ? '' : 's'} kept`
                          : 'Keeper choices remain private until submitted'}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${participant.submitted ? 'bg-emerald-300/15 text-emerald-200' : 'bg-amber-300/15 text-amber-200'}`}>
                      {participant.submitted ? 'Submitted' : 'In progress'}
                    </span>
                  </div>
                  {participant.submitted ? (
                    <div className="border-t border-white/5 px-4 pb-4 pt-3 sm:px-5">
                      {participant.keptTeams.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {participant.keptTeams.map((team) => (
                            <span className="inline-flex max-w-full items-center gap-2 rounded-lg border border-white/10 bg-slate-950/50 px-2 py-1.5 text-sm" key={team.id}>
                              <span className="text-xs font-bold text-slate-500">{team.slot}</span>
                              <TeamMark abbreviation={team.abbreviation} logoUrl={team.logoUrl} size="sm" />
                              <span className="min-w-0 truncate">{team.name}</span>
                              <span className="shrink-0 text-xs text-slate-500">{team.league === 'NFL' ? 'NFL' : 'College'}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">No teams kept.</p>
                      )}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {!isPreseason ? <section className="mb-7 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 px-5 py-4">
            <h3 className="text-lg font-semibold">League standings</h3>
            <p className="text-sm text-slate-400">Every player, their total wins, and the teams getting them there.</p>
          </div>
          <div className="divide-y divide-white/5">
            {standings.map((participant, index) => {
              const isViewer = participant.userId === context.appUser.id
              const nickname = editableRosterNickname(participant.poolSeat.label)
              return (
                <article className={`px-4 py-5 sm:px-5 ${isViewer ? 'bg-blue-500/10' : ''}`} key={participant.id}>
                  <div className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:gap-3">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full text-base font-black sm:h-10 sm:w-10 sm:text-lg ${index === 0 ? 'bg-blue-600' : 'bg-white/5 text-slate-300'}`}>{index + 1}</span>
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold sm:text-lg">{playerDisplayName(participant.user.name, participant.poolSeat.label)}{isViewer ? ' · You' : ''}</p>
                      {nickname ? <p className="truncate text-sm text-slate-500">{participant.user.name}</p> : null}
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black leading-none tabular-nums text-blue-300 sm:text-4xl">{participant.totalWins}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Total wins</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    {participant.rosterSlots.map((slot) => {
                      const record = slot.teamId ? recordByTeam.get(slot.teamId) : null
                      return (
                        <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-white/5 bg-slate-950/45 px-3 py-2.5" key={slot.id}>
                          {slot.team ? <TeamMark abbreviation={slot.team.abbreviation} logoUrl={slot.team.logoUrl} /> : null}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{slot.team?.name ?? 'Open roster spot'}</p>
                            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              {slot.team?.league === 'NFL' ? 'NFL' : slot.team ? 'College' : `Slot ${slot.number}`}
                            </p>
                          </div>
                          <p className="shrink-0 font-black tabular-nums text-blue-300">
                            {record ? `${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ''}` : '—'}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </article>
              )
            })}
          </div>
        </section> : null}

        {viewerParticipant ? (
          <section>
            <h3 className="mb-3 text-lg font-semibold">My roster</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {viewerParticipant.rosterSlots.map((slot) => {
                const record = slot.teamId ? rosterRecordByTeam.get(slot.teamId) : null
                return (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4" key={slot.id}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Slot {slot.number}</span>
                      {slot.team ? <span className="text-xs text-slate-400">{slot.team.league === 'NFL' ? 'NFL' : 'College'}</span> : null}
                    </div>
                    <div className="mt-3 flex min-h-12 items-center gap-3">
                      {slot.team ? <TeamMark abbreviation={slot.team.abbreviation} logoUrl={slot.team.logoUrl} /> : null}
                      <p className="font-semibold">{slot.team?.name ?? 'Open draft slot'}</p>
                    </div>
                    <p className="mt-2 text-xl font-black tabular-nums text-blue-300">
                      {record ? `${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ''}` : '—'}
                    </p>
                    {isPreseason && record ? <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">Prior season</p> : null}
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
