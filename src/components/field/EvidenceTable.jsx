/**
 * EvidenceTable — enterprise desktop data grid for job evidence.
 * Shows thumbnail, type, QC score/status, geo, captured_at.
 * Row click opens a right-panel drawer with OCR text, faces, audit trail.
 * Inline actions: View, Redact, Request Retake.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Eye, EyeOff, RotateCcw, X, MapPin, Clock, FileText,
  CheckCircle2, AlertTriangle, XCircle, Loader2, ImageOff,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

// ── helpers ──────────────────────────────────────────────────────────
function fmtTs(ts) {
  if (!ts) return '—';
  try { return format(parseISO(ts), 'MMM d, HH:mm'); } catch { return ts; }
}

function fmtType(t) {
  return t ? t.replace(/_/g, ' ') : '—';
}

// ── QC badge ─────────────────────────────────────────────────────────
const QC_CFG = {
  passed:  { Icon: CheckCircle2,  cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', label: 'Passed'  },
  failed:  { Icon: XCircle,       cls: 'text-red-700 bg-red-50 border-red-200',             label: 'Failed'  },
  pending: { Icon: AlertTriangle, cls: 'text-amber-700 bg-amber-50 border-amber-200',       label: 'Pending' },
};

function QcBadge({ status }) {
  const cfg = QC_CFG[status] || QC_CFG.pending;
  const Icon = cfg.Icon;
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-px rounded border text-[10px] font-bold uppercase tracking-wide', cfg.cls)}>
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  );
}

function QcScore({ score }) {
  if (score == null) return <span className="text-slate-300 text-xs">—</span>;
  const color = score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600';
  return <span className={cn('text-xs font-black tabular-nums', color)}>{score}</span>;
}

// ── Thumbnail ────────────────────────────────────────────────────────
function Thumb({ url, alt = '' }) {
  const [err, setErr] = useState(false);
  if (!url || err) {
    return (
      <div className="h-10 w-14 rounded-[6px] bg-slate-100 flex items-center justify-center flex-shrink-0">
        <ImageOff className="h-4 w-4 text-slate-300" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      className="h-10 w-14 object-cover rounded-[6px] flex-shrink-0 border border-slate-200"
      onError={() => setErr(true)}
    />
  );
}

// ── Evidence Detail Drawer ────────────────────────────────────────────
function EvidenceDrawer({ item, onClose, onRedact, onRetake, isRedacting }) {
  if (!item) return null;

  const auditTrail = [
    { ts: item.created_date, actor: item.created_by || 'System', action: 'Uploaded' },
    ...(item.qc_status === 'passed' ? [{ ts: item.captured_at, actor: 'QC Engine', action: 'QC Passed' }] : []),
    ...(item.qc_status === 'failed' ? [{ ts: item.captured_at, actor: 'QC Engine', action: `QC Failed — ${item.quality_warning || 'See warning'}` }] : []),
    ...(item.face_redaction_status === 'redacted' ? [{ ts: item.updated_date, actor: 'Dispatcher', action: 'Face redaction applied' }] : []),
  ].filter(a => a.ts);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Evidence details">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50 flex-shrink-0">
          <div>
            <p className="text-sm font-black text-slate-900 capitalize">{fmtType(item.evidence_type)}</p>
            <p className="text-[10px] text-slate-400">{fmtTs(item.captured_at || item.created_date)}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-[8px] bg-white border border-slate-200 flex items-center justify-center active:bg-slate-100">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Image */}
          {item.file_url && (
            <div className="bg-slate-900 flex items-center justify-center" style={{ minHeight: 180 }}>
              <img
                src={item.file_url}
                alt={fmtType(item.evidence_type)}
                className="max-h-64 w-full object-contain"
                onError={e => e.currentTarget.style.display = 'none'}
              />
            </div>
          )}

          <div className="px-4 py-4 space-y-4">

            {/* QC status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QcBadge status={item.qc_status} />
                {item.quality_score != null && (
                  <span className="text-xs text-slate-400">Score: <QcScore score={item.quality_score} /></span>
                )}
              </div>
              {item.face_redaction_status === 'redacted' && (
                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-px rounded">Redacted</span>
              )}
            </div>

            {/* Warning */}
            {item.quality_warning && (
              <div className="bg-amber-50 border border-amber-200 rounded-[8px] px-3 py-2 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-snug">{item.quality_warning}</p>
              </div>
            )}

            {/* Metadata */}
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Metadata</p>
              <div className="bg-slate-50 rounded-[8px] p-3 space-y-1.5 font-mono">
                {[
                  ['Type',        fmtType(item.evidence_type)],
                  ['Status',      item.status || '—'],
                  ['Captured',    fmtTs(item.captured_at)],
                  ['Content',     item.content_type || '—'],
                  ['Size',        item.size_bytes ? `${Math.round(item.size_bytes / 1024)} KB` : '—'],
                  ['Step ID',     item.runbook_step_id || '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <span className="text-[10px] text-slate-400">{k}</span>
                    <span className="text-[10px] text-slate-700 truncate max-w-[55%] text-right">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Geo */}
            {(item.geo_lat != null && item.geo_lon != null) && (
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Geolocation</p>
                <a
                  href={`https://maps.google.com/maps?q=${item.geo_lat},${item.geo_lon}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-[8px] px-3 py-2 active:opacity-80"
                >
                  <MapPin className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                  <span className="text-xs font-mono text-blue-700">{item.geo_lat.toFixed(5)}, {item.geo_lon.toFixed(5)}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-blue-400 ml-auto" />
                </a>
              </div>
            )}

            {/* OCR text */}
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">OCR / Extracted Text</p>
              {item.ocr_text ? (
                <div className="bg-slate-50 border border-slate-200 rounded-[8px] px-3 py-2 max-h-32 overflow-y-auto">
                  <p className="text-xs font-mono text-slate-700 leading-relaxed whitespace-pre-wrap break-words">{item.ocr_text}</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-slate-400 bg-slate-50 rounded-[8px] px-3 py-2">
                  <FileText className="h-3.5 w-3.5" />
                  <span className="text-xs">No OCR data available</span>
                </div>
              )}
            </div>

            {/* Face detection */}
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Face Detection</p>
              <div className={cn(
                'rounded-[8px] px-3 py-2 text-xs font-semibold',
                item.face_redaction_status === 'redacted'  ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                item.face_redaction_status === 'detected'  ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                'bg-slate-50 text-slate-500 border border-slate-200'
              )}>
                {item.face_redaction_status === 'redacted'  ? '✓ Faces redacted' :
                 item.face_redaction_status === 'detected'  ? '⚠ Faces detected — redaction pending' :
                 item.face_redaction_status === 'none'      ? 'No faces detected' :
                 'Face detection not run'}
              </div>
            </div>

            {/* Notes */}
            {item.notes && (
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes</p>
                <p className="text-xs text-slate-600 leading-relaxed">{item.notes}</p>
              </div>
            )}

            {/* Audit trail */}
            {auditTrail.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Audit Trail</p>
                <div className="space-y-1.5">
                  {auditTrail.map((e, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Clock className="h-2.5 w-2.5 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{e.action}</p>
                        <p className="text-[10px] text-slate-400">{e.actor} · {fmtTs(e.ts)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions footer */}
        <div className="px-4 py-3 border-t border-slate-100 flex gap-2 flex-shrink-0 bg-white">
          <a
            href={item.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 h-9 rounded-[8px] bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-slate-200 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" /> View
          </a>
          <button
            onClick={() => onRedact(item)}
            disabled={isRedacting || item.face_redaction_status === 'redacted'}
            className="flex-1 h-9 rounded-[8px] bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-purple-200 transition-colors disabled:opacity-40"
          >
            {isRedacting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
            Redact
          </button>
          <button
            onClick={() => onRetake(item)}
            className="flex-1 h-9 rounded-[8px] bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-amber-200 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Retake
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main table component ──────────────────────────────────────────────
export default function EvidenceTable({ evidence, jobId }) {
  const [selected, setSelected] = useState(null);
  const queryClient = useQueryClient();

  const redactMutation = useMutation({
    mutationFn: (item) => base44.entities.Evidence.update(item.id, {
      face_redaction_status: 'redacted',
      notes: (item.notes ? item.notes + '\n' : '') + `Face redaction applied at ${new Date().toISOString()}`,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      toast.success('Redaction applied');
    },
  });

  const retakeMutation = useMutation({
    mutationFn: (item) => base44.entities.Evidence.update(item.id, {
      status: 'replaced',
      notes: (item.notes ? item.notes + '\n' : '') + `Retake requested at ${new Date().toISOString()}`,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      toast.info('Retake requested — upload new evidence to replace');
      setSelected(null);
    },
  });

  if (!evidence.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-slate-400 bg-white rounded-[8px] border border-slate-200">
        <ImageOff className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm font-semibold">No evidence captured yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-[8px] border border-slate-200 overflow-hidden shadow-[0_2px_6px_rgba(15,23,36,0.06)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['', 'Type', 'QC Status', 'Score', 'Captured', 'Geo', 'Actions'].map((h, i) => (
                  <th key={i} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {evidence.map((item, i) => (
                <tr
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className={cn(
                    'border-b border-slate-50 last:border-0 cursor-pointer transition-colors',
                    selected?.id === item.id ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/30 hover:bg-slate-50'
                  )}
                >
                  {/* Thumbnail */}
                  <td className="px-3 py-2">
                    <Thumb url={item.thumbnail_url || item.file_url} alt={item.evidence_type} />
                  </td>

                  {/* Type */}
                  <td className="px-3 py-2">
                    <p className="text-xs font-semibold text-slate-800 capitalize whitespace-nowrap">{fmtType(item.evidence_type)}</p>
                    {item.status === 'replaced' && (
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Replaced</span>
                    )}
                  </td>

                  {/* QC status */}
                  <td className="px-3 py-2">
                    <QcBadge status={item.qc_status} />
                    {item.face_redaction_status === 'redacted' && (
                      <div className="mt-0.5 text-[9px] font-bold text-purple-600">Redacted</div>
                    )}
                  </td>

                  {/* Score */}
                  <td className="px-3 py-2 text-center">
                    <QcScore score={item.quality_score} />
                  </td>

                  {/* Captured at */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <p className="text-[10px] font-mono text-slate-500">{fmtTs(item.captured_at || item.created_date)}</p>
                  </td>

                  {/* Geo */}
                  <td className="px-3 py-2">
                    {item.geo_lat != null && item.geo_lon != null ? (
                      <a
                        href={`https://maps.google.com/maps?q=${item.geo_lat},${item.geo_lon}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline"
                      >
                        <MapPin className="h-3 w-3" />
                        GPS
                      </a>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>

                  {/* Inline actions */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      {item.file_url && (
                        <a
                          href={item.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-7 w-7 rounded-[6px] bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
                          title="View"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                        </a>
                      )}
                      <button
                        onClick={() => redactMutation.mutate(item)}
                        disabled={item.face_redaction_status === 'redacted' || redactMutation.isPending}
                        className="h-7 w-7 rounded-[6px] bg-purple-50 flex items-center justify-center hover:bg-purple-100 transition-colors disabled:opacity-30"
                        title="Redact faces"
                      >
                        <EyeOff className="h-3.5 w-3.5 text-purple-600" />
                      </button>
                      <button
                        onClick={() => retakeMutation.mutate(item)}
                        disabled={retakeMutation.isPending}
                        className="h-7 w-7 rounded-[6px] bg-amber-50 flex items-center justify-center hover:bg-amber-100 transition-colors disabled:opacity-30"
                        title="Request retake"
                      >
                        <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <EvidenceDrawer
          item={selected}
          onClose={() => setSelected(null)}
          onRedact={(item) => { redactMutation.mutate(item); }}
          onRetake={(item) => retakeMutation.mutate(item)}
          isRedacting={redactMutation.isPending}
        />
      )}
    </>
  );
}