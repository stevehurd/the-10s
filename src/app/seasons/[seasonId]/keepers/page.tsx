import KeeperChoices from './keeper-choices'

export default async function KeepersPage({
  params,
}: {
  params: Promise<{ seasonId: string }>
}) {
  const { seasonId } = await params
  return <KeeperChoices seasonId={seasonId} />
}
