import { describe, it, expect } from 'vitest';
import {
  labelQueuedEditStatus,
  labelUploadSessionStatus,
  summarizeJobSyncSurface,
  SYNC_QUEUED_EDITS_SUBTITLE,
  EVIDENCE_IN_FLIGHT_PHRASE,
} from '@/lib/fieldJobSyncPresentation';

describe('fieldJobSyncPresentation', () => {
  it('maps queued edit statuses to operator labels', () => {
    expect(labelQueuedEditStatus('pending')).toBe('Waiting to sync');
    expect(labelQueuedEditStatus('in_progress')).toBe('Sending…');
    expect(labelQueuedEditStatus('failed')).toBe('Needs attention');
    expect(labelQueuedEditStatus('unknown')).toBe('unknown');
  });

  it('maps upload session statuses to operator labels', () => {
    expect(labelUploadSessionStatus('pending')).toBe('Waiting to sync');
    expect(labelUploadSessionStatus('uploading')).toBe('Sending…');
    expect(labelUploadSessionStatus('paused')).toBe('Paused');
    expect(labelUploadSessionStatus('failed')).toBe('Needs attention');
    expect(labelUploadSessionStatus('completed')).toBe('Upload finished');
  });

  it('summarizeJobSyncSurface aggregates counts and blocking attention', () => {
    const s = summarizeJobSyncSurface({
      isOnline: true,
      edits: [
        { status: 'pending' },
        { status: 'in_progress' },
        { status: 'failed' },
      ],
      uploads: [
        { status: 'pending' },
        { status: 'uploading' },
        { status: 'failed' },
        { status: 'completed' },
      ],
      telemetryDepthForJob: 2,
    });
    expect(s.waitingEdits).toBe(1);
    expect(s.sendingEdits).toBe(1);
    expect(s.failedEdits).toBe(1);
    expect(s.waitingUploads).toBe(1);
    expect(s.sendingUploads).toBe(1);
    expect(s.failedUploads).toBe(1);
    expect(s.completedUploads).toBe(1);
    expect(s.telemetryPending).toBe(2);
    expect(s.hasBlockingAttention).toBe(true);
    expect(s.showSyncStrip).toBe(true);
    expect(s.summarySentence).toContain('job change');
    expect(s.summarySentence).toContain('activity updates waiting to send');
  });

  it('empty job id inputs: no strip when online and nothing queued', () => {
    const s = summarizeJobSyncSurface({
      isOnline: true,
      edits: [],
      uploads: [],
      telemetryDepthForJob: 0,
    });
    expect(s.showSyncStrip).toBe(false);
    expect(s.summarySentence).toBeNull();
    expect(s.hasBlockingAttention).toBe(false);
  });

  it('offline with no local queues does not show strip', () => {
    const s = summarizeJobSyncSurface({
      isOnline: false,
      edits: [],
      uploads: [],
      telemetryDepthForJob: 0,
    });
    expect(s.showSyncStrip).toBe(false);
  });

  it('offline with pending edits shows strip and offline phrase', () => {
    const s = summarizeJobSyncSurface({
      isOnline: false,
      edits: [{ status: 'pending' }],
      uploads: [],
      telemetryDepthForJob: 0,
    });
    expect(s.showSyncStrip).toBe(true);
    expect(s.summarySentence).toMatch(/Offline/);
  });

  it('exports stable copy constants', () => {
    expect(SYNC_QUEUED_EDITS_SUBTITLE.length).toBeGreaterThan(10);
    expect(EVIDENCE_IN_FLIGHT_PHRASE).toContain('upload');
  });
});
