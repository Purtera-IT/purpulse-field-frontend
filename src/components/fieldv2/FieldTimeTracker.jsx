/**
 * FieldTimeTracker — Work session via TimeEntry (work_start / work_stop), aligned with TimerPanel seams.
 * Embedded in Job Overview. Session state is derived from time entries + job lifecycle, not local clock truth.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Square, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { apiClient } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { telemetryTimeClockStart, telemetryTimeClockStop } from '@/lib/telemetry';
import { emitCanonicalEventsForTimeEntry } from '@/lib/travelArrivalEvent';
import { PreArrivalAckSheet } from '@/components/field/AcknowledgementSheets.jsx';
import {
  deriveTimerSessionFromTimeEntries,
  formatWorkedDuration,
} from '@/lib/fieldJobExecutionModel';
import {
  FIELD_BADGE_NEUTRAL,
  FIELD_BODY,
  FIELD_CARD,
  FIELD_CTRL_H,
  FIELD_META,
  FIELD_OVERLINE,
} from '@/lib/fieldVisualTokens';

function makeClientId() {
  return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function FieldTimeTracker({
  job,
  timeEntries = [],
  executionView,
  onRefresh,
  variant = 'default',
}) {
  const { user } = useAuth(); // required for emitCanonicalEventsForTimeEntry(work_start)
  const [arrivalAckOpen, setArrivalAckOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const qc = useQueryClient();

  useEffect(() => {
    if (!executionView?.timer?.workSegmentOpen) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [executionView?.timer?.workSegmentOpen]);

  const liveTimer = useMemo(() => {
    void tick;
    return deriveTimerSessionFromTimeEntries(timeEntries);
  }, [timeEntries, tick]);

  const createEntry = useMutation({
    mutationFn: async ({ entryType, timestamp }) =>
      apiClient.createTimeEntry(job.id, {
        job_id: job.id,
        entry_type: entryType,
        timestamp,
        source: 'app',
        sync_status: 'pending',
        locked: false,
        client_request_id: makeClientId(),
      }),
    onSuccess: (_, { entryType }) => {
      qc.invalidateQueries({ queryKey: ['fj-time-entries', job.id] });
      onRefresh?.();
      if (entryType === 'work_start') toast.success('Work timer started');
      if (entryType === 'work_stop') toast.success('Work timer stopped');
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'Could not save time entry');
    },
  });

  const performWorkStart = async (arrivalScopeAcknowledgements) => {
    const ts = new Date().toISOString();
    try {
      await emitCanonicalEventsForTimeEntry({
        job,
        user,
        entryType: 'work_start',
        timestamp: ts,
        travelMinutes: null,
        location: null,
        etaAckTimestamp: null,
        arrivalScopeAcknowledgements: arrivalScopeAcknowledgements ?? null,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not queue arrival/work telemetry');
      return;
    }
    telemetryTimeClockStart(job.id, 'work_start');
    createEntry.mutate({ entryType: 'work_start', timestamp: ts });
    setArrivalAckOpen(false);
  };

  const performWorkStop = () => {
    const ts = new Date().toISOString();
    telemetryTimeClockStop(job.id, 'work_stop', liveTimer.workedSeconds);
    createEntry.mutate({ entryType: 'work_stop', timestamp: ts });
  };

  const embedded = variant === 'embedded';
  const { canClockIn, canClockOut, clockInDisabledReason } = executionView;
  const workedLabel = formatWorkedDuration(liveTimer.workedSeconds);

  return (
    <div className={embedded ? 'space-y-3' : 'space-y-4'}>
      <PreArrivalAckSheet
        open={arrivalAckOpen}
        onOpenChange={setArrivalAckOpen}
        jobLabel={job?.title}
        onConfirm={(ackState) => {
          void performWorkStart(ackState);
        }}
      />

      <div className={cn(FIELD_CARD, embedded ? 'p-3' : 'p-4')}>
        <div className={cn('flex items-center justify-between gap-2', embedded ? 'mb-2' : 'mb-3')}>
          <p className={FIELD_OVERLINE}>
            Work timer
          </p>
          <span
            className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums border-0',
              liveTimer.workSegmentOpen
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100/80'
                : FIELD_BADGE_NEUTRAL
            )}
          >
            {liveTimer.workSegmentOpen ? '● Running' : '○ Stopped'}
          </span>
        </div>
        <p
          className={cn(
            'font-mono font-bold text-slate-800 tabular-nums mb-2',
            embedded ? 'text-sm' : 'text-base'
          )}
        >
          {workedLabel}
          <span className="text-[10px] font-sans font-semibold text-slate-400 ml-2 normal-case">
            on this job
          </span>
        </p>
        <p className={cn(FIELD_BODY, 'mb-2')}>{executionView.sessionSummaryLine}</p>
        {canClockIn && !liveTimer.workSegmentOpen ? (
          <p className={cn(FIELD_META, 'mb-3 leading-snug')}>
            Third of three readiness steps: starting the timer opens a short site check before work time is recorded.
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setArrivalAckOpen(true)}
            disabled={!canClockIn || createEntry.isPending}
            title={!canClockIn ? clockInDisabledReason || undefined : undefined}
            className={cn(
              'flex-1 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-emerald-700 transition-colors',
              embedded ? 'h-9 text-xs' : cn(FIELD_CTRL_H, 'text-sm')
            )}
          >
            <Play className={embedded ? 'h-3.5 w-3.5' : 'h-4 w-4'} /> Start timer
          </button>
          <button
            type="button"
            onClick={performWorkStop}
            disabled={!canClockOut || createEntry.isPending}
            className={cn(
              'flex-1 rounded-xl bg-red-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-red-700 transition-colors',
              embedded ? 'h-9 text-xs' : cn(FIELD_CTRL_H, 'text-sm')
            )}
          >
            {createEntry.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Square className={embedded ? 'h-3.5 w-3.5' : 'h-4 w-4'} /> Stop timer
              </>
            )}
          </button>
        </div>
        {!canClockIn && clockInDisabledReason && (
          <p className={cn(FIELD_BODY, 'mt-2')}>{clockInDisabledReason}</p>
        )}
      </div>
    </div>
  );
}
