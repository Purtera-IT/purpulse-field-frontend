import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, getDay, addMonths, subMonths, isToday, parseISO,
} from 'date-fns';
import { cn } from '@/lib/utils';
import JobRichCard from './JobRichCard';

const PRIORITY_DOT = {
  urgent: 'bg-red-500',
  high:   'bg-orange-500',
  medium: 'bg-blue-400',
  low:    'bg-slate-300',
};

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function JobsCalendar({ jobs }) {
  const [month,    setMonth]    = useState(new Date());
  const [selected, setSelected] = useState(new Date());

  const monthStart  = startOfMonth(month);
  const monthEnd    = endOfMonth(month);
  const days        = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startOffset = getDay(monthStart);

  const getJobsForDay = (day) =>
    jobs.filter(j => {
      try { return j.scheduled_date && isSameDay(parseISO(j.scheduled_date), day); }
      catch { return false; }
    });

  const selectedJobs = getJobsForDay(selected);

  return (
    <div className="space-y-4">
      {/* ── Month grid ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setMonth(m => subMonths(m, 1))}
            className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center active:bg-slate-200"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4 text-slate-600" />
          </button>
          <h3 className="text-base font-black text-slate-900">{format(month, 'MMMM yyyy')}</h3>
          <button
            onClick={() => setMonth(m => addMonths(m, 1))}
            className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center active:bg-slate-200"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4 text-slate-600" />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-[10px] font-black text-slate-400 py-1">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {Array.from({ length: startOffset }).map((_, i) => <div key={`e${i}`} />)}

          {days.map(day => {
            const dayJobs  = getJobsForDay(day);
            const isSelected = isSameDay(day, selected);
            const today    = isToday(day);

            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelected(day)}
                className={cn(
                  'flex flex-col items-center py-1.5 rounded-xl transition-all',
                  isSelected ? 'bg-slate-900' : today ? 'bg-blue-50' : 'active:bg-slate-100'
                )}
              >
                <span className={cn(
                  'text-xs font-bold leading-none',
                  isSelected ? 'text-white' : today ? 'text-blue-700' : 'text-slate-600'
                )}>
                  {format(day, 'd')}
                </span>
                <div className="flex gap-0.5 mt-1 h-2 items-center">
                  {dayJobs.slice(0, 3).map((job, i) => (
                    <span
                      key={i}
                      className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_DOT[job.priority] || 'bg-slate-400')}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-50 flex-wrap">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mr-1">Priority:</p>
          {[['urgent', 'bg-red-500', 'Urgent'], ['high', 'bg-orange-500', 'High'], ['medium', 'bg-blue-400', 'Medium'], ['low', 'bg-slate-300', 'Low']].map(([key, dot, label]) => (
            <span key={key} className="flex items-center gap-1 text-[10px] text-slate-500">
              <span className={cn('h-2 w-2 rounded-full', dot)} /> {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Selected day jobs ───────────────────────────── */}
      <div>
        <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 px-1">
          {isToday(selected) ? 'Today' : format(selected, 'EEEE, MMMM d')}
          <span className="font-normal text-slate-400 ml-1">
            · {selectedJobs.length} job{selectedJobs.length !== 1 ? 's' : ''}
          </span>
        </p>
        {selectedJobs.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-slate-100">
            <p className="text-slate-400 text-sm font-semibold">No jobs scheduled</p>
            <p className="text-slate-300 text-xs mt-1">Select a day with colored dots</p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedJobs.map(job => <JobRichCard key={job.id} job={job} />)}
          </div>
        )}
      </div>
    </div>
  );
}