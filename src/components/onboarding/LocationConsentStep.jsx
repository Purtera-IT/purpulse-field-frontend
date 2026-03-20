/**
 * LocationConsentStep — dedicated location consent screen for onboarding.
 *
 * Explains WHY location is needed before triggering the OS prompt.
 * Handles: allowed | denied | limited | unavailable
 * Privacy-first: transparent, opt-in, with fallback disclosure.
 */
import React, { useState } from 'react';
import {
  MapPin, Clock, ShieldCheck, Truck, AlertTriangle,
  CheckCircle2, XCircle, Info, RefreshCw, ChevronRight, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PURPULSE_PERM_LOCATION_KEY,
  PURPULSE_LOCATION_CONSENT_TS_KEY,
} from '@/lib/locationConsent';

function persistLocationConsent(value) {
  localStorage.setItem(PURPULSE_PERM_LOCATION_KEY, value);
  localStorage.setItem(PURPULSE_LOCATION_CONSENT_TS_KEY, new Date().toISOString());
}

const WHY_ITEMS = [
  {
    icon: MapPin,
    title: 'Check-in & Check-out',
    desc: 'Automatically verify your arrival and departure at job sites using GPS — no manual entry needed.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: Clock,
    title: 'Time Verification',
    desc: 'GPS timestamps confirm when work sessions start and end for accurate billing and payroll.',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: ShieldCheck,
    title: 'Site Audit Trail',
    desc: 'Evidence photos and field actions are geo-tagged to create a tamper-proof job record.',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    icon: Truck,
    title: 'Dispatch & Safety',
    desc: 'Dispatchers can confirm you reached the site and respond faster in emergency situations.',
    color: 'bg-amber-50 text-amber-600',
  },
];

const STATE_CFG = {
  idle: null,
  requesting: null,
  granted: {
    cls: 'border-emerald-200 bg-emerald-50',
    label: 'Location access granted',
    sub: 'GPS check-in, geo-tagged evidence, and geofence detection are all enabled.',
    Icon: CheckCircle2, iconCls: 'text-emerald-600',
  },
  limited: {
    cls: 'border-amber-200 bg-amber-50',
    label: 'Limited location access',
    sub: 'Precise GPS is not available. Check-in will use manual mode. Some features may be degraded.',
    Icon: AlertTriangle, iconCls: 'text-amber-600',
  },
  denied: {
    cls: 'border-red-100 bg-red-50',
    label: 'Location access denied',
    sub: 'Check-in defaults to manual mode. Evidence will not be geo-tagged. Your PM may require manual location confirmation.',
    Icon: XCircle, iconCls: 'text-red-500',
  },
  unavailable: {
    cls: 'border-amber-200 bg-amber-50',
    label: 'GPS unavailable on this device',
    sub: 'Location features are not supported. All check-ins will be manual.',
    Icon: AlertTriangle, iconCls: 'text-amber-600',
  },
};

async function requestLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve('unavailable'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Check accuracy — if >100m, treat as "limited"
        if (pos.coords.accuracy > 100) resolve('limited');
        else resolve('granted');
      },
      (e) => {
        if (e.code === e.PERMISSION_DENIED) resolve('denied');
        else resolve('unavailable');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

export default function LocationConsentStep({ onNext, onSkip }) {
  const [status, setStatus] = useState('idle'); // idle | requesting | granted | limited | denied | unavailable

  const handleRequest = async () => {
    setStatus('requesting');
    const result = await requestLocation();
    setStatus(result);
    persistLocationConsent(result);
  };

  const stateCfg = STATE_CFG[status];
  const isDone   = ['granted', 'limited', 'denied', 'unavailable'].includes(status);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="h-16 w-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto shadow-lg">
          <MapPin className="h-8 w-8 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900">Location Access</h2>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">
            Purpulse uses your location to streamline field operations. Here's exactly how and why.
          </p>
        </div>
      </div>

      {/* Why we need it */}
      <div className="space-y-2">
        {WHY_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="flex items-start gap-3 bg-white rounded-2xl border border-slate-100 px-4 py-3.5">
              <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0', item.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{item.title}</p>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">{item.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Privacy notice */}
      <div className="flex items-start gap-3 bg-slate-50 rounded-2xl border border-slate-200 px-4 py-3.5">
        <Eye className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-slate-700">Privacy Disclosure</p>
          <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
            Location is only recorded <strong>during active work sessions</strong> — never in the background.
            Data is used solely for job verification and safety. It is never sold or shared outside your organization.
          </p>
        </div>
      </div>

      {/* Result state banner */}
      {stateCfg && (
        <div className={cn('rounded-2xl border-2 p-4 flex items-start gap-3', stateCfg.cls)}>
          <stateCfg.Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', stateCfg.iconCls)} />
          <div>
            <p className="text-sm font-black text-slate-900">{stateCfg.label}</p>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{stateCfg.sub}</p>
          </div>
        </div>
      )}

      {/* Denied — OS guidance */}
      {status === 'denied' && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3.5">
          <p className="text-[10px] font-black text-blue-700 uppercase tracking-wide mb-2 flex items-center gap-1">
            <Info className="h-3 w-3" /> To enable manually
          </p>
          <p className="text-[11px] text-blue-600 font-mono leading-relaxed">
            iOS: Settings → Privacy → Location Services → Purpulse → While Using App
          </p>
          <p className="text-[11px] text-blue-600 font-mono leading-relaxed mt-1">
            Android: Settings → Apps → Purpulse → Permissions → Location
          </p>
        </div>
      )}

      {/* CTA */}
      {!isDone && (
        <button
          onClick={handleRequest}
          disabled={status === 'requesting'}
          className="w-full h-14 rounded-2xl bg-blue-600 text-white font-bold text-base active:opacity-80 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {status === 'requesting'
            ? <><span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Requesting…</>
            : <><MapPin className="h-5 w-5" /> Allow Location Access</>
          }
        </button>
      )}

      {isDone && (
        <button onClick={onNext}
          className="w-full h-14 rounded-2xl bg-slate-900 text-white font-bold text-base active:opacity-80 flex items-center justify-center gap-2">
          Continue <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* Skip */}
      {!isDone && status !== 'requesting' && (
        <button onClick={() => { persistLocationConsent('denied'); onNext?.(); }}
          className="w-full text-center text-sm text-slate-400 font-semibold py-1 active:text-slate-600">
          Skip for now — use manual check-in
        </button>
      )}

      {/* Retry after denied */}
      {status === 'denied' && (
        <button onClick={handleRequest}
          className="w-full h-11 rounded-2xl border-2 border-slate-200 text-slate-600 text-sm font-semibold flex items-center justify-center gap-2 active:bg-slate-50">
          <RefreshCw className="h-4 w-4" /> Try Again
        </button>
      )}
    </div>
  );
}