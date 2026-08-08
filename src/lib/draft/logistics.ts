export function normalizeMeetingUrl(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  if (/^https:\/\//i.test(trimmed)) return trimmed
  if (/^http:\/\//i.test(trimmed)) return `https://${trimmed.slice('http://'.length)}`
  if (trimmed.startsWith('//')) return `https:${trimmed}`

  // Preserve explicit non-web schemes so validation can reject them instead of
  // disguising them as an HTTPS hostname.
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) return trimmed

  return `https://${trimmed}`
}
