import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    // First delete all drafts for this user
    await prisma.draft.deleteMany({
      where: {
        userId: params.userId
      }
    })

    // Then delete the user
    await prisma.user.delete({
      where: {
        id: params.userId
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}