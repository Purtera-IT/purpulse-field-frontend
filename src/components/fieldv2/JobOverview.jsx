/**
 * JobOverview — Job context, lifecycle transitions (authoritative), work timer, site/contact.
 */
import React, { lazy, Suspense, useMemo } from 'react';
import {
  Phone, Mail, User, Clock, Building2,
  AlertTriangle, FileText, MapPin, Package, ListChecks, Radio,
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
  FIELD_META,
  FIELD_META_MONO,
  FIELD_OVERLINE,
  FIELD_STACK_GAP,
} from '@/lib/fieldVisualTokens';
import { jobHasSiteCoordinates } from '@/lib/siteOpenInMapsUrl';
import {
  extractEquipmentAndDeliverables,
  extractProvider,
  extractServiceWindow,
  formatServiceWindowLines,
} from '@/lib/runbook/runbookJobHydration';

const JobSiteMapLazy = lazy(() => import('@/components/field/JobSiteMap'));

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
  isOnline = true,
}) {
  const stat = LIFECYCLE_DISPLAY[job.status] || LIFECYCLE_DISPLAY.assigned;
  const showSiteSection = Boolean(
    job.site_name || job.site_address || jobHasSiteCoordinates(job)
  );

  const ac = job.runbook_assignment_context;
  const serviceWindow = useMemo(() => extractServiceWindow(ac), [ac]);
  const windowLines = useMemo(
    () => formatServiceWindowLines(serviceWindow, { mode: 'device' }),
    [serviceWindow]
  );
  const windowLinesSite = useMemo(
    () =>
      serviceWindow.timezoneIana
        ? formatServiceWindowLines(serviceWindow, { mode: 'site' })
        : null,
    [serviceWindow]
  );
  const provider = useMemo(() => extractProvider(ac), [ac]);
  const equipmentDeliverables = useMemo(() => {
    if (job.assignment_source !== 'purpulse_api') return { equipment: [], deliverables: [] };
    return extractEquipmentAndDeliverables({
      schema: 'runbook_v2',
      program_context: job.runbook_program_context || {},
      assignment_context: job.runbook_assignment_context || {},
    });
  }, [job]);

  const showPurpulseSchedule =
    job.assignment_source === 'purpulse_api' &&
    (serviceWindow.startIso || serviceWindow.endIso || serviceWindow.estimatedMinutes != null);

  return (
    <div className={FIELD_STACK_GAP}>
      {!isOnline && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-xs text-amber-950"
          role="status"
        >
          <p className="font-bold">Offline</p>
          <p className={cn(FIELD_META, 'mt-0.5 text-amber-900')}>
            Data may be out of date. Changes save on this device and sync when you reconnect.
          </p>
        </div>
      )}

      {job.assignment_source === 'purpulse_api' && job.assignment_debug?.reason_code ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-950"
          role="status"
        >
          <p className="font-bold">Runbook</p>
          <p className="mt-0.5 leading-snug">{String(job.assignment_debug.reason_code)}</p>
        </div>
      ) : null}

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

      {showPurpulseSchedule && (
        <FieldSectionCard title="Schedule">
          <div className={FIELD_INNER_STACK}>
            <InfoRow icon={MapPin} label="Service window">
              <span className="leading-snug">{windowLines.primary}</span>
            </InfoRow>
            {windowLines.secondary ? (
              <p className={cn(FIELD_META, 'pl-10 -mt-1')}>{windowLines.secondary}</p>
            ) : null}
            {windowLinesSite?.primary && windowLinesSite.secondary ? (
              <>
                <p className={cn(FIELD_META, 'pl-10 pt-1 border-t border-slate-100')}>
                  {windowLinesSite.secondary}
                </p>
                <p className={cn(FIELD_BODY, 'text-slate-700 pl-10 text-sm')}>{windowLinesSite.primary}</p>
              </>
            ) : null}
            {serviceWindow.estimatedMinutes != null ? (
              <InfoRow icon={Clock} label="Estimated duration">
                {serviceWindow.estimatedMinutes} min
              </InfoRow>
            ) : null}
          </div>
        </FieldSectionCard>
      )}

      {(provider.display || provider.dispatch_phone) && (
        <FieldSectionCard title="Provider / dispatch">
          <div className={FIELD_INNER_STACK}>
            {provider.display ? (
              <InfoRow icon={Radio} label="Provider">{provider.display}</InfoRow>
            ) : null}
            {provider.dispatch_phone ? (
              <InfoRow icon={Phone} label="Dispatch" href={`tel:${provider.dispatch_phone}`}>
                <span className="text-blue-600">{provider.dispatch_phone}</span>
              </InfoRow>
            ) : null}
            {provider.fieldnation_provider_id ? (
              <p className={cn(FIELD_META, 'text-[11px]')}>Provider ID: {provider.fieldnation_provider_id}</p>
            ) : null}
          </div>
        </FieldSectionCard>
      )}

      {equipmentDeliverables.equipment.length > 0 && (
        <FieldSectionCard title="Equipment">
          <p className={cn(FIELD_META, 'text-[11px] mb-2 px-0.5 leading-snug')}>
            Verify before you roll. Check off as you pack or confirm on site.
          </p>
          <ul className="space-y-2" aria-label="Equipment checklist">
            {equipmentDeliverables.equipment.map((row) => (
              <li
                key={row.id || row.label}
                className="flex gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2"
              >
                <Package className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" aria-hidden />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800">{row.label}</p>
                  {row.notes ? <p className={cn(FIELD_META, 'mt-0.5')}>{row.notes}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </FieldSectionCard>
      )}

      {equipmentDeliverables.deliverables.length > 0 && (
        <FieldSectionCard title="Deliverables">
          <p className={cn(FIELD_META, 'text-[11px] mb-2 px-0.5 leading-snug')}>
            Capture evidence in the Evidence tab; link to runbook steps when prompted.
          </p>
          <ul className="space-y-2" aria-label="Deliverables">
            {equipmentDeliverables.deliverables.map((row) => (
              <li
                key={row.id || row.label}
                className="flex gap-2 rounded-lg border border-slate-100 bg-white px-2.5 py-2"
              >
                <ListChecks className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800">{row.label}</p>
                  {row.evidence?.length ? (
                    <p className={cn(FIELD_META, 'mt-0.5')}>Evidence: {row.evidence.join(', ')}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {onNavigateToSection ? (
            <button
              type="button"
              onClick={() => onNavigateToSection('evidence')}
              className={cn(FIELD_LINK_PRIMARY, 'mt-3 inline-flex min-h-11 items-center')}
            >
              Open Evidence
            </button>
          ) : null}
        </FieldSectionCard>
      )}

      <ReadinessSummaryCard job={job} timeEntries={timeEntries} />

      <div>
        <p className={cn(FIELD_OVERLINE, 'mb-2 px-0.5')}>
          Job state
        </p>
        <p className="text-[11px] text-slate-500 mb-2 px-0.5 leading-snug">
          Route (ETA + travel) → check-in → start work → timer (billable only). Pause/complete in Job state.
        </p>
        <JobStateTransitioner
          job={job}
          timeEntries={timeEntries}
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

      {showSiteSection && (
        <FieldSectionCard title="Site">
          <p
            className={cn(FIELD_META, 'text-[11px] mb-2 px-0.5 leading-snug')}
          >
            Map and address come from the work order—not your live location.
          </p>
          <div className={cn(FIELD_INNER_STACK, 'gap-3')}>
            {job.site_name && (
              <InfoRow icon={Building2} label="Site">{job.site_name}</InfoRow>
            )}
            <Suspense
              fallback={
                <div
                  className="h-[188px] rounded-xl border border-slate-200 bg-slate-100/80 flex items-center justify-center"
                  aria-hidden
                >
                  <span className={cn(FIELD_META, 'text-[11px] text-slate-400')}>Loading map…</span>
                </div>
              }
            >
              <JobSiteMapLazy job={job} height={188} dense scrollWheelZoom={false} />
            </Suspense>
            {job.site_address?.trim() ? (
              <div className="px-0.5 pt-1">
                <p className={cn(FIELD_OVERLINE)}>Address</p>
                <p className={cn(FIELD_BODY, 'text-slate-700 mt-0.5 break-words leading-snug')}>
                  {job.site_address.trim()}
                </p>
              </div>
            ) : null}
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
