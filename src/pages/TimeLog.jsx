/**
 * TimeLog — Time tracking page for Purpulse field technicians.
 *
 * Sections:
 *   1. Header + Location badge (on-site / off-site / unknown)
 *   2. Date navigator
 *   3. Active timer card (today only)
 *   4. Summary totals (work / travel / break)
 *   5. Visual day timeline bar
 *   6. Geofence suggestion banner (check-in/out prompt)
 *   7. Per-job time breakdown with entry list + correction
 *   8. Admin lock/unlock
 *   9. FAB: Add manual entry
 */
import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  format, isToday, differenceInSeconds, addDays, subDays,
} from 'date-fns';
import {
  Clock, Plus, ChevronLeft, ChevronRight, Lock, Unlock,
  Loader2, ShieldCheck, MapPin, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import LocationBadge from '../components/time/LocationBadge';
import GeofenceAlerts from '../components/field/GeofenceAlerts';
import ActiveTimerCard from '../components/time/ActiveTimerCard';
import TimelineBar from '../components/time/TimelineBar';
import JobTimeBreakdown from '../components/time/JobTimeBreakdown';
import ManualEntrySheet from '../components/time/ManualEntrySheet';
import TimeTypeSelector from '../components/time/TimeTypeSelector';
import JobSelectorModal from '../components/time/JobSelectorModal';
import { MOCK_TIME_ENTRIES, MOCK_JOBS_FOR_TIME } from '../lib/mockTimeEntries';

// ── helpers ───────────────────────────────────────────────────────────
function calcDurations(entries) {
  const sorted = [...entries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  let work = 0, travel = 0, breakT = 0;
  let ws = null, ts = null, bs = null;
  for (const e of sorted) {
    const t = new Date(e.timestamp);
    if (e.entry_type === 'work_start')   ws = t;
    if (e.entry_type === 'work_stop'   && ws) { work   += differenceInSeconds(t, ws); ws = null; }
    if (e.entry_type === 'travel_start') ts = t;
    if (e.entry_type === 'travel_end'  && ts) { travel += differenceInSeconds(t, ts); ts = null; }
    if (e.entry_type === 'break_start')  bs = t;
    if (e.entry_type === 'break_end'   && bs) { breakT += differenceInSeconds(t, bs); bs = null; }
  }
  const now = new Date();
  if (ws) work   += differenceInSeconds(now, ws);
  if (ts) travel += differenceInSeconds(now, ts);
  if (bs) breakT += differenceInSeconds(now, bs);
  return { work, travel, break: breakT };
}

function fmtDuration(s) {
  if (s < 60) return '0m';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function getActiveState(entries) {
  if (!entries.length) return 'idle';
  const latest = [...entries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
  const map = { work_start: 'working', break_start: 'on_break', travel_start: 'traveling' };
  return map[latest.entry_type] || 'idle';
}

async function flushOfflineQueue(queryClient) {
  const key = 'purpulse_time_edit_queue';
  const queue = JSON.parse(localStorage.getItem(key) || '[]');
  if (!queue.length) return;
  const remaining = [];
  for (const item of queue) {
    try { await base44.entities.TimeEntry.update(item.entryId, item.data); }
    catch { remaining.push(item); }
  }
  localStorage.setItem(key, JSON.stringify(remaining));
  if (queue.length > remaining.length) {
    queryClient.invalidateQueries({ queryKey: ['all-time-entries'] });
    toast.success(`${queue.length - remaining.length} offline edit(s) synced`);
  }
}

// ── Main page ─────────────────────────────────────────────────────────
export default function TimeLog() {
  const [date,         setDate]         = useState(new Date());
  const [editEntry,    setEditEntry]    = useState(null);   // entry being corrected
  const [showManual,    setShowManual]    = useState(false);
  const [locationInfo,  setLocationInfo]  = useState(null);   // { state, job, distMeters }
  const [localEntries,  setLocalEntries]  = useState([]);     // optimistic local entries
  const [geoAlerts,     setGeoAlerts]     = useState([]);     // active geofence alert types
  const [gpsAccuracy,   setGpsAccuracy]   = useState(null);
  const [selectedType,  setSelectedType]  = useState(null);   // work|break|travel|off
  const [showJobPicker, setShowJobPicker] = useState(false);  // multi-job picker

  const queryClient = useQueryClient();

  const { data: dbEntries = [], isLoading } = useQuery({
    queryKey: ['all-time-entries'],
    queryFn: () => base44.entities.TimeEntry.list('-timestamp', 500),
    staleTime: 10_000,
  });

  const { data: dbJobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-updated_date', 100),
  });

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const isAdmin = user?.role === 'admin';

  // Use mock data when DB empty
  const allEntries = dbEntries.length > 0 ? [...dbEntries, ...localEntries] : [...MOCK_TIME_ENTRIES, ...localEntries];
  const allJobs    = dbJobs.length > 0 ? dbJobs : MOCK_JOBS_FOR_TIME;
  const isMockData = dbEntries.length === 0;

  // Flush offline queue
  useEffect(() => {
    if (navigator.onLine) flushOfflineQueue(queryClient);
    const h = () => flushOfflineQueue(queryClient);
    window.addEventListener('online', h);
    return () => window.removeEventListener('online', h);
  }, []);

  const addEntry = useMutation({
    mutationFn: (data) => base44.entities.TimeEntry.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['all-time-entries'] }),
  });

  const lockEntries = useMutation({
    mutationFn: async (lock) => {
      const dayE = allEntries.filter(e => e.timestamp?.startsWith(format(date, 'yyyy-MM-dd')));
      await Promise.all(dayE.map(e =>
        base44.entities.TimeEntry.update(e.id, {
          locked: lock,
          approved_by: lock ? user?.email : null,
          approved_at: lock ? new Date().toISOString() : null,
        })
      ));
    },
    onSuccess: (_, lock) => {
      queryClient.invalidateQueries({ queryKey: ['all-time-entries'] });
      toast.success(lock ? 'Entries locked & approved' : 'Entries unlocked');
    },
  });

  // Day-filtered entries
  const dateStr   = format(date, 'yyyy-MM-dd');
  const dayEntries = allEntries.filter(e => e.timestamp?.startsWith(dateStr));
  const durations  = useMemo(() => calcDurations(dayEntries), [dayEntries]);
  const anyLocked  = dayEntries.some(e => e.locked);
  const allLocked  = dayEntries.length > 0 && dayEntries.every(e => e.locked);
  const activeState = getActiveState(dayEntries);

  // Current active job (most recent work_start job_id)
  const activeJobId = useMemo(() => {
    const ws = [...dayEntries].filter(e => e.entry_type === 'work_start')
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    return ws?.job_id;
  }, [dayEntries]);
  const activeJob = allJobs.find(j => j.id === activeJobId);

  // Geofence suggestion
  const geoSuggestion = useMemo(() => {
    if (!locationInfo || !isToday(date)) return null;
    if (locationInfo.state === 'on_site' && activeState === 'idle') {
      return { type: 'checkin', msg: `You appear to be on-site at ${locationInfo.job?.site_name || 'the job site'}. Start work?` };
    }
    if (locationInfo.state === 'off_site' && activeState === 'working') {
      return { type: 'checkout', msg: `You've moved away from the job site. Did you forget to stop the timer?` };
    }
    return null;
  }, [locationInfo, activeState, date]);

  const handleGeoAlert = (alertType) => {
    setGeoAlerts(prev => prev.includes(alertType) ? prev : [...prev, alertType]);
  };

  const handleLocationChange = (info) => {
    setLocationInfo(info);
    setGpsAccuracy(info?.accuracy ?? null);
    // Detect off-site while working
    if (info?.state === 'off_site' && activeState === 'working') {
      handleGeoAlert('off_site_while_working');
    }
  };

  // Auto-map job based on scheduled date/time
  const getScheduledJobsForToday = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return allJobs.filter(j => j.scheduled_date === today);
  };

  const handleTimeTypeSelect = (type) => {
    const mapToEntryType = {
      work: activeState === 'working' ? 'work_stop' : 'work_start',
      break: activeState === 'on_break' ? 'break_end' : 'break_start',
      travel: activeState === 'traveling' ? 'travel_end' : 'travel_start',
      off: 'work_stop', // Off = stop work if running
    };

    // Auto-map to job
    const scheduledJobs = getScheduledJobsForToday();
    if (scheduledJobs.length > 1) {
      // Show picker
      setSelectedType(type);
      setShowJobPicker(true);
    } else if (scheduledJobs.length === 1) {
      // Auto-select the only job
      submitTimeEntry(mapToEntryType[type], scheduledJobs[0].id);
    } else {
      // No scheduled job, use active or first job
      submitTimeEntry(mapToEntryType[type], activeJobId || allJobs[0]?.id || '');
    }
  };

  const submitTimeEntry = (entryType, jobId) => {
    const entry = {
      entry_type: entryType,
      job_id: jobId,
      timestamp: new Date().toISOString(),
      source: 'app',
      sync_status: 'pending',
    };
    if (isMockData) {
      setLocalEntries(prev => [...prev, { ...entry, id: `local-${Date.now()}` }]);
    } else {
      addEntry.mutate(entry);
    }
    toast.success({
      work_start: 'Work started', work_stop: 'Work stopped',
      break_start: 'Break started', break_end: 'Break ended',
      travel_start: 'Travel started', travel_end: 'Arrived on site',
    }[entryType] || 'Logged');
    setSelectedType(null);
    setShowJobPicker(false);
  };

  const handleTimerAction = (type) => {
    const mapToEntryType = {
      work_start: 'work_start', work_stop: 'work_stop',
      break_start: 'break_start', break_end: 'break_end',
      travel_start: 'travel_start', travel_end: 'travel_end',
    };
    submitTimeEntry(mapToEntryType[type], activeJobId || allJobs[0]?.id || '');
  };

  const handleSaveEntry = (data) => {
    if (isMockData) {
      setLocalEntries(prev => {
        if (data.id) return prev.map(e => e.id === data.id ? { ...e, ...data } : e);
        return [...prev, { ...data, id: `local-${Date.now()}` }];
      });
    } else {
      if (data.id) {
        base44.entities.TimeEntry.update(data.id, data)
          .then(() => queryClient.invalidateQueries({ queryKey: ['all-time-entries'] }));
      } else {
        addEntry.mutate(data);
      }
    }
    toast.success(data.id ? 'Entry corrected' : 'Entry added');
  };

  const CHIPS = [
    { key: 'work',   label: 'Work',   val: fmtDuration(durations.work),   bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
    { key: 'travel', label: 'Travel', val: fmtDuration(durations.travel), bg: 'bg-blue-50 border-blue-200',       text: 'text-blue-700'    },
    { key: 'break',  label: 'Break',  val: fmtDuration(durations.break),  bg: 'bg-amber-50 border-amber-200',     text: 'text-amber-700'   },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 pt-14 pb-28 space-y-4">

        {/* ── Header ─────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Time</h1>
            <p className="text-xs text-slate-400 mt-0.5">Work session log</p>
          </div>
          <div className="flex items-center gap-2">
            {isMockData && (
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full border border-slate-200">Demo</span>
            )}
            {allLocked && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-amber-50 border border-amber-200">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-xs font-bold text-amber-700">Approved</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Location badge ───────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          <LocationBadge jobs={allJobs} onStatusChange={handleLocationChange} onAlert={handleGeoAlert} />
          {locationInfo?.state === 'on_site' && (
            <span className="text-[11px] text-emerald-700 font-semibold">
              · GPS confirmed on-site
            </span>
          )}
        </div>

        {/* ── Geofence alerts ──────────────────────── */}
        {geoAlerts.length > 0 && (
          <GeofenceAlerts
            alerts={geoAlerts}
            accuracy={gpsAccuracy}
            onCtaAction={(action) => {
              if (action === 'manual_checkin') handleTimerAction('work_start');
            }}
          />
        )}

        {/* ── Geofence suggestion banner ────────────── */}
        {geoSuggestion && (
          <div className={cn(
            'flex items-start gap-3 px-4 py-3 rounded-2xl border',
            geoSuggestion.type === 'checkin'
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-amber-50 border-amber-200'
          )}>
            <MapPin className={cn('h-4 w-4 mt-0.5 flex-shrink-0',
              geoSuggestion.type === 'checkin' ? 'text-emerald-600' : 'text-amber-600'
            )} />
            <div className="flex-1">
              <p className={cn('text-xs font-bold',
                geoSuggestion.type === 'checkin' ? 'text-emerald-800' : 'text-amber-800'
              )}>
                {geoSuggestion.msg}
              </p>
            </div>
            {geoSuggestion.type === 'checkin' && (
              <button
                onClick={() => handleTimerAction('work_start')}
                className="h-8 px-3 rounded-xl bg-emerald-600 text-white text-[11px] font-bold active:opacity-80 flex-shrink-0"
              >
                Start
              </button>
            )}
            {geoSuggestion.type === 'checkout' && (
              <button
                onClick={() => handleTimerAction('work_stop')}
                className="h-8 px-3 rounded-xl bg-amber-600 text-white text-[11px] font-bold active:opacity-80 flex-shrink-0"
              >
                Stop
              </button>
            )}
          </div>
        )}

        {/* ── Date navigator ────────────────────────── */}
        <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-100 p-1">
          <button onClick={() => setDate(d => subDays(d, 1))}
            className="h-10 w-10 rounded-xl flex items-center justify-center active:bg-slate-100">
            <ChevronLeft className="h-4 w-4 text-slate-600" />
          </button>
          <div className="text-center">
            <p className="text-sm font-black text-slate-900">
              {isToday(date) ? 'Today' : format(date, 'EEEE')}
            </p>
            <p className="text-xs text-slate-400">{format(date, 'MMMM d, yyyy')}</p>
          </div>
          <button onClick={() => setDate(d => addDays(d, 1))}
            className="h-10 w-10 rounded-xl flex items-center justify-center active:bg-slate-100"
            disabled={isToday(date)}
          >
            <ChevronRight className={cn('h-4 w-4', isToday(date) ? 'text-slate-200' : 'text-slate-600')} />
          </button>
        </div>

        {/* ── Time Type Quick Selector (today only) ── */}
        {isToday(date) && (
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Quick Time Entry</p>
            <TimeTypeSelector
              onSelect={handleTimeTypeSelect}
              disabled={false}
            />
          </div>
        )}

        {/* ── Active timer (today only) ─────────────── */}
        {isToday(date) && (
          <ActiveTimerCard
            entries={dayEntries}
            currentJob={activeJob}
            onAction={handleTimerAction}
          />
        )}

        {/* ── Summary chips ─────────────────────────── */}
        <div className="flex gap-2">
          {CHIPS.map(c => (
            <div key={c.key} className={cn('flex-1 rounded-2xl border px-3 py-3 text-center', c.bg)}>
              <p className={cn('text-xl font-black tabular-nums', c.text)}>{c.val}</p>
              <p className={cn('text-[10px] font-semibold mt-0.5', c.text)}>{c.label}</p>
            </div>
          ))}
        </div>

        {/* ── Timeline ──────────────────────────────── */}
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
        ) : dayEntries.length === 0 ? (
          <div className="text-center py-14">
            <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <Clock className="h-7 w-7 text-slate-300" />
            </div>
            <p className="text-slate-500 font-semibold text-sm">No entries for this day</p>
            <p className="text-xs text-slate-400 mt-1">
              {isToday(date) ? 'Use the timer above or add a manual entry' : 'Navigate back to today to start tracking'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
              Day Timeline · tap a segment to correct
            </p>
            <TimelineBar
              entries={dayEntries}
              onSegmentTap={(seg) => {
                const entry = dayEntries.find(e => e.id === seg.entry_id);
                if (entry) setEditEntry(entry);
              }}
            />
          </div>
        )}

        {/* ── Per-job breakdown ─────────────────────── */}
        {dayEntries.length > 0 && (
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
              By Job
            </p>
            <JobTimeBreakdown
              jobs={allJobs}
              entries={dayEntries}
              onEditEntry={setEditEntry}
            />
          </div>
        )}

        {/* ── Admin lock ───────────────────────────── */}
        {isAdmin && dayEntries.length > 0 && (
          <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              {allLocked
                ? <ShieldCheck className="h-4 w-4 text-amber-600" />
                : <Lock className="h-4 w-4 text-slate-400" />
              }
              <span className="text-sm font-semibold text-slate-700">
                {allLocked ? 'Approved & locked' : anyLocked ? 'Partially locked' : 'Unlocked'}
              </span>
            </div>
            <button
              onClick={() => lockEntries.mutate(!allLocked)}
              disabled={lockEntries.isPending}
              className={cn('flex items-center gap-1.5 h-9 px-4 rounded-xl text-xs font-bold',
                allLocked ? 'bg-slate-100 text-slate-600' : 'bg-amber-600 text-white'
              )}
            >
              {lockEntries.isPending
                ? <span className="h-3.5 w-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                : allLocked
                  ? <><Unlock className="h-3.5 w-3.5" /> Unlock</>
                  : <><Lock className="h-3.5 w-3.5" /> Approve & Lock</>
              }
            </button>
          </div>
        )}
      </div>

      {/* ── FAB ────────────────────────────────────── */}
      {!allLocked && (
        <button
          onClick={() => setShowManual(true)}
          className="fixed bottom-24 right-4 h-14 w-14 rounded-full bg-slate-900 text-white shadow-2xl flex items-center justify-center active:scale-95 transition-transform z-20"
          aria-label="Add manual time entry"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.22)' }}
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* ── Manual entry / correction sheet ────────── */}
      {(showManual || editEntry) && (
        <ManualEntrySheet
          existingEntry={editEntry}
          jobs={allJobs}
          date={date}
          onSave={handleSaveEntry}
          onClose={() => { setShowManual(false); setEditEntry(null); }}
        />
      )}

      {/* ── Job Selector Modal ────────────────────── */}
      {showJobPicker && selectedType && (
        <JobSelectorModal
          jobs={getScheduledJobsForToday()}
          onSelect={(jobId) => {
            const mapToEntryType = {
              work: activeState === 'working' ? 'work_stop' : 'work_start',
              break: activeState === 'on_break' ? 'break_end' : 'break_start',
              travel: activeState === 'traveling' ? 'travel_end' : 'travel_start',
              off: 'work_stop',
            };
            submitTimeEntry(mapToEntryType[selectedType], jobId);
          }}
          onCancel={() => { setShowJobPicker(false); setSelectedType(null); }}
        />
      )}
    </div>
  );
}