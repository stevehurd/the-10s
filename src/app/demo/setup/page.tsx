import { notFound } from 'next/navigation'

import SeasonSetup from '@/app/admin/seasons/[seasonId]/setup/season-setup'
import ProductHeader from '@/components/product-header'

export default function DemoSeasonSetupPage() {
  if (process.env.NODE_ENV !== 'development') notFound()

  const participants = Array.from({ length: 6 }, (_, index) => ({
    id: `demo-participant-${index + 1}`,
    userId: `demo-user-${index + 1}`,
    name: ['Taylor Brooks', 'Sam Rivera', 'Jordan Lee', 'Alex Morgan', 'Casey Nguyen', 'Morgan Reed'][index],
    email: `player${index + 1}@example.test`,
    baseDraftOrder: index + 1,
    isReplacement: index === 2,
    releaseOverride: index === 4,
    decisionsSubmitted: index !== 5,
    decisionsLocked: index !== 5,
    inheritedCount: index === 5 ? 0 : 10,
    releasedNFL: index === 5 ? 0 : 1,
    releasedCollege: index === 5 ? 0 : 2,
  }))

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <ProductHeader
        context="Development preview"
        nav={[
          { href: '/demo/dashboard', label: 'Dashboard' },
          { href: '/demo/setup', label: 'Season setup', active: true },
          { href: '/demo', label: 'Draft room' },
        ]}
      />
      <main className="px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700">The 10&apos;s Development</p>
          <h1 className="mt-1 text-3xl font-bold">2026 Season setup demo</h1>
          <p className="mt-2 text-slate-600">Development-only preview. Actions do not write to a database.</p>
        </div>
        <SeasonSetup
          availableMembers={[
            { id: 'new-user-1', name: 'Riley Chen', email: 'riley@example.test' },
            { id: 'new-user-2', name: 'Jamie Patel', email: 'jamie@example.test' },
          ]}
          demo
          draftConfigured={false}
          participants={participants}
          seasonId="demo-season"
          unresolvedEligibility={2}
        />
        </div>
      </main>
    </div>
  )
}
