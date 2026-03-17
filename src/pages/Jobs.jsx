import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { parseISO, isToday, isTomorrow, isWithinInterval, startOfWeek, endOfWeek } from 'date-fns';
import {
  Loader2, LayoutGrid, List, CalendarDays, Table2,
  SlidersHorizontal, X, ChevronRight, WifiOff, RefreshCw, Camera,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import OfflineBanner from '../components/field/OfflineBanner';
import JobRichCard, { PRIORITY_CFG, STATUS_CFG, getProgress, formatSchedule } from '../components/field/JobRichCard';
import JobsListRow from '../components/field/JobsListRow';
import JobsCalendar from '../components/field/JobsCalendar';
import JobsTable from '../components/field/JobsTable';
import { useJobQueue } from '../hooks/useJobQueue';
import { MOCK_JOBS } from '../lib/mockJobs';
import ActiveJobHero from '../components/field/ActiveJobHero';
import JobsHeader from '../components/JobsHeader';

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

  // Map sync status
  const syncState = !isOnline ? 'offline' : pendingCount > 0 ? 'syncing' : 'synced';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ── Jobs Header (sticky top) ── */}
      <div className="sticky top-0 z-40 bg-slate-50">
      <JobsHeader
        jobCount={allJobs.filter(j => matchesStatus(j, 'all')).length}
        activeFilter={statusFilter}
        onFilterChange={(val) => { setStatusFilter(val); setTablePage(0); }}
        view={view}
        onViewChange={(v) => { setView(v); setTablePage(0); }}
        query={search}
        onSearch={setSearch}
        syncStatus={{ state: syncState, lastUpdated: null }}
        onAdvancedFilters={() => setShowAdvanced(v => !v)}
        activeFilterCount={activeFilterCount}
      />

      </div>

      {/* ── Advanced filters panel (expandable below header) ── */}
      {showAdvanced && (
        <div className="sticky top-[60px] z-40 max-w-2xl mx-auto w-full px-4 py-3 bg-white border-b border-slate-100">
          <div className="grid grid-cols-3 gap-3">
            {/* Priority */}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1">Priority</p>
              <select
                value={priorityFilter}
                onChange={e => setPriorityFilter(e.target.value)}
                className="w-full h-9 rounded-[6px] border border-slate-200 bg-white text-xs font-semibold px-2 focus:outline-none focus:ring-2 focus:ring-[#0B2D5C] text-slate-700"
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
                className="w-full h-9 rounded-[6px] border border-slate-200 bg-white text-xs font-semibold px-2 focus:outline-none focus:ring-2 focus:ring-[#0B2D5C] text-slate-700"
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
                className="w-full h-9 rounded-[6px] border border-slate-200 bg-white text-xs font-semibold px-2 focus:outline-none focus:ring-2 focus:ring-[#0B2D5C] text-slate-700"
              >
                <option value="all">All Techs</option>
                {techs.map(([email, name]) => (
                  <option key={email} value={email}>{name || email}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Reset link */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setPriorityFilter('all'); setDateFilter('all'); setTechFilter('all'); }}
              className="w-full mt-3 text-xs text-red-600 font-semibold flex items-center gap-1 justify-center py-2 hover:bg-red-50 rounded-[6px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0B2D5C]"
            >
              <X className="h-3 w-3" /> Clear advanced filters
            </button>
          )}
        </div>
      )}

      {!isOnline && (
        <div className="sticky top-[60px] z-30">
          <OfflineBanner pendingCount={pendingCount} />
        </div>
      )}

      {/* ── Status line ── */}
      <div className="sticky top-[120px] z-30 max-w-2xl mx-auto w-full px-4 py-2 flex items-center gap-2 text-[11px] bg-white border-b border-slate-50">
        <span className="text-slate-500">{filtered.length} work order{filtered.length !== 1 ? 's' : ''}</span>
        {dbJobs.length === 0 && !isLoading && (
          <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-[3px] border border-slate-100">Demo data</span>
        )}
        {pendingCount > 0 && <span className="text-blue-600 font-semibold ml-auto flex items-center gap-1"><RefreshCw className="h-2.5 w-2.5 animate-spin" /> {pendingCount} syncing</span>}
        {failedCount > 0 && <span className="text-red-600 font-semibold">{failedCount} failed</span>}
      </div>

      {isRefreshing && (
        <div className="sticky top-[160px] z-30 flex justify-center items-center gap-2 py-2.5 bg-blue-50 text-blue-600 text-xs font-medium">
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
          <div className="space-y-1">
            {filtered.map(job => <JobsListRow key={job.id} job={job} />)}
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