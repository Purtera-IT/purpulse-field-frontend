/**
 * auth.ts — Secure token storage, refresh flow, and logout with DB/upload cleanup
 * 
 * Storage abstraction:
 * - Web: localStorage (secure HTTP-only cookies in production)
 * - Native: Keystore (Android), Keychain (iOS) via plugin
 */

export interface StorageProvider {
  getAccessToken(): Promise<string | null>
  setAccessToken(token: string): Promise<void>
  getRefreshToken(): Promise<string | null>
  setRefreshToken(token: string): Promise<void>
  clear(): Promise<void>
}

/**
 * LocalStorage provider (web) — swap for Keystore/Keychain in native
 * In production, use HTTP-only cookies instead
 */
class LocalStorageProvider implements StorageProvider {
  private accessKey = 'purpulse_access_token'
  private refreshKey = 'purpulse_refresh_token'

  async getAccessToken(): Promise<string | null> {
    return localStorage.getItem(this.accessKey)
  }

  async setAccessToken(token: string): Promise<void> {
    localStorage.setItem(this.accessKey, token)
  }

  async getRefreshToken(): Promise<string | null> {
    return localStorage.getItem(this.refreshKey)
  }

  async setRefreshToken(token: string): Promise<void> {
    localStorage.setItem(this.refreshKey, token)
  }

  async clear(): Promise<void> {
    localStorage.removeItem(this.accessKey)
    localStorage.removeItem(this.refreshKey)
  }
}

/**
 * Native Keystore provider (Android) — implements via plugin
 * Usage in native: import SecureStorage from 'react-native-secure-storage'
 */
export class KeystoreProvider implements StorageProvider {
  // Future: implement with react-native-secure-storage
  // const storage = new SecureStorage()
  // await storage.setItem(key, value)
  // const value = await storage.getItem(key)

  async getAccessToken(): Promise<string | null> {
    throw new Error('Keystore provider not implemented in web environment')
  }

  async setAccessToken(token: string): Promise<void> {
    throw new Error('Keystore provider not implemented in web environment')
  }

  async getRefreshToken(): Promise<string | null> {
    throw new Error('Keystore provider not implemented in web environment')
  }

  async setRefreshToken(token: string): Promise<void> {
    throw new Error('Keystore provider not implemented in web environment')
  }

  async clear(): Promise<void> {
    throw new Error('Keystore provider not implemented in web environment')
  }
}

/**
 * Native Keychain provider (iOS) — implements via plugin
 * Usage in native: import * as Keychain from 'react-native-keychain'
 */
export class KeychainProvider implements StorageProvider {
  // Future: implement with react-native-keychain
  // await Keychain.setGenericPassword('purpulse', token, { service: 'access_token' })
  // const creds = await Keychain.getGenericPassword({ service: 'access_token' })

  async getAccessToken(): Promise<string | null> {
    throw new Error('Keychain provider not implemented in web environment')
  }

  async setAccessToken(token: string): Promise<void> {
    throw new Error('Keychain provider not implemented in web environment')
  }

  async getRefreshToken(): Promise<string | null> {
    throw new Error('Keychain provider not implemented in web environment')
  }

  async setRefreshToken(token: string): Promise<void> {
    throw new Error('Keychain provider not implemented in web environment')
  }

  async clear(): Promise<void> {
    throw new Error('Keychain provider not implemented in web environment')
  }
}

export interface RefreshResponse {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
}

export interface AuthConfig {
  refreshEndpoint: string
  onTokenRefreshed?: (response: RefreshResponse) => void
  onRefreshFailed?: (error: Error) => void
}

/**
 * AuthManager — Token lifecycle management
 * Handles storage abstraction, refresh flow, and logout cleanup
 */
export class AuthManager {
  private storage: StorageProvider
  private config: AuthConfig
  private isRefreshing = false
  private refreshPromise: Promise<RefreshResponse> | null = null

  constructor(storage: StorageProvider, config: AuthConfig) {
    this.storage = storage
    this.config = config
  }

  /**
   * Store tokens after login
   */
  async setTokens(accessToken: string, refreshToken?: string): Promise<void> {
    await this.storage.setAccessToken(accessToken)
    if (refreshToken) {
      await this.storage.setRefreshToken(refreshToken)
    }
  }

  /**
   * Get current access token
   */
  async getAccessToken(): Promise<string | null> {
    return this.storage.getAccessToken()
  }

  /**
   * Refresh expired access token
   * Returns new tokens and triggers callback
   */
  async refreshAccessToken(): Promise<RefreshResponse> {
    // Prevent concurrent refresh requests
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise
    }

    this.isRefreshing = true

    try {
      const refreshToken = await this.storage.getRefreshToken()
      if (!refreshToken) {
        throw new Error('No refresh token available')
      }

      this.refreshPromise = this._performRefresh(refreshToken)
      const response = await this.refreshPromise

      // Store new tokens
      await this.setTokens(response.accessToken, response.refreshToken)

      // Notify listeners
      this.config.onTokenRefreshed?.(response)

      return response
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      this.config.onRefreshFailed?.(err)
      throw err
    } finally {
      this.isRefreshing = false
      this.refreshPromise = null
    }
  }

  /**
   * Perform actual refresh request
   */
  private async _performRefresh(refreshToken: string): Promise<RefreshResponse> {
    const response = await fetch(this.config.refreshEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Logout: clear tokens, local DB, and queued uploads
   */
  async logout(): Promise<void> {
    // Clear storage
    await this.storage.clear()

    // Clear local IndexedDB (jobs, evidence, etc.)
    try {
      const { db } = await import('@/lib/db')
      await db.jobs.clear()
      await db.evidence.clear()
      await db.queuedEdits.clear()
      await db.syncQueue.clear()
    } catch (err) {
      console.warn('[Auth] Failed to clear local DB:', err)
    }

    // Clear upload queue
    try {
      const { uploadQueue } = await import('@/lib/uploadQueue')
      uploadQueue.clear()
    } catch (err) {
      console.warn('[Auth] Failed to clear upload queue:', err)
    }
  }

  /**
   * Check if token is expired (basic JWT decode)
   */
  async isTokenExpired(): Promise<boolean> {
    const token = await this.getAccessToken()
    if (!token) return true

    try {
      const parts = token.split('.')
      if (parts.length !== 3) return true

      const payload = JSON.parse(atob(parts[1]))
      const expiresAt = (payload.exp || 0) * 1000
      return Date.now() > expiresAt
    } catch {
      return true
    }
  }
}

// Export singleton instance
export const storage = new LocalStorageProvider()
export const authManager = new AuthManager(storage, {
  refreshEndpoint: '/api/auth/refresh',
  onTokenRefreshed: (response) => {
    console.debug('[Auth] Token refreshed successfully')
  },
  onRefreshFailed: (error) => {
    console.error('[Auth] Token refresh failed:', error)
  },
})