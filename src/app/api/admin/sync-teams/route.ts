import { NextResponse } from 'next/server'
import { syncTeamsToDatabase } from '@/lib/team-data'

export async function POST() {
  try {
    const result = await syncTeamsToDatabase()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to sync teams' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Use POST to sync teams' })
}