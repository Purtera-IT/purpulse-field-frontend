import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, AlertTriangle, Loader2, Send, FileCheck, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { emitDispatchEventForJobStatusChange } from '@/lib/dispatchEvent';
import { emitCloseoutEvent } from '@/lib/closeoutEvent';
import { emitFeedbackEvent } from '@/lib/feedbackEvent';
import { fetchJobContextForArtifactEvent } from '@/lib/artifactEvent';
import { deriveCloseoutSubmissionFlags } from '@/lib/closeoutSubmissionFlags';

export default function CloseoutPreview({ job }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [complaintFlag, setComplaintFlag] = useState(false);
  const [complimentFlag, setComplimentFlag] = useState(false);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  /** Confirmed-at-closeout admin flags (optional on payload when unchecked). */
  const [timecardSubmitted, setTimecardSubmitted] = useState(false);
  const [invoiceSupportDocs, setInvoiceSupportDocs] = useState(false);
  const [portalUpdated, setPortalUpdated] = useState(false);

  const { data: evidence = [] } = useQuery({
    queryKey: ['evidence', job?.id],
    queryFn: () => base44.entities.Evidence.filter({ job_id: job?.id }),
    enabled: !!job?.id,
  });

  const requirements = job?.evidence_requirements || [];
  const fields = job?.fields_schema || [];
  const phases = job?.runbook_phases || [];

  const evidenceChecks = requirements.map(req => {
    const matchingEvidence = evidence.filter(e => e.evidence_type === req.type && e.status === 'uploaded');
    return {
      label: req.label || req.type,
      required: req.min_count || 1,
      captured: matchingEvidence.length,
      met: matchingEvidence.length >= (req.min_count || 1),
    };
  });

  const fieldChecks = fields.filter(f => f.required).map(f => ({
    label: f.label || f.key,
    met: !!f.value && f.value.trim() !== '',
  }));

  const allSteps = phases.flatMap(p => p.steps || []);
  const completedSteps = allSteps.filter(s => s.completed).length;

  const closeoutFlags = deriveCloseoutSubmissionFlags(job, evidence);
  const { runbookComplete, customerSignatureCaptured: hasSignoff } = closeoutFlags;

  const canSubmit =
    closeoutFlags.documentationComplete &&
    closeoutFlags.requiredFieldsComplete &&
    closeoutFlags.runbookComplete &&
    closeoutFlags.customerSignatureCaptured;

  const hasOptionalFeedback =
    feedbackRating > 0 || complaintFlag || complimentFlag || feedbackNotes.trim().length > 0;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const jobCtx = await fetchJobContextForArtifactEvent(job.id);
      const jobForEvent = { ...job, ...jobCtx };
      const submitTs = new Date().toISOString();

      await emitCloseoutEvent({
        job: jobForEvent,
        user,
        documentationComplete: closeoutFlags.documentationComplete,
        customerSignatureCaptured: closeoutFlags.customerSignatureCaptured,
        runbookComplete: closeoutFlags.runbookComplete,
        requiredFieldsComplete: closeoutFlags.requiredFieldsComplete,
        closeoutSubmitTimestampIso: submitTs,
        timecardSubmittedFlag: timecardSubmitted ? true : null,
        invoiceSupportDocsFlag: invoiceSupportDocs ? true : null,
        portalUpdateFlag: portalUpdated ? true : null,
      });

      if (hasOptionalFeedback) {
        await emitFeedbackEvent({
          job: jobForEvent,
          user,
          ratingValue: feedbackRating > 0 ? feedbackRating : null,
          complaintFlag,
          complimentFlag,
          feedbackNotes: feedbackNotes.trim() || null,
          feedbackSource: 'closeout',
          feedbackTimestampIso: submitTs,
        });
      }

      await emitDispatchEventForJobStatusChange({
        job,
        targetAppStatus: 'submitted',
        user,
      });
      await base44.entities.Job.update(job.id, {
        status: 'submitted',
        closeout_submitted_at: submitTs,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Closeout submitted successfully');
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'Could not submit closeout');
    },
  });

  const CheckItem = ({ label, met, detail }) => (
    <div className="flex items-center gap-3 py-2">
      {met ? (
        <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 flex-shrink-0" />
      ) : (
        <Circle className="h-4.5 w-4.5 text-slate-300 flex-shrink-0" />
      )}
      <div className="flex-1">
        <p className={cn('text-sm', met ? 'text-slate-600' : 'text-slate-900 font-medium')}>{label}</p>
        {detail && <p className="text-xs text-slate-400">{detail}</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-8 w-8 rounded-full bg-purple-50 flex items-center justify-center">
          <FileCheck className="h-4 w-4 text-purple-600" />
        </div>
        <h3 className="font-semibold text-slate-900">Closeout Checklist</h3>
      </div>

      {!canSubmit && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl text-xs text-amber-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>Complete all items below before submitting the closeout package.</span>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Evidence</p>
        {evidenceChecks.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {evidenceChecks.map((c, i) => (
              <CheckItem key={i} label={c.label} met={c.met} detail={`${c.captured}/${c.required} captured`} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-2">No evidence requirements</p>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Runbook</p>
        <CheckItem
          label="All steps completed"
          met={runbookComplete}
          detail={`${completedSteps}/${allSteps.length} steps`}
        />
      </div>

      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Required Fields</p>
        {fieldChecks.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {fieldChecks.map((c, i) => (
              <CheckItem key={i} label={c.label} met={c.met} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-2">No required fields</p>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Sign-Off</p>
        <CheckItem label="Client signature captured" met={hasSignoff} />
      </div>

      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Administrative (optional)</p>
        <p className="text-[11px] text-slate-500 mb-2">
          Check only what applies. Each checked item is sent on the canonical <code className="text-[10px]">closeout_event</code>.
        </p>
        <div className="rounded-xl border border-slate-100 bg-white divide-y divide-slate-50">
          <label className="flex items-center gap-3 py-2.5 px-1 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={timecardSubmitted}
              onChange={(e) => setTimecardSubmitted(e.target.checked)}
              className="rounded border-slate-300"
            />
            Timecard / hours submitted
          </label>
          <label className="flex items-center gap-3 py-2.5 px-1 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={invoiceSupportDocs}
              onChange={(e) => setInvoiceSupportDocs(e.target.checked)}
              className="rounded border-slate-300"
            />
            Invoice support documents attached or uploaded
          </label>
          <label className="flex items-center gap-3 py-2.5 px-1 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={portalUpdated}
              onChange={(e) => setPortalUpdated(e.target.checked)}
              className="rounded border-slate-300"
            />
            Customer / ops portal updated (status or notes)
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-slate-500" />
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Job feedback (optional)</p>
        </div>
        <p className="text-[11px] text-slate-500">Rating and flags are sent as a separate canonical <code className="text-[10px]">feedback_event</code> with closeout.</p>
        <div>
          <p className="text-[10px] font-semibold text-slate-500 mb-1.5">Overall rating</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setFeedbackRating(feedbackRating === n ? 0 : n)}
                className={cn(
                  'h-8 w-8 rounded-lg text-xs font-black border transition-colors',
                  feedbackRating >= n ? 'bg-amber-400 border-amber-500 text-white' : 'bg-white border-slate-200 text-slate-400'
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input type="checkbox" checked={complaintFlag} onChange={(e) => setComplaintFlag(e.target.checked)} className="rounded border-slate-300" />
          Complaint / issue to review
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input type="checkbox" checked={complimentFlag} onChange={(e) => setComplimentFlag(e.target.checked)} className="rounded border-slate-300" />
          Compliment / positive note
        </label>
        <textarea
          value={feedbackNotes}
          onChange={(e) => setFeedbackNotes(e.target.value)}
          placeholder="Optional feedback notes…"
          rows={2}
          className="w-full text-xs rounded-lg border border-slate-200 px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-purple-300"
        />
      </div>

      <Button
        className={cn(
          'w-full rounded-xl h-12',
          canSubmit ? 'bg-purple-600 hover:bg-purple-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
        )}
        disabled={!canSubmit || submitMutation.isPending}
        onClick={() => submitMutation.mutate()}
      >
        {submitMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Send className="h-4 w-4 mr-2" />
        )}
        Submit Closeout
      </Button>
    </div>
  );
}