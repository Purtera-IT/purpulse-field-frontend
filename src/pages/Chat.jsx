/**
 * Chat — dual-mode communication hub for Purpulse field technicians.
 *
 * Mode 1: Ask Purpulse AI  — contextual job assistant
 * Mode 2: Contact PM        — real-time messaging with escalation tools
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MOCK_JOBS } from '../lib/mockJobs';
import { MOCK_ACTIVE_JOB } from '../lib/mockChatData';

import JobContextHeader from '../components/chat/JobContextHeader';
import AIChatView from '../components/chat/AIChatView';
import PMChatView from '../components/chat/PMChatView';

const MODES = [
  { id: 'ai', Icon: Sparkles,       label: 'Ask AI',      desc: 'Job assistant' },
  { id: 'pm', Icon: MessageCircle,  label: 'Contact PM',  desc: 'Sarah Chen'    },
];

export default function Chat() {
  const [mode, setMode] = useState('ai');

  const { data: dbJobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-updated_date', 10),
    staleTime: 60_000,
  });

  // Use first in-progress job, or mock
  const activeDbJob = dbJobs.find(j => ['in_progress', 'checked_in', 'en_route', 'paused'].includes(j.status));
  const job = activeDbJob || MOCK_ACTIVE_JOB;

  const pm = {
    name: job.assigned_pm || 'Sarah Chen',
    phone: job.pm_phone   || '+1 (510) 555-0182',
  };

  return (
    <div className="flex flex-col h-[calc(100vh-112px)]">

      {/* ── Job context strip ─────────────────────── */}
      <JobContextHeader job={job} />

      {/* ── Mode toggle ───────────────────────────── */}
      <div className="bg-white border-b border-slate-100 px-4 py-2 flex-shrink-0">
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
          {MODES.map(m => {
            const Icon = m.Icon;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-bold transition-all',
                  active
                    ? m.id === 'ai'
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-sm'
                      : 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{m.label}</span>
                {active && <span className={cn('text-[10px] opacity-70 hidden sm:inline')}>{m.desc}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Chat view ─────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {mode === 'ai'
          ? <AIChatView job={job} />
          : <PMChatView job={job} pm={pm} />
        }
      </div>
    </div>
  );
}