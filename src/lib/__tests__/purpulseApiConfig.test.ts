import { describe, it, expect, afterEach, vi } from 'vitest'
import { isPurpulseAssignmentsDataSource, purpulseFetchUrl } from '@/lib/purpulseApiConfig'

describe('purpulseApiConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('direct mode: requires VITE_USE_ASSIGNMENTS_API and VITE_AZURE_API_BASE_URL', () => {
    vi.stubEnv('VITE_USE_ASSIGNMENTS_API', 'true')
    vi.stubEnv('VITE_AZURE_API_BASE_URL', 'https://api-test.purpulse.app')
    expect(isPurpulseAssignmentsDataSource()).toBe(true)
    expect(purpulseFetchUrl('/api/me')).toBe('https://api-test.purpulse.app/api/me')
  })

  it('proxy mode: VITE_USE_PURPULSE_ASSIGNMENTS_PROXY without direct base', () => {
    vi.stubEnv('VITE_USE_ASSIGNMENTS_API', 'true')
    vi.stubEnv('VITE_AZURE_API_BASE_URL', '')
    vi.stubEnv('VITE_USE_PURPULSE_ASSIGNMENTS_PROXY', 'true')
    expect(isPurpulseAssignmentsDataSource()).toBe(true)
    expect(purpulseFetchUrl('/api/me')).toBe('/mock/api/purpulse/me')
    expect(purpulseFetchUrl('/api/assignments?assigned_to=x')).toBe('/mock/api/purpulse/assignments?assigned_to=x')
  })

  it('custom proxy path', () => {
    vi.stubEnv('VITE_USE_ASSIGNMENTS_API', 'true')
    vi.stubEnv('VITE_AZURE_API_BASE_URL', '')
    vi.stubEnv('VITE_USE_PURPULSE_ASSIGNMENTS_PROXY', 'true')
    vi.stubEnv('VITE_PURPULSE_PROXY_PATH', '/api/purpulse')
    expect(purpulseFetchUrl('/api/me')).toBe('/api/purpulse/me')
  })
})
