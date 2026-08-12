import Link from 'next/link'
import { redirect } from 'next/navigation'

import MemberHeader from '@/components/member-header'
import { getCurrentAppUser } from '@/lib/auth/authorization'
import { getLatestPoolSeat } from '@/lib/player-settings'
import { editableRosterNickname } from '@/lib/player-settings-rules'

import SettingsForm from './settings-form'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const context = await getCurrentAppUser()
  if (!context) redirect('/login?next=/settings')

  const pools = await Promise.all(context.appUser.memberships.map(async (membership) => {
    const participant = await getLatestPoolSeat(context.appUser.id, membership.poolId)
    return {
      id: membership.poolId,
      name: membership.pool.name,
      rosterNickname: editableRosterNickname(participant?.poolSeat.label),
      rosterSeason: participant?.season.year ?? null,
      seasonId: participant?.season.id,
    }
  }))

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <MemberHeader
        active="settings"
        commissioner={context.appUser.memberships.some((membership) => membership.role === 'COMMISSIONER')}
        seasonId={pools[0]?.seasonId}
        userName={context.appUser.name}
      />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Link className="text-sm font-bold text-slate-400 hover:text-white" href="/">← Back to dashboard</Link>
        <div className="mb-8 mt-5">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-400">Player settings</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Make this roster yours.</h1>
          <p className="mt-3 max-w-2xl text-slate-400">Update your player name, give your continuing roster a nickname, or securely change the email you use to sign in.</p>
        </div>
        <SettingsForm
          currentEmail={context.authUser.email ?? context.appUser.email ?? 'No email on file'}
          initialName={context.appUser.name}
          pendingEmail={context.authUser.new_email ?? null}
          pools={pools}
        />
      </div>
    </main>
  )
}
