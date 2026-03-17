/**
 * JobTimeline — merges Activity + AuditLog rows for a job
 * and renders them as a chronological timeline.
 */
import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { RefreshCw, Camera, Tag, Clock, AlertTriangle, CheckCircle2, Mic, FileText, Upload, Play, Square, Coffee, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Event config ─────────────────────────────────────────────────────
const ACTIVITY_CFG = {
  clock_in:         { icon: Play,         color: 'bg-emerald-500', label: 'Clocked In'       },
  clock_out:        { icon: Square,       color: 'bg-red-500',     label: 'Clocked Out'      },
  start_step:       { icon: Play,         color: 'bg-blue-500',    label: 'Step Started'     },
  end_step:         { icon: CheckCircle2, color: 'bg-teal-500',    label: 'Step Completed'   },
  upload:           { icon: Upload,       color: 'bg-indigo-500',  label: 'Evidence Uploaded'},
  label:            { icon: Tag,          color: 'bg-purple-500',  label: 'Label Applied'    },
  blocker_created:  { icon: AlertTriangle,color: 'bg-amber-500',   label: 'Blocker Created'  },
  blocker_resolved: { icon: CheckCircle2, color: 'bg-emerald-500', label: 'Blocker Resolved' },
  note_added:       { icon: FileText,     color: 'bg-slate-500',   label: 'Note Added'       },
  qc_review:        { icon: Shield,       color: 'bg-orange-500',  label: 'QC Review'        },
  manifest_export:  { icon: FileText,     color: 'bg-slate-500',   label: 'Manifest Export'  },
};

const AUDIT_CFG = {
  evidence_upload:             { icon: Camera,       color: 'bg-blue-400',    label: 'Evidence Upload'   },
  evidence_retake:             { icon: Camera,       color: 'bg-amber-400',   label: 'Evidence Retake'   },
  evidence_delete:             { icon: Camera,       color: 'bg-red-400',     label: 'Evidence Delete'   },
  label_applied:               { icon: Tag,          color: 'bg-purple-400',  label: 'Label Applied'     },
  label_approved:              { icon: CheckCircle2, color: 'bg-emerald-400', label: 'Label Approved'    },
  label_rejected:              { icon: Tag,          color: 'bg-red-400',     label: 'Label Rejected'    },
  runbook_step_complete:       { icon: CheckCircle2, color: 'bg-teal-400',    label: 'Step Complete'     },
  meeting_created:             { icon: Mic,          color: 'bg-cyan-400',    label: 'Meeting Created'   },
  meeting_transcript_attached: { icon: Mic,          color: 'bg-sky-400',     label: 'Transcript Attached'},
  job_status_change:           { icon: Play,         color: 'bg-indigo-400',  label: 'Status Changed'    },
  closeout_submitted:          { icon: FileText,     color: 'bg-emerald-400', label: 'Closeout Submitted'},
  manifest_exported:           { icon: FileText,     color: 'bg-slate-400',   label: 'Manifest Exported' },
  time_start:                  { icon: Clock,        color: 'bg-emerald-400', label: 'Work Started'      },
  time_stop:                   { icon: Square,       color: 'bg-red-400',     label: 'Work Stopped'      },
  blocker_created:             { icon: AlertTriangle,color: 'bg-amber-400',   label: 'Blocker Created'   },
};

function fmtTs(ts) {
  if (!ts) return '—';
  try { return format(parseISO(ts), 'MMM d, HH:mm:ss'); } catch { return ts; }
}

function TimelineEvent({ event }) {
  const cfg    = event.source === 'activity'
    ? (ACTIVITY_CFG[event.event_type] || { icon: FileText, color: 'bg-slate-400', label: event.event_type })
    : (AUDIT_CFG[event.action_type]  || { icon: Shield,    color: 'bg-slate-300', label: event.action_type });

  const Icon  = cfg.icon;
  const label = cfg.label;

  let details = null;
  if (event.source === 'activity' && event.meta) {
    const m = event.meta;
    details = [
      m.step_title  && `Step: ${m.step_title}`,
      m.duration_s  && `Duration: ${m.duration_s}s`,
      m.note        && `Note: ${m.note}`,
      m.evidence_id && `Evidence: ${String(m.evidence_id).slice(0, 12)}…`,
      (m.lat != null) && `GPS: ${m.lat?.toFixed(4)}, ${m.lon?.toFixed(4)}`,
    ].filter(Boolean);
  } else if (event.source === 'audit' && event.payload_summary) {
    try {
      const p = JSON.parse(event.payload_summary);
      details = Object.entries(p).slice(0, 4).map(([k, v]) => `${k}: ${String(v).slice(0, 60)}`);
    } catch {
      details = [String(event.payload_summary).slice(0, 120)];
    }
  }

  return (
    <div className="flex gap-3 group">
      {/* Dot + line */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={cn('h-7 w-7 rounded-full flex items-center justify-center shadow-sm flex-shrink-0 mt-0.5', cfg.color)}>
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="w-px flex-1 bg-slate-200 my-1" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-slate-800">{label}</p>
            {event.source === 'activity'
              ? <p className="text-[10px] text-slate-400 font-mono">{event.user_id}</p>
              : <p className="text-[10px] text-slate-400 font-mono">{event.actor_email} · {event.actor_role}</p>}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] font-mono text-slate-400">{fmtTs(event.ts)}</p>
            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full',
              event.source === 'activity'
                ? 'bg-slate-100 text-slate-500'
                : event.result === 'error' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'
            )}>
              {event.source === 'activity' ? 'activity' : event.result || 'audit'}
            </span>
          </div>
        </div>
        {details?.length > 0 && (
          <div className="mt-1 bg-slate-50 border border-slate-100 rounded-[4px] px-2.5 py-1.5 space-y-0.5">
            {details.map((d, i) => (
              <p key={i} className="text-[10px] text-slate-500 font-mono">{d}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function JobTimeline({ jobId }) {
  const { data: activities = [], isLoading: loadA } = useQuery({
    queryKey: ['job-activities', jobId],
    queryFn: () => base44.entities.Activity.filter({ work_order_id: jobId }, '-timestamp', 200),
    enabled: !!jobId,
  });

  const { data: auditLogs = [], isLoading: loadL } = useQuery({
    queryKey: ['job-audit', jobId],
    queryFn: () => base44.entities.AuditLog.filter({ job_id: jobId }, '-client_ts', 200),
    enabled: !!jobId,
  });

  const isLoading = loadA || loadL;

  const events = useMemo(() => {
    const actEvents = activities.map(a => ({
      ...a,
      source:   'activity',
      ts:       a.timestamp,
    }));
    const auditEvents = auditLogs.map(l => ({
      ...l,
      source: 'audit',
      ts:     l.client_ts || l.server_ts,
    }));
    return [...actEvents, ...auditEvents].sort((a, b) => new Date(b.ts) - new Date(a.ts));
  }, [activities, auditLogs]);

  if (!jobId) return <p className="text-xs text-slate-400 text-center py-8">Select a job to view its timeline</p>;

  if (isLoading) return (
    <div className="flex justify-center py-10">
      <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
    </div>
  );

  if (!events.length) return (
    <div className="text-center py-10 text-slate-400">
      <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
      <p className="text-sm font-semibold">No events for this job yet</p>
      <p className="text-xs mt-1 text-slate-300">{activities.length} activities · {auditLogs.length} audit entries</p>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {events.length} events · {activities.length} activities · {auditLogs.length} audit
        </p>
      </div>
      <div className="space-y-0">
        {events.map((ev, i) => <TimelineEvent key={`${ev.source}-${ev.id || i}`} event={ev} />)}
      </div>
    </div>
  );
}