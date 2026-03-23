/**
 * PullToRefreshIndicator — visual indicator for pull-to-refresh gesture.
 */
import React from 'react';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const THRESHOLD = 72;

export default function PullToRefreshIndicator({ pullDistance, refreshing }) {
  const visible = pullDistance > 8 || refreshing;
  const progress = Math.min(pullDistance / THRESHOLD, 1);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.15 }}
          className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center"
        >
          <div className="h-9 w-9 rounded-full bg-white shadow-lg border border-slate-100 flex items-center justify-center">
            {refreshing ? (
              <Loader2 className="h-4 w-4 text-slate-600 animate-spin" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 12a7 7 0 11-7-7"
                  style={{
                    strokeDasharray: 40,
                    strokeDashoffset: 40 - progress * 40,
                    color: progress >= 1 ? '#0f172a' : '#94a3b8',
                  }}
                />
              </svg>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}