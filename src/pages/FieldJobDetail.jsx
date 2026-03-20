/**
 * FieldJobDetail — Job execution cockpit (B)
 * Tabs: Overview | Runbook | Evidence | TimeLog | Meetings | Audit
 * Full-screen (no bottom nav shell).
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/api/client';
import { jobRepository } from '@/lib/repositories/jobRepository';
import { useAuth } from '@/lib/AuthContext';
import {
  buildCanonicalJobContextString,
  emitJobContextFieldIfChanged,
} from '@/lib/jobContextField';
import { getTechnicianIdForCanonicalEvents } from '@/lib/technicianId';

import JobOverview      from '@/components/fieldv2/JobOverview';
import RunbookSteps     from '@/components/fieldv2/RunbookSteps';
import EvidenceGalleryView from '@/components/fieldv2/EvidenceGalleryView';
import FieldTimeTracker from '@/components/fieldv2/FieldTimeTracker';
import MeetingsTab      from '@/components/fieldv2/MeetingsTab';
import AuditTab         from '@/components/fieldv2/AuditTab';
import OfflineEditsIndicator from '@/components/fieldv2/OfflineEditsIndicator.jsx';
import UploadProgressIndicator from '@/components/fieldv2/UploadProgressIndicator';

const TABS = [
  { id: 'overview',  label: 'Overview'  },
  { id: 'runbook',   label: 'Runbook'   },
  { id: 'evidence',  label: 'Evidence'  },
  { id: 'timelog',   label: 'TimeLog'   },
  { id: 'meetings',  label: 'Meetings'  },
  { id: 'audit',     label: 'Audit'     },
];

const STATUS_DOT = {
  in_progress: 'bg-blue-500',  paused: 'bg-amber-400',
  checked_in:  'bg-purple-500', en_route: 'bg-cyan-500',
};

export default function FieldJobDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const jobId     = urlParams.get('id');
  const initTab   = urlParams.get('tab') || 'overview';
  const [tab, setTab] = useState(initTab);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const qc = useQueryClient();
  const { user } = useAuth();

  // Track online/offline status
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

  /* ── Data queries ────────────────────────────────────────────────── */
  const { data: job, isLoading } = useQuery({
    queryKey: ['fj-job', jobId],
    queryFn:  () => jobId ? jobRepository.getJob(jobId) : Promise.resolve(null),
    enabled:  !!jobId,
    staleTime: 30_000,
  });

  const techKey = getTechnicianIdForCanonicalEvents(user);
  const contextDedupeKey = job ? buildCanonicalJobContextString(job, techKey) : '';

  React.useEffect(() => {
    if (!job?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await emitJobContextFieldIfChanged({ job, user });
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
  }, [job?.id, contextDedupeKey, techKey, user]);

  const { data: evidence = [] } = useQuery({
    queryKey: ['fj-evidence', jobId],
    queryFn:  () => jobId ? apiClient.getEvidence(jobId) : Promise.resolve([]),
    enabled:  !!jobId,
  });

  const { data: labels = [] } = useQuery({
    queryKey: ['fj-labels', jobId],
    queryFn:  () => jobId ? apiClient.getLabels(jobId) : Promise.resolve([]),
    enabled:  !!jobId,
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ['fj-meetings', jobId],
    queryFn:  () => jobId ? apiClient.getMeetings(jobId) : Promise.resolve([]),
    enabled:  !!jobId,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['fj-activities', jobId],
    queryFn:  () => [],
    enabled:  false,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['fj-audit', jobId],
    queryFn:  () => [],
    enabled:  false,
  });

  const invalidateAll = () => {
    ['fj-job','fj-evidence','fj-labels','fj-meetings','fj-activities','fj-audit']
      .forEach(k => qc.invalidateQueries({ queryKey: [k, jobId] }));
  };

  /* ── Guards ──────────────────────────────────────────────────────── */
  if (!jobId) return <div className="p-10 text-center text-slate-400 text-sm">No job ID in URL</div>;
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  );
  if (!job) return <div className="p-10 text-center text-slate-400 text-sm">Job not found</div>;

  const tabProps = { job, evidence, labels, meetings, activities, auditLogs, onRefresh: invalidateAll };
  const activeDot = STATUS_DOT[job.status];

  // Pass full job data to tabs (not just evidence)
  const tabPropsWithJob = { ...tabProps };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ── Sticky header ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 pt-3 pb-0">

          <div className="flex items-center gap-3 mb-2">
            <Link to="/FieldJobs"
              className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center flex-shrink-0 transition-colors">
              <ArrowLeft className="h-4 w-4 text-slate-600" />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {activeDot && <span className={cn('h-2 w-2 rounded-full flex-shrink-0 motion-safe:animate-pulse', activeDot)} />}
                <h1 className="text-sm font-black text-slate-900 truncate">{job.title}</h1>
              </div>
              <p className="text-[10px] text-slate-400 truncate">{job.external_id} · {job.project_name}</p>
            </div>
          </div>

          {/* Tab strip */}
          <div className="flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn(
                  'flex-shrink-0 py-2.5 px-3.5 text-[11px] font-bold border-b-2 transition-all',
                  tab === t.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
                )}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab content ────────────────────────────────────────────── */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 pb-10 space-y-4">
        <OfflineEditsIndicator jobId={jobId} isOnline={isOnline} />
        <UploadProgressIndicator jobId={jobId} isOnline={isOnline} />
        <div>
          {tab === 'overview'  && <JobOverview       {...tabPropsWithJob} />}
          {tab === 'runbook'   && <RunbookSteps       {...tabPropsWithJob} />}
          {tab === 'evidence'  && <EvidenceGalleryView {...tabPropsWithJob} />}
          {tab === 'timelog'   && <FieldTimeTracker    {...tabPropsWithJob} />}
          {tab === 'meetings'  && <MeetingsTab         {...tabPropsWithJob} />}
          {tab === 'audit'     && <AuditTab            {...tabPropsWithJob} />}
        </div>
      </div>
    </div>
  );
}