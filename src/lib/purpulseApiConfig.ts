/**
 * PurPulse assignments API wiring: direct Azure URL (Vite build) vs Base44 server proxy (Secrets).
 * See base44/functions/purpulseAssignmentsProxy/entry.ts
 */

function trim(s: string | undefined): string {
  return typeof s === 'string' ? s.trim() : ''
}

/** True when jobs should load from GET /api/me + /api/assignments (direct or proxy). */
export function isPurpulseAssignmentsDataSource(): boolean {
  // Base44 Secrets don't inject into import.meta.env, so proxy mode is always on in production.
  // Override with VITE_USE_ASSIGNMENTS_API=false to disable (local dev against Base44 entities).
  if (import.meta.env.VITE_USE_ASSIGNMENTS_API === 'false') return false
  if (trim(import.meta.env.VITE_AZURE_API_BASE_URL).length > 0) return true
  return true // proxy mode always on in Base44 hosted builds
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

  // Proxy is always active on Base44 hosted builds (no VITE_ env at runtime)
  if (true || import.meta.env.VITE_USE_PURPULSE_ASSIGNMENTS_PROXY === 'true') {
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