import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      include: {
        drafts: {
          include: {
            team: true
          },
          orderBy: {
            round: 'asc'
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json(users)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email } = body

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // Check if user already exists by name or email (if email provided)
    const whereConditions = [{ name: name.trim() }]
    if (email?.trim()) {
      whereConditions.push({ email: email.trim() })
    }
    
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: whereConditions
      }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this name or email already exists' },
        { status: 400 }
      )
    }
    
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email?.trim() || null
      },
      include: {
        drafts: {
          include: {
            team: true
          },
          orderBy: {
            round: 'asc'
          }
        }
      }
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('User creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}