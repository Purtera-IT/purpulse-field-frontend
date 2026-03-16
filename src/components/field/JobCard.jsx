import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { StatusBadge, PriorityIndicator, SyncBadge } from './StatusBadge';
import { MapPin, Clock, User, ChevronRight, Play, Navigation, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const SWIPE_REVEAL  = 60;   // px — reveal action zone
const SWIPE_COMMIT  = 110;  // px — auto-commit action on release

export default function JobCard({ job, onStartTimer, isStarting }) {
  const navigate = useNavigate();
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStart = useRef({ x: 0, y: 0 });

  // ── touch handlers ────────────────────────────────────────────────
  const handleTouchStart = (e) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setIsDragging(false);
  };

  const handleTouchMove = (e) => {
    const dx = e.touches[0].clientX - touchStart.current.x;
    const dy = e.touches[0].clientY - touchStart.current.y;
    if (!isDragging && Math.abs(dy) > Math.abs(dx)) return; // vertical scroll wins
    if (Math.abs(dx) > 8) {
      setIsDragging(true);
      const clamped = Math.max(-140, Math.min(110, dx));
      setOffsetX(clamped);
      e.preventDefault();
    }
  };

  const handleTouchEnd = (e) => {
    if (!isDragging) {
      // tap → navigate
      navigate(createPageUrl('JobDetail') + `?id=${job.id}`);
      return;
    }
    if (offsetX < -SWIPE_COMMIT) {
      // committed left swipe → Start Timer
      onStartTimer?.(job);
    } else if (offsetX > SWIPE_COMMIT) {
      // committed right swipe → open maps
      if (job.site_address) {
        window.open(`https://maps.google.com/maps?q=${encodeURIComponent(job.site_address)}`, '_blank');
      }
    }
    setOffsetX(0);
    setIsDragging(false);
  };

  // ── derived state ─────────────────────────────────────────────────
  const isUrgent  = job.priority === 'urgent';
  const canStart  = ['assigned', 'en_route'].includes(job.status);
  const isActive  = ['checked_in', 'in_progress'].includes(job.status);
  const isPaused  = job.status === 'paused';

  // Opacity of revealed action zones
  const rightOpacity = offsetX < -20 ? Math.min(1, (-offsetX - 20) / 60) : 0; // left swipe → right zone (start)
  const leftOpacity  = offsetX >  20 ? Math.min(1, (offsetX  - 20) / 60) : 0; // right swipe → left zone (nav/call)

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      navigate(createPageUrl('JobDetail') + `?id=${job.id}`);
    } else if (e.key === 'Enter' && e.shiftKey && (canStart || isPaused)) {
      onStartTimer?.(job);
    }
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{ touchAction: 'pan-y' }}
      role="article"
      aria-label={`${job.title}. Status: ${job.status?.replace(/_/g, ' ')}. Priority: ${job.priority || 'medium'}.`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >

      {/* ── Left zone (right swipe): Navigate + Call ─────────────── */}
      <div
        className="absolute inset-y-0 left-0 flex"
        style={{ opacity: leftOpacity, pointerEvents: leftOpacity > 0.5 ? 'auto' : 'none' }}
      >
        <button
          onClick={() => job.site_address && window.open(`https://maps.google.com/maps?q=${encodeURIComponent(job.site_address)}`, '_blank')}
          className="flex flex-col items-center justify-center gap-1 bg-blue-500 px-5 h-full min-w-[72px]"
          aria-label={`Navigate to ${job.site_address || 'job site'} in maps`}
        >
          <Navigation className="h-5 w-5 text-white" aria-hidden="true" />
          <span className="text-white text-[10px] font-bold uppercase" aria-hidden="true">Maps</span>
        </button>
        {job.contact_phone && (
          <a
            href={`tel:${job.contact_phone}`}
            className="flex flex-col items-center justify-center gap-1 bg-slate-700 px-5 h-full min-w-[72px]"
            aria-label={`Call ${job.contact_name || job.contact_phone}`}
          >
            <Phone className="h-5 w-5 text-white" aria-hidden="true" />
            <span className="text-white text-[10px] font-bold uppercase" aria-hidden="true">Call</span>
          </a>
        )}
      </div>

      {/* ── Right zone (left swipe): Start / Check In ────────────── */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-emerald-500 min-w-[90px] px-5"
        style={{ opacity: rightOpacity, pointerEvents: rightOpacity > 0.5 ? 'auto' : 'none' }}
      >
        <button
          onClick={() => onStartTimer?.(job)}
          className="flex flex-col items-center gap-1"
          aria-label={`${canStart ? 'Start timer for' : 'Resume'} ${job.title}`}
        >
          <Play className="h-5 w-5 text-white" aria-hidden="true" />
          <span className="text-white text-[10px] font-bold uppercase" aria-hidden="true">
            {canStart ? 'Start' : 'Resume'}
          </span>
        </button>
      </div>

      {/* ── Card body ─────────────────────────────────────────────── */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging ? 'none' : 'transform 300ms cubic-bezier(0.34,1.56,0.64,1)',
          willChange: 'transform',
        }}
        className={cn(
          'relative bg-white border border-slate-100 p-4 select-none cursor-pointer',
          isUrgent && 'border-l-4 border-l-orange-400',
          isStarting && 'opacity-75'
        )}
      >
        {/* Urgent badge */}
        {isUrgent && (
          <div className="absolute top-3 right-10 flex items-center gap-1 bg-orange-50 text-orange-700 rounded-full px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500 motion-safe:animate-pulse inline-block" aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-wide">Urgent</span>
          </div>
        )}

        {/* Top row */}
        <div className="flex items-start justify-between mb-2.5">
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={job.status} />
              <SyncBadge status={job.sync_status} />
            </div>
            <h3
              className="font-semibold text-slate-900 text-base leading-snug"
              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {job.title}
            </h3>
            {job.project_name && (
              <p className="text-xs text-slate-500 mt-0.5 truncate">{job.project_name}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
            <PriorityIndicator priority={job.priority} />
            <ChevronRight className="h-4 w-4 text-slate-300" />
          </div>
        </div>

        {/* Meta rows */}
        <div className="space-y-1.5 mb-3">
          {job.site_address && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              <span className="truncate">{job.site_address}</span>
            </div>
          )}
          {job.scheduled_date && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              <span>
                {format(new Date(job.scheduled_date), 'MMM d')}
                {job.scheduled_time && ` · ${job.scheduled_time}`}
              </span>
            </div>
          )}
          {job.contact_name && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <User className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              <span className="truncate">{job.contact_name}</span>
            </div>
          )}
        </div>

        {/* Bottom CTA row — only for actionable statuses */}
        {(canStart || isActive || isPaused) && (
          <div className="flex gap-2 pt-2.5 border-t border-slate-50">
            {canStart && (
              <button
                onTouchEnd={(e) => { e.stopPropagation(); onStartTimer?.(job); }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onStartTimer?.(job); }}
                className="flex-1 h-11 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
                aria-label={`Check in and start timer for ${job.title}`}
                aria-busy={isStarting}
              >
                {isStarting
                  ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full motion-safe:animate-spin" aria-hidden="true" />
                  : <Play className="h-3.5 w-3.5" aria-hidden="true" />
                }
                Check In & Start
              </button>
            )}
            {isActive && (
              <div className="flex-1 h-11 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center justify-center gap-2"
                aria-label="Job is in progress"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500 motion-safe:animate-pulse" aria-hidden="true" />
                In Progress
              </div>
            )}
            {isPaused && (
              <button
                onTouchEnd={(e) => { e.stopPropagation(); onStartTimer?.(job); }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onStartTimer?.(job); }}
                className="flex-1 h-11 rounded-xl bg-amber-50 text-amber-700 text-xs font-bold flex items-center justify-center gap-2 active:opacity-80"
                aria-label={`Resume timer for ${job.title}`}
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                Resume
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}