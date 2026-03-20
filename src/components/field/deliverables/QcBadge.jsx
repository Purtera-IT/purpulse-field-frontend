/**
 * QcBadge — inline vision QC status badge + warning detail.
 * Used on photo and signature deliverables.
 */
import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Upload, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

export const QC_CFG = {
  qc_pass:    { Icon: CheckCircle2, cls: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-200', label: 'QC Pass'    },
  qc_warning: { Icon: AlertTriangle,cls: 'text-amber-600',  bg: 'bg-amber-50',    border: 'border-amber-200',   label: 'QC Warning' },
  qc_fail:    { Icon: XCircle,      cls: 'text-red-600',    bg: 'bg-red-50',      border: 'border-red-200',     label: 'QC Fail'    },
  captured:   { Icon: CheckCircle2, cls: 'text-blue-500',   bg: 'bg-blue-50',     border: 'border-blue-200',    label: 'Captured'   },
  pending:    { Icon: Upload,       cls: 'text-slate-400',  bg: 'bg-slate-50',    border: 'border-slate-200',   label: 'Not captured' },
};

// Blur score bar (0-100)
function BlurBar({ score }) {
  const color = score >= 70 ? 'bg-emerald-500' : score >= 45 ? 'bg-amber-500' : 'bg-red-500';
  const label = score >= 70 ? 'Sharp' : score >= 45 ? 'Slightly blurry' : 'Blurry';
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-400 w-14 shrink-0">Blur score</span>
      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
      <span className={cn('text-[10px] font-bold tabular-nums w-14 text-right',
        score >= 70 ? 'text-emerald-600' : score >= 45 ? 'text-amber-600' : 'text-red-600'
      )}>
        {score}/100 · {label}
      </span>
    </div>
  );
}

// GPS confidence chip
export function GpsChip({ accuracy, lat, lon }) {
  if (accuracy == null) return (
    <span className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 font-semibold">
      <MapPin className="h-2.5 w-2.5" /> No GPS
    </span>
  );
  const isLow = accuracy > 30;
  return (
    <span className={cn(
      'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg border font-semibold',
      isLow ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'
    )}>
      <MapPin className="h-2.5 w-2.5" />
      {isLow ? `Low GPS ±${accuracy}m` : `GPS ±${accuracy}m`}
    </span>
  );
}

export default function QcBadge({ status, score, warning, gps_accuracy, geo_lat, geo_lon, showDetail = false }) {
  const cfg = QC_CFG[status] || QC_CFG.pending;
  const Icon = cfg.Icon;
  const hasPhoto = ['qc_pass', 'qc_warning', 'qc_fail'].includes(status);

  return (
    <div className="space-y-1.5">
      {/* Main badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold', cfg.bg, cfg.border, cfg.cls)}>
          <Icon className="h-3 w-3" />
          {cfg.label}
          {score != null && <span className="opacity-70 font-normal">· {score}/100</span>}
        </div>
        {geo_lat != null && <GpsChip accuracy={gps_accuracy} lat={geo_lat} lon={geo_lon} />}
        {geo_lat == null && hasPhoto && (
          <span className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 font-semibold">
            <MapPin className="h-2.5 w-2.5" /> No GPS tag
          </span>
        )}
      </div>

      {/* Blur score bar (photos only) */}
      {hasPhoto && score != null && showDetail && (
        <BlurBar score={score} />
      )}

      {/* QC warning text */}
      {warning && (
        <div className="flex items-start gap-1.5 px-2.5 py-1.5 bg-amber-50 rounded-xl border border-amber-200">
          <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-amber-800 leading-snug font-medium">{warning}</p>
        </div>
      )}

      {/* Hard fail reason */}
      {status === 'qc_fail' && !warning && (
        <div className="flex items-start gap-1.5 px-2.5 py-1.5 bg-red-50 rounded-xl border border-red-200">
          <XCircle className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-red-800 leading-snug font-medium">Quality check failed — retake required</p>
        </div>
      )}
    </div>
  );
}