'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

interface SeasonOption { id: string; year: number; name: string; poolName: string }

export default function CreateNextSeason({ seasons }: { seasons: SeasonOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [previousSeasonId, setPreviousSeasonId] = useState(seasons[0]?.id ?? '')
  const selected = seasons.find((season) => season.id === previousSeasonId)
  const [year, setYear] = useState((selected?.year ?? new Date().getFullYear()) + 1)
  const [name, setName] = useState(`${year} Season`)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const response = await fetch('/api/seasons/from-previous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ previousSeasonId, year, name }),
    })
    const body = (await response.json().catch(() => null)) as { id?: string; error?: string } | null
    if (!response.ok || !body?.id) {
      setError(body?.error ?? 'Unable to create season')
      setBusy(false)
      return
    }
    router.push(`/admin/seasons/${body.id}/setup`)
    router.refresh()
  }

  if (!open) return <button className="rounded-xl bg-blue-600 px-5 py-3 font-semibold disabled:opacity-50" disabled={seasons.length === 0} onClick={() => setOpen(true)}>Create next season</button>

  return (
    <form className="grid gap-4 rounded-2xl border border-white/10 bg-slate-900 p-5 md:grid-cols-[1.4fr_140px_1fr_auto] md:items-end" onSubmit={submit}>
      <Field label="Copy previous season"><select className="w-full rounded-lg border border-slate-300 bg-slate-900 px-3 py-2" value={previousSeasonId} onChange={(event) => { const next = seasons.find((season) => season.id === event.target.value); setPreviousSeasonId(event.target.value); if (next) { setYear(next.year + 1); setName(`${next.year + 1} Season`) } }}>{seasons.map((season) => <option key={season.id} value={season.id}>{season.poolName} — {season.name}</option>)}</select></Field>
      <Field label="Year"><input className="w-full rounded-lg border border-slate-300 px-3 py-2" min={selected ? selected.year + 1 : 2000} onChange={(event) => setYear(Number(event.target.value))} type="number" value={year} /></Field>
      <Field label="Season name"><input className="w-full rounded-lg border border-slate-300 px-3 py-2" onChange={(event) => setName(event.target.value)} value={name} /></Field>
      <button className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold disabled:opacity-50" disabled={busy}>{busy ? 'Creating…' : 'Create'}</button>
      {error && <p className="text-sm text-red-700 md:col-span-4">{error}</p>}
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-sm font-semibold"><span className="mb-2 block">{label}</span>{children}</label>
}
