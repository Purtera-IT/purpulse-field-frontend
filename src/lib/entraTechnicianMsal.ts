/**
 * Optional MSAL (Entra) token path for technicians calling Azure Functions
 * (`GET /api/me`, `GET /api/assignments`). Base44 `authManager` remains the default.
 *
 * Enable with `VITE_USE_ENTRA_TOKEN_FOR_AZURE_API=true` and MSAL env vars below.
 * See `docs/plans/hybrid-entra-technicians.md`.
 */

import type { PublicClientApplication } from '@azure/msal-browser'

let pca: PublicClientApplication | null = null
let initPromise: Promise<PublicClientApplication | null> | null = null

async function getOrCreatePca(): Promise<PublicClientApplication | null> {
  if (import.meta.env.VITE_USE_ENTRA_TOKEN_FOR_AZURE_API !== 'true') return null

  const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID as string | undefined
  const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID as string | undefined
  if (!clientId?.trim() || !tenantId?.trim()) {
    if (import.meta.env.DEV) {
      console.warn('[Entra] Set VITE_ENTRA_CLIENT_ID and VITE_ENTRA_TENANT_ID')
    }
    return null
  }

  if (pca) return pca
  if (initPromise) return initPromise

  initPromise = (async () => {
    const { PublicClientApplication } = await import('@azure/msal-browser')
    const authority =
      (import.meta.env.VITE_ENTRA_AUTHORITY as string) ||
      `https://login.microsoftonline.com/${tenantId}`
    const redirectUri =
      (import.meta.env.VITE_ENTRA_REDIRECT_URI as string) ||
      (typeof window !== 'undefined' ? window.location.origin : '')

    const app = new PublicClientApplication({
      auth: {
        clientId,
        authority,
        redirectUri,
      },
      cache: { cacheLocation: 'localStorage' },
    })
    await app.initialize()
    pca = app
    return app
  })()

  return initPromise
}

/**
 * Returns an access token for `VITE_ENTRA_API_SCOPE` if the user has signed in with MSAL (silent).
 */
export async function getEntraAccessTokenForAzureApi(): Promise<string | null> {
  const app = await getOrCreatePca()
  if (!app) return null

  const scopeRaw = (import.meta.env.VITE_ENTRA_API_SCOPE as string) || ''
  const scopes = scopeRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (scopes.length === 0) {
    if (import.meta.env.DEV) {
      console.warn('[Entra] VITE_ENTRA_API_SCOPE is required for token acquisition')
    }
    return null
  }

  const accounts = app.getAllAccounts()
  if (accounts.length === 0) return null

  try {
    const result = await app.acquireTokenSilent({
      account: accounts[0],
      scopes,
    })
    return result.accessToken
  } catch {
    return null
  }
}

/**
 * Interactive sign-in (popup). Call from a technician-only route or settings.
 */
export async function loginEntraTechnicianInteractive(): Promise<void> {
  const app = await getOrCreatePca()
  if (!app) return

  const scopeRaw = (import.meta.env.VITE_ENTRA_API_SCOPE as string) || ''
  const scopes = scopeRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (scopes.length === 0) return

  await app.loginPopup({ scopes })
}
