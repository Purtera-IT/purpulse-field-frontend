/**
 * RunbookSteps — Runbook tab (C)
 * Per-step: Start/Complete/Fail, notes, timer, Attach Evidence action.
 * Shows evidence thumbnails linked to each step.
 */
import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Play, CheckCircle2, XCircle, Clock, Camera, ChevronDown, ChevronRight, FileText, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import EvidenceCaptureModal from './EvidenceCaptureModal';
import { useAuth } from '@/lib/AuthContext';
import { emitRunbookStepEvent } from '@/lib/runbookStepEvent';

// ── Timer hook ─────────────────────────────────────────────────────────
function useStepTimer(running) {
  const [secs, setSecs] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (running) { ref.current = setInterval(() => setSecs(s => s + 1), 1000); }
    else clearInterval(ref.current);
    return () => clearInterval(ref.current);
  }, [running]);
  useEffect(() => { if (!running) setSecs(0); }, [running]);
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  const display = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return { display, elapsedSecs: secs };
}

const STEP_STATUS = {
  idle:       { label: 'Start',     bg: 'bg-slate-100',   text: 'text-slate-600',   dot: 'bg-slate-300'   },
  in_progress:{ label: 'Running',   bg: 'bg-blue-50',     text: 'text-blue-700',    dot: 'bg-blue-500'    },
  complete:   { label: 'Complete',  bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
  failed:     { label: 'Failed',    bg: 'bg-red-50',      text: 'text-red-700',     dot: 'bg-red-400'     },
};

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
    <div className="h-12 w-12 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 bg-slate-50 flex items-center justify-center" title={ev.notes || ev.evidence_type}>
      {isImg
        ? <img src={ev.file_url || ev.thumbnail_url} alt="evidence" className="h-full w-full object-cover" />
        : <FileText className="h-5 w-5 text-slate-400" />}
    </div>
  );
}

function RunbookStep({ step, job, jobId, runbookPhaseMeta, evidence, adapters, onRefresh }) {
  const [status, setStatus]       = useState('idle');
  const [notes,  setNotes]        = useState('');
  const [open,   setOpen]         = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const { user } = useAuth();
  const { display: timerDisplay, elapsedSecs } = useStepTimer(status === 'in_progress');
  const stepEvidence = evidence.filter(e => e.runbook_step_id === step.id);

  const stepPayload = {
    id: step.id,
    title: step.title,
    name: step.title,
    step_family: step.step_family ?? step.family ?? step.category,
  };

  const handleStart = async () => {
    try {
      await emitRunbookStepEvent({
        job,
        user,
        step: stepPayload,
        phaseMeta: runbookPhaseMeta,
        phaseId: null,
        stepOutcome: 'started',
        durationMinutes: 0,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not queue runbook step telemetry');
      return;
    }
    setStatus('in_progress');
  };

  const handleComplete = async () => {
    const durationMinutes = Math.max(0, Math.round(elapsedSecs / 60));
    try {
      await emitRunbookStepEvent({
        job,
        user,
        step: stepPayload,
        phaseMeta: runbookPhaseMeta,
        phaseId: null,
        stepOutcome: 'pass',
        durationMinutes,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not queue runbook step telemetry');
      return;
    }
    setStatus('complete');
    toast.success(`Step "${step.title}" completed`);
    onRefresh?.();
  };

  const handleFail = async () => {
    const durationMinutes = Math.max(0, Math.round(elapsedSecs / 60));
    try {
      await emitRunbookStepEvent({
        job,
        user,
        step: stepPayload,
        phaseMeta: runbookPhaseMeta,
        phaseId: null,
        stepOutcome: 'fail',
        durationMinutes,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not queue runbook step telemetry');
      return;
    }
    setStatus('failed');
    toast.error(`Step "${step.title}" marked failed`);
  };

  const cfg = STEP_STATUS[status];

  return (
    <>
    <div className={cn('bg-white rounded-xl border transition-all', status === 'failed' ? 'border-red-200' : status === 'complete' ? 'border-emerald-200' : 'border-slate-100')}>
      {/* Header row */}
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
        <span className={cn('h-2 w-2 rounded-full flex-shrink-0 mt-0.5', cfg.dot)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">{step.title}</p>
          {step.description && <p className="text-[11px] text-slate-400 truncate">{step.description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', cfg.bg, cfg.text)}>{cfg.label}</span>
          <StepTimer display={status === 'in_progress' ? timerDisplay : null} />
          {stepEvidence.length > 0 && (
            <span className="text-[10px] bg-blue-50 text-blue-600 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <Camera className="h-2.5 w-2.5" />{stepEvidence.length}
            </span>
          )}
          {open ? <ChevronDown className="h-4 w-4 text-slate-300" /> : <ChevronRight className="h-4 w-4 text-slate-300" />}
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-50">
          {/* Notes */}
          <div className="pt-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Add step notes…"
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-slate-400" />
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-2">
            {status === 'idle' && (
              <button onClick={handleStart}
                className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-blue-600 text-white text-xs font-bold hover:bg-blue-700">
                <Play className="h-3.5 w-3.5" /> Start
              </button>
            )}
            {status === 'in_progress' && (
              <>
                <button onClick={handleComplete}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                </button>
                <button onClick={handleFail}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-red-600 text-white text-xs font-bold hover:bg-red-700">
                  <XCircle className="h-3.5 w-3.5" /> Fail
                </button>
              </>
            )}
            {status !== 'idle' && (
              <button onClick={() => setShowCapture(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-slate-900 text-white text-xs font-bold hover:bg-slate-700">
                <Paperclip className="h-3.5 w-3.5" /> Attach Evidence
              </button>
            )}
          </div>

          {/* Linked evidence */}
          {stepEvidence.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Linked Evidence</p>
              <div className="flex gap-2 flex-wrap">
                {stepEvidence.map(e => <EvidenceThumbnail key={e.id} ev={e} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>

    {showCapture && (
      <EvidenceCaptureModal
        jobId={jobId}
        stepId={step.id}
        adapter={adapters?.upload}
        onClose={() => setShowCapture(false)}
        onSuccess={() => { setShowCapture(false); onRefresh?.(); }}
      />
    )}
    </>
  );
}

export default function RunbookSteps({ job, evidence, adapters, onRefresh }) {
  const { data: runbooks = [] } = useQuery({
    queryKey: ['runbooks'],
    queryFn: () => base44.entities.Runbook.list('-created_date', 20),
    staleTime: 60_000,
  });

  const runbook = runbooks[0]; // In real app: match by job.runbook_id
  const steps = runbook?.steps || [];
  const runbookPhaseMeta = {
    sr_version: String(runbook?.version ?? job?.runbook_version ?? '0.0.0'),
  };

  const completedCount = 0; // local state — real app persists per-step completion

  return (
    <div className="space-y-3">
      {/* Progress */}
      <div className="bg-white rounded-xl border border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-black text-slate-500">{runbook?.title || 'Runbook'} v{runbook?.version}</p>
          <span className="text-[11px] text-slate-400 tabular-nums">{completedCount}/{steps.length} steps</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${steps.length ? (completedCount / steps.length) * 100 : 0}%` }} />
        </div>
      </div>

      {steps.length === 0 && (
        <div className="py-12 text-center text-slate-400 text-sm">No runbook steps found for this job.</div>
      )}

      {steps.map(step => (
        <RunbookStep
          key={step.id}
          step={step}
          job={job}
          jobId={job.id}
          runbookPhaseMeta={runbookPhaseMeta}
          evidence={evidence}
          adapters={adapters}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}