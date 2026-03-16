/**
 * JobDetailOverview — Overview tab for the Job Detail cockpit.
 * Shows all mission-critical context: company, site, contact, schedule,
 * geofence, sync, progress, hazards, access instructions.
 */
import React from 'react';
import {
  MapPin, Navigation, Phone, Mail, Clock, User, Building2,
  ShieldAlert, KeyRound, Cloud, RefreshCw, CloudOff, Zap,
  AlertTriangle, CheckCircle2, Package, Wifi, WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { PRIORITY_CFG, STATUS_CFG } from './JobRichCard';

const SYNC_CFG = {
  synced:  { Icon: Cloud,     cls: 'text-emerald-500', label: 'Synced'      },
  pending: { Icon: RefreshCw, cls: 'text-blue-500',    label: 'Syncing…',  spin: true },
  error:   { Icon: CloudOff,  cls: 'text-red-500',     label: 'Sync Error' },
};

function InfoRow({ icon: Icon, label, children, href, iconCls = 'text-slate-400' }) {
  const inner = (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className={cn('h-4 w-4', iconCls)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
        <div className="text-sm text-slate-700 font-semibold leading-snug">{children}</div>
      </div>
    </div>
  );
  if (href) return <a href={href} className="block active:opacity-70">{inner}</a>;
  return <div>{inner}</div>;
}

function SectionCard({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-50">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function ProgressBar({ pct, label }) {
  const color = pct === 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : pct >= 30 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <p className="text-xs font-semibold text-slate-600">{label}</p>
        <p className={cn('text-xs font-black tabular-nums', pct === 100 ? 'text-emerald-600' : 'text-slate-700')}>{pct}%</p>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
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

export default function JobDetailOverview({ job, onNavigateToTasks }) {
  const prio      = PRIORITY_CFG[job.priority] || PRIORITY_CFG.medium;
  const statusCfg = STATUS_CFG[job.status]     || STATUS_CFG.assigned;
  const syncCfg   = SYNC_CFG[job.sync_status]  || SYNC_CFG.synced;
  const SyncIcon  = syncCfg.Icon;
  const progress  = Number(job.progress ?? 0);
  const deliv     = job.deliverables_remaining ?? 0;
  const schedule  = formatSchedule(job);
  const PrioIcon  = prio.Icon || null;

  return (
    <div className="space-y-3">

      {/* ── Status strip ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={cn('flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black', statusCfg.badgeClass)}>
            <span className={cn('h-2 w-2 rounded-full', statusCfg.dotClass)} />
            {statusCfg.label}
          </span>
          <span className={cn('flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold', prio.badgeClass)}>
            {PrioIcon && <PrioIcon className="h-3 w-3" />}
            {prio.label} Priority
          </span>
          <div className="ml-auto flex items-center gap-3">
            {/* Geofence */}
            {job.in_geofence ? (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
                On-site
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                Off-site
              </span>
            )}
            {/* Sync */}
            <SyncIcon
              className={cn('h-4 w-4', syncCfg.cls, syncCfg.spin && 'animate-spin')}
              aria-label={syncCfg.label}
              title={syncCfg.label}
            />
          </div>
        </div>

        {/* Progress */}
        <ProgressBar pct={progress} label="Overall Progress" />

        {/* Deliverables */}
        <div className={cn('flex items-center justify-between mt-3 px-3 py-2 rounded-xl',
          deliv === 0 ? 'bg-emerald-50' : isToday(job.scheduled_date ? parseISO(job.scheduled_date) : new Date()) ? 'bg-red-50' : 'bg-amber-50'
        )}>
          <div className="flex items-center gap-2">
            <Package className={cn('h-4 w-4', deliv === 0 ? 'text-emerald-500' : 'text-amber-600')} />
            <p className={cn('text-xs font-black', deliv === 0 ? 'text-emerald-700' : 'text-amber-700')}>
              {deliv === 0 ? 'All deliverables complete' : `${deliv} deliverable${deliv !== 1 ? 's' : ''} remaining`}
            </p>
          </div>
          {deliv === 0 && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
        </div>
      </div>

      {/* ── Job identity ──────────────────────────────────── */}
      <SectionCard title="Work Order">
        {job.company_name && (
          <InfoRow icon={Building2} label="Client">
            {job.company_name}
          </InfoRow>
        )}
        {job.project_name && (
          <InfoRow icon={Package} label="Project / WO #">
            <span className="font-mono">{job.project_name}</span>
          </InfoRow>
        )}
        {job.assigned_name && (
          <InfoRow icon={User} label="Assigned Technician">
            {job.assigned_name}
            {job.assigned_to && <p className="text-xs text-slate-400 font-normal mt-0.5">{job.assigned_to}</p>}
          </InfoRow>
        )}
        {schedule && (
          <InfoRow icon={Clock} label="Scheduled Window" iconCls={isToday(job.scheduled_date ? parseISO(job.scheduled_date) : new Date()) ? 'text-blue-500' : 'text-slate-400'}>
            {schedule}
          </InfoRow>
        )}
      </SectionCard>

      {/* ── Site & Location ───────────────────────────────── */}
      <SectionCard title="Site & Location">
        {job.site_name && (
          <InfoRow icon={Building2} label="Site Name">
            {job.site_name}
          </InfoRow>
        )}
        {job.site_address && (
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MapPin className="h-4 w-4 text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Address</p>
              <p className="text-sm text-slate-700 font-semibold leading-snug">{job.site_address}</p>
            </div>
            <a
              href={`https://maps.google.com/maps?q=${encodeURIComponent(job.site_address)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-blue-600 text-white text-xs font-bold flex-shrink-0 active:opacity-80"
            >
              <Navigation className="h-3.5 w-3.5" /> Navigate
            </a>
          </div>
        )}
        {job.access_instructions && (
          <InfoRow icon={KeyRound} label="Access Instructions" iconCls="text-amber-500">
            <p className="text-sm text-slate-600 font-normal leading-relaxed">{job.access_instructions}</p>
          </InfoRow>
        )}
      </SectionCard>

      {/* ── Contact ───────────────────────────────────────── */}
      {(job.contact_name || job.contact_phone || job.contact_email) && (
        <SectionCard title="Point of Contact">
          {job.contact_name && (
            <InfoRow icon={User} label="Name">{job.contact_name}</InfoRow>
          )}
          {job.contact_phone && (
            <InfoRow icon={Phone} label="Phone" href={`tel:${job.contact_phone}`} iconCls="text-blue-500">
              <span className="text-blue-600">{job.contact_phone}</span>
            </InfoRow>
          )}
          {job.contact_email && (
            <InfoRow icon={Mail} label="Email" href={`mailto:${job.contact_email}`} iconCls="text-blue-500">
              <span className="text-blue-600">{job.contact_email}</span>
            </InfoRow>
          )}
        </SectionCard>
      )}

      {/* ── Hazards ───────────────────────────────────────── */}
      {job.hazards && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="h-5 w-5 text-red-600" />
            <p className="text-sm font-black text-red-800 uppercase tracking-wide">Hazards / Safety Notes</p>
          </div>
          <p className="text-sm text-red-700 leading-relaxed">{job.hazards}</p>
        </div>
      )}

      {/* ── Notes ─────────────────────────────────────────── */}
      {job.description && (
        <SectionCard title="Job Notes & Scope">
          <p className="text-sm text-slate-600 leading-relaxed">{job.description}</p>
        </SectionCard>
      )}

      {/* ── Quick-start CTA ─────────────────────────────── */}
      {onNavigateToTasks && ['in_progress', 'checked_in', 'en_route', 'paused'].includes(job.status) && (
        <button
          onClick={onNavigateToTasks}
          className="w-full h-14 rounded-2xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
        >
          <ClipboardList className="h-5 w-5" /> View Tasks & Deliverables
        </button>
      )}

    </div>
  );
}