/**
 * JobOverview — Overview tab (B)
 * Shows job metadata, status, SOW, assigned techs.
 * Action buttons: Start Job, Complete Job, Snapshot SOW.
 */
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  MapPin, Phone, Mail, User, Clock, Building2,
  Play, CheckCircle, Camera, AlertTriangle, FileText,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

const STATUS_CFG = {
  assigned:         { label: 'Assigned',    bg: 'bg-slate-100',  text: 'text-slate-600'  },
  en_route:         { label: 'En Route',    bg: 'bg-cyan-50',    text: 'text-cyan-700'   },
  checked_in:       { label: 'Checked In',  bg: 'bg-purple-50',  text: 'text-purple-700' },
  in_progress:      { label: 'In Progress', bg: 'bg-blue-50',    text: 'text-blue-700'   },
  paused:           { label: 'Paused',      bg: 'bg-amber-50',   text: 'text-amber-700'  },
  pending_closeout: { label: 'Closeout',    bg: 'bg-orange-50',  text: 'text-orange-700' },
  submitted:        { label: 'Submitted',   bg: 'bg-green-50',   text: 'text-green-700'  },
  approved:         { label: 'Approved',    bg: 'bg-emerald-50', text: 'text-emerald-700'},
  rejected:         { label: 'Rejected',    bg: 'bg-red-50',     text: 'text-red-700'    },
};

function InfoRow({ icon: Icon, label, children, href }) {
  const inner = (
    <div className="flex items-start gap-3">
      <div className="h-7 w-7 rounded-[6px] bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-slate-400" />
      </div>
      <div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <div className="text-xs text-slate-700 font-semibold leading-snug mt-px">{children}</div>
      </div>
    </div>
  );
  if (href) return <a href={href} className="block">{inner}</a>;
  return <div>{inner}</div>;
}

function Card({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100">
      {title && <div className="px-4 py-2.5 border-b border-slate-50"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{title}</p></div>}
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function fmtTs(ts) { try { return format(parseISO(ts), 'MMM d, yyyy HH:mm'); } catch { return ts || '—'; } }

export default function JobOverview({ job, evidence, adapters, onRefresh }) {
  const [snapshotting, setSnapshotting] = useState(false);
  const { permissions } = useAuth();
  const qc = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async ({ status }) => {
      const now = new Date().toISOString();
      const extra = status === 'in_progress' ? { work_start_time: now, check_in_time: now } :
                    status === 'pending_closeout' ? { work_end_time: now } : {};
      return base44.entities.Job.update(job.id, { status, ...extra });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fj-job', job.id] }); onRefresh?.(); },
  });

  const handleStatusChange = (status) => {
    updateMutation.mutate({ status });
    toast.success(`Job marked as ${status.replace(/_/g, ' ')}`);
  };

  const handleSnapshotSOW = async () => {
    setSnapshotting(true);
    await new Promise(r => setTimeout(r, 600));
    setSnapshotting(false);
    toast.success('SOW snapshot created (mock) — version pinned to current runbook.');
  };

  const stat = STATUS_CFG[job.status] || STATUS_CFG.assigned;
  const canStart    = ['assigned', 'en_route', 'checked_in', 'paused'].includes(job.status);
  const canComplete = ['in_progress', 'checked_in'].includes(job.status);

  return (
    <div className="space-y-3">

      {/* Status + actions */}
      <Card>
        <div className="flex items-center justify-between">
          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold', stat.bg, stat.text)}>
            {stat.label}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">{job.sync_status}</span>
        </div>
        {job.description && <p className="text-xs text-slate-600 leading-relaxed">{job.description}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          {canStart && permissions?.canCompleteJob && (
            <button onClick={() => handleStatusChange('in_progress')} disabled={updateMutation.isPending}
              className="flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors">
              <Play className="h-3.5 w-3.5" /> Start Job
            </button>
          )}
          {canStart && !permissions?.canCompleteJob && (
            <button disabled title="Permission required"
              className="flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-slate-100 text-slate-400 text-xs font-bold cursor-not-allowed">
              <Lock className="h-3.5 w-3.5" /> Start Job
            </button>
          )}
          {canComplete && permissions?.canCompleteJob && (
            <button onClick={() => handleStatusChange('pending_closeout')} disabled={updateMutation.isPending}
              className="flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              <CheckCircle className="h-3.5 w-3.5" /> Complete Job
            </button>
          )}
          {canComplete && !permissions?.canCompleteJob && (
            <button disabled title="Permission required"
              className="flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-slate-100 text-slate-400 text-xs font-bold cursor-not-allowed">
              <Lock className="h-3.5 w-3.5" /> Complete Job
            </button>
          )}
          {permissions?.canEditJob && (
            <button onClick={handleSnapshotSOW} disabled={snapshotting}
              className="flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-slate-900 text-white text-xs font-bold hover:bg-slate-700 disabled:opacity-50 transition-colors">
              <FileText className="h-3.5 w-3.5" />
              {snapshotting ? 'Snapshotting…' : 'Snapshot SOW'}
            </button>
          )}
        </div>
      </Card>

      {/* Hazards */}
      {job.hazards && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <p className="text-xs font-black text-red-800 uppercase tracking-wide">Hazards</p>
          </div>
          <p className="text-xs text-red-700 leading-relaxed">{job.hazards}</p>
        </div>
      )}

      {/* Work order details */}
      <Card title="Work Order">
        {job.external_id   && <InfoRow icon={FileText}   label="WO Number">{job.external_id}</InfoRow>}
        {job.project_name  && <InfoRow icon={Building2}  label="Project">{job.project_name}</InfoRow>}
        {job.assigned_to   && <InfoRow icon={User}       label="Assigned To">{job.assigned_to}</InfoRow>}
        {job.scheduled_date && (
          <InfoRow icon={Clock} label="Scheduled">{fmtTs(`${job.scheduled_date}T${job.scheduled_time || '00:00'}:00`)}</InfoRow>
        )}
        {job.work_start_time && <InfoRow icon={Clock} label="Actual Start">{fmtTs(job.work_start_time)}</InfoRow>}
        {job.work_end_time   && <InfoRow icon={Clock} label="Actual End">{fmtTs(job.work_end_time)}</InfoRow>}
      </Card>

      {/* Site */}
      {(job.site_name || job.site_address) && (
        <Card title="Site">
          {job.site_name    && <InfoRow icon={Building2} label="Site">{job.site_name}</InfoRow>}
          {job.site_address && (
            <InfoRow icon={MapPin} label="Address">
              <a href={`https://maps.google.com/?q=${encodeURIComponent(job.site_address)}`} target="_blank" rel="noopener noreferrer"
                className="text-blue-600">{job.site_address}</a>
            </InfoRow>
          )}
        </Card>
      )}

      {/* Contact */}
      {(job.contact_name || job.contact_phone) && (
        <Card title="Contact">
          {job.contact_name  && <InfoRow icon={User}  label="Name">{job.contact_name}</InfoRow>}
          {job.contact_phone && <InfoRow icon={Phone} label="Phone" href={`tel:${job.contact_phone}`}>
            <span className="text-blue-600">{job.contact_phone}</span></InfoRow>}
          {job.contact_email && <InfoRow icon={Mail}  label="Email" href={`mailto:${job.contact_email}`}>
            <span className="text-blue-600">{job.contact_email}</span></InfoRow>}
        </Card>
      )}

      {/* Evidence summary */}
      <Card title="Evidence Summary">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ['Total', evidence.length],
            ['Uploaded', evidence.filter(e => e.status === 'uploaded').length],
            ['Approved', evidence.filter(e => e.approved_for_training).length],
          ].map(([l, v]) => (
            <div key={l} className="bg-slate-50 rounded-lg p-2">
              <p className="text-xl font-black text-slate-900">{v}</p>
              <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-widest">{l}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}