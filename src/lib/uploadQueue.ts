/**
 * uploadQueue.ts — Resumable upload queue with chunking and exponential backoff
 * Supports interruption + resume, tracks progress per chunk, and retries failed chunks
 */

import { db } from '@/lib/db'

/**
 * Upload metadata
 */
export interface UploadMetadata {
  jobId: string
  fileName: string
  mimeType: string
  fileSize: number
  technician: {
    id: string
    email: string
    name: string
  }
  geolocation?: {
    latitude: number
    longitude: number
    accuracy: number
  }
  timestamp: number // when upload was initiated
}

/**
 * Represents a single chunk in the upload
 */
export interface UploadChunk {
  chunkIndex: number
  chunkSize: number
  offset: number
  data: Blob
  status: 'pending' | 'uploading' | 'completed' | 'failed'
  retryCount: number
  lastError?: string
}

/**
 * Represents a file upload session
 */
export interface UploadSession {
  id: string // sessionId for resumable upload
  metadata: UploadMetadata
  chunks: UploadChunk[]
  totalChunks: number
  uploadedBytes: number
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed'
  createdAt: number
  completedAt?: number
  error?: string
}

const DEFAULT_CHUNK_SIZE = 1024 * 1024 // 1MB chunks
const MAX_RETRIES = 5
const INITIAL_BACKOFF_MS = 1000
const BACKOFF_MULTIPLIER = 2
const MAX_BACKOFF_MS = 30000

/**
 * Calculate exponential backoff with jitter
 */
function getBackoffDelay(retryCount: number): number {
  const exponentialDelay = INITIAL_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, retryCount)
  const cappedDelay = Math.min(exponentialDelay, MAX_BACKOFF_MS)
  const jitter = cappedDelay * 0.1 * Math.random()
  return cappedDelay + jitter
}

/**
 * Upload Queue Manager
 */
export class UploadQueueManager {
  private sessions = new Map<string, UploadSession>()
  private uploadCallbacks = new Map<
    string,
    {
      onProgress?: (progress: number) => void
      onChunkComplete?: (chunkIndex: number) => void
      onComplete?: (sessionId: string) => void
      onError?: (error: string) => void
    }
  >()

  /**
   * Create a new upload session
   */
  async createSession(file: File, metadata: Omit<UploadMetadata, 'fileSize' | 'timestamp'>): Promise<string> {
    const sessionId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const totalChunks = Math.ceil(file.size / DEFAULT_CHUNK_SIZE)
    const chunks: UploadChunk[] = []

    // Create chunks
    for (let i = 0; i < totalChunks; i++) {
      const offset = i * DEFAULT_CHUNK_SIZE
      const chunkSize = Math.min(DEFAULT_CHUNK_SIZE, file.size - offset)
      const chunkBlob = file.slice(offset, offset + chunkSize)

      chunks.push({
        chunkIndex: i,
        chunkSize,
        offset,
        data: chunkBlob,
        status: 'pending',
        retryCount: 0,
      })
    }

    const session: UploadSession = {
      id: sessionId,
      metadata: {
        ...metadata,
        fileSize: file.size,
        timestamp: Date.now(),
      },
      chunks,
      totalChunks,
      uploadedBytes: 0,
      status: 'pending',
      createdAt: Date.now(),
    }

    this.sessions.set(sessionId, session)

    // Persist to IndexedDB
    await db.uploadQueue.add({
      jobId: metadata.jobId,
      evidenceId: sessionId,
      filePath: file.name,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      timestamp: Date.now(),
      syncStatus: 'pending',
      retryCount: 0,
    })

    return sessionId
  }

  /**
   * Get upload progress (0-100)
   */
  getProgress(sessionId: string): number {
    const session = this.sessions.get(sessionId)
    if (!session) return 0
    return Math.round((session.uploadedBytes / session.metadata.fileSize) * 100)
  }

  /**
   * Get session details
   */
  getSession(sessionId: string): UploadSession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * Register callbacks for upload events
   */
  on(
    sessionId: string,
    callbacks: {
      onProgress?: (progress: number) => void
      onChunkComplete?: (chunkIndex: number) => void
      onComplete?: (sessionId: string) => void
      onError?: (error: string) => void
    }
  ): void {
    this.uploadCallbacks.set(sessionId, callbacks)
  }

  /**
   * Start uploading a session
   */
  async upload(sessionId: string, uploadFn: (chunk: UploadChunk) => Promise<void>): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Upload session ${sessionId} not found`)

    session.status = 'uploading'
    const callbacks = this.uploadCallbacks.get(sessionId)

    for (const chunk of session.chunks) {
      if (chunk.status === 'completed') continue

      chunk.status = 'uploading'

      let lastError: string | undefined
      while (chunk.retryCount < MAX_RETRIES) {
        try {
          await uploadFn(chunk)
          chunk.status = 'completed'
          session.uploadedBytes += chunk.chunkSize
          callbacks?.onChunkComplete?.(chunk.chunkIndex)
          callbacks?.onProgress?.(this.getProgress(sessionId))
          break
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Unknown error'
          chunk.retryCount++

          if (chunk.retryCount >= MAX_RETRIES) {
            chunk.status = 'failed'
            chunk.lastError = lastError
            session.status = 'failed'
            session.error = `Chunk ${chunk.chunkIndex} failed after ${MAX_RETRIES} retries: ${lastError}`
            callbacks?.onError?.(session.error)
            return
          }

          // Exponential backoff
          const delay = getBackoffDelay(chunk.retryCount - 1)
          console.warn(
            `[UploadQueue] Chunk ${chunk.chunkIndex} failed, retry ${chunk.retryCount}/${MAX_RETRIES} after ${delay.toFixed(0)}ms`,
            error
          )
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    // All chunks uploaded successfully
    session.status = 'completed'
    session.completedAt = Date.now()
    callbacks?.onComplete?.(sessionId)

    // Mark as synced in IndexedDB
    const queueItem = await db.uploadQueue.where('evidenceId').equals(sessionId).first()
    if (queueItem) {
      await db.uploadQueue.update(queueItem.id!, { syncStatus: 'synced' })
    }
  }

  /**
   * Pause an upload session
   */
  pause(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.status = 'paused'
    }
  }

  /**
   * Resume a paused session
   */
  async resume(sessionId: string, uploadFn: (chunk: UploadChunk) => Promise<void>): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Upload session ${sessionId} not found`)

    // Resume from where we left off
    await this.upload(sessionId, uploadFn)
  }

  /**
   * Cancel an upload session
   */
  cancel(sessionId: string): void {
    this.sessions.delete(sessionId)
    this.uploadCallbacks.delete(sessionId)
  }

  /**
   * Get all active sessions for a job
   */
  getJobUploads(jobId: string): UploadSession[] {
    return Array.from(this.sessions.values()).filter(s => s.metadata.jobId === jobId)
  }

  /**
   * Get retry-able chunks (failed, not exceeded max retries)
   */
  getRetryableChunks(sessionId: string): UploadChunk[] {
    const session = this.sessions.get(sessionId)
    if (!session) return []
    return session.chunks.filter(c => c.status === 'failed' && c.retryCount < MAX_RETRIES)
  }
}

/**
 * Global upload queue instance
 */
export const uploadQueue = new UploadQueueManager()