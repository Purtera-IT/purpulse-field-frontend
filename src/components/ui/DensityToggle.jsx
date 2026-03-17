import React from 'react';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: 'compact',     label: 'Compact'      },
  { value: 'comfortable', label: 'Comfortable'  },
];

export default function DensityToggle({ value, onChange }) {
  return (
    <div className="flex bg-slate-100 rounded-[8px] p-0.5 gap-0.5">
      {OPTIONS.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'px-3 h-7 rounded-[6px] text-xs font-bold transition-all',
            value === o.value ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}