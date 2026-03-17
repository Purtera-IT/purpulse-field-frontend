/**
 * FieldJobs — Job list page (A)
 * Mobile-first, uses JobsAdapter.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2, ChevronRight, WifiOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { defaultAdapters } from '@/lib/fieldAdapters';

const STATUS_CFG = {
  assigned:         { label: 'Assigned',    bg: 'bg-slate-100',   text: 'text-slate-600',   dot: 'bg-slate-400'   },
  en_route:         { label: 'En Route',    bg: 'bg-cyan-50',     text: 'text-cyan-700',    dot: 'bg-cyan-500'    },
  checked_in:       { label: 'Checked In',  bg: 'bg-purple-50',   text: 'text-purple-700',  dot: 'bg-purple-500'  },
  in_progress:      { label: 'In Progress', bg: 'bg-blue-50',     text: 'text-blue-700',    dot: 'bg-blue-500'    },
  paused:           { label: 'Paused',      bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-400'   },
  pending_closeout: { label: 'Closeout',    bg: 'bg-orange-50',   text: 'text-orange-700',  dot: 'bg-orange-400'  },
  submitted:        { label: 'Submitted',   bg: 'bg-green-50',    text: 'text-green-700',   dot: 'bg-green-500'   },
  approved:         { label: 'Approved',    bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
  rejected:         { label: 'Rejected',    bg: 'bg-red-50',      text: 'text-red-700',     dot: 'bg-red-500'     },
  qc_required:      { label: 'QC Required', bg: 'bg-yellow-50',   text: 'text-yellow-700',  dot: 'bg-yellow-500'  },
  closed:           { label: 'Closed',      bg: 'bg-slate-50',    text: 'text-slate-400',   dot: 'bg-slate-300'   },
};
const PRIO_CFG = {
  urgent: { label: '🔴 Urgent', cls: 'text-red-600' },
  high:   { label: '🟠 High',   cls: 'text-orange-500' },
  medium: { label: '🔵 Med',    cls: 'text-blue-500' },
  low:    { label: '⚪ Low',    cls: 'text-slate-400' },
};
const FILTER_CHIPS = ['all','assigned','in_progress','paused','pending_closeout','approved'];

function StatusBadge({ status }) {
  const c = STATUS_CFG[status] || STATUS_CFG.assigned;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0', c.bg, c.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', c.dot)} />
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
      className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1">
          <p className="text-sm font-bold text-slate-900 flex-1 leading-snug line-clamp-2">{job.title}</p>
          <StatusBadge status={job.status} />
        </div>
        <p className="text-xs text-slate-400 truncate mb-1.5">{job.project_name || job.site_name || '—'}</p>
        <div className="flex items-center gap-3 text-[11px] flex-wrap">
          <span className={prio.cls}>{prio.label}</span>
          {job.scheduled_date && <span className="text-slate-400">📅 {fmtDate(job.scheduled_date)}</span>}
          {job.assigned_to && <span className="text-slate-400 truncate max-w-[100px]">👤 {job.assigned_to.split('@')[0]}</span>}
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

export default function FieldJobs({ adapter = defaultAdapters.jobs }) {
  const [search,   setSearch]   = useState('');
  const [statusF,  setStatusF]  = useState('all');

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['field-jobs'],
    queryFn:  () => adapter.listJobs(),
    staleTime: 30_000,
  });

  const filtered = jobs.filter(j => {
    const q = search.toLowerCase();
    const matchQ = !q || [j.title, j.project_name, j.site_name, j.site_address, j.assigned_to]
      .some(v => v?.toLowerCase().includes(q));
    const matchS = statusF === 'all' || j.status === statusF;
    return matchQ && matchS;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky filter bar */}
      <div className="sticky top-14 z-10 bg-white border-b border-slate-100">
        <div className="max-w-2xl mx-auto px-4 pt-3 pb-2 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search jobs, sites, projects…"
              className="pl-9 bg-slate-50 border-0 rounded-xl focus-visible:ring-1 h-9 text-sm" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {FILTER_CHIPS.map(s => (
              <button key={s} onClick={() => setStatusF(s)}
                className={cn('flex-shrink-0 h-7 px-3 rounded-full text-[11px] font-bold transition-colors capitalize',
                  statusF === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                )}>
                {s === 'all' ? `All (${jobs.length})` : (STATUS_CFG[s]?.label || s)}
                {s !== 'all' && (
                  <span className="ml-1 opacity-60">{jobs.filter(j => j.status === s).length}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="max-w-2xl mx-auto px-4 py-4 pb-28 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3 text-slate-400">
            <WifiOff className="h-8 w-8" />
            <p className="text-sm font-medium">No jobs match your filters</p>
          </div>
        ) : (
          filtered.map(job => <JobCard key={job.id} job={job} />)
        )}
      </div>
    </div>
  );
}