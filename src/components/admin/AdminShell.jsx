/**
 * AdminShell — sidebar + topbar layout for all admin console pages.
 * Used as a wrapper (not the global Layout) — just import and wrap.
 */
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Briefcase, ShieldCheck, Database, ScrollText,
  Users, Smartphone, BarChart3, ChevronLeft, Menu, X
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { page: 'AdminJobs',     icon: Briefcase,   label: 'Jobs',          group: 'Operations' },
  { page: 'AdminQC',       icon: ShieldCheck,  label: 'QC Review',     group: 'Operations' },
  { page: 'AdminSnapshot', icon: Database,     label: 'Snapshots',     group: 'Data' },
  { page: 'AdminAuditLog', icon: ScrollText,   label: 'Audit Log',     group: 'Data' },
  { page: 'AdminUsers',    icon: Users,        label: 'Users & Roles', group: 'Admin' },
  { page: 'AdminDevices',  icon: Smartphone,   label: 'Devices',       group: 'Admin' },
];

const GROUPS = ['Operations', 'Data', 'Admin'];

export default function AdminShell({ children, title, subtitle }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const current = location.pathname.replace('/', '');

  const sidebar = (
    <nav className={cn('flex flex-col h-full bg-slate-900 text-white', open ? 'w-56' : 'w-56')}>
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-slate-800">
        <div className="h-8 w-8 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
          <BarChart3 className="h-4 w-4 text-slate-200" />
        </div>
        <div>
          <p className="text-sm font-black text-white">Purpulse</p>
          <p className="text-[10px] text-slate-400">Admin Console</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3 space-y-5 px-2">
        {GROUPS.map(group => {
          const items = NAV.filter(n => n.group === group);
          return (
            <div key={group}>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-2 mb-1.5">{group}</p>
              {items.map(item => {
                const Icon = item.icon;
                const isActive = current === item.page;
                return (
                  <Link key={item.page} to={createPageUrl(item.page)}
                    className={cn('flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all mb-0.5',
                      isActive ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="px-4 py-3 border-t border-slate-800">
        <Link to={createPageUrl('Jobs')} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to Field App
        </Link>
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-shrink-0">{sidebar}</div>

      {/* Mobile overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-56">{sidebar}</div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setOpen(true)} className="md:hidden h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <Menu className="h-4 w-4 text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-black text-slate-900">{title}</h1>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}