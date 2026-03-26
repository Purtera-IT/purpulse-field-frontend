/**
 * Closeout — readiness checklist (gated, truthful), sign-off, audit/history (secondary).
 * Lifecycle transitions stay on Overview (JobStateTransitioner).
 */
import React, { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, AlertCircle, Info, ChevronRight } from 'lucide-react';
import AuditTab from './AuditTab';
import SignoffCapture from '@/components/field/SignoffCapture';
import JobCloseoutOutcomePanel from '@/components/fieldv2/JobCloseoutOutcomePanel';
import { cn } from '@/lib/utils';
import { deriveTimerSessionFromTimeEntries } from '@/lib/fieldJobExecutionModel';
import { buildCloseoutReadinessSummary } from '@/lib/closeoutReadinessViewModel';
import {
  FIELD_CARD,
  FIELD_CTRL_H,
  FIELD_LINK_PRIMARY,
  FIELD_META,
  FIELD_OVERLINE,
  FIELD_SURFACE_MUTED,
} from '@/lib/fieldVisualTokens';

function ChecklistRow({ item, onNavigate }) {
  const showWarn = !item.met && item.kind === 'blocking';
  const showAttention = item.kind === 'attention' && !item.met;

  return (
    <div
      className={cn(
        'flex gap-3 rounded-lg border px-3 py-2.5',
        showWarn && 'border-red-200 bg-red-50/60',
        item.met && item.kind === 'blocking' && 'border-emerald-200 bg-emerald-50/50',
        item.met && item.kind === 'info' && 'border-slate-100 bg-slate-50/80',
        showAttention && 'border-amber-200 bg-amber-50/50',
        item.kind === 'info' && item.met && 'border-slate-100 bg-slate-50/40'
      )}
    >
      <div className="pt-0.5 flex-shrink-0">
        {item.met ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
        ) : showAttention ? (
          <AlertCircle className="h-4 w-4 text-amber-600" aria-hidden />
        ) : item.kind === 'info' ? (
          <Info className="h-4 w-4 text-slate-400" aria-hidden />
        ) : (
          <AlertCircle className="h-4 w-4 text-red-600" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-slate-900 leading-snug">{item.label}</p>
        <p className={cn(FIELD_META, 'mt-1 leading-snug')}>{item.detail}</p>
        {item.actionLabel && item.navigateTo && onNavigate ? (
          <button
            type="button"
            onClick={() => onNavigate(item.navigateTo)}
            className={cn(FIELD_LINK_PRIMARY, 'inline-flex items-center gap-1 mt-2 text-xs font-bold', FIELD_CTRL_H)}
          >
            {item.actionLabel}
            <ChevronRight className="h-3 w-3" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function JobCloseoutSection({
  job,
  evidence = [],
  runbookComplete = false,
  timeEntries = [],
  blockers = [],
  auditLogs,
  onRefresh,
  onNavigateToSection,
}) {
  const qc = useQueryClient();

  const workSegmentOpen = useMemo(
    () => deriveTimerSessionFromTimeEntries(timeEntries).workSegmentOpen,
    [timeEntries]
  );

  const readiness = useMemo(
    () =>
      buildCloseoutReadinessSummary({
        job,
        evidence,
        runbookComplete,
        workSegmentOpen,
        blockers,
      }),
    [job, evidence, runbookComplete, workSegmentOpen, blockers]
  );

  const showSignoff = job.status === 'pending_closeout' && !job.signoff_signature_url;

  const navigate = (section) => {
    if (section === 'closeout') {
      requestAnimationFrame(() => {
        const el = document.getElementById('closeout-signoff-anchor');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (el && typeof el.focus === 'function') {
          try {
            el.focus({ preventScroll: true });
          } catch {
            el.focus();
          }
        }
      });
      return;
    }
    if (section === 'closeout_outcome') {
      requestAnimationFrame(() => {
        const el = document.getElementById('closeout-technician-outcome-anchor');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (el && typeof el.focus === 'function') {
          try {
            el.focus({ preventScroll: true });
          } catch {
            el.focus();
          }
        }
      });
      return;
    }
    onNavigateToSection?.(section);
  };

  const summaryStyles = (() => {
    const active = job.status === 'in_progress' || job.status === 'pending_closeout';
    if (!active) return 'border-slate-200 bg-white';
    if (readiness.overall === 'ready') return 'border-emerald-200 bg-emerald-50/40';
    if (readiness.overall === 'blocked') return 'border-amber-200 bg-amber-50/30';
    if (readiness.overall === 'review_suggested') return 'border-slate-200 bg-slate-50/80';
    return 'border-slate-200 bg-white';
  })();

  return (
    <div className="space-y-6">
      <div>
        <p className={cn(FIELD_OVERLINE, 'mb-1')}>Closeout</p>
        <p className="text-xs text-slate-600 leading-snug">
          Final operational checkpoint: readiness, sign-off, then activity for reference. Complete work and submit
          closeout from <strong className="font-semibold text-slate-700">Overview</strong> (Job state).
        </p>
      </div>

      <div className={cn(FIELD_CARD, 'p-4 border-2', summaryStyles)}>
        <p className="text-sm font-bold text-slate-900 leading-tight">{readiness.headline}</p>
        {readiness.subline ? (
          <p className={cn(FIELD_META, 'mt-2 leading-snug')}>{readiness.subline}</p>
        ) : null}
        {readiness.checks.length > 0 ? (
          <div className="mt-4 space-y-2" aria-label="Closeout readiness checklist">
            <p className={cn(FIELD_OVERLINE, 'text-[10px]')}>Checklist</p>
            {readiness.checks.map((item) => (
              <ChecklistRow key={item.id} item={item} onNavigate={navigate} />
            ))}
          </div>
        ) : null}
      </div>

      <JobCloseoutOutcomePanel
        job={job}
        onComplete={() => {
          qc.invalidateQueries({ queryKey: ['fj-job', job.id] });
          onRefresh?.();
        }}
      />

      {/* Sign-off is one readiness criterion, not the whole section */}
      <div
        id="closeout-signoff-anchor"
        className="scroll-mt-24 outline-none rounded-lg"
        tabIndex={-1}
        role="region"
        aria-label="Sign-off"
      >
        <p className={cn(FIELD_OVERLINE, 'mb-2')}>Sign-off</p>
        <p className={cn(FIELD_META, 'mb-3 leading-snug')}>
          {job.status === 'pending_closeout'
            ? 'Required for this job, together with the checklist above, before you submit closeout from Job state.'
            : 'When the job is in pending closeout, capture customer sign-off here.'}
        </p>
        {showSignoff && (
          <div className={cn(FIELD_CARD, 'p-4')}>
            <SignoffCapture
              job={job}
              onComplete={() => {
                qc.invalidateQueries({ queryKey: ['fj-job', job.id] });
                onRefresh?.();
              }}
            />
          </div>
        )}

        {job.status === 'pending_closeout' && job.signoff_signature_url && (
          <p className="text-xs text-emerald-800 font-semibold bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            Sign-off is on file — when the checklist is clear, submit closeout from Job state.
          </p>
        )}

        {job.status !== 'pending_closeout' && (
          <p className={cn(FIELD_SURFACE_MUTED, 'text-xs text-slate-600 rounded-lg px-3 py-2 border border-slate-100')}>
            Sign-off capture unlocks when the job is in <strong className="font-semibold">Pending closeout</strong>.
          </p>
        )}
      </div>

      <div className="pt-4 mt-2 border-t border-slate-200/90">
        <div className={cn(FIELD_SURFACE_MUTED, 'p-3 opacity-95')}>
          <p className={cn(FIELD_OVERLINE, 'mb-2')}>Activity on this job</p>
          <p className="text-[11px] text-slate-500 mb-3">Secondary reference — audit when synced from the server.</p>
          <AuditTab auditLogs={auditLogs} />
        </div>
      </div>
    </div>
  );
}
