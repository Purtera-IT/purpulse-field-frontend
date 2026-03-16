/**
 * EvidenceTile
 * All 6 evidence states with distinct visual treatments:
 *   uploading | uploaded | processing | qc_ok | qc_warning | qc_failed
 *
 * QC scoring thresholds:
 *   blur_score < 40          → qc_failed  (too blurry)
 *   blur_score 40–65         → qc_warning (marginal)
 *   blur_score > 65          → ok
 *   face_detected && !redacted → qc_warning
 *   gps_drift > 150m         → qc_warning flag
 *   no_gps                   → qc_warning flag
 */
import React from 'react';
import {
  CheckCircle2, AlertTriangle, Clock, RefreshCw,
  Cpu, XCircle, Camera, EyeOff
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── QC config ────────────────────────────────────────────────────────
export const QC_CFG = {
  qc_ok: {
    label: 'QC OK', short: '✓',
    ring: 'ring-emerald-400', dot: 'bg-emerald-500',
    text: 'text-emerald-600', bg: 'bg-emerald-50',
    tooltip: 'Passed all quality checks: sharpness, GPS, face redaction.',
  },
  qc_warning: {
    label: 'QC Warning', short: '!',
    ring: 'ring-amber-400', dot: 'bg-amber-500',
    text: 'text-amber-600', bg: 'bg-amber-50',
    tooltip: 'Passed with warnings. Review: low blur score, GPS drift, or unredacted face.',
  },
  qc_failed: {
    label: 'QC Failed', short: '✕',
    ring: 'ring-red-400', dot: 'bg-red-500',
    text: 'text-red-600', bg: 'bg-red-50',
    tooltip: 'Failed QC. Likely causes: image too blurry (score < 40), missing GPS, or mandatory face not redacted.',
  },
  processing: {
    label: 'Processing', short: '…',
    ring: 'ring-purple-300', dot: 'bg-purple-500',
    text: 'text-purple-600', bg: 'bg-purple-50',
    tooltip: 'Server processing: OCR, face detection, blur scoring in progress.',
  },
  uploading: {
    label: 'Uploading', short: '↑',
    ring: 'ring-blue-300', dot: 'bg-blue-500',
    text: 'text-blue-600', bg: 'bg-blue-50',
    tooltip: 'Uploading to server…',
  },
  uploaded: {
    label: 'Uploaded', short: '↑',
    ring: 'ring-slate-300', dot: 'bg-slate-400',
    text: 'text-slate-500', bg: 'bg-slate-50',
    tooltip: 'Upload complete. Queued for server processing.',
  },
  pending_upload: {
    label: 'Pending', short: '…',
    ring: 'ring-slate-200', dot: 'bg-slate-300',
    text: 'text-slate-400', bg: 'bg-slate-50',
    tooltip: 'Waiting to upload.',
  },
  error: {
    label: 'Error', short: '!',
    ring: 'ring-red-300', dot: 'bg-red-400',
    text: 'text-red-500', bg: 'bg-red-50',
    tooltip: 'Upload or processing error.',
  },
};

/** Derive the display state from evidence item fields */
export function resolveState(item) {
  if (item.qc_status === 'passed') return 'qc_ok';
  if (item.qc_status === 'failed') {
    // distinguish warning vs hard fail
    const blurOk = !item.quality_score || item.quality_score >= 40;
    return blurOk ? 'qc_warning' : 'qc_failed';
  }
  if (item.status === 'uploading') return 'uploading';
  if (item.status === 'uploaded') return 'uploaded';
  if (item.status === 'pending_upload') return 'pending_upload';
  if (item.status === 'error') return 'error';
  // infer processing from qc pending + uploaded
  if (item.status === 'uploaded' && !item.qc_status) return 'processing';
  return 'uploaded';
}

// ── State overlays ────────────────────────────────────────────────────
function StateOverlay({ state }) {
  if (state === 'uploading') return (
    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1">
      <RefreshCw className="h-5 w-5 text-white animate-spin" />
      <span className="text-white text-[9px] font-bold">UPLOADING</span>
    </div>
  );
  if (state === 'processing') return (
    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1">
      <Cpu className="h-5 w-5 text-purple-300 animate-pulse" />
      <span className="text-purple-200 text-[9px] font-bold">PROCESSING</span>
    </div>
  );
  return null;
}

// ── QC badge (bottom-left) ────────────────────────────────────────────
function QcDot({ state, showFaceFlag }) {
  const cfg = QC_CFG[state] || QC_CFG.uploaded;
  return (
    <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5">
      <div className={cn('h-4 w-4 rounded-full flex items-center justify-center', cfg.dot)}>
        <span className="text-white text-[9px] font-black leading-none">{cfg.short}</span>
      </div>
      {showFaceFlag && (
        <div className="h-4 w-4 rounded-full bg-orange-500 flex items-center justify-center" title="Face detected">
          <EyeOff className="h-2.5 w-2.5 text-white" />
        </div>
      )}
    </div>
  );
}

// ── Main Tile ─────────────────────────────────────────────────────────
export default function EvidenceTile({ item, size = 88, onTap, className }) {
  const state = resolveState(item);
  const cfg   = QC_CFG[state] || QC_CFG.uploaded;
  const showFaceFlag = item.face_detected && !item.face_redacted;

  return (
    <button
      onClick={() => onTap?.(item)}
      style={{ width: size, height: size, flexShrink: 0 }}
      className={cn(
        'relative rounded-2xl overflow-hidden bg-slate-100 active:scale-95 transition-transform',
        (state === 'qc_ok' || state === 'qc_warning' || state === 'qc_failed') && `ring-2 ${cfg.ring}`,
        className
      )}
      aria-label={`${item.evidence_type?.replace(/_/g,' ')} – ${cfg.label}`}
    >
      {/* Image */}
      {item.file_url || item.thumbnail_url ? (
        <img
          src={item.thumbnail_url || item.file_url}
          alt={item.evidence_type}
          className={cn('w-full h-full object-cover', item.face_redacted && 'blur-[3px]')}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Camera className="h-7 w-7 text-slate-300" />
        </div>
      )}

      {/* State overlay (uploading / processing) */}
      <StateOverlay state={state} />

      {/* Type chip */}
      <div className="absolute top-0 left-0 right-0 px-1 pt-1">
        <span className="block text-center text-[9px] font-semibold text-white bg-black/50 rounded px-1 truncate leading-4">
          {item.evidence_type?.replace(/_/g,' ')}
        </span>
      </div>

      {/* QC dot */}
      <QcDot state={state} showFaceFlag={showFaceFlag} />

      {/* Redacted badge */}
      {item.face_redacted && (
        <div className="absolute top-1 right-1 bg-orange-500 rounded-full p-0.5">
          <EyeOff className="h-2.5 w-2.5 text-white" />
        </div>
      )}
    </button>
  );
}

/** Inline QC badge — use in list rows, detail headers, admin table */
export function QcBadge({ state, showTooltip = false, className }) {
  const cfg = QC_CFG[state] || QC_CFG.uploaded;
  return (
    <span
      title={showTooltip ? cfg.tooltip : undefined}
      className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold', cfg.bg, cfg.text, className)}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
}