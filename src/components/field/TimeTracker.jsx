import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Play, Square, Coffee, Car } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getActiveState(entries) {
  if (!entries?.length) return { state: 'idle', since: null };
  const sorted = [...entries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const latest = sorted[0];
  switch (latest.entry_type) {
    case 'work_start': return { state: 'working', since: latest.timestamp };
    case 'break_start': return { state: 'break', since: latest.timestamp };
    case 'travel_start': return { state: 'traveling', since: latest.timestamp };
    case 'work_stop':
    case 'break_end':
    case 'travel_end':
    default:
      return { state: 'idle', since: null };
  }
}

function calcTotalWork(entries) {
  if (!entries?.length) return 0;
  const sorted = [...entries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  let totalMs = 0;
  let workStart = null;
  for (const e of sorted) {
    if (e.entry_type === 'work_start') workStart = new Date(e.timestamp);
    if (e.entry_type === 'work_stop' && workStart) {
      totalMs += new Date(e.timestamp) - workStart;
      workStart = null;
    }
  }
  if (workStart) totalMs += Date.now() - workStart;
  return Math.floor(totalMs / 1000);
}

export default function TimeTracker({ jobId, compact = false }) {
  const [elapsed, setElapsed] = useState(0);
  const queryClient = useQueryClient();

  const { data: entries = [] } = useQuery({
    queryKey: ['time-entries', jobId],
    queryFn: () => base44.entities.TimeEntry.filter({ job_id: jobId }, '-timestamp'),
  });

  const activeState = getActiveState(entries);

  useEffect(() => {
    if (activeState.state === 'idle') {
      setElapsed(calcTotalWork(entries));
      return;
    }
    const interval = setInterval(() => {
      setElapsed(calcTotalWork(entries));
    }, 1000);
    return () => clearInterval(interval);
  }, [entries, activeState.state]);

  const createEntry = useMutation({
    mutationFn: (type) => base44.entities.TimeEntry.create({
      job_id: jobId,
      entry_type: type,
      timestamp: new Date().toISOString(),
      source: 'app',
      sync_status: 'pending',
      client_request_id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries', jobId] });
    },
  });

  const handleToggle = (type) => {
    createEntry.mutate(type);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className={cn(
          'font-mono text-lg font-bold tabular-nums',
          activeState.state === 'working' ? 'text-emerald-600' :
          activeState.state === 'break' ? 'text-amber-600' :
          activeState.state === 'traveling' ? 'text-blue-600' : 'text-slate-400'
        )}>
          {formatDuration(elapsed)}
        </div>
        {activeState.state === 'idle' ? (
          <Button size="sm" className="rounded-full bg-emerald-600 hover:bg-emerald-700 h-8 px-3" onClick={() => handleToggle('work_start')}>
            <Play className="h-3.5 w-3.5 mr-1" /> Start
          </Button>
        ) : activeState.state === 'working' ? (
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="rounded-full h-8 px-3" onClick={() => handleToggle('break_start')}>
              <Coffee className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" className="rounded-full bg-red-600 hover:bg-red-700 h-8 px-3" onClick={() => handleToggle('work_stop')}>
              <Square className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : activeState.state === 'break' ? (
          <Button size="sm" className="rounded-full bg-emerald-600 hover:bg-emerald-700 h-8 px-3" onClick={() => handleToggle('break_end')}>
            <Play className="h-3.5 w-3.5 mr-1" /> Resume
          </Button>
        ) : (
          <Button size="sm" className="rounded-full bg-blue-600 hover:bg-blue-700 h-8 px-3" onClick={() => handleToggle('travel_end')}>
            Arrive
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="text-center mb-5">
        <div className={cn(
          'inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-3',
          activeState.state === 'working' ? 'bg-emerald-50 text-emerald-700' :
          activeState.state === 'break' ? 'bg-amber-50 text-amber-700' :
          activeState.state === 'traveling' ? 'bg-blue-50 text-blue-700' :
          'bg-slate-50 text-slate-500'
        )}>
          <span className={cn('h-1.5 w-1.5 rounded-full', 
            activeState.state === 'working' ? 'bg-emerald-500 animate-pulse' :
            activeState.state === 'break' ? 'bg-amber-500' :
            activeState.state === 'traveling' ? 'bg-blue-500 animate-pulse' : 'bg-slate-400'
          )} />
          {activeState.state === 'idle' ? 'Ready' : activeState.state.charAt(0).toUpperCase() + activeState.state.slice(1)}
        </div>
        <div className={cn(
          'font-mono text-4xl font-bold tabular-nums tracking-tight',
          activeState.state === 'working' ? 'text-emerald-600' :
          activeState.state === 'break' ? 'text-amber-600' :
          activeState.state === 'traveling' ? 'text-blue-600' : 'text-slate-300'
        )}>
          {formatDuration(elapsed)}
        </div>
        <p className="text-xs text-slate-400 mt-1">Total work time</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {activeState.state === 'idle' && (
          <>
            <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700 h-12 col-span-2" onClick={() => handleToggle('work_start')}>
              <Play className="h-5 w-5 mr-2" /> Start Work
            </Button>
            <Button variant="outline" className="rounded-xl h-12" onClick={() => handleToggle('travel_start')}>
              <Car className="h-4 w-4 mr-2" /> Start Travel
            </Button>
            <Button variant="outline" className="rounded-xl h-12" disabled>
              <Coffee className="h-4 w-4 mr-2" /> Break
            </Button>
          </>
        )}
        {activeState.state === 'working' && (
          <>
            <Button variant="outline" className="rounded-xl h-12" onClick={() => handleToggle('break_start')}>
              <Coffee className="h-4 w-4 mr-2" /> Break
            </Button>
            <Button className="rounded-xl bg-red-600 hover:bg-red-700 h-12" onClick={() => handleToggle('work_stop')}>
              <Square className="h-4 w-4 mr-2" /> Stop Work
            </Button>
          </>
        )}
        {activeState.state === 'break' && (
          <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700 h-12 col-span-2" onClick={() => handleToggle('break_end')}>
            <Play className="h-5 w-5 mr-2" /> End Break
          </Button>
        )}
        {activeState.state === 'traveling' && (
          <Button className="rounded-xl bg-blue-600 hover:bg-blue-700 h-12 col-span-2" onClick={() => handleToggle('travel_end')}>
            <Car className="h-5 w-5 mr-2" /> Arrived
          </Button>
        )}
      </div>
    </div>
  );
}