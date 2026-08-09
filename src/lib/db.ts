import { PrismaClient } from '@prisma/client'

import { runtimeDatabaseUrl } from './database-url'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: runtimeDatabaseUrl(process.env.DATABASE_URL),
    log: process.env.PRISMA_QUERY_LOG === 'true' ? ['query'] : [],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
