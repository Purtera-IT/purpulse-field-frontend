/**
 * LocationBadge — live GPS location status chip.
 * Compares current position against an array of job site coordinates.
 * States: acquiring | on_site | off_site | unknown (permission denied)
 */
import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, WifiOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const GEOFENCE_RADIUS_M = 200; // meters

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const STATES = {
  acquiring: { label: 'Locating…',  Icon: Loader2,    cls: 'text-slate-500',   bg: 'bg-slate-100 border-slate-200',    spin: true  },
  on_site:   { label: 'On-site',    Icon: Navigation, cls: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300', spin: false },
  off_site:  { label: 'Off-site',   Icon: MapPin,     cls: 'text-amber-700',   bg: 'bg-amber-50 border-amber-300',     spin: false },
  unknown:   { label: 'No GPS',     Icon: WifiOff,    cls: 'text-slate-500',   bg: 'bg-slate-100 border-slate-200',    spin: false },
};

export default function LocationBadge({ jobs = [], onStatusChange }) {
  const [gpsState,   setGpsState]   = useState('acquiring');
  const [nearestJob, setNearestJob] = useState(null);
  const [distMeters, setDistMeters] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) { setGpsState('unknown'); return; }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        let closest = null, closestDist = Infinity;
        for (const job of jobs) {
          if (job.site_lat == null || job.site_lon == null) continue;
          const d = haversineDistance(latitude, longitude, job.site_lat, job.site_lon);
          if (d < closestDist) { closestDist = d; closest = job; }
        }
        const state = closestDist <= GEOFENCE_RADIUS_M ? 'on_site' : 'off_site';
        setGpsState(state);
        setNearestJob(closest);
        setDistMeters(Math.round(closestDist));
        onStatusChange?.({ state, job: closest, distMeters: Math.round(closestDist), lat: latitude, lon: longitude });
      },
      () => setGpsState('unknown'),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [jobs.length]);

  const cfg = STATES[gpsState];
  const Icon = cfg.Icon;

  return (
    <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold', cfg.bg, cfg.cls)}>
      <Icon className={cn('h-3.5 w-3.5', cfg.spin && 'animate-spin')} />
      <span>{cfg.label}</span>
      {gpsState === 'on_site' && nearestJob && (
        <span className="font-normal opacity-70 truncate max-w-[100px]">{nearestJob.site_name}</span>
      )}
      {gpsState === 'off_site' && distMeters != null && (
        <span className="font-normal opacity-70">{distMeters > 1000 ? `${(distMeters / 1000).toFixed(1)}km` : `${distMeters}m`} away</span>
      )}
    </div>
  );
}