import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export default function TaskOverrideModal({ isOpen, onClose, onConfirm, taskTitle }) {
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (!reason.trim()) return;
    onConfirm(reason);
    setReason('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 mt-1">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-base font-black text-slate-900">Override Gate</DialogTitle>
              <p className="text-[12px] text-slate-500 mt-0.5">
                Task: <strong>{taskTitle}</strong>
              </p>
            </div>
          </div>
          <DialogClose className="h-7 w-7 rounded hover:bg-slate-100 flex items-center justify-center">
            <X className="h-4 w-4" />
          </DialogClose>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
            <p className="text-[12px] text-red-700 font-semibold">
              ⚠ Overriding this gate requires a documented reason. This action is audited and may require manager review.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wide mb-2">
              Reason for Override <span className="text-red-600">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Customer request, weather delay, equipment unavailable..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              rows={4}
              maxLength={256}
            />
            <p className="text-[10px] text-slate-400 mt-1">{reason.length}/256 characters</p>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-lg border border-slate-200 text-slate-700 font-semibold text-sm active:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason.trim()}
            className={cn(
              'flex-1 h-10 rounded-lg font-semibold text-sm flex items-center justify-center',
              reason.trim()
                ? 'bg-red-600 text-white active:opacity-90'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            )}
          >
            Override & Continue
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}