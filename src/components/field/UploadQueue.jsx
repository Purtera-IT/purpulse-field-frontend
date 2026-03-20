/**
 * UploadQueue
 * Displays the upload queue with per-file progress, status badges, and action controls.
 * Can be used inline (in EvidenceCapture) or standalone (in Support page → Queued Items).
 */
import React from 'react';
import { useUploadQueue } from '@/hooks/useUploadQueue';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Pause, Play, X, AlertTriangle, CheckCircle2, Clock, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CFG = {
  pending:        { label: 'Queued',      color: 'text-slate-500',   bg: 'bg-slate-100',    Icon: Clock },
  uploading:      { label: 'Uploading',   color: 'text-blue-600',    bg: 'bg-blue-50',      Icon: RefreshCw, spin: true },
  processing:     { label: 'Processing',  color: 'text-purple-600',  bg: 'bg-purple-50',    Icon: Cpu,       spin: true },
  paused:         { label: 'Paused',      color: 'text-amber-600',   bg: 'bg-amber-50',     Icon: Pause },
  done:           { label: 'Done',        color: 'text-emerald-600', bg: 'bg-emerald-50',   Icon: CheckCircle2 },
  failed:         { label: 'Failed',      color: 'text-red-600',     bg: 'bg-red-50',       Icon: AlertTriangle },
  needs_reattach: { label: 'Re-add file', color: 'text-orange-600',  bg: 'bg-orange-50',    Icon: AlertTriangle },
  cancelled:      { label: 'Cancelled',   color: 'text-slate-400',   bg: 'bg-slate-50',     Icon: X },
};

const PROC_LABELS = { 'face-blur': '😶 Applying face blur…', 'ocr': '🔍 Running OCR…' };

function ProgressBar({ progress, status }) {
  const color =
    status === 'done'       ? 'bg-emerald-500' :
    status === 'failed'     ? 'bg-red-500' :
    status === 'processing' ? 'bg-purple-500' :
    'bg-blue-500';
  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
      <div className={cn('h-full rounded-full transition-all duration-300', color)}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function QueueItem({ item, getPreview, onRetry, onPause, onResume, onCancel }) {
  const cfg = STATUS_CFG[item.status] || STATUS_CFG.pending;
  const Icon = cfg.Icon;
  const preview = getPreview(item.id);
  const isActive = item.status === 'uploading' || item.status === 'processing';
  const canRetry = item.status === 'failed' || item.status === 'needs_reattach';
  const canPause = item.status === 'uploading' || item.status === 'pending';
  const canResume = item.status === 'paused';

  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
        {preview
          ? <img src={preview} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">?</div>
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full', cfg.bg)}>
            <Icon className={cn('h-3 w-3', cfg.color, cfg.spin && 'animate-spin')} />
            <span className={cn('text-[10px] font-bold', cfg.color)}>{cfg.label}</span>
          </div>
          {item.metadata?.tags?.length > 0 && (
            <span className="text-[10px] text-slate-400 truncate">
              {item.metadata.tags.join(' · ')}
            </span>
          )}
        </div>

        <p className="text-xs text-slate-500 truncate">{item.filename}</p>

        {item.status === 'processing' && item.processingStep && (
          <p className="text-[10px] text-purple-600 mt-0.5 animate-pulse">
            {PROC_LABELS[item.processingStep] || 'Processing…'}
          </p>
        )}

        {item.error && (
          <p className="text-[10px] text-red-500 mt-0.5 truncate">{item.error}</p>
        )}

        {(isActive || item.status === 'paused') && (
          <ProgressBar progress={item.progress} status={item.status} />
        )}

        {item.status === 'done' && item.qc_status && (
          <div className="flex items-center gap-1 mt-0.5">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            <span className="text-[10px] text-emerald-600 font-bold">QC {item.qc_status.toUpperCase()}</span>
          </div>
        )}
      </div>

      {/* Action buttons — min 44px touch via padding */}
      <div className="flex gap-1 flex-shrink-0">
        {canRetry && (
          <button onClick={() => onRetry(item.id)}
            className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center active:opacity-70"
            aria-label="Retry upload"
          >
            <RefreshCw className="h-3.5 w-3.5 text-red-600" />
          </button>
        )}
        {canPause && (
          <button onClick={() => onPause(item.id)}
            className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center active:opacity-70"
            aria-label="Pause upload"
          >
            <Pause className="h-3.5 w-3.5 text-amber-600" />
          </button>
        )}
        {canResume && (
          <button onClick={() => onResume(item.id)}
            className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center active:opacity-70"
            aria-label="Resume upload"
          >
            <Play className="h-3.5 w-3.5 text-emerald-600" />
          </button>
        )}
        {item.status !== 'done' && (
          <button onClick={() => onCancel(item.id)}
            className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center active:opacity-70"
            aria-label="Cancel upload"
          >
            <X className="h-3.5 w-3.5 text-slate-500" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function UploadQueue({ jobId, compact = false }) {
  const queryClient = useQueryClient();
  const { queue, failed, done, uploading, pending, retryItem, pauseItem, resumeItem, cancelItem, clearDone, retryAll, getPreview } = useUploadQueue(queryClient);

  const items = jobId ? queue.filter(i => i.jobId === jobId) : queue;
  if (!items.length) return null;

  const hasActive = items.some(i => ['uploading','processing','pending'].includes(i.status));

  if (compact) {
    const active = items.filter(i => ['uploading','processing','pending'].includes(i.status)).length;
    const fail   = items.filter(i => i.status === 'failed').length;
    return (
      <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold',
        fail > 0 ? 'bg-red-50 text-red-700' : active > 0 ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
      )}>
        {fail > 0
          ? <><AlertTriangle className="h-3.5 w-3.5" /> {fail} failed</>
          : active > 0
          ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> {active} uploading</>
          : <><CheckCircle2 className="h-3.5 w-3.5" /> All uploaded</>
        }
        {fail > 0 && (
          <button onClick={retryAll} className="ml-auto underline">Retry all</button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-slate-900">Upload Queue</p>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{items.length}</span>
        </div>
        <div className="flex gap-2">
          {failed > 0 && (
            <button onClick={retryAll}
              className="text-xs text-red-600 font-semibold flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> Retry failed
            </button>
          )}
          {done > 0 && (
            <button onClick={clearDone}
              className="text-xs text-slate-400 font-semibold"
            >
              Clear done
            </button>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="px-4 divide-y divide-slate-50">
        {items.map(item => (
          <QueueItem
            key={item.id} item={item}
            getPreview={getPreview}
            onRetry={retryItem} onPause={pauseItem}
            onResume={resumeItem} onCancel={cancelItem}
          />
        ))}
      </div>

      {/* Offline notice */}
      {!navigator.onLine && hasActive && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-amber-50 text-amber-700 text-xs font-medium flex items-center gap-2">
          <span>📴</span>
          <span>Offline — uploads resume automatically when connection returns</span>
        </div>
      )}
    </div>
  );
}