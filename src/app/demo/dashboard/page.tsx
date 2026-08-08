import Link from 'next/link'
import { notFound } from 'next/navigation'

import ProductHeader, { SeasonStageTracker } from '@/components/product-header'

const standings = [
  { name: 'Alex Morgan', wins: 106, nfl: 25, college: 81, trend: '—' },
  { name: 'Jordan Lee', wins: 103, nfl: 23, college: 80, trend: '↑ 2' },
  { name: 'Sam Rivera', wins: 99, nfl: 26, college: 73, trend: '↓ 1' },
  { name: 'Taylor Brooks', wins: 96, nfl: 21, college: 75, trend: '↑ 1' },
  { name: 'Casey Nguyen', wins: 91, nfl: 19, college: 72, trend: '↓ 2' },
]

const roster = [
  { slot: 1, team: 'Baltimore Ravens', league: 'NFL', record: '12-5', state: 'Keeper' },
  { slot: 2, team: 'Philadelphia Eagles', league: 'NFL', record: '14-3', state: 'Drafted' },
  { slot: 3, team: 'Ohio State', league: 'College', record: '14-2', state: 'Keeper' },
  { slot: 4, team: 'Oregon', league: 'College', record: '13-1', state: 'Drafted' },
  { slot: 5, team: 'Georgia', league: 'College', record: '13-2', state: 'Keeper' },
]

export default function DemoDashboardPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return (
    <main className="min-h-screen bg-[#f4f6f8] text-[#07111f]">
      <ProductHeader
        action={<span className="rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-lime-300">Demo Player</span>}
        context="2026 Season"
        nav={[
          { href: '/demo/dashboard', label: 'Dashboard', active: true },
          { href: '/demo/setup', label: 'Season setup' },
          { href: '/demo', label: 'Draft room' },
        ]}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <section className="grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
          <div className="overflow-hidden rounded-3xl bg-[#0e2138] p-6 text-white shadow-xl shadow-slate-900/10 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-lime-300">Welcome back, Alex</p>
            <h1 className="mt-3 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">Your roster is set. Football starts now.</h1>
            <p className="mt-3 max-w-2xl text-slate-300">Follow all ten teams, watch the weekly standings move, and see exactly where each win came from.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <div className="rounded-xl bg-white/10 px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current rank</p><p className="mt-1 text-2xl font-black text-lime-300">1st</p></div>
              <div className="rounded-xl bg-white/10 px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total wins</p><p className="mt-1 text-2xl font-black">106</p></div>
              <div className="rounded-xl bg-white/10 px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Lead</p><p className="mt-1 text-2xl font-black">+3</p></div>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Season journey</p>
            <h2 className="mt-1 text-xl font-black">2026 pool</h2>
            <div className="mt-5"><SeasonStageTracker activeStage="SEASON" /></div>
            <p className="mt-5 rounded-xl bg-lime-50 p-4 text-sm font-medium text-lime-950"><span className="font-black">Next update:</span> standings sync Tuesday morning after the week closes.</p>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-end justify-between border-b border-slate-100 p-5"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">The race</p><h2 className="mt-1 text-xl font-black">League standings</h2></div><span className="text-xs font-semibold text-slate-500">After Week 12</span></div>
            <div className="divide-y divide-slate-100">
              {standings.map((player, index) => (
                <div className={`grid grid-cols-[42px_1fr_auto_auto] items-center gap-3 px-5 py-4 ${index === 0 ? 'bg-lime-50/70' : ''}`} key={player.name}>
                  <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-black ${index === 0 ? 'bg-lime-300 text-lime-950' : 'bg-slate-100 text-slate-500'}`}>{index + 1}</span>
                  <div><p className="font-bold">{player.name}{index === 0 ? ' · You' : ''}</p><p className="text-xs text-slate-500">NFL {player.nfl} · College {player.college}</p></div>
                  <span className="text-xs font-bold text-slate-400">{player.trend}</span>
                  <span className="text-xl font-black tabular-nums">{player.wins}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Your teams</p><h2 className="mt-1 text-xl font-black">Roster snapshot</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">2 NFL · 8 College</span></div>
            <div className="mt-5 space-y-2">
              {roster.map((team) => (
                <div className="grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-xl border border-slate-100 px-3 py-3" key={team.slot}>
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#0e2138] text-xs font-black text-white">{team.slot}</span>
                  <div><p className="font-bold">{team.team}</p><p className="text-xs text-slate-500">{team.league} · {team.state}</p></div>
                  <span className="font-black tabular-nums">{team.record}</span>
                </div>
              ))}
              <p className="pt-2 text-center text-xs font-semibold text-slate-400">+ 5 more college teams</p>
            </div>
          </section>
        </div>

        <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Commissioner preview</p><h2 className="mt-1 text-lg font-black">See how a season gets prepared</h2></div>
          <div className="flex gap-2"><Link className="rounded-xl border border-blue-200 bg-white px-4 py-2 font-bold text-blue-900" href="/demo/setup">Season setup</Link><Link className="rounded-xl bg-blue-700 px-4 py-2 font-bold text-white" href="/demo">Enter draft room</Link></div>
        </section>
      </div>
    </main>
  )
}
