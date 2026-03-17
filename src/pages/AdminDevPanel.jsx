/**
 * AdminDevPanel (I) — Developer / Admin Panel
 * Metrics, CSV exports, mock data regen, storage backend toggle,
 * and approved_for_training toggles.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { rowsToCSV, downloadCSV } from '@/lib/mockManifest';
import { seedMockData } from '@/lib/mockSeedData';
import AdminShell from '@/components/admin/AdminShell';
import {
  Download, RefreshCw, Loader2, Database, Image,
  Tag, Mic, CheckCircle2, ToggleLeft, ToggleRight, ServerCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

function MetricCard({ icon: Icon, label, value, sub, color = 'text-slate-800' }) {
  return (
    <div className="bg-white rounded-[8px] border border-slate-100 p-4 flex items-start gap-3">
      <div className="h-9 w-9 rounded-[8px] bg-slate-50 flex items-center justify-center flex-shrink-0">
        <Icon className={cn('h-5 w-5', color)} />
      </div>
      <div>
        <p className="text-2xl font-black tabular-nums text-slate-900">{value ?? '—'}</p>
        <p className="text-xs font-semibold text-slate-600">{label}</p>
        {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function AdminDevPanel() {
  const qc = useQueryClient();
  const [seedLog,   setSeedLog]   = useState([]);
  const [backend,   setBackend]   = useState(() => localStorage.getItem('purpulse_storage_backend') || 'base44');
  const [togglingId, setTogglingId] = useState(null);
  const [mockScenario, setMockScenario] = useState(() => {
    try {
      const { getMockScenario } = require('@/mocks/handlers');
      return getMockScenario();
    } catch {
      return 'success';
    }
  });
  const [tokenExpired, setTokenExpired] = useState(false);

  const { data: manifests  = [], isLoading: lM } = useQuery({ queryKey: ['adp-manifests'],  queryFn: () => base44.entities.UploadManifest.list('-created_date', 500) });
  const { data: auditLogs  = [], isLoading: lA } = useQuery({ queryKey: ['adp-audit'],       queryFn: () => base44.entities.AuditLog.list('-created_date', 500) });
  const { data: labels     = [], isLoading: lL } = useQuery({ queryKey: ['adp-labels'],      queryFn: () => base44.entities.LabelRecord.list('-labeled_at', 500) });
  const { data: evidence   = [], isLoading: lE } = useQuery({ queryKey: ['adp-evidence'],    queryFn: () => base44.entities.Evidence.list('-captured_at', 500) });
  const { data: meetings   = [] }                = useQuery({ queryKey: ['adp-meetings'],    queryFn: () => base44.entities.Meeting.list('-scheduled_at', 100) });
  const isLoading = lM || lA || lL || lE;

  /* ── Metrics ─────────────────────────────────────────────────────── */
  const evidenceCount    = evidence.length;
  const labeledCount     = labels.length;
  const geoCount         = manifests.filter(m => m.geo_lat != null).length;
  const geoPercent       = evidenceCount ? ((geoCount / evidenceCount) * 100).toFixed(1) : 0;
  const transcriptsCount = meetings.filter(m => m.transcript_url).length;
  const approvedCount    = evidence.filter(e => e.approved_for_training).length;
  const byJob = {};
  manifests.forEach(m => { byJob[m.job_id] = (byJob[m.job_id] || 0) + 1; });
  const jobIds   = Object.keys(byJob);
  const avgImgPerJob = jobIds.length
    ? (Object.values(byJob).reduce((s, v) => s + v, 0) / jobIds.length).toFixed(1)
    : 0;

  /* ── Storage backend toggle ─────────────────────────────────────── */
  const switchBackend = (val) => {
    setBackend(val);
    localStorage.setItem('purpulse_storage_backend', val);
  };

  /* ── MSW Mock scenario toggle ────────────────────────────────────── */
  const switchMockScenario = (scenario) => {
    try {
      const { setMockScenario } = require('@/mocks/handlers');
      setMockScenario(scenario);
      setMockScenario(scenario);
    } catch (err) {
      console.error('[AdminDevPanel] Failed to switch mock scenario:', err);
    }
  };

  /* ── CSV exports ─────────────────────────────────────────────────── */
  const exportManifests = () => {
    downloadCSV(rowsToCSV(manifests), `purpulse-manifest-${new Date().toISOString().slice(0,10)}.csv`);
  };
  const exportAuditLogs = () => {
    downloadCSV(rowsToCSV(auditLogs), `purpulse-audit-${new Date().toISOString().slice(0,10)}.csv`);
  };
  const exportLabels = () => {
    downloadCSV(rowsToCSV(labels), `purpulse-labels-${new Date().toISOString().slice(0,10)}.csv`);
  };

  /* ── Seed mock data ──────────────────────────────────────────────── */
  const seedMutation = useMutation({
    mutationFn: () => seedMockData(msg => setSeedLog(p => [...p, msg])),
    onSuccess:  () => { qc.invalidateQueries(); setSeedLog(p => [...p, '✓ All tables seeded.']); },
  });

  /* ── Toggle training approval ────────────────────────────────────── */
  const toggleTraining = async (item, entityType) => {
    setTogglingId(item.id);
    try {
      if (entityType === 'evidence') {
        await base44.entities.Evidence.update(item.id, { approved_for_training: !item.approved_for_training });
        qc.invalidateQueries({ queryKey: ['adp-evidence'] });
      } else {
        await base44.entities.LabelRecord.update(item.id, { approved_for_training: !item.approved_for_training });
        qc.invalidateQueries({ queryKey: ['adp-labels'] });
      }
    } finally {
      setTogglingId(null);
    }
  };

  const fmtTs = ts => { try { return format(parseISO(ts), 'MMM d HH:mm'); } catch { return ts || '—'; }};

  return (
    <AdminShell title="Developer Panel" subtitle="Metrics, exports, mock data, and training controls">

      {/* ── Metrics ──────────────────────────────────────────────────── */}
      <section className="mb-6">
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Dataset Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <MetricCard icon={Image}        label="Evidence Files"       value={evidenceCount}   color="text-blue-600" />
          <MetricCard icon={Tag}          label="Label Records"        value={labeledCount}    color="text-amber-600" />
          <MetricCard icon={CheckCircle2} label="Approved for Training"value={approvedCount}   color="text-emerald-600" sub={`${evidenceCount ? ((approvedCount/evidenceCount)*100).toFixed(0) : 0}% of evidence`} />
          <MetricCard icon={Image}        label="Avg Images / Job"     value={avgImgPerJob}    color="text-indigo-600" />
          <MetricCard icon={Image}        label="Images with Geo"      value={`${geoPercent}%`}color="text-green-600"  sub={`${geoCount}/${evidenceCount} files`} />
          <MetricCard icon={Mic}          label="Transcripts"          value={transcriptsCount}color="text-cyan-600" />
          <MetricCard icon={Database}     label="Manifest Rows"        value={manifests.length}color="text-slate-600" />
          <MetricCard icon={Database}     label="Audit Log Entries"    value={auditLogs.length}color="text-slate-500" />
        </div>
      </section>

      {/* ── Storage Backend ───────────────────────────────────────────── */}
      <section className="mb-6">
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Storage Backend Mock</h2>
        <div className="flex gap-3 mb-4">
          {['base44', 'azure-placeholder'].map(b => (
            <button key={b} onClick={() => switchBackend(b)}
              className={cn('flex items-center gap-2 h-9 px-4 rounded-[8px] border text-xs font-bold transition-colors',
                backend === b ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              )}>
              <ServerCog className="h-3.5 w-3.5" />
              {b}
              {backend === b && <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded">active</span>}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mb-4">
          Mock backend — adapters read <code className="bg-slate-100 px-1 rounded">localStorage.purpulse_storage_backend</code>
        </p>

        {/* Token Expiry Simulation */}
      <section className="mb-6">
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Token Management</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-white rounded-[8px] border border-slate-200">
            <label className="flex items-center gap-2 flex-1 cursor-pointer">
              <input
                type="checkbox"
                checked={tokenExpired}
                onChange={(e) => {
                  setTokenExpired(e.target.checked);
                  if (e.target.checked) {
                    localStorage.setItem('purpulse_access_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiZXhwIjoxNjAwMDAwMDAwfQ.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U');
                  } else {
                    localStorage.removeItem('purpulse_access_token');
                  }
                }}
                className="h-4 w-4 rounded border-slate-300 cursor-pointer"
              />
              <span className="text-sm font-semibold text-slate-700">Simulate Expired Access Token</span>
            </label>
            {tokenExpired && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded">Active</span>}
          </div>
          <p className="text-[10px] text-slate-500">
            When enabled, next API request will receive 401 and trigger token refresh flow (refresh → retry original request)
          </p>
        </div>
      </section>

      {/* MSW Mock Scenarios */}
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">MSW Mock Scenarios</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'success', label: '✓ Success', desc: 'Fast responses (100ms)' },
            { id: 'slow', label: '⏱ Slow Network', desc: '3s delay' },
            { id: 'error', label: '❌ Server Error', desc: '500 responses' },
            { id: 'offline', label: '🔌 Offline', desc: 'Network failures' },
          ].map(s => (
            <button key={s.id} onClick={() => switchMockScenario(s.id)}
              className={cn('flex flex-col items-start h-16 px-3 py-2 rounded-[8px] border text-xs font-bold transition-colors',
                mockScenario === s.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              )}>
              <span>{s.label}</span>
              <span className={cn('text-[9px]', mockScenario === s.id ? 'text-slate-300' : 'text-slate-400')}>{s.desc}</span>
              {mockScenario === s.id && <span className="text-[9px] bg-white/20 px-1 py-0.5 rounded mt-auto">active</span>}
            </button>
          ))}
        </div>
      </section>

      {/* ── Export ────────────────────────────────────────────────────── */}
      <section className="mb-6">
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Exports</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Upload Manifest CSV', fn: exportManifests, count: manifests.length },
            { label: 'Audit Logs CSV',      fn: exportAuditLogs, count: auditLogs.length },
            { label: 'Labels CSV',          fn: exportLabels,    count: labels.length    },
          ].map(({ label, fn, count }) => (
            <button key={label} onClick={fn}
              className="flex items-center gap-2 h-9 px-4 rounded-[8px] bg-slate-900 text-white text-xs font-bold hover:bg-slate-700 transition-colors">
              <Download className="h-3.5 w-3.5" />
              {label}
              <span className="text-[9px] bg-white/15 px-1.5 py-0.5 rounded">{count}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Mock Data ─────────────────────────────────────────────────── */}
      <section className="mb-6">
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Mock Data Generation</h2>
        <div className="flex items-center gap-3">
          <button onClick={() => { setSeedLog([]); seedMutation.mutate(); }}
            disabled={seedMutation.isPending}
            className="flex items-center gap-2 h-9 px-4 rounded-[8px] bg-blue-600 text-white text-xs font-bold disabled:opacity-50 hover:bg-blue-700">
            {seedMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Regenerate Mock Data
          </button>
          <button onClick={() => qc.invalidateQueries()}
            className="h-9 w-9 rounded-[8px] bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
            <RefreshCw className={cn('h-3.5 w-3.5 text-slate-500', isLoading && 'animate-spin')} />
          </button>
        </div>
        {seedLog.length > 0 && (
          <div className="mt-3 p-3 bg-slate-900 rounded-[8px] font-mono text-xs text-emerald-400 space-y-0.5 max-h-28 overflow-y-auto">
            {seedLog.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        )}
      </section>

      {/* ── Training toggle table: Evidence ─────────────────────────── */}
      <section className="mb-6">
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
          Evidence · Toggle approved_for_training
        </h2>
        <div className="bg-white rounded-[8px] border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['File', 'Type', 'Job', 'QC', 'Training'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {evidence.slice(0, 30).map((ev, i) => (
                  <tr key={ev.id} className={cn('border-b border-slate-50 last:border-0', i%2===0?'bg-white':'bg-slate-50/40')}>
                    <td className="px-3 py-2 max-w-[120px] truncate font-mono text-[10px] text-slate-500">{ev.file_url?.split('/').pop() || ev.id?.slice(0,12)}</td>
                    <td className="px-3 py-2 text-slate-600">{ev.evidence_type || '—'}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-slate-400 max-w-[80px] truncate">{ev.job_id?.slice(0,16) || '—'}</td>
                    <td className="px-3 py-2">
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded',
                        ev.qc_status === 'approved'   ? 'bg-emerald-50 text-emerald-700' :
                        ev.qc_status === 'rejected'   ? 'bg-red-50 text-red-600' :
                        'bg-slate-100 text-slate-500')}>
                        {ev.qc_status || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => toggleTraining(ev, 'evidence')}
                        disabled={togglingId === ev.id}
                        className="flex items-center gap-1.5 text-[11px] font-semibold">
                        {ev.approved_for_training
                          ? <ToggleRight className="h-4 w-4 text-emerald-500" />
                          : <ToggleLeft  className="h-4 w-4 text-slate-300" />}
                        {ev.approved_for_training ? 'Approved' : 'Pending'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Training toggle table: Labels ────────────────────────────── */}
      <section>
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
          Labels · Toggle approved_for_training
        </h2>
        <div className="bg-white rounded-[8px] border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Evidence', 'Type', 'Value', 'Conf.', 'QC', 'Training'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {labels.slice(0, 30).map((lbl, i) => (
                  <tr key={lbl.id} className={cn('border-b border-slate-50 last:border-0', i%2===0?'bg-white':'bg-slate-50/40')}>
                    <td className="px-3 py-2 font-mono text-[10px] text-slate-400 max-w-[80px] truncate">{lbl.evidence_id?.slice(0,14) || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{lbl.label_type}</td>
                    <td className="px-3 py-2 text-slate-700 max-w-[100px] truncate">{lbl.label_value || '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{lbl.confidence != null ? lbl.confidence.toFixed(2) : '—'}</td>
                    <td className="px-3 py-2">
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded',
                        lbl.qc_status === 'approved'   ? 'bg-emerald-50 text-emerald-700' :
                        lbl.qc_status === 'rejected'   ? 'bg-red-50 text-red-600' :
                        'bg-slate-100 text-slate-500')}>
                        {lbl.qc_status || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => toggleTraining(lbl, 'label')}
                        disabled={togglingId === lbl.id}
                        className="flex items-center gap-1.5 text-[11px] font-semibold">
                        {lbl.approved_for_training
                          ? <ToggleRight className="h-4 w-4 text-emerald-500" />
                          : <ToggleLeft  className="h-4 w-4 text-slate-300" />}
                        {lbl.approved_for_training ? 'Approved' : 'Pending'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}