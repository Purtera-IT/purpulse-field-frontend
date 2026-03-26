/**
 * Pre-job readiness checklist before moving to in progress.
 * Blocks confirm until items are checked; queues tool-check telemetry before parent continues.
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
import { FIELD_CARD, FIELD_META, FIELD_OVERLINE, FIELD_SURFACE_MUTED } from '@/lib/fieldVisualTokens';
import { cn } from '@/lib/utils';

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
      <DialogContent
        className="max-w-md rounded-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center">
              <ClipboardCheck className="h-4 w-4 text-blue-600" />
            </div>
            <DialogTitle className="text-left">Pre-job readiness</DialogTitle>
          </div>
          <DialogDescription className="text-left text-xs leading-relaxed">
            Part of the same readiness path as route confirmation and starting the work timer. Complete checks below to
            continue, or exit with Cancel or the X — the backdrop won&apos;t close this by accident.
          </DialogDescription>
          <p className={cn(FIELD_META, 'text-left leading-snug -mt-1')}>
            Leaving without confirming keeps the job in its current state.
          </p>
        </DialogHeader>

        <div className={cn(FIELD_SURFACE_MUTED, 'p-3 space-y-2')}>
          <div className={cn('flex items-center gap-1.5', FIELD_OVERLINE)}>
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

        <div className={cn(FIELD_CARD, 'p-3 space-y-2')}>
          <p className={FIELD_OVERLINE}>Scope &amp; documentation</p>
          <p className="text-[10px] text-slate-500 leading-snug">
            Confirm scope and documentation match what you will perform on site. This is recorded when you confirm below.
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

        <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl w-full sm:w-auto"
            onClick={() => handleOpenChange(false)}
            disabled={pending}
          >
            Cancel — not ready yet
          </Button>
          <Button
            type="button"
            className="rounded-xl bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
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
