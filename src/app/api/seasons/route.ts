import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    let seasons = await prisma.season.findMany({
      orderBy: {
        year: 'desc'
      }
    })

    // If no seasons exist, create a default one for 2025
    if (seasons.length === 0) {
      console.log('No seasons found, creating default 2025 season...')
      const defaultSeason = await prisma.season.create({
        data: {
          year: 2025,
          name: '2025 Season',
          status: 'DRAFT'
        }
      })
      seasons = [defaultSeason]
    }

    return NextResponse.json(seasons)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch seasons' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { year, name, status = 'DRAFT' } = body

    if (!year || !name) {
      return NextResponse.json(
        { error: 'Year and name are required' },
        { status: 400 }
      )
    }

    const season = await prisma.season.create({
      data: {
        year: parseInt(year),
        name: name.trim(),
        status: status
      }
    })

    return NextResponse.json(season)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create season' },
      { status: 500 }
    )
  }
}