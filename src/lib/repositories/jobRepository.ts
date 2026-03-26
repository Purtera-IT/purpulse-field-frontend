/**
 * jobRepository.ts — Repository abstraction for job data
 * Handles local cache, queued edits, and upload queue management
 */

import { db, type JobSnapshot, type QueuedEdit, type UploadQueueItem } from '@/lib/db'
import { apiClient, type Job, type Evidence } from '@/api/client'

export class JobRepository {
  /**
   * Get a job from cache or network
   * Falls back to network if cache miss
   */
  async getJob(jobId: string): Promise<Job | null> {
    // Try to load from local cache first
    const snapshot = await db.jobs.where('jobId').equals(jobId).last()

    // If we have a recent cache (< 5 minutes), return it
    if (snapshot) {
      const age = Date.now() - snapshot.timestamp
      if (age < 5 * 60 * 1000) {
        return snapshot.data
      }
    }

    // Otherwise fetch from network
    try {
      const job = await apiClient.getJob(jobId, { mergeCachedJob: snapshot?.data ?? null })
      if (job) {
        // Cache the result
        await db.jobs.add({
          jobId,
          data: job,
          timestamp: Date.now(),
          source: 'network',
        })
      }
      return job
    } catch (error) {
      // Network error - fall back to cached data if available
      console.warn(`[JobRepository] Failed to fetch job ${jobId} from network, using cache`, error)
      return snapshot?.data || null
    }
  }

  /**
   * Save a job snapshot locally
   */
  async saveJobSnapshot(job: Job): Promise<void> {
    await db.jobs.add({
      jobId: job.id,
      data: job,
      timestamp: Date.now(),
      source: 'local',
    })
  }

  /**
   * Queue an edit to be synced later
   */
  async queueEdit(jobId: string, operation: QueuedEdit['operation'], data: Record<string, any>): Promise<number> {
    const id = await db.editQueue.add({
      jobId,
      timestamp: Date.now(),
      operation,
      data,
      syncStatus: 'pending',
      retryCount: 0,
    })
    return id
  }

  /**
   * Get all pending edits for a job
   */
  async getPendingEdits(jobId: string): Promise<QueuedEdit[]> {
    return db.editQueue.where('jobId').equals(jobId).toArray()
  }

  /**
   * Mark an edit as synced
   */
  async markEditSynced(editId: number): Promise<void> {
    await db.editQueue.update(editId, { syncStatus: 'synced' })
  }

  /**
   * Mark an edit as failed with error message
   */
  async markEditFailed(editId: number, error: string): Promise<void> {
    await db.editQueue.update(editId, {
      syncStatus: 'failed',
      lastError: error,
      retryCount: (await db.editQueue.get(editId))?.retryCount ?? 0 + 1,
    })
  }

  /**
   * Queue a file upload
   */
  async queueUpload(
    jobId: string,
    evidenceId: string,
    filePath: string,
    fileName: string,
    fileSize: number,
    mimeType: string
  ): Promise<number> {
    return db.uploadQueue.add({
      jobId,
      evidenceId,
      filePath,
      fileName,
      fileSize,
      mimeType,
      timestamp: Date.now(),
      syncStatus: 'pending',
      retryCount: 0,
    })
  }

  /**
   * Get all pending uploads for a job
   */
  async getPendingUploads(jobId: string): Promise<UploadQueueItem[]> {
    return db.uploadQueue.where('jobId').equals(jobId).and(item => item.syncStatus !== 'synced').toArray()
  }

  /**
   * Mark an upload as synced
   */
  async markUploadSynced(uploadId: number): Promise<void> {
    await db.uploadQueue.update(uploadId, { syncStatus: 'synced' })
  }

  /**
   * Mark an upload as failed
   */
  async markUploadFailed(uploadId: number, error: string): Promise<void> {
    const item = await db.uploadQueue.get(uploadId)
    if (item) {
      await db.uploadQueue.update(uploadId, {
        syncStatus: 'failed',
        lastError: error,
        retryCount: item.retryCount + 1,
      })
    }
  }

  /**
   * Drain upload queue — sync all pending uploads
   * Returns { synced: number, failed: number }
   */
  async drainUploadQueue(jobId: string): Promise<{ synced: number; failed: number }> {
    const pending = await db.uploadQueue
      .where('jobId')
      .equals(jobId)
      .and(item => item.syncStatus === 'pending')
      .toArray()

    let synced = 0
    let failed = 0

    for (const item of pending) {
      try {
        // Mark as syncing
        await db.uploadQueue.update(item.id!, { syncStatus: 'syncing' })

        // Upload would happen here in a real implementation
        // For now, just mark as synced
        await db.uploadQueue.update(item.id!, { syncStatus: 'synced' })
        synced++
      } catch (error) {
        failed++
        const msg = error instanceof Error ? error.message : 'Unknown error'
        await this.markUploadFailed(item.id!, msg)
      }
    }

    return { synced, failed }
  }

  /**
   * Drain edit queue — sync all pending edits
   * Returns { synced: number, failed: number }
   */
  async drainEditQueue(jobId: string): Promise<{ synced: number; failed: number }> {
    const pending = await db.editQueue
      .where('jobId')
      .equals(jobId)
      .and(item => item.syncStatus === 'pending')
      .toArray()

    let synced = 0
    let failed = 0

    for (const edit of pending) {
      try {
        // Mark as syncing
        await db.editQueue.update(edit.id!, { syncStatus: 'syncing' })

        // Apply edit based on operation type
        // In a real implementation, this would call the API
        // For now, just mark as synced
        await db.editQueue.update(edit.id!, { syncStatus: 'synced' })
        synced++
      } catch (error) {
        failed++
        const msg = error instanceof Error ? error.message : 'Unknown error'
        await this.markEditFailed(edit.id!, msg)
      }
    }

    return { synced, failed }
  }

  /**
   * Clear old snapshots (older than retention period)
   */
  async clearOldSnapshots(retentionMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = Date.now() - retentionMs
    const toDelete = await db.jobs.where('timestamp').below(cutoff).primaryKeys()
    await db.jobs.bulkDelete(toDelete as number[])
    return toDelete.length
  }

  /**
   * Get database stats for debugging
   */
  async getStats(): Promise<{
    jobSnapshots: number
    pendingEdits: number
    pendingUploads: number
    failedEdits: number
    failedUploads: number
  }> {
    const [jobSnapshots, pendingEdits, pendingUploads, failedEdits, failedUploads] = await Promise.all([
      db.jobs.count(),
      db.editQueue.where('syncStatus').equals('pending').count(),
      db.uploadQueue.where('syncStatus').equals('pending').count(),
      db.editQueue.where('syncStatus').equals('failed').count(),
      db.uploadQueue.where('syncStatus').equals('failed').count(),
    ])

    return { jobSnapshots, pendingEdits, pendingUploads, failedEdits, failedUploads }
  }
}

/**
 * Global repository instance
 */
export const jobRepository = new JobRepository()