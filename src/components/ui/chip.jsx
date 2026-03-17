/**
 * Chip — small rectangular label, replaces pill chips across the app.
 * Height: 28px (default) / 32px (md). Uses enterprise token radius (8px).
 */
import React from 'react';
import { cn } from '@/lib/utils';

export function Chip({ children, className, size = 'sm', active = false, onClick }) {
  return (
    <span
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick(e) : undefined}
      className={cn(
        'inline-flex items-center gap-1 font-semibold uppercase tracking-wide border transition-colors select-none',
        'rounded-[8px]',
        size === 'sm'  && 'h-7 px-2 text-[10px]',
        size === 'md'  && 'h-8 px-2.5 text-xs',
        active
          ? 'bg-slate-900 text-white border-slate-900'
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </span>
  );
}

export default Chip;