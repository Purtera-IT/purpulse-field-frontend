/**
 * FieldTimeTracker — TimeLog tab (G)
 * Clock-in/out, manual entry, and activity log.
 * Persists to Activity + AuditLog.
 */
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Square, Plus, Clock, Loader2, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { uuidv4 } from '@/lib/uuid';
import { defaultAdapters } from '@/lib/fieldAdapters';
import { useAuth } from '@/lib/AuthContext';
import { emitArrivalForClockIn } from '@/lib/travelArrivalEvent';
import { PreArrivalAckSheet } from '@/components/field/AcknowledgementSheets.jsx';

const EVENT_TYPES = ['clock_in','clock_out','start_step','end_step','upload','label','note_added'];
const EVENT_ICON = {
  clock_in:  '🟢', clock_out: '🔴', start_step: '▶️',
  end_step:  '✅', upload:    '📷', label:      '🏷️', note_added:'📝',
};

function fmtTs(ts) { try { return format(parseISO(ts), 'MMM d HH:mm:ss'); } catch { return ts || '—'; } }

function ActivityRow({ a }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-base mt-0.5 flex-shrink-0">{EVENT_ICON[a.event_type] || '⚡'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-800 capitalize">{a.event_type?.replace(/_/g,' ')}</p>
        <p className="text-[10px] text-slate-400 truncate">{a.user_id}</p>
        {a.meta?.note && <p className="text-[11px] text-slate-500 mt-0.5 italic">"{a.meta.note}"</p>}
      </div>
      <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">{fmtTs(a.timestamp)}</span>
    </div>
  );
}

export default function FieldTimeTracker({ job, activities, adapters, onRefresh }) {
  const adapter = adapters?.activity || defaultAdapters.activity;
  const { user } = useAuth();
  const [clocked,   setClockedIn]  = useState(() => activities.some(a => a.event_type === 'clock_in'));
  const [showManual,setShowManual] = useState(false);
  const [arrivalAckOpen, setArrivalAckOpen] = useState(false);
  const [manualType,setManualType] = useState('note_added');
  const [manualNote,setManualNote] = useState('');
  const [manualTs,  setManualTs]   = useState('');
  const qc = useQueryClient();

  const log = useMutation({
    mutationFn: data => adapter.logActivity(data, 'admin@purpulse.com'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fj-activities', job.id] }); onRefresh?.(); },
  });

  const performClockIn = async (arrivalScopeAcknowledgements) => {
    const ts = new Date().toISOString();
    try {
      await emitArrivalForClockIn({ job, user, timestamp: ts, arrivalScopeAcknowledgements });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not queue arrival telemetry');
      return;
    }
    log.mutate({
      id:              uuidv4(),
      event_type:      'clock_in',
      user_id:         'admin@purpulse.com',
      work_order_id:   job.id,
      timestamp:       ts,
      meta:            { device_id: 'device-web', app_version: '2.4.1' },
    });
    setClockedIn(true);
    toast.success('Clocked in');
  };

  const handleClockOut = () => {
    log.mutate({
      id:              uuidv4(),
      event_type:      'clock_out',
      user_id:         'admin@purpulse.com',
      work_order_id:   job.id,
      timestamp:       new Date().toISOString(),
      meta:            { device_id: 'device-web', app_version: '2.4.1' },
    });
    setClockedIn(false);
    toast.success('Clocked out');
  };

  const handleManualSubmit = () => {
    if (!manualTs && !manualNote) { toast.error('Add a timestamp or note'); return; }
    log.mutate({
      id:            uuidv4(),
      event_type:    manualType,
      user_id:       'admin@purpulse.com',
      work_order_id: job.id,
      timestamp:     manualTs ? new Date(manualTs).toISOString() : new Date().toISOString(),
      meta:          { note: manualNote || undefined },
      session_id:    'manual-' + uuidv4().slice(0,8),
    });
    setManualNote(''); setManualTs(''); setShowManual(false);
    toast.success('Activity logged');
  };

  const sorted = [...activities].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <div className="space-y-4">
      <PreArrivalAckSheet
        open={arrivalAckOpen}
        onOpenChange={setArrivalAckOpen}
        jobLabel={job?.title}
        onConfirm={(ackState) => {
          void performClockIn(ackState);
        }}
      />

      {/* Clock in/out */}
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Session Control</p>
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', clocked ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
            {clocked ? '● Clocked In' : '○ Off Clock'}
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setArrivalAckOpen(true)} disabled={clocked || log.isPending}
            className="flex-1 h-11 rounded-[8px] bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-emerald-700 transition-colors">
            <Play className="h-4 w-4" /> Clock In
          </button>
          <button onClick={handleClockOut} disabled={!clocked || log.isPending}
            className="flex-1 h-11 rounded-[8px] bg-red-600 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-red-700 transition-colors">
            <Square className="h-4 w-4" /> Clock Out
          </button>
        </div>
      </div>

      {/* Manual entry */}
      <div className="bg-white rounded-xl border border-slate-100">
        <button onClick={() => setShowManual(s => !s)}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors rounded-xl">
          <Edit3 className="h-4 w-4 text-slate-400" />
          <p className="text-sm font-bold text-slate-700 flex-1">Manual Entry</p>
          <Plus className={cn('h-4 w-4 text-slate-400 transition-transform', showManual && 'rotate-45')} />
        </button>
        {showManual && (
          <div className="px-4 pb-4 space-y-3 border-t border-slate-50">
            <div className="pt-2 grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Event Type</label>
                <select value={manualType} onChange={e => setManualType(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 text-xs font-semibold px-3 focus:outline-none focus:ring-1 focus:ring-slate-400 capitalize bg-white">
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Timestamp</label>
                <input type="datetime-local" value={manualTs} onChange={e => setManualTs(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 text-xs px-3 focus:outline-none focus:ring-1 focus:ring-slate-400" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Note</label>
              <input value={manualNote} onChange={e => setManualNote(e.target.value)}
                placeholder="Optional note…"
                className="w-full h-9 rounded-lg border border-slate-200 text-xs px-3 focus:outline-none focus:ring-1 focus:ring-slate-400" />
            </div>
            <button onClick={handleManualSubmit} disabled={log.isPending}
              className="w-full h-10 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-700 disabled:opacity-50">
              {log.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Plus className="h-3.5 w-3.5" /> Log Activity</>}
            </button>
          </div>
        )}
      </div>

      {/* Activity log */}
      <div className="bg-white rounded-xl border border-slate-100">
        <div className="px-4 py-2.5 border-b border-slate-50 flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Activity Log ({sorted.length})</p>
        </div>
        <div className="px-4 py-2 max-h-72 overflow-y-auto">
          {sorted.length === 0 ? (
            <p className="text-center text-slate-400 text-xs py-6">No activities yet.</p>
          ) : sorted.map(a => <ActivityRow key={a.id} a={a} />)}
        </div>
      </div>
    </div>
  );
}