import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, WifiOff, Check, AlertTriangle } from 'lucide-react';

export default function SyncIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const { data: pendingItems = [] } = useQuery({
    queryKey: ['sync-queue-pending'],
    queryFn: () => base44.entities.SyncQueue.filter({ status: 'pending' }),
    refetchInterval: 5000,
  });

  const { data: failedItems = [] } = useQuery({
    queryKey: ['sync-queue-failed'],
    queryFn: () => base44.entities.SyncQueue.filter({ status: 'failed' }),
    refetchInterval: 10000,
  });

  const pendingCount = pendingItems.length;
  const failedCount = failedItems.length;

  // Wrap in role="status" + aria-live so screen readers announce changes
  // aria-atomic="true" so the whole label is read, not just the diff
  if (!isOnline) {
    return (
      <div role="status" aria-live="polite" aria-atomic="true"
        aria-label="Sync status: offline — no internet connection"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-xs font-medium"
      >
        <WifiOff className="h-3 w-3" aria-hidden="true" />
        Offline
      </div>
    );
  }

  if (failedCount > 0) {
    return (
      <div role="status" aria-live="polite" aria-atomic="true"
        aria-label={`Sync status: ${failedCount} item${failedCount !== 1 ? 's' : ''} failed to sync`}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium"
      >
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        {failedCount} failed
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div role="status" aria-live="polite" aria-atomic="true"
        aria-label={`Sync status: syncing ${pendingCount} item${pendingCount !== 1 ? 's' : ''}`}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium"
      >
        <RefreshCw className="h-3 w-3 motion-safe:animate-spin" aria-hidden="true" />
        Syncing {pendingCount}
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" aria-atomic="true"
      aria-label="Sync status: all items synced"
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium"
    >
      <Check className="h-3 w-3" aria-hidden="true" />
      Synced
    </div>
  );
}