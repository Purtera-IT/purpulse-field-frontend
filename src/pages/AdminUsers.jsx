/**
 * AdminUsers — Users & Roles + Device Management
 *
 * Tabs:
 *   - Users: list all users, change role, view last active, invite
 *   - Devices: list registered devices (from localStorage snapshots via SyncQueue),
 *              view device_id, OS, last_seen, revoke access
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Users, Smartphone, UserPlus, RefreshCw, Shield, Eye, Wrench, Crown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import AdminShell from '../components/admin/AdminShell';

const ROLE_CFG = {
  view_only:  { label: 'View Only',  color: 'bg-slate-100 text-slate-600',   icon: Eye },
  user:       { label: 'Field Tech', color: 'bg-blue-100 text-blue-700',     icon: Wrench },
  supervisor: { label: 'Supervisor', color: 'bg-emerald-100 text-emerald-700',icon: Shield },
  admin:      { label: 'Admin',      color: 'bg-amber-100 text-amber-700',   icon: Crown },
};

const ROLES = ['view_only', 'user', 'supervisor', 'admin'];

function InviteModal({ onClose, onInvited }) {
  const [email, setEmail] = useState('');
  const [role,  setRole]  = useState('user');
  const [busy,  setBusy]  = useState(false);

  const handle = async () => {
    if (!email.trim() || !email.includes('@')) { toast.error('Valid email required'); return; }
    setBusy(true);
    try {
      await base44.users.inviteUser(email.trim(), role);
      toast.success(`Invite sent to ${email}`);
      onInvited();
      onClose();
    } catch (e) {
      toast.error(e.message || 'Invite failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-base font-black text-slate-900 mb-4">Invite User</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="tech@company.com"
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Role</label>
            <div className="grid grid-cols-2 gap-1.5">
              {ROLES.map(r => {
                const cfg = ROLE_CFG[r];
                const Icon = cfg.icon;
                return (
                  <button key={r} onClick={() => setRole(r)}
                    className={cn('flex items-center gap-2 h-10 px-3 rounded-xl border-2 text-xs font-bold transition-all',
                      role === r ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-100 bg-white text-slate-600'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" /> {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold">Cancel</button>
          <button onClick={handle} disabled={busy}
            className="flex-1 h-10 rounded-xl bg-slate-900 text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {busy ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Send Invite
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const [tab,         setTab]         = useState('users');
  const [search,      setSearch]      = useState('');
  const [showInvite,  setShowInvite]  = useState(false);
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  // Devices are stored in SyncQueue with entity_type='device_registration'
  const { data: rawDevices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: () => base44.entities.SyncQueue.list('-created_date', 200),
    select: d => d.filter(i => i.entity_type === 'device_registration'),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const revokeDevice = useMutation({
    mutationFn: (id) => base44.entities.SyncQueue.update(id, { status: 'failed', last_error: 'Revoked by admin' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  });

  const filteredUsers = users.filter(u => {
    const q = search.toLowerCase();
    return !q || u.email?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q);
  });

  const devices = rawDevices.map(d => {
    let meta = {};
    try { meta = JSON.parse(d.payload || '{}'); } catch {}
    return { ...d, meta };
  });

  return (
    <AdminShell title="Users & Devices" subtitle="Manage access, roles, and registered field devices">
      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-2xl p-1 mb-6 w-fit">
        {[{ key: 'users', icon: Users, label: 'Users' }, { key: 'devices', icon: Smartphone, label: 'Devices' }].map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('flex items-center gap-2 h-9 px-5 rounded-xl text-sm font-bold transition-all',
                tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              )}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'users' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search users…"
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
            <button onClick={() => setShowInvite(true)}
              className="flex items-center gap-2 h-9 px-4 rounded-xl bg-slate-900 text-white text-sm font-bold ml-3"
            >
              <UserPlus className="h-4 w-4" /> Invite User
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center py-16"><RefreshCw className="h-5 w-5 animate-spin text-slate-400" /></div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['User','Email','Role','Joined','Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => {
                    const roleCfg = ROLE_CFG[user.role] || ROLE_CFG.user;
                    const RoleIcon = roleCfg.icon;
                    return (
                      <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center text-xs font-black text-slate-600 flex-shrink-0">
                              {user.full_name?.[0] || user.email[0]}
                            </div>
                            <p className="font-bold text-slate-900">{user.full_name || '—'}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{user.email}</td>
                        <td className="px-4 py-3">
                          <select
                            value={user.role || 'user'}
                            onChange={e => { updateUser.mutate({ id: user.id, data: { role: e.target.value } }); toast.success('Role updated'); }}
                            className={cn('text-xs font-bold px-2.5 py-1 rounded-lg border-0 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer', roleCfg.color)}
                          >
                            {ROLES.map(r => <option key={r} value={r}>{ROLE_CFG[r].label}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {user.created_date ? format(new Date(user.created_date), 'MMM d, yyyy') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] text-slate-400 font-mono">{user.id.slice(0, 8)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">{filteredUsers.length} users</div>
          </div>
        </>
      )}

      {tab === 'devices' && (
        <div className="space-y-3">
          {devices.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <Smartphone className="h-12 w-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-semibold">No registered devices</p>
              <p className="text-slate-400 text-xs mt-1">Devices register during technician onboarding</p>
            </div>
          )}
          {devices.map(dev => (
            <div key={dev.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Smartphone className="h-5 w-5 text-slate-500" />
                </div>
                <div>
                  <p className="font-black text-slate-900">{dev.meta.device_name || 'Unknown Device'}</p>
                  <p className="text-xs text-slate-500">{dev.meta.os || '—'} · {dev.meta.device_id || dev.id.slice(0,12)}</p>
                  <div className="flex gap-3 mt-1.5 text-[10px] font-mono text-slate-400">
                    {dev.meta.registered_at && <span>Registered: {format(new Date(dev.meta.registered_at), 'MMM d yyyy HH:mm')}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={cn('text-[10px] font-bold px-2.5 py-1 rounded-full',
                  dev.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                )}>
                  {dev.status === 'failed' ? 'Revoked' : 'Active'}
                </span>
                {dev.status !== 'failed' && (
                  <button onClick={() => { revokeDevice.mutate(dev.id); toast.success('Device revoked'); }}
                    className="h-8 px-3 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-colors"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onInvited={() => queryClient.invalidateQueries({ queryKey: ['users'] })} />}
    </AdminShell>
  );
}