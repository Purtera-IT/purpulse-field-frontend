import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  authManager: {
    getAccessToken: vi.fn(),
  },
}))

import { authManager } from '@/lib/auth'
import { APIClient } from '@/api/client'

describe('APIClient.getAssignments (Option A)', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.stubEnv('VITE_USE_ASSIGNMENTS_API', 'true')
    vi.stubEnv('VITE_AZURE_API_BASE_URL', 'https://api-test.purpulse.app')
    vi.mocked(authManager.getAccessToken).mockResolvedValue('test-jwt')
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        assignments: [
          {
            job_id: 'job-1',
            title: 'T',
            runbook_version: '1',
            runbook_json: { phases: [] },
            evidence_requirements: [],
          },
        ],
      }),
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    globalThis.fetch = originalFetch
    vi.clearAllMocks()
  })

  it('returns [] when VITE_USE_ASSIGNMENTS_API is not true', async () => {
    vi.stubEnv('VITE_USE_ASSIGNMENTS_API', 'false')
    const client = new APIClient()
    const out = await client.getAssignments('550e8400-e29b-41d4-a716-446655440000')
    expect(out).toEqual([])
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('calls GET /api/assignments with bearer token and parses assignments', async () => {
    const client = new APIClient()
    const id = '550e8400-e29b-41d4-a716-446655440000'
    const out = await client.getAssignments(id)

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `https://api-test.purpulse.app/api/assignments?assigned_to=${encodeURIComponent(id)}`,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-jwt',
        }),
      })
    )
    expect(out).toHaveLength(1)
    expect(out[0].job_id).toBe('job-1')
  })
})

describe('APIClient.getTechnicianMe (Option A)', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.stubEnv('VITE_USE_ASSIGNMENTS_API', 'true')
    vi.stubEnv('VITE_AZURE_API_BASE_URL', 'https://api-test.purpulse.app')
    vi.mocked(authManager.getAccessToken).mockResolvedValue('test-jwt')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    globalThis.fetch = originalFetch
    vi.clearAllMocks()
  })

  it('returns null when feature flag is off', async () => {
    vi.stubEnv('VITE_USE_ASSIGNMENTS_API', 'false')
    globalThis.fetch = vi.fn() as unknown as typeof fetch
    const client = new APIClient()
    const out = await client.getTechnicianMe()
    expect(out).toBeNull()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('returns null on 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    }) as unknown as typeof fetch
    const client = new APIClient()
    const out = await client.getTechnicianMe()
    expect(out).toBeNull()
  })

  it('parses GET /api/me body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        internal_technician_id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'pat@example.com',
        first_name: 'Pat',
        last_name: 'Smith',
        fieldnation_provider_id: 'fn-1',
      }),
    }) as unknown as typeof fetch
    const client = new APIClient()
    const out = await client.getTechnicianMe()
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api-test.purpulse.app/api/me',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer test-jwt' }),
      })
    )
    expect(out?.internal_technician_id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(out?.first_name).toBe('Pat')
  })
})

describe('APIClient.getJobs (PurPulse assignments)', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.stubEnv('VITE_USE_ASSIGNMENTS_API', 'true')
    vi.stubEnv('VITE_AZURE_API_BASE_URL', 'https://api-test.purpulse.app')
    vi.mocked(authManager.getAccessToken).mockResolvedValue('test-jwt')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    globalThis.fetch = originalFetch
    vi.clearAllMocks()
  })

  it('loads jobs from GET /api/me + GET /api/assignments when assignments API is enabled', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          internal_technician_id: 'tech-uid-1',
          email: 'pat@example.com',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          assignments: [
            {
              job_id: '550e8400-e29b-41d4-a716-446655440099',
              title: 'Site install',
              project_name: 'Q1',
              scheduled_date: '2026-03-01',
              status: 'in_progress',
              fieldnation_workorder_id: 92022,
              site_name: 'Store 1',
              runbook_version: 'none',
              runbook_json: {
                schema: 'runbook_v2',
                execution: {
                  phases: [{ id: 'p1', name: 'Phase', order: 0 }],
                  steps: [
                    {
                      id: 's1',
                      phase_id: 'p1',
                      title: 'Step',
                      order: 0,
                      gate: 'important',
                    },
                  ],
                },
              },
              evidence_requirements: [],
              debug: { reason_code: null },
            },
          ],
        }),
      }) as unknown as typeof fetch

    const client = new APIClient()
    const jobs = await client.getJobs()
    expect(jobs).toHaveLength(1)
    expect(jobs[0].id).toBe('550e8400-e29b-41d4-a716-446655440099')
    expect(jobs[0].assignment_source).toBe('purpulse_api')
    expect(jobs[0].runbook_phases?.length).toBeGreaterThan(0)
  })
})
