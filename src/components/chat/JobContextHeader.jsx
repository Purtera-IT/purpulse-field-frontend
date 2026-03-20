/**
 * JobContextHeader — compact job context strip shown above chat.
 */
import React from 'react';
import { MapPin, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CFG = {
  in_progress: { label: 'In Progress', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  paused:      { label: 'Paused',      cls: 'bg-amber-100  text-amber-800  border-amber-300'  },
  assigned:    { label: 'Assigned',    cls: 'bg-slate-100  text-slate-700  border-slate-300'  },
};

export default function JobContextHeader({ job }) {
  if (!job) return null;
  const statusCfg = STATUS_CFG[job.status] || STATUS_CFG.assigned;

  return (
    <div className="bg-slate-900 text-white px-4 py-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-black leading-snug truncate flex-1">{job.title}</p>
        <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full border flex-shrink-0', statusCfg.cls)}>
          {statusCfg.label}
        </span>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {job.site_name && (
          <span className="flex items-center gap-1 text-[11px] text-slate-300">
            <MapPin className="h-3 w-3" /> {job.site_name}
          </span>
        )}
        {job.current_task && (
          <span className="flex items-center gap-1 text-[11px] text-slate-300">
            <ClipboardList className="h-3 w-3" />
            <span className="truncate max-w-[180px]">{job.current_task}</span>
          </span>
        )}
      </div>
    </div>
  );
}