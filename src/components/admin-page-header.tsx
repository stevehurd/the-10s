import Link from 'next/link'

export default function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <Link className="text-sm font-semibold text-slate-500 transition hover:text-slate-100" href="/admin">
          ← Commissioner overview
        </Link>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}
