/**
 * ActiveTimerCard — live running timer with state controls.
 * Shows elapsed time, current state, and Start/Break/Stop CTAs.
 */
import React, { useState, useEffect } from 'react';
import { Play, Square, Coffee, Car, Check, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function getActiveState(entries) {
  if (!entries.length) return { state: 'idle', since: null };
  const latest = [...entries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
  const map = { work_start: 'working', break_start: 'on_break', travel_start: 'traveling' };
  return { state: map[latest.entry_type] || 'idle', since: latest.timestamp };
}

function calcElapsed(entries) {
  const sorted = [...entries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  let ms = 0, ws = null;
  for (const e of sorted) {
    if (e.entry_type === 'work_start') ws = new Date(e.timestamp);
    if (e.entry_type === 'work_stop' && ws) { ms += new Date(e.timestamp) - ws; ws = null; }
  }
  if (ws) ms += Date.now() - ws;
  return Math.floor(ms / 1000);
}

const STATE_CFG = {
  working:   { bg: 'bg-emerald-600', dot: 'bg-emerald-300', label: 'Working',   pulse: true  },
  on_break:  { bg: 'bg-amber-500',   dot: 'bg-amber-200',   label: 'On Break',  pulse: false },
  traveling: { bg: 'bg-blue-600',    dot: 'bg-blue-300',    label: 'Traveling', pulse: true  },
  idle:      { bg: 'bg-slate-800',   dot: 'bg-slate-500',   label: 'Not Started', pulse: false },
};

export default function ActiveTimerCard({ entries, currentJob, onAction }) {
  const [elapsed, setElapsed] = useState(() => calcElapsed(entries));
  const { state, since } = getActiveState(entries);
  const cfg = STATE_CFG[state] || STATE_CFG.idle;

  useEffect(() => {
    setElapsed(calcElapsed(entries));
    if (state === 'idle') return;
    const id = setInterval(() => setElapsed(calcElapsed(entries)), 1000);
    return () => clearInterval(id);
  }, [entries, state]);

  const sinceLabel = since
    ? new Date(since).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className={cn('rounded-3xl p-5 text-white', cfg.bg)}>
      {/* State pill */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 bg-white/20 rounded-full px-3 py-1">
          <span className={cn('h-2 w-2 rounded-full', cfg.dot, cfg.pulse && 'motion-safe:animate-pulse')} />
          <span className="text-xs font-bold">{cfg.label}</span>
          {sinceLabel && <span className="text-[11px] opacity-70">since {sinceLabel}</span>}
        </div>
        {currentJob && (
          <div className="flex items-center gap-1 text-[11px] opacity-70 max-w-[140px]">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{currentJob.site_name || currentJob.title}</span>
          </div>
        )}
      </div>

      {/* Clock */}
      <div
        className="text-center font-mono font-black tabular-nums leading-none mb-1"
        style={{ fontSize: 'clamp(52px, 14vw, 68px)', letterSpacing: '-0.02em' }}
      >
        {fmt(elapsed)}
      </div>
      <p className="text-center text-xs opacity-60 mb-5">Total work time today</p>

      {/* Controls */}
      <div className="flex gap-2.5">
        {state === 'idle' && (
          <button onClick={() => onAction('work_start')}
            className="flex-1 h-14 rounded-2xl bg-white/20 hover:bg-white/30 font-bold text-sm flex items-center justify-center gap-2 active:opacity-70">
            <Play className="h-4 w-4" /> Start Work
          </button>
        )}
        {state === 'working' && (
          <>
            <button onClick={() => onAction('break_start')}
              className="flex-1 h-14 rounded-2xl bg-white/20 font-semibold text-sm flex items-center justify-center gap-1.5 active:opacity-70">
              <Coffee className="h-4 w-4" /> Break
            </button>
            <button onClick={() => onAction('travel_start')}
              className="flex-1 h-14 rounded-2xl bg-white/20 font-semibold text-sm flex items-center justify-center gap-1.5 active:opacity-70">
              <Car className="h-4 w-4" /> Travel
            </button>
            <button onClick={() => onAction('work_stop')}
              className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center active:opacity-70 flex-shrink-0">
              <Square className="h-5 w-5" />
            </button>
          </>
        )}
        {state === 'on_break' && (
          <button onClick={() => onAction('break_end')}
            className="flex-1 h-14 rounded-2xl bg-white/20 font-bold text-sm flex items-center justify-center gap-2 active:opacity-70">
            <Play className="h-4 w-4" /> End Break
          </button>
        )}
        {state === 'traveling' && (
          <button onClick={() => onAction('travel_end')}
            className="flex-1 h-14 rounded-2xl bg-white/20 font-bold text-sm flex items-center justify-center gap-2 active:opacity-70">
            <Check className="h-4 w-4" /> Arrived
          </button>
        )}
      </div>
    </div>
  );
}