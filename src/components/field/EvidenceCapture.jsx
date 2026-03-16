/**
 * EvidenceCapture — orchestrates the full 3-step evidence capture flow:
 *   source → metadata (single) | gallery (multi) → upload queue
 *
 * Backward compatible: accepts same props as the original component.
 * Props: jobId, evidenceType, stepId, onCaptured
 */
import React, { useRef, useState } from 'react';
import { Camera, Images, ListOrdered } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useUploadQueue } from '@/hooks/useUploadQueue';
import EvidenceMetadataForm from './EvidenceMetadataForm';
import GalleryImport from './GalleryImport';
import UploadQueue from './UploadQueue';
import { cn } from '@/lib/utils';

// steps: 'source' | 'metadata' | 'gallery' | 'queue'

export default function EvidenceCapture({ jobId, evidenceType, stepId, onCaptured }) {
  const [step, setStep]           = useState('source');
  const [capturedFile, setCapturedFile] = useState(null);
  const [capturedPreview, setCapturedPreview] = useState(null);
  const cameraInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { queue, addToQueue, getPreview, retryItem, pauseItem, resumeItem, cancelItem, clearDone, retryAll } = useUploadQueue(queryClient);

  const jobQueue = queue.filter(i => i.jobId === jobId);
  const hasQueue = jobQueue.length > 0;

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

  // ── Source selection screen ──────────────────────────────────────
  if (step === 'source') {
    return (
      <div className="space-y-3">
        {/* Camera — primary action */}
        <button
          onClick={() => cameraInputRef.current?.click()}
          className="w-full h-20 rounded-2xl bg-slate-900 text-white flex items-center justify-center gap-3 active:opacity-80"
          aria-label="Open camera"
        >
          <Camera className="h-6 w-6" />
          <div className="text-left">
            <p className="font-bold text-sm">Camera</p>
            <p className="text-xs text-white/60">One photo with metadata</p>
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
          >
            <ListOrdered className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-600">
              View Queue ({jobQueue.length})
            </span>
            {jobQueue.some(i => i.status === 'failed') && (
              <span className="h-2 w-2 rounded-full bg-red-500" />
            )}
            {jobQueue.some(i => ['uploading','processing'].includes(i.status)) && (
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            )}
          </button>
        )}
      </div>
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
        >
          + Add More
        </button>
      </div>
    );
  }

  return null;
}