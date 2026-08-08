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
  invitationState: 'UNCLAIMED' | 'INVITED' | 'CLAIMED'
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
  const [editingInvitationId, setEditingInvitationId] = useState<string | null>(null)
  const [invitationEmail, setInvitationEmail] = useState('')
  const activeMembers = members.filter((member) => member.status === 'ACTIVE')
  const pendingInvitationCount = activeMembers.filter((member) => member.invitationState !== 'CLAIMED').length

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
    setBusy(`role:${member.id}`)
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
    setBusy(`access:${member.id}`)
    setMessage(null)
    const response = await fetch(`/api/users/${member.id}`, { method: 'DELETE' })
    if (!response.ok) setMessage(await getError(response))
    await load()
    setBusy(null)
  }

  function editInvitation(member: Member) {
    setEditingInvitationId(member.id)
    setInvitationEmail(member.email ?? '')
    setMessage(null)
  }

  async function updateInvitation(member: Member, nextEmail: string | null) {
    setBusy(`invitation:${member.id}`)
    setMessage(null)
    const response = await fetch(`/api/users/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationEmail: nextEmail }),
    })
    if (response.ok) {
      setEditingInvitationId(null)
      setInvitationEmail('')
      setMessage(nextEmail
        ? `${member.name} can now claim this historical profile by signing in with ${nextEmail.trim().toLowerCase()}. Share the normal sign-in link with them; this assignment did not send an email.`
        : `${member.name}’s invitation email was removed.`)
      await load()
    } else setMessage(await getError(response))
    setBusy(null)
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <AdminPageHeader
          description="Connect legacy rosters to verified sign-in emails, invite new players, and manage commissioner access."
          title="People"
        />

        {!loading && pendingInvitationCount > 0 && (
          <section className="rounded-2xl border border-blue-400/30 bg-blue-50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-300">Legacy player invitations</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">{activeMembers.filter((member) => member.invitationState === 'UNCLAIMED').length} players need a sign-in email</h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-400">Assign the email that each person will use for OTP sign-in. Their first verified code claims the existing profile and all of its historical rosters. Assignment does not send an email, so share the normal sign-in link with them.</p>
              </div>
              <div className="flex gap-2 text-xs font-bold uppercase tracking-wide">
                <span className="rounded-full bg-slate-800 px-3 py-1.5 text-slate-300">{activeMembers.filter((member) => member.invitationState === 'INVITED').length} waiting</span>
                <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-700">{activeMembers.filter((member) => member.invitationState === 'CLAIMED').length} claimed</span>
              </div>
            </div>
          </section>
        )}

        <form className="grid gap-4 rounded-2xl border border-white/10 bg-slate-900 p-5 md:grid-cols-[1fr_1.4fr_180px_auto] md:items-end" onSubmit={invite}>
          <div className="md:col-span-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">New pool member</p>
            <h2 className="mt-1 text-xl font-black">Invite someone to the pool</h2>
            <p className="mt-1 text-sm text-slate-500">Only use this for someone without a legacy profile. Existing players should receive an email assignment below.</p>
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
                <div className={`p-5 ${member.status !== 'ACTIVE' ? 'bg-white/5 opacity-60' : ''}`} data-member-id={member.id} key={member.id}>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-bold">{member.name}</p>
                      <p className="text-sm text-slate-500">{member.email ?? 'No sign-in email assigned'}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                        <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">{member.role === 'COMMISSIONER' ? 'Commissioner' : 'Member'}</span>
                        <InvitationBadge state={member.invitationState} />
                      </div>
                    </div>
                    {member.status === 'ACTIVE' && <div className="flex flex-wrap gap-2">
                      {member.invitationState !== 'CLAIMED' && <button className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold disabled:opacity-50" data-testid={`edit-invitation-${member.id}`} disabled={busy !== null} onClick={() => editInvitation(member)} type="button">{member.invitationState === 'UNCLAIMED' ? 'Assign email' : 'Edit invitation'}</button>}
                      <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold disabled:opacity-50" disabled={busy !== null} onClick={() => changeRole(member)} type="button">{member.role === 'COMMISSIONER' ? 'Make member' : 'Make commissioner'}</button>
                      <button className="rounded-xl px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50" disabled={busy !== null} onClick={() => remove(member)} type="button">Remove access</button>
                    </div>}
                  </div>

                  {editingInvitationId === member.id && (
                    <form className="mt-4 rounded-xl border border-blue-400/30 bg-slate-950 p-4" onSubmit={(event) => { event.preventDefault(); void updateInvitation(member, invitationEmail) }}>
                      <p className="font-bold">Assign {member.name}’s sign-in email</p>
                      <p className="mt-1 text-sm text-slate-400">Double-check the person and address. Whoever verifies this email will claim {member.name}’s historical roster. This saves access but does not send an email.</p>
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <input aria-label={`${member.name} invitation email`} autoFocus className="min-w-0 flex-1 rounded-lg border border-slate-700 px-3 py-2" onChange={(event) => setInvitationEmail(event.target.value)} placeholder="player@example.com" required type="email" value={invitationEmail} />
                        <button className="rounded-xl bg-blue-600 px-4 py-2 font-semibold disabled:opacity-50" disabled={busy !== null} type="submit">{busy === `invitation:${member.id}` ? 'Saving…' : 'Confirm invitation'}</button>
                        <button className="rounded-xl border border-white/10 px-4 py-2 font-semibold" disabled={busy !== null} onClick={() => setEditingInvitationId(null)} type="button">Cancel</button>
                        {member.invitationState === 'INVITED' && <button className="rounded-xl px-4 py-2 font-semibold text-red-700 disabled:opacity-50" disabled={busy !== null} onClick={() => { if (window.confirm(`Remove ${member.name}’s invitation email?`)) void updateInvitation(member, null) }} type="button">Remove email</button>}
                      </div>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function InvitationBadge({ state }: { state: Member['invitationState'] }) {
  if (state === 'CLAIMED') return <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">Claimed</span>
  if (state === 'INVITED') return <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">Waiting for sign-in</span>
  return <span className="rounded-full bg-red-50 px-2 py-1 text-red-700">Needs email</span>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-sm font-semibold"><span className="mb-2 block">{label}</span>{children}</label>
}
