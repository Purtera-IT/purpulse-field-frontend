/**
 * JobDetailOverview — Overview tab for the Job Detail cockpit.
 * Shows all mission-critical context: company, site, contact, schedule,
 * geofence, sync, progress, hazards, access instructions.
 */
import React from 'react';
import {
  MapPin, Navigation, Phone, Mail, Clock, User, Building2,
  ShieldAlert, KeyRound, Cloud, RefreshCw, CloudOff, Zap,
  AlertTriangle, CheckCircle2, Package, ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { PRIORITY_CFG, STATUS_CFG } from './JobRichCard';

const SYNC_CFG = {
  synced:  { Icon: Cloud,     cls: 'text-emerald-500', label: 'Synced'      },
  pending: { Icon: RefreshCw, cls: 'text-blue-500',    label: 'Syncing…',  spin: true },
  error:   { Icon: CloudOff,  cls: 'text-red-500',     label: 'Sync Error' },
};

// dense=true tightens padding/font for the left column
function InfoRow({ icon: Icon, label, children, href, iconCls = 'text-slate-400', dense }) {
  const inner = (
    <div className={cn('flex items-start gap-2', dense ? '' : 'gap-3')}>
      <div className={cn('rounded-[6px] bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5', dense ? 'h-6 w-6' : 'h-8 w-8 rounded-xl')}>
        <Icon className={cn(dense ? 'h-3 w-3' : 'h-4 w-4', iconCls)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-px">{label}</p>
        <div className={cn('text-slate-700 font-semibold leading-snug', dense ? 'text-xs' : 'text-sm')}>{children}</div>
      </div>
    </div>
  );
  if (href) return <a href={href} className="block active:opacity-70">{inner}</a>;
  return <div>{inner}</div>;
}

function SectionCard({ title, children, dense }) {
  return (
    <div className={cn('bg-white border border-slate-100 overflow-hidden', dense ? 'rounded-[8px]' : 'rounded-2xl')}>
      <div className={cn('border-b border-slate-50', dense ? 'px-3 py-2' : 'px-4 py-3')}>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
      </div>
      <div className={cn(dense ? 'p-3 space-y-3' : 'p-4 space-y-4')}>{children}</div>
    </div>
  );
}

function ProgressBar({ pct, label, dense }) {
  const color = pct === 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : pct >= 30 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div>
      <div className="flex justify-between mb-1">
        <p className={cn('font-semibold text-slate-600', dense ? 'text-[10px]' : 'text-xs')}>{label}</p>
        <p className={cn('font-black tabular-nums', dense ? 'text-[10px]' : 'text-xs', pct === 100 ? 'text-emerald-600' : 'text-slate-700')}>{pct}%</p>
      </div>
      <div className={cn('bg-slate-100 rounded-full overflow-hidden', dense ? 'h-1' : 'h-2')}>
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function formatSchedule(job) {
  if (!job.scheduled_date) return null;
  try {
    const d = parseISO(job.scheduled_date);
    const day = isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : format(d, 'EEEE, MMM d');
    const time = job.scheduled_time ? ` · ${job.scheduled_time}` : '';
    const end  = job.scheduled_end_time ? ` – ${job.scheduled_end_time}` : '';
    return `${day}${time}${end}`;
  } catch { return job.scheduled_date; }
}

export default function JobDetailOverview({ job, onNavigateToTasks, dense = false }) {
  const prio      = PRIORITY_CFG[job.priority] || PRIORITY_CFG.medium;
  const statusCfg = STATUS_CFG[job.status]     || STATUS_CFG.assigned;
  const syncCfg   = SYNC_CFG[job.sync_status]  || SYNC_CFG.synced;
  const SyncIcon  = syncCfg.Icon;
  const progress  = Number(job.progress ?? 0);
  const deliv     = job.deliverables_remaining ?? 0;
  const schedule  = formatSchedule(job);
  const PrioIcon  = prio.Icon || null;

  return (
    <div className={cn('space-y-2', !dense && 'space-y-3')}>

      {/* ── Status strip ──────────────────────────────────── */}
      <div className={cn('bg-white border border-slate-100', dense ? 'rounded-[8px] p-3' : 'rounded-2xl p-4')}>
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <span className={cn('inline-flex items-center gap-1 px-1.5 py-px rounded border font-semibold uppercase tracking-wide text-[10px]', statusCfg.badgeClass)}>
            <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', statusCfg.dotClass)} />
            {statusCfg.label}
          </span>
          <span className={cn('inline-flex items-center gap-1 px-1.5 py-px rounded border text-[10px] font-bold', prio.badgeClass)}>
            {PrioIcon && <PrioIcon className="h-2.5 w-2.5" />}
            {prio.label}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {job.in_geofence ? (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
                On-site
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                Off-site
              </span>
            )}
            <SyncIcon className={cn('h-3.5 w-3.5', syncCfg.cls, syncCfg.spin && 'animate-spin')} title={syncCfg.label} />
          </div>
        </div>

        <ProgressBar pct={progress} label="Progress" dense={dense} />

        <div className={cn('flex items-center justify-between mt-2 px-2.5 py-1.5 rounded-[6px]',
          deliv === 0 ? 'bg-emerald-50' : 'bg-amber-50'
        )}>
          <div className="flex items-center gap-1.5">
            <Package className={cn(dense ? 'h-3 w-3' : 'h-4 w-4', deliv === 0 ? 'text-emerald-500' : 'text-amber-600')} />
            <p className={cn('font-black', dense ? 'text-[10px]' : 'text-xs', deliv === 0 ? 'text-emerald-700' : 'text-amber-700')}>
              {deliv === 0 ? 'All deliverables done' : `${deliv} remaining`}
            </p>
          </div>
          {deliv === 0 && <CheckCircle2 className={cn(dense ? 'h-3 w-3' : 'h-4 w-4', 'text-emerald-500')} />}
        </div>
      </div>

      {/* ── Job identity ──────────────────────────────────── */}
      <SectionCard title="Work Order" dense={dense}>
        {job.company_name && <InfoRow icon={Building2} label="Client" dense={dense}>{job.company_name}</InfoRow>}
        {job.project_name && (
          <InfoRow icon={Package} label="Project / WO #" dense={dense}>
            <span className="font-mono">{job.project_name}</span>
          </InfoRow>
        )}
        {job.assigned_name && (
          <InfoRow icon={User} label="Technician" dense={dense}>
            {job.assigned_name}
            {job.assigned_to && <p className="text-[10px] text-slate-400 font-normal mt-px">{job.assigned_to}</p>}
          </InfoRow>
        )}
        {schedule && (
          <InfoRow icon={Clock} label="Scheduled" dense={dense}
            iconCls={isToday(job.scheduled_date ? parseISO(job.scheduled_date) : new Date()) ? 'text-blue-500' : 'text-slate-400'}>
            {schedule}
          </InfoRow>
        )}
      </SectionCard>

      {/* ── Site & Location ───────────────────────────────── */}
      <SectionCard title="Site & Location" dense={dense}>
        {job.site_name    && <InfoRow icon={Building2} label="Site"    dense={dense}>{job.site_name}</InfoRow>}
        {job.site_address && (
          <div className="flex items-start gap-2">
            <div className={cn('rounded-[6px] bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5', dense ? 'h-6 w-6' : 'h-8 w-8')}>
              <MapPin className={cn(dense ? 'h-3 w-3' : 'h-4 w-4', 'text-slate-400')} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-px">Address</p>
              <p className={cn('text-slate-700 font-semibold leading-snug', dense ? 'text-xs' : 'text-sm')}>{job.site_address}</p>
            </div>
            <a
              href={`https://maps.google.com/maps?q=${encodeURIComponent(job.site_address)}`}
              target="_blank" rel="noopener noreferrer"
              className={cn('flex items-center gap-1 rounded-[8px] bg-blue-600 text-white font-bold flex-shrink-0 active:opacity-80', dense ? 'h-7 px-2 text-[10px]' : 'h-9 px-3 text-xs')}
            >
              <Navigation className={cn(dense ? 'h-3 w-3' : 'h-3.5 w-3.5')} /> Nav
            </a>
          </div>
        )}
        {job.access_instructions && (
          <InfoRow icon={KeyRound} label="Access" iconCls="text-amber-500" dense={dense}>
            <p className={cn('text-slate-600 font-normal leading-relaxed', dense ? 'text-[11px]' : 'text-sm')}>{job.access_instructions}</p>
          </InfoRow>
        )}
      </SectionCard>

      {/* ── Contact ───────────────────────────────────────── */}
      {(job.contact_name || job.contact_phone || job.contact_email) && (
        <SectionCard title="Contact" dense={dense}>
          {job.contact_name  && <InfoRow icon={User}  label="Name"  dense={dense}>{job.contact_name}</InfoRow>}
          {job.contact_phone && (
            <InfoRow icon={Phone} label="Phone" href={`tel:${job.contact_phone}`} iconCls="text-blue-500" dense={dense}>
              <span className="text-blue-600">{job.contact_phone}</span>
            </InfoRow>
          )}
          {job.contact_email && (
            <InfoRow icon={Mail} label="Email" href={`mailto:${job.contact_email}`} iconCls="text-blue-500" dense={dense}>
              <span className="text-blue-600">{job.contact_email}</span>
            </InfoRow>
          )}
        </SectionCard>
      )}

      {/* ── Hazards ───────────────────────────────────────── */}
      {job.hazards && (
        <div className={cn('bg-red-50 border border-red-200', dense ? 'rounded-[8px] p-3' : 'rounded-2xl p-4')}>
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldAlert className={cn(dense ? 'h-3.5 w-3.5' : 'h-5 w-5', 'text-red-600')} />
            <p className={cn('font-black text-red-800 uppercase tracking-wide', dense ? 'text-[10px]' : 'text-sm')}>Hazards</p>
          </div>
          <p className={cn('text-red-700 leading-relaxed', dense ? 'text-[11px]' : 'text-sm')}>{job.hazards}</p>
        </div>
      )}

      {/* ── Notes ─────────────────────────────────────────── */}
      {job.description && (
        <SectionCard title="Scope & Notes" dense={dense}>
          <p className={cn('text-slate-600 leading-relaxed', dense ? 'text-[11px]' : 'text-sm')}>{job.description}</p>
        </SectionCard>
      )}

      {/* ── Quick-start CTA (mobile only) ─────────────────── */}
      {onNavigateToTasks && ['in_progress', 'checked_in', 'en_route', 'paused'].includes(job.status) && (
        <button
          onClick={onNavigateToTasks}
          className="w-full h-12 rounded-[8px] bg-slate-900 text-white font-bold text-sm flex items-center justify-center gap-2 active:opacity-80"
        >
          <ClipboardList className="h-4 w-4" /> View Tasks & Deliverables
        </button>
      )}

    </div>
  );
}