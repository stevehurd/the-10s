'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Member { id: string; name: string; email: string | null }
interface Participant {
  id: string
  userId: string
  name: string
  email: string | null
  baseDraftOrder: number | null
  isReplacement: boolean
  releaseOverride: boolean
  decisionsSubmitted: boolean
  inheritedCount: number
  releasedNFL: number
  releasedCollege: number
}

async function errorMessage(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? `Request failed (${response.status})`
}

export default function SeasonSetup({ seasonId, participants: initialParticipants, availableMembers, unresolvedEligibility, draftConfigured, demo = false }: { seasonId: string; participants: Participant[]; availableMembers: Member[]; unresolvedEligibility: number; draftConfigured: boolean; demo?: boolean }) {
  const router = useRouter()
  const [order, setOrder] = useState(initialParticipants)
  const [replacementFor, setReplacementFor] = useState<string | null>(null)
  const [newUserId, setNewUserId] = useState(availableMembers[0]?.id ?? '')
  const [newPosition, setNewPosition] = useState(initialParticipants.length + 1)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  function move(index: number, direction: -1 | 1) {
    const destination = index + direction
    if (destination < 0 || destination >= order.length) return
    const next = [...order]
    ;[next[index], next[destination]] = [next[destination], next[index]]
    setOrder(next)
  }

  async function request(path: string, method: string, body: object, action: string) {
    setBusy(action)
    setMessage(null)
    if (demo) {
      setMessage('Demo action previewed. Database-backed setup will persist and audit this change.')
      setBusy(null)
      return true
    }
    const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!response.ok) {
      setMessage(await errorMessage(response))
      setBusy(null)
      return false
    }
    router.refresh()
    setBusy(null)
    return true
  }

  async function saveOrder() {
    const ok = await request(`/api/seasons/${seasonId}/draft-order`, 'PUT', { participantIds: order.map((participant) => participant.id) }, 'order')
    if (ok) setMessage('Draft order saved.')
  }

  async function replace(participantId: string, replacementUserId: string) {
    if (!replacementUserId) return
    const ok = await request(`/api/seasons/${seasonId}/participants/${participantId}`, 'PATCH', { replacementUserId }, `replace-${participantId}`)
    if (ok) setReplacementFor(null)
  }

  async function addSeat() {
    if (!newUserId) return
    await request(`/api/seasons/${seasonId}/participants`, 'POST', { userId: newUserId, baseDraftOrder: newPosition }, 'add')
  }

  const submitted = initialParticipants.filter((participant) => participant.decisionsSubmitted).length
  const ready = initialParticipants.length > 0 && submitted === initialParticipants.length && unresolvedEligibility === 0

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-4">
        <Metric label="Participants" value={initialParticipants.length} ok={initialParticipants.length > 0} />
        <Metric label="Choices submitted" value={`${submitted}/${initialParticipants.length}`} ok={submitted === initialParticipants.length} />
        <Metric label="Eligibility reviews" value={unresolvedEligibility} ok={unresolvedEligibility === 0} />
        <Metric label="Draft readiness" value={ready ? 'Ready' : 'Blocked'} ok={ready} />
      </section>

      {draftConfigured && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">A draft is already configured. Participant, order, and override changes are locked until its rehearsal is deleted or official draft is canceled.</p>}
      {message && <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">{message}</p>}

      <section className="border-y border-white/10 bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-bold">Base draft order</h2><p className="text-sm text-slate-600">Position 1 picks first in round one; the order snakes each round.</p></div>
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={draftConfigured || busy !== null} onClick={saveOrder}>Save order</button>
        </div>
        <div className="mt-5 space-y-3">
          {order.map((participant, index) => (
            <article className="grid gap-4 rounded-xl border border-slate-200 p-4 lg:grid-cols-[54px_1fr_auto_auto] lg:items-center" key={participant.id}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-lg font-black text-white">{index + 1}</div>
              <div>
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{participant.name}</h3>{participant.isReplacement && <Badge>Replacement</Badge>}{participant.releaseOverride && <Badge>Override</Badge>}</div>
                <p className="text-sm text-slate-500">{participant.email}</p>
                <p className="mt-1 text-xs text-slate-600">{participant.inheritedCount ? `${participant.releasedNFL} NFL and ${participant.releasedCollege} college released` : 'New seat · 10 open slots'} · {participant.decisionsSubmitted ? 'Submitted' : 'Not submitted'}</p>
              </div>
              <div className="flex gap-1">
                <button aria-label={`Move ${participant.name} earlier`} className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-30" disabled={draftConfigured || index === 0} onClick={() => move(index, -1)}>↑</button>
                <button aria-label={`Move ${participant.name} later`} className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-30" disabled={draftConfigured || index === order.length - 1} onClick={() => move(index, 1)}>↓</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {participant.inheritedCount > 0 && <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50" disabled={draftConfigured || busy !== null} onClick={() => request(`/api/seasons/${seasonId}/participants/${participant.id}`, 'PATCH', { releaseOverride: !participant.releaseOverride }, `override-${participant.id}`)}>{participant.releaseOverride ? 'Remove override' : 'Allow release override'}</button>}
                <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50" disabled={draftConfigured || busy !== null || availableMembers.length === 0} onClick={() => setReplacementFor(replacementFor === participant.id ? null : participant.id)}>Replace</button>
              </div>
              {replacementFor === participant.id && <div className="flex gap-2 lg:col-start-2 lg:col-span-3"><select className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-900 px-3 py-2" defaultValue="" id={`replacement-${participant.id}`}><option disabled value="">Choose an active pool member</option>{availableMembers.map((member) => <option key={member.id} value={member.id}>{member.name} — {member.email}</option>)}</select><button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => { const select = document.getElementById(`replacement-${participant.id}`) as HTMLSelectElement | null; void replace(participant.id, select?.value ?? '') }}>Confirm replacement</button></div>}
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-slate-900 p-5">
        <h2 className="text-xl font-bold">Add a new seat</h2>
        <p className="mt-1 text-sm text-slate-600">A new entrant starts with ten open slots and no inherited keepers.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
          <label className="text-sm font-semibold">Pool member<select className="mt-2 w-full rounded-lg border border-slate-300 bg-slate-900 px-3 py-2" disabled={!availableMembers.length} onChange={(event) => setNewUserId(event.target.value)} value={newUserId}>{availableMembers.map((member) => <option key={member.id} value={member.id}>{member.name} — {member.email}</option>)}</select></label>
          <label className="text-sm font-semibold">Draft position<input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" max={initialParticipants.length + 1} min={1} onChange={(event) => setNewPosition(Number(event.target.value))} type="number" value={newPosition} /></label>
          <button className="rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50" disabled={draftConfigured || busy !== null || !newUserId} onClick={addSeat}>Add seat</button>
        </div>
        {!availableMembers.length && <p className="mt-3 text-sm text-amber-700">Add the person under Pool access before assigning them a seat.</p>}
      </section>

      <section className="flex flex-wrap gap-3">
        {demo ? (
          <Link className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white" href="/demo">Back to draft demo</Link>
        ) : (
          <>
            <Link className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold" href={`/admin/seasons/${seasonId}/eligibility`}>Review team eligibility</Link>
            <Link className="rounded-full border border-white/10 bg-white/5 px-4 py-2 font-semibold" href="/admin/users">Manage pool access</Link>
            <Link className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white" href="/admin/draft">Continue to draft control</Link>
          </>
        )}
      </section>
    </>
  )
}

function Metric({ label, value, ok }: { label: string; value: string | number; ok: boolean }) {
  return <div className={`rounded-xl border px-4 py-3 ${ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-800">{children}</span>
}
