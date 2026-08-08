import { redirect } from 'next/navigation'

import { getCurrentAppUser } from '@/lib/auth/authorization'

import AdminShell from './admin-shell'

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await getCurrentAppUser()
  if (!context?.appUser.memberships.some((membership) => membership.role === 'COMMISSIONER')) redirect('/')
  return <AdminShell commissionerName={context.appUser.name}>{children}</AdminShell>
}
