'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import ProductHeader from '@/components/product-header'

const nav = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/seasons', label: 'Season setup' },
  { href: '/admin/draft', label: 'Draft' },
  { href: '/admin/users', label: 'People' },
  { href: '/admin/teams', label: 'Teams' },
]

export default function AdminShell({ children, commissionerName }: { children: React.ReactNode; commissionerName: string }) {
  const pathname = usePathname()
  return (
    <div className="admin-shell min-h-screen bg-slate-950 text-slate-100">
      <ProductHeader
        action={<div className="flex items-center gap-1 sm:gap-2"><Link className="flex min-h-10 items-center rounded-xl px-2.5 py-2 text-sm font-bold text-slate-300 hover:bg-white/5 sm:px-3" href="/settings">Settings</Link><Link className="flex min-h-10 items-center rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold transition hover:bg-blue-500 sm:px-4" href="/"><span className="sm:hidden">Pool</span><span className="hidden sm:inline">Member view</span></Link></div>}
        context={`${commissionerName} · Commissioner`}
        nav={nav.map((item) => ({
          ...item,
          active: item.href === '/admin' ? pathname === item.href : pathname.startsWith(item.href),
        }))}
      />
      {children}
    </div>
  )
}
