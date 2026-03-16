/**
 * TimelineBar — horizontal visual day timeline.
 * Shows work/travel/break/gap segments across a configurable hour window.
 * Tapping a segment opens a correction sheet.
 */
import React, { useState } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Edit2 } from 'lucide-react';

const DAY_START_H = 6;  // 06:00
const DAY_END_H   = 20; // 20:00
const TOTAL_MINS  = (DAY_END_H - DAY_START_H) * 60;

const SEG_CFG = {
  work:    { bg: 'bg-emerald-500', label: 'Work',    light: 'bg-emerald-100 border-emerald-300 text-emerald-800' },
  travel:  { bg: 'bg-blue-500',   label: 'Travel',  light: 'bg-blue-100 border-blue-300 text-blue-800' },
  break:   { bg: 'bg-amber-400',  label: 'Break',   light: 'bg-amber-100 border-amber-300 text-amber-800' },
  active:  { bg: 'bg-emerald-400 motion-safe:animate-pulse', label: 'Active', light: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
};

function minutesSinceStart(ts) {
  const d = new Date(ts);
  return (d.getHours() - DAY_START_H) * 60 + d.getMinutes();
}

function buildSegments(entries) {
  const sorted = [...entries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const segs = [];
  let workStart = null, travelStart = null, breakStart = null;

  for (const e of sorted) {
    const ts = e.timestamp;
    if (e.entry_type === 'work_start')   workStart   = ts;
    if (e.entry_type === 'work_stop' && workStart)   {
      segs.push({ type: 'work',   start: workStart,   end: ts, entry_id: e.id });
      workStart = null;
    }
    if (e.entry_type === 'travel_start') travelStart = ts;
    if (e.entry_type === 'travel_end' && travelStart) {
      segs.push({ type: 'travel', start: travelStart, end: ts, entry_id: e.id });
      travelStart = null;
    }
    if (e.entry_type === 'break_start')  breakStart  = ts;
    if (e.entry_type === 'break_end' && breakStart) {
      segs.push({ type: 'break',  start: breakStart,  end: ts, entry_id: e.id });
      breakStart = null;
    }
  }
  // Open/active segments
  const now = new Date().toISOString();
  if (workStart)   segs.push({ type: 'active', start: workStart,   end: now, isOpen: true });
  if (travelStart) segs.push({ type: 'travel', start: travelStart, end: now, isOpen: true });
  if (breakStart)  segs.push({ type: 'break',  start: breakStart,  end: now, isOpen: true });

  return segs;
}

function fmtDur(startIso, endIso) {
  const s = Math.floor((new Date(endIso) - new Date(startIso)) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function HourTick({ hour }) {
  const pct = ((hour - DAY_START_H) / (DAY_END_H - DAY_START_H)) * 100;
  return (
    <div className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: `${pct}%` }}>
      <div className="w-px h-full bg-slate-100" />
      <span className="absolute -bottom-4 text-[9px] text-slate-400 tabular-nums -translate-x-1/2">
        {hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`}
      </span>
    </div>
  );
}

export default function TimelineBar({ entries, onSegmentTap }) {
  const segs = buildSegments(entries);
  const [active, setActive] = useState(null);

  // Now marker
  const nowMins = minutesSinceStart(new Date().toISOString());
  const nowPct  = Math.min(100, Math.max(0, (nowMins / TOTAL_MINS) * 100));

  const hours = [];
  for (let h = DAY_START_H; h <= DAY_END_H; h += 2) hours.push(h);

  return (
    <div>
      {/* ── Bar ─────────────────────────────────────── */}
      <div className="relative h-10 bg-slate-100 rounded-xl overflow-visible mb-6 mx-1" style={{ minWidth: 0 }}>
        {/* Hour ticks */}
        {hours.map(h => <HourTick key={h} hour={h} />)}

        {/* Segments */}
        {segs.map((seg, i) => {
          const leftMins  = Math.max(0, minutesSinceStart(seg.start));
          const rightMins = Math.min(TOTAL_MINS, minutesSinceStart(seg.end));
          const left  = (leftMins  / TOTAL_MINS) * 100;
          const width = Math.max(0.5, ((rightMins - leftMins) / TOTAL_MINS) * 100);
          const cfg   = SEG_CFG[seg.type] || SEG_CFG.work;

          return (
            <button
              key={i}
              onClick={() => { setActive(seg); onSegmentTap?.(seg); }}
              className={cn(
                'absolute top-1 h-8 rounded-lg transition-all',
                cfg.bg,
                active === seg ? 'ring-2 ring-white ring-offset-1 scale-y-110' : ''
              )}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${cfg.label} ${fmtDur(seg.start, seg.end)}`}
            />
          );
        })}

        {/* Now line */}
        {nowMins >= 0 && nowMins <= TOTAL_MINS && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
            style={{ left: `${nowPct}%` }}
          >
            <div className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-red-500" />
          </div>
        )}
      </div>

      {/* ── Segment list ────────────────────────────── */}
      {segs.length > 0 && (
        <div className="space-y-1.5">
          {segs.map((seg, i) => {
            const cfg = SEG_CFG[seg.type] || SEG_CFG.work;
            const startFmt = format(new Date(seg.start), 'HH:mm');
            const endFmt   = seg.isOpen ? 'now' : format(new Date(seg.end), 'HH:mm');
            return (
              <div key={i} className={cn('flex items-center gap-3 px-3 py-2 rounded-xl border', cfg.light)}>
                <div className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0', cfg.bg.split(' ')[0])} />
                <span className="text-xs font-bold flex-1">{cfg.label}</span>
                <span className="text-xs font-mono">{startFmt} – {endFmt}</span>
                <span className="text-[11px] font-semibold opacity-70">{fmtDur(seg.start, seg.end)}</span>
                {!seg.isOpen && onSegmentTap && (
                  <button onClick={() => onSegmentTap(seg)}
                    className="h-6 w-6 rounded-lg bg-white/60 flex items-center justify-center active:opacity-70">
                    <Edit2 className="h-3 w-3 opacity-60" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}