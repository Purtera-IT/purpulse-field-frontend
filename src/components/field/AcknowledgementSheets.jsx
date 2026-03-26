/**
 * Pre-arrival scope and ETA acknowledgement sheets (canonical field / timer flows).
 */
import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Loader2, ClipboardList, Route } from 'lucide-react';
import {
  SCOPE_ACKNOWLEDGEMENT_ITEMS,
  allScopeAcknowledgementsTrue,
  emptyScopeAcknowledgementState,
} from '@/constants/scopeAcknowledgements';

/**
 * Scope/readiness flags before starting the work timer or equivalent flows.
 * @param {Object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {string} [props.jobLabel]
 * @param {(ackState: Record<string, boolean>) => void} props.onConfirm
 */
export function PreArrivalAckSheet({ open, onOpenChange, jobLabel, onConfirm }) {
  const [state, setState] = useState(() => emptyScopeAcknowledgementState());
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) setState(emptyScopeAcknowledgementState());
  }, [open]);

  const allOk = allScopeAcknowledgementsTrue(state);

  const handleConfirm = async () => {
    if (!allOk) return;
    setPending(true);
    try {
      onConfirm?.(state);
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="text-left space-y-2 pb-2">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-purple-50 flex items-center justify-center">
              <ClipboardList className="h-4 w-4 text-purple-600" />
            </div>
            <SheetTitle className="text-base">Before you arrive</SheetTitle>
          </div>
          <SheetDescription className="text-xs text-left leading-relaxed">
            Confirm you have reviewed scope, risks, and site constraints before time starts on this job.
            {jobLabel ? <span className="block mt-1 font-semibold text-slate-700">{jobLabel}</span> : null}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-2 py-2">
          {SCOPE_ACKNOWLEDGEMENT_ITEMS.map((item) => (
            <label
              key={item.key}
              className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer py-1.5 px-1 rounded-lg hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={state[item.key]}
                onChange={() => setState((s) => ({ ...s, [item.key]: !s[item.key] }))}
                className="mt-0.5 rounded border-slate-300"
              />
              <span className="leading-snug">{item.label}</span>
            </label>
          ))}
        </div>

        <SheetFooter className="flex-col sm:flex-col gap-2 pt-2">
          <Button
            className="w-full rounded-xl bg-purple-600 hover:bg-purple-700"
            disabled={!allOk || pending}
            onClick={() => void handleConfirm()}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Confirm &amp; continue
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * ETA / route acknowledgement before marking en route.
 */
export function EtaAcknowledgementSheet({
  open,
  onOpenChange,
  jobLabel,
  title = 'Acknowledge travel',
  description = 'Confirm you have reviewed the planned route and on-site ETA before starting travel.',
  onConfirm,
}) {
  const [ack, setAck] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) setAck(false);
  }, [open]);

  const handleConfirm = async () => {
    if (!ack) return;
    setPending(true);
    try {
      const ts = new Date().toISOString();
      onConfirm?.(ts);
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="text-left space-y-2 pb-2">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-cyan-50 flex items-center justify-center">
              <Route className="h-4 w-4 text-cyan-600" />
            </div>
            <SheetTitle className="text-base">{title}</SheetTitle>
          </div>
          <SheetDescription className="text-xs text-left leading-relaxed">
            {description}
            <span className="block mt-2 text-slate-600">
              First of three readiness steps on this job: route, then start work, then the work timer.
            </span>
            {jobLabel ? <span className="block mt-2 font-semibold text-slate-700">{jobLabel}</span> : null}
          </SheetDescription>
        </SheetHeader>

        <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer py-3">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            className="mt-0.5 rounded border-slate-300"
          />
          <span className="leading-snug">
            I have reviewed the planned arrival time and route expectations for this job.
          </span>
        </label>

        <SheetFooter className="flex-col sm:flex-col gap-2 pt-2">
          <Button
            className="w-full rounded-xl bg-cyan-600 hover:bg-cyan-700"
            disabled={!ack || pending}
            onClick={() => void handleConfirm()}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Start travel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
