/**
 * TasksTab — Phase-grouped task list for Job Detail cockpit.
 * Phases unlock sequentially (all blocking tasks in prev phase must be done).
 */
import React, { useState } from 'react';
import {
  CheckCircle2, Lock, ChevronDown, ChevronUp, AlertOctagon,
  Zap, BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import TaskCard from './TaskCard';
import { getRunbook } from '../../lib/mockRunbook';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import BlockerForm from './BlockerForm';

const PHASE_COLORS = {
  amber:   { bg: 'bg-amber-100',   text: 'text-amber-800',   bar: 'bg-amber-500',   ring: 'border-amber-300'  },
  blue:    { bg: 'bg-blue-100',    text: 'text-blue-800',    bar: 'bg-blue-500',    ring: 'border-blue-300'   },
  purple:  { bg: 'bg-purple-100',  text: 'text-purple-800',  bar: 'bg-purple-500',  ring: 'border-purple-300' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-800', bar: 'bg-emerald-500', ring: 'border-emerald-300'},
  teal:    { bg: 'bg-teal-100',    text: 'text-teal-800',    bar: 'bg-teal-500',    ring: 'border-teal-300'   },
  slate:   { bg: 'bg-slate-100',   text: 'text-slate-700',   bar: 'bg-slate-400',   ring: 'border-slate-300'  },
};

function PhaseProgressBar({ tasks }) {
  const done = tasks.filter(t => t.status === 'done').length;
  const pct  = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-black text-slate-500 tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}

function OverallProgress({ phases, tasks }) {
  const allTasks = phases.flatMap(p => p.tasks);
  const done     = allTasks.filter(t => t.status === 'done').length;
  const total    = allTasks.length;
  const pct      = total ? Math.round((done / total) * 100) : 0;
  const blocking = allTasks.filter(t => t.gate === 'blocking' && t.status !== 'done').length;

  return (
    <div className="bg-white rounded-[8px] border border-slate-100 px-3 py-2 mb-2">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', pct === 100 ? 'bg-emerald-500' : 'bg-blue-500')} style={{ width: `${pct}%` }} />
        </div>
        <span className={cn('text-[11px] font-black tabular-nums flex-shrink-0', pct === 100 ? 'text-emerald-600' : 'text-slate-700')}>{pct}%</span>
      </div>
      <div className="flex items-center gap-3 text-[10px]">
        <span className="text-emerald-600 font-bold">{done} done</span>
        <span className="text-slate-400">{total - done} left</span>
        {blocking > 0 && (
          <span className="text-red-600 font-black flex items-center gap-1">
            <Zap className="h-2.5 w-2.5" /> {blocking} blocking
          </span>
        )}
        {pct === 100 && (
          <span className="inline-flex items-center gap-1 text-emerald-700 font-black bg-emerald-50 border border-emerald-200 px-1.5 py-px rounded-[4px] ml-auto">
            ✓ All done
          </span>
        )}
      </div>
    </div>
  );
}

export default function TasksTab({ job }) {
  const rawPhases = getRunbook(job);
  const [phases,         setPhases]         = useState(rawPhases);
  const [collapsedPhases,setCollapsedPhases] = useState({});
  const [escalateTask,   setEscalateTask]   = useState(null);

  // A phase is unlocked if all BLOCKING tasks in previous phases are done
  const isPhaseUnlocked = (phaseIdx) => {
    if (phaseIdx === 0) return true;
    for (let i = 0; i < phaseIdx; i++) {
      const blockingTasks = phases[i].tasks.filter(t => t.gate === 'blocking');
      if (blockingTasks.some(t => t.status !== 'done')) return false;
    }
    return true;
  };

  const handleTaskComplete = (phaseIdx, taskId) => {
    setPhases(prev => prev.map((ph, pi) =>
      pi !== phaseIdx ? ph : {
        ...ph,
        tasks: ph.tasks.map(t => t.id === taskId ? { ...t, status: 'done' } : t),
      }
    ));
  };

  const togglePhase = (phaseId) => {
    setCollapsedPhases(prev => ({ ...prev, [phaseId]: !prev[phaseId] }));
  };

  let globalOrder = 0;

  return (
    <div>
      <OverallProgress phases={phases} />

      {phases.map((phase, phaseIdx) => {
        const color    = PHASE_COLORS[phase.color] || PHASE_COLORS.slate;
        const unlocked = isPhaseUnlocked(phaseIdx);
        const collapsed = collapsedPhases[phase.id];
        const phaseDone = phase.tasks.every(t => t.status === 'done');
        const phaseBlocking = phase.tasks.filter(t => t.gate === 'blocking' && t.status !== 'done').length;

        return (
          <div key={phase.id} className="mb-4">
            {/* Phase header */}
            <button
              onClick={() => togglePhase(phase.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-2xl border mb-2 transition-all text-left',
                phaseDone ? 'bg-emerald-50 border-emerald-200' : unlocked ? cn(color.bg, 'border', color.ring) : 'bg-slate-100 border-slate-200 opacity-70'
              )}
            >
              {/* Phase number */}
              <div className={cn(
                'h-8 w-8 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0',
                phaseDone ? 'bg-emerald-500 text-white' : unlocked ? cn(color.bar, 'text-white') : 'bg-slate-300 text-white'
              )}>
                {phaseDone ? <CheckCircle2 className="h-4 w-4" /> : phase.order}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className={cn('text-sm font-black', phaseDone ? 'text-emerald-700' : !unlocked ? 'text-slate-400' : color.text)}>
                    {phase.name}
                  </p>
                  {!unlocked && <Lock className="h-3.5 w-3.5 text-slate-400" />}
                  {phaseBlocking > 0 && !phaseDone && (
                    <span className="text-[9px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                      {phaseBlocking} blocking
                    </span>
                  )}
                </div>
                <PhaseProgressBar tasks={phase.tasks} />
              </div>

              {collapsed
                ? <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                : <ChevronUp   className="h-4 w-4 text-slate-400 flex-shrink-0" />
              }
            </button>

            {/* Phase tasks */}
            {!collapsed && (
              <div className="space-y-2 pl-2">
                {phase.tasks.map((task) => {
                  globalOrder++;
                  const order = globalOrder;
                  return (
                    <TaskCard
                      key={task.id}
                      task={task}
                      phaseColor={phase.color || 'slate'}
                      orderNum={order}
                      isPhaseUnlocked={unlocked}
                      onComplete={(taskId) => handleTaskComplete(phaseIdx, taskId)}
                      onEscalate={(t) => setEscalateTask(t)}
                    />
                  );
                })}
              </div>
            )}

            {/* Phase locked hint */}
            {!unlocked && !collapsed && (
              <div className="mx-2 px-4 py-3 rounded-xl bg-slate-100 border border-dashed border-slate-300 text-center">
                <p className="text-xs font-semibold text-slate-400">
                  🔒 Complete all blocking tasks in previous phase to unlock
                </p>
              </div>
            )}
          </div>
        );
      })}

      {/* Escalation sheet */}
      <Sheet open={!!escalateTask} onOpenChange={v => !v && setEscalateTask(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[80vh] overflow-y-auto pb-10">
          <div className="pt-3 px-4">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
            <div className="flex items-center gap-2 mb-4">
              <AlertOctagon className="h-5 w-5 text-red-600" />
              <h3 className="text-base font-black text-red-700">Escalate Issue</h3>
            </div>
            {escalateTask && (
              <p className="text-xs text-slate-500 mb-4 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                Task: <strong>{escalateTask.title}</strong>
              </p>
            )}
            <BlockerForm
              jobId={job?.id}
              onSubmitted={() => { setEscalateTask(null); toast.success('Issue escalated to dispatcher'); }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}