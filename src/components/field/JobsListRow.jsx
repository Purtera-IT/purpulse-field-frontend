/**
 * JobsListRow — compact enterprise list row for mobile-first Jobs view.
 * Target density: 3+ rows visible on iPhone 13 without scrolling.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getProgress, formatSchedule } from './JobRichCard';

const STATUS_DOT = {
  assigned:         'bg-slate-400',
  en_route:         'bg-blue-500',
  checked_in:       'bg-cyan-500',
  in_progress:      'bg-emerald-500',
  paused:           'bg-amber-500',
  pending_closeout: 'bg-purple-500',
  submitted:        'bg-indigo-500',
  approved:         'bg-teal-500',
  rejected:         'bg-red-500',
};

const PRIORITY_STRIPE = {
  urgent: 'border-l-red-500',
  high:   'border-l-orange-400',
  medium: 'border-l-transparent',
  low:    'border-l-transparent',
};

const ACTIVE_STATUSES = ['in_progress', 'checked_in'];

export default function JobsListRow({ job }) {
  const dotCls     = STATUS_DOT[job.status] || 'bg-slate-400';
  const stripeCls  = PRIORITY_STRIPE[job.priority] || 'border-l-transparent';
  const isActive   = ACTIVE_STATUSES.includes(job.status);
  const progress   = getProgress(job);
  const schedule   = formatSchedule(job);

  const metaParts = [
    job.site_name || job.site_address,
    schedule,
    job.assigned_name || job.assigned_to,
  ].filter(Boolean);

  return (
    <Link
      to={`/JobDetail?id=${job.id}`}
      className={cn(
        'flex items-center gap-3 py-3 px-4 bg-white border border-neutral-200 rounded-[6px] border-l-4 active:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0B2D5C] focus:ring-offset-2',
        stripeCls
      )}
    >
      {/* Status dot */}
      <div className="flex-shrink-0 flex items-center justify-center w-3">
        <span className={cn('h-2.5 w-2.5 rounded-full', dotCls)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-neutral-900 truncate leading-snug">
          {job.title}
        </div>
        {metaParts.length > 0 && (
          <div className="text-[11px] text-neutral-500 mt-0.5 truncate leading-none">
            {metaParts.join(' · ')}
          </div>
        )}
        {/* Micro progress bar */}
        <div className="h-[3px] bg-neutral-100 rounded-full mt-1.5 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              progress === 100 ? 'bg-emerald-500' : 'bg-[#0B66B2]'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Right: active indicator + chevron */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {isActive && (
          <span className="text-[10px] font-bold font-mono tabular-nums text-[#0B2D5C] bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-[4px] leading-none" aria-label="Job in progress">
            LIVE
          </span>
        )}
        <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
      </div>
    </Link>
  );
}