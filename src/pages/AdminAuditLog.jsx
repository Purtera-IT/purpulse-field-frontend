/**
 * AdminAuditLog — searchable audit log viewer
 *
 * Sources (merged):
 *   - SyncQueue items (all entity changes)
 *   - TimeEntry records with source=manual/drag_edit
 *   - Evidence records with qc_status overrides
 *
 * Filters:
 *   - Free-text (searches job_id, entity_id, client_request_id, payload)
 *   - Date range (from / to)
 *   - Entity type dropdown
 *   - Action type dropdown
 *   - Source (app / manual / drag_edit)
 *
 * QA note:
 *   client_event_id = client_request_id on SyncQueue and TimeEntry records.
 *   Searching by this field finds the exact event across retries (idempotency key).
 *
 * Export: copies visible rows as JSON to clipboard.
 */
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import {
  Search, Filter, Copy, Check, RefreshCw, ScrollText,
  ChevronDown, ChevronUp, AlertTriangle, Lock, Pencil, Smartphone
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import AdminShell from '../components/admin/AdminShell';

const ACTION_ICONS = {
  create:  <span className="text-emerald-600 font-black text-[10px]">CREATE</span>,
  update:  <span className="text-blue-600 font-black text-[10px]">UPDATE</span>,
  delete:  <span className="text-red-600 font-black text-[10px]">DELETE</span>,
  override:<span className="text-orange-600 font-black text-[10px]">OVERRIDE</span>,
  lock:    <span className="text-amber-600 font-black text-[10px]">LOCK</span>,
};

const SOURCE_COLORS = {
  app:       'bg-slate-100 text-slate-600',
  manual:    'bg-amber-100 text-amber-700',
  drag_edit: 'bg-blue-100 text-blue-700',
  system:    'bg-purple-100 text-purple-700',
};

function LogRow({ entry }) {
  const [expanded, setExpanded] = useState(false);
  let payload = null;
  if (entry.payload) { try { payload = JSON.parse(entry.payload); } catch {} }

  return (
    <>
      <tr className={cn('border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer',
        expanded && 'bg-slate-50'
      )} onClick={() => setExpanded(v => !v)}>
        <td className="px-4 py-3 text-xs font-mono text-slate-400 whitespace-nowrap">
          {entry.timestamp ? format(new Date(entry.timestamp), 'MMM d HH:mm:ss') : '—'}
        </td>
        <td className="px-4 py-3">{ACTION_ICONS[entry.action] || ACTION_ICONS.create}</td>
        <td className="px-4 py-3 text-xs font-semibold text-slate-700 capitalize">
          {entry.entity_type?.replace(/_/g,' ')}
        </td>
        <td className="px-4 py-3 text-xs font-mono text-slate-500 max-w-[100px] truncate">{entry.entity_id || '—'}</td>
        <td className="px-4 py-3">
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', SOURCE_COLORS[entry.source] || SOURCE_COLORS.app)}>
            {entry.source || 'app'}
          </span>
        </td>
        <td className="px-4 py-3 text-xs font-mono text-slate-400 max-w-[160px] truncate">{entry.client_request_id || '—'}</td>
        <td className="px-4 py-3 text-xs text-slate-500 max-w-[120px] truncate">{entry.job_id || '—'}</td>
        <td className="px-4 py-3">
          {entry.locked && <Lock className="h-3.5 w-3.5 text-amber-500" />}
        </td>
        <td className="px-4 py-3 text-slate-300">
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-200">
          <td colSpan={9} className="bg-slate-50 px-6 py-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {entry.notes && (
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Notes / Reason</p>
                  <p className="text-xs text-slate-700 bg-white rounded-lg px-3 py-2 border border-slate-200">{entry.notes}</p>
                </div>
              )}
              {payload && (
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Payload</p>
                  <pre className="text-[10px] font-mono text-slate-600 bg-white rounded-lg px-3 py-2 border border-slate-200 overflow-auto max-h-32 whitespace-pre-wrap">
                    {JSON.stringify(payload, null, 2)}
                  </pre>
                </div>
              )}
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Event IDs</p>
                <div className="bg-white rounded-lg px-3 py-2 border border-slate-200 font-mono space-y-0.5">
                  <p className="text-[10px]"><span className="text-slate-400">record_id: </span><span className="text-slate-700">{entry.id}</span></p>
                  {entry.client_request_id && <p className="text-[10px]"><span className="text-slate-400">client_event_id: </span><span className="text-slate-700">{entry.client_request_id}</span></p>}
                  {entry.approved_by && <p className="text-[10px]"><span className="text-slate-400">approved_by: </span><span className="text-amber-700 font-semibold">{entry.approved_by}</span></p>}
                  {entry.retry_count > 0 && <p className="text-[10px]"><span className="text-slate-400">retries: </span><span className="text-orange-600">{entry.retry_count}</span></p>}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AdminAuditLog() {
  const [search,      setSearch]      = useState('');
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');
  const [filterType,  setFilterType]  = useState('all');
  const [filterAction,setFilterAction]= useState('all');
  const [filterSource,setFilterSource]= useState('all');
  const [copied,      setCopied]      = useState(false);

  const { data: syncItems = [], isLoading: syncLoading } = useQuery({
    queryKey: ['sync-queue-all'],
    queryFn: () => base44.entities.SyncQueue.list('-created_date', 500),
  });
  const { data: timeEntries = [], isLoading: timeLoading } = useQuery({
    queryKey: ['all-time-entries'],
    queryFn: () => base44.entities.TimeEntry.list('-timestamp', 500),
  });

  // Normalize all entries into a unified log format
  const allEntries = useMemo(() => {
    const syncRows = syncItems.map(s => ({
      id: s.id, timestamp: s.created_date, action: s.action,
      entity_type: s.entity_type, entity_id: s.entity_id,
      source: 'system', client_request_id: s.client_request_id,
      job_id: s.job_id, payload: s.payload, notes: null,
      locked: false, retry_count: s.retry_count || 0,
    }));
    const timeRows = timeEntries
      .filter(e => e.source && e.source !== 'app')
      .map(e => ({
        id: e.id, timestamp: e.timestamp, action: e.locked ? 'lock' : 'update',
        entity_type: 'time_entry', entity_id: e.id,
        source: e.source || 'app', client_request_id: e.client_request_id,
        job_id: e.job_id, payload: null, notes: e.notes,
        locked: e.locked || false, approved_by: e.approved_by, retry_count: 0,
      }));
    return [...syncRows, ...timeRows].sort((a, b) =>
      new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
    );
  }, [syncItems, timeEntries]);

  const entityTypes = [...new Set(allEntries.map(e => e.entity_type).filter(Boolean))];
  const actions     = [...new Set(allEntries.map(e => e.action).filter(Boolean))];
  const sources     = [...new Set(allEntries.map(e => e.source).filter(Boolean))];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allEntries.filter(e => {
      const matchSearch = !q || [e.job_id, e.entity_id, e.client_request_id, e.payload, e.notes, e.entity_type]
        .some(f => f?.toLowerCase().includes(q));
      const matchType   = filterType   === 'all' || e.entity_type === filterType;
      const matchAction = filterAction === 'all' || e.action      === filterAction;
      const matchSource = filterSource === 'all' || e.source      === filterSource;
      let matchDate = true;
      if (dateFrom || dateTo) {
        const ts = e.timestamp ? new Date(e.timestamp) : null;
        if (ts) {
          if (dateFrom && ts < startOfDay(parseISO(dateFrom))) matchDate = false;
          if (dateTo   && ts > endOfDay(parseISO(dateTo)))     matchDate = false;
        } else matchDate = false;
      }
      return matchSearch && matchType && matchAction && matchSource && matchDate;
    });
  }, [allEntries, search, filterType, filterAction, filterSource, dateFrom, dateTo]);

  const handleCopyVisible = async () => {
    await navigator.clipboard.writeText(JSON.stringify(filtered, null, 2));
    setCopied(true);
    toast.success(`${filtered.length} rows copied as JSON`);
    setTimeout(() => setCopied(false), 2000);
  };

  const isLoading = syncLoading || timeLoading;

  return (
    <AdminShell title="Audit Log" subtitle="All entity changes, time edits, QC overrides, and locks">
      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by job_id, entity_id, client_event_id, notes…"
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="h-9 px-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="h-9 px-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="h-9 px-3 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none self-end"
            >
              <option value="all">All Types</option>
              {entityTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
              className="h-9 px-3 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none self-end"
            >
              <option value="all">All Actions</option>
              {actions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
              className="h-9 px-3 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none self-end"
            >
              <option value="all">All Sources</option>
              {sources.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={handleCopyVisible}
              className={cn('flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold self-end transition-all',
                copied ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              )}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              Export JSON
            </button>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mt-2">
          💡 Tip: paste a <code className="bg-slate-100 px-1 rounded">client_event_id</code> to trace a specific event across retries
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><RefreshCw className="h-5 w-5 animate-spin text-slate-400" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Timestamp','Action','Type','Entity ID','Source','client_event_id','Job ID','',''].map((h,i) => (
                    <th key={i} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(entry => <LogRow key={entry.id + entry.timestamp} entry={entry} />)}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <ScrollText className="h-10 w-10 text-slate-200 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No log entries match filters</p>
          </div>
        )}
        <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
          {filtered.length} of {allEntries.length} events
        </div>
      </div>
    </AdminShell>
  );
}