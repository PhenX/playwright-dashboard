/**
 * URL and network data sanitization helpers.
 *
 * These are used by both submit.post.ts and upload.post.ts to strip sensitive
 * information (query parameters, fragments) from network request URLs and web
 * vitals navigation URLs before they are persisted in the database and exposed
 * through unauthenticated GET endpoints.
 */

/**
 * Strip query string and fragment from a URL, keeping only scheme + host + path.
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`
  } catch {
    // Not a valid absolute URL — return as-is (relative paths, data URIs, etc.)
    return url
  }
}

/**
 * Sanitize an array of network request objects by stripping query params from each URL.
 */
export function sanitizeNetworkRequests(
  requests: Array<Record<string, unknown>> | null | undefined
): Array<Record<string, unknown>> | null {
  if (!requests || !Array.isArray(requests)) return null
  return requests.map(req => ({
    ...req,
    url: typeof req.url === 'string' ? sanitizeUrl(req.url) : req.url
  }))
}

/**
 * Sanitize webVitals by stripping the query string from the navigation URL.
 */
export function sanitizeWebVitals(vitals: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!vitals || typeof vitals !== 'object') return null
  const nav = vitals.navigation as Record<string, unknown> | null | undefined
  if (!nav) return vitals
  return {
    ...vitals,
    navigation: {
      ...nav,
      url: typeof nav.url === 'string' ? sanitizeUrl(nav.url) : nav.url
    }
  }
}
