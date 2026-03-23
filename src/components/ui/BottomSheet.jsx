/**
 * BottomSheet — branded native-feel bottom sheet for mobile selects.
 * Replaces <select> elements across the app.
 */
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomSheet({ open, onClose, title, children }) {
  // Prevent body scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />
          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-slate-200" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <p className="text-sm font-bold text-slate-900">{title}</p>
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200"
              >
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * SelectSheet — drop-in replacement for <select>.
 * Usage:
 *   <SelectSheet value={val} onChange={setVal} options={[{value,label}]} placeholder="Pick one" />
 */
export function SelectSheet({ value, onChange, options = [], placeholder = 'Select…', title, className }) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'w-full flex items-center justify-between px-3 h-10 rounded-lg border border-slate-200 bg-white text-sm text-left transition hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10',
          !selected && 'text-slate-400',
          className
        )}
      >
        <span className={selected ? 'text-slate-800 font-medium' : 'text-slate-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="h-4 w-4 text-slate-400 flex-shrink-0 ml-2" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={title || placeholder}>
        <div className="py-2">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn(
                'w-full flex items-center justify-between px-5 py-3.5 text-sm transition active:bg-slate-50',
                opt.value === value ? 'text-slate-900 font-semibold' : 'text-slate-600'
              )}
            >
              <span>{opt.label}</span>
              {opt.value === value && <Check className="h-4 w-4 text-slate-900 flex-shrink-0" />}
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}