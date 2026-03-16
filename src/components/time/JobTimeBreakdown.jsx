/**
 * JobTimeBreakdown — per-job time summary, expandable with entry list.
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Briefcase, Clock, Car, Coffee, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, differenceInSeconds } from 'date-fns';

function calcJobDurations(entries) {
  const sorted = [...entries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  let work = 0, travel = 0, breakT = 0;
  let ws = null, ts = null, bs = null;
  for (const e of sorted) {
    const t = new Date(e.timestamp);
    if (e.entry_type === 'work_start')   ws = t;
    if (e.entry_type === 'work_stop'   && ws) { work   += differenceInSeconds(t, ws); ws = null; }
    if (e.entry_type === 'travel_start') ts = t;
    if (e.entry_type === 'travel_end'  && ts) { travel += differenceInSeconds(t, ts); ts = null; }
    if (e.entry_type === 'break_start')  bs = t;
    if (e.entry_type === 'break_end'   && bs) { breakT += differenceInSeconds(t, bs); bs = null; }
  }
  const now = new Date();
  if (ws) work   += differenceInSeconds(now, ws);
  if (ts) travel += differenceInSeconds(now, ts);
  if (bs) breakT += differenceInSeconds(now, bs);
  return { work, travel, break: breakT };
}

function fmtS(s) {
  if (s < 60) return '0m';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const ENTRY_CFG = {
  work_start:   { label: 'Work started',   cls: 'text-emerald-600', dot: 'bg-emerald-500' },
  work_stop:    { label: 'Work stopped',   cls: 'text-slate-500',   dot: 'bg-slate-400'   },
  travel_start: { label: 'Travel started', cls: 'text-blue-600',    dot: 'bg-blue-500'    },
  travel_end:   { label: 'Arrived',        cls: 'text-blue-500',    dot: 'bg-blue-400'    },
  break_start:  { label: 'Break started',  cls: 'text-amber-600',   dot: 'bg-amber-500'   },
  break_end:    { label: 'Break ended',    cls: 'text-amber-500',   dot: 'bg-amber-400'   },
};

function EntryRow({ entry, onEdit }) {
  const cfg = ENTRY_CFG[entry.entry_type] || { label: entry.entry_type, cls: 'text-slate-500', dot: 'bg-slate-300' };
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className={cn('h-2 w-2 rounded-full flex-shrink-0', cfg.dot)} />
      <span className={cn('text-xs font-semibold flex-1', cfg.cls)}>{cfg.label}</span>
      <span className="text-[11px] font-mono text-slate-500">
        {format(new Date(entry.timestamp), 'HH:mm:ss')}
      </span>
      {entry.source === 'manual' && (
        <span className="text-[9px] font-black text-orange-600 bg-orange-50 px-1 rounded border border-orange-200">MANUAL</span>
      )}
      <button onClick={() => onEdit?.(entry)}
        className="h-6 w-6 rounded-lg bg-slate-100 flex items-center justify-center active:bg-slate-200 flex-shrink-0">
        <Edit2 className="h-3 w-3 text-slate-400" />
      </button>
    </div>
  );
}

export default function JobTimeBreakdown({ jobs, entries, onEditEntry }) {
  const [openJobId, setOpenJobId] = useState(null);

  // Group entries by job
  const byJob = {};
  for (const e of entries) {
    if (!byJob[e.job_id]) byJob[e.job_id] = [];
    byJob[e.job_id].push(e);
  }

  // Jobs that have entries + unmatched
  const jobsWithEntries = Object.keys(byJob).map(jobId => ({
    job: jobs.find(j => j.id === jobId) || { id: jobId, title: `Job ${jobId.slice(-4)}` },
    entries: byJob[jobId].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
  }));

  if (!jobsWithEntries.length) return null;

  return (
    <div className="space-y-2">
      {jobsWithEntries.map(({ job, entries: jobEntries }) => {
        const dur     = calcJobDurations(jobEntries);
        const isOpen  = openJobId === job.id;
        const isActive = jobEntries.some(e =>
          e.entry_type === 'work_start' &&
          !jobEntries.find(e2 => e2.entry_type === 'work_stop' && new Date(e2.timestamp) > new Date(e.timestamp))
        );

        return (
          <div key={job.id} className={cn(
            'rounded-2xl border overflow-hidden',
            isActive ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-100 bg-white'
          )}>
            <button
              onClick={() => setOpenJobId(isOpen ? null : job.id)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
            >
              <div className={cn(
                'h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0',
                isActive ? 'bg-emerald-100' : 'bg-slate-100'
              )}>
                <Briefcase className={cn('h-4 w-4', isActive ? 'text-emerald-600' : 'text-slate-500')} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-black text-slate-900 truncate">{job.title}</p>
                  {isActive && (
                    <span className="flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 rounded-full flex-shrink-0">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
                      Active
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {dur.work   > 0 && <span className="flex items-center gap-1 text-[11px] text-emerald-600"><Clock  className="h-2.5 w-2.5" /> {fmtS(dur.work)}</span>}
                  {dur.travel > 0 && <span className="flex items-center gap-1 text-[11px] text-blue-600">  <Car    className="h-2.5 w-2.5" /> {fmtS(dur.travel)}</span>}
                  {dur.break  > 0 && <span className="flex items-center gap-1 text-[11px] text-amber-600"> <Coffee className="h-2.5 w-2.5" /> {fmtS(dur.break)}</span>}
                </div>
              </div>

              {isOpen
                ? <ChevronUp   className="h-4 w-4 text-slate-300 flex-shrink-0" />
                : <ChevronDown className="h-4 w-4 text-slate-300 flex-shrink-0" />}
            </button>

            {isOpen && (
              <div className="px-4 pb-3 border-t border-slate-100 pt-2 space-y-0.5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Entries · tap to correct
                </p>
                {jobEntries.map(e => (
                  <EntryRow key={e.id} entry={e} onEdit={onEditEntry} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}