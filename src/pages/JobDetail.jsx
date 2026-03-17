/**
 * JobDetail — Execution cockpit for a field job.
 *
 * Desktop (≥1024px): 3-column enterprise grid
 *   Left  320px  — Metadata / Overview
 *   Mid   flex   — Runbook / Tasks
 *   Right 360px  — Live Timer + Evidence + Chat
 *
 * Mobile: tab-based single-column (existing UX preserved)
 *
 * Persistent bottom bar: timer + photo + note + blocker + chat
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Info, ClipboardList, Clock, MessageCircle, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MOCK_JOBS } from '../lib/mockJobs';

import JobDetailOverview from '../components/field/JobDetailOverview';
import JobActionBar from '../components/field/JobActionBar';
import TimerPanel from '../components/field/TimerPanel';
import TasksTab from '../components/field/TasksTab';
import EvidenceTab from '../components/field/EvidenceTab';
import ChatView from '../components/field/ChatView';
import { StatusBadge, SyncBadge } from '../components/field/StatusBadge';
import GeofenceAlerts from '../components/field/GeofenceAlerts';
import LocationBadge from '../components/time/LocationBadge';

function enrichMockJob(job) {
  return {
    ...job,
    access_instructions: job.access_instructions || 'Call site contact 30 min before arrival. Badge access required — collect visitor badge at reception. Equipment staging on Level 2.',
    hazards: job.hazards || (job.priority === 'urgent' ? 'LIVE ELECTRICAL PANELS. Lockout/tagout required. PPE mandatory: hard hat, gloves, safety glasses.' : null),
  };
}

const TABS = [
  { id: 'overview', Icon: Info,          label: 'Overview' },
  { id: 'tasks',    Icon: ClipboardList, label: 'Tasks'    },
  { id: 'time',     Icon: Clock,         label: 'Time'     },
  { id: 'chat',     Icon: MessageCircle, label: 'Chat'     },
  { id: 'files',    Icon: Folder,        label: 'Files'    },
];

const ACTIVE_STATUSES   = ['en_route', 'checked_in', 'in_progress', 'paused'];
const READONLY_STATUSES = ['submitted', 'approved'];

// Desktop header height — used for sticky column calc
const HEADER_H = 104;

export default function JobDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const jobId     = urlParams.get('id');
  const initTab   = urlParams.get('tab') || 'overview';

  const [activeTab,    setActiveTab]    = useState(initTab);
  const [geoAlerts,    setGeoAlerts]    = useState([]);
  const [gpsAccuracy,  setGpsAccuracy]  = useState(null);

  const handleGeoAlert       = (t)    => setGeoAlerts(p => p.includes(t) ? p : [...p, t]);
  const handleLocationChange = (info) => setGpsAccuracy(info?.accuracy ?? null);

  const { data: dbJob, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const jobs = await base44.entities.Job.filter({ id: jobId });
      return jobs[0] || null;
    },
    enabled: !!jobId,
    refetchInterval: 15000,
  });

  const mockJob = MOCK_JOBS.find(j => j.id === jobId) || MOCK_JOBS[0];
  const job     = enrichMockJob(dbJob ?? enrichMockJob(mockJob));

  const isActive   = ACTIVE_STATUSES.includes(job.status);
  const isReadOnly = READONLY_STATUSES.includes(job.status);
  const statusLabel = { en_route: 'En Route', checked_in: 'Checked In', in_progress: 'In Progress', paused: 'Paused' }[job.status];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const colScrollCls = 'overflow-y-auto pb-28';
  const colScrollStyle = { height: `calc(100vh - ${HEADER_H}px)` };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ── Sticky header ─────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-slate-100">
        {/* Title + CTA row */}
        <div className="px-3 pt-2 pb-0 flex items-center gap-2">
          <Link
            to="/Jobs"
            className="h-7 w-7 rounded-[6px] bg-slate-100 flex items-center justify-center flex-shrink-0 active:bg-slate-200 transition-colors"
            aria-label="Back to jobs"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-slate-600" />
          </Link>
          <h1 className="flex-1 min-w-0 text-sm font-black text-slate-900 leading-snug line-clamp-1">{job.title}</h1>
          <button
            onClick={() => setActiveTab('tasks')}
            className="flex-shrink-0 h-7 px-2.5 rounded-[6px] bg-[#0B2D5C] text-white text-[10px] font-bold flex items-center gap-1 active:opacity-80"
          >
            <ClipboardList className="h-3 w-3" /> Tasks
          </button>
        </div>

        {/* Status badges row */}
        <div className="px-3 py-1 flex items-center gap-1 flex-wrap">
          <StatusBadge status={job.status} />
          <SyncBadge  status={job.sync_status} />
          {job.company_name && (
            <span className="text-[10px] text-slate-400 font-semibold truncate max-w-[120px]">{job.company_name}</span>
          )}
          {!dbJob && (
            <span className="text-[9px] font-black text-slate-300 bg-slate-50 px-1 py-px rounded border border-slate-100">DEMO</span>
          )}
          {isActive && (
            <div className="hidden lg:flex items-center gap-1.5 bg-emerald-600 text-white rounded-[6px] px-2 py-px ml-auto flex-shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 motion-safe:animate-pulse flex-shrink-0" aria-hidden="true" />
              <TimerPanel jobId={job.id} statusLabel={statusLabel} compact />
            </div>
          )}
        </div>

        {/* Thin progress bar */}
        {job.progress != null && (
          <div className="h-0.5 bg-slate-100 overflow-hidden">
            <div
              className={cn('h-full transition-all',
                job.progress === 100 ? 'bg-emerald-500' : job.progress >= 60 ? 'bg-blue-500' : job.progress >= 30 ? 'bg-amber-400' : 'bg-red-400'
              )}
              style={{ width: `${job.progress}%` }}
            />
          </div>
        )}

        {/* Tab bar — mobile only */}
        <div className="flex lg:hidden px-1">
          {TABS.map(tab => {
            const Icon = tab.Icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 py-1.5 transition-all text-[10px] font-bold border-b-2',
                  active ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent'
                )}
              >
                <Icon className="h-3 w-3" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══ MOBILE: tab-based single column ══════════════════ */}
      <div className="lg:hidden flex-1 max-w-lg mx-auto w-full px-3 py-2 pb-32 space-y-2">
        {isReadOnly && (
          <div className="p-3 bg-blue-50 rounded-[8px] text-xs text-blue-700 font-semibold text-center border border-blue-100 flex items-center justify-center gap-2">
            <span className="text-emerald-600">✓</span> Submitted — view only
          </div>
        )}
        {isActive && (
          <div className="flex items-center gap-2 flex-wrap">
            <LocationBadge jobs={[job]} onStatusChange={handleLocationChange} onAlert={handleGeoAlert} />
          </div>
        )}
        {geoAlerts.length > 0 && <GeofenceAlerts alerts={geoAlerts} accuracy={gpsAccuracy} />}

        {/* Compact timer strip (tap to expand) */}
        {isActive && !isReadOnly && activeTab !== 'time' && (
          <div
            className="flex items-center gap-2 bg-emerald-600 text-white rounded-[6px] px-3 py-1.5 cursor-pointer active:opacity-90"
            onClick={() => setActiveTab('time')}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 motion-safe:animate-pulse flex-shrink-0" />
            <TimerPanel jobId={job.id} statusLabel={statusLabel} compact />
            <span className="text-[10px] opacity-60 ml-auto flex-shrink-0">tap →</span>
          </div>
        )}

        {activeTab === 'overview' && <JobDetailOverview job={job} onNavigateToTasks={() => setActiveTab('tasks')} />}
        {activeTab === 'tasks'    && <TasksTab job={job} />}
        {activeTab === 'time'     && <div className="space-y-3"><TimerPanel jobId={job.id} statusLabel={statusLabel} /></div>}
        {activeTab === 'chat'     && (
          <div className="bg-white rounded-[8px] border border-slate-100 overflow-hidden" style={{ height: 480 }}>
            <ChatView jobId={job.id} />
          </div>
        )}
        {activeTab === 'files'    && <EvidenceTab job={job} />}
      </div>

      {/* ══ DESKTOP: 3-column cockpit ═════════════════════════ */}
      <div
        className="hidden lg:grid flex-1"
        style={{ gridTemplateColumns: '320px 1fr 360px' }}
      >

        {/* ── Left col: Metadata / Overview ───────────────── */}
        <div className={cn('border-r border-slate-200 bg-white', colScrollCls)} style={colScrollStyle}>
          <div className="px-4 py-4 space-y-2">
            {isReadOnly && (
              <div className="p-2 bg-blue-50 rounded-[8px] text-xs text-blue-700 font-semibold text-center border border-blue-100">
                ✓ View only
              </div>
            )}
            {isActive && (
              <div className="mb-1">
                <LocationBadge jobs={[job]} onStatusChange={handleLocationChange} onAlert={handleGeoAlert} compact />
              </div>
            )}
            {geoAlerts.length > 0 && <GeofenceAlerts alerts={geoAlerts} accuracy={gpsAccuracy} />}
            <JobDetailOverview job={job} onNavigateToTasks={null} dense />
          </div>
        </div>

        {/* ── Middle col: Runbook / Tasks ──────────────────── */}
        <div className={cn('border-r border-slate-200 bg-slate-50', colScrollCls)} style={colScrollStyle}>
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Runbook · Tasks</p>
              {job.progress != null && (
                <span className="text-[10px] font-black text-slate-500 tabular-nums bg-white border border-slate-200 px-2 py-0.5 rounded">{job.progress}% complete</span>
              )}
            </div>
            <TasksTab job={job} />
          </div>
        </div>

        {/* ── Right col: Timer + Evidence + Chat ──────────── */}
        <div className={cn('bg-white', colScrollCls)} style={colScrollStyle}>
          <div className="px-4 py-4 space-y-4">

            {/* Live timer */}
            {isActive && !isReadOnly && (
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Live Timer</p>
                <TimerPanel jobId={job.id} statusLabel={statusLabel} />
              </div>
            )}

            {/* Evidence */}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Evidence & Files</p>
              <EvidenceTab job={job} />
            </div>

            {/* Chat */}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Job Chat</p>
              <div className="rounded-[8px] border border-slate-200 overflow-hidden" style={{ height: 340 }}>
                <ChatView jobId={job.id} />
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Persistent action bar ─────────────────────────── */}
      {!isReadOnly && <JobActionBar job={job} isReadOnly={isReadOnly} />}
      {isReadOnly  && <div className="h-20" />}
    </div>
  );
}