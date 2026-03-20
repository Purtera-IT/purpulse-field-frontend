/**
 * TelemetryConsent — Privacy-first banner for telemetry opt-in
 * Shows once, dismissible, stored in localStorage
 */

import React, { useState, useEffect } from 'react';
import { X, Lock } from 'lucide-react';
import { setTelemetryConsent, isTelemetryEnabled } from '@/lib/telemetry';

const CONSENT_SHOWN_KEY = 'purpulse_telemetry_consent_shown';

export default function TelemetryConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show if not previously dismissed
    const shown = localStorage.getItem(CONSENT_SHOWN_KEY);
    const alreadyEnabled = isTelemetryEnabled();
    
    if (!shown && !alreadyEnabled) {
      setShow(true);
    }
  }, []);

  const handleOptIn = () => {
    setTelemetryConsent(true);
    localStorage.setItem(CONSENT_SHOWN_KEY, 'true');
    setShow(false);
  };

  const handleOptOut = () => {
    setTelemetryConsent(false);
    localStorage.setItem(CONSENT_SHOWN_KEY, 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-700 shadow-2xl">
      <div className="max-w-2xl mx-auto px-4 py-4 sm:py-5 flex items-start gap-4">
        
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <Lock className="h-5 w-5 text-slate-300" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-100 mb-1">
            Help improve Purpulse with analytics
          </p>
          <p className="text-xs text-slate-400 leading-relaxed mb-3">
            We collect <strong>anonymous event data</strong> (job check-ins, evidence uploads, time tracking) to improve reliability and performance. 
            Your <strong>location, contact info, and job details are never collected</strong>. You can change this anytime in Settings.
          </p>
          
          {/* Links */}
          <div className="flex items-center gap-3 text-xs">
            <a href="/Support" className="text-blue-400 hover:text-blue-300 font-semibold">
              Privacy Policy
            </a>
            <span className="text-slate-600">·</span>
            <a href="/Support" className="text-blue-400 hover:text-blue-300 font-semibold">
              Telemetry Details
            </a>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleOptOut}
            className="h-9 px-3 rounded-lg border border-slate-600 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-colors active:scale-95"
            aria-label="Decline analytics"
          >
            Decline
          </button>
          <button
            onClick={handleOptIn}
            className="h-9 px-4 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors active:scale-95"
            aria-label="Enable analytics"
          >
            Accept
          </button>
        </div>

        {/* Close button */}
        <button
          onClick={handleOptOut}
          className="flex-shrink-0 text-slate-400 hover:text-slate-300 transition-colors p-1"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}