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
        action={<Link className="rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-500" href="/">Member view</Link>}
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
