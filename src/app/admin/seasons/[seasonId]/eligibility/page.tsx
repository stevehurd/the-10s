import EligibilityReview from './review'

export default async function EligibilityPage({
  params,
}: {
  params: Promise<{ seasonId: string }>
}) {
  const { seasonId } = await params
  return <EligibilityReview seasonId={seasonId} />
}
