/**
 * SafetyChecklistModal
 *
 * Two modes:
 *   1. Standalone (embedded=false) — full bottom sheet modal, triggered from QuickActionsBar
 *   2. Embedded (embedded=true) — rendered inline inside RunbookStepModal
 *
 * Items include:
 *   - Standard toggles (tap to confirm)
 *   - HARD_CONFIRM items (LOTO, confined space) — require typing "CONFIRM" or a checkbox with explicit text
 *   - Signature: drawn canvas OR "I confirm" checkbox
 *
 * All-clear gated: every item must be confirmed before CTA unlocks.
 */
import React, { useState, useRef, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, X, PenLine, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const CHECKLIST_ITEMS = [
  { id: 'ppe',       label: 'PPE worn',                       desc: 'Hard hat, hi-vis, gloves, safety glasses',  hard: false },
  { id: 'hazard',    label: 'Site hazard briefing completed',  desc: 'All crew briefed on site-specific hazards', hard: false },
  { id: 'exits',     label: 'Emergency exits identified',      desc: 'Exit routes communicated to all personnel', hard: false },
  { id: 'loto',      label: 'Lock Out / Tag Out (LOTO)',       desc: 'All energy sources isolated and tagged',    hard: true  },
  { id: 'equipment', label: 'Equipment inspected',             desc: 'Ladders, tools, rigging checked for damage',hard: false },
  { id: 'permit',    label: 'Permit to Work obtained',         desc: 'Signed copy on site',                       hard: false },
  { id: 'comms',     label: 'Communication check-in confirmed',desc: 'Supervisor aware of entry / task start',    hard: false },
];

// ── Signature canvas ──────────────────────────────────────────────────
function SignatureCanvas({ onSign }) {
  const canvasRef = useRef(null);
  const drawing   = useRef(false);
  const [signed, setSigned] = useState(false);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const start = (e) => {
    drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getPos(e, canvasRef.current);
    ctx.beginPath();
    ctx.moveTo(x, y);
    e.preventDefault();
  };

  const draw = (e) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const { x, y } = getPos(e, canvasRef.current);
    ctx.lineTo(x, y);
    ctx.stroke();
    e.preventDefault();
  };

  const end = () => {
    drawing.current = false;
    setSigned(true);
    onSign(true);
  };

  const clear = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setSigned(false);
    onSign(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Supervisor / Technician Signature</p>
        {signed && (
          <button onClick={clear} className="flex items-center gap-1 text-xs text-red-500 font-semibold">
            <Trash2 className="h-3 w-3" /> Clear
          </button>
        )}
      </div>
      <div className="relative border-2 border-dashed border-slate-300 rounded-2xl overflow-hidden bg-white" style={{ height: 100 }}>
        <canvas
          ref={canvasRef}
          width={340}
          height={100}
          className="w-full h-full touch-none"
          onMouseDown={start} onMouseMove={draw} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={draw} onTouchEnd={end}
        />
        {!signed && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 text-slate-300">
              <PenLine className="h-4 w-4" />
              <span className="text-sm">Sign here</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Item row ──────────────────────────────────────────────────────────
function CheckItem({ item, checked, onToggle }) {
  const [confirmInput, setConfirmInput] = useState('');
  const needsConfirm = item.hard && !checked;
  const canConfirm = !item.hard || confirmInput.trim().toUpperCase() === 'CONFIRM';

  const handleTap = () => {
    if (item.hard && !checked) return; // hard items use text confirm button
    onToggle();
  };

  return (
    <div className={cn(
      'rounded-2xl border-2 transition-all overflow-hidden',
      checked ? 'border-emerald-300 bg-emerald-50' : item.hard ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-white'
    )}>
      <button
        onClick={handleTap}
        disabled={item.hard && !checked}
        className="w-full flex items-center gap-3 p-3.5 text-left"
        aria-checked={checked} role="checkbox"
      >
        <div className={cn(
          'h-6 w-6 rounded-xl border-2 flex items-center justify-center flex-shrink-0 transition-all',
          checked ? 'bg-emerald-500 border-emerald-500' : item.hard ? 'border-red-300' : 'border-slate-300'
        )}>
          {checked && <svg viewBox="0 0 12 10" className="h-3 w-3 fill-none stroke-white stroke-[2.5]"><polyline points="1,5 4,8 11,1"/></svg>}
          {!checked && item.hard && <AlertTriangle className="h-3 w-3 text-red-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className={cn('text-sm font-bold', checked ? 'text-emerald-800 line-through' : item.hard ? 'text-red-800' : 'text-slate-800')}>
              {item.label}
            </p>
            {item.hard && <span className="text-[9px] font-black text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">CRITICAL</span>}
          </div>
          <p className={cn('text-xs mt-0.5', checked ? 'text-emerald-600' : 'text-slate-400')}>{item.desc}</p>
        </div>
      </button>

      {/* LOTO hard-confirm input */}
      {item.hard && !checked && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-xs text-red-700 font-semibold">
            Type <span className="font-black font-mono bg-red-100 px-1 rounded">CONFIRM</span> to acknowledge this critical safety control:
          </p>
          <div className="flex gap-2">
            <input
              value={confirmInput}
              onChange={e => setConfirmInput(e.target.value)}
              placeholder="Type CONFIRM"
              className="flex-1 h-9 rounded-xl border-2 border-red-200 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
            />
            <button
              onClick={onToggle}
              disabled={!canConfirm}
              className="h-9 px-4 rounded-xl bg-red-600 text-white text-xs font-bold disabled:opacity-40"
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────
export default function SafetyChecklistModal({ embedded = false, stepName, onComplete, onCancel, onClose }) {
  const [checked, setChecked]   = useState({});
  const [signed, setSigned]     = useState(false);
  const [useCheckbox, setUseCheckbox] = useState(false);

  const toggle = (id) => setChecked(p => ({ ...p, [id]: !p[id] }));
  const allChecked = CHECKLIST_ITEMS.every(item => checked[item.id]);
  const canProceed = allChecked && (signed || useCheckbox);
  const remaining = CHECKLIST_ITEMS.filter(item => !checked[item.id]).length;

  const handleComplete = () => {
    if (!canProceed) return;
    toast.success('Safety checklist complete — logged to audit trail');
    (onComplete || onClose)?.();
  };

  const inner = (
    <div className={cn('space-y-4', !embedded && 'pb-2')}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="h-6 w-6 text-orange-600" />
        </div>
        <div>
          <p className="font-black text-slate-900 text-base">Safety Checklist</p>
          {stepName && <p className="text-xs text-slate-500 mt-0.5">{stepName}</p>}
        </div>
        {!embedded && onClose && (
          <button onClick={onClose} className="ml-auto h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center">
            <X className="h-4 w-4 text-slate-600" />
          </button>
        )}
      </div>

      {remaining > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 rounded-xl px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700 font-semibold">{remaining} item{remaining !== 1 ? 's' : ''} remaining before you can proceed</p>
        </div>
      )}

      {/* Items */}
      <div className="space-y-2">
        {CHECKLIST_ITEMS.map(item => (
          <CheckItem key={item.id} item={item} checked={!!checked[item.id]} onToggle={() => toggle(item.id)} />
        ))}
      </div>

      {/* Signature */}
      {allChecked && (
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-700">Sign-off</p>
            <button
              onClick={() => setUseCheckbox(!useCheckbox)}
              className="text-xs text-slate-400 underline"
            >
              {useCheckbox ? 'Use signature instead' : 'Use checkbox instead'}
            </button>
          </div>
          {useCheckbox ? (
            <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-slate-200 cursor-pointer">
              <input type="checkbox" checked={signed} onChange={e => setSigned(e.target.checked)} className="h-5 w-5 rounded" />
              <span className="text-sm text-slate-700 font-medium">
                I confirm all safety checks have been completed and the site is safe to proceed.
              </span>
            </label>
          ) : (
            <SignatureCanvas onSign={setSigned} />
          )}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={handleComplete}
        disabled={!canProceed}
        className={cn(
          'w-full h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all',
          canProceed ? 'bg-emerald-600 text-white active:opacity-80' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
        )}
      >
        <ShieldCheck className="h-5 w-5" />
        {canProceed ? 'All Clear — Proceed' : `${remaining > 0 ? `${remaining} items left` : 'Sign to confirm'}`}
      </button>

      {onCancel && (
        <button onClick={onCancel}
          className="w-full h-11 rounded-2xl border-2 border-slate-200 text-slate-600 font-semibold text-sm"
        >
          Cancel
        </button>
      )}
    </div>
  );

  if (embedded) return inner;

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-3xl max-h-[92vh] overflow-y-auto p-5 pb-10 max-w-lg mx-auto shadow-2xl">
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
        {inner}
      </div>
    </div>
  );
}