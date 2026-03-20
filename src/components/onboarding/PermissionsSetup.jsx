/**
 * PermissionsSetup
 * Step 3 — request Camera and Location permissions with graceful error states.
 *
 * States per permission:
 *   idle → requesting → granted | denied | unavailable
 *
 * Denied / Location:
 *   Show manual override guidance: Settings → Privacy → Location Services → [App] → While Using
 *
 * Denied / Camera:
 *   Show guidance: Settings → Privacy → Camera → [App]
 *   App continues without camera but evidences can only be file-picked (not native camera)
 *
 * Graceful degradation:
 *   - Location denied: all geo fields show "Manual entry required" — tech must type coordinates.
 *     Job check-in defaults to "manual" mode (no GPS auto-verify).
 *   - Camera denied: EvidenceCapture falls back to file picker input only (no overlay).
 */
import React, { useState } from 'react';
import { Camera, MapPin, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const PERMS = [
  {
    key: 'camera',
    icon: Camera,
    title: 'Camera access',
    desc: 'Required to capture evidence photos directly from this app.',
    required: true,
    iosPath: 'Settings → Privacy & Security → Camera → Purpulse',
    androidPath: 'Settings → Apps → Purpulse → Permissions → Camera',
    deniedWarning: 'You can still attach photos from your gallery, but live camera capture will be unavailable.',
  },
  {
    key: 'location',
    icon: MapPin,
    title: 'Location access',
    desc: 'Used for GPS-verified check-in and evidence geo-tagging.',
    required: false,
    iosPath: 'Settings → Privacy & Security → Location Services → Purpulse → While Using',
    androidPath: 'Settings → Apps → Purpulse → Permissions → Location → Allow while using',
    deniedWarning: 'Check-in will use manual mode. Evidence will not have GPS coordinates. Dispatchers may require manual location entry.',
  },
];

const STATE_ICON = {
  idle:        null,
  requesting:  <span className="h-5 w-5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin inline-block" />,
  granted:     <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  denied:      <XCircle className="h-5 w-5 text-red-500" />,
  unavailable: <AlertTriangle className="h-5 w-5 text-amber-500" />,
};

async function requestCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(t => t.stop());
    return 'granted';
  } catch (e) {
    if (e.name === 'NotAllowedError') return 'denied';
    return 'unavailable';
  }
}

async function requestLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve('unavailable'); return; }
    navigator.geolocation.getCurrentPosition(
      () => resolve('granted'),
      (e) => {
        if (e.code === e.PERMISSION_DENIED) resolve('denied');
        else resolve('unavailable');
      },
      { timeout: 6000 }
    );
  });
}

function PermRow({ perm, status, onRequest }) {
  const Icon = perm.icon;
  const isGranted   = status === 'granted';
  const isDenied    = status === 'denied';
  const isRequesting = status === 'requesting';
  const showGuide   = isDenied || status === 'unavailable';

  return (
    <div className={cn('rounded-2xl border-2 p-4 space-y-3 transition-all',
      isGranted  ? 'border-emerald-200 bg-emerald-50/50'
      : isDenied ? 'border-red-200 bg-red-50/50'
      : 'border-slate-200 bg-white'
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0',
            isGranted ? 'bg-emerald-100' : isDenied ? 'bg-red-100' : 'bg-slate-100'
          )}>
            <Icon className={cn('h-5 w-5', isGranted ? 'text-emerald-600' : isDenied ? 'text-red-500' : 'text-slate-500')} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-black text-slate-900">{perm.title}</p>
              {!perm.required && <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">Optional</span>}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{perm.desc}</p>
          </div>
        </div>
        <div className="flex-shrink-0">
          {STATE_ICON[status] || null}
        </div>
      </div>

      {/* Request / re-request */}
      {status === 'idle' && (
        <button onClick={onRequest}
          className="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-bold flex items-center justify-center gap-2 active:opacity-80"
        >
          Allow {perm.title.split(' ')[0]}
        </button>
      )}
      {isDenied && !isRequesting && (
        <button onClick={onRequest}
          className="w-full h-11 rounded-xl border-2 border-slate-200 text-slate-700 text-sm font-semibold flex items-center justify-center gap-2 active:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" /> Try Again
        </button>
      )}

      {/* Denied guidance */}
      {showGuide && (
        <div className="space-y-2">
          {isDenied && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <p className="text-xs font-bold text-amber-800 mb-1 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Manual override required
              </p>
              <p className="text-xs text-amber-700 leading-relaxed">{perm.deniedWarning}</p>
            </div>
          )}
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-bold text-blue-700 mb-1 flex items-center gap-1">
              <Info className="h-3 w-3" /> To enable manually:
            </p>
            <p className="text-[10px] text-blue-600 font-mono leading-relaxed">iOS: {perm.iosPath}</p>
            <p className="text-[10px] text-blue-600 font-mono leading-relaxed mt-0.5">Android: {perm.androidPath}</p>
          </div>
        </div>
      )}

      {isGranted && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> Permission granted
        </div>
      )}
    </div>
  );
}

export default function PermissionsSetup({ onNext }) {
  const [statuses, setStatuses] = useState({ camera: 'idle', location: 'idle' });

  const setStatus = (key, val) => setStatuses(p => ({ ...p, [key]: val }));

  const handleRequest = async (key) => {
    setStatus(key, 'requesting');
    const result = key === 'camera' ? await requestCamera() : await requestLocation();
    setStatus(key, result);
    // Persist flags for app-wide use
    localStorage.setItem(`purpulse_perm_${key}`, result);
  };

  const canContinue = statuses.camera !== 'idle'; // camera must be attempted; location optional

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900">App permissions</h2>
        <p className="text-sm text-slate-500 mt-1">
          Grant access to enable full functionality. Denied permissions degrade gracefully.
        </p>
      </div>

      <div className="space-y-3">
        {PERMS.map(perm => (
          <PermRow
            key={perm.key}
            perm={perm}
            status={statuses[perm.key]}
            onRequest={() => handleRequest(perm.key)}
          />
        ))}
      </div>

      {/* Summary of impact */}
      {(statuses.camera === 'denied' || statuses.location === 'denied') && (
        <div className="bg-slate-50 rounded-2xl px-4 py-3 space-y-1.5">
          <p className="text-xs font-black text-slate-700">Degraded mode active:</p>
          {statuses.camera === 'denied' && (
            <p className="text-xs text-slate-600 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              Camera — gallery picker only, no live capture
            </p>
          )}
          {statuses.location === 'denied' && (
            <p className="text-xs text-slate-600 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              Location — manual check-in mode, no GPS geo-tag
            </p>
          )}
        </div>
      )}

      <button
        onClick={onNext}
        disabled={!canContinue}
        className="w-full h-14 rounded-2xl bg-slate-900 text-white font-bold text-base disabled:opacity-30 active:opacity-80"
      >
        {canContinue ? 'Continue →' : 'Allow Camera to continue'}
      </button>
    </div>
  );
}