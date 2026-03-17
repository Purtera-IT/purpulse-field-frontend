/**
 * JobActionBar — Persistent bottom action bar for Job Detail cockpit.
 * Contains: compact timer + Start/Pause/Stop + Photo + Note + Blocker + Chat
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play, Pause, Square, Camera, StickyNote, AlertOctagon, MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import EvidenceCapture from './EvidenceCapture';
import ChatView from './ChatView';
import BlockerForm from './BlockerForm';

function fmt(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function makeClientId() {
  return 'evt-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2,8);
}

function getTimerState(entries = []) {
  if (!entries.length) return { state: 'idle', since: null };
  const latest = [...entries].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
  const map = { work_start: 'working', break_start: 'on_break', travel_start: 'traveling' };
  return { state: map[latest.entry_type] || 'idle', since: latest.timestamp };
}

function calcElapsed(entries = []) {
  const sorted = [...entries].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
  let ms = 0, ws = null;
  for (const e of sorted) {
    if (e.entry_type === 'work_start') ws = new Date(e.timestamp);
    if (e.entry_type === 'work_stop' && ws) { ms += new Date(e.timestamp) - ws; ws = null; }
  }
  if (ws) ms += Date.now() - ws;
  return Math.floor(ms / 1000);
}

const STATE_CFG = {
  working:   { dot: 'bg-emerald-500', label: 'Working',  labelCls: 'text-emerald-600' },
  on_break:  { dot: 'bg-amber-500',   label: 'On Break', labelCls: 'text-amber-600'   },
  traveling: { dot: 'bg-blue-500',    label: 'Traveling',labelCls: 'text-blue-600'    },
  idle:      { dot: 'bg-slate-300',   label: 'Ready',    labelCls: 'text-slate-400'   },
};

// ── Note sheet ────────────────────────────────────────────────────────
function NoteSheet({ jobId, onClose }) {
  const [note, setNote] = useState('');
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: () => base44.entities.ChatMessage.create({
      job_id: jobId,
      body: `📝 Note: ${note}`,
      sent_at: new Date().toISOString(),
      sync_status: 'pending',
      client_message_id: makeClientId(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', jobId] });
      toast.success('Note added');
      onClose();
    },
  });
  return (
    <div className="p-4 pb-8">
      <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
      <h3 className="text-base font-black text-slate-900 mb-3">Add Note</h3>
      <textarea
        autoFocus
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Describe what you observed, completed, or need attention…"
        rows={4}
        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-400"
      />
      <div className="flex gap-2 mt-3">
        <button onClick={onClose} className="flex-1 h-12 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm">Cancel</button>
        <button
          disabled={!note.trim() || save.isPending}
          onClick={() => save.mutate()}
          className="flex-1 h-12 rounded-xl bg-slate-900 text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {save.isPending ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Note'}
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────
export default function JobActionBar({ job, onOpenChat, isReadOnly }) {
  const [elapsed, setElapsed] = useState(0);
  const [sheet, setSheet]     = useState(null); // 'photo' | 'note' | 'blocker' | 'chat'
  const [stopConfirm, setStopConfirm] = useState(false);
  const queryClient = useQueryClient();

  const { data: entries = [] } = useQuery({
    queryKey: ['time-entries', job.id],
    queryFn:  () => base44.entities.TimeEntry.filter({ job_id: job.id }, '-timestamp'),
  });

  const { state } = getTimerState(entries);
  const cfg       = STATE_CFG[state];

  useEffect(() => {
    setElapsed(calcElapsed(entries));
    if (state === 'idle') return;
    const id = setInterval(() => setElapsed(calcElapsed(entries)), 1000);
    return () => clearInterval(id);
  }, [entries, state]);

  const fire = useMutation({
    mutationFn: (type) => base44.entities.TimeEntry.create({
      job_id: job.id,
      entry_type: type,
      timestamp: new Date().toISOString(),
      source: 'app',
      sync_status: 'pending',
      client_request_id: makeClientId(),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['time-entries', job.id] }),
  });

  const handleTimer = () => {
    if (isReadOnly) return;
    if (state === 'idle') {
      haptic('success');
      fire.mutate('work_start');
      toast.success('Work started');
    } else if (state === 'working') {
      haptic('warning');
      setStopConfirm(true);
    } else if (state === 'on_break') {
      haptic('success');
      fire.mutate('break_end');
      toast.success('Break ended — back to work');
    }
  };

  const handleBreak = () => {
    if (state !== 'working' || isReadOnly) return;
    haptic('tap');
    fire.mutate('break_start');
    toast.success('Break time started');
  };

  const timerBg = state === 'working'   ? 'bg-emerald-600 text-white'
                : state === 'on_break'  ? 'bg-amber-500 text-white'
                : state === 'traveling' ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-white';

  const timerLabel = state === 'idle' ? 'Ready' : state === 'on_break' ? 'Resume' : state === 'working' ? 'Working' : '●';

  const ACTION_BTNS = [
    { id: 'photo',   Icon: Camera,        label: 'Photo',   cls: 'text-slate-700', bg: 'bg-slate-100' },
    { id: 'note',    Icon: StickyNote,    label: 'Note',    cls: 'text-slate-700', bg: 'bg-slate-100' },
    { id: 'blocker', Icon: AlertOctagon,  label: 'Blocker', cls: 'text-red-600',   bg: 'bg-red-50'    },
    { id: 'chat',    Icon: MessageCircle, label: 'Chat',    cls: 'text-blue-600',  bg: 'bg-blue-50'   },
  ];

  return (
    <>
      {/* ── Bar ───────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-sm">
        <div className="max-w-lg mx-auto px-3 py-1.5 flex items-center gap-1.5">

          {/* Timer block */}
          <button
            onClick={handleTimer}
            disabled={isReadOnly || fire.isPending}
            className={cn(
              'flex items-center gap-1.5 h-10 px-2.5 rounded-md transition-all flex-shrink-0 min-w-[110px] disabled:opacity-50',
              timerBg
            )}
            aria-label={timerLabel + ' timer'}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', state !== 'idle' ? 'bg-white/70' : 'bg-white/30')} />
            <div className="flex flex-col items-start leading-none">
              <span className="text-[8px] font-black opacity-75 uppercase tracking-wide">{cfg.label}</span>
              <span className="font-mono font-black text-sm tabular-nums">{fmt(elapsed)}</span>
            </div>
            <div className="flex items-center justify-center h-6 w-6 rounded bg-white/20 ml-auto flex-shrink-0">
              {state === 'idle'    ? <Play  className="h-3 w-3" /> :
               state === 'working' ? <Pause className="h-3 w-3" /> :
                                     <Play  className="h-3 w-3" />}
            </div>
          </button>

          <div className="w-px h-7 bg-slate-200 flex-shrink-0" />

          {/* Action buttons — 36px, rectangular */}
          {ACTION_BTNS.map(btn => {
            const Icon = btn.Icon;
            return (
              <button
                key={btn.id}
                onClick={() => setSheet(btn.id)}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-10 rounded-md transition-all active:scale-95 gap-0.5',
                  btn.bg
                )}
                aria-label={btn.label}
              >
                <Icon className={cn('h-4 w-4', btn.cls)} />
                <span className={cn('text-[9px] font-semibold', btn.cls)}>{btn.label}</span>
              </button>
            );
          })}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>

      {/* Stop confirmation */}
      {stopConfirm && (
        <div className="fixed inset-0 z-50 flex items-end" role="dialog">
          <div className="absolute inset-0 bg-black/50" onClick={() => setStopConfirm(false)} />
          <div className="relative w-full max-w-lg mx-auto bg-white rounded-t-[12px] p-6 pb-10">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
            <div className="text-center mb-5">
              <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                <Square className="h-6 w-6 text-red-600" />
              </div>
              <h2 className="text-lg font-black text-slate-900">End work session?</h2>
              <p className="text-slate-500 text-sm mt-1 font-mono font-bold">{fmt(elapsed)} elapsed</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { handleBreak(); setStopConfirm(false); }}
                className="flex-1 h-11 py-3 rounded-[8px] bg-amber-50 text-amber-700 font-bold text-sm flex items-center justify-center gap-2 border border-amber-200">
                <Pause className="h-4 w-4" /> Break
              </button>
              <button
                onClick={() => { haptic('stop'); fire.mutate('work_stop'); toast.success('Work session ended'); setStopConfirm(false); }}
                className="flex-1 h-11 py-3 rounded-[8px] bg-red-600 text-white font-bold text-sm flex items-center justify-center gap-2">
                <Square className="h-4 w-4" /> End
              </button>
            </div>
            <button onClick={() => setStopConfirm(false)}
              className="w-full mt-2 h-11 rounded-[8px] border-2 border-slate-200 text-slate-600 font-semibold text-sm">
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ── Sheets ───────────────────────────────────────── */}
      <Sheet open={sheet === 'photo'} onOpenChange={v => !v && setSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto pb-10">
          <div className="pt-3 px-4">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
            <h3 className="text-base font-black text-slate-900 mb-4">Capture Evidence</h3>
            <EvidenceCapture
              jobId={job.id}
              evidenceType="site_photo"
              onCaptured={() => { setSheet(null); toast.success('Photo captured'); }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={sheet === 'note'} onOpenChange={v => !v && setSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-2">
          <NoteSheet jobId={job.id} onClose={() => setSheet(null)} />
        </SheetContent>
      </Sheet>

      <Sheet open={sheet === 'blocker'} onOpenChange={v => !v && setSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto pb-10">
          <div className="pt-3 px-4">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
            <h3 className="text-base font-black text-red-700 mb-4">Report Blocker</h3>
            <BlockerForm jobId={job.id} onSubmitted={() => { setSheet(null); toast.success('Blocker reported'); }} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={sheet === 'chat'} onOpenChange={v => !v && setSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-0 h-[70vh]">
          <div className="pt-3 px-4 pb-1">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3" />
            <h3 className="text-sm font-black text-slate-900 mb-3">Job Chat</h3>
          </div>
          <div className="h-[calc(100%-60px)] overflow-hidden">
            <ChatView jobId={job.id} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}