/**
 * ManualEntrySheet — bottom sheet for manual time entry / correction.
 * Always requires an audit reason when editing an existing entry.
 */
import React, { useState } from 'react';
import { Clock, AlertTriangle, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const ENTRY_TYPES = [
  { value: 'work_start',   label: 'Work Started',   color: 'text-emerald-700 bg-emerald-50 border-emerald-300' },
  { value: 'work_stop',    label: 'Work Stopped',   color: 'text-slate-700 bg-slate-50 border-slate-300'       },
  { value: 'travel_start', label: 'Travel Started', color: 'text-blue-700 bg-blue-50 border-blue-300'          },
  { value: 'travel_end',   label: 'Arrived',        color: 'text-blue-600 bg-blue-50 border-blue-200'          },
  { value: 'break_start',  label: 'Break Started',  color: 'text-amber-700 bg-amber-50 border-amber-300'       },
  { value: 'break_end',    label: 'Break Ended',    color: 'text-amber-600 bg-amber-50 border-amber-200'       },
];

function timeToISO(dateBase, timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(dateBase);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export default function ManualEntrySheet({ existingEntry, jobs, date, onSave, onClose }) {
  const isEdit = !!existingEntry;
  const defaultTime = existingEntry
    ? format(new Date(existingEntry.timestamp), 'HH:mm')
    : format(new Date(), 'HH:mm');

  const [entryType, setEntryType] = useState(existingEntry?.entry_type || 'work_start');
  const [jobId,     setJobId]     = useState(existingEntry?.job_id || jobs[0]?.id || '');
  const [timeVal,   setTimeVal]   = useState(defaultTime);
  const [reason,    setReason]    = useState('');
  const [error,     setError]     = useState('');

  const handleSave = () => {
    if (isEdit && !reason.trim()) { setError('Audit reason is required when correcting an entry.'); return; }
    if (!timeVal) { setError('Time is required.'); return; }
    onSave({
      ...(existingEntry || {}),
      entry_type: entryType,
      job_id: jobId,
      timestamp: timeToISO(date, timeVal),
      source: isEdit ? 'manual' : 'manual',
      override_reason: reason || undefined,
      sync_status: 'pending',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-auto bg-white rounded-t-3xl p-5 pb-10 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />

        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-black text-slate-900">
            {isEdit ? 'Correct Time Entry' : 'Add Manual Entry'}
          </h3>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {isEdit && (
          <div className="flex items-start gap-2 mb-4 px-3 py-2.5 bg-amber-50 rounded-xl border border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black text-amber-800">Editing a submitted entry</p>
              <p className="text-[11px] text-amber-700">Original: {existingEntry?.entry_type} at {format(new Date(existingEntry?.timestamp), 'HH:mm:ss')} (source: {existingEntry?.source})</p>
            </div>
          </div>
        )}

        {/* Entry type */}
        <div className="mb-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Entry Type</p>
          <div className="grid grid-cols-2 gap-1.5">
            {ENTRY_TYPES.map(t => (
              <button key={t.value} onClick={() => setEntryType(t.value)}
                className={cn('h-10 rounded-xl border text-xs font-bold transition-all',
                  entryType === t.value ? t.color : 'bg-white border-slate-200 text-slate-500'
                )}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Time */}
        <div className="mb-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Time</p>
          <div className="flex items-center gap-3 bg-slate-50 rounded-xl border border-slate-200 px-3 py-2">
            <Clock className="h-4 w-4 text-slate-400" />
            <input
              type="time"
              value={timeVal}
              onChange={e => setTimeVal(e.target.value)}
              className="flex-1 bg-transparent text-sm font-mono font-bold text-slate-900 focus:outline-none"
            />
          </div>
        </div>

        {/* Job */}
        {jobs.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Job</p>
            <select
              value={jobId}
              onChange={e => setJobId(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </div>
        )}

        {/* Audit reason (always shown, required for edits) */}
        <div className="mb-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Reason / Audit Note {isEdit && <span className="text-red-500">*</span>}
          </p>
          <textarea
            value={reason}
            onChange={e => { setReason(e.target.value); setError(''); }}
            placeholder={isEdit ? 'Why is this entry being corrected? (required)' : 'Why was this not captured automatically? (optional)'}
            rows={2}
            className={cn(
              'w-full rounded-xl border px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1',
              error ? 'border-red-300 focus:ring-red-400' : 'border-slate-200 focus:ring-slate-400'
            )}
          />
          {error && <p className="text-xs text-red-600 mt-1 font-semibold">{error}</p>}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 h-12 rounded-2xl border border-slate-200 text-slate-600 font-semibold text-sm active:bg-slate-50">
            Cancel
          </button>
          <button onClick={handleSave}
            className="flex-1 h-12 rounded-2xl bg-slate-900 text-white font-bold text-sm active:opacity-80 flex items-center justify-center gap-2">
            <Check className="h-4 w-4" />
            {isEdit ? 'Save Correction' : 'Add Entry'}
          </button>
        </div>
      </div>
    </div>
  );
}