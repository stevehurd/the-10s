import { NextResponse } from 'next/server'

import { autopickExpiredOfficialDrafts } from '@/lib/draft/service'

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await autopickExpiredOfficialDrafts()
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    })
  } catch (error) {
    console.error('Draft autopick cron failed:', error)
    return NextResponse.json({ error: 'Draft autopick worker failed' }, { status: 500 })
  }
}
