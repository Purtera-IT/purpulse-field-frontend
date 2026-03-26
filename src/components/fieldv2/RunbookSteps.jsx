/**
 * RunbookSteps — canonical Runbook tab: job.runbook_phases only, persisted outcomes, phase gating, evidence linkage.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { jobRepository } from '@/lib/repositories/jobRepository';
import {
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  FileText,
  Paperclip,
  Lock,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import EvidenceCaptureModal from './EvidenceCaptureModal';
import { useAuth } from '@/lib/AuthContext';
import { emitRunbookStepEvent } from '@/lib/runbookStepEvent';
import {
  sortRunbookPhases,
  sortStepsInPhase,
  computePhaseBlocked,
  computeRunbookProgress,
  findNextFocusStep,
  mergeRunbookStepOutcome,
  persistedStepUiBucket,
  stepDisplayTitle,
} from '@/lib/runbookExecutionViewModel';
import {
  FIELD_CARD,
  FIELD_LINK_PRIMARY,
  FIELD_META,
  FIELD_OVERLINE,
  FIELD_SURFACE_MUTED,
} from '@/lib/fieldVisualTokens';

function useStepTimer(running) {
  const [secs, setSecs] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => setSecs((s) => s + 1), 1000);
    } else clearInterval(ref.current);
    return () => clearInterval(ref.current);
  }, [running]);
  useEffect(() => {
    if (!running) setSecs(0);
  }, [running]);
  const h = Math.floor(secs / 3600),
    m = Math.floor((secs % 3600) / 60),
    s = secs % 60;
  const display = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return { display, elapsedSecs: secs };
}

const STEP_STATUS = {
  idle: { label: 'Not started', bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-300' },
  in_progress: { label: 'Running', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  complete: { label: 'Complete', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  failed: { label: 'Failed', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
};

/** Primary runbook actions: min 44×44px touch target (field / safety). */
const FIELD_RUNBOOK_CTRL =
  'min-h-[44px] min-w-[44px] px-4 inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold';

const GATE_PRESENTATION = {
  red_gate: { label: 'Critical', className: 'bg-red-100 text-red-900' },
  important: { label: 'Important', className: 'bg-amber-100 text-amber-900' },
  informational: { label: 'Info', className: 'bg-slate-100 text-slate-700' },
};

function phaseMetaBlurb(meta) {
  if (!meta || typeof meta !== 'object') return null;
  const o = meta;
  const s =
    (typeof o.description === 'string' && o.description.trim()) ||
    (typeof o.summary === 'string' && o.summary.trim()) ||
    (typeof o.notes === 'string' && o.notes.trim()) ||
    null;
  return s || null;
}

function StepTimer({ display }) {
  if (!display) return null;
  return (
    <div className="flex items-center gap-1.5 text-blue-600">
      <Clock className="h-3 w-3" />
      <span className="font-mono text-xs font-bold tabular-nums">{display}</span>
    </div>
  );
}

function EvidenceThumbnail({ ev }) {
  if (!ev) return null;
  const isImg = ev.content_type?.startsWith('image');
  return (
    <div
      className="h-12 w-12 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 bg-slate-50 flex items-center justify-center"
      title={ev.notes || ev.evidence_type}
    >
      {isImg ? (
        <img src={ev.file_url || ev.thumbnail_url} alt="evidence" className="h-full w-full object-cover" />
      ) : (
        <FileText className="h-5 w-5 text-slate-400" />
      )}
    </div>
  );
}

function RunbookStep({
  step,
  phase,
  job,
  jobId,
  evidence,
  adapters,
  onRefresh,
  phaseBlocked,
  isFocusStep,
  onNavigateToSection,
  persistOutcome,
  pendingStepId,
}) {
  const label = stepDisplayTitle(step);
  const [notes, setNotes] = useState('');
  const [open, setOpen] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [sessionRunning, setSessionRunning] = useState(false);
  const { user } = useAuth();

  const persisted = persistedStepUiBucket(step);
  const isPending = pendingStepId === step.id;

  useEffect(() => {
    if (persisted) setSessionRunning(false);
  }, [persisted, step.completed, step.result]);

  const isRunning = sessionRunning && !persisted;
  const { display: timerDisplay, elapsedSecs } = useStepTimer(isRunning);

  const stepEvidence = evidence.filter((e) => e.runbook_step_id === step.id && e.status !== 'replaced');

  let uiBucket = 'idle';
  if (persisted === 'failed') uiBucket = 'failed';
  else if (persisted === 'complete' || persisted === 'overridden') uiBucket = 'complete';
  else if (isRunning) uiBucket = 'in_progress';

  const cfg = STEP_STATUS[uiBucket === 'in_progress' ? 'in_progress' : uiBucket === 'complete' ? 'complete' : uiBucket === 'failed' ? 'failed' : 'idle'];

  const stepPayload = {
    id: step.id,
    title: label,
    name: label,
    step_family: step.step_family ?? step.family ?? step.category,
  };

  const phaseMeta = phase?.meta && typeof phase.meta === 'object' ? phase.meta : {};
  const runbookVersion =
    (typeof phaseMeta.sr_version === 'string' && phaseMeta.sr_version) ||
    (typeof job?.runbook_version === 'string' && job.runbook_version) ||
    '0.0.0';
  const phaseMetaForEvent = { ...phaseMeta, sr_version: String(runbookVersion) };

  const canStart = !phaseBlocked && !persisted && !isRunning;

  const handleStart = async () => {
    if (!canStart || isPending) return;
    try {
      await emitRunbookStepEvent({
        job,
        user,
        step: stepPayload,
        phaseMeta: phaseMetaForEvent,
        phaseId: phase.id ?? null,
        stepOutcome: 'started',
        durationMinutes: 0,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not queue runbook step telemetry');
      return;
    }
    setSessionRunning(true);
  };

  const handleComplete = async () => {
    const durationMinutes = Math.max(0, Math.round(elapsedSecs / 60));
    try {
      await emitRunbookStepEvent({
        job,
        user,
        step: stepPayload,
        phaseMeta: phaseMetaForEvent,
        phaseId: phase.id ?? null,
        stepOutcome: 'pass',
        durationMinutes,
      });
      await persistOutcome(step.id, 'pass');
      toast.success(`Step "${label}" completed`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save step or queue telemetry');
    }
  };

  const handleFail = async () => {
    const durationMinutes = Math.max(0, Math.round(elapsedSecs / 60));
    try {
      await emitRunbookStepEvent({
        job,
        user,
        step: stepPayload,
        phaseMeta: phaseMetaForEvent,
        phaseId: phase.id ?? null,
        stepOutcome: 'fail',
        durationMinutes,
      });
      await persistOutcome(step.id, 'fail');
      toast.error(`Step "${label}" marked failed`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save step or queue telemetry');
    }
  };

  const showAttach = isRunning || persisted !== null;
  const isOptional = step.required === false;

  return (
    <>
      <div
        className={cn(
          FIELD_CARD,
          'transition-all',
          uiBucket === 'failed' && 'border-red-200',
          uiBucket === 'complete' && 'border-emerald-200',
          isFocusStep && uiBucket === 'idle' && 'ring-2 ring-blue-200/80 border-blue-200/60'
        )}
      >
        <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
          <span className={cn('h-2 w-2 rounded-full flex-shrink-0 mt-0.5', cfg.dot)} />
          <div className="flex-1 min-w-0">
            {isFocusStep && !persisted && !isRunning && (
              <p className="text-[10px] font-bold text-blue-700 tracking-wide mb-0.5">Next required step</p>
            )}
            {isFocusStep && isRunning && (
              <p className="text-[10px] font-bold text-blue-700 tracking-wide mb-0.5">Active step</p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
              <p className="text-sm font-bold text-slate-900 truncate flex-1 min-w-0">{label}</p>
              {(() => {
                const fam = step.step_family ?? step.category;
                const g = fam && GATE_PRESENTATION[fam];
                return g ? (
                  <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0', g.className)}>
                    {g.label}
                  </span>
                ) : null;
              })()}
            </div>
            {Array.isArray(step.required_evidence_types) && step.required_evidence_types.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {step.required_evidence_types.map((t) => (
                  <span
                    key={t}
                    className="text-[9px] font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            {step.description && (
              <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 text-left w-full">{step.description}</p>
            )}
            {isOptional && (
              <span className="text-[9px] font-bold text-slate-400 mt-0.5 inline-block">Optional</span>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', cfg.bg, cfg.text)}>{cfg.label}</span>
              <StepTimer display={isRunning ? timerDisplay : null} />
              <span
                className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums',
                  stepEvidence.length > 0 ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'
                )}
              >
                {stepEvidence.length > 0 ? `${stepEvidence.length} linked` : 'None linked'}
              </span>
              {open ? <ChevronDown className="h-4 w-4 text-slate-300" /> : <ChevronRight className="h-4 w-4 text-slate-300" />}
            </div>
          </div>
        </button>

        {open && (
          <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
            {step.description && (
              <div className="pt-3">
                <p className={cn(FIELD_OVERLINE, 'mb-1')}>Instructions</p>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{step.description}</p>
              </div>
            )}
            {phaseBlocked && (
              <div className="flex items-start gap-2 pt-2 rounded-lg bg-slate-50 px-3 py-2">
                <Lock className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <p className={cn(FIELD_META, 'leading-snug')}>
                  Complete required steps in the previous phase before starting steps here.
                </p>
              </div>
            )}

            {persisted === 'overridden' && step.override_reason && (
              <p className={cn(FIELD_META, 'pt-2 text-amber-800')}>Override recorded for this step.</p>
            )}

            {isRunning && (
              <p className={cn(FIELD_META, 'pt-2 leading-snug')}>
                This step is active right now. Mark it complete or failed when you finish — time on this step is
                recorded when you do.
              </p>
            )}

            <div className="pt-1">
              <label className={cn(FIELD_OVERLINE, 'mb-1 block')}>Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Add step notes…"
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {uiBucket === 'idle' && (
                <button
                  type="button"
                  onClick={() => void handleStart()}
                  disabled={!canStart || isPending}
                  className={cn(
                    'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40',
                    FIELD_RUNBOOK_CTRL
                  )}
                >
                  <Play className="h-3.5 w-3.5 shrink-0" aria-hidden /> Start
                </button>
              )}
              {uiBucket === 'in_progress' && (
                <>
                  <button
                    type="button"
                    onClick={() => void handleComplete()}
                    disabled={isPending}
                    className={cn(
                      'bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40',
                      FIELD_RUNBOOK_CTRL
                    )}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden /> Pass
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleFail()}
                    disabled={isPending}
                    className={cn(
                      'bg-red-600 text-white hover:bg-red-700 disabled:opacity-40',
                      FIELD_RUNBOOK_CTRL
                    )}
                  >
                    <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden /> Fail
                  </button>
                </>
              )}
              {showAttach && (
                <button
                  type="button"
                  onClick={() => setShowCapture(true)}
                  className={cn('bg-slate-900 text-white hover:bg-slate-800', FIELD_RUNBOOK_CTRL)}
                >
                  <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden /> Attach evidence
                </button>
              )}
            </div>

            {uiBucket === 'failed' && (
              <div className="rounded-lg border border-red-100 bg-red-50/50 px-3 py-2 space-y-2">
                <p className="text-xs font-semibold text-red-900">
                  This step failed. Open Comms to report a blocker or request help.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigateToSection?.('comms')}
                  className={cn(FIELD_LINK_PRIMARY, 'inline-flex items-center gap-1.5 text-xs font-bold')}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Open Comms
                </button>
              </div>
            )}

            <p className={cn(FIELD_META, 'leading-snug')}>
              More evidence may be attached only to the job — see the Evidence tab.
            </p>

            {stepEvidence.length > 0 && (
              <div>
                <p className={cn(FIELD_OVERLINE, 'mb-1.5')}>Linked to this step</p>
                <div className="flex gap-2 flex-wrap">
                  {stepEvidence.map((e) => (
                    <EvidenceThumbnail key={e.id} ev={e} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showCapture && (
        <EvidenceCaptureModal
          jobId={jobId}
          job={job}
          stepId={step.id}
          adapter={adapters?.upload}
          onClose={() => setShowCapture(false)}
          onSuccess={() => {
            setShowCapture(false);
            onRefresh?.();
          }}
        />
      )}
    </>
  );
}

export default function RunbookSteps({
  job,
  evidence,
  adapters,
  onRefresh,
  runbookComplete,
  onNavigateToSection,
}) {
  const phases = sortRunbookPhases(job?.runbook_phases || []);
  const phaseBlocked = computePhaseBlocked(phases);
  const progress = computeRunbookProgress(phases);
  const focus = findNextFocusStep(phases, phaseBlocked);
  const [pendingStepId, setPendingStepId] = useState(null);

  const persistOutcome = useCallback(
    async (stepId, outcome) => {
      const base = job?.runbook_phases || [];
      const next = mergeRunbookStepOutcome(base, stepId, outcome);
      setPendingStepId(stepId);
      try {
        if (job?.assignment_source === 'purpulse_api') {
          await jobRepository.saveJobSnapshot({ ...job, runbook_phases: next });
        } else {
          await base44.entities.Job.update(job.id, { runbook_phases: next });
        }
        onRefresh?.();
      } finally {
        setPendingStepId(null);
      }
    },
    [job?.id, job?.runbook_phases, onRefresh]
  );

  if (!phases.length) {
    const dbg = job?.assignment_debug;
    const reasonCode =
      dbg && typeof dbg === 'object' && dbg !== null && 'reason_code' in dbg
        ? String(/** @type {Record<string, unknown>} */ (dbg).reason_code ?? '')
        : '';
    return (
      <div className="py-12 text-center space-y-2 px-4">
        <FileText className="h-10 w-10 text-slate-200 mx-auto" aria-hidden />
        <p className="text-slate-600 text-sm font-semibold">No runbook on this job</p>
        <p className={cn(FIELD_META, 'max-w-sm mx-auto leading-snug')}>
          Runbook phases from the office will show here when they are attached to this job.
        </p>
        {reasonCode ? (
          <p className="text-xs font-mono text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 max-w-md mx-auto">
            {reasonCode}
          </p>
        ) : null}
      </div>
    );
  }

  const barPct = progress.totalSteps ? (progress.totalDone / progress.totalSteps) * 100 : 0;

  return (
    <div className="space-y-3">
      {!runbookComplete && (
        <div className={cn(FIELD_SURFACE_MUTED, 'px-4 py-3 rounded-xl border border-dashed border-slate-200')}>
          <p className="text-xs font-semibold text-slate-800">Runbook still in progress</p>
          <p className={cn(FIELD_META, 'mt-1 leading-snug')}>
            Finish required steps so execution on this job is complete. Closeout messaging elsewhere assumes runbook work
            is done when every step is marked complete on the job.
          </p>
        </div>
      )}

      <div className={cn(FIELD_CARD, 'px-4 py-3')}>
        <div className="flex items-center justify-between mb-1.5 gap-2">
          <p className="text-xs font-semibold text-slate-600">Execution progress</p>
          <span className="text-[11px] text-slate-500 tabular-nums text-right">
            {progress.totalDone}/{progress.totalSteps} steps · {progress.requiredDone}/{progress.requiredTotal} required
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${barPct}%` }} />
        </div>
        {focus && (
          <p className={cn(FIELD_META, 'mt-2 leading-snug')}>
            Work the step marked <span className="font-semibold text-slate-700">Next required step</span> or{' '}
            <span className="font-semibold text-slate-700">Active step</span> first — next incomplete required step in
            phase order.
          </p>
        )}
      </div>

      <div className="space-y-6">
        {phases.map((phase) => {
          const steps = sortStepsInPhase(phase.steps);
          const completedSteps = steps.filter((s) => s.completed).length;
          const blocked = phaseBlocked[phase.id];

          const metaBlurb = phaseMetaBlurb(phase.meta);

          return (
            <div key={phase.id} className={cn('space-y-2', blocked && 'opacity-90')}>
              <div className="flex items-center justify-between gap-2 px-0.5">
                <p className={FIELD_OVERLINE}>{phase.name || 'Phase'}</p>
                <span className={cn(FIELD_META, 'tabular-nums')}>
                  {completedSteps}/{steps.length} steps
                </span>
              </div>
              {metaBlurb && (
                <p className={cn(FIELD_META, 'px-0.5 leading-snug')}>{metaBlurb}</p>
              )}

              {blocked && (
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                  <Lock className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <p className={cn(FIELD_META, 'leading-snug')}>Complete the previous phase to unlock this one.</p>
                </div>
              )}

              <div className="space-y-2">
                {steps.map((step) => (
                  <RunbookStep
                    key={step.id}
                    step={step}
                    phase={phase}
                    job={job}
                    jobId={job.id}
                    evidence={evidence}
                    adapters={adapters}
                    onRefresh={onRefresh}
                    phaseBlocked={blocked}
                    isFocusStep={focus?.stepId === step.id}
                    onNavigateToSection={onNavigateToSection}
                    persistOutcome={persistOutcome}
                    pendingStepId={pendingStepId}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
