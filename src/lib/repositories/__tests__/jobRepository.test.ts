/**
 * @vitest-environment jsdom
 *
 * jobRepository.test.ts — Integration test for offline-first job caching
 * Tests: add → offline edit → sync path
 */
import 'fake-indexeddb/auto'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { db, PurpulseDB } from '@/lib/db'
import { jobRepository } from '@/lib/repositories/jobRepository'
import type { Job } from '@/api/types'

// Mock job data
const mockJob: Job = {
  id: 'job-001',
  external_id: 'WO-001',
  title: 'Tower Maintenance',
  description: 'Regular maintenance',
  status: 'assigned',
  priority: 'high',
  scheduled_date: '2026-03-17',
  scheduled_time: '09:00',
  project_name: 'Project Alpha',
  site_name: 'Tower Site A',
  site_address: '123 Tower Ln',
  site_lat: 40.7128,
  site_lon: -74.006,
  contact_name: 'John Doe',
  contact_phone: '555-1234',
  contact_email: 'john@example.com',
  assigned_to: 'tech@example.com',
  sync_status: 'synced',
}

describe('JobRepository', () => {
  beforeEach(async () => {
    // Clear database before each test
    await db.jobs.clear()
    await db.editQueue.clear()
    await db.uploadQueue.clear()
  })

  afterEach(async () => {
    // Cleanup
    await db.jobs.clear()
    await db.editQueue.clear()
    await db.uploadQueue.clear()
  })

  it('should cache a job snapshot locally', async () => {
    await jobRepository.saveJobSnapshot(mockJob)

    const snapshot = await db.jobs.where('jobId').equals(mockJob.id).first()
    expect(snapshot).toBeDefined()
    expect(snapshot?.data.title).toBe('Tower Maintenance')
    expect(snapshot?.source).toBe('local')
  })

  it('should queue an offline edit', async () => {
    const editId = await jobRepository.queueEdit(mockJob.id, 'status_change', {
      newStatus: 'in_progress',
    })

    expect(editId).toBeDefined()

    const edit = await db.editQueue.get(editId)
    expect(edit).toBeDefined()
    expect(edit?.operation).toBe('status_change')
    expect(edit?.syncStatus).toBe('pending')
    expect(edit?.data.newStatus).toBe('in_progress')
  })

  it('should retrieve pending edits for a job', async () => {
    const edit1Id = await jobRepository.queueEdit(mockJob.id, 'status_change', { newStatus: 'in_progress' })
    const edit2Id = await jobRepository.queueEdit(mockJob.id, 'add_note', { note: 'Equipment found' })

    const pending = await jobRepository.getPendingEdits(mockJob.id)
    expect(pending).toHaveLength(2)
    expect(pending.map(e => e.operation)).toEqual(['status_change', 'add_note'])
  })

  it('should mark an edit as synced', async () => {
    const editId = await jobRepository.queueEdit(mockJob.id, 'status_change', { newStatus: 'in_progress' })

    await jobRepository.markEditSynced(editId)

    const edit = await db.editQueue.get(editId)
    expect(edit?.syncStatus).toBe('synced')
  })

  it('should mark an edit as failed with error message', async () => {
    const editId = await jobRepository.queueEdit(mockJob.id, 'status_change', { newStatus: 'in_progress' })

    await jobRepository.markEditFailed(editId, 'Network timeout')

    const edit = await db.editQueue.get(editId)
    expect(edit?.syncStatus).toBe('failed')
    expect(edit?.lastError).toBe('Network timeout')
  })

  it('should drain edit queue and mark edits as synced', async () => {
    await jobRepository.queueEdit(mockJob.id, 'status_change', { newStatus: 'in_progress' })
    await jobRepository.queueEdit(mockJob.id, 'add_note', { note: 'Field note' })

    const result = await jobRepository.drainEditQueue(mockJob.id)

    expect(result.synced).toBe(2)
    expect(result.failed).toBe(0)

    const edits = await jobRepository.getPendingEdits(mockJob.id)
    expect(edits.every(e => e.syncStatus === 'synced')).toBe(true)
  })

  it('should queue file uploads', async () => {
    const uploadId = await jobRepository.queueUpload(
      mockJob.id,
      'evidence-001',
      '/local/path/image.jpg',
      'image.jpg',
      1024000,
      'image/jpeg'
    )

    expect(uploadId).toBeDefined()

    const upload = await db.uploadQueue.get(uploadId)
    expect(upload?.jobId).toBe(mockJob.id)
    expect(upload?.fileName).toBe('image.jpg')
    expect(upload?.syncStatus).toBe('pending')
  })

  it('should retrieve pending uploads', async () => {
    await jobRepository.queueUpload(mockJob.id, 'evidence-001', '/path/1.jpg', '1.jpg', 1024, 'image/jpeg')
    await jobRepository.queueUpload(mockJob.id, 'evidence-002', '/path/2.jpg', '2.jpg', 2048, 'image/jpeg')

    const pending = await jobRepository.getPendingUploads(mockJob.id)
    expect(pending).toHaveLength(2)
  })

  it('should drain upload queue', async () => {
    await jobRepository.queueUpload(mockJob.id, 'evidence-001', '/path/1.jpg', '1.jpg', 1024, 'image/jpeg')
    await jobRepository.queueUpload(mockJob.id, 'evidence-002', '/path/2.jpg', '2.jpg', 2048, 'image/jpeg')

    const result = await jobRepository.drainUploadQueue(mockJob.id)

    expect(result.synced).toBe(2)
    expect(result.failed).toBe(0)

    const uploads = await jobRepository.getPendingUploads(mockJob.id)
    expect(uploads).toHaveLength(0) // All synced, so none pending
  })

  it('should get database stats', async () => {
    // Add snapshots
    await jobRepository.saveJobSnapshot(mockJob)

    // Queue edits
    await jobRepository.queueEdit(mockJob.id, 'status_change', { newStatus: 'in_progress' })
    await jobRepository.queueEdit(mockJob.id, 'add_note', { note: 'test' })

    // Queue uploads
    await jobRepository.queueUpload(mockJob.id, 'evidence-001', '/path/1.jpg', '1.jpg', 1024, 'image/jpeg')

    const stats = await jobRepository.getStats()

    expect(stats.jobSnapshots).toBeGreaterThan(0)
    expect(stats.pendingEdits).toBe(2)
    expect(stats.pendingUploads).toBe(1)
  })

  it('should complete offline → edit → sync workflow', async () => {
    // Step 1: Save job locally (simulating offline cache)
    await jobRepository.saveJobSnapshot(mockJob)

    // Verify cached
    let snapshot = await db.jobs.where('jobId').equals(mockJob.id).first()
    expect(snapshot?.data.title).toBe('Tower Maintenance')

    // Step 2: Make edits while offline
    const editId1 = await jobRepository.queueEdit(mockJob.id, 'status_change', {
      newStatus: 'in_progress',
    })
    const editId2 = await jobRepository.queueEdit(mockJob.id, 'add_note', {
      note: 'Equipment on site',
    })

    // Verify edits queued
    let edits = await jobRepository.getPendingEdits(mockJob.id)
    expect(edits).toHaveLength(2)
    expect(edits.every(e => e.syncStatus === 'pending')).toBe(true)

    // Step 3: Go online and sync
    const syncResult = await jobRepository.drainEditQueue(mockJob.id)
    expect(syncResult.synced).toBe(2)
    expect(syncResult.failed).toBe(0)

    // Verify edits now synced
    edits = await jobRepository.getPendingEdits(mockJob.id)
    expect(edits.every(e => e.syncStatus === 'synced')).toBe(true)

    // Verify stats show completed sync
    const stats = await jobRepository.getStats()
    expect(stats.pendingEdits).toBe(0) // All synced now
  })
})