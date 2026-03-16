/**
 * Onboarding page
 *
 * Steps:
 *   0 — Welcome + Azure AD SSO confirmation
 *   1 — Device registration
 *   2 — Permissions setup (camera, location)
 *   3 — Role & permissions view
 *   4 — Interactive tutorial
 *
 * Completion:
 *   Sets localStorage 'purpulse_onboarded' = '1'
 *   Redirects to /Jobs
 *
 * Can be re-entered at any time via Support → "Re-run setup"
 * (just clear localStorage key 'purpulse_onboarded')
 *
 * Azure AD SSO note:
 *   Auth is handled by the Base44 platform. This step just confirms the
 *   identity and explains to the user how SSO works. The actual sign-in
 *   happened before they reached this page.
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ShieldCheck, Building2, CheckCircle2, ChevronRight } from 'lucide-react';
import DeviceRegistration from '../components/onboarding/DeviceRegistration';
import PermissionsSetup from '../components/onboarding/PermissionsSetup';
import LocationConsentStep from '../components/onboarding/LocationConsentStep';
import RolesScreen from '../components/onboarding/RolesScreen';
import TutorialSlides from '../components/onboarding/TutorialSlides';

const ONBOARDING_KEY = 'purpulse_onboarded';
const STEPS = ['welcome', 'device', 'permissions', 'location', 'role', 'tutorial'];
const STEP_LABELS = ['Welcome', 'Device', 'Permissions', 'Location', 'Role', 'Tutorial'];

function ProgressBar({ step }) {
  const pct = ((step) / (STEPS.length - 1)) * 100;
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5 mb-6">
      <div
        className="bg-slate-900 h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function WelcomeStep({ user, onNext }) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-4 py-4">
        <div className="h-20 w-20 rounded-3xl bg-slate-900 flex items-center justify-center mx-auto shadow-xl">
          <ShieldCheck className="h-10 w-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Welcome to Purpulse</h1>
          <p className="text-slate-500 mt-2 text-sm leading-relaxed">
            Field technician platform for job execution, evidence capture, and time tracking.
          </p>
        </div>
      </div>

      {/* Azure AD SSO confirmation */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
          <p className="text-sm font-black text-blue-900">Signed in via Azure AD</p>
        </div>
        <p className="text-xs text-blue-700 leading-relaxed">
          Your identity is verified through your organization's Azure Active Directory. 
          Single sign-on keeps your session secure — no separate password needed.
        </p>
        {user && (
          <div className="bg-blue-100 rounded-xl px-3 py-2 mt-2">
            <p className="text-xs font-mono text-blue-800">{user.full_name}</p>
            <p className="text-[10px] font-mono text-blue-600">{user.email}</p>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-700">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          Identity verified · Session encrypted · SSO active
        </div>
      </div>

      <div className="space-y-2">
        {['Evidence capture with GPS geo-tagging', 'Real-time time tracking & approval', 'Runbook execution with safety checks', 'Offline-first with automatic sync'].map((f, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-slate-700">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            {f}
          </div>
        ))}
      </div>

      <button onClick={onNext}
        className="w-full h-14 rounded-2xl bg-slate-900 text-white font-bold text-base active:opacity-80 flex items-center justify-center gap-2"
      >
        Get started <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  // If already onboarded, skip to Jobs
  useEffect(() => {
    if (localStorage.getItem(ONBOARDING_KEY) === '1') {
      navigate(createPageUrl('Jobs'), { replace: true });
    }
  }, []);

  const nextStep = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
  };

  const finish = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    navigate(createPageUrl('Jobs'), { replace: true });
  };

  const currentStep = STEPS[step];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="flex-1 max-w-lg mx-auto w-full px-5 pt-12 pb-10">

        {/* Step label */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {STEP_LABELS[step]} · {step + 1}/{STEPS.length}
          </p>
          {step > 0 && step < STEPS.length - 1 && (
            <button onClick={finish} className="text-xs text-slate-400 font-semibold">Skip all</button>
          )}
        </div>

        <ProgressBar step={step} />

        {/* Step content */}
        {currentStep === 'welcome'     && <WelcomeStep user={user} onNext={nextStep} />}
        {currentStep === 'device'      && <DeviceRegistration onNext={nextStep} />}
        {currentStep === 'permissions' && <PermissionsSetup onNext={nextStep} />}
        {currentStep === 'location'    && <LocationConsentStep onNext={nextStep} />}
        {currentStep === 'role'        && <RolesScreen currentRole={user?.role || 'field_tech'} onNext={nextStep} isOnboarding />}
        {currentStep === 'tutorial'    && <TutorialSlides onDone={finish} />}
      </div>
    </div>
  );
}