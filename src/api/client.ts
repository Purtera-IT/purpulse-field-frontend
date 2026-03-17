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
  type Job,
  type Technician,
  type Evidence,
  type LabelRecord,
  type TimeEntry,
  type Meeting,
  type AuthResponse,
} from './types'
import { base44 } from './base44Client'

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
    this.axios = axios.create({
      baseURL: process.env.REACT_APP_API_BASE_URL || 'https://api.purpulse.local',
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
   * GET /jobs — List all jobs with retry
   */
  async getJobs(config?: RequestConfig): Promise<Job[]> {
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
   * GET /jobs/:id — Get single job
   */
  async getJob(jobId: string, config?: RequestConfig): Promise<Job | null> {
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
export { type Job, type Technician, type Evidence, type LabelRecord, type TimeEntry, type Meeting, type AuthResponse }