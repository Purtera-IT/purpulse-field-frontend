/**
 * AdminJobs — Jobs Management console
 * Features: list all jobs, filter by status/priority/date/assignee, reassign, change status
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Search, RefreshCw, UserCheck, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import AdminShell from '../components/admin/AdminShell';
import { useAuth } from '@/lib/AuthContext';
import { emitDispatchEventForJobStatusChange } from '@/lib/dispatchEvent';

const STATUS_COLORS = {
  assigned:         'bg-slate-100 text-slate-700',
  en_route:         'bg-blue-100 text-blue-700',
  checked_in:       'bg-cyan-100 text-cyan-700',
  in_progress:      'bg-emerald-100 text-emerald-700',
  paused:           'bg-amber-100 text-amber-700',
  pending_closeout: 'bg-orange-100 text-orange-700',
  submitted:        'bg-purple-100 text-purple-700',
  approved:         'bg-emerald-200 text-emerald-800',
  rejected:         'bg-red-100 text-red-700',
};

const ALL_STATUSES = Object.keys(STATUS_COLORS);

function ReassignModal({ job, users, onClose, onSave }) {
  const [selected, setSelected] = useState(job.assigned_to || '');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-base font-black text-slate-900 mb-1">Reassign Job</h3>
        <p className="text-xs text-slate-500 mb-4 truncate">{job.title}</p>
        <div className="space-y-1.5 max-h-60 overflow-y-auto mb-4">
          {users.map(u => (
            <button key={u.email} onClick={() => setSelected(u.email)}
              className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all',
                selected === u.email ? 'bg-slate-900 text-white' : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
              )}
            >
              <div className="h-8 w-8 rounded-full bg-slate-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {u.full_name?.[0] || u.email[0]}
              </div>
              <div>
                <p className="text-sm font-semibold">{u.full_name || u.email}</p>
                <p className={cn('text-[10px]', selected === u.email ? 'text-white/60' : 'text-slate-400')}>{u.email}</p>
              </div>
              {selected === u.email && <CheckCircle2 className="h-4 w-4 ml-auto" />}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold">Cancel</button>
          <button onClick={() => onSave(job.id, selected)} disabled={!selected}
            className="flex-1 h-10 rounded-xl bg-slate-900 text-white text-sm font-bold disabled:opacity-40"
          >
            Reassign
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminJobs() {
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [reassignJob, setReassignJob] = useState(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-scheduled_date', 200),
  });
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const updateJob = useMutation({
    mutationFn: async ({ id, data }) => {
      if (data?.status != null) {
        const list = queryClient.getQueryData(['jobs']) || [];
        const job = list.find((j) => j.id === id) || { id };
        try {
          await emitDispatchEventForJobStatusChange({
            job,
            targetAppStatus: data.status,
            user,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          toast.error(msg);
          throw e;
        }
      }
      return base44.entities.Job.update(id, data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  });

  const handleReassign = (jobId, email) => {
    updateJob.mutate({ id: jobId, data: { assigned_to: email } });
    toast.success('Job reassigned');
    setReassignJob(null);
  };

  const handleStatusChange = (jobId, status) => {
    updateJob.mutate({ id: jobId, data: { status } });
    toast.success('Status updated');
  };

  const filtered = jobs.filter(j => {
    const q = search.toLowerCase();
    const matchSearch = !q || j.title?.toLowerCase().includes(q) || j.site_name?.toLowerCase().includes(q) || j.assigned_to?.toLowerCase().includes(q);
    const matchStatus   = filterStatus === 'all' || j.status === filterStatus;
    const matchPriority = filterPriority === 'all' || j.priority === filterPriority;
    return matchSearch && matchStatus && matchPriority;
  });

  const statusCounts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = jobs.filter(j => j.status === s).length;
    return acc;
  }, {});

  return (
    <AdminShell title="Jobs Management" subtitle={`${filtered.length} of ${jobs.length} work orders`}>
      {/* Summary chips */}
      <div className="flex gap-2 flex-wrap mb-6">
        {[
          { label: 'Active',   count: jobs.filter(j => ['en_route','checked_in','in_progress'].includes(j.status)).length, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
          { label: 'Paused',   count: jobs.filter(j => j.status === 'paused').length,  color: 'bg-amber-50 text-amber-700 border-amber-200' },
          { label: 'Closeout', count: jobs.filter(j => j.status === 'pending_closeout').length, color: 'bg-orange-50 text-orange-700 border-orange-200' },
          { label: 'Urgent',   count: jobs.filter(j => j.priority === 'urgent').length, color: 'bg-red-50 text-red-700 border-red-200' },
        ].map(c => (
          <div key={c.label} className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold', c.color)}>
            {c.count} {c.label}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search jobs, sites, assignees…"
            className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="h-9 px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none"
        >
          <option value="all">All Statuses</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')} ({statusCounts[s]})</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          className="h-9 px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none"
        >
          <option value="all">All Priorities</option>
          {['low','medium','high','urgent'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
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
                  {['Job', 'Site', 'Status', 'Priority', 'Assigned To', 'Scheduled', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(job => (
                  <tr key={job.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900 max-w-[200px] truncate">{job.title}</p>
                      <p className="text-[10px] font-mono text-slate-400">{job.id.slice(0, 8)}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[140px] truncate">{job.site_name || job.site_address || '—'}</td>
                    <td className="px-4 py-3">
                      <select value={job.status}
                        onChange={e => handleStatusChange(job.id, e.target.value)}
                        className={cn('text-xs font-semibold px-2 py-1 rounded-lg border-0 focus:outline-none cursor-pointer',
                          STATUS_COLORS[job.status] || 'bg-slate-100 text-slate-700'
                        )}
                      >
                        {ALL_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-bold px-2 py-1 rounded-full',
                        job.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                        job.priority === 'high'   ? 'bg-orange-100 text-orange-700' :
                        job.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      )}>
                        {job.priority || 'medium'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[140px] truncate">
                      {job.assigned_to || <span className="text-red-500 font-semibold">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                      {job.scheduled_date ? format(new Date(job.scheduled_date), 'MMM d') : '—'}
                      {job.scheduled_time && ` · ${job.scheduled_time}`}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setReassignJob(job)}
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors"
                      >
                        <UserCheck className="h-3.5 w-3.5" /> Reassign
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length === 0 && !isLoading && (
          <div className="text-center py-12 text-slate-400 text-sm">No jobs match filters</div>
        )}
        <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
          {filtered.length} of {jobs.length} jobs
        </div>
      </div>

      {reassignJob && (
        <ReassignModal job={reassignJob} users={users} onClose={() => setReassignJob(null)} onSave={handleReassign} />
      )}
    </AdminShell>
  );
}