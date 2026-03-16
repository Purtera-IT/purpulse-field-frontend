/**
 * TaskCard — Expandable task card for the Tasks tab.
 * Collapsed: summary, gate badge, deliverable count, QC warnings.
 * Expanded: instructions, tips/mistakes, checks, deliverables, actions.
 */
import React, { useState, useCallback } from 'react';
import {
  ChevronDown, ChevronUp, Clock, CheckCircle2, AlertOctagon,
  Circle, PlayCircle, XCircle, Lightbulb, ClipboardCheck,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import DeliverableItem from './deliverables/DeliverableItem';

const GATE_CFG = {
  blocking: { bg: 'bg-red-500',   label: 'Blocking', tip: 'Cannot proceed until complete' },
  warning:  { bg: 'bg-amber-500', label: 'Warning',  tip: 'Should complete before proceeding' },
  info:     { bg: 'bg-blue-400',  label: 'Info',     tip: 'Complete at your discretion' },
};

const STATUS_CFG = {
  pending:     { Icon: Circle,       cls: 'text-slate-400',   label: 'Pending'     },
  in_progress: { Icon: PlayCircle,   cls: 'text-blue-500',    label: 'In Progress' },
  done:        { Icon: CheckCircle2, cls: 'text-emerald-500', label: 'Complete'    },
  blocked:     { Icon: XCircle,      cls: 'text-red-500',     label: 'Blocked'     },
};

function CheckRow({ check, onToggle }) {
  return (
    <button
      onClick={() => onToggle(check.id)}
      className={cn(
        'flex items-center gap-2.5 w-full py-2 px-2 rounded-lg transition-all active:opacity-70 text-left',
        check.done ? 'text-slate-400' : 'text-slate-700'
      )}
    >
      <div className={cn(
        'h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
        check.done ? 'border-emerald-400 bg-emerald-400' : 'border-slate-300 bg-white'
      )}>
        {check.done && <CheckCircle2 className="h-3 w-3 text-white" />}
      </div>
      <span className={cn('text-xs font-semibold', check.done && 'line-through text-slate-400')}>{check.label}</span>
    </button>
  );
}

export default function TaskCard({ task, phaseColor, orderNum, isPhaseUnlocked, onComplete, onEscalate }) {
  const [expanded,  setExpanded]  = useState(task.status === 'in_progress');
  const [checks,    setChecks]    = useState(task.checks || []);
  const [status,    setStatus]    = useState(task.status);
  const [showTips,  setShowTips]  = useState(false);

  // Track deliverable statuses independently via callbacks
  const [delivStatuses, setDelivStatuses] = useState(() => {
    const map = {};
    (task.deliverables || []).forEach(d => { map[d.id] = d.status; });
    return map;
  });

  const handleDelivCapture = useCallback((id, data) => {
    setDelivStatuses(prev => ({ ...prev, [id]: data.status }));
  }, []);

  const statusCfg = STATUS_CFG[status] || STATUS_CFG.pending;
  const StatusIcon = statusCfg.Icon;
  const gateCfg = GATE_CFG[task.gate] || GATE_CFG.info;

  const requiredIds    = (task.deliverables || []).filter(d => d.required).map(d => d.id);
  const capturedCount  = requiredIds.filter(id => ['qc_pass', 'qc_warning', 'captured'].includes(delivStatuses[id])).length;
  const blockedByDelivs = capturedCount < requiredIds.length;
  const allChecksDone  = checks.every(c => c.done);
  const canComplete    = !blockedByDelivs && allChecksDone && status !== 'done';

  const qcFailCount    = Object.values(delivStatuses).filter(s => s === 'qc_fail').length;
  const qcWarnCount    = Object.values(delivStatuses).filter(s => s === 'qc_warning').length;

  const completionPct = requiredIds.length === 0
    ? (allChecksDone ? 100 : Math.round((checks.filter(c => c.done).length / Math.max(checks.length, 1)) * 100))
    : Math.round(
        (capturedCount / requiredIds.length) * 0.6 * 100 +
        (checks.filter(c => c.done).length / Math.max(checks.length, 1)) * 0.4 * 100
      );

  const handleToggleCheck = (id) => setChecks(prev => prev.map(c => c.id === id ? { ...c, done: !c.done } : c));

  const handleStart = () => {
    if (status === 'pending' && isPhaseUnlocked) { setStatus('in_progress'); setExpanded(true); }
  };

  const handleComplete = () => {
    if (!canComplete) return;
    setStatus('done');
    onComplete?.(task.id);
    toast.success(`✓ ${task.title}`, { duration: 2500 });
  };

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden transition-all',
      status === 'done'        ? 'border-emerald-200 bg-emerald-50/40'   :
      status === 'in_progress' ? 'border-blue-200 bg-blue-50/30'         :
      status === 'blocked'     ? 'border-red-200 bg-red-50/30'           :
      !isPhaseUnlocked         ? 'border-slate-100 bg-slate-50 opacity-55' :
                                 'border-slate-200 bg-white'
    )}>

      {/* ── Collapsed header ───────────────────────────── */}
      <button
        className="w-full text-left"
        onClick={() => isPhaseUnlocked && setExpanded(v => !v)}
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-3 p-3.5">
          {/* Order chip + gate dot */}
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0 pt-0.5">
            <div className={cn(
              'h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black text-white',
              `bg-${phaseColor}-500`
            )}>
              {orderNum}
            </div>
            <div className={cn('h-2 w-2 rounded-full', gateCfg.bg)} title={gateCfg.tip} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <p className={cn(
                'text-sm font-black leading-snug flex-1',
                status === 'done' ? 'text-slate-400 line-through' : 'text-slate-900'
              )}>
                {task.title}
              </p>
              <StatusIcon className={cn('h-4 w-4 flex-shrink-0 mt-0.5', statusCfg.cls)} />
            </div>

            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <Clock className="h-2.5 w-2.5" /> {task.duration_est}
              </span>
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', `bg-${phaseColor}-100`, `text-${phaseColor}-700`)}>
                {statusCfg.label}
              </span>
              {task.gate === 'blocking' && status !== 'done' && (
                <span className="text-[10px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">⛔ GATE</span>
              )}
              {qcFailCount > 0 && (
                <span className="text-[10px] font-black text-red-600 bg-red-50 px-1.5 rounded border border-red-200">{qcFailCount} QC fail</span>
              )}
              {qcWarnCount > 0 && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 rounded border border-amber-200">{qcWarnCount} QC warn</span>
              )}
            </div>

            {status === 'in_progress' && (
              <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${completionPct}%` }} />
              </div>
            )}

            {status !== 'done' && requiredIds.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[10px] text-slate-400">{capturedCount}/{requiredIds.length} required</span>
                {blockedByDelivs && status === 'in_progress' && (
                  <span className="text-[10px] font-black text-red-500">· blocks completion</span>
                )}
              </div>
            )}
          </div>

          <ChevronDown className={cn('h-4 w-4 text-slate-300 flex-shrink-0 transition-transform mt-1', expanded && 'rotate-180')} />
        </div>
      </button>

      {/* ── Expanded body ──────────────────────────────── */}
      {expanded && (
        <div className="border-t border-slate-100">

          {/* Instructions */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Instructions</p>
            <p className="text-sm text-slate-700 leading-relaxed">{task.instructions}</p>
          </div>

          {/* Tips & mistakes toggle */}
          <button
            onClick={() => setShowTips(v => !v)}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-100 text-left active:opacity-70"
          >
            <Lightbulb className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
            <span className="text-[11px] font-bold text-amber-700 flex-1">Tips & Common Mistakes</span>
            {showTips ? <ChevronUp className="h-3.5 w-3.5 text-amber-400" /> : <ChevronRight className="h-3.5 w-3.5 text-amber-400" />}
          </button>

          {showTips && (
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 space-y-3">
              {task.tips?.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-wide mb-1.5">💡 Tips</p>
                  <ul className="space-y-1">
                    {task.tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-amber-800">
                        <span className="text-amber-400 mt-0.5">•</span> {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {task.common_mistakes?.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-red-600 uppercase tracking-wide mb-1.5">⚠ Common Mistakes</p>
                  <ul className="space-y-1">
                    {task.common_mistakes.map((m, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-red-700">
                        <span className="text-red-400 mt-0.5">•</span> {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Verification checks */}
          {checks.length > 0 && (
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Checks · {checks.filter(c => c.done).length}/{checks.length}
              </p>
              <div className="space-y-0.5">
                {checks.map(c => <CheckRow key={c.id} check={c} onToggle={handleToggleCheck} />)}
              </div>
            </div>
          )}

          {/* Deliverables */}
          {(task.deliverables || []).length > 0 && (
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Deliverables · {capturedCount}/{requiredIds.length} required captured
              </p>
              {blockedByDelivs && status === 'in_progress' && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-red-50 rounded-xl border border-red-200">
                  <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                  <p className="text-[11px] font-black text-red-700">
                    {requiredIds.length - capturedCount} required deliverable{requiredIds.length - capturedCount !== 1 ? 's' : ''} block completion
                  </p>
                </div>
              )}
              <div className="space-y-2">
                {(task.deliverables || []).map(d => (
                  <DeliverableItem
                    key={d.id}
                    deliverable={d}
                    onCapture={handleDelivCapture}
                    disabled={status === 'done'}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="px-4 py-3 flex gap-2">
            <button
              onClick={() => onEscalate?.(task)}
              className="flex items-center gap-1.5 h-11 px-3 rounded-xl border border-red-200 text-red-600 text-xs font-bold flex-shrink-0 active:bg-red-50"
            >
              <AlertOctagon className="h-3.5 w-3.5" /> Escalate
            </button>

            {status === 'pending' && isPhaseUnlocked && (
              <button
                onClick={handleStart}
                className="flex-1 h-11 rounded-xl bg-blue-600 text-white font-bold text-sm active:opacity-80 flex items-center justify-center gap-2"
              >
                <PlayCircle className="h-4 w-4" /> Begin Task
              </button>
            )}

            {status === 'in_progress' && (
              <button
                onClick={handleComplete}
                disabled={!canComplete}
                className={cn(
                  'flex-1 h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all',
                  canComplete
                    ? 'bg-emerald-600 text-white active:opacity-80'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                )}
                title={!canComplete ? 'Capture all required deliverables and check all items first' : undefined}
              >
                {canComplete
                  ? <><CheckCircle2 className="h-4 w-4" /> Mark Complete</>
                  : <><ClipboardCheck className="h-4 w-4" /> Deliverables Incomplete</>
                }
              </button>
            )}

            {status === 'done' && (
              <div className="flex-1 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-sm flex items-center justify-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Complete
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}