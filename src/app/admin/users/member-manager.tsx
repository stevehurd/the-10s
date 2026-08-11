'use client'

import { FormEvent, useState } from 'react'

import AdminPageHeader from '@/components/admin-page-header'

export interface Member {
  id: string
  name: string
  email: string | null
  role: 'MEMBER' | 'COMMISSIONER'
  status: string
  hasSignedIn: boolean
  invitationState: 'NEEDS_EMAIL' | 'READY_TO_INVITE' | 'INVITATION_SENT' | 'SEND_FAILED' | 'JOINED'
  invitationSentAt: string | null
  invitationFailedAt: string | null
  invitationClaimedAt: string | null
  invitationSendAttempts: number
}

export interface InvitationDelivery {
  enabled: boolean
  message: string
}

async function getError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? `Request failed (${response.status})`
}

export default function MemberManager({
  initialMembers,
  initialInvitationDelivery,
}: {
  initialMembers: Member[]
  initialInvitationDelivery: InvitationDelivery
}) {
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'MEMBER' | 'COMMISSIONER'>('MEMBER')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [editingInvitationId, setEditingInvitationId] = useState<string | null>(null)
  const [invitationEmail, setInvitationEmail] = useState('')
  const [invitationDelivery, setInvitationDelivery] = useState<InvitationDelivery>(initialInvitationDelivery)

  async function load() {
    const response = await fetch('/api/users')
    if (response.ok) {
      const result = (await response.json()) as {
        members: Member[]
        invitationDelivery: InvitationDelivery
      }
      setMembers(result.members)
      setInvitationDelivery(result.invitationDelivery)
    }
    else setMessage(await getError(response))
  }

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
      setMessage('Player added. Their sign-in email is ready for an invitation.')
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
        ? `${member.name}’s sign-in email is saved. No email was sent.`
        : `${member.name}’s sign-in email was removed.`)
      await load()
    } else setMessage(await getError(response))
    setBusy(null)
  }

  async function sendInvitation(member: Member) {
    setBusy(`send:${member.id}`)
    setMessage(null)
    const response = await fetch(`/api/users/${member.id}/invitation`, { method: 'POST' })
    if (response.ok) {
      setMessage(`Invitation sent to ${member.email}.`)
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

        <form className="grid gap-4 rounded-2xl border border-white/10 bg-slate-900 p-5 md:grid-cols-[1fr_1.4fr_180px_auto] md:items-end" onSubmit={invite}>
          <div className="md:col-span-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">New pool member</p>
            <h2 className="mt-1 text-xl font-black">Add someone to the pool</h2>
            <p className="mt-1 text-sm text-slate-500">Only use this for someone without a legacy profile. Existing players should have their sign-in email assigned below.</p>
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
                      <InvitationProgress member={member} />
                    </div>
                    {member.status === 'ACTIVE' && <div className="flex flex-wrap gap-2">
                      {member.invitationState !== 'JOINED' && <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold disabled:opacity-50" data-testid={`edit-invitation-${member.id}`} disabled={busy !== null} onClick={() => editInvitation(member)} type="button">{member.invitationState === 'NEEDS_EMAIL' ? 'Assign email' : 'Update email'}</button>}
                      {member.invitationState !== 'JOINED' && member.invitationState !== 'NEEDS_EMAIL' && (
                        <button
                          className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={busy !== null || !invitationDelivery.enabled}
                          onClick={() => void sendInvitation(member)}
                          title={invitationDelivery.enabled ? undefined : invitationDelivery.message}
                          type="button"
                        >
                          {busy === `send:${member.id}`
                            ? 'Sending…'
                            : !invitationDelivery.enabled
                              ? 'Email setup required'
                              : member.invitationState === 'INVITATION_SENT'
                                ? 'Resend invitation'
                                : member.invitationState === 'SEND_FAILED'
                                  ? 'Retry invitation'
                                  : 'Send invitation'}
                        </button>
                      )}
                      <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold disabled:opacity-50" disabled={busy !== null} onClick={() => changeRole(member)} type="button">{member.role === 'COMMISSIONER' ? 'Make member' : 'Make commissioner'}</button>
                      <button className="rounded-xl px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50" disabled={busy !== null} onClick={() => remove(member)} type="button">Remove access</button>
                    </div>}
                  </div>

                  {editingInvitationId === member.id && (
                    <form className="mt-4 rounded-xl border border-blue-400/30 bg-slate-950 p-4" onSubmit={(event) => { event.preventDefault(); void updateInvitation(member, invitationEmail) }}>
                      <p className="font-bold">{member.email ? 'Update' : 'Assign'} {member.name}’s sign-in email</p>
                      <p className="mt-1 text-sm text-slate-400">Double-check the person and address. Whoever verifies this email will claim {member.name}’s historical roster. Saving the address does not send an email.</p>
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <input aria-label={`${member.name} invitation email`} autoFocus className="min-w-0 flex-1 rounded-lg border border-slate-700 px-3 py-2" onChange={(event) => setInvitationEmail(event.target.value)} placeholder="player@example.com" required type="email" value={invitationEmail} />
                        <button className="rounded-xl bg-blue-600 px-4 py-2 font-semibold disabled:opacity-50" disabled={busy !== null} type="submit">{busy === `invitation:${member.id}` ? 'Saving…' : 'Save email'}</button>
                        <button className="rounded-xl border border-white/10 px-4 py-2 font-semibold" disabled={busy !== null} onClick={() => setEditingInvitationId(null)} type="button">Cancel</button>
                        {member.invitationState !== 'NEEDS_EMAIL' && <button className="rounded-xl px-4 py-2 font-semibold text-red-700 disabled:opacity-50" disabled={busy !== null} onClick={() => { if (window.confirm(`Remove ${member.name}’s sign-in email?`)) void updateInvitation(member, null) }} type="button">Remove email</button>}
                      </div>
                    </form>
                  )}
                </div>
              ))}
          </div>
        </section>
      </div>
    </main>
  )
}

function InvitationBadge({ state }: { state: Member['invitationState'] }) {
  if (state === 'JOINED') return <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">Joined</span>
  if (state === 'INVITATION_SENT') return <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">Invitation sent</span>
  if (state === 'SEND_FAILED') return <span className="rounded-full bg-red-50 px-2 py-1 text-red-700">Send failed</span>
  if (state === 'READY_TO_INVITE') return <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-800">Ready to invite</span>
  return <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">Needs email</span>
}

function InvitationProgress({ member }: { member: Member }) {
  if (member.invitationState === 'JOINED' && member.invitationClaimedAt) {
    return <p className="mt-2 text-xs text-slate-500">Joined {formatTimestamp(member.invitationClaimedAt)}</p>
  }
  if (member.invitationState === 'INVITATION_SENT' && member.invitationSentAt) {
    return <p className="mt-2 text-xs text-slate-500">Last sent {formatTimestamp(member.invitationSentAt)} · {member.invitationSendAttempts} attempt{member.invitationSendAttempts === 1 ? '' : 's'}</p>
  }
  if (member.invitationState === 'SEND_FAILED' && member.invitationFailedAt) {
    return <p className="mt-2 text-xs text-red-700">Last send failed {formatTimestamp(member.invitationFailedAt)} · retry when delivery is ready</p>
  }
  return null
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-sm font-semibold"><span className="mb-2 block">{label}</span>{children}</label>
}
