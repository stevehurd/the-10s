import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { syncSeasonStandings } from '@/lib/standings-sync'

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const season = await prisma.season.findFirst({
      where: { status: 'ACTIVE', finalizedAt: null },
      orderBy: { year: 'desc' },
    })
    if (!season) {
      return NextResponse.json({ error: 'No active season is configured' }, { status: 409 })
    }

    const result = await syncSeasonStandings(season.id, 'BOTH', { trigger: 'CRON' })
    return NextResponse.json({
      success: result.errors.length === 0,
      season: season.year,
      timestamp: new Date().toISOString(),
      ...result,
    })
  } catch (error) {
    console.error('Standings cron failed:', error)
    return NextResponse.json({ error: 'Standings sync failed' }, { status: 500 })
  }
}
