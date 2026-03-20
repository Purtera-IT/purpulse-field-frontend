/**
 * RunbookStepModal — single-task full-screen bottom sheet for one runbook step.
 *
 * Flow:
 *   1. Show large step name + description
 *   2. Evidence requirements — each locked until captured
 *   3. Pass / Fail CTAs (thumb-sized, bottom-anchored)
 *   4. On FAIL → show remedial actions + "Remediation Complete" CTA
 *   5. On evidence missing + user force-passes → override modal (reason required, audit logged)
 *   6. Safety steps → open SafetyChecklistModal before allowing pass
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  X, CheckCircle2, XCircle, Camera, Lock, AlertTriangle,
  ShieldCheck, RotateCcw, FileText, Wrench
} from 'lucide-react';
import { cn } from '@/lib/utils';
import EvidenceCapture from './EvidenceCapture';
import SafetyChecklistModal from './SafetyChecklistModal';

// ── Evidence requirement row ──────────────────────────────────────────
function EvidenceRequirement({ type, stepEvidence, jobId, stepId, onCaptured }) {
  const [showCapture, setShowCapture] = useState(false);
  const met = stepEvidence.some(e => e.evidence_type === type && e.status !== 'replaced');
  const isSerial = type.includes('serial') || type.includes('label');

  return (
    <div className={cn(
      'rounded-2xl border-2 p-3 transition-all',
      met ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {met
            ? <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
            : <Camera className="h-5 w-5 text-amber-500 flex-shrink-0" />
          }
          <div>
            <p className={cn('text-sm font-bold capitalize', met ? 'text-emerald-800' : 'text-amber-800')}>
              {type.replace(/_/g, ' ')}
            </p>
            {isSerial && !met && (
              <p className="text-xs text-amber-600 mt-0.5">Position camera over label/serial plate</p>
            )}
          </div>
        </div>
        {!met && (
          <button
            onClick={() => setShowCapture(!showCapture)}
            className="h-9 px-3 rounded-xl bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 active:opacity-80"
          >
            <Camera className="h-3.5 w-3.5" />
            {showCapture ? 'Cancel' : 'Capture'}
          </button>
        )}
        {met && (
          <span className="text-xs text-emerald-600 font-semibold">Captured ✓</span>
        )}
      </div>
      {showCapture && !met && (
        <div className="mt-2 border-t border-amber-200 pt-3">
          <EvidenceCapture
            jobId={jobId}
            evidenceType={type}
            stepId={stepId}
            onCaptured={() => { setShowCapture(false); onCaptured(); }}
          />
        </div>
      )}
    </div>
  );
}

// ── Override reason modal ─────────────────────────────────────────────
function OverrideModal({ stepName, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-[60] flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative w-full bg-white rounded-t-3xl p-6 pb-10 max-w-lg mx-auto shadow-2xl">
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
        <div className="flex items-center gap-3 mb-4">
          <div className="h-12 w-12 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <p className="font-bold text-slate-900">Override Evidence Requirement</p>
            <p className="text-xs text-slate-500 mt-0.5">{stepName}</p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Required evidence has not been captured. A reason is mandatory and will be recorded in the audit log.
        </p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="State reason for override (e.g. camera unavailable, pre-existing documentation)…"
          className="w-full h-24 rounded-xl border-2 border-slate-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
          autoFocus
        />
        <div className="flex gap-3 mt-4">
          <button onClick={onCancel}
            className="flex-1 h-13 py-3 rounded-2xl border-2 border-slate-200 text-slate-700 font-semibold text-sm"
          >Cancel</button>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim()}
            className="flex-1 h-13 py-3 rounded-2xl bg-orange-600 text-white font-semibold text-sm disabled:opacity-40"
          >
            Override & Pass
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Remedial flow ─────────────────────────────────────────────────────
function RemedialFlow({ step, onRemediationComplete, onBack }) {
  const actions = step.fail_remedial_actions || ['Document the failure', 'Contact supervisor', 'Reschedule step'];
  const [checked, setChecked] = useState({});
  const allChecked = actions.every((_, i) => checked[i]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
          <Wrench className="h-6 w-6 text-red-600" />
        </div>
        <div>
          <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Step Failed</p>
          <p className="font-bold text-slate-900 text-base leading-snug">{step.name}</p>
        </div>
      </div>

      <p className="text-sm text-slate-600 mb-4 font-medium">
        Complete all remedial actions before proceeding:
      </p>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={() => setChecked(p => ({ ...p, [i]: !p[i] }))}
            className={cn(
              'w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all',
              checked[i] ? 'bg-emerald-50 border-2 border-emerald-300' : 'bg-slate-50 border-2 border-slate-100'
            )}
          >
            <div className={cn(
              'h-6 w-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all',
              checked[i] ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'
            )}>
              {checked[i] && <svg viewBox="0 0 12 10" className="h-3 w-3 fill-none stroke-white stroke-[2.5]"><polyline points="1,5 4,8 11,1" /></svg>}
            </div>
            <span className={cn('text-sm font-medium', checked[i] ? 'text-emerald-700 line-through' : 'text-slate-700')}>
              {action}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-2 pt-3 border-t border-slate-100">
        <button
          onClick={() => allChecked && onRemediationComplete()}
          disabled={!allChecked}
          className="w-full h-14 rounded-2xl bg-emerald-600 text-white font-bold text-base disabled:opacity-40 active:opacity-80 flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="h-5 w-5" />
          Remediation Complete
        </button>
        <button onClick={onBack}
          className="w-full h-12 rounded-2xl border-2 border-slate-200 text-slate-600 font-semibold text-sm"
        >
          ← Back to Step
        </button>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────
export default function RunbookStepModal({ step, jobId, phases, onComplete, onClose }) {
  const [mode, setMode]           = useState('main'); // main | remedial | override | safety
  const [overrideReason, setOverrideReason] = useState(null);

  const { data: evidence = [], refetch } = useQuery({
    queryKey: ['evidence', jobId],
    queryFn: () => base44.entities.Evidence.filter({ job_id: jobId }),
    enabled: !!jobId,
  });

  const stepEvidence = evidence.filter(e => e.runbook_step_id === step.id && e.status !== 'replaced');
  const requiredTypes = step.required_evidence_types || [];
  const evidenceMet = requiredTypes.every(t => stepEvidence.some(e => e.evidence_type === t));
  const isRequired = step.required !== false; // default required

  const handlePass = () => {
    if (step.is_safety_step) { setMode('safety'); return; }
    if (!evidenceMet && requiredTypes.length > 0) { setMode('override'); return; }
    onComplete(step.id, 'pass', null);
  };

  const handleFail = () => setMode('remedial');

  const handleOverrideConfirm = (reason) => {
    setMode('main');
    onComplete(step.id, 'pass', reason);
  };

  const handleRemediationComplete = () => onComplete(step.id, 'fail_remediated', null);

  const handleSafetyComplete = () => {
    if (!evidenceMet && requiredTypes.length > 0) { setMode('override'); return; }
    onComplete(step.id, 'pass', null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={mode === 'main' ? onClose : undefined} />

      <div className="relative w-full bg-white rounded-t-3xl max-w-lg mx-auto shadow-2xl flex flex-col"
        style={{ maxHeight: '92vh' }}>

        {/* Handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-0 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-4 pb-2 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {isRequired
                ? <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full uppercase tracking-wider">Required</span>
                : <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wider">Optional</span>
              }
              {step.is_safety_step && (
                <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> Safety
                </span>
              )}
              {step.sr_version && (
                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {step.sr_version}
                </span>
              )}
            </div>
            <h2 className="text-xl font-black text-slate-900 leading-snug">{step.name}</h2>
          </div>
          <button onClick={onClose}
            className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
            <X className="h-4 w-4 text-slate-600" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">

          {/* Safety modal */}
          {mode === 'safety' && (
            <SafetyChecklistModal
              embedded
              stepName={step.name}
              onComplete={handleSafetyComplete}
              onCancel={() => setMode('main')}
            />
          )}

          {/* Override modal */}
          {mode === 'override' && (
            <OverrideModal
              stepName={step.name}
              onConfirm={handleOverrideConfirm}
              onCancel={() => setMode('main')}
            />
          )}

          {/* Remedial flow */}
          {mode === 'remedial' && (
            <RemedialFlow
              step={step}
              onRemediationComplete={handleRemediationComplete}
              onBack={() => setMode('main')}
            />
          )}

          {/* Main step view */}
          {mode === 'main' && (
            <div className="space-y-5 pt-1">
              {step.description && (
                <p className="text-base text-slate-600 leading-relaxed">{step.description}</p>
              )}

              {/* Template reference */}
              {step.template_id && (
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                  <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-700">SOW Template Reference</p>
                    <p className="text-[10px] font-mono text-slate-400">{step.template_id}</p>
                  </div>
                </div>
              )}

              {/* Evidence requirements */}
              {requiredTypes.length > 0 && (
                <div className="space-y-2.5">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Evidence Required ({stepEvidence.length}/{requiredTypes.length})
                  </p>
                  {requiredTypes.map(type => (
                    <EvidenceRequirement
                      key={type}
                      type={type}
                      stepEvidence={stepEvidence}
                      jobId={jobId}
                      stepId={step.id}
                      onCaptured={refetch}
                    />
                  ))}
                  {!evidenceMet && (
                    <div className="flex items-center gap-2 bg-amber-50 rounded-xl px-3 py-2.5">
                      <Lock className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      <p className="text-xs text-amber-700 font-semibold">
                        Capture all evidence to pass — or use override (reason required, audit logged)
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Pass/Fail CTAs */}
              {!step.completed && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={handleFail}
                    className="h-16 rounded-2xl bg-red-50 border-2 border-red-200 text-red-700 font-bold text-base flex items-center justify-center gap-2 active:bg-red-100"
                  >
                    <XCircle className="h-6 w-6" />
                    FAIL
                  </button>
                  <button
                    onClick={handlePass}
                    className={cn(
                      'h-16 rounded-2xl font-bold text-base flex items-center justify-center gap-2 active:opacity-80',
                      evidenceMet || requiredTypes.length === 0
                        ? 'bg-emerald-600 text-white'
                        : 'bg-orange-50 border-2 border-orange-300 text-orange-700'
                    )}
                  >
                    {evidenceMet || requiredTypes.length === 0
                      ? <><CheckCircle2 className="h-6 w-6" /> PASS</>
                      : <><AlertTriangle className="h-5 w-5" /> OVERRIDE</>
                    }
                  </button>
                </div>
              )}

              {step.completed && (
                <div className={cn(
                  'flex items-center gap-3 rounded-2xl p-4 mt-2',
                  step.result === 'fail_remediated' ? 'bg-amber-50' : 'bg-emerald-50'
                )}>
                  {step.result === 'fail_remediated'
                    ? <RotateCcw className="h-6 w-6 text-amber-600 flex-shrink-0" />
                    : <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0" />
                  }
                  <div>
                    <p className={cn('font-bold text-sm',
                      step.result === 'fail_remediated' ? 'text-amber-800' : 'text-emerald-800'
                    )}>
                      {step.result === 'fail_remediated' ? 'Failed — Remediated' : step.result === 'pass' ? 'Passed' : 'Completed'}
                    </p>
                    {step.override_reason && (
                      <p className="text-xs text-orange-600 mt-0.5">⚠ Override: {step.override_reason}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}