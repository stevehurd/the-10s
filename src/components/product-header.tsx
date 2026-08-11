import Link from 'next/link'

export interface ProductNavItem {
  href: string
  label: string
  active?: boolean
}

export default function ProductHeader({
  nav,
  context,
  action,
}: {
  nav: ProductNavItem[]
  context?: string
  action?: React.ReactNode
}) {
  return (
    <header className="border-b border-white/10 bg-slate-900/95 text-slate-100 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-3 px-4 py-4 sm:px-6">
        <Link className="flex items-center gap-3" href={nav[0]?.href ?? '/'}>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-600 text-lg font-black text-white">10</span>
          <span>
            <span className="block text-lg font-black leading-none tracking-tight">THE 10&apos;S</span>
            <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Football pool</span>
          </span>
        </Link>
        <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
          {nav.map((item) => (
            <Link
              className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition ${item.active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'}`}
              href={item.href}
              key={`${item.href}-${item.label}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {context ? <span className="hidden text-sm font-medium text-slate-400 md:block">{context}</span> : null}
          {action}
        </div>
      </div>
    </header>
  )
}

export function SeasonStageTracker({ activeStage }: { activeStage: 'SETUP' | 'KEEPERS' | 'DRAFT' | 'SEASON' }) {
  const stages = [
    { key: 'SETUP', label: 'Set up' },
    { key: 'KEEPERS', label: 'Keepers' },
    { key: 'DRAFT', label: 'Draft' },
    { key: 'SEASON', label: 'Season' },
  ] as const
  const activeIndex = stages.findIndex((stage) => stage.key === activeStage)
  return (
    <div className="grid grid-cols-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
      {stages.map((stage, index) => (
        <div className={`relative px-2 py-3 text-center ${index <= activeIndex ? 'bg-slate-900 text-slate-100' : 'text-slate-400'}`} key={stage.key}>
          <span className={`mx-auto mb-1 grid h-6 w-6 place-items-center rounded-full text-xs font-black ${index < activeIndex ? 'bg-blue-500 text-white' : index === activeIndex ? 'border-2 border-orange-400 text-orange-300' : 'bg-slate-100 text-slate-400'}`}>{index < activeIndex ? '✓' : index + 1}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider">{stage.label}</span>
        </div>
      ))}
    </div>
  )
}
