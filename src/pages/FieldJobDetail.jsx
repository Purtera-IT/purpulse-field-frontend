/**
 * FieldJobDetail — Single workflow surface: Overview | Runbook | Evidence | Closeout | Comms.
 * Legacy ?tab= values: timelog→overview, meetings→comms, audit→closeout.
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/api/client';
import { base44 } from '@/api/base44Client';
import { jobRepository } from '@/lib/repositories/jobRepository';
import { useAuth } from '@/lib/AuthContext';
import {
  buildCanonicalJobContextString,
  emitJobContextFieldIfChanged,
} from '@/lib/jobContextField';
import { getTechnicianIdForCanonicalEvents } from '@/lib/technicianId';
import { getNextStepMessage } from '@/components/fieldv2/jobExecutionNextStep';
import {
  buildFieldJobExecutionView,
  deriveTimerSessionFromTimeEntries,
  formatWorkedDuration,
} from '@/lib/fieldJobExecutionModel';
import { isRunbookComplete } from '@/lib/runbookExecutionViewModel';
import {
  FIELD_MAX_WIDTH,
  FIELD_META,
  FIELD_PAGE_PAD_X,
  FIELD_PAGE_PAD_Y,
  FIELD_STACK_GAP,
  FIELD_TAB_ACTIVE,
  FIELD_TAB_INACTIVE,
  FIELD_TAB_LABEL,
} from '@/lib/fieldVisualTokens';

import JobOverview from '@/components/fieldv2/JobOverview';
import RunbookSteps from '@/components/fieldv2/RunbookSteps';
import EvidenceGalleryView from '@/components/fieldv2/EvidenceGalleryView';
import JobCloseoutSection from '@/components/fieldv2/JobCloseoutSection';
import JobCommsSection from '@/components/fieldv2/JobCommsSection';
import FieldJobSyncStrip from '@/components/fieldv2/FieldJobSyncStrip';
import { isPurpulseAssignmentsDataSource } from '@/lib/purpulseApiConfig';

const LEGACY_TAB_ALIASES = {
  timelog: 'overview',
  meetings: 'comms',
  audit: 'closeout',
};

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'runbook', label: 'Runbook' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'closeout', label: 'Closeout' },
  { id: 'comms', label: 'Comms' },
];

const VALID_SECTIONS = new Set(SECTIONS.map((s) => s.id));

function normalizeSection(tab) {
  if (!tab || typeof tab !== 'string') return 'overview';
  const t = tab.toLowerCase();
  const mapped = LEGACY_TAB_ALIASES[t] ?? t;
  return VALID_SECTIONS.has(mapped) ? mapped : 'overview';
}

export default function FieldJobDetail() {
  const [searchParams, setSearchParams] = useSearchParams();
  const jobId = searchParams.get('id');
  const section = normalizeSection(searchParams.get('tab'));
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [headerTick, setHeaderTick] = useState(0);
  const qc = useQueryClient();
  const assignmentsListMode = isPurpulseAssignmentsDataSource();
  const { user } = useAuth();

  const setSection = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    if (jobId) next.set('id', jobId);
    setSearchParams(next, { replace: true });
  };

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const { data: jobsList = [], isLoading: jobsListLoading } = useQuery({
    queryKey: ['field-jobs', assignmentsListMode ? 'purpulse' : 'base44'],
    queryFn: () => apiClient.getJobs(),
    enabled: !!jobId && assignmentsListMode,
    staleTime: 30_000,
  });

  const {
    data: jobFromRepo,
    isLoading: jobRepoLoading,
    isError,
    error,
    refetch: refetchJob,
  } = useQuery({
    queryKey: ['fj-job', jobId],
    queryFn: () => (jobId ? jobRepository.getJob(jobId) : Promise.resolve(null)),
    enabled: !!jobId,
    staleTime: 30_000,
  });

  const job = useMemo(() => {
    if (jobFromRepo) return jobFromRepo;
    if (assignmentsListMode && jobId && Array.isArray(jobsList)) {
      const hit = jobsList.find((j) => String(j.id) === String(jobId));
      if (hit) return hit;
    }
    return null;
  }, [jobFromRepo, assignmentsListMode, jobsList, jobId]);

  const isLoading = !job && (jobRepoLoading || (assignmentsListMode && jobsListLoading));

  const { data: timeEntries = [] } = useQuery({
    queryKey: ['fj-time-entries', jobId],
    queryFn: () => (jobId ? apiClient.getTimeEntries(jobId) : Promise.resolve([])),
    enabled: !!jobId,
    staleTime: 15_000,
  });

  const workSegmentOpen = useMemo(
    () => deriveTimerSessionFromTimeEntries(timeEntries).workSegmentOpen,
    [timeEntries]
  );

  useEffect(() => {
    if (!workSegmentOpen) return;
    const id = setInterval(() => setHeaderTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [workSegmentOpen]);

  const executionView = useMemo(() => {
    void headerTick;
    if (!job) return null;
    return buildFieldJobExecutionView(job, timeEntries);
  }, [job, timeEntries, headerTick]);

  const techKey = getTechnicianIdForCanonicalEvents(user);
  const contextDedupeKey = job ? buildCanonicalJobContextString(job, techKey) : '';

  const jobRef = useRef(job);
  const userRef = useRef(user);
  jobRef.current = job;
  userRef.current = user;

  useEffect(() => {
    if (!jobId || !contextDedupeKey) return;
    const j = jobRef.current;
    if (!j?.id || String(j.id) !== jobId) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await emitJobContextFieldIfChanged({ job: j, user: userRef.current });
        if (import.meta.env.DEV && result.emitted) {
          console.debug('[job_context_field] emitted', result.fingerprint?.slice(0, 16));
        }
      } catch (e) {
        if (!cancelled) console.warn('[job_context_field] snapshot failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, contextDedupeKey, techKey]);

  const {
    data: evidence = [],
    isPending: evidencePending,
    isError: evidenceQueryError,
    error: evidenceQueryErr,
    refetch: refetchEvidence,
  } = useQuery({
    queryKey: ['fj-evidence', jobId],
    queryFn: () => (jobId ? apiClient.getEvidence(jobId) : Promise.resolve([])),
    enabled: !!jobId,
  });

  const { data: labels = [] } = useQuery({
    queryKey: ['fj-labels', jobId],
    queryFn: () => (jobId ? apiClient.getLabels(jobId) : Promise.resolve([])),
    enabled: !!jobId,
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ['fj-meetings', jobId],
    queryFn: () => (jobId ? apiClient.getMeetings(jobId) : Promise.resolve([])),
    enabled: !!jobId,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['fj-activities', jobId],
    queryFn: () => [],
    enabled: false,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['fj-audit', jobId],
    queryFn: () => [],
    enabled: false,
  });

  /*
   * Carry-through (NOT Iteration 12 job_context_field scope): blockers query + passing `blockers` into
   * JobCloseoutSection exist for closeout readiness / comms (Iteration 5+). Iteration 12 only changed
   * job-context snapshot timing above (refs + contextDedupeKey). This query should eventually move to
   * jobRepository / apiClient — see technical debt below.
   *
   * TECHNICAL_DEBT: Escalation/blocker list uses base44.entities.Blocker.filter directly.
   * Keep queryKey ['blockers', jobId] aligned with BlockerForm invalidation.
   */
  const { data: blockers = [] } = useQuery({
    queryKey: ['blockers', jobId],
    queryFn: () => (jobId ? base44.entities.Blocker.filter({ job_id: jobId }) : Promise.resolve([])),
    enabled: !!jobId,
    staleTime: 15_000,
  });

  const invalidateAll = () => {
    [
      'fj-job',
      'fj-evidence',
      'fj-labels',
      'fj-meetings',
      'fj-activities',
      'fj-audit',
      'fj-time-entries',
    ].forEach((k) => qc.invalidateQueries({ queryKey: [k, jobId] }));
    qc.invalidateQueries({ queryKey: ['blockers', jobId] });
  };

  if (!jobId) {
    return (
      <div className={cn('min-h-screen flex flex-col items-center justify-center px-6 text-center', FIELD_PAGE_PAD_X)}>
        <p className="text-sm font-semibold text-slate-800">No job selected</p>
        <p className={cn(FIELD_META, 'mt-2 max-w-sm')}>Open a job from the list — the link needs a job id.</p>
        <Link
          to="/FieldJobs"
          className="mt-8 inline-flex min-h-11 items-center justify-center px-4 text-sm font-bold text-slate-900 underline underline-offset-2"
        >
          Back to jobs
        </Link>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-slate-400" aria-hidden />
        <p className={cn(FIELD_META, 'text-slate-600')}>Loading job…</p>
      </div>
    );
  }
  if (isError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-sm font-semibold text-slate-800">Couldn&apos;t load this job</p>
        <p className="text-xs text-slate-500 mt-2 max-w-sm">
          {error instanceof Error ? error.message : 'Check your connection and try again.'}
        </p>
        <button
          type="button"
          onClick={() => refetchJob()}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 text-white text-sm font-bold px-5"
        >
          Retry
        </button>
        <Link
          to="/FieldJobs"
          className="mt-4 inline-flex min-h-11 items-center justify-center text-sm font-bold text-slate-900 underline underline-offset-2"
        >
          Back to jobs
        </Link>
      </div>
    );
  }
  if (!job || !executionView) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center max-w-md mx-auto">
        <p className="text-sm font-semibold text-slate-800">Job not found</p>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          {assignmentsListMode
            ? 'This job is not in your current assignments. It may have been reassigned, closed, or the link is outdated.'
            : 'It may have been removed or you may not have access.'}
        </p>
        {assignmentsListMode && !jobsListLoading && jobsList.length === 0 && (
          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3 max-w-sm leading-relaxed">
            No assignments were returned for your account. Confirm provisioning or sign-in, then retry.
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            qc.invalidateQueries({ queryKey: ['field-jobs', assignmentsListMode ? 'purpulse' : 'base44'] });
            refetchJob();
          }}
          className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-slate-900 text-white text-sm font-bold px-5 w-full max-w-xs"
        >
          Retry (reload assignments)
        </button>
        <Link
          to="/FieldJobs"
          className="mt-4 inline-flex min-h-[44px] items-center justify-center text-sm font-bold text-slate-900 underline underline-offset-2"
        >
          Back to jobs
        </Link>
      </div>
    );
  }

  const runbookComplete = isRunbookComplete(job.runbook_phases);

  const tabProps = {
    job,
    evidence,
    evidenceLoading: evidencePending,
    evidenceLoadError: evidenceQueryError,
    evidenceLoadErrorMessage:
      evidenceQueryErr instanceof Error ? evidenceQueryErr.message : undefined,
    onRetryEvidence: refetchEvidence,
    labels,
    meetings,
    activities,
    auditLogs,
    onRefresh: invalidateAll,
    runbookComplete,
    onNavigateToSection: setSection,
  };

  const nextStep = getNextStepMessage(job, evidence);
  const hasSignature = !!job.signoff_signature_url;

  const headerWorked = formatWorkedDuration(executionView.timer.workedSeconds);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200/80 shadow-sm">
        <div className={cn(FIELD_MAX_WIDTH, 'mx-auto', FIELD_PAGE_PAD_X, 'pt-3 pb-3')}>
          <div className="flex items-center gap-3 mb-2">
            <Link
              to="/FieldJobs"
              className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center flex-shrink-0 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-slate-600" />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full flex-shrink-0 motion-safe:animate-pulse',
                    executionView.lifecycle.dotClass
                  )}
                />
                <h1 className="text-sm font-bold text-slate-900 truncate">{job.title}</h1>
              </div>
              <p className={cn(FIELD_META, 'truncate')}>
                {job.external_id} · {job.project_name}
              </p>
              <p className="text-xs text-slate-600 mt-1 leading-snug">
                <span className="font-bold">{executionView.lifecycle.label}</span>
                <span className="text-slate-300 mx-1.5" aria-hidden>
                  ·
                </span>
                <span>{executionView.timer.workSegmentOpen ? 'Timer on' : 'Timer off'}</span>
                <span className="text-slate-300 mx-1.5" aria-hidden>
                  ·
                </span>
                <span className="font-mono tabular-nums text-slate-500">{headerWorked}</span>
              </p>
              {nextStep && (
                <p className="text-[11px] text-slate-600 mt-1.5 leading-snug line-clamp-2">
                  {nextStep}
                </p>
              )}
            </div>
          </div>

          <div
            className="flex rounded-xl bg-slate-100 p-1 gap-0.5 overflow-x-auto"
            style={{ scrollbarWidth: 'none' }}
            role="tablist"
            aria-label="Job sections"
          >
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={section === s.id}
                onClick={() => setSection(s.id)}
                className={cn(
                  'flex-1 min-w-[4.25rem] min-h-11 py-2 px-1.5 rounded-lg transition-all whitespace-nowrap',
                  FIELD_TAB_LABEL,
                  section === s.id ? FIELD_TAB_ACTIVE : FIELD_TAB_INACTIVE
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className={cn(
          'flex-1 w-full mx-auto pb-10',
          FIELD_MAX_WIDTH,
          FIELD_PAGE_PAD_X,
          FIELD_PAGE_PAD_Y,
          FIELD_STACK_GAP
        )}
      >
        <FieldJobSyncStrip jobId={jobId} isOnline={isOnline} />
        <div>
          {section === 'overview' && (
            <JobOverview
              {...tabProps}
              timeEntries={timeEntries}
              executionView={executionView}
              hasSignature={hasSignature}
              isOnline={isOnline}
            />
          )}
          {section === 'runbook' && <RunbookSteps {...tabProps} />}
          {section === 'evidence' && <EvidenceGalleryView {...tabProps} />}
          {section === 'closeout' && (
            <JobCloseoutSection
              job={job}
              evidence={evidence}
              runbookComplete={runbookComplete}
              timeEntries={timeEntries}
              blockers={blockers}
              auditLogs={auditLogs}
              onRefresh={invalidateAll}
              onNavigateToSection={setSection}
            />
          )}
          {section === 'comms' && <JobCommsSection {...tabProps} />}
        </div>
      </div>
    </div>
  );
}
