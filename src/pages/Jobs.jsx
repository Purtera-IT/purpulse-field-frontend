import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { parseISO, isToday, isTomorrow, isWithinInterval, startOfWeek, endOfWeek } from 'date-fns';
import {
  Search, Loader2, LayoutGrid, List, CalendarDays, Table2,
  SlidersHorizontal, X, ChevronRight, WifiOff, RefreshCw, Camera,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import OfflineBanner from '../components/field/OfflineBanner';
import JobRichCard, { PRIORITY_CFG, STATUS_CFG, getProgress, formatSchedule } from '../components/field/JobRichCard';
import JobsListRow from '../components/field/JobsListRow';
import JobsCalendar from '../components/field/JobsCalendar';
import JobsTable from '../components/field/JobsTable';
import FilterToggle from '../components/ui/FilterToggle';
import { useJobQueue } from '../hooks/useJobQueue';
import { MOCK_JOBS } from '../lib/mockJobs';
import ActiveJobHero from '../components/field/ActiveJobHero';

// ── Filter definitions ───────────────────────────────────────────────
const STATUS_CHIPS = [
  { value: 'all',              label: 'All' },
  { value: 'active',           label: '⚡ Active' },
  { value: 'assigned',         label: 'Assigned' },
  { value: 'pending_closeout', label: 'Closeout' },
  { value: 'completed',        label: '✓ Done' },
];

const PRIORITY_OPTS = [
  { value: 'all',    label: 'Any Priority' },
  { value: 'urgent', label: '🔴 Urgent' },
  { value: 'high',   label: '🟠 High' },
  { value: 'medium', label: '🔵 Medium' },
  { value: 'low',    label: '⚪ Low' },
];

const DATE_OPTS = [
  { value: 'all',      label: 'Any Date' },
  { value: 'today',    label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'week',     label: 'This Week' },
];

function matchesStatus(job, filter) {
  if (filter === 'all')      return true;
  if (filter === 'active')   return ['en_route','checked_in','in_progress','paused'].includes(job.status);
  if (filter === 'completed') return ['submitted','approved'].includes(job.status);
  return job.status === filter;
}

function matchesDate(job, filter) {
  if (filter === 'all' || !job.scheduled_date) return true;
  try {
    const d = parseISO(job.scheduled_date);
    if (filter === 'today')    return isToday(d);
    if (filter === 'tomorrow') return isTomorrow(d);
    if (filter === 'week')     return isWithinInterval(d, { start: startOfWeek(new Date()), end: endOfWeek(new Date()) });
  } catch { return true; }
  return true;
}

// ── Compact list row ────────────────────────────────────────────────
function JobListRow({ job }) {
  const prio      = PRIORITY_CFG[job.priority]  || PRIORITY_CFG.medium;
  const statusCfg = STATUS_CFG[job.status]      || STATUS_CFG.assigned;
  const progress  = getProgress(job);
  const schedule  = formatSchedule(job);

  return (
    <Link
      to={`/JobDetail?id=${job.id}`}
      className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 px-4 py-3.5 active:bg-slate-50 transition-colors"
    >
      {/* Priority color stripe */}
      <div className={cn('h-10 w-1 rounded-full flex-shrink-0', prio.dotClass)} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-black text-slate-900 truncate flex-1">{job.title}</p>
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0', statusCfg.badgeClass)}>
            {statusCfg.label}
          </span>
        </div>
        <p className="text-xs text-slate-500 truncate">{job.company_name || job.project_name}</p>
        <div className="flex items-center gap-3 mt-1.5">
          {schedule && <p className="text-[11px] text-slate-400 flex-1 truncate">{schedule}</p>}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="h-1 w-14 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full', progress === 100 ? 'bg-emerald-500' : 'bg-blue-400')}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-slate-400 tabular-nums">{progress}%</span>
          </div>
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
    </Link>
  );
}

// ── Empty state ──────────────────────────────────────────────────────
function EmptyState({ isOnline }) {
  if (!isOnline) {
    return (
      <div className="text-center py-16">
        <div className="h-16 w-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <WifiOff className="h-8 w-8 text-amber-400" />
        </div>
        <p className="text-slate-700 font-semibold">You're offline</p>
        <p className="text-slate-400 text-sm mt-1">Showing cached jobs</p>
      </div>
    );
  }
  return (
    <div className="text-center py-16">
      <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
        <Search className="h-8 w-8 text-slate-300" />
      </div>
      <p className="text-slate-600 font-semibold">No jobs match filters</p>
      <p className="text-slate-400 text-sm mt-1">Try adjusting your filters or search</p>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────
export default function Jobs() {
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
  const [view,           setView]           = useState(() => localStorage.getItem('purpulse_jobs_view') || (isDesktop ? 'table' : 'list'));
  const [search,         setSearch]         = useState('');
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [dateFilter,     setDateFilter]     = useState('all');
  const [techFilter,     setTechFilter]     = useState('all');
  const [showAdvanced,   setShowAdvanced]   = useState(false);
  const [isRefreshing,   setIsRefreshing]   = useState(false);
  // Table paging/sort
  const [tablePage,      setTablePage]      = useState(0);
  const TABLE_PAGE_SIZE = 25;
  const [tableSort,      setTableSort]      = useState({ col: 'scheduled_date', dir: 'desc' });
  const handleTableSort = (col) => {
    setTableSort(prev => ({ col, dir: prev.col === col && prev.dir === 'asc' ? 'desc' : 'asc' }));
    setTablePage(0);
  };

  const queryClient = useQueryClient();
  const listRef     = useRef(null);
  const pullStartY  = useRef(null);

  const { isOnline, pendingCount, failedCount } = useJobQueue();

  const { data: dbJobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-scheduled_date', 100),
    staleTime: 30_000,
  });

  const allJobs = dbJobs.length > 0 ? dbJobs : MOCK_JOBS;

  // Derive unique techs for filter dropdown
  const techs = [...new Map(allJobs.map(j => [j.assigned_to, j.assigned_name || j.assigned_to])).entries()];

  useEffect(() => { localStorage.setItem('purpulse_jobs_view', view); }, [view]);

  const filtered = allJobs.filter(job => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      job.title?.toLowerCase().includes(q) ||
      job.company_name?.toLowerCase().includes(q) ||
      job.site_name?.toLowerCase().includes(q) ||
      job.site_address?.toLowerCase().includes(q) ||
      job.project_name?.toLowerCase().includes(q);
    const matchStatus   = matchesStatus(job, statusFilter);
    const matchPriority = priorityFilter === 'all' || job.priority === priorityFilter;
    const matchDate     = matchesDate(job, dateFilter);
    const matchTech     = techFilter === 'all' || job.assigned_to === techFilter;
    return matchSearch && matchStatus && matchPriority && matchDate && matchTech;
  });

  const activeFilterCount = [
    priorityFilter !== 'all', dateFilter !== 'all', techFilter !== 'all',
  ].filter(Boolean).length;

  // Pull-to-refresh
  const onPullStart = (e) => {
    if (listRef.current?.scrollTop === 0) pullStartY.current = e.touches[0].clientY;
  };
  const onPullEnd = async (e) => {
    if (!pullStartY.current) return;
    const dy = e.changedTouches[0].clientY - pullStartY.current;
    pullStartY.current = null;
    if (dy > 72) {
      setIsRefreshing(true);
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setTimeout(() => setIsRefreshing(false), 700);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ── Sticky header ─────────────────────────────────── */}
      <div className="sticky top-14 z-10 bg-white/95 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-2xl mx-auto px-4 pt-3 pb-2 space-y-2.5">

          {/* Row 1: search + view toggle */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search jobs, sites, companies…"
                className="pl-9 pr-8 rounded-xl bg-slate-50 border-0 focus-visible:ring-1 h-10 text-sm"
              />
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-slate-400 text-white text-[10px] flex items-center justify-center"
                  aria-label="Clear search">×</button>
              )}
            </div>

            {/* View toggle */}
            <div className="flex bg-slate-100 rounded-xl p-0.5 gap-0.5 flex-shrink-0">
              {[
                { id: 'table',    Icon: Table2,       label: 'Table',    desktopOnly: false },
                { id: 'cards',    Icon: LayoutGrid,   label: 'Cards',    desktopOnly: false },
                { id: 'list',     Icon: List,         label: 'List',     desktopOnly: false },
                { id: 'calendar', Icon: CalendarDays, label: 'Calendar', desktopOnly: false },
              ].map(({ id, Icon, label }) => (
                <button
                  key={id}
                  onClick={() => { setView(id); setTablePage(0); }}
                  aria-label={label}
                  className={cn(
                    'h-9 w-9 rounded-lg flex items-center justify-center transition-all',
                    view === id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: compact status filter toggles */}
          <div className="flex items-center gap-1.5">
            <div className="flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              <FilterToggle
                value={statusFilter}
                onChange={setStatusFilter}
                options={STATUS_CHIPS.map(f => ({
                  value: f.value,
                  label: f.label,
                  count: allJobs.filter(j => matchesStatus(j, f.value)).length,
                }))}
              />
            </div>
            <button
              onClick={() => setShowAdvanced(v => !v)}
              className={cn(
                'flex items-center gap-1 h-7 px-2 rounded-[4px] border text-[11px] font-semibold flex-shrink-0 transition-colors',
                showAdvanced || activeFilterCount > 0
                  ? 'bg-[#0F1724] text-white border-[#0F1724]'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
              )}
              aria-label="Advanced filters"
            >
              <SlidersHorizontal className="h-3 w-3" />
              {activeFilterCount > 0 && <span className="text-[10px] font-black">{activeFilterCount}</span>}
            </button>
          </div>

          {/* Row 3: advanced filters (expandable) */}
          {showAdvanced && (
            <div className="grid grid-cols-3 gap-2 pb-1">
              {/* Priority */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1">Priority</p>
                <select
                  value={priorityFilter}
                  onChange={e => setPriorityFilter(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-2 focus:outline-none focus:ring-1 focus:ring-slate-400 text-slate-700"
                >
                  {PRIORITY_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Date */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1">Date</p>
                <select
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-2 focus:outline-none focus:ring-1 focus:ring-slate-400 text-slate-700"
                >
                  {DATE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Technician */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1">Technician</p>
                <select
                  value={techFilter}
                  onChange={e => setTechFilter(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white text-xs font-semibold px-2 focus:outline-none focus:ring-1 focus:ring-slate-400 text-slate-700"
                >
                  <option value="all">All Techs</option>
                  {techs.map(([email, name]) => (
                    <option key={email} value={email}>{name || email}</option>
                  ))}
                </select>
              </div>

              {/* Reset link */}
              {activeFilterCount > 0 && (
                <button
                  onClick={() => { setPriorityFilter('all'); setDateFilter('all'); setTechFilter('all'); }}
                  className="col-span-3 text-xs text-red-500 font-semibold flex items-center gap-1 justify-center mt-0.5"
                >
                  <X className="h-3 w-3" /> Clear advanced filters
                </button>
              )}
            </div>
          )}

          {/* Status line */}
          <div className="flex items-center gap-2 pb-0.5">
            <span className="text-[11px] text-slate-400">{filtered.length} work order{filtered.length !== 1 ? 's' : ''}</span>
            {dbJobs.length === 0 && !isLoading && (
              <span className="text-[10px] font-semibold text-slate-300 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">Demo data</span>
            )}
            {!isOnline && (
              <span className="flex items-center gap-1 text-[11px] text-amber-600 font-semibold ml-auto">
                <WifiOff className="h-3 w-3" /> Offline
              </span>
            )}
            {pendingCount > 0 && <span className="text-[11px] text-blue-600 font-semibold ml-auto">{pendingCount} syncing</span>}
            {failedCount  > 0 && <span className="text-[11px] text-red-600 font-semibold">{failedCount} failed</span>}
          </div>
        </div>
      </div>

      {!isOnline && <OfflineBanner pendingCount={pendingCount} />}

      {isRefreshing && (
        <div className="flex justify-center items-center gap-2 py-2.5 bg-blue-50 text-blue-600 text-xs font-medium">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Refreshing…
        </div>
      )}

      {/* ── Active Job Hero (cards/list view only) ─────────── */}
      {view !== 'calendar' && (() => {
        const activeJob = filtered.find(j => ['in_progress', 'checked_in'].includes(j.status));
        return activeJob ? (
          <div className="max-w-2xl mx-auto w-full px-4 pt-2">
            <ActiveJobHero job={activeJob} />
          </div>
        ) : null;
      })()}

      {/* ── Content ───────────────────────────────────────── */}
      <div
        ref={listRef}
        className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 pb-28"
        onTouchStart={onPullStart}
        onTouchEnd={onPullEnd}
      >
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState isOnline={isOnline} />
        ) : view === 'table' ? (() => {
            // Client-side sort + page (mirrors server-side shape)
            const sorted = [...filtered].sort((a, b) => {
              const col = tableSort.col;
              const av = a[col] ?? '', bv = b[col] ?? '';
              const cmp = String(av).localeCompare(String(bv));
              return tableSort.dir === 'asc' ? cmp : -cmp;
            });
            const pageJobs = sorted.slice(tablePage * TABLE_PAGE_SIZE, (tablePage + 1) * TABLE_PAGE_SIZE);
            return (
              <JobsTable
                jobs={pageJobs}
                total={sorted.length}
                page={tablePage}
                pageSize={TABLE_PAGE_SIZE}
                sort={tableSort}
                onSort={handleTableSort}
                onPage={setTablePage}
                onBulkAction={(action, ids) => toast.info(`Bulk ${action} on ${ids.length} job(s) — connect to API`)}
              />
            );
          })()
        : view === 'cards' ? (
          <div className="space-y-4">
            {filtered.map(job => <JobRichCard key={job.id} job={job} />)}
          </div>
        ) : view === 'list' ? (
          <div className="space-y-2">
            {filtered.map(job => <JobListRow key={job.id} job={job} />)}
          </div>
        ) : (
          <JobsCalendar jobs={filtered} />
        )}
      </div>

      {/* ── FAB ───────────────────────────────────────────── */}
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