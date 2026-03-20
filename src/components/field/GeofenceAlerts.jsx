/**
 * GeofenceAlerts — context-aware alert banners for location/geofence issues.
 *
 * Alert types:
 *   unable_to_verify_arrival — no job site GPS coords, can't confirm on-site
 *   low_gps_accuracy         — accuracy > threshold, coords unreliable
 *   tracking_disabled        — user denied or disabled location permission
 *   off_site_while_working   — timer running but GPS shows off-site
 *
 * Dismissable per session. Shows CTA relevant to each alert.
 */
import React, { useState } from 'react';
import { AlertTriangle, MapPin, ShieldOff, Navigation, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const ALERT_CFG = {
  unable_to_verify_arrival: {
    Icon: Navigation,
    title: 'Unable to verify arrival',
    body: 'This job site has no GPS coordinates configured. Your check-in cannot be automatically verified.',
    action: 'Contact your dispatcher to add site coordinates, or use manual check-in.',
    cls: 'bg-amber-50 border-amber-200',
    iconCls: 'text-amber-600',
    textCls: 'text-amber-800',
    subCls: 'text-amber-700',
    cta: { label: 'Manual Check-in', action: 'manual_checkin' },
  },
  low_gps_accuracy: {
    Icon: AlertTriangle,
    title: 'Low GPS accuracy',
    body: 'Your device is reporting low GPS precision. Location-based check-in and geo-tagging may be unreliable.',
    action: 'Move to an open area away from buildings, or wait for GPS to lock.',
    cls: 'bg-amber-50 border-amber-200',
    iconCls: 'text-amber-600',
    textCls: 'text-amber-800',
    subCls: 'text-amber-700',
    cta: { label: 'Retry GPS', action: 'retry_gps' },
  },
  tracking_disabled: {
    Icon: ShieldOff,
    title: 'Location tracking disabled',
    body: 'Purpulse does not have location access. Check-in is manual only, and evidence will not be geo-tagged.',
    action: 'To re-enable: Settings → Privacy → Location Services → Purpulse → While Using App',
    cls: 'bg-slate-100 border-slate-300',
    iconCls: 'text-slate-500',
    textCls: 'text-slate-800',
    subCls: 'text-slate-600',
    cta: { label: 'Open Settings', action: 'open_settings' },
  },
  off_site_while_working: {
    Icon: MapPin,
    title: 'GPS shows you off-site',
    body: 'Your work timer is running but your current location is outside the job site geofence.',
    action: 'If you\'ve left the site, stop your timer. If this is incorrect, tap to override.',
    cls: 'bg-red-50 border-red-200',
    iconCls: 'text-red-600',
    textCls: 'text-red-800',
    subCls: 'text-red-700',
    cta: { label: 'Override', action: 'override_geofence' },
  },
};

function AlertBanner({ type, onDismiss, onCta, accuracy }) {
  const cfg = ALERT_CFG[type];
  if (!cfg) return null;
  const Icon = cfg.Icon;

  return (
    <div className={cn('rounded-2xl border p-4 relative', cfg.cls)}>
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 h-6 w-6 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors"
        aria-label="Dismiss alert"
      >
        <X className={cn('h-3.5 w-3.5', cfg.iconCls)} />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0', cfg.cls.includes('amber') ? 'bg-amber-100' : cfg.cls.includes('red') ? 'bg-red-100' : 'bg-slate-200')}>
          <Icon className={cn('h-5 w-5', cfg.iconCls)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-black', cfg.textCls)}>{cfg.title}</p>
          <p className={cn('text-[11px] mt-0.5 leading-relaxed', cfg.subCls)}>{cfg.body}</p>
          {type === 'low_gps_accuracy' && accuracy != null && (
            <p className={cn('text-[10px] font-mono mt-1', cfg.subCls)}>Current accuracy: ±{accuracy}m</p>
          )}
          <p className={cn('text-[11px] mt-1.5 font-medium', cfg.subCls)}>{cfg.action}</p>
        </div>
      </div>

      {cfg.cta && (
        <button
          onClick={() => onCta?.(cfg.cta.action)}
          className={cn(
            'mt-3 flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-colors',
            cfg.cls.includes('amber') ? 'bg-amber-600 text-white active:opacity-80' :
            cfg.cls.includes('red')   ? 'bg-red-600 text-white active:opacity-80'   :
            'bg-slate-700 text-white active:opacity-80'
          )}
        >
          {cfg.cta.label}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export default function GeofenceAlerts({ alerts = [], accuracy, onCtaAction }) {
  const [dismissed, setDismissed] = useState(new Set());

  const visible = alerts.filter(a => !dismissed.has(a));
  if (!visible.length) return null;

  const handleCta = (alertType, action) => {
    if (action === 'manual_checkin') {
      toast.info('Manual check-in mode — confirm your location with the dispatcher');
    } else if (action === 'retry_gps') {
      toast.info('Retrying GPS lock…');
      // Dismiss to allow re-trigger
      setDismissed(prev => new Set([...prev, alertType]));
      setTimeout(() => setDismissed(prev => { const s = new Set(prev); s.delete(alertType); return s; }), 1000);
    } else if (action === 'open_settings') {
      toast.info('Open your device Settings → Privacy → Location Services → Purpulse');
    } else if (action === 'override_geofence') {
      toast.success('Geofence override noted — location discrepancy logged');
      setDismissed(prev => new Set([...prev, alertType]));
    }
    onCtaAction?.(action);
  };

  return (
    <div className="space-y-2">
      {visible.map(alert => (
        <AlertBanner
          key={alert}
          type={alert}
          accuracy={accuracy}
          onDismiss={() => setDismissed(prev => new Set([...prev, alert]))}
          onCta={(action) => handleCta(alert, action)}
        />
      ))}
    </div>
  );
}