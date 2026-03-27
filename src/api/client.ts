import axios, { AxiosInstance, AxiosError } from 'axios'
import { z } from 'zod'
import {
  JobSchema,
  TechnicianSchema,
  EvidenceSchema,
  LabelRecordSchema,
  TimeEntrySchema,
  MeetingSchema,
  AuthResponseSchema,
  AssignmentsListResponseSchema,
  TechnicianMeResponseSchema,
  type Job,
  type Technician,
  type Evidence,
  type LabelRecord,
  type TimeEntry,
  type Meeting,
  type AuthResponse,
  type ResolvedAssignment,
  type TechnicianMe,
} from './types'
import { base44 } from '@/api/base44Client'
import { authManager } from '@/lib/auth'
import { assignmentToJob } from '@/lib/assignments/assignmentToJob'
import { isPurpulseAssignmentsDataSource, purpulseFetchUrl } from '@/lib/purpulseApiConfig'

/**
 * APIClient — Centralized API adapter with retry logic, validation, and typed responses
 * Integrates with Base44 entities SDK and provides consistent error handling
 */

interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

interface RequestConfig {
  signal?: AbortSignal
  /** Merge Dexie-cached runbook progress when hydrating PurPulse assignments */
  mergeCachedJob?: Job | null
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
}

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'DELETE', 'PUT'])

/**
 * Validate response against Zod schema and log validation errors
 */
/** Prefer Entra MSAL token for Azure API when hybrid flag is on; else Base44. */
async function getBearerTokenForAzureApi(): Promise<string | null> {
  if (import.meta.env.VITE_USE_ENTRA_TOKEN_FOR_AZURE_API === 'true') {
    try {
      const { getEntraAccessTokenForAzureApi } = await import('@/lib/entraTechnicianMsal')
      const token = await getEntraAccessTokenForAzureApi()
      if (token) return token
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[API] Entra token for Azure API unavailable', e)
      }
    }
  }
  return authManager.getAccessToken()
}

function usePurpulseAssignmentsApi(): boolean {
  return isPurpulseAssignmentsDataSource()
}

function validateResponse<T>(data: unknown, schema: z.ZodSchema<T>, endpoint: string): T {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(`[API] Validation error for ${endpoint}:`, error.errors)
      // Return unvalidated data as fallback (log only)
      return data as T
    }
    throw error
  }
}

/**
 * Calculate exponential backoff with jitter
 */
function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt)
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs)
  const jitter = cappedDelay * 0.1 * Math.random()
  return cappedDelay + jitter
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: AxiosError, method?: string): boolean {
  // Network errors are retryable
  if (!error.response) return true

  // Only retry idempotent methods
  if (method && !IDEMPOTENT_METHODS.has(method)) return false

  return RETRYABLE_STATUS_CODES.has(error.response.status)
}

/**
 * Retry logic decorator
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  endpoint: string,
  method: string = 'GET',
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      const axiosError = error as AxiosError

      if (attempt < config.maxRetries && isRetryableError(axiosError, method)) {
        const delay = calculateBackoffDelay(attempt, config)
        console.warn(
          `[API] Retry ${attempt + 1}/${config.maxRetries} ${method} ${endpoint} after ${delay.toFixed(0)}ms`
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }

      // Don't retry further
      break
    }
  }

  console.error(`[API] Failed after ${config.maxRetries} retries: ${endpoint}`, lastError)
  throw lastError
}

/**
 * Main APIClient class
 */
export class APIClient {
  private axios: AxiosInstance
  private retryConfig: RetryConfig

  constructor(retryConfig: Partial<RetryConfig> = {}) {
   this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig }

   // Use mock API in development, real API in production
   const baseURL = process.env.NODE_ENV === 'development'
     ? '/api'
     : process.env.REACT_APP_API_BASE_URL || 'https://api.purpulse.local'

   this.axios = axios.create({
     baseURL,
     timeout: 30000,
   })

   this.setupInterceptors()
  }

  /**
   * Setup axios interceptors for logging and error handling
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.axios.interceptors.request.use((config) => {
      console.debug(`[API] ${config.method?.toUpperCase()} ${config.url}`)
      return config
    })

    // Response interceptor
    this.axios.interceptors.response.use(
      (response) => {
        console.debug(`[API] Response (${response.status}): ${response.config.url}`)
        return response
      },
      (error) => {
        const axiosError = error as AxiosError
        console.error(`[API] Error: ${axiosError.config?.method?.toUpperCase()} ${axiosError.config?.url}`, {
          status: axiosError.response?.status,
          message: axiosError.message,
        })
        return Promise.reject(error)
      }
    )
  }

  /**
   * GET /jobs — List jobs: PurPulse assignments API when enabled, else Base44 (or dev axios).
   */
  async getJobs(config?: RequestConfig): Promise<Job[]> {
    if (usePurpulseAssignmentsApi()) {
      const me = await this.getTechnicianMe(config)
      if (!me) {
        if (import.meta.env.DEV) {
          console.warn('[API] getJobs: assignments API on but GET /api/me returned null — no jobs')
        }
        return []
      }
      const email =
        me.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(me.email) ? me.email : 'technician@field.local'
      const assignments = await this.getAssignments(me.internal_technician_id, config)
      return assignments.map((a) => assignmentToJob(a, { technicianEmail: email }))
    }

    if (process.env.NODE_ENV === 'development') {
      return withRetry(
        async () => {
          const response = await this.axios.get<Job[]>('/jobs')
          return response.data.map((job) => validateResponse(job, JobSchema, 'GET /jobs'))
        },
        'GET /jobs',
        'GET',
        this.retryConfig
      )
    }

    return withRetry(
      async () => {
        const jobs = await base44.entities.Job.list('-scheduled_date', 100)
        return jobs.map((job) => validateResponse(job, JobSchema, 'GET /jobs'))
      },
      'GET /jobs',
      'GET',
      this.retryConfig
    )
  }

  /**
   * GET /jobs/:id — Single job: match PurPulse assignment by work order UUID when API enabled.
   */
  async getJob(jobId: string, config?: RequestConfig): Promise<Job | null> {
    if (usePurpulseAssignmentsApi()) {
      const me = await this.getTechnicianMe(config)
      if (!me) return null
      const email =
        me.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(me.email) ? me.email : 'technician@field.local'
      const assignments = await this.getAssignments(me.internal_technician_id, config)
      const a = assignments.find((x) => x.job_id === jobId)
      if (a) {
        return assignmentToJob(a, {
          technicianEmail: email,
          mergeCachedJob: config?.mergeCachedJob ?? null,
        })
      }
      return null
    }

    if (process.env.NODE_ENV === 'development') {
      return withRetry(
        async () => {
          const response = await this.axios.get<Job>(`/jobs/${jobId}`)
          return validateResponse(response.data, JobSchema, `GET /jobs/${jobId}`)
        },
        `GET /jobs/${jobId}`,
        'GET',
        this.retryConfig
      )
    }

    return withRetry(
      async () => {
        const jobs = await base44.entities.Job.filter({ id: jobId })
        return jobs.length > 0 ? validateResponse(jobs[0], JobSchema, `GET /jobs/${jobId}`) : null
      },
      `GET /jobs/${jobId}`,
      'GET',
      this.retryConfig
    )
  }

  /**
   * GET /api/assignments — Resolved jobs + runbook for an internal technician (Option A).
   * Requires `VITE_USE_ASSIGNMENTS_API=true` plus either `VITE_AZURE_API_BASE_URL` (direct) or
   * `VITE_USE_PURPULSE_ASSIGNMENTS_PROXY=true` (Base44 function proxy); otherwise returns [].
   */
  async getAssignments(
    assignedToInternalId: string,
    config?: RequestConfig
  ): Promise<ResolvedAssignment[]> {
    if (!assignedToInternalId?.trim()) {
      return []
    }
    if (!isPurpulseAssignmentsDataSource()) {
      return []
    }

    const token = await getBearerTokenForAzureApi()
    if (!token) {
      if (import.meta.env.DEV) {
        console.warn('[API] getAssignments: no access token')
      }
      return []
    }

    const url = purpulseFetchUrl(
      `/api/assignments?assigned_to=${encodeURIComponent(assignedToInternalId.trim())}`,
    )
    if (!url) {
      return []
    }
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: config?.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(
        `GET /api/assignments failed: ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ''}`
      )
    }

    const data: unknown = await res.json().catch(() => ({}))
    const parsed = AssignmentsListResponseSchema.safeParse(data)
    if (!parsed.success) {
      console.error('[API] getAssignments: response shape', parsed.error.flatten())
      return []
    }
    return parsed.data.assignments
  }

  /**
   * GET /api/me — Resolve JWT to technicians row (email / idp_subject).
   * Same env as getAssignments (direct Azure URL or proxy). Returns null if not provisioned (404) or feature off.
   */
  async getTechnicianMe(config?: RequestConfig): Promise<TechnicianMe | null> {
    if (!isPurpulseAssignmentsDataSource()) {
      return null
    }

    const token = await getBearerTokenForAzureApi()
    if (!token) {
      return null
    }

    const url = purpulseFetchUrl('/api/me')
    if (!url) {
      return null
    }
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: config?.signal,
    })

    if (res.status === 404) {
      return null
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(
        `GET /api/me failed: ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ''}`
      )
    }

    const data: unknown = await res.json().catch(() => ({}))
    return validateResponse(data, TechnicianMeResponseSchema, 'GET /api/me')
  }

  /**
   * GET /api/me then GET /api/assignments — runbooks for the logged-in technician.
   */
  async getResolvedAssignmentsForCurrentUser(config?: RequestConfig): Promise<ResolvedAssignment[]> {
    const me = await this.getTechnicianMe(config)
    if (!me) {
      return []
    }
    return this.getAssignments(me.internal_technician_id, config)
  }

  /**
   * GET /technicians — List all technicians
   */
  async getTechnicians(config?: RequestConfig): Promise<Technician[]> {
    return withRetry(
      async () => {
        const techs = await base44.entities.Technician.list('name', 100)
        return techs.map((tech) => validateResponse(tech, TechnicianSchema, 'GET /technicians'))
      },
      'GET /technicians',
      'GET',
      this.retryConfig
    )
  }

  /**
   * GET /evidence — List evidence for a job
   */
  async getEvidence(jobId: string, limit = 200, config?: RequestConfig): Promise<Evidence[]> {
    if (process.env.NODE_ENV === 'development') {
      return withRetry(
        async () => {
          const response = await this.axios.get<Evidence[]>(`/jobs/${jobId}/evidence`)
          return response.data.map((e) => validateResponse(e, EvidenceSchema, `GET /jobs/${jobId}/evidence`))
        },
        `GET /jobs/${jobId}/evidence`,
        'GET',
        this.retryConfig
      )
    }

    return withRetry(
      async () => {
        const evidence = await base44.entities.Evidence.filter({ job_id: jobId }, '-captured_at', limit)
        return evidence.map((e) => validateResponse(e, EvidenceSchema, `GET /evidence?job_id=${jobId}`))
      },
      `GET /evidence?job_id=${jobId}`,
      'GET',
      this.retryConfig
    )
  }

  /**
   * GET /labels — List labels for a job
   */
  async getLabels(jobId: string, limit = 200, config?: RequestConfig): Promise<LabelRecord[]> {
    if (process.env.NODE_ENV === 'development') {
      // Mock labels endpoint not yet implemented, return empty for now
      return []
    }

    return withRetry(
      async () => {
        const labels = await base44.entities.LabelRecord.filter({ job_id: jobId }, '-labeled_at', limit)
        return labels.map((label) => validateResponse(label, LabelRecordSchema, `GET /labels?job_id=${jobId}`))
      },
      `GET /labels?job_id=${jobId}`,
      'GET',
      this.retryConfig
    )
  }

  /**
   * GET /time-entries — List time entries for a job
   */
  async getTimeEntries(jobId: string, limit = 100, config?: RequestConfig): Promise<TimeEntry[]> {
    return withRetry(
      async () => {
        const entries = await base44.entities.TimeEntry.filter({ job_id: jobId }, '-timestamp', limit)
        return entries.map((entry) => validateResponse(entry, TimeEntrySchema, `GET /time-entries?job_id=${jobId}`))
      },
      `GET /time-entries?job_id=${jobId}`,
      'GET',
      this.retryConfig
    )
  }

  /**
   * GET /meetings — List meetings for a job
   */
  async getMeetings(jobId: string, limit = 50, config?: RequestConfig): Promise<Meeting[]> {
    if (process.env.NODE_ENV === 'development') {
      // Mock meetings endpoint not yet implemented, return empty for now
      return []
    }

    return withRetry(
      async () => {
        const meetings = await base44.entities.Meeting.filter({ job_id: jobId }, '-scheduled_at', limit)
        return meetings.map((meeting) => validateResponse(meeting, MeetingSchema, `GET /meetings?job_id=${jobId}`))
      },
      `GET /meetings?job_id=${jobId}`,
      'GET',
      this.retryConfig
    )
  }

  /**
   * POST /jobs/:id/status — Update job status (with retry for PUT)
   */
  async updateJobStatus(jobId: string, status: Job['status']): Promise<Job> {
    return withRetry(
      async () => {
        const updated = await base44.entities.Job.update(jobId, { status })
        return validateResponse(updated, JobSchema, `PUT /jobs/${jobId}/status`)
      },
      `PUT /jobs/${jobId}/status`,
      'PUT',
      this.retryConfig
    )
  }

  /**
   * POST /time-entries — Create a time entry
   */
  async createTimeEntry(jobId: string, data: Omit<TimeEntry, keyof typeof BaseEntity>): Promise<TimeEntry> {
    return withRetry(
      async () => {
        const entry = await base44.entities.TimeEntry.create({
          job_id: jobId,
          ...data,
        })
        return validateResponse(entry, TimeEntrySchema, 'POST /time-entries')
      },
      'POST /time-entries',
      'POST',
      this.retryConfig
    )
  }

  /**
   * POST /labels — Create a label record
   */
  async createLabel(data: Omit<LabelRecord, keyof typeof BaseEntity>): Promise<LabelRecord> {
    return withRetry(
      async () => {
        const label = await base44.entities.LabelRecord.create(data)
        return validateResponse(label, LabelRecordSchema, 'POST /labels')
      },
      'POST /labels',
      'POST',
      this.retryConfig
    )
  }
}

// Export singleton instance
export const apiClient = new APIClient()

// Export types for use in components
export {
  type Job,
  type Technician,
  type Evidence,
  type LabelRecord,
  type TimeEntry,
  type Meeting,
  type AuthResponse,
  type ResolvedAssignment,
  type TechnicianMe,
}