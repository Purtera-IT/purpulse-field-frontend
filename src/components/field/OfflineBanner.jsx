import React from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineBanner({ pendingCount }) {
  return (
    <div className="bg-amber-50 border-b border-amber-100 px-4 py-2">
      <div className="max-w-lg mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <WifiOff className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
          <span className="text-xs font-medium text-amber-700">
            Offline — changes will sync when reconnected
          </span>
        </div>
        {pendingCount > 0 && (
          <span className="text-[11px] font-bold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5 flex-shrink-0">
            {pendingCount} queued
          </span>
        )}
      </div>
    </div>
  );
}