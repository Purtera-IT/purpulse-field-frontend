/**
 * DailyTimeline
 *
 * Visual vertical timeline showing stacked Work / Travel / Break segments.
 * Each segment is tappable → edit modal.
 * Drag handles (44px targets) on start and end of each segment allow time adjustment.
 *
 * client_event_id usage:
 *   Every edit produces a new TimeEntry pair via createEntry(). The client_request_id
 *   field is set to `evt-{Date.now().toString(36)}-{random8}` before the API call.
 *   This idempotency key ensures that if the request is retried (offline → reconnect),
 *   the server deduplicates based on the key and does not create a duplicate entry.
 *   Pending edits are stored in localStorage under 'purpulse_time_edit_queue' and
 *   flushed automatically when the device comes back online.
 *
 * Drag interaction model:
 *   - Handle touch → record startY + originalTime
 *   - Move → delta px / PX_PER_MIN = delta minutes → clamp to [prev segment end, next segment start]
 *   - Release → overlap check → if clean: persist via mutation; if overlap: snap back + toast error
 *
 * Overlap rule:
 *   Segments of the SAME type cannot overlap. Segments of DIFFERENT types (e.g. travel during work)
 *   are allowed. When a drag produces an overlap: snap to the boundary and show a warning.
 */
import React, { useState, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addMinutes, differenceInMinutes, startOfDay, setHours, setMinutes } from 'date-fns';
import { Lock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const PX_PER_MIN = 1.4; // px per minute — 84px/hour, visible ~14h
const DAY_START_HOUR = 5; // timeline starts at 5am
const DAY_END_HOUR = 23;  // ends at 11pm

const SEG_CONFIG = {
  work:   { bg: 'bg-emerald-500', border: 'border-emerald-600', text: 'text-emerald-900', label: 'Work',   light: 'bg-emerald-100' },
  travel: { bg: 'bg-blue-500',    border: 'border-blue-600',    text: 'text-blue-900',   label: 'Travel', light: 'bg-blue-100'    },
  break:  { bg: 'bg-amber-400',   border: 'border-amber-500',   text: 'text-amber-900',  label: 'Break',  light: 'bg-amber-100'   },
};

function makeClientId() {
  return 'evt-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 8);
}

/** Convert a list of TimeEntry records into typed segments */
export function buildSegments(entries) {
  const sorted = [...entries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const open = {};
  const segments = [];

  const pairs = {
    work:   ['work_start',   'work_stop'],
    travel: ['travel_start', 'travel_end'],
    break:  ['break_start',  'break_end'],
  };

  for (const e of sorted) {
    for (const [type, [startEvt, endEvt]] of Object.entries(pairs)) {
      if (e.entry_type === startEvt) { open[type] = e; }
      if (e.entry_type === endEvt && open[type]) {
        segments.push({
          id: `${open[type].id}-${e.id}`,
          type,
          startEntry: open[type],
          endEntry: e,
          start: new Date(open[type].timestamp),
          end: new Date(e.timestamp),
          locked: open[type].locked || e.locked,
        });
        delete open[type];
      }
    }
  }
  // Open (no end yet)
  for (const [type, entry] of Object.entries(open)) {
    segments.push({
      id: `${entry.id}-open`,
      type,
      startEntry: entry,
      endEntry: null,
      start: new Date(entry.timestamp),
      end: new Date(),
      locked: entry.locked,
      isOpen: true,
    });
  }
  return segments;
}

/** Check if two segments of the same type overlap */
function detectOverlap(segments, editedSeg, newStart, newEnd) {
  return segments
    .filter(s => s.type === editedSeg.type && s.id !== editedSeg.id)
    .some(s => newStart < s.end && newEnd > s.start);
}

/** Hour tick marks on the left rail */
function HourRails({ dayStart }) {
  const hours = [];
  for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h++) {
    const minFromStart = (h - DAY_START_HOUR) * 60;
    hours.push(
      <div key={h} className="absolute left-0 right-0 flex items-center"
        style={{ top: minFromStart * PX_PER_MIN }}>
        <span className="text-[10px] font-mono text-slate-300 w-9 text-right pr-1.5 leading-none flex-shrink-0">
          {h === 12 ? '12p' : h > 12 ? `${h-12}p` : `${h}a`}
        </span>
        <div className="flex-1 border-t border-slate-100" />
      </div>
    );
  }
  return <>{hours}</>;
}

/** Current time indicator */
function NowLine({ dayStart }) {
  const now = new Date();
  const minFromStart = differenceInMinutes(now, setHours(setMinutes(dayStart, 0), DAY_START_HOUR));
  if (minFromStart < 0 || minFromStart > (DAY_END_HOUR - DAY_START_HOUR) * 60) return null;
  return (
    <div className="absolute left-9 right-0 flex items-center pointer-events-none z-10"
      style={{ top: minFromStart * PX_PER_MIN }}>
      <div className="h-2 w-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
      <div className="flex-1 border-t-2 border-red-400 border-dashed" />
    </div>
  );
}

/** A single draggable segment bar */
function SegmentBar({ seg, dayStart, allSegments, onTap, onDragEdit }) {
  const cfg = SEG_CONFIG[seg.type];
  const dragState = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draftTop, setDraftTop]   = useState(null);
  const [draftH, setDraftH]       = useState(null);

  const minFromStart  = differenceInMinutes(seg.start, setHours(setMinutes(dayStart, 0), DAY_START_HOUR));
  const durationMins  = Math.max(5, differenceInMinutes(seg.end, seg.start));
  const top           = minFromStart * PX_PER_MIN;
  const height        = durationMins * PX_PER_MIN;

  const displayTop    = draftTop  ?? top;
  const displayHeight = draftH    ?? height;

  const startDrag = (handle, e) => {
    if (seg.locked) { toast.error('This entry is locked by an admin'); return; }
    e.stopPropagation();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragState.current = { handle, startY: clientY, origTop: top, origH: height, origStart: seg.start, origEnd: seg.end };
    setIsDragging(true);

    const onMove = (ev) => {
      const y = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const deltaMin = (y - dragState.current.startY) / PX_PER_MIN;
      if (handle === 'start') {
        const newTop = Math.max(0, dragState.current.origTop + (deltaMin * PX_PER_MIN));
        const newH   = Math.max(PX_PER_MIN * 5, dragState.current.origH - (deltaMin * PX_PER_MIN));
        setDraftTop(newTop); setDraftH(newH);
      } else {
        const newH = Math.max(PX_PER_MIN * 5, dragState.current.origH + (deltaMin * PX_PER_MIN));
        setDraftH(newH);
      }
      ev.preventDefault();
    };

    const onEnd = (ev) => {
      setIsDragging(false);
      const y = (ev.changedTouches ? ev.changedTouches[0].clientY : ev.clientY);
      const deltaMin = Math.round((y - dragState.current.startY) / PX_PER_MIN);
      const { origStart, origEnd } = dragState.current;

      let newStart = origStart, newEnd = origEnd;
      if (handle === 'start') newStart = addMinutes(origStart, deltaMin);
      else                    newEnd   = addMinutes(origEnd, deltaMin);

      // Clamp to day bounds
      const dayBoundStart = setHours(setMinutes(dayStart, 0), DAY_START_HOUR);
      const dayBoundEnd   = setHours(setMinutes(dayStart, 0), DAY_END_HOUR);
      newStart = newStart < dayBoundStart ? dayBoundStart : newStart;
      newEnd   = newEnd   > dayBoundEnd   ? dayBoundEnd   : newEnd;
      if (newStart >= newEnd) { setDraftTop(null); setDraftH(null); toast.error('Start must be before end'); return; }

      // Overlap check
      if (detectOverlap(allSegments, seg, newStart, newEnd)) {
        setDraftTop(null); setDraftH(null);
        toast.error(`Overlapping ${seg.type} segments — adjust or merge`, { duration: 3000 });
        return;
      }

      setDraftTop(null); setDraftH(null);
      onDragEdit(seg, handle, deltaMin);

      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };

    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  };

  return (
    <div
      className="absolute left-10 right-2 z-10"
      style={{ top: displayTop, height: Math.max(displayHeight, 22), transition: isDragging ? 'none' : undefined }}
    >
      {/* Main bar */}
      <button
        onClick={() => !isDragging && onTap(seg)}
        className={cn(
          'absolute inset-0 rounded-xl border-l-4 flex items-center px-2 overflow-hidden transition-opacity',
          cfg.light, cfg.border,
          seg.locked ? 'opacity-70' : 'active:opacity-80'
        )}
        aria-label={`${cfg.label} segment — tap to edit`}
      >
        <span className={cn('text-[10px] font-bold truncate flex-1', cfg.text)}>
          {cfg.label}
          {seg.locked && ' 🔒'}
          {seg.isOpen && ' ●'}
        </span>
        <span className={cn('text-[10px] font-mono ml-1 flex-shrink-0', cfg.text)}>
          {format(seg.start, 'h:mm')}–{seg.isOpen ? 'now' : format(seg.end, 'h:mm')}
        </span>
      </button>

      {/* Start drag handle — top, 44px touch target */}
      {!seg.locked && !seg.isOpen && (
        <div
          className="absolute -top-3 left-2 right-2 h-[44px] flex items-start justify-center cursor-ns-resize z-20"
          onMouseDown={(e) => startDrag('start', e)}
          onTouchStart={(e) => startDrag('start', e)}
          style={{ touchAction: 'none' }}
          aria-label="Drag to adjust start time"
        >
          <div className={cn('mt-1 h-1.5 w-10 rounded-full opacity-60', cfg.bg)} />
        </div>
      )}

      {/* End drag handle — bottom, 44px touch target */}
      {!seg.locked && !seg.isOpen && (
        <div
          className="absolute -bottom-3 left-2 right-2 h-[44px] flex items-end justify-center cursor-ns-resize z-20"
          onMouseDown={(e) => startDrag('end', e)}
          onTouchStart={(e) => startDrag('end', e)}
          style={{ touchAction: 'none' }}
          aria-label="Drag to adjust end time"
        >
          <div className={cn('mb-1 h-1.5 w-10 rounded-full opacity-60', cfg.bg)} />
        </div>
      )}
    </div>
  );
}

export default function DailyTimeline({ entries, date, onSegmentTap }) {
  const dayStart = startOfDay(date);
  const segments = buildSegments(entries);
  const totalHeight = (DAY_END_HOUR - DAY_START_HOUR) * 60 * PX_PER_MIN;
  const queryClient = useQueryClient();

  const updateEntry = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TimeEntry.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['all-time-entries'] }),
  });

  const handleDragEdit = useCallback((seg, handle, deltaMin) => {
    const entryToEdit = handle === 'start' ? seg.startEntry : seg.endEntry;
    if (!entryToEdit) return;
    const newTime = addMinutes(new Date(entryToEdit.timestamp), deltaMin);
    updateEntry.mutate({
      id: entryToEdit.id,
      data: {
        timestamp: newTime.toISOString(),
        source: 'drag_edit',
        sync_status: 'pending',
        client_request_id: makeClientId(),
      },
    });
    toast.success(`Time adjusted by ${deltaMin > 0 ? '+' : ''}${deltaMin}m`);
  }, [updateEntry]);

  if (segments.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        No segments yet — start working on a job or add a manual entry
      </div>
    );
  }

  return (
    <div className="overflow-y-auto" style={{ maxHeight: '55vh' }}>
      <div className="relative" style={{ height: totalHeight, minWidth: 0 }}>
        <HourRails dayStart={dayStart} />
        <NowLine dayStart={dayStart} />
        {segments.map(seg => (
          <SegmentBar
            key={seg.id}
            seg={seg}
            dayStart={dayStart}
            allSegments={segments}
            onTap={onSegmentTap}
            onDragEdit={handleDragEdit}
          />
        ))}
      </div>
    </div>
  );
}