/**
 * AdminManifest — Developer/Admin panel for the PurTera Purpulse mock DB.
 *
 * Features:
 *   • Live metrics cards (model-training readiness KPIs)
 *   • Upload Manifest table with CSV export
 *   • Audit Log table with CSV export
 *   • Label Records summary
 *   • Meetings list
 *   • Dataset Snapshot view + create new snapshot
 *   • "Seed Mock Data" one-click button
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Download, RefreshCw, Database, Image, Tag, Mic, CheckCircle2,
  AlertCircle, BarChart3, Layers, Calendar, Loader2,
  Zap, PackagePlus, Clock,
} from 'lucide-react';
import JobTimeline from '../components/admin/JobTimeline';
import { cn } from '@/lib/utils';
import { rowsToCSV, downloadCSV } from '@/lib/mockManifest';
import { seedMockData } from '@/lib/mockSeedData';
import { format, parseISO } from 'date-fns';
import AdminShell from '../components/admin/AdminShell';

// ── Sub-components ────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, sub, color = 'text-slate-900', bg = 'bg-white' }) {
  return (
    <div className={cn('rounded-[8px] border border-slate-100 p-4 flex items-start gap-3', bg)}>
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

function SectionHeader({ title, children }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest">{title}</h2>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function TableShell({ columns, rows, emptyMsg = 'No data' }) {
  if (!rows.length) return <p className="text-xs text-slate-400 text-center py-6">{emptyMsg}</p>;
  return (
    <div className="overflow-x-auto rounded-[8px] border border-slate-100">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-50">
            {columns.map(c => (
              <th key={c.key} className="px-3 py-2 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || i} className={cn('border-b border-slate-50 last:border-0', i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40')}>
              {columns.map(c => (
                <td key={c.key} className="px-3 py-2 text-slate-600 max-w-[200px] truncate">
                  {c.render ? c.render(row[c.key], row) : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmtTs(ts) {
  if (!ts) return '—';
  try { return format(parseISO(ts), 'MMM d HH:mm'); } catch { return ts; }
}

// ── Main page ─────────────────────────────────────────────────────────
export default function AdminManifest() {
  const qc = useQueryClient();
  const [seedLog,       setSeedLog]       = useState([]);
  const [activeSection, setActiveSection] = useState('metrics');
  const [timelineJobId, setTimelineJobId] = useState('');

  // ── Data queries ──────────────────────────────────────────────────
  const { data: manifests = [],  isLoading: loadM } = useQuery({
    queryKey: ['admin-manifests'],
    queryFn: () => base44.entities.UploadManifest.list('-created_date', 200),
  });
  const { data: auditLogs = [],  isLoading: loadA } = useQuery({
    queryKey: ['admin-audits'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 200),
  });
  const { data: labels = [],     isLoading: loadL } = useQuery({
    queryKey: ['admin-labels'],
    queryFn: () => base44.entities.LabelRecord.list('-created_date', 100),
  });
  const { data: meetings = [],   isLoading: loadMt } = useQuery({
    queryKey: ['admin-meetings'],
    queryFn: () => base44.entities.Meeting.list('-created_date', 50),
  });
  const { data: snapshots = [], isLoading: loadS } = useQuery({
    queryKey: ['admin-snapshots'],
    queryFn: () => base44.entities.DatasetSnapshot.list('-created_date', 20),
  });
  const { data: evidence = [], isLoading: loadEv } = useQuery({
    queryKey: ['admin-evidence-all'],
    queryFn: () => base44.entities.Evidence.list('-created_date', 500),
  });

  const isLoading = loadM || loadA || loadL || loadMt || loadS || loadEv;

  // ── Metrics ───────────────────────────────────────────────────────
  const totalEvidence      = evidence.length;
  const manifestRowsTotal  = manifests.length;

  // evidence_count_by_status from Evidence.qc_status (approved=passed, rejected=failed)
  const evByQcStatus = {
    qc_passed:  evidence.filter(e => e.qc_status === 'approved').length,
    qc_failed:  evidence.filter(e => e.qc_status === 'rejected').length,
    unknown:    evidence.filter(e => !e.qc_status || e.qc_status === 'pending').length,
  };

  // images_with_geo from Evidence
  const geoEvidence       = evidence.filter(e => e.geo_lat != null).length;
  const imagesWithGeoPct  = totalEvidence ? +((geoEvidence / totalEvidence) * 100).toFixed(1) : 0;

  // approved_for_training from Evidence
  const approvedTraining  = evidence.filter(e => e.approved_for_training).length;

  // manifest_migrated = manifests with azure_blob_url set
  const manifestMigrated  = manifests.filter(m => m.azure_blob_url && !m.azure_blob_url.startsWith('http://mock')).length;

  // labeled_count, avg_labels_per_evidence
  const labeledCount      = labels.length;
  const avgLabelsPerEv    = totalEvidence ? (labeledCount / totalEvidence).toFixed(2) : '0.00';

  // avg_images_per_job from manifests
  const avgImgPerJob = (() => {
    if (!manifests.length) return 0;
    const byJob = {};
    manifests.forEach(m => { byJob[m.job_id] = (byJob[m.job_id] || 0) + 1; });
    const vals = Object.values(byJob);
    return vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : 0;
  })();

  const transcriptCount = meetings.filter(m => m.transcript_url).length;
  const withEmbedding   = labels.filter(l => l.embedding?.length > 0).length;
  const labelCoverage   = totalEvidence ? ((labeledCount / totalEvidence) * 100).toFixed(0) : 0;
  const trainingReady   = approvedTraining >= 500;

  // ── Seed mutation ─────────────────────────────────────────────────
  const seedMutation = useMutation({
    mutationFn: () => seedMockData((msg) => setSeedLog(prev => [...prev, msg])),
    onSuccess: () => {
      qc.invalidateQueries();
      setSeedLog(prev => [...prev, '✓ All tables seeded']);
    },
  });

  // ── Snapshot creation ─────────────────────────────────────────────
  const createSnapshot = useMutation({
    mutationFn: () => base44.entities.DatasetSnapshot.create({
      snapshot_date:         new Date().toISOString().slice(0, 10),
      total_jobs:            [...new Set(manifests.map(m => m.job_id))].length,
      total_evidence:        totalEvidence,
      evidence_with_geo:     geoEvidence,
      labeled_evidence:      labels.length,
      approved_for_training: approvedTraining,
      avg_images_per_job:    +avgImgPerJob,
      transcript_count:      transcriptCount,
      total_label_records:   labels.length,
      label_counts_by_type:  JSON.stringify(
        labels.reduce((acc, l) => { acc[l.label_type] = (acc[l.label_type] || 0) + 1; return acc; }, {})
      ),
      embedding_coverage_pct: withEmbedding && labels.length
        ? +((withEmbedding / labels.length) * 100).toFixed(1)
        : 0,
      total_manifest_rows:   totalEvidence,
      total_audit_rows:      auditLogs.length,
      dataset_size_mb:       +(manifests.reduce((s, m) => s + (m.size_bytes || 0), 0) / 1_000_000).toFixed(1),
      model_training_ready:  trainingReady,
      notes:                 `Snapshot created at ${new Date().toLocaleString()}`,
      azure_container_url:   `https://purpulse.blob.core.windows.net/datasets/snapshot-${new Date().toISOString().slice(0,10)}`,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-snapshots'] }),
  });

  // ── CSV export helpers ────────────────────────────────────────────
  const exportManifests = () => {
    downloadCSV(rowsToCSV(manifests), `purpulse-manifest-${new Date().toISOString().slice(0,10)}.csv`);
    base44.entities.AuditLog.create({
      action_type: 'manifest_exported', actor_email: 'admin@purpulse.com',
      actor_role: 'admin', result: 'success',
      payload_summary: JSON.stringify({ rows: manifests.length }),
      client_ts: new Date().toISOString(), server_ts: new Date().toISOString(),
    }).catch(() => {});
  };

  const exportAuditLogs = () => {
    downloadCSV(rowsToCSV(auditLogs), `purpulse-audit-${new Date().toISOString().slice(0,10)}.csv`);
    base44.entities.AuditLog.create({
      action_type: 'audit_exported', actor_email: 'admin@purpulse.com',
      actor_role: 'admin', result: 'success',
      payload_summary: JSON.stringify({ rows: auditLogs.length }),
      client_ts: new Date().toISOString(), server_ts: new Date().toISOString(),
    }).catch(() => {});
  };

  // ── Column defs ───────────────────────────────────────────────────
  const MANIFEST_COLS = [
    { key: 'job_id',         label: 'Job ID',      render: v => <span className="font-mono text-[10px]">{v?.slice(0,10)}…</span> },
    { key: 'filename',       label: 'File' },
    { key: 'evidence_type',  label: 'Type' },
    { key: 'size_bytes',     label: 'Size',        render: v => v ? `${(v/1024).toFixed(0)} KB` : '—' },
    { key: 'sha256',         label: 'SHA-256',     render: v => <span className="font-mono text-[10px]">{v?.slice(0,12)}…</span> },
    { key: 'geo_lat',        label: 'Lat',         render: v => v?.toFixed(4) ?? '—' },
    { key: 'approved_for_training', label: 'Training', render: v => v ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-slate-300">—</span> },
    { key: 'capture_ts',     label: 'Captured',    render: fmtTs },
    { key: 'azure_indexed',  label: 'Azure',       render: v => v ? <span className="text-blue-600 font-bold">✓</span> : <span className="text-slate-300">—</span> },
  ];

  const AUDIT_COLS = [
    { key: 'client_ts',     label: 'Time',       render: fmtTs },
    { key: 'action_type',   label: 'Action',     render: v => <span className="font-mono text-[10px] bg-slate-100 px-1 rounded">{v}</span> },
    { key: 'actor_email',   label: 'Actor',      render: v => <span className="text-[10px]">{v}</span> },
    { key: 'actor_role',    label: 'Role' },
    { key: 'result',        label: 'Result',     render: v => <span className={cn('font-bold text-[10px]', v === 'success' ? 'text-emerald-600' : 'text-red-600')}>{v}</span> },
    { key: 'entity_type',   label: 'Entity' },
    { key: 'duration_ms',   label: 'ms',         render: v => v ?? '—' },
  ];

  const LABEL_COLS = [
    { key: 'evidence_id',   label: 'Evidence ID',  render: v => <span className="font-mono text-[10px]">{v?.slice(0,12)}…</span> },
    { key: 'label_type',    label: 'Type' },
    { key: 'label_value',   label: 'Value' },
    { key: 'confidence',    label: 'Conf.',         render: v => v?.toFixed(2) },
    { key: 'qc_status',     label: 'QC',            render: v => <span className={cn('font-bold text-[10px]', v === 'approved' ? 'text-emerald-600' : v === 'rejected' ? 'text-red-600' : 'text-amber-600')}>{v}</span> },
    { key: 'approved_for_training', label: 'Training', render: v => v ? <span className="text-emerald-600 font-bold">✓</span> : '—' },
    { key: 'labeled_by',    label: 'Labeled by',    render: v => <span className="text-[10px]">{v}</span> },
    { key: 'labeled_at',    label: 'When',          render: fmtTs },
  ];

  const MEETING_COLS = [
    { key: 'title',          label: 'Title' },
    { key: 'meeting_type',   label: 'Type' },
    { key: 'scheduled_at',   label: 'Scheduled', render: fmtTs },
    { key: 'duration_min',   label: 'Min' },
    { key: 'status',         label: 'Status',    render: v => <span className="text-[10px] font-bold capitalize">{v}</span> },
    { key: 'transcript_url', label: 'Transcript', render: v => v ? <span className="text-blue-600 font-bold">✓ attached</span> : '—' },
  ];

  const SECTIONS = [
    { id: 'metrics',   label: 'Metrics',  icon: BarChart3 },
    { id: 'manifest',  label: 'Manifest', icon: Image },
    { id: 'audit',     label: 'Audit Log',icon: Layers },
    { id: 'labels',    label: 'Labels',   icon: Tag },
    { id: 'meetings',  label: 'Meetings', icon: Calendar },
    { id: 'snapshots', label: 'Snapshots',icon: Database },
    { id: 'timeline',  label: 'Timeline', icon: Clock },
  ];

  return (
    <AdminShell title="Manifest & Model Data" subtitle="Upload manifest, audit logs, labels, and ML readiness">
      {/* ── Section tabs ────────────────────────────────────────── */}
      <div className="flex gap-1 flex-wrap mb-6 border-b border-slate-100 pb-3">
        {SECTIONS.map(s => {
          const Icon = s.icon;
          const active = activeSection === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                'flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-xs font-bold transition-colors',
                active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          );
        })}

        {/* Refresh + Seed */}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => qc.invalidateQueries()} className="h-8 w-8 rounded-[8px] bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
            <RefreshCw className={cn('h-3.5 w-3.5 text-slate-500', isLoading && 'animate-spin')} />
          </button>
          <button
            onClick={() => { setSeedLog([]); seedMutation.mutate(); }}
            disabled={seedMutation.isPending}
            className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {seedMutation.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <PackagePlus className="h-3.5 w-3.5" />}
            Seed Mock Data
          </button>
        </div>
      </div>

      {/* Seed log */}
      {seedLog.length > 0 && (
        <div className="mb-4 p-3 bg-slate-900 rounded-[8px] font-mono text-xs text-emerald-400 space-y-0.5 max-h-24 overflow-y-auto">
          {seedLog.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}

      {/* ── Metrics ──────────────────────────────────────────────── */}
      {activeSection === 'metrics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <MetricCard icon={Image}       label="Total Evidence"          value={totalEvidence}     color="text-blue-600" />
            <MetricCard icon={BarChart3}   label="Avg Images / Job"        value={avgImgPerJob}      color="text-indigo-600" />
            <MetricCard icon={CheckCircle2} label="Photos with Geo"        value={geoEvidence}       color="text-emerald-600" sub={`${totalEvidence ? ((geoEvidence/totalEvidence)*100).toFixed(0) : 0}% coverage`} />
            <MetricCard icon={Tag}         label="Labeled Evidence"        value={labels.length}     color="text-amber-600"  sub={`${labelCoverage}% of uploads`} />
            <MetricCard icon={Zap}         label="Approved for Training"   value={approvedTraining}  color={approvedTraining >= 500 ? 'text-emerald-600' : 'text-rose-600'} sub={approvedTraining >= 500 ? '✓ Training ready' : `Need ${500 - approvedTraining} more`} />
            <MetricCard icon={Layers}      label="Embeddings"              value={withEmbedding}     color="text-purple-600" sub="512-dim vectors" />
            <MetricCard icon={Mic}         label="Transcripts"             value={transcriptCount}   color="text-cyan-600" />
            <MetricCard icon={Database}    label="Audit Log Entries"       value={auditLogs.length}  color="text-slate-600" />
          </div>

          {/* Training readiness banner */}
          <div className={cn('rounded-[8px] p-4 border flex items-center gap-3',
            trainingReady ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
          )}>
            {trainingReady
              ? <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              : <AlertCircle  className="h-5 w-5 text-amber-600 flex-shrink-0" />}
            <div>
              <p className={cn('text-sm font-bold', trainingReady ? 'text-emerald-800' : 'text-amber-800')}>
                {trainingReady ? 'Dataset is model-training ready' : 'Dataset not yet training-ready'}
              </p>
              <p className={cn('text-xs mt-0.5', trainingReady ? 'text-emerald-700' : 'text-amber-700')}>
                {trainingReady
                  ? `${approvedTraining} approved records exceed the 500-sample threshold.`
                  : `${approvedTraining}/500 approved samples. Approve more evidence in the QC panel.`}
              </p>
            </div>
          </div>

          {/* Latest snapshot */}
          {snapshots[0] && (
            <div className="bg-white rounded-[8px] border border-slate-100 p-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Latest Snapshot · {snapshots[0].snapshot_date}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {[
                  ['Jobs',         snapshots[0].total_jobs],
                  ['Evidence',     snapshots[0].total_evidence],
                  ['Labeled',      snapshots[0].labeled_evidence],
                  ['Training ✓',   snapshots[0].approved_for_training],
                  ['Geo %',        `${snapshots[0].evidence_with_geo}`],
                  ['Transcripts',  snapshots[0].transcript_count],
                  ['Dataset MB',   snapshots[0].dataset_size_mb],
                  ['Embedding %',  `${snapshots[0].embedding_coverage_pct}%`],
                ].map(([k, v]) => (
                  <div key={k} className="bg-slate-50 rounded p-2">
                    <p className="text-[10px] text-slate-400 font-semibold">{k}</p>
                    <p className="text-sm font-black text-slate-900">{v ?? '—'}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">{snapshots[0].notes}</p>
            </div>
          )}

          <button
            onClick={() => createSnapshot.mutate()}
            disabled={createSnapshot.isPending}
            className="flex items-center gap-2 h-9 px-4 rounded-[8px] bg-slate-900 text-white text-xs font-bold disabled:opacity-50"
          >
            {createSnapshot.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
            Create Dataset Snapshot Now
          </button>
        </div>
      )}

      {/* ── Upload Manifest ──────────────────────────────────────── */}
      {activeSection === 'manifest' && (
        <div>
          <SectionHeader title={`Upload Manifest (${manifests.length})`}>
            <button onClick={exportManifests} className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-slate-900 text-white text-xs font-bold">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </SectionHeader>
          <TableShell columns={MANIFEST_COLS} rows={manifests.slice(0, 100)} emptyMsg="No manifest rows — click Seed Mock Data to populate" />
        </div>
      )}

      {/* ── Audit Log ────────────────────────────────────────────── */}
      {activeSection === 'audit' && (
        <div>
          <SectionHeader title={`Audit Log (${auditLogs.length})`}>
            <button onClick={exportAuditLogs} className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-slate-900 text-white text-xs font-bold">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </SectionHeader>
          <TableShell columns={AUDIT_COLS} rows={auditLogs.slice(0, 100)} emptyMsg="No audit entries — seed mock data or perform some actions" />
        </div>
      )}

      {/* ── Labels ───────────────────────────────────────────────── */}
      {activeSection === 'labels' && (
        <div>
          <SectionHeader title={`Label Records (${labels.length})`} />
          <TableShell columns={LABEL_COLS} rows={labels.slice(0, 100)} emptyMsg="No label records yet" />
        </div>
      )}

      {/* ── Meetings ─────────────────────────────────────────────── */}
      {activeSection === 'meetings' && (
        <div>
          <SectionHeader title={`Meetings (${meetings.length})`} />
          <TableShell columns={MEETING_COLS} rows={meetings} emptyMsg="No meetings yet" />
        </div>
      )}

      {/* ── Dataset Snapshots ─────────────────────────────────────── */}
      {activeSection === 'snapshots' && (
        <div className="space-y-3">
          <SectionHeader title="Dataset Snapshots">
            <button
              onClick={() => createSnapshot.mutate()}
              disabled={createSnapshot.isPending}
              className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-slate-900 text-white text-xs font-bold disabled:opacity-50"
            >
              {createSnapshot.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
              New Snapshot
            </button>
          </SectionHeader>
          {snapshots.length === 0 && <p className="text-xs text-slate-400 text-center py-6">No snapshots — create one above</p>}
          {snapshots.map(s => (
            <div key={s.id} className="bg-white rounded-[8px] border border-slate-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-black text-slate-900">{s.snapshot_date}</p>
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded border', s.model_training_ready ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200')}>
                  {s.model_training_ready ? '✓ Training Ready' : 'Not Ready'}
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs mb-2">
                {[['Evidence', s.total_evidence], ['w/ Geo', s.evidence_with_geo], ['Labeled', s.labeled_evidence], ['Approved', s.approved_for_training], ['Transcripts', s.transcript_count], ['MB', s.dataset_size_mb]].map(([k, v]) => (
                  <div key={k} className="bg-slate-50 rounded p-1.5">
                    <p className="text-[9px] text-slate-400">{k}</p>
                    <p className="font-black text-slate-800">{v ?? '—'}</p>
                  </div>
                ))}
              </div>
              {s.notes && <p className="text-[11px] text-slate-400">{s.notes}</p>}
              {s.azure_container_url && <p className="text-[10px] font-mono text-blue-500 mt-1 truncate">{s.azure_container_url}</p>}
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}