/**
 * FieldJobs — Job list page (A)
 * Enterprise-grade, mobile-first, information-dense layout.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2, ChevronRight, WifiOff, Briefcase, MapPin, Calendar, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { apiClient } from '@/api/client';

const STATUS_CFG = {
  assigned:         { label: 'Assigned',    bg: 'bg-slate-100',   text: 'text-slate-600',   dot: 'bg-slate-400',   border: 'border-slate-200'   },
  en_route:         { label: 'En Route',    bg: 'bg-cyan-50',     text: 'text-cyan-700',    dot: 'bg-cyan-500',    border: 'border-cyan-200'    },
  checked_in:       { label: 'Checked In',  bg: 'bg-purple-50',   text: 'text-purple-700',  dot: 'bg-purple-500',  border: 'border-purple-200'  },
  in_progress:      { label: 'In Progress', bg: 'bg-blue-50',     text: 'text-blue-700',    dot: 'bg-blue-500',    border: 'border-blue-200'    },
  paused:           { label: 'Paused',      bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-400',   border: 'border-amber-200'   },
  pending_closeout: { label: 'Closeout',    bg: 'bg-orange-50',   text: 'text-orange-700',  dot: 'bg-orange-400',  border: 'border-orange-200'  },
  submitted:        { label: 'Submitted',   bg: 'bg-green-50',    text: 'text-green-700',   dot: 'bg-green-500',   border: 'border-green-200'   },
  approved:         { label: 'Approved',    bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200' },
  rejected:         { label: 'Rejected',    bg: 'bg-red-50',      text: 'text-red-700',     dot: 'bg-red-500',     border: 'border-red-200'     },
  qc_required:      { label: 'QC Required', bg: 'bg-yellow-50',   text: 'text-yellow-700',  dot: 'bg-yellow-500',  border: 'border-yellow-200'  },
  closed:           { label: 'Closed',      bg: 'bg-slate-50',    text: 'text-slate-400',   dot: 'bg-slate-300',   border: 'border-slate-200'   },
};

const PRIO_CFG = {
  urgent: { label: 'Urgent', cls: 'bg-red-100 text-red-700 border border-red-200' },
  high:   { label: 'High',   cls: 'bg-orange-100 text-orange-700 border border-orange-200' },
  medium: { label: 'Med',    cls: 'bg-slate-100 text-slate-600 border border-slate-200' },
  low:    { label: 'Low',    cls: 'bg-slate-50 text-slate-400 border border-slate-200' },
};

const FILTER_CHIPS = ['all', 'assigned', 'in_progress', 'paused', 'pending_closeout', 'approved'];

function StatusBadge({ status }) {
  const c = STATUS_CFG[status] || STATUS_CFG.assigned;
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide flex-shrink-0 border',
      c.bg, c.text, c.border
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', c.dot)} />
      {c.label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const p = PRIO_CFG[priority] || PRIO_CFG.medium;
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide flex-shrink-0', p.cls)}>
      {p.label}
    </span>
  );
}

function fmtDate(d) {
  if (!d) return null;
  try { return format(parseISO(d), 'MMM d'); } catch { return d; }
}

function JobRow({ job }) {
  return (
    <Link
      to={`/FieldJobDetail?id=${job.id}`}
      className="group flex items-center gap-4 bg-white border-b border-slate-100 px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100 transition-colors"
    >
      {/* Left accent bar */}
      <div className={cn(
        'w-1 self-stretch rounded-full flex-shrink-0',
        STATUS_CFG[job.status]?.dot ? STATUS_CFG[job.status].dot : 'bg-slate-200'
      )} />

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Row 1: title + status */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900 leading-snug flex-1">
            {job.title}
          </p>
          <StatusBadge status={job.status} />
        </div>

        {/* Row 2: project / site */}
        {(job.project_name || job.site_name) && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="h-3 w-3 flex-shrink-0 text-slate-400" />
            <span className="truncate">{job.project_name || job.site_name}</span>
          </div>
        )}

        {/* Row 3: meta chips */}
        <div className="flex items-center gap-2 flex-wrap pt-0.5">
          {job.priority && <PriorityBadge priority={job.priority} />}
          {job.scheduled_date && (
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <Calendar className="h-3 w-3" />
              {fmtDate(job.scheduled_date)}
            </span>
          )}
          {job.assigned_to && (
            <span className="flex items-center gap-1 text-[11px] text-slate-400 truncate max-w-[140px]">
              <User className="h-3 w-3 flex-shrink-0" />
              {job.assigned_to.split('@')[0]}
            </span>
          )}
          {job.external_id && (
            <span className="text-[11px] text-slate-300 font-mono">{job.external_id}</span>
          )}
        </div>
      </div>

      {/* Chevron */}
      <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 group-hover:text-slate-500 transition-colors" />
    </Link>
  );
}

export default function FieldJobs() {
  const [search,  setSearch]  = useState('');
  const [statusF, setStatusF] = useState('all');

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['field-jobs'],
    queryFn:  () => apiClient.getJobs(),
    staleTime: 30_000,
  });

  const filtered = jobs.filter(j => {
    const q = search.toLowerCase();
    const matchQ = !q || [j.title, j.project_name, j.site_name, j.site_address, j.assigned_to, j.external_id]
      .some(v => v?.toLowerCase().includes(q));
    const matchS = statusF === 'all' || j.status === statusF;
    return matchQ && matchS;
  });

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Sticky search + filters ───────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 pt-3 pb-2 space-y-2">

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search jobs, sites, projects…"
              className="w-full pl-9 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition"
            />
          </div>

          {/* Filter chips */}
          <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {FILTER_CHIPS.map(s => {
              const count = s === 'all' ? jobs.length : jobs.filter(j => j.status === s).length;
              return (
                <button
                  key={s}
                  onClick={() => setStatusF(s)}
                  className={cn(
                    'flex-shrink-0 h-7 px-3 rounded-md text-[11px] font-semibold transition-all border',
                    statusF === s
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-700'
                  )}
                >
                  {s === 'all' ? 'All' : (STATUS_CFG[s]?.label || s)}
                  <span className={cn(
                    'ml-1.5 tabular-nums',
                    statusF === s ? 'opacity-70' : 'opacity-50'
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Results header ────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          {isLoading ? '…' : `${filtered.length} work order${filtered.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* ── Job list ──────────────────────────────── */}
      <div className="max-w-2xl mx-auto pb-28">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3 text-slate-400">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-slate-300" />
            </div>
            <p className="text-sm font-medium">No jobs match your filters</p>
            {search && (
              <button onClick={() => setSearch('')} className="text-xs text-slate-500 underline underline-offset-2">
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mx-4">
            {filtered.map((job, i) => (
              <JobRow key={job.id} job={job} isLast={i === filtered.length - 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}