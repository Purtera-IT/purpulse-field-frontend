/**
 * JobStateTransitioner — Visible state machine UI with gating and override
 * Shows current state, allowed transitions, blockers, and override capability
 */

import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import {
  canTransition,
  STATUS_LABELS,
  STATE_MACHINE,
} from '@/lib/jobStateMachine';
import {
  AlertCircle, CheckCircle2, Lock, ChevronRight,
  Loader2, Flag, LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { executeJobStateTransitionMutation } from '@/lib/jobStateTransitionMutation';
import PreJobToolCheckModal from './PreJobToolCheckModal';
import { EtaAcknowledgementSheet } from '@/components/field/AcknowledgementSheets.jsx';
import { BTN_SECONDARY, FIELD_CARD, FIELD_CTRL_H, FIELD_META } from '@/lib/fieldVisualTokens';

const READINESS_HINT_EN_ROUTE =
  'You will confirm travel / ETA details before the job moves to en route.';
const READINESS_HINT_START_WORK =
  'A short pre-start checklist runs before the job moves to in progress.';

function RequirementItem({ requirement, blocker }) {
  const status = blocker?.isMet ? 'met' : 'unmet';
  return (
    <div className={cn('flex items-center gap-2 text-xs p-2 rounded-lg',
      status === 'met' ? 'bg-emerald-50' : 'bg-red-50')}>
      {status === 'met' ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
      ) : (
        <AlertCircle className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
      )}
      <span className={status === 'met' ? 'text-emerald-700' : 'text-red-700'}>
        {requirement.label}
        {blocker?.current !== undefined && blocker?.required && (
          <span className="ml-1 font-mono opacity-70">
            ({blocker.current}/{blocker.required})
          </span>
        )}
      </span>
    </div>
  );
}

export default function JobStateTransitioner({
  job,
  evidence = [],
  runbookComplete = false,
  hasSignature = false,
  onTransitionSuccess,
}) {
  const { user, permissions } = useAuth();
  const [showOverrideReason, setShowOverrideReason] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [pendingTransition, setPendingTransition] = useState(null);
  const [toolCheckOpen, setToolCheckOpen] = useState(false);
  const [enRouteEtaOpen, setEnRouteEtaOpen] = useState(false);
  const pendingAfterToolCheckRef = useRef(null);
  const pendingEnRouteRef = useRef(null);
  const qc = useQueryClient();

  /*
   * TECHNICAL_DEBT (target Iteration 4/5): Field v2 canonical path uses jobRepository / apiClient
   * elsewhere; long-term, job status updates should go through the same abstraction instead of
   * direct base44.entities.Job.update. Intentionally unchanged scope for Iteration 3 (executeJobStateTransitionMutation).
   */
  const transitionMutation = useMutation({
    mutationFn: ({ toStatus, isOverride, dispatchOverrides, priorStatus }) =>
      executeJobStateTransitionMutation({
        job,
        user,
        evidence,
        toStatus,
        fromStatus: priorStatus ?? job.status,
        isOverride,
        overrideReason,
        dispatchOverrides,
      }),
    onSuccess: (data) => {
      if (!job?.id) return;
      qc.invalidateQueries({ queryKey: ['fj-job', job.id] });
      qc.invalidateQueries({ queryKey: ['fj-audit', job.id] });
      qc.invalidateQueries({ queryKey: ['fj-time-entries', job.id] });
      toast.success(`Job transitioned to ${STATUS_LABELS[data.status]?.label}`);
      setPendingTransition(null);
      setOverrideReason('');
      onTransitionSuccess?.();
    },
    onError: (error) => {
      toast.error(`Transition failed: ${error.message}`);
      setPendingTransition(null);
    },
  });

  if (!job || !user) return null;

  const userRole = user.role || 'viewer';
  const currentStatus = job.status;
  const currentLabel = STATUS_LABELS[currentStatus];

  // Get all possible transitions (including gated ones) to show blockers
  const allPossibleTransitions = (STATE_MACHINE[currentStatus] || []).map(t => ({
    ...t,
    gate: canTransition(currentStatus, t.to, userRole, evidence, runbookComplete, hasSignature),
  }));

  const handleTransition = (toStatus, isOverride = false) => {
    if (toStatus === 'en_route' && !isOverride) {
      pendingEnRouteRef.current = { toStatus, isOverride, priorStatus: currentStatus };
      setEnRouteEtaOpen(true);
      return;
    }

    const needsToolCheck =
      toStatus === 'in_progress' && !isOverride && currentStatus !== 'paused';

    if (needsToolCheck) {
      pendingAfterToolCheckRef.current = { toStatus, isOverride, priorStatus: currentStatus };
      setToolCheckOpen(true);
      return;
    }

    if (!isOverride && !overrideReason) {
      setPendingTransition({ toStatus, isOverride: false });
    } else if (isOverride && !overrideReason) {
      setShowOverrideReason(true);
      setPendingTransition({ toStatus, isOverride: true });
      return;
    }
    transitionMutation.mutate({ toStatus, isOverride, priorStatus: currentStatus });
  };

  const completeToolCheckAndTransition = () => {
    setToolCheckOpen(false);
    const p = pendingAfterToolCheckRef.current;
    pendingAfterToolCheckRef.current = null;
    if (p) transitionMutation.mutate(p);
  };

  const completeEnRouteEtaAck = (ts) => {
    setEnRouteEtaOpen(false);
    const p = pendingEnRouteRef.current;
    pendingEnRouteRef.current = null;
    if (p) {
      transitionMutation.mutate({
        ...p,
        dispatchOverrides: { eta_ack_timestamp: ts },
      });
    }
  };

  return (
    <div className={cn(FIELD_CARD, 'overflow-hidden')}>
      <EtaAcknowledgementSheet
        open={enRouteEtaOpen}
        onOpenChange={(o) => {
          setEnRouteEtaOpen(o);
          if (!o) pendingEnRouteRef.current = null;
        }}
        jobLabel={job?.title}
        title="Start route"
        description="Confirm you have reviewed ETA / dispatch details before marking en route."
        onConfirm={(ts) => completeEnRouteEtaAck(ts)}
      />

      <PreJobToolCheckModal
        open={toolCheckOpen}
        onOpenChange={(open) => {
          setToolCheckOpen(open);
          if (!open) pendingAfterToolCheckRef.current = null;
        }}
        job={job}
        user={user}
        onPassed={completeToolCheckAndTransition}
      />
      {/* Current State */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80">
        <div className="flex items-center gap-3">
          <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold',
            currentLabel.color)}>
            <span className="inline-block h-2 w-2 rounded-full bg-current opacity-60" />
            {currentLabel.label}
          </div>
          <p className={FIELD_META}>Current job state</p>
        </div>
      </div>

      {/* Transitions */}
      {allPossibleTransitions.length === 0 ? (
        <div className="px-4 py-6 text-center text-slate-400 text-sm">
          No transitions available from {currentLabel.label}
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {allPossibleTransitions.map(({ to, label, description, gate }) => {
            const targetLabel = STATUS_LABELS[to];
            const isAllowed = gate.isAllowed;
            const canOverride = gate.canOverride && permissions?.canEditJob;
            const isDisabled = !isAllowed && !canOverride;

            return (
              <div key={to} className={cn(
                'px-4 py-3 transition-colors',
                isDisabled ? 'bg-slate-50' : 'hover:bg-slate-50',
                isAllowed ? '' : canOverride ? 'bg-amber-50/30' : ''
              )}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-slate-900">{label}</p>
                      <span className={cn('text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded',
                        targetLabel.color)}>
                        → {targetLabel.label}
                      </span>
                    </div>
                    <p
                      className={cn(
                        'text-xs text-slate-600',
                        to === 'en_route' || (to === 'in_progress' && currentStatus !== 'paused')
                          ? 'mb-1'
                          : 'mb-2'
                      )}
                    >
                      {description}
                    </p>
                    {to === 'en_route' ? (
                      <p className={cn(FIELD_META, 'mb-2 leading-snug')}>{READINESS_HINT_EN_ROUTE}</p>
                    ) : null}
                    {to === 'in_progress' && currentStatus !== 'paused' ? (
                      <p className={cn(FIELD_META, 'mb-2 leading-snug')}>{READINESS_HINT_START_WORK}</p>
                    ) : null}
                    {to === 'pending_closeout' ? (
                      <p className={cn(FIELD_META, 'mb-2 leading-snug')}>
                        Open the <strong className="font-semibold text-slate-700">Closeout</strong> tab first — it
                        lists what is still missing before you should mark work complete.
                      </p>
                    ) : null}

                    {/* Blockers */}
                    {gate.blockers.length > 0 && (
                      <div className="space-y-1.5 mb-2">
                        {gate.blockers.map(req => (
                          <RequirementItem
                            key={req.type}
                            requirement={req}
                            blocker={gate.blockers.find(b => b.type === req.type)}
                          />
                        ))}
                      </div>
                    )}

                    {/* Override notice */}
                    {!isAllowed && canOverride && (
                      <div className="flex items-start gap-2 p-2 bg-amber-100/50 rounded-lg text-[10px] text-amber-800">
                        <Flag className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                        <span>Admin override available — provide reason below</span>
                      </div>
                    )}
                  </div>

                  {/* Action button */}
                  <button
                    onClick={() => handleTransition(to, !isAllowed && canOverride)}
                    disabled={isDisabled || transitionMutation.isPending}
                    className={cn(
                      'flex-shrink-0 px-3 text-xs font-bold transition-colors flex items-center gap-1 whitespace-nowrap rounded-xl',
                      FIELD_CTRL_H,
                      isAllowed
                        ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                        : canOverride
                          ? 'bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed',
                    )}
                  >
                    {transitionMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : !isAllowed && canOverride ? (
                      <>
                        <LogOut className="h-3.5 w-3.5" /> Override
                      </>
                    ) : isDisabled ? (
                      <>
                        <Lock className="h-3.5 w-3.5" /> Blocked
                      </>
                    ) : (
                      <>
                        <ChevronRight className="h-3.5 w-3.5" /> {label}
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Override reason modal */}
      {showOverrideReason && pendingTransition?.isOverride && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => {
            setShowOverrideReason(false);
            setPendingTransition(null);
          }} />
          <div className="relative bg-white rounded-t-2xl md:rounded-xl shadow-xl w-full md:max-w-sm p-4 space-y-3">
            <p className="font-bold text-slate-900">Override Reason</p>
            <p className="text-xs text-slate-500">
              Explain why evidence requirements are being waived.
            </p>
            <textarea
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
              placeholder="e.g., 'Client requested early completion, evidence collected verbally'"
              className="w-full h-20 p-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowOverrideReason(false);
                  setPendingTransition(null);
                }}
                className={cn('flex-1 px-3 text-xs', BTN_SECONDARY)}
              >
                Cancel
              </button>
              <button
                onClick={() => handleTransition(pendingTransition.toStatus, true)}
                disabled={!overrideReason.trim()}
                className="flex-1 px-3 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 disabled:opacity-50 h-10"
              >
                Confirm Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}