export type PreparationEligibilityStatus = 'PENDING' | 'REVIEW' | 'APPROVED' | 'INACTIVE'
export type PreparationHolder = {
  name: string
  retentionChoice: 'KEEP' | 'PENDING'
}

export function getPreparationTeamState(
  eligibilityStatus: PreparationEligibilityStatus,
  holder: PreparationHolder | null,
) {
  const eligibilityReason =
    eligibilityStatus === 'PENDING'
      ? 'Annual FBS eligibility review pending'
      : eligibilityStatus === 'REVIEW'
        ? 'FBS eligibility needs commissioner review'
        : eligibilityStatus === 'INACTIVE'
          ? 'Not eligible for this season'
          : null

  return {
    available: eligibilityStatus === 'APPROVED' && !holder,
    held: Boolean(holder),
    unavailableReason: [
      holder
        ? holder.retentionChoice === 'KEEP'
          ? `Kept by ${holder.name}`
          : `Keeper decision pending for ${holder.name}`
        : null,
      eligibilityReason,
    ]
      .filter(Boolean)
      .join(' · ') || null,
  }
}

export function shouldShowPreparationTeam(
  team: { held: boolean },
  showHeldTeams: boolean,
) {
  return showHeldTeams || !team.held
}
