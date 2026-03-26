/** Chunked evidence uploads via in-memory UploadQueueManager (jobRepository Dexie uploadQueue is separate). */
import React, { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Pause, Trash2, Upload } from 'lucide-react'
import { uploadQueue } from '@/lib/uploadQueue'
import { cn } from '@/lib/utils'
import { FIELD_BODY, FIELD_META } from '@/lib/fieldVisualTokens'
import { labelUploadSessionStatus } from '@/lib/fieldJobSyncPresentation'

export default function UploadProgressIndicator({ jobId, isOnline, nested }) {
  const [uploads, setUploads] = useState([])

  useEffect(() => {
    const updateUploads = () => {
      const jobUploads = uploadQueue.getJobUploads(jobId)
      setUploads(jobUploads)
    }

    updateUploads()
    const interval = setInterval(updateUploads, 500)
    return () => clearInterval(interval)
  }, [jobId])

  const handlePause = (sessionId) => {
    uploadQueue.pause(sessionId)
    setUploads(prev => [...prev])
  }

  const handleCancel = (sessionId) => {
    uploadQueue.cancel(sessionId)
    setUploads(prev => prev.filter(u => u.id !== sessionId))
  }

  if (uploads.length === 0) return null

  const completedCount = uploads.filter(u => u.status === 'completed').length
  const failedCount = uploads.filter(u => u.status === 'failed').length
  const inProgressCount = uploads.filter(u => u.status === 'uploading').length

  return (
    <div className={cn(
      'border rounded-xl p-3 space-y-2',
      nested ? 'bg-white/95 border-slate-200/90 shadow-none' : 'shadow-sm bg-blue-50 border-blue-200'
    )}>
      <div className="flex items-center gap-2">
        <Upload className={cn('h-4 w-4', nested ? 'text-slate-600' : 'text-blue-600')} />
        <p className={cn('text-sm font-semibold', nested ? 'text-slate-900' : 'text-blue-900')}>
          File uploads (this session)
        </p>
      </div>
      <p className="text-[10px] text-slate-600 leading-relaxed">
        Large files are sent in parts from this device. &quot;Upload finished&quot; means this transfer session completed — not that every downstream step (evidence record, QC, etc.) is done. Separate from job change sync above.
      </p>

      <div className="flex items-center gap-4 text-xs">
        <span className={nested ? 'text-slate-700' : 'text-blue-700'}>
          {inProgressCount > 0 && (
            <span className="font-bold text-blue-600">{inProgressCount} sending</span>
          )}
          {completedCount > 0 && (
            <span className="text-green-600 ml-2">
              ✓ {completedCount} upload{completedCount === 1 ? '' : 's'} finished
            </span>
          )}
          {failedCount > 0 && (
            <span className="text-red-600 ml-2">✗ {failedCount} need attention</span>
          )}
        </span>
      </div>

      <div className={cn('space-y-2 border-t pt-2', nested ? 'border-slate-200' : 'border-blue-200')}>
        {uploads.map(upload => (
          <div key={upload.id} className="bg-white rounded-xl border border-slate-100/90 p-2 space-y-1.5 shadow-sm">
            <div className="flex items-center gap-2">
              {upload.status === 'uploading' && <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />}
              {upload.status === 'completed' && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
              {upload.status === 'failed' && <AlertCircle className="h-3.5 w-3.5 text-red-600" />}
              {upload.status === 'paused' && <Pause className="h-3.5 w-3.5 text-amber-500" />}
              {upload.status === 'pending' && <Upload className="h-3.5 w-3.5 text-slate-400" />}

              <span className="text-xs font-semibold text-slate-900 flex-1 truncate">{upload.metadata.fileName}</span>
              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', getStatusColor(upload.status))}>
                {labelUploadSessionStatus(upload.status)}
              </span>
            </div>

            <div className="space-y-0.5">
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn('h-full transition-all', getProgressBarColor(upload.status))}
                  style={{ width: `${getProgress(upload)}%` }}
                />
              </div>
              <div className={cn('flex items-center justify-between', FIELD_META)}>
                <span>
                  {getProgress(upload)}% · {formatFileSize(upload.uploadedBytes)} / {formatFileSize(upload.metadata.fileSize)}
                </span>
                {upload.metadata.geolocation && (
                  <span className="text-slate-400">
                    📍 {upload.metadata.geolocation.latitude.toFixed(4)}, {upload.metadata.geolocation.longitude.toFixed(4)}
                  </span>
                )}
              </div>
            </div>

            <div className={cn(FIELD_BODY, 'text-slate-400 space-y-0.5')}>
              <div>
                Technician: <span className="text-slate-600 font-mono">{upload.metadata.technician.email}</span>
              </div>
              {upload.error && <div className="text-red-600 italic">Error: {upload.error}</div>}
              {upload.status === 'failed' && (
                <div className="text-orange-800">
                  Needs attention — parts may retry when you are back online. You can pause or cancel below.
                  {uploadQueue.getRetryableChunks(upload.id).length === 0
                    ? ' If this stays stuck, try again from the evidence tab.'
                    : ''}
                </div>
              )}
            </div>

            {(upload.status === 'uploading' || upload.status === 'paused') && (
              <div className="flex gap-1">
                {upload.status === 'uploading' && (
                  <button
                    type="button"
                    onClick={() => handlePause(upload.id)}
                    className="flex-1 h-7 px-2 rounded-lg bg-amber-100 text-amber-700 text-[10px] font-bold hover:bg-amber-200 transition-colors flex items-center justify-center gap-1"
                  >
                    <Pause className="h-3 w-3" /> Pause
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleCancel(upload.id)}
                  className="flex-1 h-7 px-2 rounded-lg bg-red-100 text-red-700 text-[10px] font-bold hover:bg-red-200 transition-colors flex items-center justify-center gap-1"
                >
                  <Trash2 className="h-3 w-3" /> Cancel
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function getProgress(upload) {
  if (upload.metadata.fileSize === 0) return 0
  return Math.round((upload.uploadedBytes / upload.metadata.fileSize) * 100)
}

function getStatusColor(status) {
  const colors = {
    pending: 'bg-slate-100 text-slate-600',
    uploading: 'bg-blue-100 text-blue-700',
    paused: 'bg-amber-100 text-amber-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  }
  return colors[status] || 'bg-slate-100 text-slate-600'
}

function getProgressBarColor(status) {
  const colors = {
    pending: 'bg-slate-300',
    uploading: 'bg-blue-500',
    paused: 'bg-amber-400',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
  }
  return colors[status] || 'bg-slate-300'
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}
