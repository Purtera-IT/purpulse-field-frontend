/**
 * OfflineEditsIndicator — Dexie queuedEdits for this job (durable local mutations until API sync).
 */
import React, { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, WifiOff } from 'lucide-react'
import { db } from '@/lib/db'
import { cn } from '@/lib/utils'
import {
  labelQueuedEditStatus,
  SYNC_QUEUED_EDITS_SUBTITLE,
} from '@/lib/fieldJobSyncPresentation'

export default function OfflineEditsIndicator({ jobId, isOnline, nested }) {
  const [queuedEdits, setQueuedEdits] = useState([])

  useEffect(() => {
    const updateEdits = async () => {
      try {
        const edits = await db.queuedEdits
          .where('job_id')
          .equals(jobId)
          .toArray()
        setQueuedEdits(edits)
      } catch (err) {
        console.warn('[OfflineEditsIndicator] Failed to load queued edits:', err)
      }
    }

    updateEdits()
    const interval = setInterval(updateEdits, 1000)
    return () => clearInterval(interval)
  }, [jobId])

  const pendingCount = queuedEdits.filter(e => e.status === 'pending').length
  const syncingCount = queuedEdits.filter(e => e.status === 'in_progress').length
  const failedCount = queuedEdits.filter(e => e.status === 'failed').length

  if (queuedEdits.length === 0) return null

  return (
    <div className={cn(
      'border rounded-xl p-3 space-y-2',
      nested ? 'bg-white/95 border-slate-200/90 shadow-none' : 'shadow-sm',
      !nested && (!isOnline ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200')
    )}>
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <WifiOff className="h-4 w-4 text-amber-600" />
        ) : syncingCount > 0 ? (
          <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
        ) : failedCount > 0 ? (
          <AlertCircle className="h-4 w-4 text-red-600" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        )}
        <p className={cn(
          'text-sm font-semibold',
          nested ? 'text-slate-900' : (!isOnline ? 'text-amber-900' : 'text-blue-900')
        )}>
          {!isOnline ? 'Offline — job changes on this device' : 'Job changes (queued)'}
        </p>
      </div>

      <p className="text-[10px] text-slate-600 leading-relaxed">
        {SYNC_QUEUED_EDITS_SUBTITLE}
      </p>

      <div className="flex items-center gap-4 text-xs">
        <span className={nested ? 'text-slate-700' : (!isOnline ? 'text-amber-700' : 'text-blue-700')}>
          {pendingCount > 0 && (
            <span className="font-bold">{pendingCount} waiting to sync</span>
          )}
          {syncingCount > 0 && (
            <span className="text-blue-600 ml-2">⟳ {syncingCount} sending</span>
          )}
          {failedCount > 0 && (
            <span className="text-red-600 ml-2">✗ {failedCount} need attention</span>
          )}
        </span>
      </div>

      <div className="space-y-1 border-t pt-2" style={{
        borderColor: nested ? 'rgba(148, 163, 184, 0.35)' : (!isOnline ? 'rgba(217, 119, 6, 0.2)' : 'rgba(37, 99, 235, 0.2)')
      }}>
        {queuedEdits.slice(0, 3).map(edit => (
          <div key={edit.id} className="flex items-center justify-between px-2 py-1 bg-white rounded-lg border border-slate-100/80">
            <span className="text-[10px] text-slate-600 truncate flex-1">{edit.action.toUpperCase()}: {edit.entity_type}</span>
            <span className={cn(
              'text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ml-2',
              edit.status === 'pending' ? 'bg-amber-100 text-amber-800' :
              edit.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
              'bg-red-100 text-red-800'
            )}>
              {labelQueuedEditStatus(edit.status)}
            </span>
          </div>
        ))}
        {queuedEdits.length > 3 && (
          <p className="text-[10px] text-slate-400 px-2 py-1">
            +{queuedEdits.length - 3} more
          </p>
        )}
      </div>
    </div>
  )
}
