/**
 * JobsTable — enterprise desktop data grid for jobs.
 * Server-side sort + pagination via base44 entities.
 * Multi-select with bulk actions.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight,
  CheckSquare, Square, ExternalLink, Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { PRIORITY_CFG, STATUS_CFG } from './JobRichCard';

// ── helpers ──────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  try { return format(parseISO(d), 'MMM d'); } catch { return d; }
}

function SortIcon({ col, sort }) {
  if (sort.col !== col) return <ChevronsUpDown className="h-3 w-3 text-slate-300 flex-shrink-0" />;
  return sort.dir === 'asc'
    ? <ChevronUp className="h-3 w-3 text-slate-700 flex-shrink-0" />
    : <ChevronDown className="h-3 w-3 text-slate-700 flex-shrink-0" />;
}

function Th({ col, label, sort, onSort, className }) {
  const isSorted = col && sort.col === col;
  const ariaSort = !col ? undefined : isSorted ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <th
      scope="col"
      role="columnheader"
      aria-sort={ariaSort}
      className={cn(
        'px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap border-b border-slate-100 bg-slate-50 select-none',
        col && 'cursor-pointer hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-[#0B2D5C] focus-visible:outline-offset-[-2px]',
        className
      )}
      tabIndex={col ? 0 : undefined}
      onClick={col ? () => onSort(col) : undefined}
      onKeyDown={col ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort(col); } } : undefined}
    >
      <span className="flex items-center gap-1">
        {label}
        {col && <SortIcon col={col} sort={sort} />}
      </span>
    </th>
  );
}

// ── Bulk action bar ───────────────────────────────────────────────────
function BulkBar({ selected, jobs, onClear, onBulkAction }) {
  const count = selected.size;
  if (!count) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-[#0B2D5C] text-white rounded-[8px] mb-2 shadow-md">
      <span className="text-sm font-bold">{count} selected</span>
      <div className="flex gap-2 ml-2 flex-wrap">
        {[
          { id: 'reassign',  label: 'Reassign' },
          { id: 'closeout',  label: 'Closeout' },
          { id: 'priority',  label: 'Set Priority' },
        ].map(a => (
          <button
            key={a.id}
            onClick={() => onBulkAction(a.id, [...selected])}
            className="h-7 px-3 rounded-[8px] bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors"
          >
            {a.label}
          </button>
        ))}
      </div>
      <button onClick={onClear} className="ml-auto text-white/60 hover:text-white text-xs font-semibold">
        Clear
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────
export default function JobsTable({ jobs, total, page, pageSize, sort, onSort, onPage, onBulkAction }) {
  const [selected, setSelected] = useState(new Set());

  const allSelected = jobs.length > 0 && jobs.every(j => selected.has(j.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(prev => { const s = new Set(prev); jobs.forEach(j => s.delete(j.id)); return s; });
    } else {
      setSelected(prev => { const s = new Set(prev); jobs.forEach(j => s.add(j.id)); return s; });
    }
  };

  const toggleRow = (id) => {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <BulkBar selected={selected} jobs={jobs} onClear={() => setSelected(new Set())} onBulkAction={onBulkAction} />

      <div className="bg-white rounded-[8px] border border-slate-200 overflow-hidden shadow-[0_2px_6px_rgba(15,23,36,0.06)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse" role="grid" aria-label="Jobs list" aria-rowcount={total}>
            <thead>
              <tr role="row">
                {/* Checkbox */}
                <th scope="col" className="px-3 py-2.5 bg-slate-50 border-b border-slate-100 w-9" role="columnheader">
                  <button
                    onClick={toggleAll}
                    aria-label={allSelected ? 'Deselect all rows' : 'Select all rows'}
                    aria-pressed={allSelected}
                    className="flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#0B2D5C] focus-visible:outline-offset-2 rounded"
                  >
                    {allSelected
                      ? <CheckSquare className="h-4 w-4 text-[#0B2D5C]" />
                      : <Square className="h-4 w-4 text-slate-400" aria-hidden="true" />}
                  </button>
                </th>
                <Th col="status"         label="Status"       sort={sort} onSort={onSort} />
                <Th col="title"          label="Job"          sort={sort} onSort={onSort} className="min-w-[180px]" />
                <Th col="site_name"      label="Site"         sort={sort} onSort={onSort} />
                <Th col="assigned_to"    label="Assignee"     sort={sort} onSort={onSort} />
                <Th col="scheduled_date" label="Scheduled"    sort={sort} onSort={onSort} />
                <Th col="priority"       label="Priority"     sort={sort} onSort={onSort} />
                <Th                      label="Deliverables" />
                <Th                      label="Actions" />
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-14 text-slate-400 text-sm">No jobs match the current filters</td>
                </tr>
              )}
              {jobs.map((job, i) => {
                const statusCfg  = STATUS_CFG[job.status]   || STATUS_CFG.assigned;
                const prioCfg    = PRIORITY_CFG[job.priority] || PRIORITY_CFG.medium;
                const isSelected = selected.has(job.id);
                const deliv      = job.deliverables_remaining ?? 0;

                return (
                  <tr
                    key={job.id}
                    role="row"
                    aria-rowindex={page * pageSize + i + 2}
                    aria-selected={isSelected}
                    tabIndex={0}
                    className={cn(
                      'border-b border-slate-50 last:border-0 transition-colors focus-visible:outline-2 focus-visible:outline-[#0B2D5C] focus-visible:outline-offset-[-2px] focus-visible:rounded',
                      isSelected ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40',
                      'hover:bg-slate-50'
                    )}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRow(job.id); } }}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-2">
                      <button onClick={() => toggleRow(job.id)} aria-label={`Select ${job.title}`} className="flex items-center justify-center">
                        {isSelected
                          ? <CheckSquare className="h-4 w-4 text-[#0B2D5C]" />
                          : <Square className="h-4 w-4 text-slate-300" />}
                      </button>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2" role="gridcell">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-1.5 py-px rounded border font-semibold uppercase tracking-wide text-[10px]',
                          statusCfg.badgeClass
                        )}
                        role="status"
                        aria-label={`Status: ${statusCfg.label}`}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', statusCfg.dotClass)} aria-hidden="true" />
                        {statusCfg.label}
                      </span>
                    </td>

                    {/* Job title */}
                    <td className="px-3 py-2 max-w-[220px]">
                      <p className="font-semibold text-slate-900 text-xs truncate">{job.title}</p>
                      {job.company_name && <p className="text-[10px] text-slate-400 truncate">{job.company_name}</p>}
                    </td>

                    {/* Site */}
                    <td className="px-3 py-2 max-w-[160px]">
                      <p className="text-xs text-slate-600 truncate">{job.site_name || '—'}</p>
                      {job.site_address && <p className="text-[10px] text-slate-400 truncate">{job.site_address}</p>}
                    </td>

                    {/* Assignee */}
                    <td className="px-3 py-2">
                      <p className="text-xs text-slate-600 truncate max-w-[120px]">
                        {job.assigned_name || job.assigned_to || '—'}
                      </p>
                    </td>

                    {/* Scheduled */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <p className="text-xs font-mono text-slate-600">{fmtDate(job.scheduled_date)}</p>
                      {job.scheduled_time && <p className="text-[10px] text-slate-400">{job.scheduled_time}</p>}
                    </td>

                    {/* Priority */}
                    <td className="px-3 py-2" role="gridcell">
                      <span
                        className={cn('text-[10px] font-black uppercase tracking-wide', prioCfg.badgeClass, 'px-1.5 py-px rounded border inline-flex items-center gap-1')}
                        aria-label={`Priority: ${prioCfg.label}`}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', prioCfg.dotClass)} aria-hidden="true" />
                        {prioCfg.label}
                      </span>
                    </td>

                    {/* Deliverables */}
                    <td className="px-3 py-2">
                      <span className={cn(
                        'inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-px rounded',
                        deliv === 0 ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'
                      )}>
                        <Package className="h-3 w-3" />
                        {deliv === 0 ? '✓' : deliv}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2">
                      <Link
                        to={`/JobDetail?id=${job.id}`}
                        className="h-7 w-7 rounded-[8px] bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                        aria-label={`Open ${job.title}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50">
          <p className="text-[11px] text-slate-400 font-semibold">
            {total} job{total !== 1 ? 's' : ''} · page {page + 1} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPage(page - 1)}
              disabled={page === 0}
              className="h-7 w-7 rounded-[8px] flex items-center justify-center border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-100 transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5 text-slate-600" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = totalPages <= 7 ? i : i; // simple sequential for ≤7
              return (
                <button
                  key={p}
                  onClick={() => onPage(p)}
                  className={cn(
                    'h-7 min-w-[28px] px-2 rounded-[8px] text-[11px] font-bold border transition-colors',
                    p === page
                      ? 'bg-[#0B2D5C] text-white border-[#0B2D5C]'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  )}
                >
                  {p + 1}
                </button>
              );
            })}
            <button
              onClick={() => onPage(page + 1)}
              disabled={page >= totalPages - 1}
              className="h-7 w-7 rounded-[8px] flex items-center justify-center border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-100 transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}