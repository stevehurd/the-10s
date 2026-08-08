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
