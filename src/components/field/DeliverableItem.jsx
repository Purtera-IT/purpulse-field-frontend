/**
 * DeliverableItem — renders one deliverable row inside an expanded task.
 * Types: photo | signature | timestamp | note | field_input | test_result
 * Shows inline Vision QC badges/warnings on photos.
 */
import React, { useState } from 'react';
import {
  Camera, PenLine, Clock, StickyNote, Hash, FlaskConical,
  CheckCircle2, AlertTriangle, XCircle, Upload, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const TYPE_CFG = {
  photo:        { Icon: Camera,      label: 'Photo',        bg: 'bg-slate-100',    iconCls: 'text-slate-500'  },
  signature:    { Icon: PenLine,     label: 'Signature',    bg: 'bg-purple-50',   iconCls: 'text-purple-500' },
  timestamp:    { Icon: Clock,       label: 'Timestamp',    bg: 'bg-blue-50',     iconCls: 'text-blue-500'   },
  note:         { Icon: StickyNote,  label: 'Note',         bg: 'bg-amber-50',    iconCls: 'text-amber-500'  },
  field_input:  { Icon: Hash,        label: 'Measurement',  bg: 'bg-cyan-50',     iconCls: 'text-cyan-600'   },
  test_result:  { Icon: FlaskConical,label: 'Test Result',  bg: 'bg-indigo-50',   iconCls: 'text-indigo-500' },
};

const QC_CFG = {
  qc_pass:    { Icon: CheckCircle2, cls: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'QC Pass'    },
  qc_warning: { Icon: AlertTriangle,cls: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200',     label: 'QC Warning' },
  qc_fail:    { Icon: XCircle,      cls: 'text-red-600',    bg: 'bg-red-50 border-red-200',         label: 'QC Fail'    },
  captured:   { Icon: CheckCircle2, cls: 'text-blue-500',   bg: 'bg-blue-50 border-blue-200',       label: 'Captured'   },
  pending:    { Icon: Upload,       cls: 'text-slate-400',  bg: 'bg-slate-50 border-slate-200',     label: 'Required'   },
};

function QcBadge({ status, score, warning }) {
  const cfg = QC_CFG[status] || QC_CFG.pending;
  const Icon = cfg.Icon;
  return (
    <div className="space-y-1">
      <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold w-fit', cfg.bg, cfg.cls)}>
        <Icon className="h-3 w-3" />
        {cfg.label}
        {score != null && ` · ${score}/100`}
      </div>
      {warning && (
        <p className="text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 leading-snug">
          ⚠ {warning}
        </p>
      )}
    </div>
  );
}

export default function DeliverableItem({ deliverable, onCapture, disabled }) {
  const [inputVal, setInputVal] = useState(deliverable.value || '');
  const [testVal, setTestVal]   = useState(deliverable.test_value || '');
  const [showCapture, setShowCapture] = useState(false);
  const cfg = TYPE_CFG[deliverable.type] || TYPE_CFG.photo;
  const Icon = cfg.Icon;
  const isDone = ['qc_pass', 'qc_warning', 'captured'].includes(deliverable.status);
  const isFail = deliverable.status === 'qc_fail';
  const isPending = deliverable.status === 'pending';

  const handleAction = () => {
    if (disabled) return;
    if (deliverable.type === 'timestamp') {
      onCapture(deliverable.id, { value: new Date().toISOString(), status: 'captured' });
    } else if (deliverable.type === 'field_input' && inputVal.trim()) {
      onCapture(deliverable.id, { value: inputVal, status: 'captured' });
    } else if (deliverable.type === 'test_result' && testVal.trim()) {
      const numVal = parseFloat(testVal);
      const passed = deliverable.test_pass_threshold != null
        ? numVal <= deliverable.test_pass_threshold
        : true;
      onCapture(deliverable.id, { value: testVal, status: passed ? 'qc_pass' : 'qc_fail', qc_score: passed ? 95 : 20 });
    } else if (deliverable.type === 'note' && inputVal.trim()) {
      onCapture(deliverable.id, { value: inputVal, status: 'captured' });
    } else if (['photo', 'signature'].includes(deliverable.type)) {
      onCapture(deliverable.id, { status: 'qc_pass', qc_score: Math.floor(75 + Math.random() * 20) });
    }
  };

  return (
    <div className={cn(
      'rounded-xl border transition-all',
      isDone ? 'border-slate-100 bg-slate-50' : isFail ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'
    )}>
      <div className="flex items-start gap-2.5 p-3">
        {/* Type icon */}
        <div className={cn('h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0', cfg.bg)}>
          <Icon className={cn('h-4 w-4', cfg.iconCls)} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Label + required badge */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <p className={cn('text-xs font-black leading-snug', isDone ? 'text-slate-500' : 'text-slate-800')}>
              {deliverable.label}
            </p>
            {deliverable.required && !isDone && (
              <span className="text-[9px] font-black text-red-600 bg-red-50 px-1.5 rounded border border-red-200">REQUIRED</span>
            )}
            {deliverable.test_spec && (
              <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{deliverable.test_spec}</span>
            )}
          </div>

          {/* Status / QC badge */}
          <QcBadge status={deliverable.status} score={deliverable.qc_score} warning={deliverable.qc_warning} />

          {/* Captured timestamp */}
          {deliverable.captured_at && (
            <p className="text-[10px] text-slate-400 mt-1 font-mono">
              {format(new Date(deliverable.captured_at), 'MMM d HH:mm')}
            </p>
          )}

          {/* Captured value display */}
          {deliverable.value && deliverable.type !== 'timestamp' && (
            <p className="text-xs text-slate-600 mt-1 leading-snug">{deliverable.value}</p>
          )}
          {deliverable.value && deliverable.type === 'timestamp' && (
            <p className="text-[10px] font-mono text-blue-600 mt-1">
              {format(new Date(deliverable.value), 'MMM d, yyyy HH:mm:ss')}
            </p>
          )}
        </div>

        {/* Action button (right side) */}
        {!isDone && !disabled && (
          <div className="flex-shrink-0">
            {deliverable.type === 'timestamp' && (
              <button
                onClick={handleAction}
                className="h-8 px-3 rounded-lg bg-blue-600 text-white text-[11px] font-bold active:opacity-80"
              >
                Stamp
              </button>
            )}
            {['photo', 'signature'].includes(deliverable.type) && (
              <button
                onClick={handleAction}
                className="h-8 px-3 rounded-lg bg-slate-900 text-white text-[11px] font-bold active:opacity-80 flex items-center gap-1"
              >
                <Camera className="h-3 w-3" />
                {deliverable.type === 'signature' ? 'Sign' : 'Capture'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Inline input for field_input, note, test_result */}
      {!isDone && !disabled && ['field_input', 'note', 'test_result'].includes(deliverable.type) && (
        <div className="px-3 pb-3 flex gap-2">
          {deliverable.type === 'note' ? (
            <textarea
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder="Enter note…"
              rows={2}
              className="flex-1 rounded-xl border border-slate-200 px-2.5 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          ) : (
            <input
              type={deliverable.field_type === 'number' ? 'number' : 'text'}
              value={deliverable.type === 'test_result' ? testVal : inputVal}
              onChange={e => deliverable.type === 'test_result' ? setTestVal(e.target.value) : setInputVal(e.target.value)}
              placeholder={deliverable.type === 'test_result'
                ? `Enter measured value…`
                : `Enter ${deliverable.field_unit || 'value'}…`}
              className="flex-1 h-9 rounded-xl border border-slate-200 px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          )}
          <button
            onClick={handleAction}
            disabled={!(deliverable.type === 'test_result' ? testVal.trim() : inputVal.trim())}
            className="h-9 px-3 rounded-xl bg-slate-900 text-white text-[11px] font-bold disabled:opacity-30 active:opacity-80 flex-shrink-0"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}