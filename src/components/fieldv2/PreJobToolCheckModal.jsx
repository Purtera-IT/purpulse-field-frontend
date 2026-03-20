/**
 * Pre-job readiness checklist (Iteration 10).
 * Blocks "Start Job" until all items are checked; emits tool_check_event before parent continues.
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { emitToolCheckEvent } from '@/lib/toolCheckEvent';
import {
  SCOPE_ACKNOWLEDGEMENT_ITEMS,
  allScopeAcknowledgementsTrue,
  emptyScopeAcknowledgementState,
} from '@/constants/scopeAcknowledgements';

const ITEMS = [
  { key: 'ppe', label: 'PPE appropriate for this site / task is available and in use' },
  { key: 'tools', label: 'Essential tools and test gear for this work order are present' },
  { key: 'bom', label: 'BOM / scope / runbook instructions have been reviewed' },
  { key: 'safety', label: 'Site hazards & safety expectations are understood (JSA if required)' },
];

/**
 * @param {Object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {Record<string, unknown>} props.job
 * @param {Record<string, unknown> | null} props.user
 * @param {() => void} props.onPassed — called after successful telemetry enqueue (parent starts job)
 */
export default function PreJobToolCheckModal({ open, onOpenChange, job, user, onPassed }) {
  const [ppe, setPpe] = useState(false);
  const [tools, setTools] = useState(false);
  const [bom, setBom] = useState(false);
  const [safety, setSafety] = useState(false);
  const [scopeAck, setScopeAck] = useState(() => emptyScopeAcknowledgementState());
  const [pending, setPending] = useState(false);

  const setters = { ppe: setPpe, tools: setTools, bom: setBom, safety: setSafety };
  const values = { ppe, tools, bom, safety };
  const allChecked = ppe && tools && bom && safety;
  const scopeOk = allScopeAcknowledgementsTrue(scopeAck);
  const allReady = allChecked && scopeOk;

  const reset = () => {
    setPpe(false);
    setTools(false);
    setBom(false);
    setSafety(false);
    setScopeAck(emptyScopeAcknowledgementState());
  };

  const handleOpenChange = (next) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    if (!allReady) {
      toast.error('Confirm all readiness and scope items before starting the job.');
      return;
    }
    setPending(true);
    try {
      await emitToolCheckEvent({
        job,
        user,
        ppeCompliant: ppe,
        essentialToolsReady: tools,
        bomDocsReviewed: bom,
        siteSafetyAck: safety,
        scopeAcknowledgements: scopeAck,
      });
      onPassed?.();
      handleOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not queue tool check telemetry');
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center">
              <ClipboardCheck className="h-4 w-4 text-blue-600" />
            </div>
            <DialogTitle className="text-left">Pre-job readiness</DialogTitle>
          </div>
          <DialogDescription className="text-left text-xs leading-relaxed">
            Complete the checklist to start work. A canonical <code className="text-[10px]">tool_check_event</code> is sent
            for compliance and eligibility signals.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
            <Shield className="h-3 w-3" /> Job: {job?.title || job?.external_id || job?.id}
          </div>
          {ITEMS.map((item) => (
            <label
              key={item.key}
              className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer py-1.5"
            >
              <input
                type="checkbox"
                checked={values[item.key]}
                onChange={(e) => setters[item.key](e.target.checked)}
                className="mt-0.5 rounded border-slate-300"
              />
              <span className="leading-snug">{item.label}</span>
            </label>
          ))}
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-3 space-y-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Scope &amp; docs (Iteration 11)</p>
          <p className="text-[10px] text-slate-500 leading-snug">
            Same signals as pre-arrival <code className="text-[9px]">arrival_event</code> flags — recorded on this{' '}
            <code className="text-[9px]">tool_check_event</code> when you start from overview/state machine.
          </p>
          {SCOPE_ACKNOWLEDGEMENT_ITEMS.map((item) => (
            <label
              key={item.key}
              className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer py-1"
            >
              <input
                type="checkbox"
                checked={scopeAck[item.key]}
                onChange={() => setScopeAck((s) => ({ ...s, [item.key]: !s[item.key] }))}
                className="mt-0.5 rounded border-slate-300"
              />
              <span className="leading-snug">{item.label}</span>
            </label>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => handleOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-xl bg-blue-600 hover:bg-blue-700"
            disabled={!allReady || pending}
            onClick={() => void handleConfirm()}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Confirm &amp; start job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
