/**
 * AdminAuditLog — queries the real AuditLog entity.
 * Filters: date range, user_id (actor_email), object_type (entity_type), action (action_type)
 */
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { Search, RefreshCw, ScrollText, ChevronDown, ChevronUp, Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import AdminShell from '../components/admin/AdminShell';

// ── helpers ─────────────────────────────────────────────────────────
function fmtTs(ts) {
  if (!ts) return '—';
  try { return format(parseISO(ts), 'MMM d HH:mm:ss'); } catch { return ts; }
}

const ACTION_COLOR = {
  evidence_upload:            'bg-blue-100 text-blue-700',
  evidence_retake:            'bg-amber-100 text-amber-700',
  evidence_delete:            'bg-red-100 text-red-700',
  label_applied:              'bg-purple-100 text-purple-700',
  label_approved:             'bg-emerald-100 text-emerald-700',
  label_rejected:             'bg-red-100 text-red-700',
  runbook_step_complete:      'bg-teal-100 text-teal-700',
  meeting_created:            'bg-cyan-100 text-cyan-700',
  meeting_transcript_attached:'bg-sky-100 text-sky-700',
  manifest_exported:          'bg-slate-100 text-slate-600',
  audit_exported:             'bg-slate-100 text-slate-600',
  job_status_change:          'bg-indigo-100 text-indigo-700',
  closeout_submitted:         'bg-emerald-100 text-emerald-700',
};

const RESULT_COLOR = {
  success: 'text-emerald-600',
  error:   'text-red-600',
  skipped: 'text-slate-400',
};

function ActionBadge({ v }) {
  const cls = ACTION_COLOR[v] || 'bg-slate-100 text-slate-600';
  return <span className={cn('inline-block px-1.5 py-0.5 rounded text-[10px] font-bold font-mono whitespace-nowrap', cls)}>{v || '—'}</span>;
}

// ── Row ──────────────────────────────────────────────────────────────
function LogRow({ entry }) {
  const [open, setOpen] = useState(false);
  let details = null;
  if (entry.payload_summary) { try { details = JSON.parse(entry.payload_summary); } catch { details = entry.payload_summary; } }

  return (
    <>
      <tr
        className={cn('border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors', open && 'bg-slate-50')}
        onClick={() => setOpen(v => !v)}
      >
        <td className="px-3 py-2.5 text-[11px] font-mono text-slate-400 whitespace-nowrap">{fmtTs(entry.client_ts || entry.server_ts)}</td>
        <td className="px-3 py-2.5"><ActionBadge v={entry.action_type} /></td>
        <td className="px-3 py-2.5 text-xs text-slate-600 capitalize">{entry.entity_type?.replace(/_/g,' ') || '—'}</td>
        <td className="px-3 py-2.5 text-[10px] font-mono text-slate-400 max-w-[90px] truncate">{entry.entity_id?.slice(0,10) || '—'}</td>
        <td className="px-3 py-2.5 text-xs text-slate-600 max-w-[140px] truncate">{entry.actor_email || '—'}</td>
        <td className="px-3 py-2.5">
          <span className={cn('text-[10px] font-bold capitalize', RESULT_COLOR[entry.result] || 'text-slate-400')}>
            {entry.result || '—'}
          </span>
        </td>
        <td className="px-3 py-2.5 text-[10px] font-mono text-slate-400 max-w-[100px] truncate">{entry.job_id || '—'}</td>
        <td className="px-3 py-2.5 text-[10px] text-slate-300 tabular-nums">{entry.duration_ms != null ? `${entry.duration_ms}ms` : '—'}</td>
        <td className="px-3 py-2.5 text-slate-300">{open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</td>
      </tr>
      {open && (
        <tr className="border-b border-slate-200">
          <td colSpan={9} className="bg-slate-50 px-5 py-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Identity</p>
                <div className="bg-white border border-slate-200 rounded-[6px] px-3 py-2 font-mono space-y-0.5">
                  {[
                    ['record_id',   entry.id],
                    ['actor_email', entry.actor_email],
                    ['actor_role',  entry.actor_role],
                    ['session_id',  entry.session_id],
                    ['device_id',   entry.device_id],
                    ['ip_address',  entry.ip_address],
                  ].map(([k, v]) => v ? (
                    <p key={k} className="text-[10px]">
                      <span className="text-slate-400">{k}: </span>
                      <span className="text-slate-700">{v}</span>
                    </p>
                  ) : null)}
                </div>
              </div>
              {details && (
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Details / Diff</p>
                  <pre className="bg-white border border-slate-200 rounded-[6px] px-3 py-2 text-[10px] font-mono text-slate-600 overflow-auto max-h-36 whitespace-pre-wrap">
                    {typeof details === 'object' ? JSON.stringify(details, null, 2) : details}
                  </pre>
                </div>
              )}
              {entry.error_message && (
                <div className="md:col-span-2">
                  <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-1">Error</p>
                  <p className="text-xs text-red-600 bg-red-50 rounded-[6px] px-3 py-2 border border-red-200">{entry.error_message}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Filter bar ───────────────────────────────────────────────────────
function FilterChip({ label, onClear }) {
  return (
    <span className="inline-flex items-center gap-1 bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
      {label}
      <button onClick={onClear} className="opacity-60 hover:opacity-100"><X className="h-2.5 w-2.5" /></button>
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────────────
export default function AdminAuditLog() {
  const [search,       setSearch]       = useState('');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [filterUser,   setFilterUser]   = useState('');
  const [filterType,   setFilterType]   = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [filterResult, setFilterResult] = useState('all');

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['audit-log-full'],
    queryFn: () => base44.entities.AuditLog.list('-client_ts', 500),
    staleTime: 15_000,
  });

  // Derive unique filter options from data
  const entityTypes  = useMemo(() => [...new Set(logs.map(l => l.entity_type).filter(Boolean))].sort(), [logs]);
  const actionTypes  = useMemo(() => [...new Set(logs.map(l => l.action_type).filter(Boolean))].sort(), [logs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter(entry => {
      const ts = entry.client_ts || entry.server_ts;
      if (dateFrom && ts && new Date(ts) < startOfDay(parseISO(dateFrom))) return false;
      if (dateTo   && ts && new Date(ts) > endOfDay(parseISO(dateTo)))     return false;
      if (filterUser   && !entry.actor_email?.toLowerCase().includes(filterUser.toLowerCase())) return false;
      if (filterType   !== 'all' && entry.entity_type !== filterType)   return false;
      if (filterAction !== 'all' && entry.action_type !== filterAction) return false;
      if (filterResult !== 'all' && entry.result      !== filterResult) return false;
      if (q) {
        const hay = [entry.job_id, entry.entity_id, entry.actor_email, entry.action_type,
                     entry.entity_type, entry.payload_summary, entry.error_message].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, search, dateFrom, dateTo, filterUser, filterType, filterAction, filterResult]);

  const activeFilters = [
    filterUser   && { label: `user: ${filterUser}`,   clear: () => setFilterUser('')   },
    filterType   !== 'all' && { label: `type: ${filterType}`,   clear: () => setFilterType('all')   },
    filterAction !== 'all' && { label: `action: ${filterAction}`, clear: () => setFilterAction('all') },
    filterResult !== 'all' && { label: `result: ${filterResult}`, clear: () => setFilterResult('all') },
    dateFrom     && { label: `from: ${dateFrom}`,     clear: () => setDateFrom('')     },
    dateTo       && { label: `to: ${dateTo}`,         clear: () => setDateTo('')       },
  ].filter(Boolean);

  const exportCSV = () => {
    if (!filtered.length) { toast.error('No rows to export'); return; }
    const keys = ['client_ts','action_type','entity_type','entity_id','actor_email','actor_role','result','job_id','duration_ms','error_message','payload_summary'];
    const esc  = v => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g,'""')}"` : s; };
    const csv  = [keys.join(','), ...filtered.map(r => keys.map(k => esc(r[k])).join(','))].join('\n');
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `audit-log-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    toast.success(`Exported ${filtered.length} rows`);
  };

  return (
    <AdminShell title="Audit Log" subtitle="Full AuditLog query — filter by date, user, object type, and action">

      {/* ── Filters ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-[8px] border border-slate-200 p-4 mb-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          {/* Search */}
          <div className="relative flex-1 min-w-44">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search job_id, entity_id, actor, payload…"
              className="w-full h-9 pl-8 pr-3 rounded-[6px] border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>

          {/* User / actor_email */}
          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">User (email)</label>
            <input value={filterUser} onChange={e => setFilterUser(e.target.value)}
              placeholder="actor@email.com"
              className="h-9 px-2.5 rounded-[6px] border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400 w-44"
            />
          </div>

          {/* Date from */}
          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="h-9 px-2 rounded-[6px] border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>

          {/* Date to */}
          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="h-9 px-2 rounded-[6px] border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>

          {/* Object type */}
          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Object Type</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="h-9 px-2 rounded-[6px] border border-slate-200 text-xs bg-white focus:outline-none"
            >
              <option value="all">All Types</option>
              {entityTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Action */}
          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Action</label>
            <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
              className="h-9 px-2 rounded-[6px] border border-slate-200 text-xs bg-white focus:outline-none"
            >
              <option value="all">All Actions</option>
              {actionTypes.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* Result */}
          <div>
            <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">Result</label>
            <select value={filterResult} onChange={e => setFilterResult(e.target.value)}
              className="h-9 px-2 rounded-[6px] border border-slate-200 text-xs bg-white focus:outline-none"
            >
              <option value="all">All</option>
              <option value="success">success</option>
              <option value="error">error</option>
              <option value="skipped">skipped</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-1.5 self-end">
            <button onClick={() => refetch()}
              className="h-9 w-9 rounded-[6px] bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
              <RefreshCw className={cn('h-3.5 w-3.5 text-slate-500', isLoading && 'animate-spin')} />
            </button>
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 h-9 px-3 rounded-[6px] bg-slate-900 text-white text-xs font-bold">
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          </div>
        </div>

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Filters:</span>
            {activeFilters.map((f, i) => <FilterChip key={i} label={f.label} onClear={f.clear} />)}
            <button onClick={() => { setFilterUser(''); setFilterType('all'); setFilterAction('all'); setFilterResult('all'); setDateFrom(''); setDateTo(''); setSearch(''); }}
              className="text-[10px] text-red-500 font-semibold hover:underline ml-1">
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-[8px] border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><RefreshCw className="h-5 w-5 animate-spin text-slate-400" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Timestamp','Action','Object Type','Object ID','User','Result','Job ID','Duration',''].map((h, i) => (
                    <th key={i} className="text-left px-3 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-14 text-slate-400 text-sm">
                    <ScrollText className="h-8 w-8 mx-auto mb-2 text-slate-200" />
                    No entries match filters
                  </td></tr>
                ) : (
                  filtered.map(entry => <LogRow key={entry.id} entry={entry} />)
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">{filtered.length} of {logs.length} entries</p>
          {logs.length >= 500 && <p className="text-[11px] text-amber-600 font-semibold">Showing latest 500 — use date filters to narrow</p>}
        </div>
      </div>
    </AdminShell>
  );
}