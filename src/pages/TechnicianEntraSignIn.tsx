import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { CANONICAL_JOBS_PATH } from '@/utils/fieldRoutes'
import { loginEntraTechnicianInteractive } from '@/lib/entraTechnicianMsal'

/**
 * Public route: Microsoft sign-in for technicians (MSAL cache used by getAssignments / getTechnicianMe).
 * Base44 session is separate — hybrid deployments may require both for full app features.
 */
export default function TechnicianEntraSignIn() {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const enabled = import.meta.env.VITE_USE_ENTRA_TOKEN_FOR_AZURE_API === 'true'

  const onSignIn = async () => {
    setErr(null)
    setBusy(true)
    try {
      await loginEntraTechnicianInteractive()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-black text-slate-900 mb-1">Technician sign-in</h1>
        <p className="text-sm text-slate-600 mb-6">
          Microsoft Entra session for Azure APIs (assignments / runbook). Configure{' '}
          <code className="text-xs bg-slate-100 px-1 rounded">VITE_USE_ENTRA_TOKEN_FOR_AZURE_API</code> and
          Entra env vars in your build.
        </p>

        {!enabled && (
          <p className="text-amber-800 text-sm bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4">
            Entra token mode is off. Set <code className="text-xs">VITE_USE_ENTRA_TOKEN_FOR_AZURE_API=true</code>{' '}
            and MSAL variables, then rebuild.
          </p>
        )}

        {err && (
          <p className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4">{err}</p>
        )}

        <button
          type="button"
          onClick={onSignIn}
          disabled={busy || !enabled}
          className="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-bold disabled:opacity-40"
        >
          {busy ? 'Opening Microsoft…' : 'Sign in with Microsoft'}
        </button>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to={CANONICAL_JOBS_PATH} className="font-semibold text-slate-800 underline">
            Continue to app
          </Link>
        </p>
      </div>
    </div>
  )
}
