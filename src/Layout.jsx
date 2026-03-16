import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Briefcase, Zap, Camera, Clock, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import SyncIndicator from './components/field/SyncIndicator';

const NAV_ITEMS = [
  { page: 'Jobs', icon: Briefcase, label: 'Jobs' },
  { page: 'ActiveJob', icon: Zap, label: 'Active' },
  { page: 'EvidenceHub', icon: Camera, label: 'Evidence' },
  { page: 'TimeLog', icon: Clock, label: 'Time' },
  { page: 'Support', icon: HelpCircle, label: 'Support' },
];

const HIDE_NAV_PAGES = ['JobDetail'];

export default function Layout({ children, currentPageName }) {
  const showNav = !HIDE_NAV_PAGES.includes(currentPageName);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Skip to main content — keyboard accessibility */}
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <style>{`
        :root {
          --color-primary: #0f172a;
          --color-primary-light: #334155;
        }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        * {
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>

      {/* Top sync bar */}
      {showNav && (
        <div className="fixed top-0 left-0 right-0 z-30 flex justify-center py-2 pointer-events-none">
          <div className="pointer-events-auto">
            <SyncIndicator />
          </div>
        </div>
      )}

      <main id="main-content">{children}</main>

      {/* Bottom Tab Bar */}
      {showNav && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/80 backdrop-blur-xl border-t border-slate-100">
          <nav aria-label="Primary navigation">
        <div className="max-w-lg mx-auto flex">
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
                    'flex-1 flex flex-col items-center gap-0.5 py-2 pt-3 transition-colors',
                    isActive ? 'text-slate-900' : 'text-slate-400'
                  )}
                >
                  <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5px]')} />
                  <span className={cn('text-[10px] font-medium', isActive && 'font-semibold')}>
                    {item.label}
                  </span>
                  {isActive && (
                    <div className="h-0.5 w-4 bg-slate-900 rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>
          {/* Safe area padding for iOS */}
          <div className="h-[env(safe-area-inset-bottom)]" />
        </div>
        </nav>
      )}
    </div>
  );
}