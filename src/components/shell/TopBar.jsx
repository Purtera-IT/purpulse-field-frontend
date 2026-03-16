/**
 * TopBar — persistent app shell header
 * Shows: page title, technician identity chip, sync badge, location badge
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { MapPin, MapPinOff, Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Location permission hook ─────────────────────────────────────
function useLocationPermission() {
  const [state, setState] = useState('unknown'); // 'granted' | 'denied' | 'prompt' | 'unknown'
  useEffect(() => {
    if (!navigator.permissions) { setState('unknown'); return; }
    navigator.permissions.query({ name: 'geolocation' }).then(result => {
      setState(result.state);
      result.onchange = () => setState(result.state);
    }).catch(() => setState('unknown'));
  }, []);
  return state;
}

// ── Sync status hook ─────────────────────────────────────────────
function useSyncState() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  const { data: syncItems = [] } = useQuery({
    queryKey: ['sync-status-bar'],
    queryFn: () => base44.entities.SyncQueue.list('-created_date', 20),
    refetchInterval: 8000,
    staleTime: 5000,
  });
  const pending = syncItems.filter(s => ['pending','in_progress'].includes(s.status)).length;
  const failed  = syncItems.filter(s => s.status === 'failed').length;
  return { isOnline, pending, failed };
}

export default function TopBar({ title, subtitle, showBack, onBack }) {
  const locState = useLocationPermission();
  const { isOnline, pending, failed } = useSyncState();
  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
    staleTime: 60_000,
  });

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  // Sync badge config
  let syncIcon, syncText, syncCls;
  if (!isOnline) {
    syncIcon = <WifiOff className="h-3 w-3" aria-hidden="true" />;
    syncText = 'Offline';
    syncCls = 'bg-amber-100 text-amber-700 border-amber-200';
  } else if (failed > 0) {
    syncIcon = <AlertTriangle className="h-3 w-3" aria-hidden="true" />;
    syncText = `${failed} failed`;
    syncCls = 'bg-red-100 text-red-700 border-red-200';
  } else if (pending > 0) {
    syncIcon = <RefreshCw className="h-3 w-3 motion-safe:animate-spin" aria-hidden="true" />;
    syncText = `${pending} syncing`;
    syncCls = 'bg-blue-100 text-blue-700 border-blue-200';
  } else {
    syncIcon = <Wifi className="h-3 w-3" aria-hidden="true" />;
    syncText = 'Synced';
    syncCls = 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }

  // Location badge config
  const locCls = locState === 'granted'
    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : locState === 'denied'
    ? 'bg-red-100 text-red-700 border-red-200'
    : 'bg-slate-100 text-slate-500 border-slate-200';
  const locLabel = locState === 'granted' ? 'GPS' : locState === 'denied' ? 'No GPS' : 'GPS?';

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-100">
      {/* Main bar */}
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">

        {/* Back / logo */}
        {showBack ? (
          <button
            onClick={onBack}
            className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0"
            aria-label="Go back"
          >
            <svg className="h-4 w-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        ) : (
          <div className="h-8 w-8 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0" aria-hidden="true">
            <span className="text-white text-xs font-black tracking-tight">P</span>
          </div>
        )}

        {/* Title */}
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-black text-slate-900 leading-none truncate">{title}</h1>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{subtitle}</p>}
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Location badge */}
          <div
            role="status"
            aria-label={`GPS location: ${locLabel}`}
            className={cn('flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold', locCls)}
          >
            {locState === 'granted'
              ? <MapPin className="h-3 w-3" aria-hidden="true" />
              : <MapPinOff className="h-3 w-3" aria-hidden="true" />
            }
            <span className="hidden sm:inline">{locLabel}</span>
          </div>

          {/* Sync badge */}
          <div
            role="status"
            aria-live="polite"
            aria-label={`Sync: ${syncText}`}
            className={cn('flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold', syncCls)}
          >
            {syncIcon}
            <span className="hidden sm:inline">{syncText}</span>
          </div>

          {/* Avatar */}
          <div
            className="h-8 w-8 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0"
            aria-label={`Signed in as ${user?.full_name ?? 'technician'}`}
            title={user?.full_name}
          >
            <span className="text-white text-[11px] font-black">{initials}</span>
          </div>
        </div>
      </div>
    </header>
  );
}