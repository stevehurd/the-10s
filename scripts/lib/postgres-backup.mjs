export function parsePostgresConnection(connectionUrl) {
  const url = new URL(connectionUrl)
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DIRECT_URL must use the postgres or postgresql protocol')
  }

  const settings = {
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, '')),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: url.searchParams.get('sslmode') || 'require',
  }

  for (const [name, value] of Object.entries(settings)) {
    if (!value) throw new Error(`DIRECT_URL is missing ${name}`)
  }

  return settings
}

export function backupFileStem(date = new Date()) {
  if (Number.isNaN(date.getTime())) throw new Error('A valid backup timestamp is required')
  return `football-pool-production-${date.toISOString().replace(/[:.]/g, '-')}`
}

export function requiredMetadataLabel(value, flagName) {
  const normalized = value?.trim()
  if (!normalized) throw new Error(`${flagName} is required`)
  if (normalized.length > 100 || /[\r\n\0]/.test(normalized)) {
    throw new Error(`${flagName} must be a single-line label no longer than 100 characters`)
  }
  return normalized
}
