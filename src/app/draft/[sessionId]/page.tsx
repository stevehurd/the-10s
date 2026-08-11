import DraftRoom from './draft-room'

export default async function DraftPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  return <DraftRoom sessionId={sessionId} />
}
