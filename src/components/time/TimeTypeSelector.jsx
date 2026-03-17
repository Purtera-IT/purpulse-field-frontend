/**
 * TimeTypeSelector — Quick 4-button time type selector
 * Work | Break | Travel | Off
 */
import React from 'react';
import { Play, Coffee, Navigation2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

const TIME_TYPES = [
  { type: 'work',   label: 'Work',   icon: Play,        bg: 'bg-emerald-600', hover: 'hover:bg-emerald-700' },
  { type: 'break',  label: 'Break',  icon: Coffee,      bg: 'bg-amber-600',   hover: 'hover:bg-amber-700' },
  { type: 'travel', label: 'Travel', icon: Navigation2, bg: 'bg-blue-600',    hover: 'hover:bg-blue-700' },
  { type: 'off',    label: 'Off',    icon: Circle,      bg: 'bg-slate-400',   hover: 'hover:bg-slate-500' },
];

export default function TimeTypeSelector({ onSelect, disabled }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {TIME_TYPES.map(({ type, label, icon: Icon, bg, hover }) => (
        <button
          key={type}
          onClick={() => onSelect(type)}
          disabled={disabled}
          className={cn(
            'h-20 rounded-2xl text-white flex flex-col items-center justify-center gap-1.5 font-bold text-xs transition-all',
            bg, hover, 'disabled:opacity-40 active:scale-95'
          )}
        >
          <Icon className="h-5 w-5" />
          {label}
        </button>
      ))}
    </div>
  );
}