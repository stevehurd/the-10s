const DEFAULT_CONNECTION_LIMIT = 5

function positiveInteger(value: string | undefined) {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export function runtimeDatabaseUrl(
  databaseUrl: string | undefined,
  configuredLimit = process.env.DATABASE_CONNECTION_LIMIT,
) {
  if (!databaseUrl) return undefined

  const url = new URL(databaseUrl)
  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set(
      'connection_limit',
      String(positiveInteger(configuredLimit) ?? DEFAULT_CONNECTION_LIMIT),
    )
  }
  return url.toString()
}
