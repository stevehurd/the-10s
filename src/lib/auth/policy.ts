export interface MembershipPolicyInput {
  poolId: string
  role: string
  status: string
}

export function selectAuthorizedMembership<T extends MembershipPolicyInput>(
  memberships: T[],
  requiredRole: 'MEMBER' | 'COMMISSIONER',
  poolId?: string,
): T | null {
  return (
    memberships.find(
      (membership) =>
        membership.status === 'ACTIVE' &&
        (!poolId || membership.poolId === poolId) &&
        (requiredRole === 'MEMBER' || membership.role === 'COMMISSIONER'),
    ) ?? null
  )
}
