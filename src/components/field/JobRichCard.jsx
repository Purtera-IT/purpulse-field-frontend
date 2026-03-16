import React from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin, Phone, Clock, ChevronRight, Package,
  Cloud, RefreshCw, CloudOff, Zap, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';

// ── Shared config (exported for use in Jobs.jsx) ─────────────────────
export const PRIORITY_CFG = {
  urgent: { borderClass: 'border-l-red-500',    badgeClass: 'bg-red-100 text-red-700',       dotClass: 'bg-red-500',    label: 'Urgent',  Icon: Zap },
  high:   { borderClass: 'border-l-orange-500', badgeClass: 'bg-orange-100 text-orange-700', dotClass: 'bg-orange-500', label: 'High',    Icon: AlertTriangle },
  medium: { borderClass: 'border-l-blue-400',   badgeClass: 'bg-blue-50 text-blue-600',      dotClass: 'bg-blue-400',   label: 'Medium',  Icon: null },
  low:    { borderClass: 'border-l-slate-300',  badgeClass: 'bg-slate-100 text-slate-500',   dotClass: 'bg-slate-300',  label: 'Low',     Icon: null },
};

export const STATUS_CFG = {
  assigned:         { label: 'Assigned',       badgeClass: 'bg-slate-100 text-slate-600',     dotClass: 'bg-slate-400'   },
  en_route:         { label: 'En Route',        badgeClass: 'bg-blue-100 text-blue-700',       dotClass: 'bg-blue-500'    },
  checked_in:       { label: 'Checked In',      badgeClass: 'bg-cyan-100 text-cyan-700',       dotClass: 'bg-cyan-500'    },
  in_progress:      { label: 'In Progress',     badgeClass: 'bg-emerald-100 text-emerald-700', dotClass: 'bg-emerald-500' },
  paused:           { label: 'Paused',          badgeClass: 'bg-amber-100 text-amber-700',     dotClass: 'bg-amber-500'   },
  pending_closeout: { label: 'Closeout Ready',  badgeClass: 'bg-purple-100 text-purple-700',   dotClass: 'bg-purple-500'  },
  submitted:        { label: 'Submitted',       badgeClass: 'bg-indigo-100 text-indigo-700',   dotClass: 'bg-indigo-500'  },
  approved:         { label: 'Approved',        badgeClass: 'bg-teal-100 text-teal-700',       dotClass: 'bg-teal-500'    },
  rejected:         { label: 'Rejected',        badgeClass: 'bg-red-100 text-red-700',         dotClass: 'bg-red-500'     },
};

const SYNC_CFG = {
  synced:  { Icon: Cloud,     colorClass: 'text-emerald-500', label: 'Synced',     spin: false },
  pending: { Icon: RefreshCw, colorClass: 'text-blue-500',    label: 'Syncing…',   spin: true  },
  error:   { Icon: CloudOff,  colorClass: 'text-red-500',     label: 'Sync Error', spin: false },
};

export function getProgress(job) {
  if (job.progress !== undefined && job.progress !== null) return Number(job.progress);
  if (job.runbook_phases?.length) {
    const done = job.runbook_phases.filter(p => p.steps?.every(s => s.completed)).length;
    return Math.round((done / job.runbook_phases.length) * 100);
  }
  if (['approved', 'submitted'].includes(job.status)) return 100;
  return 0;
}

export function formatSchedule(job) {
  if (!job.scheduled_date) return null;
  try {
    const d = parseISO(job.scheduled_date);
    const dayLabel = isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : format(d, 'EEE, MMM d');
    return `${dayLabel}${job.scheduled_time ? ' · ' + job.scheduled_time : ''}`;
  } catch {
    return job.scheduled_date;
  }
}

function getCtaLabel(status) {
  return {
    assigned:         'Start Navigation',
    en_route:         'Mark Arrived',
    checked_in:       'Begin Work',
    in_progress:      'Continue Work',
    paused:           'Resume Work',
    pending_closeout: 'Submit Closeout',
    submitted:        'View Submission',
    approved:         'View Report',
    rejected:         'View Details',
  }[status] || 'View Details';
}

function getCtaBg(status) {
  if (['in_progress', 'checked_in'].includes(status)) return 'bg-emerald-600 text-white';
  if (status === 'paused') return 'bg-amber-500 text-white';
  if (status === 'pending_closeout') return 'bg-purple-600 text-white';
  if (status === 'approved') return 'bg-teal-600 text-white';
  if (status === 'en_route') return 'bg-blue-600 text-white';
  return 'bg-slate-900 text-white';
}

// ── Progress Ring ────────────────────────────────────────────────────
function ProgressRing({ pct, size = 48 }) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(pct / 100, 1) * circ;
  const color = pct === 100 ? '#10b981' : pct >= 60 ? '#3b82f6' : pct >= 30 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[9px] font-black" style={{ color }}>{pct}%</span>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────
export default function JobRichCard({ job }) {
  const prio      = PRIORITY_CFG[job.priority]   || PRIORITY_CFG.medium;
  const statusCfg = STATUS_CFG[job.status]       || STATUS_CFG.assigned;
  const syncCfg   = SYNC_CFG[job.sync_status]    || SYNC_CFG.synced;
  const SyncIcon  = syncCfg.Icon;
  const PrioIcon  = prio.Icon;
  const progress  = getProgress(job);
  const schedule  = formatSchedule(job);
  const deliv     = job.deliverables_remaining ?? 0;

  let isScheduledToday = false;
  try { isScheduledToday = job.scheduled_date ? isToday(parseISO(job.scheduled_date)) : false; } catch {}

  const delivWarning = deliv > 0 && isScheduledToday;

  return (
    <div className={cn('bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden border-l-4', prio.borderClass)}>

      {/* ── Top strip ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 flex-wrap">
        <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black', prio.badgeClass)}>
          {PrioIcon && <PrioIcon className="h-2.5 w-2.5" />}
          {prio.label.toUpperCase()}
        </span>
        <span className={cn('flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold', statusCfg.badgeClass)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', statusCfg.dotClass)} />
          {statusCfg.label}
        </span>
        <div className="ml-auto flex items-center gap-2.5">
          <SyncIcon
            className={cn('h-3.5 w-3.5', syncCfg.colorClass, syncCfg.spin && 'animate-spin')}
            aria-label={syncCfg.label}
          />
          {job.in_geofence ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
              On-site
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              Off-site
            </span>
          )}
        </div>
      </div>

      {/* ── Title ─────────────────────────────────────────── */}
      <div className="px-4 pb-3">
        <h3 className="text-[15px] font-black text-slate-900 leading-tight line-clamp-2">{job.title}</h3>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs font-semibold text-slate-500">{job.company_name || job.project_name}</span>
          {job.project_name && job.company_name && (
            <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
              {job.project_name}
            </span>
          )}
          {job.assigned_name && (
            <span className="text-[10px] font-semibold text-slate-400 ml-auto">
              👤 {job.assigned_name}
            </span>
          )}
        </div>
      </div>

      <div className="mx-4 border-t border-slate-50" />

      {/* ── Info rows ─────────────────────────────────────── */}
      <div className="px-4 py-3 space-y-2">
        {job.site_address && (
          <a
            href={`https://maps.google.com/maps?q=${encodeURIComponent(job.site_address)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-start gap-2.5 group"
            onClick={e => e.stopPropagation()}
          >
            <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              {job.site_name && <p className="text-xs font-bold text-slate-700 leading-tight">{job.site_name}</p>}
              <p className="text-xs text-slate-500 group-active:underline truncate">{job.site_address}</p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300 flex-shrink-0 mt-0.5" />
          </a>
        )}
        {job.contact_name && (
          <a href={`tel:${job.contact_phone}`} className="flex items-center gap-2.5 active:underline">
            <Phone className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            <p className="text-xs text-slate-600">
              {job.contact_name}
              {job.contact_phone && <span className="text-slate-400"> · {job.contact_phone}</span>}
            </p>
          </a>
        )}
        {schedule && (
          <div className="flex items-center gap-2.5">
            <Clock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            <p className={cn('text-xs font-semibold', isScheduledToday ? 'text-blue-600' : 'text-slate-600')}>
              {schedule}
            </p>
          </div>
        )}
      </div>

      <div className="mx-4 border-t border-slate-50" />

      {/* ── Metrics ───────────────────────────────────────── */}
      <div className="px-4 py-3 flex items-center gap-3">
        <ProgressRing pct={progress} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Progress</p>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all',
                progress === 100 ? 'bg-emerald-500' : progress >= 60 ? 'bg-blue-500' : progress >= 30 ? 'bg-amber-400' : 'bg-red-400'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl flex-shrink-0',
          deliv === 0 ? 'bg-emerald-50' : delivWarning ? 'bg-red-50' : 'bg-amber-50'
        )}>
          <Package className={cn('h-3.5 w-3.5',
            deliv === 0 ? 'text-emerald-500' : delivWarning ? 'text-red-500' : 'text-amber-600'
          )} />
          <span className={cn('text-xs font-black',
            deliv === 0 ? 'text-emerald-600' : delivWarning ? 'text-red-700' : 'text-amber-700'
          )}>
            {deliv === 0 ? '✓ Done' : `${deliv} left`}
          </span>
        </div>
      </div>

      {/* ── CTA ───────────────────────────────────────────── */}
      <div className="px-4 pb-4">
        <Link
          to={`/JobDetail?id=${job.id}`}
          className={cn(
            'flex items-center justify-center gap-2 w-full h-12 rounded-xl font-bold text-sm active:opacity-80 transition-opacity',
            getCtaBg(job.status)
          )}
        >
          {getCtaLabel(job.status)}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}