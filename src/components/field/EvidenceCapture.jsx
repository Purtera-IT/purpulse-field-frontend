/**
 * EvidenceCapture — orchestrates the full 3-step evidence capture flow:
 *   source → metadata (single) | gallery (multi) → upload queue
 *
 * Backward compatible: accepts same props as the original component.
 * Props: jobId, evidenceType, stepId, onCaptured
 */
import React, { useRef, useState } from 'react';
import { Camera, Images, ListOrdered, AlertTriangle, RotateCcw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useUploadQueue } from '@/hooks/useUploadQueue';
import EvidenceMetadataForm from './EvidenceMetadataForm';
import GalleryImport from './GalleryImport';
import UploadQueue from './UploadQueue';
import CameraOverlay from './CameraOverlay';
import { cn } from '@/lib/utils';
import { telemetryEvidenceUploadStart } from '@/lib/telemetry';

// steps: 'source' | 'metadata' | 'gallery' | 'queue'

export default function EvidenceCapture({ jobId, evidenceType, stepId, onCaptured }) {
  const [step, setStep]           = useState('source');
  const [capturedFile, setCapturedFile] = useState(null);
  const [capturedPreview, setCapturedPreview] = useState(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const cameraInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { queue, addToQueue, reattachFile, getPreview, retryItem, pauseItem, resumeItem, cancelItem, clearDone, retryAll } = useUploadQueue(queryClient);

  const jobQueue         = queue.filter(i => i.jobId === jobId);
  const hasQueue         = jobQueue.length > 0;
  const reattachItems    = jobQueue.filter(i => i.status === 'needs_reattach');
  const expiredItems     = jobQueue.filter(i => i.status === 'expired');
  const reattachInputRef = useRef(null);
  const [reattachTarget, setReattachTarget] = useState(null); // queue item id

  const handleReattach = (e) => {
    const file = e.target.files?.[0];
    if (!file || !reattachTarget) return;
    reattachFile(reattachTarget, file);
    setReattachTarget(null);
    e.target.value = '';
  };

  const handleCameraCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCapturedFile(file);
    const reader = new FileReader();
    reader.onload = ev => setCapturedPreview(ev.target.result);
    reader.readAsDataURL(file);
    setStep('metadata');
    e.target.value = '';
  };

  const handleMetadataSubmit = (metadata) => {
    addToQueue(
      [capturedFile],
      { ...metadata, tags: metadata.tags.length ? metadata.tags : [evidenceType || 'general'], runbook_step_id: stepId || null },
      jobId,
      onCaptured
    );
    setCapturedFile(null);
    setCapturedPreview(null);
    setStep('queue');
  };

  const handleGalleryQueue = (items) => {
    items.forEach(({ file, metadata }) => {
      addToQueue(
        [file],
        { ...metadata, runbook_step_id: stepId || null },
        jobId,
        onCaptured
      );
    });
    setStep('queue');
  };

  // ── Overlay capture handler ─────────────────────────────────────
  const handleOverlayCapture = (file, metadata) => {
    setShowOverlay(false);
    addToQueue([file], { ...metadata, runbook_step_id: stepId || null }, jobId, onCaptured);
    setStep('queue');
  };

  // ── Source selection screen ──────────────────────────────────────
  if (step === 'source') {
    return (
      <>
      {showOverlay && (
        <CameraOverlay
          jobId={jobId}
          evidenceType={evidenceType}
          defaultTags={evidenceType ? [evidenceType.charAt(0).toUpperCase() + evidenceType.slice(1)] : []}
          onCapture={handleOverlayCapture}
          onClose={() => setShowOverlay(false)}
          onOpenGallery={() => { setShowOverlay(false); setStep('gallery'); }}
        />
      )}
      {/* ── Re-attach prompt (files lost from IndexedDB) ─── */}
      {(reattachItems.length > 0 || expiredItems.length > 0) && (
        <div className="space-y-2 mb-1">
          {reattachItems.map(item => (
            <div key={item.id} className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-amber-800">File lost — re-add required</p>
                <p className="text-[11px] text-amber-600 truncate">{item.filename}</p>
              </div>
              <button
                onClick={() => { setReattachTarget(item.id); reattachInputRef.current?.click(); }}
                className="flex items-center gap-1 h-8 px-3 rounded-xl bg-amber-600 text-white text-[11px] font-bold flex-shrink-0 active:opacity-80"
              >
                <RotateCcw className="h-3 w-3" /> Re-add
              </button>
            </div>
          ))}
          {expiredItems.map(item => (
            <div key={item.id} className="flex items-start gap-3 px-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl">
              <AlertTriangle className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-600">Upload expired</p>
                <p className="text-[11px] text-slate-400 truncate">{item.filename} — please recapture</p>
              </div>
              <button
                onClick={() => cancelItem(item.id)}
                className="h-8 px-3 rounded-xl bg-slate-200 text-slate-600 text-[11px] font-bold flex-shrink-0 active:opacity-80"
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input for re-attach */}
      <input
        ref={reattachInputRef}
        type="file" accept="image/*"
        className="hidden"
        onChange={handleReattach}
      />

      <div className="space-y-3">
        {/* Camera — primary action (full overlay) */}
        <button
          onClick={() => setShowOverlay(true)}
          className="w-full h-20 rounded-2xl bg-slate-900 text-white flex items-center justify-center gap-3 active:opacity-80"
          aria-label="Open camera overlay"
        >
          <Camera className="h-6 w-6" />
          <div className="text-left">
            <p className="font-bold text-sm">Camera</p>
            <p className="text-xs text-white/60">Reticle · GPS · Tags · Serial guide</p>
          </div>
        </button>

        <input
          ref={cameraInputRef}
          type="file" accept="image/*" capture="environment"
          className="hidden"
          onChange={handleCameraCapture}
        />

        {/* Gallery — secondary */}
        <button
          onClick={() => setStep('gallery')}
          className="w-full h-16 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center gap-3 active:bg-slate-200"
          aria-label="Import from gallery"
        >
          <Images className="h-5 w-5 text-slate-500" />
          <div className="text-left">
            <p className="font-semibold text-sm">Gallery Import</p>
            <p className="text-xs text-slate-400">Multi-select, batch tag</p>
          </div>
        </button>

        {/* View queue if has items */}
        {hasQueue && (
          <button
            onClick={() => setStep('queue')}
            className="w-full h-14 rounded-2xl border-2 border-slate-200 flex items-center justify-center gap-2 active:bg-slate-50"
            aria-label={`View upload queue — ${jobQueue.length} item${jobQueue.length !== 1 ? 's' : ''}${jobQueue.some(i => i.status === 'failed') ? ', contains errors' : ''}`}
          >
            <ListOrdered className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-600">
              View Queue ({jobQueue.length})
            </span>
            {jobQueue.some(i => i.status === 'failed') && (
              <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
            )}
            {jobQueue.some(i => i.status === 'failed') && (
              <span className="sr-only">— contains failed uploads</span>
            )}
            {jobQueue.some(i => ['uploading','processing'].includes(i.status)) && (
              <span className="h-2 w-2 rounded-full bg-blue-500 motion-safe:animate-pulse" aria-hidden="true" />
            )}
            {jobQueue.some(i => ['uploading','processing'].includes(i.status)) && (
              <span className="sr-only">— uploading in progress</span>
            )}
          </button>
        )}
      </div>
      </>
    );
  }

  // ── Metadata screen (after camera capture) ─────────────────────
  if (step === 'metadata') {
    return (
      <EvidenceMetadataForm
        previewUrl={capturedPreview}
        defaultTags={evidenceType ? [evidenceType.charAt(0).toUpperCase() + evidenceType.slice(1)] : []}
        onSubmit={handleMetadataSubmit}
        onBack={() => { setCapturedFile(null); setCapturedPreview(null); setStep('source'); }}
      />
    );
  }

  // ── Gallery import screen ───────────────────────────────────────
  if (step === 'gallery') {
    return (
      <GalleryImport
        jobId={jobId}
        onQueueAll={handleGalleryQueue}
        onBack={() => setStep('source')}
      />
    );
  }

  // ── Upload queue screen ─────────────────────────────────────────
  if (step === 'queue') {
    return (
      <div className="space-y-3">
        <UploadQueue jobId={jobId} />
        <button
          onClick={() => setStep('source')}
          className="w-full h-11 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm active:bg-slate-50"
          aria-label="Add more evidence"
        >
          + Add More
        </button>
      </div>
    );
  }

  return null;
}