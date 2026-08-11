'use client'

import Form from 'next/form'

interface SeasonOption {
  id: string
  name: string
}

export default function SeasonSelector({
  seasons,
  selectedSeasonId,
}: {
  seasons: SeasonOption[]
  selectedSeasonId: string
}) {
  return (
    <Form action="/" scroll={false}>
      <label className="text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="season">
        Season
      </label>
      <select
        className="mt-1 block rounded-xl border border-white/10 bg-slate-900 px-4 py-2"
        id="season"
        name="season"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        value={selectedSeasonId}
      >
        {seasons.map((season) => (
          <option key={season.id} value={season.id}>{season.name}</option>
        ))}
      </select>
      <button className="sr-only" type="submit">Change season</button>
    </Form>
  )
}
