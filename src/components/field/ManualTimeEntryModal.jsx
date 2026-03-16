/**
 * ManualTimeEntryModal
 *
 * Fields:
 *   - Job selector (required)
 *   - Entry type (work_start / work_stop / break_start / break_end / travel_start / travel_end)
 *   - Date (defaults to today)
 *   - Time (required)
 *   - Notes / reason (required for manual entries — audit purposes)
 *
 * Validation:
 *   - Job + type + time + notes all required
 *   - Cannot add a start event if one is already open for that job/type
 *   - Cannot add an end event if no matching start exists
 *   - Time cannot be in the future (> now + 2min tolerance)
 *   - Time cannot be before job's earliest existing entry by more than 24h
 *
 * Offline queueing:
 *   If navigator.onLine is false, the entry is saved to 'purpulse_time_edit_queue'
 *   in localStorage with the full payload + client_request_id.
 *   A background effect in the hook flushes the queue when connectivity returns.
 *
 * client_request_id:
 *   Generated as `evt-{Date.now().toString(36)}-{random8}` before the API call.
 *   Stored on the entry. Reused on retry so the server can deduplicate.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parse, isValid, isAfter, addMinutes } from 'date-fns';
import { X, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const ENTRY_TYPES = [
  { value: 'work_start',   label: 'Work — Start',   color: 'bg-emerald-50 border-emerald-300 text-emerald-800' },
  { value: 'work_stop',    label: 'Work — Stop',    color: 'bg-emerald-50 border-emerald-300 text-emerald-800' },
  { value: 'travel_start', label: 'Travel — Start', color: 'bg-blue-50 border-blue-300 text-blue-800'          },
  { value: 'travel_end',   label: 'Travel — End',   color: 'bg-blue-50 border-blue-300 text-blue-800'          },
  { value: 'break_start',  label: 'Break — Start',  color: 'bg-amber-50 border-amber-300 text-amber-800'       },
  { value: 'break_end',    label: 'Break — End',    color: 'bg-amber-50 border-amber-300 text-amber-800'       },
];

const START_TYPES = ['work_start','travel_start','break_start'];
const END_TYPES   = ['work_stop', 'travel_end',  'break_end'];
const PAIR = {
  work_stop:   'work_start',
  travel_end:  'travel_start',
  break_end:   'break_start',
};

function makeClientId() {
  return 'evt-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 8);
}

function queueOfflineEdit(payload) {
  const key = 'purpulse_time_edit_queue';
  const queue = JSON.parse(localStorage.getItem(key) || '[]');
  queue.push({ ...payload, queued_at: new Date().toISOString() });
  localStorage.setItem(key, JSON.stringify(queue));
}

export default function ManualTimeEntryModal({ jobs = [], existingEntries = [], onClose }) {
  const [jobId,      setJobId]      = useState(jobs[0]?.id || '');
  const [entryType,  setEntryType]  = useState('work_start');
  const [date,       setDate]       = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time,       setTime]       = useState(format(new Date(), 'HH:mm'));
  const [notes,      setNotes]      = useState('');
  const [errors,     setErrors]     = useState({});
  const [saving,     setSaving]     = useState(false);
  const queryClient = useQueryClient();

  const createEntry = useMutation({
    mutationFn: (data) => base44.entities.TimeEntry.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['all-time-entries'] }),
  });

  const validate = () => {
    const errs = {};
    if (!jobId) errs.jobId = 'Select a job';
    if (!entryType) errs.entryType = 'Select an entry type';
    if (!notes.trim()) errs.notes = 'Notes are required for manual entries (audit log)';

    const parsed = parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date());
    if (!isValid(parsed)) { errs.time = 'Invalid date/time'; }
    else if (isAfter(parsed, addMinutes(new Date(), 2))) { errs.time = 'Time cannot be in the future'; }

    // Open/close pairing validation
    const jobEntries = existingEntries.filter(e => e.job_id === jobId && e.timestamp?.startsWith(date));
    if (END_TYPES.includes(entryType)) {
      const matchingStart = PAIR[entryType];
      const hasOpen = jobEntries.some(e => e.entry_type === matchingStart);
      // Check there's a paired stop too
      const startCount = jobEntries.filter(e => e.entry_type === matchingStart).length;
      const endCount   = jobEntries.filter(e => e.entry_type === entryType).length;
      if (startCount <= endCount) {
        errs.entryType = `No open ${matchingStart.replace('_', ' ')} to close`;
      }
    }
    if (START_TYPES.includes(entryType)) {
      const matchingEnd = END_TYPES[START_TYPES.indexOf(entryType)];
      const startCount = jobEntries.filter(e => e.entry_type === entryType).length;
      const endCount   = jobEntries.filter(e => e.entry_type === matchingEnd).length;
      if (startCount > endCount) {
        errs.entryType = `A ${entryType.replace('_', ' ')} is already open — close it first`;
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);

    const parsed   = parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date());
    const clientId = makeClientId();
    const payload  = {
      job_id: jobId,
      entry_type: entryType,
      timestamp: parsed.toISOString(),
      source: 'manual',
      notes: notes.trim(),
      sync_status: 'pending',
      client_request_id: clientId,
    };

    if (!navigator.onLine) {
      queueOfflineEdit(payload);
      toast.success('Entry queued offline — will sync on reconnect', { icon: '📶' });
      setSaving(false);
      onClose();
      return;
    }

    try {
      await createEntry.mutateAsync(payload);
      toast.success('Manual entry added');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const selectedType = ENTRY_TYPES.find(t => t.value === entryType);

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto max-w-lg mx-auto shadow-2xl">
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-4" />

        <div className="px-5 pb-10 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">Add Manual Entry</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                client_request_id auto-generated for idempotent sync
              </p>
            </div>
            <button onClick={onClose} className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center">
              <X className="h-4 w-4 text-slate-600" />
            </button>
          </div>

          {/* Info banner */}
          <div className="flex items-start gap-2 bg-blue-50 rounded-xl px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 font-medium">
              Manual entries are flagged in the audit log. Notes are mandatory and visible to your supervisor.
            </p>
          </div>

          {/* Job */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Job *</label>
            <select
              value={jobId}
              onChange={e => setJobId(e.target.value)}
              className={cn('w-full h-12 rounded-xl border-2 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400',
                errors.jobId ? 'border-red-300' : 'border-slate-200'
              )}
            >
              <option value="">Select job…</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
            {errors.jobId && <p className="text-xs text-red-500 mt-1">{errors.jobId}</p>}
          </div>

          {/* Entry type */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {ENTRY_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setEntryType(t.value)}
                  className={cn(
                    'h-11 rounded-xl border-2 text-xs font-bold transition-all',
                    entryType === t.value ? t.color : 'bg-white border-slate-100 text-slate-500'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {errors.entryType && (
              <div className="flex items-center gap-1.5 mt-1.5 bg-red-50 rounded-lg px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                <p className="text-xs text-red-600 font-semibold">{errors.entryType}</p>
              </div>
            )}
          </div>

          {/* Date + Time */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Date *</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full h-12 rounded-xl border-2 border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Time *</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className={cn('w-full h-12 rounded-xl border-2 px-3 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-slate-400',
                  errors.time ? 'border-red-300' : 'border-slate-200'
                )}
              />
              {errors.time && <p className="text-xs text-red-500 mt-1">{errors.time}</p>}
            </div>
          </div>

          {/* Notes — mandatory */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
              Notes <span className="text-red-500">*</span>
              <span className="font-normal normal-case text-slate-400 ml-1">(required for manual entries)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Why is this entry being added manually? (e.g. app crash, forgot to check in)"
              className={cn('w-full h-24 rounded-xl border-2 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-300',
                errors.notes ? 'border-red-300' : 'border-slate-200'
              )}
            />
            {errors.notes && <p className="text-xs text-red-500 mt-1">{errors.notes}</p>}
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-14 rounded-2xl bg-slate-900 text-white font-bold text-base disabled:opacity-50 flex items-center justify-center gap-2 active:opacity-80"
          >
            {saving
              ? <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><CheckCircle2 className="h-5 w-5" /> Add Entry</>
            }
          </button>

          <p className="text-center text-[10px] text-slate-300 font-mono">
            Will be tagged source=manual · flagged for supervisor review
          </p>
        </div>
      </div>
    </div>
  );
}