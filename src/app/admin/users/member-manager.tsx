'use client'

import { FormEvent, useEffect, useState } from 'react'

import AdminPageHeader from '@/components/admin-page-header'

interface Member {
  id: string
  name: string
  email: string | null
  role: 'MEMBER' | 'COMMISSIONER'
  status: string
  hasSignedIn: boolean
}

async function getError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? `Request failed (${response.status})`
}

export default function MemberManager() {
  const [members, setMembers] = useState<Member[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'MEMBER' | 'COMMISSIONER'>('MEMBER')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    const response = await fetch('/api/users')
    if (response.ok) setMembers((await response.json()) as Member[])
    else setMessage(await getError(response))
    setLoading(false)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [])

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy('invite')
    setMessage(null)
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, role }),
    })
    if (response.ok) {
      setName('')
      setEmail('')
      setRole('MEMBER')
      setMessage('Member is ready. Send them the normal sign-in link; their first verified code links this profile.')
      await load()
    } else setMessage(await getError(response))
    setBusy(null)
  }

  async function changeRole(member: Member) {
    const nextRole = member.role === 'COMMISSIONER' ? 'MEMBER' : 'COMMISSIONER'
    setBusy(member.id)
    setMessage(null)
    const response = await fetch(`/api/users/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: nextRole }),
    })
    if (!response.ok) setMessage(await getError(response))
    await load()
    setBusy(null)
  }

  async function remove(member: Member) {
    if (!window.confirm(`Remove ${member.name}’s access? Historical rosters will be preserved.`)) return
    setBusy(member.id)
    setMessage(null)
    const response = await fetch(`/api/users/${member.id}`, { method: 'DELETE' })
    if (!response.ok) setMessage(await getError(response))
    await load()
    setBusy(null)
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <AdminPageHeader
          description="Invite players, see who has signed in, and choose who can help manage the pool."
          title="People"
        />

        <form className="grid gap-4 rounded-2xl border border-white/10 bg-slate-900 p-5 md:grid-cols-[1fr_1.4fr_180px_auto] md:items-end" onSubmit={invite}>
          <div className="md:col-span-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Add a player</p>
            <h2 className="mt-1 text-xl font-black">Invite someone to the pool</h2>
            <p className="mt-1 text-sm text-slate-500">They’ll use the invited email to sign in with a one-time code.</p>
          </div>
          <Field label="Name"><input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} required /></Field>
          <Field label="Email"><input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required /></Field>
          <Field label="Role"><select className="w-full rounded-lg border border-slate-300 bg-slate-900 px-3 py-2" value={role} onChange={(event) => setRole(event.target.value as typeof role)}><option value="MEMBER">Member</option><option value="COMMISSIONER">Commissioner</option></select></Field>
          <button className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold disabled:opacity-50" disabled={busy !== null}>{busy === 'invite' ? 'Adding…' : 'Add player'}</button>
        </form>

        {message && <p aria-live="polite" className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">{message}</p>}

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
            <div><h2 className="font-black">Pool members</h2><p className="mt-0.5 text-sm text-slate-500">Access and commissioner permissions</p></div>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-300">{members.length} people</span>
          </div>
          {loading ? <p className="p-5 text-slate-500">Loading members…</p> : (
            <div className="divide-y divide-white/10">
              {members.map((member) => (
                <div className={`flex flex-wrap items-center justify-between gap-4 p-5 ${member.status !== 'ACTIVE' ? 'bg-white/5 opacity-60' : ''}`} key={member.id}>
                  <div>
                    <p className="font-bold">{member.name}</p>
                    <p className="text-sm text-slate-600">{member.email}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">{member.role === 'COMMISSIONER' ? 'Commissioner' : 'Member'}</span>
                      <span className={`h-2 w-2 rounded-full ${member.hasSignedIn ? 'bg-emerald-300' : 'bg-slate-600'}`} />
                      <span>{member.hasSignedIn ? 'Signed in' : 'Not signed in yet'}</span>
                    </div>
                  </div>
                  {member.status === 'ACTIVE' && <div className="flex gap-2">
                    <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold disabled:opacity-50" disabled={busy !== null} onClick={() => changeRole(member)} type="button">{member.role === 'COMMISSIONER' ? 'Make member' : 'Make commissioner'}</button>
                    <button className="rounded-xl px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50" disabled={busy !== null} onClick={() => remove(member)} type="button">Remove access</button>
                  </div>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-sm font-semibold"><span className="mb-2 block">{label}</span>{children}</label>
}
