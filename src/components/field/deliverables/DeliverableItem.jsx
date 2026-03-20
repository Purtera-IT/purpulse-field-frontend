/**
 * DeliverableItem — full deliverable capture + display row.
 *
 * Types handled:
 *   photo       — mock capture, inline QC, retake option
 *   signature   — canvas SignaturePad, preview, retake
 *   timestamp   — tap-to-stamp, displays formatted time
 *   note        — textarea, edit after capture
 *   field_input — text/number inline input
 *   test_result — numeric input, auto pass/fail vs spec threshold
 *
 * QC states: pending | qc_pass | qc_warning | qc_fail | captured
 */
import React, { useState } from 'react';
import {
  Camera, PenLine, Clock, StickyNote, Hash, FlaskConical,
  RotateCcw, CheckCircle2, ChevronDown, ChevronUp, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import QcBadge from './QcBadge';
import SignaturePad from './SignaturePad';

// ── Type config ───────────────────────────────────────────────────────
const TYPE_CFG = {
  photo:       { Icon: Camera,       label: 'Photo',        bg: 'bg-slate-100',  iconCls: 'text-slate-600'  },
  signature:   { Icon: PenLine,      label: 'Signature',    bg: 'bg-purple-50',  iconCls: 'text-purple-600' },
  timestamp:   { Icon: Clock,        label: 'Timestamp',    bg: 'bg-blue-50',    iconCls: 'text-blue-600'   },
  note:        { Icon: StickyNote,   label: 'Note',         bg: 'bg-amber-50',   iconCls: 'text-amber-600'  },
  field_input: { Icon: Hash,         label: 'Measurement',  bg: 'bg-cyan-50',    iconCls: 'text-cyan-700'   },
  test_result: { Icon: FlaskConical, label: 'Test Result',  bg: 'bg-indigo-50',  iconCls: 'text-indigo-600' },
};

// ── Simulated photo capture (mock) ────────────────────────────────────
function simulateCapture(deliverable) {
  // 20% chance blurry warning, 10% chance no-GPS warning, 5% hard fail
  const roll = Math.random();
  if (roll < 0.05) {
    return { status: 'qc_fail', qc_score: 18, qc_warning: null, geo_lat: null, geo_lon: null };
  } else if (roll < 0.18) {
    return {
      status: 'qc_warning', qc_score: 47,
      qc_warning: 'Image is slightly blurry — retake recommended for compliance',
      geo_lat: 37.7749, geo_lon: -122.4194, gps_accuracy: 6,
    };
  } else if (roll < 0.28) {
    return {
      status: 'qc_warning', qc_score: 82,
      qc_warning: 'Low GPS confidence — photo may not be correctly geo-tagged',
      geo_lat: 37.7749, geo_lon: -122.4194, gps_accuracy: 65,
    };
  } else {
    return {
      status: 'qc_pass', qc_score: Math.floor(78 + Math.random() * 18),
      geo_lat: 37.7749, geo_lon: -122.4194, gps_accuracy: Math.floor(4 + Math.random() * 10),
    };
  }
}

// ── Photo preview thumbnail ───────────────────────────────────────────
function PhotoPreview({ deliverable, onRetake, disabled }) {
  const [showDetail, setShowDetail] = useState(false);
  const needsRetake = deliverable.status === 'qc_fail' || deliverable.status === 'qc_warning';

  return (
    <div className="space-y-2">
      {/* Simulated photo placeholder */}
      <div className={cn(
        'w-full h-28 rounded-xl border-2 overflow-hidden relative',
        deliverable.status === 'qc_fail'    ? 'border-red-300'    :
        deliverable.status === 'qc_warning' ? 'border-amber-300'  : 'border-emerald-200'
      )}>
        <div className={cn(
          'w-full h-full flex items-center justify-center',
          deliverable.status === 'qc_fail'    ? 'bg-red-50'     :
          deliverable.status === 'qc_warning' ? 'bg-amber-50'   : 'bg-slate-100'
        )}>
          <div className="text-center">
            <Camera className={cn('h-8 w-8 mx-auto mb-1',
              deliverable.status === 'qc_fail'    ? 'text-red-300'    :
              deliverable.status === 'qc_warning' ? 'text-amber-400'  : 'text-slate-300'
            )} />
            <p className="text-[10px] text-slate-400">
              {deliverable.status === 'qc_fail' ? 'Photo failed QC' :
               deliverable.status === 'qc_warning' ? 'Review required' : 'Captured'}
            </p>
          </div>
        </div>

        {/* Top-right score chip overlay */}
        {deliverable.qc_score != null && (
          <div className={cn(
            'absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[10px] font-black',
            deliverable.qc_score >= 70 ? 'bg-emerald-500 text-white' :
            deliverable.qc_score >= 45 ? 'bg-amber-500 text-white'   : 'bg-red-500 text-white'
          )}>
            {deliverable.qc_score}
          </div>
        )}
      </div>

      {/* QC detail toggle */}
      <button onClick={() => setShowDetail(v => !v)}
        className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
        <Eye className="h-3 w-3" />
        {showDetail ? 'Hide' : 'Show'} QC detail
        {showDetail ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
      </button>

      {showDetail && (
        <QcBadge
          status={deliverable.status}
          score={deliverable.qc_score}
          warning={deliverable.qc_warning}
          gps_accuracy={deliverable.gps_accuracy}
          geo_lat={deliverable.geo_lat}
          geo_lon={deliverable.geo_lon}
          showDetail
        />
      )}

      {!showDetail && (
        <QcBadge
          status={deliverable.status}
          score={deliverable.qc_score}
          warning={deliverable.qc_warning}
          gps_accuracy={deliverable.gps_accuracy}
          geo_lat={deliverable.geo_lat}
          geo_lon={deliverable.geo_lon}
          showDetail={false}
        />
      )}

      {needsRetake && !disabled && (
        <button
          onClick={onRetake}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-amber-600 text-white text-[11px] font-bold active:opacity-80 w-fit"
        >
          <RotateCcw className="h-3 w-3" /> Retake
        </button>
      )}
    </div>
  );
}

// ── Signature preview ──────────────────────────────────────────────────
function SignaturePreview({ dataUrl, onRetake, disabled }) {
  return (
    <div className="space-y-2">
      <div className="rounded-xl border-2 border-emerald-200 bg-white overflow-hidden">
        <img src={dataUrl} alt="Signature" className="w-full h-20 object-contain p-2" />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 font-bold">
          <CheckCircle2 className="h-3 w-3" /> Signed
        </div>
        {!disabled && (
          <button onClick={onRetake}
            className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold h-7 px-2 rounded-lg border border-slate-200 active:bg-slate-50">
            <RotateCcw className="h-2.5 w-2.5" /> Re-sign
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────
export default function DeliverableItem({ deliverable: initialDeliverable, onCapture, disabled }) {
  const [deliverable, setDeliverable] = useState(initialDeliverable);
  const [inputVal,    setInputVal]    = useState(initialDeliverable.value || '');
  const [testVal,     setTestVal]     = useState('');
  const [showSigPad,  setShowSigPad]  = useState(false);
  const [editing,     setEditing]     = useState(false);

  const cfg = TYPE_CFG[deliverable.type] || TYPE_CFG.photo;
  const Icon = cfg.Icon;

  const isDone     = ['qc_pass', 'qc_warning', 'captured'].includes(deliverable.status);
  const isFail     = deliverable.status === 'qc_fail';
  const isPending  = !isDone && !isFail;

  const commit = (data) => {
    const next = { ...deliverable, ...data, captured_at: new Date().toISOString() };
    setDeliverable(next);
    onCapture?.(deliverable.id, data);
  };

  const handlePhotoCapture = () => {
    const qc = simulateCapture(deliverable);
    commit({ ...qc, captured_at: new Date().toISOString() });
  };

  const handleRetake = () => {
    setDeliverable(prev => ({ ...prev, status: 'pending', qc_score: null, qc_warning: null, geo_lat: null }));
  };

  const handleTimestamp = () => {
    commit({ value: new Date().toISOString(), status: 'captured' });
  };

  const handleTextSave = () => {
    if (!inputVal.trim()) return;
    commit({ value: inputVal, status: 'captured' });
    setEditing(false);
  };

  const handleTestSave = () => {
    if (!testVal.trim()) return;
    const numVal = parseFloat(testVal);
    const passed = deliverable.test_pass_threshold != null
      ? numVal <= deliverable.test_pass_threshold
      : true;
    commit({
      value: `${testVal}${deliverable.field_unit ? ` ${deliverable.field_unit}` : ''}`,
      status: passed ? 'qc_pass' : 'qc_fail',
      qc_score: passed ? 96 : 15,
      qc_warning: passed ? null : `Value ${numVal} exceeds threshold (${deliverable.test_pass_threshold})`,
    });
  };

  const handleSign = (dataUrl) => {
    setShowSigPad(false);
    commit({ signature_url: dataUrl, status: 'qc_pass', qc_score: 99 });
  };

  // ── Outer container ───────────────────────────────────────────────
  return (
    <div className={cn(
      'rounded-2xl border transition-all overflow-hidden',
      isFail        ? 'border-red-200 bg-red-50/60'     :
      isDone        ? 'border-slate-100 bg-slate-50/80'  :
      deliverable.required ? 'border-orange-200 bg-orange-50/40' : 'border-slate-100 bg-white'
    )}>
      <div className="p-3 space-y-2.5">

        {/* ── Header row ─────────────────────────────────── */}
        <div className="flex items-start gap-2.5">
          <div className={cn('h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0', cfg.bg)}>
            <Icon className={cn('h-4 w-4', cfg.iconCls)} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className={cn('text-xs font-black leading-snug',
                isDone ? 'text-slate-500' : 'text-slate-900'
              )}>
                {deliverable.label}
              </p>
              {deliverable.required
                ? isDone
                  ? <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 rounded border border-emerald-200">✓ REQUIRED</span>
                  : <span className="text-[9px] font-black text-red-600 bg-red-50 px-1.5 rounded border border-red-200">REQUIRED</span>
                : <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 rounded border border-slate-200">optional</span>
              }
              {deliverable.test_spec && (
                <span className="text-[9px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                  spec: {deliverable.test_spec}
                </span>
              )}
            </div>

            {deliverable.captured_at && (
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                {format(new Date(deliverable.captured_at), 'MMM d, HH:mm:ss')}
              </p>
            )}
          </div>

          {/* Quick action button (right-aligned for tap-targets) */}
          {!disabled && (
            <div className="flex-shrink-0">
              {deliverable.type === 'photo' && isPending && (
                <button onClick={handlePhotoCapture}
                  className="h-9 px-3.5 rounded-xl bg-slate-900 text-white text-[11px] font-bold active:opacity-80 flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5" /> Capture
                </button>
              )}
              {deliverable.type === 'signature' && isPending && !showSigPad && (
                <button onClick={() => setShowSigPad(true)}
                  className="h-9 px-3.5 rounded-xl bg-purple-700 text-white text-[11px] font-bold active:opacity-80 flex items-center gap-1.5">
                  <PenLine className="h-3.5 w-3.5" /> Sign
                </button>
              )}
              {deliverable.type === 'timestamp' && isPending && (
                <button onClick={handleTimestamp}
                  className="h-9 px-3.5 rounded-xl bg-blue-600 text-white text-[11px] font-bold active:opacity-80 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Stamp
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Photo content ─────────────────────────────── */}
        {deliverable.type === 'photo' && isDone && (
          <PhotoPreview deliverable={deliverable} onRetake={handleRetake} disabled={disabled} />
        )}
        {deliverable.type === 'photo' && isFail && (
          <PhotoPreview deliverable={deliverable} onRetake={handleRetake} disabled={disabled} />
        )}

        {/* ── Signature capture / preview ───────────────── */}
        {deliverable.type === 'signature' && showSigPad && !disabled && (
          <SignaturePad onSign={handleSign} onCancel={() => setShowSigPad(false)} />
        )}
        {deliverable.type === 'signature' && deliverable.signature_url && (
          <SignaturePreview
            dataUrl={deliverable.signature_url}
            onRetake={() => { setDeliverable(prev => ({ ...prev, status: 'pending', signature_url: null })); }}
            disabled={disabled}
          />
        )}
        {deliverable.type === 'signature' && !deliverable.signature_url && !showSigPad && (
          <QcBadge
            status={deliverable.status}
            warning={deliverable.required ? 'Signature not yet captured — required to complete task' : null}
          />
        )}

        {/* ── Timestamp captured ────────────────────────── */}
        {deliverable.type === 'timestamp' && deliverable.value && (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl border border-blue-200">
            <Clock className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
            <p className="text-xs font-mono font-bold text-blue-700">
              {format(new Date(deliverable.value), "EEEE, MMM d yyyy 'at' HH:mm:ss")}
            </p>
          </div>
        )}
        {deliverable.type === 'timestamp' && !deliverable.value && (
          <div className={cn(
            'flex items-start gap-2 px-3 py-2 rounded-xl border',
            deliverable.required ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200'
          )}>
            <Clock className={cn('h-3.5 w-3.5 flex-shrink-0 mt-0.5', deliverable.required ? 'text-orange-500' : 'text-slate-400')} />
            <p className={cn('text-[11px] font-semibold', deliverable.required ? 'text-orange-800' : 'text-slate-500')}>
              {deliverable.required ? 'Timestamp required — tap Stamp to record current time' : 'Optional — tap Stamp to record'}
            </p>
          </div>
        )}

        {/* ── Note / field_input ────────────────────────── */}
        {['note', 'field_input'].includes(deliverable.type) && (
          <>
            {(isDone && !editing) ? (
              <div className="flex items-start gap-2 justify-between">
                <p className="text-xs text-slate-700 leading-relaxed flex-1">{deliverable.value}</p>
                {!disabled && (
                  <button onClick={() => setEditing(true)}
                    className="text-[10px] text-slate-400 font-semibold flex-shrink-0 active:text-slate-700">
                    Edit
                  </button>
                )}
              </div>
            ) : !disabled ? (
              <div className="flex gap-2">
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
                    value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    placeholder={`Enter ${deliverable.field_unit || 'value'}…`}
                    className="flex-1 h-9 rounded-xl border border-slate-200 px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                )}
                <button
                  onClick={handleTextSave}
                  disabled={!inputVal.trim()}
                  className="h-9 px-3 rounded-xl bg-slate-900 text-white text-[11px] font-bold disabled:opacity-30 active:opacity-80 self-end flex-shrink-0"
                >
                  Save
                </button>
              </div>
            ) : null}
            {!isDone && !editing && (
              <QcBadge status="pending" warning={deliverable.required ? 'This field is required' : null} />
            )}
          </>
        )}

        {/* ── Test result ──────────────────────────────── */}
        {deliverable.type === 'test_result' && (
          <>
            {isDone || isFail ? (
              <div className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl border',
                isFail ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'
              )}>
                <FlaskConical className={cn('h-4 w-4 flex-shrink-0', isFail ? 'text-red-500' : 'text-emerald-500')} />
                <div className="flex-1">
                  <p className={cn('text-xs font-black', isFail ? 'text-red-700' : 'text-emerald-700')}>
                    {deliverable.value}
                  </p>
                  <p className="text-[10px] text-slate-400">measured vs spec: {deliverable.test_spec}</p>
                </div>
                {isFail && !disabled && (
                  <button onClick={() => setDeliverable(prev => ({ ...prev, status: 'pending', value: null }))}
                    className="text-[10px] font-bold text-red-600 flex items-center gap-1 h-7 px-2 rounded-lg border border-red-200 bg-white active:bg-red-50">
                    <RotateCcw className="h-2.5 w-2.5" /> Retry
                  </button>
                )}
              </div>
            ) : !disabled ? (
              <div className="flex gap-2">
                <input
                  type="number"
                  value={testVal}
                  onChange={e => setTestVal(e.target.value)}
                  placeholder="Enter measured value…"
                  className="flex-1 h-9 rounded-xl border border-slate-200 px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <button
                  onClick={handleTestSave}
                  disabled={!testVal.trim()}
                  className="h-9 px-3 rounded-xl bg-indigo-700 text-white text-[11px] font-bold disabled:opacity-30 active:opacity-80 flex-shrink-0"
                >
                  Record
                </button>
              </div>
            ) : null}
            {isPending && !isFail && !disabled && (
              <QcBadge status="pending" warning={deliverable.required ? 'Test result required to complete task' : null} />
            )}
            {isFail && (
              <QcBadge status="qc_fail" warning={deliverable.qc_warning} />
            )}
          </>
        )}

      </div>
    </div>
  );
}