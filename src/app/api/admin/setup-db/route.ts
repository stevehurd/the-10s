import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorizeApi } from '@/lib/auth/authorization'

export async function POST() {
  const authorization = await authorizeApi('COMMISSIONER')
  if (!authorization.authorized) return authorization.response

  try {
    console.log('Setting up database schema...')
    
    // Test database connection
    await prisma.$connect()
    console.log('Database connected successfully')
    
    // Check if tables exist by trying to count users
    try {
      const userCount = await prisma.user.count()
      console.log(`Database already set up. Found ${userCount} users.`)
      
      return NextResponse.json({ 
        success: true, 
        message: 'Database already configured',
        userCount 
      })
    } catch {
      // Tables don't exist, need to create them
      console.log('Tables do not exist. Database schema needs to be created.')
      
      return NextResponse.json({
        success: false,
        message: 'Database schema missing. Apply the reviewed migrations with: npm run db:deploy',
        error: 'Tables not found'
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('Database setup failed:', error)
    return NextResponse.json({
      success: false,
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
