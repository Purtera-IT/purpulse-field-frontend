/**
 * db.ts — Dexie database setup for offline-first field operations
 * Tables: jobs, editQueue, uploadQueue, snapshots
 */

import Dexie, { type Table } from 'dexie'
import type { Job, Evidence } from '@/api/types'

/**
 * Represents a queued edit to a job (offline)
 */
export interface QueuedEdit {
  id?: number
  jobId: string
  timestamp: number // when the edit was queued
  operation: 'status_change' | 'add_note' | 'mark_step_complete' | 'other'
  data: Record<string, any>
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed'
  lastError?: string
  retryCount: number
}

/**
 * Represents a queued file upload
 */
export interface UploadQueueItem {
  id?: number
  jobId: string
  evidenceId: string
  filePath: string
  fileName: string
  fileSize: number
  mimeType: string
  timestamp: number
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed'
  lastError?: string
  retryCount: number
}

/**
 * Job snapshot stored locally (cached copy of server data)
 */
export interface JobSnapshot {
  id?: number
  jobId: string
  data: Job
  timestamp: number // when this snapshot was created
  source: 'network' | 'local' // where this data came from
}

/**
 * Evidence snapshot stored locally
 */
export interface EvidenceSnapshot {
  id?: number
  jobId: string
  data: Evidence
  timestamp: number
}

/**
 * Dexie Database
 */
export class PurpulseDB extends Dexie {
  jobs!: Table<JobSnapshot>
  evidence!: Table<EvidenceSnapshot>
  editQueue!: Table<QueuedEdit>
  uploadQueue!: Table<UploadQueueItem>

  constructor() {
    super('purpulse-field-db')
    this.version(1).stores({
      jobs: '++id, jobId, timestamp',
      evidence: '++id, jobId, timestamp',
      editQueue: '++id, jobId, syncStatus, timestamp',
      uploadQueue: '++id, jobId, syncStatus, timestamp',
    })
    // evidenceId index required for db.uploadQueue.where('evidenceId') (upload completion sync)
    this.version(2).stores({
      uploadQueue: '++id, jobId, evidenceId, syncStatus, timestamp',
    })
  }
}

/**
 * Global database instance
 */
export const db = new PurpulseDB()