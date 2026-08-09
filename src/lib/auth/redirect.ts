export function normalizeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/'
  }
  return value
}

export function buildEmailAuthCallbackUrl(origin: string, nextPath: string | null | undefined) {
  const callback = new URL('/auth/confirm', origin)
  callback.searchParams.set('next', normalizeNextPath(nextPath))
  return callback.toString()
}
