/**
 * Profile — field technician identity, session, device, permissions, and preferences.
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  User, LogOut, Smartphone, Shield, Bell, MapPin, Camera,
  ChevronRight, ShieldCheck, AlertTriangle, XCircle, Star,
  Clock, Briefcase, TrendingUp, Info, Eye, Link as LinkIcon,
  SlidersHorizontal, Palette,
} from 'lucide-react';
import DensityToggle from '../components/ui/DensityToggle';
import ThemeToggle from '../components/ui/ThemeToggle';
import { useAppPreferences } from '../hooks/useAppPreferences';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MOCK_PROFILE } from '@/lib/mockData';
import { MOCK_JOBS } from '@/lib/mockJobs';
import { format } from 'date-fns';

// ── Helpers ──────────────────────────────────────────────────────────
function SectionCard({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      {title && (
        <div className="px-4 py-2.5 border-b border-slate-50">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
        </div>
      )}
      {children}
    </div>
  );
}

function SettingRow({ icon: Icon, label, sub, toggle, onToggle, onClick, iconCls = 'text-slate-500', danger }) {
  return (
    <div
      onClick={onClick || (toggle !== undefined ? onToggle : undefined)}
      className={cn(
        'flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 last:border-0',
        (onClick || toggle !== undefined) && 'active:bg-slate-50 cursor-pointer',
        danger && 'active:bg-red-50'
      )}
    >
      <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
        <Icon className={cn('h-4 w-4', iconCls)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold', danger ? 'text-red-600' : 'text-slate-800')}>{label}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5 break-all">{sub}</p>}
      </div>
      {toggle !== undefined ? (
        <div
          onClick={e => { e.stopPropagation(); onToggle?.(); }}
          className={cn(
            'h-6 w-10 rounded-full transition-colors flex items-center flex-shrink-0 px-0.5',
            toggle ? 'bg-slate-900 justify-end' : 'bg-slate-200 justify-start'
          )}
        >
          <div className="h-5 w-5 rounded-full bg-white shadow-sm" />
        </div>
      ) : onClick ? (
        <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
      ) : null}
    </div>
  );
}

function PermissionRow({ icon: Icon, label, sub, status }) {
  const cfgMap = {
    granted: { cls: 'text-emerald-600 bg-emerald-50', label: 'Granted',  StatusIcon: ShieldCheck   },
    denied:  { cls: 'text-red-600 bg-red-50',         label: 'Denied',   StatusIcon: XCircle       },
    prompt:  { cls: 'text-amber-600 bg-amber-50',     label: 'Not Set',  StatusIcon: AlertTriangle },
  };
  const cfg = cfgMap[status] || { cls: 'text-slate-500 bg-slate-50', label: status, StatusIcon: Info };
  const StatusIcon = cfg.StatusIcon;
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 last:border-0">
      <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
      </div>
      <div className={cn('flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold', cfg.cls)}>
        <StatusIcon className="h-3 w-3" />
        {cfg.label}
      </div>
    </div>
  );
}

function StatChip({ label, value, color }) {
  return (
    <div className={cn('rounded-2xl border p-3 text-center', color)}>
      <p className="text-xl font-black tabular-nums">{value}</p>
      <p className="text-[10px] font-semibold opacity-70 mt-0.5">{label}</p>
    </div>
  );
}

const CERT_CFG = {
  valid:         { label: 'Valid',         StatusIcon: ShieldCheck,   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  expiring_soon: { label: 'Expiring Soon', StatusIcon: AlertTriangle, cls: 'bg-amber-50  text-amber-700  border-amber-200'  },
  expired:       { label: 'Expired',       StatusIcon: XCircle,       cls: 'bg-red-50    text-red-700    border-red-200'    },
};

async function checkPermissions() {
  const perms = {};
  try { perms.camera        = (await navigator.permissions.query({ name: 'camera' })).state;        } catch { perms.camera        = 'prompt'; }
  try { perms.location      = (await navigator.permissions.query({ name: 'geolocation' })).state;   } catch { perms.location      = 'prompt'; }
  try { perms.notifications = (await navigator.permissions.query({ name: 'notifications' })).state; } catch { perms.notifications = 'prompt'; }
  return perms;
}

export default function Profile() {
  const [perms,      setPerms]      = useState({ camera: 'prompt', location: 'prompt', notifications: 'prompt' });
  const [notifPush,  setNotifPush]  = useState(true);
  const [notifEmail, setNotifEmail] = useState(false);
  const [trackingOn, setTrackingOn] = useState(true);

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me(), staleTime: 60_000 });
  const profile  = { ...MOCK_PROFILE, ...(user ?? {}) };
  const initials = profile.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  useEffect(() => { checkPermissions().then(setPerms); }, []);

  const deviceId = localStorage.getItem('purpulse_device_id') || 'unknown';

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 pt-14 pb-28 space-y-4">

        {/* ── Identity ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-slate-900 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xl font-black">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-black text-slate-900">{profile.full_name ?? 'Technician'}</p>
              <p className="text-sm text-slate-500 truncate">{profile.email}</p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{profile.badge_number}</span>
                <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">{profile.cert_level}</span>
                {user?.role && (
                  <span className="text-[10px] font-bold bg-slate-800 text-white px-2.5 py-1 rounded-full capitalize">{user.role}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Today's active job widget ─────────────────── */}
        {(() => {
          const todayJob = MOCK_JOBS.find(j => ['in_progress', 'checked_in', 'paused', 'en_route'].includes(j.status));
          if (!todayJob) return null;
          return (
            <Link
              to={`/JobDetail?id=${todayJob.id}`}
              className="block bg-slate-900 rounded-2xl p-4 active:opacity-90 transition-opacity"
            >
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Current Assignment</p>
              <p className="text-sm font-black text-white leading-snug line-clamp-1">{todayJob.title}</p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-slate-400 truncate flex-1">{todayJob.company_name} · {todayJob.site_name}</p>
                <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 motion-safe:animate-pulse" />
                  <span className="text-[11px] text-emerald-400 font-bold capitalize">{todayJob.status.replace('_', ' ')}</span>
                </div>
              </div>
              <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${todayJob.progress}%` }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-slate-500">Progress</span>
                <span className="text-[10px] text-slate-400 font-bold">{todayJob.progress}%</span>
              </div>
            </Link>
          );
        })()}

        {/* ── Stats ────────────────────────────────────── */}
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-0.5">Performance · YTD</p>
          <div className="grid grid-cols-2 gap-2">
            <StatChip label="Jobs Completed"  value={profile.stats?.jobs_completed_ytd ?? 47} color="bg-white border-slate-100" />
            <StatChip label="Avg CSAT"         value={`${profile.stats?.avg_csat ?? 4.8}★`}    color="bg-amber-50 border-amber-100" />
            <StatChip label="On-Time Rate"     value={`${profile.stats?.on_time_rate ?? 94}%`} color="bg-emerald-50 border-emerald-100" />
            <StatChip label="Hours This Week"  value={profile.stats?.hours_logged_week ?? 38}  color="bg-blue-50 border-blue-100" />
          </div>
        </div>

        {/* ── Certifications ───────────────────────────── */}
        <SectionCard title="Certifications">
          {(profile.certifications ?? []).map(cert => {
            const cfg = CERT_CFG[cert.status] ?? CERT_CFG.valid;
            const CertIcon = cfg.StatusIcon;
            return (
              <div key={cert.name} className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={cn('h-8 w-8 rounded-xl flex items-center justify-center border', cfg.cls)}>
                    <CertIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{cert.name}</p>
                    <p className="text-[11px] text-slate-400">Expires {format(new Date(cert.expires), 'MMM d, yyyy')}</p>
                  </div>
                </div>
                <span className={cn('text-[10px] font-bold px-2.5 py-1 rounded-full border', cfg.cls)}>{cfg.label}</span>
              </div>
            );
          })}
        </SectionCard>

        {/* ── App Permissions ──────────────────────────── */}
        <SectionCard title="App Permissions">
          <PermissionRow icon={Camera} label="Camera"        sub="Required for evidence capture & QC" status={perms.camera} />
          <PermissionRow icon={MapPin} label="Location"      sub="On-site detection & geofencing"      status={perms.location} />
          <PermissionRow icon={Bell}   label="Notifications" sub="Job alerts & sync updates"           status={perms.notifications} />
          <div className="px-4 py-3 bg-slate-50">
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Permissions are managed by your device OS. If denied, go to <strong>Device Settings → Purpulse</strong> to re-enable.
            </p>
          </div>
        </SectionCard>

        {/* ── Tracking Disclosure ──────────────────────── */}
        <SectionCard title="Tracking & Data">
          <SettingRow
            icon={MapPin}
            label="Location Tracking"
            sub={trackingOn ? 'GPS logged during active work sessions' : 'Location tracking paused'}
            toggle={trackingOn}
            onToggle={() => { setTrackingOn(v => !v); toast.info(trackingOn ? 'Tracking paused' : 'Tracking enabled'); }}
            iconCls="text-blue-500"
          />
          <div className="flex items-start gap-3 px-4 py-3.5">
            <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
              <Eye className="h-4 w-4 text-slate-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">Tracking Disclosure</p>
              <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                Purpulse records GPS coordinates, timestamps, and work events during active job sessions.
                Data is used for job verification, billing, and QC only. Contact your PM to export or delete your data.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* ── Notification Preferences ─────────────────── */}
        <SectionCard title="Notification Preferences">
          <SettingRow icon={Bell} label="Push Notifications" sub="Job assignments, messages, sync alerts" toggle={notifPush}  onToggle={() => setNotifPush(v => !v)} />
          <SettingRow icon={User} label="Email Digests"      sub="Daily job summary to your email"        toggle={notifEmail} onToggle={() => setNotifEmail(v => !v)} />
        </SectionCard>

        {/* ── Device & Session ─────────────────────────── */}
        <SectionCard title="Device & Session">
          <SettingRow icon={Smartphone} label="Device ID"  sub={deviceId} iconCls="text-slate-400" />
          <SettingRow icon={Shield}     label="Session"    sub="Active · SSO authenticated" iconCls="text-emerald-500" />
          <SettingRow icon={Info}       label="App Version" sub="v2.4.1 · build 241" iconCls="text-slate-400" />
        </SectionCard>

        {/* ── Logout ───────────────────────────────────── */}
        <button
          onClick={() => base44.auth.logout()}
          className="w-full py-3.5 rounded-2xl border-2 border-red-200 text-red-600 font-bold text-sm flex items-center justify-center gap-2 active:bg-red-50 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Log Out
        </button>

      </div>
    </div>
  );
}