/**
 * JobOverview — Job context, lifecycle transitions (authoritative), work timer, site/contact.
 */
import React from 'react';
import {
  MapPin, Phone, Mail, User, Clock, Building2,
  AlertTriangle, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import FieldTimeTracker from './FieldTimeTracker';
import JobStateTransitioner from './JobStateTransitioner';
import FieldSectionCard from './FieldSectionCard';
import ReadinessSummaryCard from './ReadinessSummaryCard';
import { LIFECYCLE_DISPLAY } from '@/lib/fieldJobExecutionModel';
import {
  FIELD_BODY,
  FIELD_INNER_STACK,
  FIELD_LINK_PRIMARY,
  FIELD_LINK_SECONDARY,
  FIELD_META_MONO,
  FIELD_OVERLINE,
  FIELD_STACK_GAP,
} from '@/lib/fieldVisualTokens';

function InfoRow({ icon: Icon, label, children, href }) {
  const inner = (
    <div className="flex items-start gap-3">
      <div className="h-7 w-7 rounded-[6px] bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-slate-400" />
      </div>
      <div>
        <p className={FIELD_OVERLINE}>{label}</p>
        <div className={cn(FIELD_BODY, 'font-semibold text-slate-700 mt-px')}>{children}</div>
      </div>
    </div>
  );
  if (href) return <a href={href} className="block">{inner}</a>;
  return <div>{inner}</div>;
}

function fmtTs(ts) {
  try {
    return format(parseISO(ts), 'MMM d, yyyy HH:mm');
  } catch {
    return ts || '—';
  }
}

export default function JobOverview({
  job,
  timeEntries = [],
  executionView,
  evidence,
  onRefresh,
  onNavigateToSection,
  runbookComplete,
  hasSignature,
}) {
  const stat = LIFECYCLE_DISPLAY[job.status] || LIFECYCLE_DISPLAY.assigned;

  return (
    <div className={FIELD_STACK_GAP}>
      <FieldSectionCard>
        <div className={cn(FIELD_INNER_STACK)}>
          <div className="flex items-center justify-between">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold',
                stat.pillBg,
                stat.pillText
              )}
            >
              {stat.label}
            </span>
            <span className={FIELD_META_MONO}>{job.sync_status}</span>
          </div>
          {job.description && (
            <p className={FIELD_BODY}>{job.description}</p>
          )}
          {(job.status === 'in_progress' || job.status === 'checked_in') && onNavigateToSection && (
            <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-2">
              <button
                type="button"
                onClick={() => onNavigateToSection('runbook')}
                className={FIELD_LINK_PRIMARY}
              >
                Open Runbook
              </button>
              <button
                type="button"
                onClick={() => onNavigateToSection('evidence')}
                className={FIELD_LINK_PRIMARY}
              >
                Open Evidence
              </button>
              <button
                type="button"
                onClick={() => onNavigateToSection('closeout')}
                className={FIELD_LINK_SECONDARY}
              >
                Closeout
              </button>
            </div>
          )}
        </div>
      </FieldSectionCard>

      <ReadinessSummaryCard job={job} timeEntries={timeEntries} />

      <div>
        <p className={cn(FIELD_OVERLINE, 'mb-2 px-0.5')}>
          Job state
        </p>
        <p className="text-[11px] text-slate-500 mb-2 px-0.5 leading-snug">
          Update travel, check-in, work, pause, and completion status here.
        </p>
        <JobStateTransitioner
          job={job}
          evidence={evidence}
          runbookComplete={runbookComplete}
          hasSignature={hasSignature}
          onTransitionSuccess={onRefresh}
        />
      </div>

      {job.hazards && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <p className={cn(FIELD_OVERLINE, 'text-red-800')}>Hazards</p>
          </div>
          <p className="text-xs text-red-700 leading-relaxed">{job.hazards}</p>
        </div>
      )}

      <FieldSectionCard title="Work Order">
        <div className={FIELD_INNER_STACK}>
          {job.external_id && <InfoRow icon={FileText} label="WO Number">{job.external_id}</InfoRow>}
          {job.project_name && <InfoRow icon={Building2} label="Project">{job.project_name}</InfoRow>}
          {job.assigned_to && <InfoRow icon={User} label="Assigned To">{job.assigned_to}</InfoRow>}
          {job.scheduled_date && (
            <InfoRow icon={Clock} label="Scheduled">
              {fmtTs(`${job.scheduled_date}T${job.scheduled_time || '00:00'}:00`)}
            </InfoRow>
          )}
          {job.work_start_time && (
            <InfoRow icon={Clock} label="Actual Start">
              {fmtTs(job.work_start_time)}
            </InfoRow>
          )}
          {job.work_end_time && (
            <InfoRow icon={Clock} label="Actual End">
              {fmtTs(job.work_end_time)}
            </InfoRow>
          )}
        </div>
      </FieldSectionCard>

      {(job.site_name || job.site_address) && (
        <FieldSectionCard title="Site">
          <div className={FIELD_INNER_STACK}>
            {job.site_name && <InfoRow icon={Building2} label="Site">{job.site_name}</InfoRow>}
            {job.site_address && (
              <InfoRow icon={MapPin} label="Address">
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(job.site_address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600"
                >
                  {job.site_address}
                </a>
              </InfoRow>
            )}
          </div>
        </FieldSectionCard>
      )}

      {(job.contact_name || job.contact_phone) && (
        <FieldSectionCard title="Contact">
          <div className={FIELD_INNER_STACK}>
            {job.contact_name && <InfoRow icon={User} label="Name">{job.contact_name}</InfoRow>}
            {job.contact_phone && (
              <InfoRow icon={Phone} label="Phone" href={`tel:${job.contact_phone}`}>
                <span className="text-blue-600">{job.contact_phone}</span>
              </InfoRow>
            )}
            {job.contact_email && (
              <InfoRow icon={Mail} label="Email" href={`mailto:${job.contact_email}`}>
                <span className="text-blue-600">{job.contact_email}</span>
              </InfoRow>
            )}
          </div>
        </FieldSectionCard>
      )}

      <div>
        <p className={cn(FIELD_OVERLINE, 'mb-2 px-0.5')}>
          Work timer
        </p>
        <p className="text-[11px] text-slate-500 mb-2 px-0.5 leading-snug">
          Billable time for this job (TimeEntry). Starts after check-in / in progress per job state.
        </p>
        <FieldTimeTracker
          job={job}
          timeEntries={timeEntries}
          executionView={executionView}
          onRefresh={onRefresh}
          variant="embedded"
        />
      </div>
    </div>
  );
}
