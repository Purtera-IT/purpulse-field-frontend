/**
 * RunbookView — main list view for runbook phases + steps.
 *
 * Each step row shows:
 *   - Required / Optional badge
 *   - Result: pending / passed / fail_remediated / overridden
 *   - Tap → RunbookStepModal (single-task flow)
 *
 * Phase header shows:
 *   - Name + progress
 *   - template_id + sr_version metadata (links to SOW Requirements Library)
 *
 * Template metadata shape (on Job.runbook_phases[].meta):
 *   { template_id: "TPL-001", sr_version: "v2.3", sow_ref: "SOW-2024-07" }
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  CheckCircle2, Circle, RotateCcw, ChevronRight, XCircle,
  AlertTriangle, Lock, Camera, FileText, ShieldAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import RunbookStepModal from './RunbookStepModal';
import { useAuth } from '@/lib/AuthContext';
import { emitRunbookStepEvent } from '@/lib/runbookStepEvent';

// ── Result config ─────────────────────────────────────────────────────
const RESULT_CFG = {
  pass:             { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50',  border: 'border-emerald-200', label: 'Passed'           },
  fail:             { icon: XCircle,      color: 'text-red-600',     bg: 'bg-red-50',      border: 'border-red-200',     label: 'Failed'             },
  fail_remediated:  { icon: RotateCcw,    color: 'text-amber-500',   bg: 'bg-amber-50',    border: 'border-amber-200',   label: 'Failed→Remediated'},
  overridden:       { icon: AlertTriangle,color: 'text-orange-500',  bg: 'bg-orange-50',   border: 'border-orange-200',  label: 'Override'         },
  pending:          { icon: Circle,        color: 'text-slate-300',   bg: 'bg-white',       border: 'border-slate-100',   label: 'Pending'          },
};

function stepResult(step) {
  if (!step.completed) return 'pending';
  if (step.override_reason) return 'overridden';
  const r = step.result || 'pass';
  if (r === 'fail' || r === 'fail_remediated') return r === 'fail_remediated' ? 'fail_remediated' : 'fail';
  return r;
}

// ── Step row ──────────────────────────────────────────────────────────
function StepRow({ step, index, evidence, jobId, onTap, isBlocked }) {
  const result  = stepResult(step);
  const cfg     = RESULT_CFG[result];
  const Icon    = cfg.icon;
  const isRequired = step.required !== false;
  const requiredTypes = step.required_evidence_types || [];
  const stepEvidence  = evidence.filter(e => e.runbook_step_id === step.id && e.status !== 'replaced');
  const evidenceMet   = requiredTypes.every(t => stepEvidence.some(e => e.evidence_type === t));
  const evidenceBlocked = requiredTypes.length > 0 && !evidenceMet && !step.completed;

  return (
    <button
      onClick={() => !isBlocked && onTap(step)}
      disabled={isBlocked}
      className={cn(
        'w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all active:scale-[0.99]',
        cfg.bg, cfg.border,
        isBlocked && 'opacity-40 cursor-not-allowed',
        !isBlocked && !step.completed && 'active:bg-slate-50'
      )}
    >
      {/* Step number + icon */}
      <div className="flex-shrink-0 w-8 flex flex-col items-center gap-0.5">
        <Icon className={cn('h-5 w-5', cfg.color, result === 'pending' && 'text-slate-300')} />
        <span className="text-[10px] font-bold text-slate-300">{String(index + 1).padStart(2, '0')}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <p className={cn('text-sm font-bold leading-snug', step.completed ? cfg.color : 'text-slate-900')}>
            {step.name}
          </p>
          {!isRequired && (
            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">OPTIONAL</span>
          )}
          {step.is_safety_step && (
            <ShieldAlert className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" title="Safety step" />
          )}
        </div>

        {/* Sub-info row */}
        <div className="flex items-center gap-3 flex-wrap">
          {requiredTypes.length > 0 && (
            <span className={cn('flex items-center gap-1 text-[10px] font-semibold',
              evidenceMet ? 'text-emerald-600' : 'text-amber-600'
            )}>
              <Camera className="h-3 w-3" />
              {stepEvidence.length}/{requiredTypes.length} evidence
              {evidenceBlocked && <Lock className="h-3 w-3 text-amber-500" />}
            </span>
          )}
          {step.override_reason && (
            <span className="text-[10px] text-orange-600 font-semibold">⚠ Override logged</span>
          )}
          {step.sr_version && (
            <span className="text-[10px] font-mono text-slate-400">{step.sr_version}</span>
          )}
        </div>

        {/* Result label for done steps */}
        {step.completed && result !== 'pending' && (
          <p className={cn('text-[10px] font-bold mt-0.5', cfg.color)}>{cfg.label}</p>
        )}
      </div>

      {!step.completed && !isBlocked && (
        <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
      )}
    </button>
  );
}

// ── Phase header with template metadata ──────────────────────────────
function PhaseHeader({ phase, completedSteps, totalSteps }) {
  const pct = totalSteps ? (completedSteps / totalSteps) * 100 : 0;
  const meta = phase.meta || {};

  return (
    <div className="mb-3">
      <div className="flex items-start justify-between mb-1">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-black text-slate-900">{phase.name}</h3>
          {(meta.template_id || meta.sr_version || meta.sow_ref) && (
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <FileText className="h-3 w-3 text-slate-400 flex-shrink-0" />
              {meta.template_id && (
                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{meta.template_id}</span>
              )}
              {meta.sr_version && (
                <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">{meta.sr_version}</span>
              )}
              {meta.sow_ref && (
                <span className="text-[10px] font-mono text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">{meta.sow_ref}</span>
              )}
            </div>
          )}
        </div>
        <span className="text-xs font-bold text-slate-400 ml-2 flex-shrink-0">{completedSteps}/{totalSteps}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-1.5">
        <div
          className={cn(
            'h-1.5 rounded-full transition-all duration-500',
            pct === 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-blue-500' : 'bg-slate-400'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────
export default function RunbookView({ job }) {
  const [activeStep, setActiveStep] = useState(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const phases = job?.runbook_phases || [];

  const { data: evidence = [] } = useQuery({
    queryKey: ['evidence', job?.id],
    queryFn: () => base44.entities.Evidence.filter({ job_id: job?.id }),
    enabled: !!job?.id,
  });

  const completeStep = useMutation({
    mutationFn: async ({ stepId, result, overrideReason }) => {
      let targetStep = null;
      let containingPhase = null;
      for (const phase of phases) {
        const st = phase.steps?.find((s) => s.id === stepId);
        if (st) {
          targetStep = st;
          containingPhase = phase;
          break;
        }
      }
      const stepOutcome = overrideReason
        ? 'overridden'
        : result === 'fail_remediated'
          ? 'fail_remediated'
          : 'pass';
      try {
        await emitRunbookStepEvent({
          job,
          user,
          step: targetStep || { id: stepId, name: 'unknown_step' },
          phaseMeta: containingPhase?.meta || {},
          phaseId: containingPhase?.id ?? null,
          stepOutcome,
          durationMinutes: 0,
          reworkFlag: result === 'fail_remediated' ? true : null,
          blockerFlag: null,
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not queue runbook step telemetry');
        throw e;
      }

      const updatedPhases = phases.map(phase => ({
        ...phase,
        steps: phase.steps?.map(step =>
          step.id === stepId
            ? {
                ...step,
                completed: true,
                completed_at: new Date().toISOString(),
                result,
                override_reason: overrideReason || null,
              }
            : step
        ),
      }));
      await base44.entities.Job.update(job.id, { runbook_phases: updatedPhases });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['job', job.id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      const msgs = {
        pass: 'Step passed ✓',
        fail_remediated: 'Step failed — remediation recorded',
      };
      toast.success(msgs[vars.result] || 'Step completed');
      setActiveStep(null);
    },
  });

  if (!phases.length) {
    return (
      <div className="text-center py-12 space-y-2">
        <FileText className="h-10 w-10 text-slate-200 mx-auto" />
        <p className="text-slate-400 text-sm">No runbook assigned to this job</p>
        <p className="text-slate-300 text-xs">Runbook templates are linked via template_id from the SOW Requirements Library</p>
      </div>
    );
  }

  // Determine globally blocked steps (sequential enforcement: complete phase N before phase N+1)
  const sortedPhases = [...phases].sort((a, b) => (a.order || 0) - (b.order || 0));

  // Build set of all completed step IDs for sequential blocking
  let previousPhaseComplete = true;
  const phaseBlocked = {};
  for (const phase of sortedPhases) {
    phaseBlocked[phase.id] = !previousPhaseComplete;
    const allDone = phase.steps?.every(s => s.completed || s.required === false) ?? true;
    if (!allDone) previousPhaseComplete = false;
  }

  // Overall progress
  const allSteps = sortedPhases.flatMap(p => p.steps || []);
  const totalDone = allSteps.filter(s => s.completed).length;
  const totalRequired = allSteps.filter(s => s.required !== false).length;
  const requiredDone  = allSteps.filter(s => s.completed && s.required !== false).length;

  return (
    <>
      {/* Overall progress bar */}
      <div className="mb-5 bg-slate-50 rounded-2xl p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-slate-600">Overall Progress</p>
          <p className="text-xs text-slate-400">{totalDone}/{allSteps.length} steps · {requiredDone}/{totalRequired} required</p>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className="bg-slate-900 h-2 rounded-full transition-all duration-500"
            style={{ width: `${allSteps.length ? (totalDone / allSteps.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Phases */}
      <div className="space-y-6">
        {sortedPhases.map(phase => {
          const steps = [...(phase.steps || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
          const completedSteps = steps.filter(s => s.completed).length;
          const isBlocked = phaseBlocked[phase.id];

          return (
            <div key={phase.id} className={cn(isBlocked && 'opacity-50')}>
              <PhaseHeader phase={phase} completedSteps={completedSteps} totalSteps={steps.length} />

              {isBlocked && (
                <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 mb-2">
                  <Lock className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <p className="text-xs text-slate-500 font-semibold">Complete previous phase to unlock</p>
                </div>
              )}

              <div className="space-y-2">
                {steps.map((step, idx) => (
                  <StepRow
                    key={step.id}
                    step={step}
                    index={idx}
                    evidence={evidence}
                    jobId={job.id}
                    onTap={setActiveStep}
                    isBlocked={isBlocked}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Step modal */}
      {activeStep && (
        <RunbookStepModal
          step={activeStep}
          jobId={job.id}
          phases={phases}
          onComplete={(stepId, result, overrideReason) =>
            completeStep.mutate({ stepId, result, overrideReason })
          }
          onClose={() => setActiveStep(null)}
        />
      )}
    </>
  );
}