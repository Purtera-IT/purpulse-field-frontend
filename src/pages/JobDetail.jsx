/**
 * JobDetail — Main execution cockpit for a field job.
 *
 * Tabs: Overview · Tasks · Time · Chat · Files
 * Persistent bottom bar: timer + photo + note + blocker + chat
 *
 * Mock job is used when no DB record is found (demo mode).
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Info, ClipboardList, Clock, MessageCircle, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MOCK_JOBS } from '../lib/mockJobs';

import JobDetailOverview from '../components/field/JobDetailOverview';
import JobActionBar from '../components/field/JobActionBar';
import TimerPanel from '../components/field/TimerPanel';
import RunbookView from '../components/field/RunbookView';
import EvidenceTab from '../components/field/EvidenceTab';
import ChatView from '../components/field/ChatView';
import { StatusBadge, SyncBadge } from '../components/field/StatusBadge';

// Enrich a mock job with fields the overview expects
function enrichMockJob(job) {
  return {
    ...job,
    access_instructions: job.access_instructions || 'Call site contact 30 minutes before arrival. Badge access required — collect visitor badge at reception desk. Equipment staging area is on Level 2.',
    hazards: job.hazards || (job.priority === 'urgent' ? 'LIVE ELECTRICAL PANELS. Lockout/tagout required before work begins. PPE mandatory: hard hat, gloves, safety glasses.' : null),
  };
}

const TABS = [
  { id: 'overview', Icon: Info,          label: 'Overview' },
  { id: 'tasks',    Icon: ClipboardList, label: 'Tasks'    },
  { id: 'time',     Icon: Clock,         label: 'Time'     },
  { id: 'chat',     Icon: MessageCircle, label: 'Chat'     },
  { id: 'files',    Icon: Folder,        label: 'Files'    },
];

const ACTIVE_STATUSES = ['en_route', 'checked_in', 'in_progress', 'paused'];
const READONLY_STATUSES = ['submitted', 'approved'];

export default function JobDetail() {
  const [activeTab, setActiveTab] = useState('overview');
  const urlParams = new URLSearchParams(window.location.search);
  const jobId = urlParams.get('id');

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

  // Fall back to mock job for demo
  const mockJob = MOCK_JOBS.find(j => j.id === jobId) || MOCK_JOBS[0];
  const rawJob  = dbJob ?? enrichMockJob(mockJob);
  const job     = enrichMockJob(rawJob);

  const isActive   = ACTIVE_STATUSES.includes(job.status);
  const isReadOnly = READONLY_STATUSES.includes(job.status);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const statusLabel = {
    en_route:    'En Route',
    checked_in:  'Checked In',
    in_progress: 'In Progress',
    paused:      'Paused',
  }[job.status];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ── Sticky header ─────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              to="/Jobs"
              className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 active:bg-slate-200"
              aria-label="Back to jobs"
            >
              <ArrowLeft className="h-4 w-4 text-slate-600" />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-[15px] font-black text-slate-900 leading-snug line-clamp-1">{job.title}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <StatusBadge status={job.status} />
                <SyncBadge  status={job.sync_status} />
                {!dbJob && (
                  <span className="text-[9px] font-black text-slate-300 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">DEMO</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-slate-50 max-w-lg mx-auto">
          {TABS.map(tab => {
            const Icon = tab.Icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-all text-[10px] font-bold border-b-2',
                  active
                    ? 'text-slate-900 border-slate-900'
                    : 'text-slate-400 border-transparent'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Scrollable body ───────────────────────────────── */}
      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-4 pb-36 space-y-3">

        {isReadOnly && (
          <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700 font-semibold text-center border border-blue-100">
            ✓ This job has been submitted — view only
          </div>
        )}

        {/* ── Sticky Timer (active jobs only, at top of scrollable area) ── */}
        {isActive && !isReadOnly && activeTab !== 'time' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3">
            <TimerPanel jobId={job.id} statusLabel={statusLabel} />
          </div>
        )}

        {/* ── Tab content ────────────────────────────────── */}
        {activeTab === 'overview' && (
          <JobDetailOverview job={job} />
        )}

        {activeTab === 'tasks' && (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <RunbookView job={job} />
          </div>
        )}

        {activeTab === 'time' && (
          <div className="space-y-3">
            <TimerPanel jobId={job.id} statusLabel={statusLabel} />
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden" style={{ height: 480 }}>
            <ChatView jobId={job.id} />
          </div>
        )}

        {activeTab === 'files' && (
          <div className="space-y-3">
            <EvidenceTab job={job} />
          </div>
        )}
      </div>

      {/* ── Persistent action bar ─────────────────────────── */}
      {!isReadOnly && (
        <JobActionBar job={job} isReadOnly={isReadOnly} />
      )}

      {/* Spacer when read-only (just the standard nav) */}
      {isReadOnly && <div className="h-20" />}
    </div>
  );
}