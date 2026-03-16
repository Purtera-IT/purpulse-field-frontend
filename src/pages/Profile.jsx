/**
 * Profile page — technician identity, certs, stats, settings
 */
import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, AlertTriangle, XCircle, ChevronRight, LogOut, Star, Clock, Briefcase, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MOCK_PROFILE } from '@/lib/mockData';
import { format } from 'date-fns';

const CERT_CONFIG = {
  valid:          { label: 'Valid',          icon: ShieldCheck,   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  expiring_soon:  { label: 'Expiring Soon',  icon: AlertTriangle, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  expired:        { label: 'Expired',        icon: XCircle,       cls: 'bg-red-50 text-red-700 border-red-200' },
};

function CertCard({ cert }) {
  const cfg = CERT_CONFIG[cert.status] ?? CERT_CONFIG.valid;
  const Icon = cfg.icon;
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-3">
        <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 border', cfg.cls)}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">{cert.name}</p>
          <p className="text-[11px] text-slate-400">Expires {format(new Date(cert.expires), 'MMM d, yyyy')}</p>
        </div>
      </div>
      <span className={cn('text-[10px] font-bold px-2.5 py-1 rounded-full border', cfg.cls)}>
        {cfg.label}
      </span>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col gap-1">
      <div className={cn('h-8 w-8 rounded-xl flex items-center justify-center mb-1', color)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <p className="text-2xl font-black text-slate-900 tabular-nums">{value}</p>
      <p className="text-xs text-slate-400 font-medium">{label}</p>
    </div>
  );
}

export default function Profile() {
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me(), staleTime: 60_000 });
  const profile = { ...MOCK_PROFILE, ...(user ?? {}) };

  const initials = profile.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">

        {/* Identity card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-slate-900 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xl font-black">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-black text-slate-900">{profile.full_name ?? 'Technician'}</p>
              <p className="text-sm text-slate-500 truncate">{profile.email}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                  {profile.badge_number}
                </span>
                <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">
                  {profile.cert_level}
                </span>
                <span className="text-[10px] font-bold bg-slate-50 text-slate-500 px-2.5 py-1 rounded-full border border-slate-200">
                  {profile.region}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-0.5">Performance · YTD</p>
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Briefcase}   label="Jobs Completed"   value={profile.stats.jobs_completed_ytd} color="bg-slate-100" />
            <StatCard icon={Star}        label="Avg CSAT"          value={`${profile.stats.avg_csat}/5`}     color="bg-amber-50" />
            <StatCard icon={TrendingUp}  label="On-Time Rate"      value={`${profile.stats.on_time_rate}%`}  color="bg-emerald-50" />
            <StatCard icon={Clock}       label="Hours This Week"   value={profile.stats.hours_logged_week}   color="bg-blue-50" />
          </div>
        </div>

        {/* Certifications */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Certifications</p>
          {profile.certifications.map(cert => (
            <CertCard key={cert.name} cert={cert} />
          ))}
        </div>

        {/* Settings links */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          {[
            { label: 'Notification Preferences', sub: 'Push, email, in-app' },
            { label: 'Privacy & Location', sub: 'Geofence, GPS logging' },
            { label: 'App Appearance', sub: 'Light / dark / system' },
            { label: 'About & Licenses', sub: 'v1.0.0 · base44 platform' },
          ].map((item, i) => (
            <button
              key={i}
              className="w-full flex items-center justify-between px-4 py-3.5 border-b border-slate-100 last:border-0 active:bg-slate-50 text-left"
              aria-label={item.label}
            >
              <div>
                <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                <p className="text-[11px] text-slate-400">{item.sub}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" aria-hidden="true" />
            </button>
          ))}
        </div>

        {/* Logout */}
        <button
          onClick={() => base44.auth.logout()}
          className="w-full h-12 rounded-2xl border-2 border-red-200 text-red-600 font-bold text-sm flex items-center justify-center gap-2 active:bg-red-50 transition-colors"
          aria-label="Log out"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Log Out
        </button>
      </div>
    </div>
  );
}