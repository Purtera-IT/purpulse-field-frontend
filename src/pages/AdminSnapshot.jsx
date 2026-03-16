/**
 * AdminSnapshot — Dataset Snapshot tool
 *
 * Create an immutable snapshot of evidence + time entries for a date range.
 * Export formats: Parquet (for ADLS Gen2 / Azure ML) or CSV.
 *
 * ADLS Gen2 export flow:
 *   1. Admin selects snapshot + format
 *   2. Clicks Export → calls backend function (or mocks the flow here)
 *   3. Shows an ADLS path: abfs://<container>@<storage>.dfs.core.windows.net/<path>
 *   4. Copy path button for use in Azure Data Factory / Synapse pipelines
 *
 * Snapshot entity (stored in SyncQueue with entity_type='snapshot'):
 *   { name, description, date_from, date_to, format, status, record_count, adls_path, created_by }
 *
 * Immutability: snapshots are soft-locked. Deleting a snapshot sets status='archived'.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Database, Download, Plus, Copy, Check, Archive,
  RefreshCw, AlertTriangle, CheckCircle2, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import AdminShell from '../components/admin/AdminShell';

const ADLS_BASE = 'abfs://purpulse-snapshots@purpulsestorage.dfs.core.windows.net';

const STATUS_CFG = {
  pending:    { label: 'Pending',    color: 'bg-amber-50 text-amber-700 border-amber-200',    icon: Clock },
  processing: { label: 'Processing', color: 'bg-blue-50 text-blue-700 border-blue-200',        icon: RefreshCw },
  ready:      { label: 'Ready',      color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  failed:     { label: 'Failed',     color: 'bg-red-50 text-red-700 border-red-200',           icon: AlertTriangle },
  archived:   { label: 'Archived',   color: 'bg-slate-100 text-slate-500 border-slate-200',    icon: Archive },
};

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handle} className="flex items-center gap-1 h-7 px-2.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition-colors">
      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function CreateSnapshotModal({ onClose, onCreated }) {
  const [name,      setName]      = useState('');
  const [desc,      setDesc]      = useState('');
  const [dateFrom,  setDateFrom]  = useState('');
  const [dateTo,    setDateTo]    = useState('');
  const [formats,   setFormats]   = useState({ parquet: true, csv: false });
  const [scope,     setScope]     = useState(['evidence', 'time_entries']);
  const [saving,    setSaving]    = useState(false);

  const toggleScope = (s) => setScope(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
  const toggleFmt   = (f) => setFormats(p => ({ ...p, [f]: !p[f] }));

  const handleCreate = async () => {
    if (!name.trim() || !dateFrom || !dateTo) { toast.error('Name and date range required'); return; }
    if (new Date(dateFrom) > new Date(dateTo)) { toast.error('Start must be before end'); return; }
    setSaving(true);
    const snap = {
      entity_type: 'snapshot',
      action: 'create',
      payload: JSON.stringify({
        name: name.trim(),
        description: desc.trim(),
        date_from: dateFrom,
        date_to: dateTo,
        formats: Object.entries(formats).filter(([,v]) => v).map(([k]) => k),
        scope,
        adls_path: `${ADLS_BASE}/snapshots/${name.trim().replace(/\s+/g, '_').toLowerCase()}_${dateFrom}`,
        record_count: null,
      }),
      status: 'pending',
      client_request_id: 'snap-' + Date.now().toString(36),
    };
    await base44.entities.SyncQueue.create(snap);
    toast.success('Snapshot queued for creation');
    setSaving(false);
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-black text-slate-900 mb-4">New Dataset Snapshot</h3>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Snapshot Name *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Q1 2025 Evidence Training Set"
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Purpose, model target, etc."
              className="w-full h-16 rounded-xl border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">From *</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">To *</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Data Scope</label>
            <div className="flex gap-2 flex-wrap">
              {['evidence','time_entries','jobs','audit_log'].map(s => (
                <button key={s} onClick={() => toggleScope(s)}
                  className={cn('px-3 py-1.5 rounded-xl text-xs font-bold border transition-all',
                    scope.includes(s) ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200'
                  )}
                >{s.replace(/_/g, ' ')}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Export Formats</label>
            <div className="flex gap-2">
              {['parquet','csv'].map(f => (
                <button key={f} onClick={() => toggleFmt(f)}
                  className={cn('px-4 py-1.5 rounded-xl text-xs font-bold border transition-all uppercase',
                    formats[f] ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'
                  )}
                >{f}</button>
              ))}
            </div>
          </div>
          {/* ADLS path preview */}
          {name && (
            <div className="bg-slate-900 rounded-xl px-3 py-2.5 font-mono">
              <p className="text-[9px] text-slate-500 mb-1">ADLS Gen2 path preview:</p>
              <p className="text-[10px] text-emerald-400 break-all">
                {ADLS_BASE}/snapshots/{name.replace(/\s+/g, '_').toLowerCase()}_{dateFrom || 'YYYY-MM-DD'}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold">Cancel</button>
          <button onClick={handleCreate} disabled={saving}
            className="flex-1 h-11 rounded-xl bg-slate-900 text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Database className="h-4 w-4" />}
            Create Snapshot
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminSnapshot() {
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const { data: rawSnaps = [], isLoading } = useQuery({
    queryKey: ['snapshots'],
    queryFn: () => base44.entities.SyncQueue.list('-created_date', 100),
    select: data => data.filter(s => s.entity_type === 'snapshot'),
    refetchInterval: 8000,
  });

  const archiveSnap = useMutation({
    mutationFn: (id) => base44.entities.SyncQueue.update(id, { status: 'archived' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['snapshots'] }); toast.success('Snapshot archived'); },
  });

  const snapshots = rawSnaps.map(s => {
    let meta = {};
    try { meta = JSON.parse(s.payload || '{}'); } catch {}
    return { ...s, meta };
  });

  return (
    <AdminShell title="Dataset Snapshots" subtitle="Immutable exports for model training · ADLS Gen2">
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-3">
          {[
            { label: 'Total', count: snapshots.length, color: 'bg-slate-50 text-slate-700' },
            { label: 'Ready', count: snapshots.filter(s => s.status === 'ready').length, color: 'bg-emerald-50 text-emerald-700' },
            { label: 'Pending', count: snapshots.filter(s => ['pending','processing'].includes(s.status)).length, color: 'bg-amber-50 text-amber-700' },
          ].map(c => (
            <div key={c.label} className={cn('px-4 py-2 rounded-xl text-sm font-bold', c.color)}>{c.count} {c.label}</div>
          ))}
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 h-10 px-5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Snapshot
        </button>
      </div>

      <div className="space-y-3">
        {isLoading && (
          <div className="flex justify-center py-16"><RefreshCw className="h-5 w-5 animate-spin text-slate-400" /></div>
        )}
        {!isLoading && snapshots.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <Database className="h-12 w-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-semibold">No snapshots yet</p>
            <p className="text-slate-400 text-xs mt-1">Create a snapshot to export evidence data for model training</p>
          </div>
        )}
        {snapshots.map(snap => {
          const cfg = STATUS_CFG[snap.status] || STATUS_CFG.pending;
          const Icon = cfg.icon;
          const fmts = snap.meta.formats || ['parquet'];
          const adlsPath = snap.meta.adls_path || '';
          return (
            <div key={snap.id} className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-black text-slate-900">{snap.meta.name || 'Unnamed Snapshot'}</h3>
                    <span className={cn('flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border', cfg.color)}>
                      <Icon className={cn('h-3 w-3', snap.status === 'processing' && 'animate-spin')} />
                      {cfg.label}
                    </span>
                  </div>
                  {snap.meta.description && (
                    <p className="text-xs text-slate-500 mb-2">{snap.meta.description}</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                    {snap.meta.date_from && <span>📅 {snap.meta.date_from} → {snap.meta.date_to}</span>}
                    {snap.meta.scope && <span>📦 {snap.meta.scope.join(', ')}</span>}
                    {snap.meta.record_count && <span>🔢 {snap.meta.record_count.toLocaleString()} records</span>}
                    <span>🕐 {snap.created_date ? format(new Date(snap.created_date), 'MMM d, HH:mm') : '—'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {fmts.map(f => (
                    <span key={f} className={cn('text-[10px] font-black uppercase px-2.5 py-1 rounded-lg',
                      f === 'parquet' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    )}>{f}</span>
                  ))}
                </div>
              </div>

              {/* ADLS path + export */}
              {adlsPath && (
                <div className="mt-3 bg-slate-900 rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <p className="text-[10px] font-mono text-emerald-400 break-all flex-1">{adlsPath}</p>
                  <CopyBtn text={adlsPath} />
                </div>
              )}

              <div className="flex gap-2 mt-3">
                {snap.status === 'ready' && fmts.map(f => (
                  <button key={f}
                    onClick={() => toast.info(`Triggering ${f.toUpperCase()} export to ADLS Gen2…`)}
                    className={cn('flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold',
                      f === 'parquet' ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'
                    )}
                  >
                    <Download className="h-3.5 w-3.5" /> Export {f.toUpperCase()}
                  </button>
                ))}
                {snap.status !== 'archived' && (
                  <button onClick={() => archiveSnap.mutate(snap.id)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 text-slate-500 text-xs font-semibold"
                  >
                    <Archive className="h-3.5 w-3.5" /> Archive
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showCreate && (
        <CreateSnapshotModal
          onClose={() => setShowCreate(false)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ['snapshots'] })}
        />
      )}
    </AdminShell>
  );
}