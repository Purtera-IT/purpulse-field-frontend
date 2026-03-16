/**
 * TimeSegmentModal — edit or view a single time segment (start→end pair).
 *
 * Locked (admin-approved) entries:
 *   - All fields read-only
 *   - Shows gold lock badge + approver name + approved_at
 *   - "Request Unlock" option sends a note (stored as override_reason on a pending SyncQueue item)
 *
 * Editing an unlocked entry:
 *   - Inline time pickers for start and end
 *   - Notes textarea
 *   - Overlap validation before saving
 *   - Produces new TimeEntry records with source='drag_edit', new client_request_id
 *   - Offline: if no network, edit is queued in localStorage and flushed on reconnect
 *
 * client_event_id (client_request_id) pattern:
 *   Generated as: `evt-${Date.now().toString(36)}-${Math.random().toString(36).substr(2,8)}`
 *   Attached to every TimeEntry write. Server uses it for idempotent deduplication.
 *   If the mutation fails and is retried, the same key is reused (stored in queue).
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parse, isValid, isBefore } from 'date-fns';
import { Lock, ShieldCheck, X, Clock, Pencil, AlertTriangle, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const SEG_LABELS = { work: 'Work', travel: 'Travel', break: 'Break' };
const SEG_COLORS = {
  work:   { badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: 'text-emerald-600' },
  travel: { badge: 'bg-blue-100 text-blue-800 border-blue-300',         icon: 'text-blue-600'    },
  break:  { badge: 'bg-amber-100 text-amber-800 border-amber-300',       icon: 'text-amber-600'   },
};

function makeClientId() {
  return 'evt-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 8);
}

/** Queue an edit offline (localStorage) */
function queueOfflineEdit(payload) {
  const key = 'purpulse_time_edit_queue';
  const queue = JSON.parse(localStorage.getItem(key) || '[]');
  queue.push({ ...payload, queued_at: new Date().toISOString() });
  localStorage.setItem(key, JSON.stringify(queue));
}

/** Duration display */
function durationStr(start, end) {
  const ms = end - start;
  if (ms <= 0) return '0m';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function TimeInput({ label, value, onChange, disabled }) {
  return (
    <div className="flex-1">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">{label}</label>
      <input
        type="time"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          'w-full h-12 rounded-xl border-2 px-3 text-base font-mono font-bold focus:outline-none focus:ring-2 focus:ring-slate-400',
          disabled ? 'bg-slate-50 border-slate-100 text-slate-400' : 'bg-white border-slate-200 text-slate-900'
        )}
      />
    </div>
  );
}

export default function TimeSegmentModal({ seg, allSegments, onClose }) {
  const isLocked = seg.locked;
  const queryClient = useQueryClient();

  const [startTime, setStartTime] = useState(format(seg.start, 'HH:mm'));
  const [endTime,   setEndTime]   = useState(seg.endEntry ? format(seg.end, 'HH:mm') : '');
  const [notes,     setNotes]     = useState(seg.startEntry?.notes || '');
  const [unlockNote, setUnlockNote] = useState('');
  const [showUnlock, setShowUnlock] = useState(false);
  const [saving, setSaving]         = useState(false);

  const updateEntry = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TimeEntry.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['all-time-entries'] }),
  });

  const parseDatetime = (timeStr, refDate) => {
    const d = parse(timeStr, 'HH:mm', refDate);
    return isValid(d) ? d : null;
  };

  const handleSave = async () => {
    const newStart = parseDatetime(startTime, seg.start);
    const newEnd   = endTime ? parseDatetime(endTime, seg.start) : null;

    if (!newStart) { toast.error('Invalid start time'); return; }
    if (newEnd && isBefore(newEnd, newStart)) { toast.error('End time must be after start time'); return; }

    // Overlap detection (same type only)
    const others = allSegments.filter(s => s.type === seg.type && s.id !== seg.id);
    const checkEnd = newEnd || new Date();
    const overlap = others.some(s => newStart < s.end && checkEnd > s.start);
    if (overlap) {
      toast.error(`This edit overlaps another ${seg.type} segment — adjust times or remove the conflicting entry`, { duration: 4000 });
      return;
    }

    setSaving(true);
    const cid = makeClientId();
    const payload = { source: 'drag_edit', sync_status: 'pending', notes, client_request_id: cid };

    if (!navigator.onLine) {
      // Offline: queue for later
      queueOfflineEdit({ entryId: seg.startEntry.id, data: { ...payload, timestamp: newStart.toISOString() } });
      if (seg.endEntry && newEnd) {
        queueOfflineEdit({ entryId: seg.endEntry.id, data: { ...payload, timestamp: newEnd.toISOString(), client_request_id: makeClientId() } });
      }
      toast.success('Saved offline — will sync when connected', { icon: '📶' });
      setSaving(false);
      onClose();
      return;
    }

    try {
      await updateEntry.mutateAsync({ id: seg.startEntry.id, data: { ...payload, timestamp: newStart.toISOString() } });
      if (seg.endEntry && newEnd) {
        await updateEntry.mutateAsync({ id: seg.endEntry.id, data: { ...payload, timestamp: newEnd.toISOString(), client_request_id: makeClientId() } });
      }
      toast.success('Time entry updated');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleRequestUnlock = async () => {
    if (!unlockNote.trim()) { toast.error('Please describe why unlock is needed'); return; }
    // Store as a SyncQueue item for admin review
    await base44.entities.SyncQueue.create({
      entity_type: 'time_entry',
      entity_id: seg.startEntry.id,
      action: 'update',
      payload: JSON.stringify({ unlock_request: true, reason: unlockNote }),
      client_request_id: makeClientId(),
      status: 'pending',
      job_id: seg.startEntry.job_id,
    });
    toast.success('Unlock request sent to admin');
    setShowUnlock(false);
    onClose();
  };

  const segColor = SEG_COLORS[seg.type];
  const duration = durationStr(seg.start, seg.end);

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto max-w-lg mx-auto shadow-2xl">
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-4" />

        <div className="px-5 pb-8 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className={cn('px-3 py-1 rounded-full text-sm font-bold border', segColor.badge)}>
                {SEG_LABELS[seg.type]}
              </span>
              <span className="text-xs font-mono text-slate-400 font-semibold">{duration}</span>
              {isLocked && (
                <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                  <Lock className="h-3 w-3" /> Locked
                </span>
              )}
            </div>
            <button onClick={onClose} className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center">
              <X className="h-4 w-4 text-slate-600" />
            </button>
          </div>

          {/* Lock info */}
          {isLocked && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <p className="text-sm font-bold text-amber-800">Approved & Locked</p>
              </div>
              {seg.startEntry?.approved_by && (
                <p className="text-xs text-amber-700">
                  By <span className="font-semibold">{seg.startEntry.approved_by}</span>
                  {seg.startEntry.approved_at && ` on ${format(new Date(seg.startEntry.approved_at), 'MMM d, h:mm a')}`}
                </p>
              )}
              <p className="text-xs text-amber-600 mt-1">
                This entry is immutable. Contact your dispatcher or request an unlock below.
              </p>
            </div>
          )}

          {/* client_event_id debug info (collapsed) */}
          <details className="text-[10px]">
            <summary className="text-slate-400 cursor-pointer font-semibold font-mono">Audit / Event IDs</summary>
            <div className="mt-1.5 bg-slate-50 rounded-xl p-3 space-y-1 font-mono">
              <p><span className="text-slate-400">start_entry_id: </span><span className="text-slate-700">{seg.startEntry?.id}</span></p>
              {seg.endEntry && <p><span className="text-slate-400">end_entry_id: </span><span className="text-slate-700">{seg.endEntry?.id}</span></p>}
              <p><span className="text-slate-400">client_request_id: </span><span className="text-slate-700">{seg.startEntry?.client_request_id || '—'}</span></p>
              <p><span className="text-slate-400">source: </span><span className="text-slate-700">{seg.startEntry?.source || 'app'}</span></p>
            </div>
          </details>

          {/* Time inputs */}
          <div className="flex gap-3">
            <TimeInput label="Start" value={startTime} onChange={setStartTime} disabled={isLocked} />
            {seg.endEntry && (
              <TimeInput label="End" value={endTime} onChange={setEndTime} disabled={isLocked} />
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              disabled={isLocked}
              placeholder={isLocked ? 'No notes' : 'Reason for adjustment, context…'}
              className={cn(
                'w-full h-20 rounded-xl border-2 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-300',
                isLocked ? 'bg-slate-50 border-slate-100 text-slate-400' : 'bg-white border-slate-200'
              )}
            />
          </div>

          {/* Unlock request */}
          {isLocked && !showUnlock && (
            <button onClick={() => setShowUnlock(true)}
              className="w-full h-12 rounded-2xl border-2 border-amber-300 text-amber-700 font-semibold text-sm flex items-center justify-center gap-2"
            >
              <Send className="h-4 w-4" /> Request Unlock
            </button>
          )}
          {isLocked && showUnlock && (
            <div className="space-y-2 bg-amber-50 rounded-2xl p-4">
              <p className="text-sm font-bold text-amber-800">Unlock request</p>
              <textarea
                value={unlockNote}
                onChange={e => setUnlockNote(e.target.value)}
                placeholder="Explain why this entry needs editing…"
                className="w-full h-16 rounded-xl border-2 border-amber-200 px-3 py-2 text-sm resize-none focus:outline-none bg-white"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowUnlock(false)} className="flex-1 h-10 rounded-xl border border-amber-200 text-amber-700 text-sm font-semibold">Cancel</button>
                <button onClick={handleRequestUnlock} className="flex-1 h-10 rounded-xl bg-amber-600 text-white text-sm font-semibold">Send Request</button>
              </div>
            </div>
          )}

          {/* Save */}
          {!isLocked && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-14 rounded-2xl bg-slate-900 text-white font-bold text-base disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving
                ? <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><Pencil className="h-5 w-5" /> Save Changes</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}