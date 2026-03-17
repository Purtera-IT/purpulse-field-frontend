import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Play, Pause, Square, Coffee, Car, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';

// ── helpers ──────────────────────────────────────────────────────────
function fmt(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function makeClientId() {
  return 'evt-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2,8);
}

function getState(entries = []) {
  if (!entries.length) return { state: 'idle', since: null };
  const latest = [...entries].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
  const map = { work_start: 'working', break_start: 'on_break', travel_start: 'traveling' };
  return { state: map[latest.entry_type] || 'idle', since: latest.timestamp };
}

function calcWork(entries = []) {
  const sorted = [...entries].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
  let ms = 0, ws = null;
  for (const e of sorted) {
    if (e.entry_type === 'work_start') ws = new Date(e.timestamp);
    if (e.entry_type === 'work_stop' && ws) { ms += new Date(e.timestamp) - ws; ws = null; }
  }
  if (ws) ms += Date.now() - ws;
  return Math.floor(ms / 1000);
}

// ── state config ─────────────────────────────────────────────────────
const STATE_CFG = {
  working:    { bg: 'bg-emerald-50',  fg: 'text-emerald-600', dot: 'bg-emerald-500', label: 'Working',    pulse: true  },
  on_break:   { bg: 'bg-amber-50',    fg: 'text-amber-600',   dot: 'bg-amber-500',   label: 'On Break',   pulse: false },
  traveling:  { bg: 'bg-blue-50',     fg: 'text-blue-600',    dot: 'bg-blue-500',    label: 'Traveling',  pulse: true  },
  idle:       { bg: 'bg-slate-50',    fg: 'text-slate-400',   dot: 'bg-slate-300',   label: 'Ready',      pulse: false },
};

// ── Stop Confirmation Modal ───────────────────────────────────────────
function StopModal({ elapsed, onConfirm, onCancel, isPending }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true" aria-label="Stop timer confirmation">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative w-full bg-white rounded-t-[12px] p-6 pb-10 shadow-[0_2px_6px_rgba(15,23,36,0.06)] max-w-lg mx-auto">
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-6" />

        <div className="flex flex-col items-center text-center mb-6">
          <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center mb-3">
            <Square className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">End work session?</h2>
          <p className="text-slate-500 text-sm mt-1">
            Elapsed: <span className="font-mono font-bold text-slate-900">{fmt(elapsed)}</span>
          </p>
        </div>

        <div className="bg-slate-50 rounded-[8px] p-3 text-xs text-slate-500 mb-5 font-mono leading-relaxed">
          <p className="text-slate-400 mb-1 font-sans font-semibold text-[10px] uppercase tracking-wide">Event payload</p>
          {`{ "event_type": "work_stop", "device_ts": "${new Date().toISOString()}" }`}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 h-12 rounded-[8px] border-2 border-slate-200 text-slate-700 font-semibold text-sm active:opacity-70"
          >
            Keep Working
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 h-12 rounded-[8px] bg-red-600 text-white font-semibold text-sm active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
            aria-label="Confirm stop timer"
          >
            {isPending
              ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><Square className="h-4 w-4" /> End Session</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────
export default function TimerPanel({ jobId, statusLabel, compact = false }) {
  const [elapsed, setElapsed]       = useState(0);
  const [showStop, setShowStop]     = useState(false);
  const queryClient = useQueryClient();

  const { data: entries = [] } = useQuery({
    queryKey: ['time-entries', jobId],
    queryFn: () => base44.entities.TimeEntry.filter({ job_id: jobId }, '-timestamp'),
  });

  const activeState = getState(entries);
  const cfg = STATE_CFG[activeState.state];

  useEffect(() => {
    setElapsed(calcWork(entries));
    if (activeState.state === 'idle') return;
    const id = setInterval(() => setElapsed(calcWork(entries)), 1000);
    return () => clearInterval(id);
  }, [entries, activeState.state]);

  const createEntry = useMutation({
    mutationFn: (type) => base44.entities.TimeEntry.create({
      job_id: jobId,
      entry_type: type,
      timestamp: new Date().toISOString(),
      source: 'app',
      sync_status: 'pending',
      client_request_id: makeClientId(),
    }),
    onMutate: (type) => {
      // Log optimistic event — mirrors POST /api/v1/jobs/{jobId}/events
      const payload = {
        client_event_id: makeClientId(),
        event_type: type,
        job_id: jobId,
        device_ts: new Date().toISOString(),
        device_meta: { battery: null, gps_accuracy: null },
      };
      console.info('[Purpulse][TimerPanel] optimistic event:', JSON.stringify(payload, null, 2));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['time-entries', jobId] }),
  });

  const fire = (type, successMsg) => {
    // Haptic feedback per event type
    if (type === 'work_start' || type === 'break_end' || type === 'travel_end') haptic('success');
    else if (type === 'break_start') haptic('warning');
    else if (type === 'travel_start') haptic('tap');
    createEntry.mutate(type);
    toast.success(successMsg, { duration: 2500 });
  };

  const confirmStop = () => {
    haptic('stop');
    fire('work_stop', 'Work session ended');
    setShowStop(false);
    // Undo toast — 8s window
    toast('Work session ended', {
      duration: 8000,
      action: {
        label: 'Undo',
        onClick: () => { fire('work_start', 'Session resumed'); },
      },
    });
  };

  // ── Compact inline mode (used in JobDetail sticky strip) ─────────────
  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-1">
        <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', cfg.dot)} />
        <span className="text-xs font-bold text-white opacity-90">{statusLabel || cfg.label}</span>
        <span className="font-mono font-black text-sm tabular-nums text-white ml-1">{fmt(elapsed)}</span>
      </div>
    );
  }

  return (
    <>
      <div className={cn('rounded-[8px] p-4 transition-colors duration-300', cfg.bg)}>

        {/* Status badge — small rectangular enterprise style */}
        <div className="flex items-center justify-center mb-3">
          <div
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] border font-semibold uppercase tracking-wide text-[10px]',
              cfg.bg, cfg.fg,
            )}
            aria-live="polite" aria-atomic="true" aria-label={`Timer state: ${cfg.label}`}
          >
            <span
              className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', cfg.dot)}
              aria-hidden="true"
            />
            {statusLabel || cfg.label}
          </div>
        </div>

        {/* Numeric display — capped at 48px */}
        <div
          className={cn('text-center font-mono font-bold tabular-nums leading-none mb-1 transition-colors', cfg.fg)}
          style={{ fontSize: 'clamp(32px, 8vw, 48px)', letterSpacing: '-0.02em' }}
          aria-live="off"
          aria-label={`Elapsed time ${fmt(elapsed)}`}
        >
          {fmt(elapsed)}
        </div>

        {/* Metadata line */}
        <p className="text-center text-[10px] text-slate-400 mb-4 font-mono tabular-nums">
          Total work · {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>

        {/* CTAs */}
        <div className="flex gap-2" role="group" aria-label="Timer controls">

          {activeState.state === 'working' && (
            <button
              onClick={() => fire('break_start', 'Break started')}
              className="flex-1 h-12 rounded-md bg-white/70 text-amber-700 font-semibold text-sm flex items-center justify-center gap-1.5 active:opacity-70 border border-amber-200"
              aria-label="Start break"
            >
              <Coffee className="h-4 w-4" /> Break
            </button>
          )}
          {activeState.state === 'on_break' && (
            <button
              onClick={() => fire('break_end', 'Break ended')}
              className="flex-1 h-12 rounded-md bg-[#0E8A5F] text-white font-semibold text-sm flex items-center justify-center gap-1.5 active:opacity-80"
              aria-label="End break"
            >
              <Play className="h-4 w-4" /> Resume
            </button>
          )}
          {activeState.state === 'traveling' && (
            <button
              onClick={() => fire('travel_end', 'Arrived on site')}
              className="flex-1 h-12 rounded-md bg-[#0B66B2] text-white font-semibold text-sm flex items-center justify-center gap-1.5 active:opacity-80"
              aria-label="Mark as arrived"
            >
              <Check className="h-4 w-4" /> Arrived
            </button>
          )}
          {activeState.state === 'idle' && (
            <button
              onClick={() => fire('work_start', 'Work started')}
              className="w-full h-12 rounded-md bg-[#0B2D5C] text-white font-semibold text-sm flex items-center justify-center gap-2 active:opacity-80"
              aria-label="Start work"
            >
              <Play className="h-4 w-4" /> Start Work
            </button>
          )}

          {activeState.state === 'working' && (
            <>
              <button
                onClick={() => fire('travel_start', 'Travel started')}
                className="h-12 w-11 rounded-md bg-white/70 text-blue-600 flex items-center justify-center active:opacity-70 flex-shrink-0 border border-blue-200"
                aria-label="Start travel"
                title="Start travel"
              >
                <Car className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                onClick={() => setShowStop(true)}
                className="flex-1 h-12 rounded-md bg-red-600 text-white font-semibold text-sm flex items-center justify-center gap-1.5 active:opacity-80"
                aria-label="End work session"
              >
                <Square className="h-4 w-4" aria-hidden="true" /> End Session
              </button>
            </>
          )}
        </div>

        {/* Accessibility hint — visually hidden */}
        <p className="sr-only" aria-hidden="true">
          All controls reachable one-handed
        </p>
      </div>

      {showStop && (
        <StopModal
          elapsed={elapsed}
          onConfirm={confirmStop}
          onCancel={() => setShowStop(false)}
          isPending={createEntry.isPending}
        />
      )}
    </>
  );
}