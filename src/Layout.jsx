/**
 * Layout.jsx — Purpulse Field App Shell
 * Provides: TopBar, 5-tab bottom nav, skip link, safe-area support
 *
 * Nav tabs: Jobs | Time | Chat | Support | Profile
 * Admin pages use AdminShell directly — no Layout wrapping.
 */
import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Briefcase, Clock, MessageCircle, HelpCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils';

import { useAppPreferences } from './hooks/useAppPreferences';

// Default density — can be overridden by localStorage or appPublicSettings.density
const APP_DENSITY = (typeof window !== 'undefined' && window.appPublicSettings?.density) || 'compact';

const NAV_ITEMS = [
  { page: 'Jobs',    icon: Briefcase,      label: 'Jobs'    },
  { page: 'TimeLog', icon: Clock,          label: 'Time'    },
  { page: 'Chat',    icon: MessageCircle,  label: 'Chat'    },
  { page: 'Support', icon: HelpCircle,     label: 'Support' },
  { page: 'Profile', icon: User,           label: 'Profile' },
];

// Pages that suppress the nav + topbar (full-screen flows)
const HIDE_SHELL_PAGES = ['JobDetail', 'Onboarding'];

// Pages that suppress only the bottom nav (but keep topbar)
const HIDE_NAV_PAGES   = [];

// Page titles and subtitles
const PAGE_META = {
  Jobs:       { title: 'Purpulse', subtitle: 'Field Operations' },
  TimeLog:    { title: 'Time',     subtitle: 'Work session log' },
  Chat:       { title: 'Messages', subtitle: 'Job threads & dispatch' },
  Support:    { title: 'Support',  subtitle: 'Help & diagnostics' },
  Profile:    { title: 'Profile',  subtitle: 'Identity & certifications' },
  JobDetail:  { title: 'Job Detail' },
  EvidenceHub:{ title: 'Evidence', subtitle: 'Capture & review' },
  ActiveJob:  { title: 'Active Job' },
};

export default function Layout({ children, currentPageName }) {
  const hideShell = HIDE_SHELL_PAGES.includes(currentPageName);
  const hideNav   = hideShell || HIDE_NAV_PAGES.includes(currentPageName);
  const meta      = PAGE_META[currentPageName] ?? { title: currentPageName };

  // Apply density + theme from persisted prefs (falls back to APP_DENSITY)
  useAppPreferences();

  if (hideShell) {
    // Full-screen pages (onboarding, job detail) get no chrome at all
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* ── Page Content ─────────────────────────────── */}
      <main id="main-content" className="flex-1">
        {children}
      </main>

      {/* ── Bottom Tab Bar ────────────────────────────── */}
      {!hideNav && (
        <nav
          aria-label="Primary navigation"
          className="fixed bottom-0 left-0 right-0 z-30 bg-white/90 backdrop-blur-xl border-t border-slate-100"
        >
          <div className="max-w-2xl mx-auto flex">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = currentPageName === item.page;
              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={item.label}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-0.5 pt-2.5 pb-1 transition-colors min-h-[56px] justify-center',
                    isActive ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                  )}
                >
                  <div className={cn(
                    'h-8 w-12 rounded-xl flex items-center justify-center transition-all',
                    isActive ? 'bg-slate-900' : 'bg-transparent'
                  )}>
                    <Icon className={cn('h-5 w-5', isActive ? 'text-white stroke-[2.5px]' : '')} aria-hidden="true" />
                  </div>
                  <span className={cn(
                    'text-[10px] font-semibold',
                    isActive ? 'text-slate-900 font-bold' : 'text-slate-400'
                  )}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
          {/* iOS safe area */}
          <div className="h-[env(safe-area-inset-bottom)]" />
        </nav>
      )}
    </div>
  );
}