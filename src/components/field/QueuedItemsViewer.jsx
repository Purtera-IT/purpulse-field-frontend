/**
 * QueuedItemsViewer
 *
 * Lists every SyncQueue item + offline edits from localStorage with:
 *   - Type icon, job title, client_event_id, timestamp, status badge
 *   - Per-item: Retry button (moves to in_progress) and Cancel (soft-delete with undo toast)
 *
 * Microflow — Retry single item:
 *   1. Set status='in_progress' optimistically
 *   2. Call SyncQueue.update(id, { status:'pending', retry_count: item.retry_count+1 })
 *   3. SyncIndicator re-polls → picks it up → processes → updates status
 *
 * Microflow — Cancel item (with undo):
 *   1. Optimistically remove from list
 *   2. Show toast with 5s undo window
 *   3. If not undone: SyncQueue.delete(id)
 *   4. If undone: restore item in UI (no API call needed — item was never deleted yet)
 *
 * Retry All microflow:
 *   1. Collect all failed items
 *   2. Batch update status='pending', increment retry_count
 *   3. Toast confirmation with count
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  RefreshCw, X, AlertTriangle, CheckCircle2,
  Loader2, Timer, Camera, MessageSquare, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const TYPE_ICONS = {
  time_entry:   Timer,
  evidence:     Camera,
  chat_message: MessageSquare,
  blocker:      AlertTriangle,
  closeout:     CheckCircle2,
};

const STATUS_CFG = {
  pending:     { label: 'Pending',     bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200', dot: 'bg-amber-400'  },
  in_progress: { label: 'Processing',  bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',  dot: 'bg-blue-500 animate-pulse' },
  completed:   { label: 'Synced',      bg: 'bg-emerald-50',text: 'text-emerald-700',border: 'border-emerald-200',dot: 'bg-emerald-500' },
  failed:      { label: 'Failed',      bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',   dot: 'bg-red-500'    },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pending;
  return (
    <span className={cn('flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border', cfg.bg, cfg.text, cfg.border)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
}

function ItemRow({ item, jobTitle, onCancel, onRetry }) {
  const Icon = TYPE_ICONS[item.entity_type] || Zap;
  const isFailed = item.status === 'failed';
  const isProcessing = item.status === 'in_progress';

  return (
    <div className={cn(
      'rounded-2xl border p-3.5 space-y-2.5',
      isFailed ? 'bg-red-50/50 border-red-100' : 'bg-white border-slate-100'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0',
            isFailed ? 'bg-red-100' : 'bg-slate-100'
          )}>
            <Icon className={cn('h-4 w-4', isFailed ? 'text-red-500' : 'text-slate-500')} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 capitalize">
              {item.entity_type?.replace(/_/g, ' ')}
              <span className="font-normal text-slate-400 ml-1.5 text-xs capitalize">· {item.action}</span>
            </p>
            {jobTitle && <p className="text-xs text-slate-500 truncate">{jobTitle}</p>}
            {item.created_date && (
              <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                {format(new Date(item.created_date), 'MMM d · h:mm:ss a')}
              </p>
            )}
          </div>
        </div>
        <StatusBadge status={item.status} />
      </div>

      {/* IDs */}
      <div className="bg-slate-50 rounded-xl px-3 py-2 space-y-0.5">
        <p className="text-[10px] font-mono text-slate-400">
          <span className="text-slate-300">client_event_id: </span>
          <span className="text-slate-600 break-all">{item.client_request_id || '—'}</span>
        </p>
        {item.entity_id && (
          <p className="text-[10px] font-mono text-slate-400">
            <span className="text-slate-300">entity_id: </span>
            <span className="text-slate-600">{item.entity_id}</span>
          </p>
        )}
        {item.retry_count > 0 && (
          <p className="text-[10px] font-mono text-amber-600">retries: {item.retry_count}/{item.max_retries || 5}</p>
        )}
      </div>

      {/* Last error */}
      {item.last_error && (
        <div className="bg-red-50 rounded-xl px-3 py-2">
          <p className="text-[10px] font-mono text-red-600 break-all">{item.last_error}</p>
        </div>
      )}

      {/* Actions */}
      {item.status !== 'completed' && (
        <div className="flex gap-2 pt-0.5">
          {(isFailed || item.status === 'pending') && (
            <button onClick={() => onRetry(item)}
              className="flex-1 h-9 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-1.5 active:opacity-80"
            >
              {isProcessing
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />
              }
              Retry
            </button>
          )}
          <button onClick={() => onCancel(item)}
            className="h-9 px-4 rounded-xl border border-slate-200 text-slate-500 text-xs font-semibold flex items-center gap-1.5 active:bg-slate-50"
          >
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export default function QueuedItemsViewer({ items, jobs, onRetryAll }) {
  const [dismissed, setDismissed] = useState(new Set());
  const queryClient = useQueryClient();
  const jobMap = Object.fromEntries((jobs || []).map(j => [j.id, j]));

  const updateItem = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SyncQueue.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sync-queue-all'] }),
  });

  const deleteItem = useMutation({
    mutationFn: (id) => base44.entities.SyncQueue.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sync-queue-all'] }),
  });

  const handleRetry = (item) => {
    updateItem.mutate({
      id: item.id,
      data: { status: 'pending', retry_count: (item.retry_count || 0) + 1, last_error: null },
    });
    toast.success('Item queued for retry', { description: item.entity_type?.replace(/_/g, ' ') });
  };

  const handleCancel = (item) => {
    // Optimistic hide
    setDismissed(prev => new Set([...prev, item.id]));

    let undone = false;
    toast('Item cancelled', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          undone = true;
          setDismissed(prev => { const s = new Set(prev); s.delete(item.id); return s; });
        },
      },
      onDismiss: () => { if (!undone) deleteItem.mutate(item.id); },
      onAutoClose: () => { if (!undone) deleteItem.mutate(item.id); },
    });
  };

  const visible = items.filter(i => !dismissed.has(i.id));

  if (visible.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="h-10 w-10 text-emerald-300 mx-auto mb-2" />
        <p className="text-slate-400 text-sm font-semibold">All synced</p>
        <p className="text-slate-300 text-xs mt-0.5">No queued or failed items</p>
      </div>
    );
  }

  const failedCount = visible.filter(i => i.status === 'failed').length;

  return (
    <div className="space-y-3">
      {/* Retry All CTA */}
      {failedCount > 0 && (
        <button
          onClick={onRetryAll}
          className="w-full h-12 rounded-2xl bg-red-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:opacity-80"
        >
          <RefreshCw className="h-4 w-4" />
          Retry All Failed ({failedCount})
        </button>
      )}

      {visible.map(item => (
        <ItemRow
          key={item.id}
          item={item}
          jobTitle={jobMap[item.job_id]?.title}
          onRetry={handleRetry}
          onCancel={handleCancel}
        />
      ))}
    </div>
  );
}