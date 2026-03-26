/**
 * FieldJobSyncStrip — Single job-level sync/outbox context: summary line + nested OfflineEdits + UploadProgress.
 *
 * TECHNICAL_DEBT (Iteration 13.1): Aggregated state is polled on a fixed interval (Dexie queuedEdits,
 * in-memory uploadQueue, IDB telemetry depth). Acceptable for now; a future pass should prefer
 * subscriptions or push notifications from each source to avoid redundant reads and to coalesce updates.
 */
import React, { useEffect, useState } from 'react';
import { db } from '@/lib/db';
import { uploadQueue } from '@/lib/uploadQueue';
import { getTelemetryQueueDepthForJob } from '@/lib/telemetryQueue';
import { summarizeJobSyncSurface } from '@/lib/fieldJobSyncPresentation';
import { cn } from '@/lib/utils';
import { FIELD_OVERLINE } from '@/lib/fieldVisualTokens';
import OfflineEditsIndicator from '@/components/fieldv2/OfflineEditsIndicator.jsx';
import UploadProgressIndicator from '@/components/fieldv2/UploadProgressIndicator';

const STRIP_POLL_MS = 1500;

export default function FieldJobSyncStrip({ jobId, isOnline }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let alive = true;

    async function tick() {
      try {
        const edits = await db.queuedEdits.where('job_id').equals(jobId).toArray();
        const uploads = uploadQueue.getJobUploads(jobId);
        const { depth } = await getTelemetryQueueDepthForJob(jobId);
        const s = summarizeJobSyncSurface({
          isOnline,
          edits,
          uploads,
          telemetryDepthForJob: depth,
        });
        if (alive) setSummary(s);
      } catch (err) {
        console.warn('[FieldJobSyncStrip] aggregate sync state failed:', err);
        if (alive) {
          setSummary(
            summarizeJobSyncSurface({
              isOnline,
              edits: [],
              uploads: [],
              telemetryDepthForJob: 0,
            })
          );
        }
      }
    }

    tick();
    const id = setInterval(tick, STRIP_POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [jobId, isOnline]);

  if (summary === null) {
    return (
      <>
        <OfflineEditsIndicator jobId={jobId} isOnline={isOnline} nested />
        <UploadProgressIndicator jobId={jobId} isOnline={isOnline} nested />
      </>
    );
  }

  if (!summary.showSyncStrip) {
    return (
      <>
        <OfflineEditsIndicator jobId={jobId} isOnline={isOnline} nested />
        <UploadProgressIndicator jobId={jobId} isOnline={isOnline} nested />
      </>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200/90 bg-slate-50/60 p-3 space-y-3 shadow-sm min-w-0',
        !isOnline && 'border-amber-200/80 bg-amber-50/40'
      )}
    >
      {summary.summarySentence ? (
        <div className="space-y-1 min-w-0">
          <p className={FIELD_OVERLINE}>Sync and uploads</p>
          <p
            className={cn(
              'text-xs leading-snug sm:leading-relaxed break-words text-pretty max-w-full',
              !isOnline ? 'text-amber-950' : 'text-slate-700'
            )}
          >
            {summary.summarySentence}
          </p>
        </div>
      ) : (
        <p className={FIELD_OVERLINE}>Sync and uploads</p>
      )}
      <div className="space-y-3">
        <OfflineEditsIndicator jobId={jobId} isOnline={isOnline} nested />
        <UploadProgressIndicator jobId={jobId} isOnline={isOnline} nested />
      </div>
    </div>
  );
}
