/**
 * JobSelectorModal — Pick a job when multiple are scheduled
 */
import React from 'react';
import { X, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

export default function JobSelectorModal({ jobs, onSelect, onCancel }) {
  const fmtTime = (t) => {
    try { return format(parseISO(t), 'h:mm a'); } catch { return t || '—'; }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center bg-black/50">
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl md:rounded-2xl shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white">
          <h2 className="text-lg font-black text-slate-900">Select a Job</h2>
          <button onClick={onCancel} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
            <X className="h-4 w-4 text-slate-600" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          {jobs.map(job => (
            <button
              key={job.id}
              onClick={() => onSelect(job.id)}
              className="w-full text-left p-4 rounded-2xl border-2 border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition-all active:bg-slate-100"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 truncate">{job.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{job.site_name || job.project_name || '—'}</p>
                  {job.scheduled_time && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      🕐 {fmtTime(job.scheduled_time)}
                    </p>
                  )}
                </div>
                <CheckCircle className="h-5 w-5 text-slate-300 flex-shrink-0 mt-0.5" />
              </div>
            </button>
          ))}

          {jobs.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <p className="text-sm">No jobs scheduled for today</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}