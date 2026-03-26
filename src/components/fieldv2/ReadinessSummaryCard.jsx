/**
 * Coarse readiness summary for Overview — derived from job.status + work_start TimeEntry presence.
 */
import React, { useMemo } from 'react';
import { CheckCircle2, Circle, CircleDot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildFieldReadinessSummary } from '@/lib/fieldReadinessViewModel';
import FieldSectionCard from './FieldSectionCard';
import { FIELD_BODY, FIELD_META } from '@/lib/fieldVisualTokens';

function PhaseIcon({ state }) {
  if (state === 'complete') {
    return <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" aria-hidden />;
  }
  if (state === 'current') {
    return <CircleDot className="h-4 w-4 text-slate-800 flex-shrink-0 mt-0.5" aria-hidden />;
  }
  return <Circle className="h-4 w-4 text-slate-300 flex-shrink-0 mt-0.5" aria-hidden />;
}

export default function ReadinessSummaryCard({ job, timeEntries = [] }) {
  const hasWorkStartTimeEntry = useMemo(
    () => timeEntries.some((e) => e.entry_type === 'work_start'),
    [timeEntries]
  );

  const summary = useMemo(
    () => buildFieldReadinessSummary(job, { hasWorkStartTimeEntry }),
    [job, hasWorkStartTimeEntry]
  );

  return (
    <FieldSectionCard title="Readiness" variant="muted">
      <p className={cn(FIELD_BODY, 'font-medium text-slate-800 mb-3')}>{summary.headline}</p>
      <ul className="space-y-2" aria-label="Readiness phases">
        {summary.phases.map((p) => {
          const showDetail =
            p.state !== 'complete' || (p.id === 'start_work' && job?.status === 'paused');
          return (
            <li key={p.id} className="flex gap-2">
              <PhaseIcon state={p.state} />
              <div className="min-w-0">
                <p
                  className={cn(
                    'text-xs font-semibold leading-snug',
                    p.state === 'current' ? 'text-slate-900' : 'text-slate-600'
                  )}
                >
                  {p.title}
                  {p.state === 'complete' ? (
                    <span className="font-normal text-slate-500"> — done</span>
                  ) : null}
                </p>
                {showDetail ? (
                  <p className={cn(FIELD_META, 'mt-0.5 leading-snug')}>{p.detail}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <p className={cn(FIELD_META, 'mt-3 pt-2 border-t border-slate-200/80 leading-snug')}>
        {summary.disclaimer}
      </p>
    </FieldSectionCard>
  );
}
