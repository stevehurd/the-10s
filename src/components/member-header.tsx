import Link from 'next/link'

import ProductHeader, { type ProductNavItem } from '@/components/product-header'

type MemberNavSection = 'dashboard' | 'preparation' | 'settings'

export default function MemberHeader({
  active,
  commissioner,
  seasonId,
  userName,
}: {
  active: MemberNavSection
  commissioner: boolean
  seasonId?: string
  userName: string
}) {
  const dashboardHref = seasonId ? `/?season=${seasonId}` : '/'
  const nav: ProductNavItem[] = [
    { href: dashboardHref, label: 'Dashboard', active: active === 'dashboard' },
    ...(seasonId
      ? [{
          href: `/seasons/${seasonId}/prep`,
          label: 'Draft preparation',
          active: active === 'preparation',
        }]
      : []),
    { href: '/settings', label: 'Player settings', active: active === 'settings' },
  ]

  return (
    <ProductHeader
      action={(
        <div className="flex items-center gap-1 sm:gap-2">
          {commissioner ? (
            <Link className="flex min-h-10 items-center rounded-xl px-2.5 py-2 text-sm font-bold text-slate-300 hover:bg-white/5 sm:px-3" href="/admin">
              <span className="sm:hidden">Admin</span>
              <span className="hidden sm:inline">Commissioner</span>
            </Link>
          ) : null}
          <form action="/auth/signout" method="post">
            <button className="min-h-10 rounded-xl border border-white/10 px-2.5 py-2 text-sm font-bold text-slate-300 hover:bg-white/5 sm:px-3" type="submit">
              Sign out
            </button>
          </form>
        </div>
      )}
      context={userName}
      nav={nav}
    />
  )
}
