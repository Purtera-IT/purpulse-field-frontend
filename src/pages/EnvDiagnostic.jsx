/**
 * EnvDiagnostic — Build-time environment flag inspector.
 * Navigate to /EnvDiagnostic to see exactly which VITE_ flags are in the current build.
 * Useful for confirming the Azure API path is active without opening DevTools.
 */
import React, { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

const FLAG_DEFINITIONS = [
  {
    key: 'VITE_USE_ASSIGNMENTS_API',
    expected: 'true',
    label: 'Azure Assignments API enabled',
    critical: true,
    help: 'Must be "true" (string) to switch job list from Base44 entities → Azure GET /api/assignments',
  },
  {
    key: 'VITE_AZURE_API_BASE_URL',
    expected: null, // just needs to be non-empty
    label: 'Azure API base URL',
    critical: true,
    help: 'e.g. https://api-test.purpulse.app — no trailing slash',
  },
  {
    key: 'VITE_USE_ENTRA_TOKEN_FOR_AZURE_API',
    expected: 'true',
    label: 'Use Entra token for Azure API calls',
    critical: false,
    help: 'When true, acquires MSAL token for Azure API instead of Base44 session token',
  },
  {
    key: 'VITE_ENTRA_CLIENT_ID',
    expected: null,
    label: 'Entra Client ID',
    critical: false,
    help: 'Azure app registration Client ID — required if USE_ENTRA_TOKEN is true',
  },
  {
    key: 'VITE_ENTRA_TENANT_ID',
    expected: null,
    label: 'Entra Tenant ID',
    critical: false,
    help: 'Azure Directory (Tenant) ID',
  },
  {
    key: 'VITE_ENTRA_API_SCOPE',
    expected: null,
    label: 'Entra API Scope',
    critical: false,
    help: 'e.g. api://{client-id}/Assignments.Read',
  },
];

function getEnvValue(key) {
  return import.meta.env[key] ?? null;
}

function FlagRow({ def }) {
  const raw = getEnvValue(def.key);
  const isSet = raw !== null && raw !== '' && raw !== 'undefined';
  const isCorrect = def.expected ? raw === def.expected : isSet;

  let status, StatusIcon, color;
  if (isCorrect) {
    status = 'OK'; StatusIcon = CheckCircle; color = 'text-emerald-600';
  } else if (def.critical && !isCorrect) {
    status = 'MISSING'; StatusIcon = XCircle; color = 'text-red-600';
  } else {
    status = 'NOT SET'; StatusIcon = AlertTriangle; color = 'text-amber-500';
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 last:border-0">
      <StatusIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${color}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-xs font-mono font-bold text-slate-800">{def.key}</code>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            status === 'OK' ? 'bg-emerald-50 text-emerald-700' :
            status === 'MISSING' ? 'bg-red-50 text-red-700' :
            'bg-amber-50 text-amber-700'
          }`}>{status}</span>
          {def.critical && status !== 'OK' && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800">REQUIRED</span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{def.label}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{def.help}</p>
        {isSet && (
          <p className="text-[11px] font-mono text-slate-600 mt-1 bg-slate-50 rounded px-2 py-0.5 break-all">
            {def.key.toLowerCase().includes('secret') || def.key.toLowerCase().includes('client_id')
              ? `${raw.slice(0, 8)}...` // partially redact sensitive values
              : raw}
          </p>
        )}
      </div>
    </div>
  );
}

export default function EnvDiagnostic() {
  const [apiStatus, setApiStatus] = useState(null); // null | 'checking' | 'ok' | 'error' | 'cors'
  const [apiDetail, setApiDetail] = useState('');

  const usePurpulse = import.meta.env.VITE_USE_ASSIGNMENTS_API === 'true'
    && typeof import.meta.env.VITE_AZURE_API_BASE_URL === 'string'
    && import.meta.env.VITE_AZURE_API_BASE_URL.trim().length > 0;

  const baseUrl = (import.meta.env.VITE_AZURE_API_BASE_URL || '').replace(/\/$/, '');

  async function checkApiReachability() {
    if (!baseUrl) return;
    setApiStatus('checking');
    setApiDetail('');
    try {
      const res = await fetch(`${baseUrl}/api/me`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (res.status === 401 || res.status === 403) {
        setApiStatus('ok');
        setApiDetail(`Reachable — ${res.status} (expected: no auth token sent in this test)`);
      } else {
        setApiStatus('ok');
        setApiDetail(`HTTP ${res.status} — API is reachable from this browser`);
      }
    } catch (e) {
      const msg = e?.message || String(e);
      if (msg.includes('Failed to fetch') || msg.includes('CORS') || msg.includes('NetworkError')) {
        setApiStatus('cors');
        setApiDetail(`CORS or network error: ${msg}. Ensure ${window.location.origin} is in the Azure Function CORS allowlist.`);
      } else {
        setApiStatus('error');
        setApiDetail(msg);
      }
    }
  }

  const criticalMissing = FLAG_DEFINITIONS.filter(d => d.critical).some(d => {
    const raw = getEnvValue(d.key);
    return d.expected ? raw !== d.expected : !raw;
  });

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-4">

        <div>
          <h1 className="text-2xl font-black text-slate-900">Build Env Diagnostic</h1>
          <p className="text-sm text-slate-500 mt-1">
            Shows which VITE_* flags are baked into <strong>this build</strong>. Changing env vars without republishing has no effect.
          </p>
        </div>

        {/* Summary banner */}
        <div className={`rounded-2xl border p-4 flex items-start gap-3 ${
          criticalMissing
            ? 'bg-red-50 border-red-200'
            : 'bg-emerald-50 border-emerald-200'
        }`}>
          {criticalMissing
            ? <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            : <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          }
          <div>
            <p className={`text-sm font-bold ${criticalMissing ? 'text-red-800' : 'text-emerald-800'}`}>
              {criticalMissing
                ? 'Critical env vars missing — app is using Base44 demo jobs'
                : 'Critical env vars present — Azure Assignments API is active'
              }
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              Job source: <strong>{usePurpulse ? 'Azure API (GET /api/assignments)' : 'Base44 entities (demo data)'}</strong>
            </p>
          </div>
        </div>

        {/* Flag table */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Environment Flags</p>
          </div>
          {FLAG_DEFINITIONS.map(def => <FlagRow key={def.key} def={def} />)}
        </div>

        {/* Live API reachability test */}
        {baseUrl && (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">API Reachability Test</p>
              <button
                onClick={checkApiReachability}
                disabled={apiStatus === 'checking'}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${apiStatus === 'checking' ? 'animate-spin' : ''}`} />
                {apiStatus === 'checking' ? 'Checking…' : 'Test now'}
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-slate-500 mb-2">
                Sends an unauthenticated GET to <code className="font-mono text-slate-700">{baseUrl}/api/me</code> to check CORS + network reachability from this browser.
              </p>
              {apiStatus === null && (
                <p className="text-xs text-slate-400">Click "Test now" to check</p>
              )}
              {apiStatus === 'ok' && (
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-700 font-semibold">{apiDetail}</p>
                </div>
              )}
              {apiStatus === 'cors' && (
                <div className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{apiDetail}</p>
                </div>
              )}
              {apiStatus === 'error' && (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">{apiDetail}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-slate-100 rounded-2xl p-4">
          <p className="text-xs font-bold text-slate-600 mb-1">Next steps if env vars are missing:</p>
          <ol className="text-xs text-slate-500 space-y-1 list-decimal list-inside">
            <li>Go to Base44 Dashboard → Code → Environment Variables</li>
            <li>Set <code className="font-mono">VITE_USE_ASSIGNMENTS_API=true</code> and <code className="font-mono">VITE_AZURE_API_BASE_URL</code></li>
            <li>Click Publish / Deploy to rebuild the bundle</li>
            <li>Reload this page — flags should turn green</li>
          </ol>
          <p className="text-xs text-slate-400 mt-2">See <code className="font-mono">docs/ENV_SETUP.md</code> for the full variable reference.</p>
        </div>

      </div>
    </div>
  );
}