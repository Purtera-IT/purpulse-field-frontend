/**
 * UploadProgressIndicator — Shows pending upload sessions with progress, status, and retry info
 */

import React, { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Pause, Play, Trash2, Upload, Wifi, WifiOff } from 'lucide-react'
import { uploadQueue } from '@/lib/uploadQueue'
import { cn } from '@/lib/utils'

export default function UploadProgressIndicator({ jobId, isOnline }) {
  const [uploads, setUploads] = useState([])

  // Poll upload sessions for this job
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
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Upload className="h-4 w-4 text-blue-600" />
        <p className="text-sm font-semibold text-blue-900">Pending Uploads</p>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <span className="text-blue-700">
          {inProgressCount > 0 && <span className="font-bold text-blue-600">{inProgressCount} uploading</span>}
          {completedCount > 0 && <span className="text-green-600 ml-2">✓ {completedCount} complete</span>}
          {failedCount > 0 && <span className="text-red-600 ml-2">✗ {failedCount} failed</span>}
        </span>
      </div>

      {/* Upload list */}
      <div className="space-y-2 border-t border-blue-200 pt-2">
        {uploads.map(upload => (
          <div key={upload.id} className="bg-white rounded-lg p-2 space-y-1.5">
            {/* Title + status */}
            <div className="flex items-center gap-2">
              {upload.status === 'uploading' && <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />}
              {upload.status === 'completed' && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
              {upload.status === 'failed' && <AlertCircle className="h-3.5 w-3.5 text-red-600" />}
              {upload.status === 'paused' && <Pause className="h-3.5 w-3.5 text-amber-500" />}
              {upload.status === 'pending' && <Upload className="h-3.5 w-3.5 text-slate-400" />}

              <span className="text-xs font-semibold text-slate-900 flex-1 truncate">{upload.metadata.fileName}</span>
              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', getStatusColor(upload.status))}>
                {getStatusLabel(upload.status)}
              </span>
            </div>

            {/* Progress bar */}
            <div className="space-y-0.5">
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn('h-full transition-all', getProgressBarColor(upload.status))}
                  style={{ width: `${getProgress(upload)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500">
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

            {/* Metadata */}
            <div className="text-[10px] text-slate-400 space-y-0.5">
              <div>
                Technician: <span className="text-slate-600 font-mono">{upload.metadata.technician.email}</span>
              </div>
              {upload.error && <div className="text-red-600 italic">Error: {upload.error}</div>}
              {upload.status === 'failed' && (
                <div className="text-orange-600">
                  Retries exhausted. {uploadQueue.getRetryableChunks(upload.id).length === 0 ? 'Manual retry needed.' : 'Waiting for retry...'}
                </div>
              )}
            </div>

            {/* Actions */}
            {(upload.status === 'uploading' || upload.status === 'paused') && (
              <div className="flex gap-1">
                {upload.status === 'uploading' && (
                  <button
                    onClick={() => handlePause(upload.id)}
                    className="flex-1 h-6 px-2 rounded-sm bg-amber-100 text-amber-700 text-[10px] font-bold hover:bg-amber-200 transition-colors flex items-center justify-center gap-1"
                  >
                    <Pause className="h-3 w-3" /> Pause
                  </button>
                )}
                <button
                  onClick={() => handleCancel(upload.id)}
                  className="flex-1 h-6 px-2 rounded-sm bg-red-100 text-red-700 text-[10px] font-bold hover:bg-red-200 transition-colors flex items-center justify-center gap-1"
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

function getStatusLabel(status) {
  const labels = {
    pending: 'Pending',
    uploading: 'Uploading',
    paused: 'Paused',
    completed: 'Complete',
    failed: 'Failed',
  }
  return labels[status] || status
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