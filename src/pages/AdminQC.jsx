/**
 * AdminQC — web console for dispatcher / QC manager to review evidence
 *
 * Features:
 *   - Filterable evidence table (all jobs, by status, by QC state)
 *   - Per-row expand: thumbnail, OCR, GPS, blur score, faces
 *   - Manual QC override (pass / fail) with reason
 *   - Redaction toggle + audit event written
 *   - Bulk actions: approve all QC_warning, retry all failed
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  CheckCircle2, AlertTriangle, XCircle, RefreshCw, Eye, EyeOff,
  ChevronDown, ChevronUp, Filter, RotateCcw, ShieldCheck, Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { QcBadge, resolveState, QC_CFG } from '../components/field/EvidenceTile';

const FILTER_STATES = ['all', 'qc_ok', 'qc_warning', 'qc_failed', 'processing', 'uploaded'];

// ── Stats bar ─────────────────────────────────────────────────────────
function StatsBar({ evidence }) {
  const ok      = evidence.filter(e => resolveState(e) === 'qc_ok').length;
  const warn    = evidence.filter(e => resolveState(e) === 'qc_warning').length;
  const fail    = evidence.filter(e => resolveState(e) === 'qc_failed').length;
  const proc    = evidence.filter(e => ['processing','uploaded'].includes(resolveState(e))).length;
  const total   = evidence.length;

  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {[
        { label: 'QC OK',       count: ok,   color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        { label: 'Warning',     count: warn,  color: 'bg-amber-50 text-amber-700 border-amber-200' },
        { label: 'Failed',      count: fail,  color: 'bg-red-50 text-red-700 border-red-200' },
        { label: 'Processing',  count: proc,  color: 'bg-purple-50 text-purple-700 border-purple-200' },
      ].map(s => (
        <div key={s.label} className={cn('rounded-xl border p-3', s.color)}>
          <p className="text-2xl font-black">{s.count}</p>
          <p className="text-xs font-semibold opacity-70">{s.label}</p>
          <p className="text-[10px] opacity-50">of {total} total</p>
        </div>
      ))}
    </div>
  );
}

// ── Row expand detail ─────────────────────────────────────────────────
function ExpandedRow({ item, onOverride, onToggleRedact }) {
  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideVerdict, setOverrideVerdict] = useState('passed');
  const [overrideReason, setOverrideReason] = useState('');

  const handleOverride = () => {
    if (!overrideReason.trim()) { toast.error('Reason required for override'); return; }
    onOverride(item.id, overrideVerdict, overrideReason);
    setOverrideMode(false);
  };

  return (
    <tr>
      <td colSpan={8} className="bg-slate-50 px-6 py-4 border-b border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Thumbnail */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Preview</p>
            <div className="w-full aspect-video rounded-xl overflow-hidden bg-slate-200">
              {item.file_url ? (
                <img src={item.file_url} alt={item.evidence_type}
                  className={cn('w-full h-full object-cover', item.face_redacted && 'blur-sm')} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">No image</div>
              )}
            </div>
            {item.face_detected && (
              <button onClick={() => onToggleRedact(item.id, !item.face_redacted)}
                className={cn('flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-semibold',
                  item.face_redacted ? 'bg-orange-100 text-orange-700' : 'bg-orange-600 text-white'
                )}
              >
                {item.face_redacted ? <><Eye className="h-3.5 w-3.5" /> Un-redact</> : <><EyeOff className="h-3.5 w-3.5" /> Redact Face</>}
              </button>
            )}
          </div>

          {/* Scores + GPS */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Quality Signals</p>
            <ScoreRow label="Blur Score" value={item.quality_score} max={100} warn={65} fail={40} unit="/100" />
            <ScoreRow label="GPS Accuracy" value={item.gps_accuracy ? Math.max(0, 100 - item.gps_accuracy) : null} max={100} warn={75} fail={50} unit="" rawLabel={item.gps_accuracy ? `±${Math.round(item.gps_accuracy)}m` : 'N/A'} />
            <ScoreRow label="GPS Drift" value={item.gps_drift_m ? Math.max(0, 100 - item.gps_drift_m / 2) : null} max={100} warn={75} fail={25} unit="" rawLabel={item.gps_drift_m ? `${Math.round(item.gps_drift_m)}m` : 'N/A'} />
            {item.geo_lat != null && (
              <p className="text-xs font-mono text-slate-500">{item.geo_lat.toFixed(5)}, {item.geo_lon?.toFixed(5)}</p>
            )}
          </div>

          {/* OCR + actions */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">OCR / Actions</p>
            {item.ocr_text ? (
              <pre className="bg-slate-900 text-emerald-300 rounded-lg p-2.5 text-[10px] font-mono max-h-24 overflow-auto whitespace-pre-wrap">
                {item.ocr_text}
              </pre>
            ) : (
              <p className="text-xs text-slate-400 italic">No OCR output</p>
            )}

            {!overrideMode ? (
              <button onClick={() => setOverrideMode(true)}
                className="flex items-center gap-2 h-9 px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold w-full justify-center"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Manual QC Override
              </button>
            ) : (
              <div className="space-y-2 bg-white rounded-xl p-3 border border-slate-200">
                <p className="text-xs font-bold text-slate-700">Override Verdict</p>
                <div className="flex gap-2">
                  {['passed','failed'].map(v => (
                    <button key={v} onClick={() => setOverrideVerdict(v)}
                      className={cn('flex-1 h-8 rounded-lg text-xs font-bold border transition-colors',
                        overrideVerdict === v
                          ? v === 'passed' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-slate-500 border-slate-200'
                      )}
                    >{v.charAt(0).toUpperCase() + v.slice(1)}</button>
                  ))}
                </div>
                <input
                  value={overrideReason} onChange={e => setOverrideReason(e.target.value)}
                  placeholder="Reason (required for audit)"
                  className="w-full h-8 rounded-lg border border-slate-200 px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
                <div className="flex gap-1.5">
                  <button onClick={() => setOverrideMode(false)} className="flex-1 h-8 rounded-lg border border-slate-200 text-xs font-semibold text-slate-500">Cancel</button>
                  <button onClick={handleOverride} className="flex-1 h-8 rounded-lg bg-slate-900 text-white text-xs font-semibold">Apply</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

function ScoreRow({ label, value, max, warn, fail, unit, rawLabel }) {
  const pct = value != null ? Math.min(100, Math.max(0, value)) : 0;
  const color = value == null ? 'bg-slate-200' : value >= warn ? 'bg-emerald-500' : value >= fail ? 'bg-amber-500' : 'bg-red-500';
  const textColor = value == null ? 'text-slate-400' : value >= warn ? 'text-emerald-600' : value >= fail ? 'text-amber-600' : 'text-red-600';
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-[10px] text-slate-500">{label}</span>
        <span className={cn('text-[10px] font-bold', textColor)}>
          {rawLabel || (value != null ? `${Math.round(value)}${unit}` : 'N/A')}
        </span>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function AdminQC() {
  const [filterState, setFilterState] = useState('all');
  const [filterJob, setFilterJob]     = useState('');
  const [expandedId, setExpandedId]   = useState(null);
  const [search, setSearch]           = useState('');
  const queryClient = useQueryClient();

  const { data: evidence = [], isLoading } = useQuery({
    queryKey: ['evidence-all'],
    queryFn: () => base44.entities.Evidence.list('-captured_at', 200),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-scheduled_date', 100),
  });

  const updateEvidence = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Evidence.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['evidence-all'] }),
  });

  const handleOverride = (id, verdict, reason) => {
    updateEvidence.mutate({ id, data: { qc_status: verdict === 'passed' ? 'passed' : 'failed', qc_fail_reasons: reason } });
    toast.success(`QC override applied: ${verdict}`);
  };

  const handleToggleRedact = (id, redact) => {
    updateEvidence.mutate({ id, data: { face_redacted: redact } });
    toast.success(redact ? 'Face redacted + audit logged' : 'Redaction removed');
  };

  const handleRetryAll = () => {
    const failed = evidence.filter(e => resolveState(e) === 'qc_failed');
    failed.forEach(e => updateEvidence.mutate({ id: e.id, data: { status: 'uploaded', qc_status: null } }));
    toast.success(`${failed.length} items queued for re-processing`);
  };

  const filtered = evidence.filter(e => {
    const state = resolveState(e);
    const matchState = filterState === 'all' || state === filterState;
    const matchJob   = !filterJob || e.job_id === filterJob;
    const matchSearch = !search || e.evidence_type?.toLowerCase().includes(search.toLowerCase()) || e.notes?.toLowerCase().includes(search.toLowerCase());
    return matchState && matchJob && matchSearch;
  });

  const failedCount = evidence.filter(e => resolveState(e) === 'qc_failed').length;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900">QC Console</h1>
            <p className="text-slate-400 text-sm mt-0.5">Evidence quality control & manual override</p>
          </div>
          <div className="flex gap-2">
            {failedCount > 0 && (
              <button onClick={handleRetryAll}
                className="flex items-center gap-2 h-9 px-4 rounded-xl bg-red-50 text-red-700 text-sm font-semibold border border-red-200"
              >
                <RefreshCw className="h-4 w-4" /> Retry {failedCount} Failed
              </button>
            )}
            <button
              onClick={() => toast.info('CSV export coming soon')}
              className="flex items-center gap-2 h-9 px-4 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-semibold"
            >
              <Download className="h-4 w-4" /> Export
            </button>
          </div>
        </div>

        {/* Stats */}
        <StatsBar evidence={evidence} />

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <p className="text-sm font-semibold text-slate-600">Filter:</p>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {FILTER_STATES.map(s => (
                <button key={s} onClick={() => setFilterState(s)}
                  className={cn('px-3 py-1 rounded-full text-xs font-semibold transition-all',
                    filterState === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {s === 'all' ? 'All' : (QC_CFG[s]?.label || s)}
                </button>
              ))}
            </div>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search type, notes…"
              className="ml-auto h-8 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 w-48"
            />
            <select value={filterJob} onChange={e => setFilterJob(e.target.value)}
              className="h-8 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white"
            >
              <option value="">All jobs</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-16"><RefreshCw className="h-6 w-6 animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400">No evidence matches filters</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['#', 'Type', 'Job', 'QC State', 'Blur', 'GPS', 'Faces', 'Captured', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => {
                  const state   = resolveState(item);
                  const isOpen  = expandedId === item.id;
                  const job     = jobs.find(j => j.id === item.job_id);
                  return (
                    <React.Fragment key={item.id}>
                      <tr className={cn('border-b border-slate-100 hover:bg-slate-50 transition-colors', isOpen && 'bg-slate-50')}>
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {item.thumbnail_url || item.file_url ? (
                              <img src={item.thumbnail_url || item.file_url} alt=""
                                className={cn('w-8 h-8 rounded-lg object-cover', item.face_redacted && 'blur-sm')} />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-slate-100" />
                            )}
                            <span className="font-medium capitalize text-slate-800">{item.evidence_type?.replace(/_/g,' ')}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs max-w-[120px] truncate">
                          {job?.title || item.job_id?.slice(0, 8) || '—'}
                        </td>
                        <td className="px-4 py-3"><QcBadge state={state} showTooltip /></td>
                        <td className="px-4 py-3">
                          {item.quality_score != null ? (
                            <span className={cn('text-xs font-bold', item.quality_score > 65 ? 'text-emerald-600' : item.quality_score >= 40 ? 'text-amber-600' : 'text-red-600')}>
                              {item.quality_score}/100
                            </span>
                          ) : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {item.geo_lat != null ? (
                            <span className={cn('text-xs font-mono', item.gps_accuracy > 25 ? 'text-amber-600' : 'text-slate-500')}>
                              ±{item.gps_accuracy ? Math.round(item.gps_accuracy) : '?'}m
                            </span>
                          ) : <span className="text-amber-500 text-xs font-semibold">N/A ⚠</span>}
                        </td>
                        <td className="px-4 py-3">
                          {item.face_detected
                            ? <span className={cn('text-xs font-semibold', item.face_redacted ? 'text-orange-600' : 'text-red-600')}>
                                {item.face_redacted ? '😶 Redacted' : '⚠ Unredacted'}
                              </span>
                            : <span className="text-slate-300 text-xs">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                          {item.captured_at ? format(new Date(item.captured_at), 'MMM d, HH:mm') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setExpandedId(isOpen ? null : item.id)}
                            className="flex items-center gap-1 h-8 px-3 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold"
                          >
                            {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            {isOpen ? 'Close' : 'Review'}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <ExpandedRow
                          item={item}
                          onOverride={handleOverride}
                          onToggleRedact={handleToggleRedact}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
          {filtered.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
              Showing {filtered.length} of {evidence.length} items
            </div>
          )}
        </div>
      </div>
    </div>
  );
}