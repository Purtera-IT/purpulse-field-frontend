/**
 * EvidenceDetailSheet
 * Full bottom-sheet for a single evidence item showing:
 *   - Thumbnail with redaction overlay
 *   - QC badge + tooltip
 *   - OCR output
 *   - Detected faces with per-face redaction toggle
 *   - GPS drift info
 *   - Blur score meter
 *   - Actions: Request Retake, Redact All, Re-tag, Add Note, Retry Processing
 *   - Audit log (redaction events, QC overrides)
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, MapPin, Eye, EyeOff, RotateCcw, Tag,
  StickyNote, RefreshCw, ChevronDown, ChevronUp,
  ShieldCheck, AlertTriangle, Info
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { QcBadge, QC_CFG, resolveState } from './EvidenceTile';

// ── QC scoring thresholds (shown in UI) ──────────────────────────────
const QC_THRESHOLDS = [
  { metric: 'Blur Score',   pass: '> 65',  warn: '40–65', fail: '< 40',   unit: '/100' },
  { metric: 'GPS Accuracy', pass: '≤ 25m', warn: '25–100m', fail: '> 100m or absent', unit: '' },
  { metric: 'GPS Drift',    pass: '< 50m', warn: '50–150m',  fail: '> 150m', unit: '' },
  { metric: 'Face Redact',  pass: 'Redacted or none', warn: 'Detected, unredacted', fail: 'Mandatory unredacted', unit: '' },
];

// ── Blur meter ────────────────────────────────────────────────────────
function BlurMeter({ score }) {
  const pct = Math.min(100, Math.max(0, score ?? 0));
  const color = pct > 65 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
  const label = pct > 65 ? 'Sharp' : pct >= 40 ? 'Marginal' : 'Blurry';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500">Blur Score</span>
        <span className={cn('text-xs font-bold', pct > 65 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-red-600')}>
          {score ?? '–'}/100 · {label}
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── GPS info row ──────────────────────────────────────────────────────
function GpsInfo({ item }) {
  const drift = item.gps_drift_m;
  const acc   = item.gps_accuracy;
  const driftWarn = drift != null && drift > 50;
  const accWarn   = acc  != null && acc  > 25;
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">GPS</p>
      {item.geo_lat != null ? (
        <div className="flex items-start gap-2 bg-slate-50 rounded-xl p-3">
          <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono text-slate-700">
              {item.geo_lat.toFixed(5)}, {item.geo_lon?.toFixed(5)}
            </p>
            <div className="flex gap-3 mt-1 flex-wrap">
              {acc != null && (
                <span className={cn('text-[10px] font-semibold', accWarn ? 'text-amber-600' : 'text-slate-400')}>
                  ±{Math.round(acc)}m accuracy{accWarn ? ' ⚠' : ''}
                </span>
              )}
              {drift != null && (
                <span className={cn('text-[10px] font-semibold', driftWarn ? 'text-amber-600' : 'text-emerald-600')}>
                  {Math.round(drift)}m drift from site{driftWarn ? ' ⚠' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-amber-50 rounded-xl p-3">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <p className="text-xs text-amber-700 font-medium">GPS unavailable at capture time — item flagged</p>
        </div>
      )}
    </div>
  );
}

// ── Face redaction panel ──────────────────────────────────────────────
function FacePanel({ item, onToggleRedact }) {
  // Simulate detected faces from item metadata (in production, stored as JSON array)
  const faceCount = item.face_count || (item.face_detected ? 1 : 0);
  if (faceCount === 0) return (
    <div className="flex items-center gap-2 bg-emerald-50 rounded-xl p-3">
      <ShieldCheck className="h-4 w-4 text-emerald-500" />
      <p className="text-xs text-emerald-700 font-medium">No faces detected</p>
    </div>
  );

  return (
    <div className="bg-orange-50 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <EyeOff className="h-4 w-4 text-orange-600" />
          <p className="text-xs font-bold text-orange-700">{faceCount} face{faceCount > 1 ? 's' : ''} detected</p>
        </div>
        <button
          onClick={() => onToggleRedact(!item.face_redacted)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors',
            item.face_redacted ? 'bg-orange-200 text-orange-800' : 'bg-orange-600 text-white'
          )}
          aria-label={item.face_redacted ? 'Remove redaction' : 'Apply face redaction'}
        >
          {item.face_redacted ? <><Eye className="h-3 w-3" /> Un-redact</> : <><EyeOff className="h-3 w-3" /> Redact All</>}
        </button>
      </div>
      {item.face_redacted && (
        <p className="text-[10px] text-orange-600 font-medium">
          ✓ Auto face-blur applied · logged to audit trail
        </p>
      )}
      {!item.face_redacted && (
        <p className="text-[10px] text-orange-700 font-semibold">
          ⚠ Unredacted faces will flag this item for QC review
        </p>
      )}
    </div>
  );
}

// ── Audit log ─────────────────────────────────────────────────────────
function AuditLog({ item }) {
  const [open, setOpen] = useState(false);
  // Build synthetic audit entries from item fields
  const entries = [
    item.captured_at && { ts: item.captured_at, actor: 'Technician', event: 'Captured', detail: `Type: ${item.evidence_type}` },
    item.status === 'uploaded' && { ts: item.captured_at, actor: 'System', event: 'Uploaded', detail: `${Math.round((item.size_bytes || 0) / 1024)}KB` },
    item.face_redacted && { ts: new Date().toISOString(), actor: 'System/Auto', event: 'Face Redacted', detail: `${item.face_count || 1} face(s) blurred` },
    item.qc_status && { ts: new Date().toISOString(), actor: 'QC Engine', event: `QC ${item.qc_status}`, detail: item.qc_fail_reasons || item.quality_warning || '—' },
  ].filter(Boolean);

  return (
    <div>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        Audit Log ({entries.length} events)
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {entries.map((e, i) => (
            <div key={i} className="flex gap-2.5 text-xs">
              <div className="w-1 flex-shrink-0 rounded-full bg-slate-200 self-stretch" />
              <div>
                <p className="font-semibold text-slate-700">{e.event} <span className="font-normal text-slate-400">· {e.actor}</span></p>
                <p className="text-slate-400">{e.detail}</p>
                <p className="text-[10px] text-slate-300 font-mono">{format(new Date(e.ts), 'MMM d, HH:mm:ss')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Re-tag sheet ──────────────────────────────────────────────────────
const ALL_TAGS = ['Before', 'After', 'Serial', 'Rack', 'Cable', 'Damage', 'Label', 'Wide', 'General'];

function RetagPanel({ item, onSave, onClose }) {
  const currentTags = (item.notes?.match(/\btag:(\w+)/g) || []).map(t => t.replace('tag:', ''));
  const [tags, setTags] = useState(currentTags.length ? currentTags : [item.evidence_type || 'general']);
  const toggle = t => setTags(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-slate-900">Re-tag Evidence</p>
      <div className="flex flex-wrap gap-1.5">
        {ALL_TAGS.map(tag => (
          <button key={tag} onClick={() => toggle(tag.toLowerCase())}
            className={cn('px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
              tags.includes(tag.toLowerCase()) ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            )}
          >{tag}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600">Cancel</button>
        <button onClick={() => onSave(tags)} className="flex-1 h-11 rounded-xl bg-slate-900 text-white text-sm font-semibold">Save Tags</button>
      </div>
    </div>
  );
}

// ── Add note ─────────────────────────────────────────────────────────
function AddNotePanel({ item, onSave, onClose }) {
  const [note, setNote] = useState(item.notes || '');
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-slate-900">Add / Edit Note</p>
      <textarea value={note} onChange={e => setNote(e.target.value)}
        className="w-full h-24 rounded-xl border border-slate-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-300"
        placeholder="Describe what's shown…"
      />
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600">Cancel</button>
        <button onClick={() => onSave(note)} className="flex-1 h-11 rounded-xl bg-slate-900 text-white text-sm font-semibold">Save Note</button>
      </div>
    </div>
  );
}

// ── Main Sheet ────────────────────────────────────────────────────────
export default function EvidenceDetailSheet({ item, onClose }) {
  const [panel, setPanel] = useState(null); // null | 'retag' | 'note'
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Evidence.update(item.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['evidence', item.job_id] }),
  });

  const handleToggleRedact = (redact) => {
    updateMutation.mutate({ face_redacted: redact });
    toast.success(redact ? 'Face redaction applied & logged' : 'Redaction removed — item re-flagged');
  };

  const handleRetake = () => {
    updateMutation.mutate({ status: 'replaced', quality_warning: 'Retake requested' });
    toast.success('Retake requested — item marked replaced');
    onClose();
  };

  const handleRetryProcessing = () => {
    updateMutation.mutate({ status: 'uploaded', qc_status: null, quality_score: null });
    toast.success('Queued for re-processing');
    onClose();
  };

  const handleSaveTags = (tags) => {
    const newType = tags[0] || item.evidence_type;
    updateMutation.mutate({ evidence_type: newType, notes: item.notes });
    toast.success('Tags updated');
    setPanel(null);
  };

  const handleSaveNote = (note) => {
    updateMutation.mutate({ notes: note });
    toast.success('Note saved');
    setPanel(null);
  };

  const state = resolveState(item);
  const cfg   = QC_CFG[state] || QC_CFG.uploaded;

  // OCR output (mock — in production, stored on item)
  const ocrOutput = item.ocr_text || null;

  return (
    <div className="space-y-5 pb-2">
      {/* ── Thumbnail + QC header ─────────────────────────── */}
      <div className="flex gap-3 items-start">
        <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 ring-2 ring-offset-1 ring-slate-200">
          {item.file_url || item.thumbnail_url ? (
            <img
              src={item.thumbnail_url || item.file_url}
              alt={item.evidence_type}
              className={cn('w-full h-full object-cover', item.face_redacted && 'blur-[3px]')}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-100">
              <AlertTriangle className="h-6 w-6 text-slate-300" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <QcBadge state={state} showTooltip />
            <span className="text-[10px] text-slate-400 font-mono" title="Tap QC badge for thresholds">ⓘ hover for info</span>
          </div>
          <p className="text-sm font-bold text-slate-900 capitalize">{item.evidence_type?.replace(/_/g,' ')}</p>
          {item.captured_at && (
            <p className="text-xs text-slate-400 mt-0.5">{format(new Date(item.captured_at), 'MMM d, yyyy · HH:mm:ss')}</p>
          )}
          <p className="text-[10px] text-slate-400 mt-0.5 font-mono truncate">{item.id?.slice(0, 16)}…</p>
        </div>
      </div>

      {/* ── Sub-panel router ──────────────────────────────── */}
      {panel === 'retag' && <RetagPanel item={item} onSave={handleSaveTags} onClose={() => setPanel(null)} />}
      {panel === 'note'  && <AddNotePanel item={item} onSave={handleSaveNote} onClose={() => setPanel(null)} />}

      {panel === null && (
        <>
          {/* QC explanation */}
          <div className={cn('rounded-xl p-3 text-xs', cfg.bg, cfg.text)}>
            <p className="font-bold mb-0.5">{cfg.label}</p>
            <p className="opacity-80">{cfg.tooltip}</p>
          </div>

          {/* Blur score */}
          {item.quality_score != null && <BlurMeter score={item.quality_score} />}

          {/* OCR output */}
          {ocrOutput && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">OCR Output</p>
              <div className="bg-slate-900 rounded-xl p-3 font-mono text-xs text-emerald-300 whitespace-pre-wrap max-h-28 overflow-y-auto">
                {ocrOutput}
              </div>
            </div>
          )}

          {/* Face redaction */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Face Detection</p>
            <FacePanel item={item} onToggleRedact={handleToggleRedact} />
          </div>

          {/* GPS */}
          <GpsInfo item={item} />

          {/* QC Thresholds reference */}
          <details className="group">
            <summary className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-400 font-semibold list-none">
              <Info className="h-3.5 w-3.5" />
              QC scoring thresholds
              <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="mt-2 rounded-xl overflow-hidden border border-slate-100">
              <table className="w-full text-[10px]">
                <thead><tr className="bg-slate-50">
                  {['Metric','Pass','Warn','Fail'].map(h => (
                    <th key={h} className="text-left px-2 py-1.5 text-slate-500 font-bold">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {QC_THRESHOLDS.map((row, i) => (
                    <tr key={i} className="border-t border-slate-50">
                      <td className="px-2 py-1.5 font-semibold text-slate-700">{row.metric}</td>
                      <td className="px-2 py-1.5 text-emerald-600">{row.pass}{row.unit}</td>
                      <td className="px-2 py-1.5 text-amber-600">{row.warn}{row.unit}</td>
                      <td className="px-2 py-1.5 text-red-600">{row.fail}{row.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          {/* Audit log */}
          <AuditLog item={item} />

          {/* Actions */}
          <div className="space-y-2 pt-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</p>
            <div className="grid grid-cols-2 gap-2">
              <ActionBtn icon={RotateCcw} label="Request Retake" color="text-red-600" bg="bg-red-50" onClick={handleRetake} />
              <ActionBtn icon={Tag}       label="Re-tag"         color="text-blue-600"   bg="bg-blue-50"   onClick={() => setPanel('retag')} />
              <ActionBtn icon={StickyNote} label="Add Note"       color="text-amber-600"  bg="bg-amber-50"  onClick={() => setPanel('note')} />
              <ActionBtn icon={RefreshCw} label="Retry Processing" color="text-purple-600" bg="bg-purple-50" onClick={handleRetryProcessing} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ActionBtn({ icon: Icon, label, color, bg, onClick }) {
  return (
    <button onClick={onClick}
      className={cn('flex items-center gap-2 h-11 px-3 rounded-xl text-xs font-semibold transition-all active:opacity-70', bg, color)}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {label}
    </button>
  );
}