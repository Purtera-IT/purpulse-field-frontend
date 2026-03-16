import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import JobCard from '../components/field/JobCard';
import OfflineBanner from '../components/field/OfflineBanner';
import { useJobQueue } from '../hooks/useJobQueue';
import { Search, Loader2, Briefcase, Camera, WifiOff, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_FILTERS = [
  { value: 'all',              label: 'All' },
  { value: 'assigned',         label: 'Assigned' },
  { value: 'in_progress',      label: 'Active' },
  { value: 'pending_closeout', label: 'Closeout' },
  { value: 'urgent',           label: '🔴 Urgent' },
];

const FILTER_KEY = 'purpulse_jobs_filter';

function getFilterCount(jobs, value) {
  if (value === 'all')     return jobs.length;
  if (value === 'urgent')  return jobs.filter(j => j.priority === 'urgent').length;
  if (value === 'in_progress') return jobs.filter(j => ['checked_in','in_progress','paused','en_route'].includes(j.status)).length;
  return jobs.filter(j => j.status === value).length;
}

function matchesFilter(job, filter) {
  if (filter === 'all')     return true;
  if (filter === 'urgent')  return job.priority === 'urgent';
  if (filter === 'in_progress') return ['checked_in','in_progress','paused','en_route'].includes(job.status);
  return job.status === filter;
}

export default function Jobs() {
  const [search, setSearch]           = useState('');
  const [activeFilter, setActiveFilter] = useState(
    () => localStorage.getItem(FILTER_KEY) || 'all'
  );
  const [startingJobId, setStartingJobId] = useState(null);
  const [isRefreshing,  setIsRefreshing]  = useState(false);

  const queryClient = useQueryClient();
  const listRef     = useRef(null);
  const pullStartY  = useRef(null);

  const { startTimer, isOnline, pendingCount, failedCount } = useJobQueue();

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-scheduled_date', 100),
    staleTime: 30_000,
  });

  // Persist filter choice
  useEffect(() => {
    localStorage.setItem(FILTER_KEY, activeFilter);
  }, [activeFilter]);

  const filtered = jobs.filter(job => {
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      job.title?.toLowerCase().includes(q) ||
      job.site_name?.toLowerCase().includes(q) ||
      job.project_name?.toLowerCase().includes(q) ||
      job.site_address?.toLowerCase().includes(q);
    return matchesSearch && matchesFilter(job, activeFilter);
  });

  // ── Pull-to-refresh ──────────────────────────────────────────────
  const onPullStart = (e) => {
    if (listRef.current?.scrollTop === 0) {
      pullStartY.current = e.touches[0].clientY;
    }
  };
  const onPullEnd = async (e) => {
    if (pullStartY.current === null) return;
    const dy = e.changedTouches[0].clientY - pullStartY.current;
    pullStartY.current = null;
    if (dy > 72) {
      setIsRefreshing(true);
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setTimeout(() => setIsRefreshing(false), 700);
    }
  };

  // ── Start Timer ─────────────────────────────────────────────────
  const handleStartTimer = useCallback(async (job) => {
    if (startingJobId) return;
    setStartingJobId(job.id);
    try {
      const entry = await startTimer(job, null);
      toast.success(
        isOnline ? 'Timer started' : 'Queued for sync',
        {
          description: job.title,
          duration: 3000,
        }
      );
      // Dev log — mirrors POST /api/v1/jobs/{jobId}/events body
      console.info('[Purpulse] Job event queued:', JSON.stringify({
        client_event_id: entry.client_event_id,
        event_type: entry.event_type,
        job_id: entry.job_id,
        device_ts: entry.device_ts,
        device_meta: entry.device_meta,
      }, null, 2));
    } finally {
      setTimeout(() => setStartingJobId(null), 1200);
    }
  }, [startTimer, isOnline, startingJobId]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ── Sticky header ────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-lg mx-auto px-4 pt-5 pb-3">

          {/* Title + status */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Jobs</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-400">{filtered.length} work orders</span>
                {!isOnline && (
                  <span className="flex items-center gap-1 text-[11px] text-amber-600 font-semibold">
                    <WifiOff className="h-3 w-3" /> Offline
                  </span>
                )}
                {pendingCount > 0 && (
                  <span className="text-[11px] text-blue-600 font-semibold">{pendingCount} syncing</span>
                )}
                {failedCount > 0 && (
                  <span className="text-[11px] text-red-600 font-semibold">{failedCount} failed</span>
                )}
              </div>
            </div>
            <div className={cn(
              'h-9 w-9 rounded-full flex items-center justify-center transition-colors',
              isOnline ? 'bg-slate-900' : 'bg-amber-500'
            )}>
              {isOnline
                ? <Briefcase className="h-4 w-4 text-white" />
                : <WifiOff className="h-4 w-4 text-white" />}
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs, sites, addresses…"
              className="pl-9 pr-9 rounded-xl bg-slate-50 border-0 focus-visible:ring-1 h-11"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-slate-300 text-white text-xs flex items-center justify-center"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {/* Filter chips — horizontally scrollable, no scrollbar */}
          <div
            className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {STATUS_FILTERS.map(f => {
              const isActive = activeFilter === f.value;
              const count = getFilterCount(jobs, f.value);
              return (
                <button
                  key={f.value}
                  onClick={() => setActiveFilter(f.value)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0',
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {f.label}
                  <span className={cn(
                    'rounded-full px-1.5 text-[10px] font-bold leading-5',
                    isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-500'
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Offline banner */}
      {!isOnline && <OfflineBanner pendingCount={pendingCount} />}

      {/* Pull-to-refresh indicator */}
      {isRefreshing && (
        <div className="flex justify-center items-center gap-2 py-2.5 bg-blue-50 text-blue-600 text-xs font-medium">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Refreshing…
        </div>
      )}

      {/* ── Job list ─────────────────────────────────────────────── */}
      <div
        ref={listRef}
        className="flex-1 max-w-lg mx-auto w-full px-4 py-4 pb-28"
        onTouchStart={onPullStart}
        onTouchEnd={onPullEnd}
      >
        {jobs.length > 0 && !isLoading && (
          <p className="text-center text-[11px] text-slate-300 mb-3 select-none">
            ← swipe to start &nbsp;·&nbsp; swipe to navigate →
          </p>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState search={search} filter={activeFilter} isOnline={isOnline} />
        ) : (
          <div className="space-y-3">
            {filtered.map(job => (
              <JobCard
                key={job.id}
                job={job}
                onStartTimer={handleStartTimer}
                isStarting={startingJobId === job.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom FAB: Quick Evidence Capture ───────────────────── */}
      <div className="fixed bottom-20 right-4 z-20">
        <button
          onClick={() => toast.info('Select an active job to capture evidence', { duration: 2500 })}
          className="h-14 w-14 rounded-full bg-slate-900 shadow-2xl flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Quick evidence capture"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.20)' }}
        >
          <Camera className="h-6 w-6 text-white" />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ search, filter, isOnline }) {
  if (!isOnline && !search) {
    return (
      <div className="text-center py-16">
        <div className="h-16 w-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <WifiOff className="h-8 w-8 text-amber-400" />
        </div>
        <p className="text-slate-700 font-semibold">You're offline</p>
        <p className="text-slate-400 text-sm mt-1">Showing cached jobs — pull down to retry</p>
      </div>
    );
  }
  return (
    <div className="text-center py-16">
      <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
        <Briefcase className="h-8 w-8 text-slate-300" />
      </div>
      <p className="text-slate-600 font-semibold">
        {search ? `No results for "${search}"` : 'No jobs here'}
      </p>
      <p className="text-slate-400 text-sm mt-1">
        {filter !== 'all' ? 'Try a different filter' : 'Assigned jobs will appear here'}
      </p>
    </div>
  );
}