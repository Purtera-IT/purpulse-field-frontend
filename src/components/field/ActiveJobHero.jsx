/**
 * ActiveJobHero — pinned banner for the currently active/in-progress job.
 * Shown at the top of the Jobs list to give 1-tap access to the cockpit.
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause, ChevronRight, ClipboardList, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_CFG, PRIORITY_CFG } from './JobRichCard';

function fmtElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export default function ActiveJobHero({ job }) {
  const [elapsed, setElapsed] = useState(0);

  // Simulate a running timer seeded from a fake start time
  useEffect(() => {
    const seed = 3600 * 1 + 22 * 60 + 14; // 01:22:14 demo seed
    setElapsed(seed);
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [job.id]);

  const statusCfg = STATUS_CFG[job.status] || STATUS_CFG.in_progress;
  const prioCfg   = PRIORITY_CFG[job.priority] || PRIORITY_CFG.medium;
  const PrioIcon  = prioCfg.Icon;

  const isWorking = job.status === 'in_progress';

  return (
    <div className="mb-1 rounded-3xl overflow-hidden bg-slate-900 shadow-xl">
      {/* Top row */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={cn('flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full', statusCfg.badgeClass)}>
              <span className={cn('h-1.5 w-1.5 rounded-full motion-safe:animate-pulse', statusCfg.dotClass)} />
              {statusCfg.label}
            </span>
            {PrioIcon && (
              <span className={cn('flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full', prioCfg.badgeClass)}>
                <PrioIcon className="h-2.5 w-2.5" /> {prioCfg.label}
              </span>
            )}
            <span className="text-[10px] text-slate-400 font-semibold">Active Job</span>
          </div>
          <h2 className="text-base font-black text-white leading-snug line-clamp-1">{job.title}</h2>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{job.company_name} · {job.site_name}</p>
        </div>

        {/* Live timer */}
        <div className="flex flex-col items-end flex-shrink-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={cn('h-2 w-2 rounded-full', isWorking ? 'bg-emerald-400 motion-safe:animate-pulse' : 'bg-amber-400')} />
            <span className="text-[10px] text-slate-400 font-bold">{isWorking ? 'Working' : 'Paused'}</span>
          </div>
          <span className="font-mono font-black text-white text-xl tabular-nums leading-none">
            {fmtElapsed(elapsed)}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {job.progress != null && (
        <div className="mx-4 h-1 bg-white/10 rounded-full overflow-hidden mb-3">
          <div
            className={cn('h-full rounded-full transition-all',
              job.progress === 100 ? 'bg-emerald-400' : job.progress >= 60 ? 'bg-blue-400' : 'bg-amber-400'
            )}
            style={{ width: `${job.progress}%` }}
          />
        </div>
      )}

      {/* Action row */}
      <div className="px-4 pb-4 flex gap-2">
        <Link
          to={`/JobDetail?id=${job.id}`}
          className="flex-1 h-12 rounded-2xl bg-white text-slate-900 font-bold text-sm flex items-center justify-center gap-2 active:opacity-80"
        >
          {isWorking ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          Continue Job
          <ChevronRight className="h-4 w-4" />
        </Link>
        <Link
          to={`/JobDetail?id=${job.id}&tab=tasks`}
          className="h-12 w-12 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0 active:bg-white/25 transition-colors"
          aria-label="Jump to tasks"
          title="Tasks"
        >
          <ClipboardList className="h-5 w-5 text-white" />
        </Link>
      </div>
    </div>
  );
}