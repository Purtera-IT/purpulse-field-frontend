/**
 * Technician closeout outcome — triad (clean / concerns / problematic) + optional rating, flags, notes.
 * Iteration 14 (intentional): feedback_event is queued before Job.update — see saveTechnicianCloseoutOutcomeWithTelemetry.
 */
import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Star, ClipboardCheck } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import {
  formStateFromJob,
  hasTechnicianCloseoutFeedback,
  outcomeLabel,
} from '@/lib/fieldCloseoutFeedbackViewModel';
import { saveTechnicianCloseoutOutcomeWithTelemetry } from '@/lib/technicianCloseoutOutcomeSave';
import { FIELD_CARD, FIELD_META, FIELD_OVERLINE, FIELD_SURFACE_MUTED } from '@/lib/fieldVisualTokens';

function formatRecordedAt(iso) {
  if (!iso || typeof iso !== 'string') return null;
  try {
    const d = parseISO(iso);
    return isValid(d) ? format(d, 'MMM d, yyyy · h:mm a') : iso;
  } catch {
    return iso;
  }
}

const OUTCOMES = [
  { value: 'clean', label: 'Clean finish' },
  { value: 'concerns', label: 'Finished with concerns' },
  { value: 'problematic', label: 'Problematic finish' },
];

export default function JobCloseoutOutcomePanel({ job, onComplete }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => formStateFromJob(job));

  /* Sync form from job when persisted closeout fields change; list fields explicitly so unrelated job object churn does not wipe edits. */
  useEffect(() => {
    if (job.status !== 'pending_closeout') return;
    setForm(formStateFromJob(job));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- job identity + closeout slice only (not whole job)
  }, [
    job.id,
    job.status,
    job.technician_closeout_outcome,
    job.technician_closeout_recorded_at,
    job.technician_closeout_rating,
    job.technician_closeout_complaint_flag,
    job.technician_closeout_compliment_flag,
    job.technician_closeout_notes,
  ]);

  const saveMutation = useMutation({
    mutationFn: async () => saveTechnicianCloseoutOutcomeWithTelemetry(job, user, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['fj-job', job.id] });
      toast.success('Finish outcome saved');
      onComplete?.();
    },
    onError: (e) => {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.startsWith('Telemetry:')) {
        toast.error('Could not queue finish feedback — try again');
      } else {
        toast.error('Could not save outcome — try again');
      }
    },
  });

  const readOnly =
    job.status === 'submitted' || job.status === 'approved' || job.status === 'rejected';

  if (readOnly) {
    if (!hasTechnicianCloseoutFeedback(job)) return null;
    const o = job.technician_closeout_outcome;
    const title =
      o === 'clean' || o === 'concerns' || o === 'problematic' ? outcomeLabel(o) : 'Recorded';
    const r = job.technician_closeout_rating;
    return (
      <div
        id="closeout-technician-outcome-anchor"
        className="scroll-mt-24 outline-none rounded-lg"
        tabIndex={-1}
        role="region"
        aria-label="Technician finish outcome"
      >
        <p className={cn(FIELD_OVERLINE, 'mb-2')}>Technician finish outcome</p>
        <div className={cn(FIELD_CARD, 'p-4 space-y-2')}>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {typeof r === 'number' && r >= 1 && r <= 5 ? (
            <p className={cn(FIELD_META, 'flex items-center gap-1')}>
              Rating: {r} / 5
            </p>
          ) : null}
          <div className={cn(FIELD_META, 'flex flex-wrap gap-2')}>
            {job.technician_closeout_complaint_flag ? (
              <span className="rounded-md bg-amber-50 text-amber-900 px-2 py-0.5 text-[11px] font-semibold border border-amber-100">
                Issue / concern flagged
              </span>
            ) : null}
            {job.technician_closeout_compliment_flag ? (
              <span className="rounded-md bg-emerald-50 text-emerald-900 px-2 py-0.5 text-[11px] font-semibold border border-emerald-100">
                Compliment flagged
              </span>
            ) : null}
          </div>
          {job.technician_closeout_notes ? (
            <p className={cn(FIELD_META, 'whitespace-pre-wrap')}>{job.technician_closeout_notes}</p>
          ) : null}
          {job.technician_closeout_recorded_at ? (
            <p className="text-[10px] text-slate-400">
              Saved {formatRecordedAt(job.technician_closeout_recorded_at) ?? job.technician_closeout_recorded_at}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (job.status !== 'pending_closeout') return null;

  return (
    <div
      id="closeout-technician-outcome-anchor"
      className="scroll-mt-24 outline-none rounded-lg"
      tabIndex={-1}
      role="region"
      aria-label="Technician finish outcome"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
          <ClipboardCheck className="h-4 w-4 text-slate-700" />
        </div>
        <div>
          <p className={cn(FIELD_OVERLINE, 'mb-0')}>Technician finish outcome</p>
          <p className={cn(FIELD_META, 'mt-0.5 leading-snug')}>
            How the work finished on site — separate from customer sign-off. Saved to the job record for operations.
          </p>
        </div>
      </div>

      <div className={cn(FIELD_CARD, 'p-4 space-y-4')}>
        <div>
          <p className="text-xs font-semibold text-slate-800 mb-2">Outcome</p>
          <div className="flex flex-col gap-2">
            {OUTCOMES.map(({ value, label }) => {
              const selected = form.outcome === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, outcome: value }))}
                  className={cn(
                    'rounded-xl border-2 px-3 py-2.5 text-left text-xs font-semibold transition-colors',
                    selected
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-950'
                      : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Optional rating (1–5)</Label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, rating: f.rating === s ? null : s }))
                }
                className="p-1"
                aria-label={`Rate ${s} of 5`}
              >
                <Star
                  className={cn(
                    'h-6 w-6',
                    form.rating != null && s <= form.rating
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-slate-200'
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-start gap-2 text-xs text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-slate-300"
              checked={form.complaintFlag}
              onChange={(e) => setForm((f) => ({ ...f, complaintFlag: e.target.checked }))}
            />
            <span>Flag customer or site concern</span>
          </label>
          <label className="flex items-start gap-2 text-xs text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-slate-300"
              checked={form.complimentFlag}
              onChange={(e) => setForm((f) => ({ ...f, complimentFlag: e.target.checked }))}
            />
            <span>Flag compliment / positive note</span>
          </label>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Notes (optional)</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value.slice(0, 2000) }))}
            placeholder="Context for operations…"
            className="rounded-xl resize-none min-h-[72px]"
            rows={3}
          />
          <p className={cn(FIELD_META, 'text-[10px]')}>{form.notes.length} / 2000</p>
        </div>

        <Button
          className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 h-11"
          disabled={!form.outcome || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save finish outcome
        </Button>
      </div>

      {hasTechnicianCloseoutFeedback(job) ? (
        <p className={cn(FIELD_SURFACE_MUTED, 'text-[11px] text-slate-600 mt-2 px-0.5')}>
          Last saved on the job — you can update fields and save again before submit.
        </p>
      ) : null}
    </div>
  );
}
