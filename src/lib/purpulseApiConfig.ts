/**
 * PurPulse assignments API wiring: direct Azure URL (Vite build) vs Base44 server proxy (Secrets).
 * See base44/functions/purpulseAssignmentsProxy/entry.ts
 */

function trim(s: string | undefined): string {
  return typeof s === 'string' ? s.trim() : ''
}

/** True when jobs should load from GET /api/me + /api/assignments (direct or proxy). */
export function isPurpulseAssignmentsDataSource(): boolean {
  if (import.meta.env.VITE_USE_ASSIGNMENTS_API !== 'true') return false
  if (trim(import.meta.env.VITE_AZURE_API_BASE_URL).length > 0) return true
  return import.meta.env.VITE_USE_PURPULSE_ASSIGNMENTS_PROXY === 'true'
}

/**
 * Full URL for browser fetch. Direct mode: https://api-test.../api/me.
 * Proxy mode: same-origin path e.g. /mock/api/purpulse/me (no host — use relative fetch).
 */
export function purpulseFetchUrl(pathAndQuery: string): string {
  const direct = trim(import.meta.env.VITE_AZURE_API_BASE_URL).replace(/\/$/, '')
  const pq = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`

  if (direct) {
    return `${direct}${pq}`
  }

  if (import.meta.env.VITE_USE_PURPULSE_ASSIGNMENTS_PROXY === 'true') {
    const prefix = trim(import.meta.env.VITE_PURPULSE_PROXY_PATH) || '/mock/api/purpulse'
    const base = prefix.replace(/\/$/, '')
    if (pq.startsWith('/api/me')) return `${base}/me`
    if (pq.startsWith('/api/assignments')) {
      const q = pq.includes('?') ? pq.slice(pq.indexOf('?')) : ''
      return `${base}/assignments${q}`
    }
  }

  return ''
}
