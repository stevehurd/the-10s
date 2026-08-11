const PRISMA_WRITE_CONFLICT_CODE = 'P2034'

export function isPrismaWriteConflict(error: unknown): boolean {
  return Boolean(
    error
      && typeof error === 'object'
      && 'code' in error
      && error.code === PRISMA_WRITE_CONFLICT_CODE,
  )
}

export async function retryPrismaWriteConflict<T>(
  operation: (attempt: number) => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError('maxAttempts must be a positive integer')
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt)
    } catch (error) {
      if (!isPrismaWriteConflict(error) || attempt === maxAttempts) throw error
    }
  }

  throw new Error('Unreachable write-conflict retry state')
}
