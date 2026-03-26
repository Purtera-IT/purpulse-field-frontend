/**
 * FieldJobs — Job list page (A)
 * Mobile-first, uses JobsAdapter; unified status tokens + pull-to-refresh.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2, ChevronRight, AlertCircle, Briefcase, Calendar, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { apiClient } from '@/api/client';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/ui/PullToRefreshIndicator';
import { getFieldJobStatusDisplay, FIELD_JOB_STATUS_DISPLAY } from '@/lib/fieldJobExecutionModel';
import {
  FIELD_CARD,
  FIELD_MAX_WIDTH,
  FIELD_PAGE_PAD_X,
  FIELD_PAGE_PAD_Y,
} from '@/lib/fieldVisualTokens';

const PRIO_CFG = {
  urgent: { label: 'Urgent', dot: 'bg-red-500', text: 'text-red-700 font-semibold' },
  high: { label: 'High', dot: 'bg-orange-500', text: 'text-slate-800 font-medium' },
  medium: { label: 'Medium', dot: 'bg-slate-400', text: 'text-slate-600' },
  low: { label: 'Low', dot: 'bg-slate-300', text: 'text-slate-500' },
};
const FILTER_CHIPS = ['all','assigned','in_progress','paused','pending_closeout','approved'];

function StatusBadge({ status }) {
  const c = getFieldJobStatusDisplay(status);
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0', c.pillBg, c.pillText)}>
      <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', c.dotClass)} />
      {c.label}
    </span>
  );
}

function TechAvatar({ email }) {
  const initials = (email || '?').split(/[@.]/).filter(Boolean).map(s => s[0]?.toUpperCase()).slice(0,2).join('');
  return (
    <div className="h-8 w-8 rounded-full bg-slate-800 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0" title={email}>
      {initials}
    </div>
  );
}

function fmtDate(d) {
  if (!d) return null;
  try { return format(parseISO(d), 'MMM d'); } catch { return d; }
}

function ActualVsPlanned({ planned, actual }) {
  if (!planned || !actual) return null;
  const diff = Math.round((new Date(actual) - new Date(planned)) / 60000);
  if (Math.abs(diff) <= 5) return <span className="text-emerald-600 font-semibold">on time</span>;
  return diff > 0
    ? <span className="text-red-500 font-semibold">+{diff}m late</span>
    : <span className="text-emerald-600 font-semibold">{Math.abs(diff)}m early</span>;
}

function JobCard({ job }) {
  const prio = PRIO_CFG[job.priority] || PRIO_CFG.medium;
  return (
    <Link to={`/FieldJobDetail?id=${job.id}`}
      className={cn('flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100 transition-colors', FIELD_CARD)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1">
          <p className="text-sm font-bold text-slate-900 flex-1 leading-snug line-clamp-2">{job.title}</p>
          <StatusBadge status={job.status} />
        </div>
        <p className="text-xs text-slate-400 truncate mb-1.5">{job.project_name || job.site_name || '—'}</p>
        <div className="flex items-center gap-2 sm:gap-3 text-[11px] flex-wrap">
          <span className={cn('inline-flex items-center gap-1.5', prio.text)}>
            <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', prio.dot)} aria-hidden />
            {prio.label}
          </span>
          {job.scheduled_date && (
            <span className="text-slate-400 inline-flex items-center gap-1">
              <Calendar className="h-3 w-3 flex-shrink-0 opacity-70" aria-hidden />
              {fmtDate(job.scheduled_date)}
            </span>
          )}
          {job.assigned_to && (
            <span className="text-slate-400 truncate max-w-[100px] inline-flex items-center gap-1">
              <User className="h-3 w-3 flex-shrink-0 opacity-70" aria-hidden />
              {job.assigned_to.split('@')[0]}
            </span>
          )}
          <ActualVsPlanned planned={job.work_start_time} actual={job.check_in_time} />
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {job.assigned_to && <TechAvatar email={job.assigned_to} />}
        <ChevronRight className="h-4 w-4 text-slate-300" />
      </div>
    </Link>
  );
}

export default function FieldJobs() {
  const [search,   setSearch]   = useState('');
  const [statusF,  setStatusF]  = useState('all');

  const { data: jobs = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['field-jobs'],
    queryFn:  () => apiClient.getJobs(),
    staleTime: 30_000,
  });

  const { containerRef, pullDistance, refreshing, onTouchStart, onTouchMove, onTouchEnd } =
    usePullToRefresh(refetch);

  const filtered = jobs.filter(j => {
    const q = search.toLowerCase();
    const matchQ = !q || [j.title, j.project_name, j.site_name, j.site_address, j.assigned_to, j.external_id]
      .some(v => v?.toLowerCase().includes(q));
    const matchS = statusF === 'all' || j.status === statusF;
    return matchQ && matchS;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200/80">
        <div className={cn(FIELD_MAX_WIDTH, 'mx-auto', FIELD_PAGE_PAD_X, 'pt-3 pb-2 space-y-2')}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search jobs, sites, projects…"
              className="pl-9 bg-slate-50 border-0 rounded-xl focus-visible:ring-1 h-9 text-sm" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {FILTER_CHIPS.map(s => (
              <button key={s} onClick={() => setStatusF(s)}
                className={cn(
                  'flex-shrink-0 h-7 px-3 rounded-full text-[11px] font-bold transition-colors capitalize border',
                  statusF === s
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                )}>
                {s === 'all' ? `All (${jobs.length})` : (FIELD_JOB_STATUS_DISPLAY[s]?.label ?? s)}
                {s !== 'all' && (
                  <span className="ml-1 opacity-60">{jobs.filter(j => j.status === s).length}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className={cn(FIELD_MAX_WIDTH, 'mx-auto', FIELD_PAGE_PAD_X, FIELD_PAGE_PAD_Y, 'pb-28 space-y-2.5 relative')}
        style={{ touchAction: 'pan-y' }}
      >
        <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
        ) : isError ? (
          <div className="flex flex-col items-center py-20 px-6 gap-3 text-center">
            <AlertCircle className="h-10 w-10 text-amber-500" aria-hidden />
            <p className="text-sm font-semibold text-slate-800">Couldn&apos;t load jobs</p>
            <p className="text-xs text-slate-500 max-w-sm">
              {error instanceof Error ? error.message : 'Check your connection and try again.'}
            </p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center py-20 px-6 gap-3 text-center text-slate-500">
            <Briefcase className="h-10 w-10 text-slate-300" aria-hidden />
            <p className="text-sm font-semibold text-slate-700">No jobs assigned</p>
            <p className="text-xs text-slate-500">When work orders are assigned to you, they will appear here.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3 text-slate-400">
            <Search className="h-8 w-8 text-slate-300" aria-hidden />
            <p className="text-sm font-medium text-slate-600">No jobs match your filters</p>
            <p className="text-xs text-slate-400">Try another status or clear search.</p>
          </div>
        ) : (
          filtered.map(job => <JobCard key={job.id} job={job} />)
        )}
      </div>
    </div>
  );
}
