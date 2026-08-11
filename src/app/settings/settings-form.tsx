'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type PoolOption = {
  id: string
  name: string
  rosterNickname: string | null
  rosterSeason: number | null
}

export default function SettingsForm({
  initialName,
  currentEmail,
  pendingEmail,
  pools,
}: {
  initialName: string
  currentEmail: string
  pendingEmail: string | null
  pools: PoolOption[]
}) {
  const router = useRouter()
  const [poolId, setPoolId] = useState(pools[0]?.id ?? '')
  const selectedPool = useMemo(() => pools.find((pool) => pool.id === poolId), [poolId, pools])
  const [name, setName] = useState(initialName)
  const [nicknames, setNicknames] = useState<Record<string, string>>(
    Object.fromEntries(pools.map((pool) => [pool.id, pool.rosterNickname ?? ''])),
  )
  const [newEmail, setNewEmail] = useState('')
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [emailMessage, setEmailMessage] = useState<string | null>(null)
  const [profilePending, setProfilePending] = useState(false)
  const [emailPending, setEmailPending] = useState(false)

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfilePending(true)
    setProfileMessage(null)
    const response = await fetch('/api/settings/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ poolId, name, rosterNickname: nicknames[poolId] ?? '' }),
    })
    const result = await response.json()
    setProfilePending(false)
    if (!response.ok) {
      setProfileMessage(result.error ?? 'Unable to save your profile')
      return
    }
    setProfileMessage('Profile saved.')
    router.refresh()
  }

  async function requestEmailChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setEmailPending(true)
    setEmailMessage(null)
    const response = await fetch('/api/settings/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ poolId, email: newEmail }),
    })
    const result = await response.json()
    setEmailPending(false)
    if (!response.ok) {
      setEmailMessage(result.error ?? 'Unable to request the email change')
      return
    }
    setEmailMessage('Check your inbox to confirm the new email address. Your current sign-in stays active until confirmation is complete.')
    setNewEmail('')
    router.refresh()
  }

  const inputClass = 'mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-400/10'

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form className="rounded-3xl border border-white/10 bg-white/5 p-6" onSubmit={saveProfile}>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-300">Player profile</p>
        <h2 className="mt-2 text-2xl font-black">How you appear in the pool</h2>
        <div className="mt-6 space-y-5">
          <label className="block text-sm font-semibold text-slate-200">
            Your name
            <input className={inputClass} maxLength={60} onChange={(event) => setName(event.target.value)} required value={name} />
          </label>
          {pools.length > 1 ? (
            <label className="block text-sm font-semibold text-slate-200">
              Pool
              <select className={inputClass} onChange={(event) => setPoolId(event.target.value)} value={poolId}>
                {pools.map((pool) => <option key={pool.id} value={pool.id}>{pool.name}</option>)}
              </select>
            </label>
          ) : null}
          <label className="block text-sm font-semibold text-slate-200">
            Roster nickname <span className="font-normal text-slate-500">(optional)</span>
            <input
              className={inputClass}
              disabled={!selectedPool?.rosterSeason}
              maxLength={40}
              onChange={(event) => setNicknames((current) => ({ ...current, [poolId]: event.target.value }))}
              placeholder="Fourth & Long"
              value={nicknames[poolId] ?? ''}
            />
            <span className="mt-2 block text-xs font-normal leading-5 text-slate-500">
              {selectedPool?.rosterSeason
                ? `This names your continuing roster in ${selectedPool.name}; its latest season is ${selectedPool.rosterSeason}.`
                : 'A roster nickname becomes available once you have a roster in this pool.'}
            </span>
          </label>
        </div>
        {profileMessage ? <p className="mt-4 text-sm font-semibold text-blue-300">{profileMessage}</p> : null}
        <button className="mt-6 rounded-xl bg-blue-600 px-5 py-3 font-black text-white transition hover:bg-blue-500 disabled:opacity-60" disabled={profilePending} type="submit">
          {profilePending ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      <form className="rounded-3xl border border-white/10 bg-white/5 p-6" onSubmit={requestEmailChange}>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-300">Sign-in email</p>
        <h2 className="mt-2 text-2xl font-black">Keep account access current</h2>
        <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Current email</p>
          <p className="mt-1 font-semibold">{currentEmail}</p>
          {pendingEmail ? <p className="mt-3 text-sm text-amber-200">Pending confirmation: {pendingEmail}</p> : null}
        </div>
        <label className="mt-5 block text-sm font-semibold text-slate-200">
          New email address
          <input autoComplete="email" className={inputClass} onChange={(event) => setNewEmail(event.target.value)} placeholder="you@example.com" required type="email" value={newEmail} />
        </label>
        <p className="mt-3 text-xs leading-5 text-slate-500">For your protection, Supabase verifies the change by email. Keep access to your current inbox until the change is complete.</p>
        {emailMessage ? <p className="mt-4 text-sm font-semibold text-blue-300">{emailMessage}</p> : null}
        <button className="mt-6 rounded-xl border border-white/15 px-5 py-3 font-black text-slate-100 transition hover:bg-white/5 disabled:opacity-60" disabled={emailPending} type="submit">
          {emailPending ? 'Sending…' : 'Change sign-in email'}
        </button>
      </form>
    </div>
  )
}
