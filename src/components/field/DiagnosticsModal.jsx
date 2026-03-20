/**
 * DiagnosticsModal
 *
 * Shows:
 *   - Device ID (generated once, stored in localStorage)
 *   - Network info (online, connection type, downlink)
 *   - HTTP error log (last 50 errors captured from fetch interceptor, stored in sessionStorage)
 *   - "Copy logs" → copies full JSON blob to clipboard for support tickets
 *
 * Network log capture:
 *   We patch window.fetch in this modal's useEffect to intercept responses.
 *   Non-2xx responses are logged to sessionStorage['purpulse_http_log'] as:
 *   { ts, method, url, status, statusText }
 *   Max 50 entries (FIFO).
 *
 * Copy format (for support):
 *   PURPULSE DIAGNOSTICS — 2025-01-15T10:30:00Z
 *   Device ID: abc123
 *   App version: 1.0.0
 *   Network: online | 4g | 25.0 Mbps
 *   --- HTTP Errors ---
 *   [10:28:00] POST /api/... → 503 Service Unavailable
 *   ...
 */
import React, { useEffect, useState } from 'react';
import { X, Copy, Check, Activity, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

const HTTP_LOG_KEY    = 'purpulse_http_log';
const DEVICE_ID_KEY   = 'purpulse_device_id';
const MAX_LOG_ENTRIES = 50;

function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 6);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function readLog() {
  try { return JSON.parse(sessionStorage.getItem(HTTP_LOG_KEY) || '[]'); }
  catch { return []; }
}

function appendLog(entry) {
  const log = readLog();
  log.unshift(entry);
  if (log.length > MAX_LOG_ENTRIES) log.length = MAX_LOG_ENTRIES;
  sessionStorage.setItem(HTTP_LOG_KEY, JSON.stringify(log));
}

/** Patch window.fetch once per session to capture HTTP errors */
let fetchPatched = false;
function patchFetch() {
  if (fetchPatched || typeof window === 'undefined') return;
  fetchPatched = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const res = await orig(...args);
    if (!res.ok) {
      const url  = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      const meth = args[1]?.method || 'GET';
      appendLog({
        ts:         new Date().toISOString(),
        method:     meth.toUpperCase(),
        url:        url.length > 80 ? url.slice(0, 77) + '…' : url,
        status:     res.status,
        statusText: res.statusText,
      });
    }
    return res;
  };
}

function netInfo() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return {
    online: navigator.onLine,
    type:   conn?.effectiveType || conn?.type || 'unknown',
    down:   conn?.downlink != null ? `${conn.downlink} Mbps` : 'unknown',
  };
}

export default function DiagnosticsModal({ onClose }) {
  const [log, setLog]       = useState([]);
  const [copied, setCopied] = useState(false);
  const deviceId = getOrCreateDeviceId();
  const net      = netInfo();

  useEffect(() => {
    patchFetch();
    setLog(readLog());
    const interval = setInterval(() => setLog(readLog()), 2000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = async () => {
    const lines = [
      `PURPULSE DIAGNOSTICS — ${new Date().toISOString()}`,
      `Device ID: ${deviceId}`,
      `Network: ${net.online ? 'online' : 'OFFLINE'} | ${net.type} | ${net.down}`,
      `User Agent: ${navigator.userAgent}`,
      '',
      `--- HTTP Error Log (${log.length} entries) ---`,
      ...log.map(e => `[${format(new Date(e.ts), 'HH:mm:ss')}] ${e.method} ${e.url} → ${e.status} ${e.statusText}`),
      '',
      `--- Offline Edit Queue ---`,
      ...JSON.parse(localStorage.getItem('purpulse_time_edit_queue') || '[]')
        .map(e => `[${e.queued_at}] ${e.entryId} — ${JSON.stringify(e.data)}`),
    ];
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    toast.success('Logs copied to clipboard');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleClear = () => {
    sessionStorage.removeItem(HTTP_LOG_KEY);
    setLog([]);
    toast('Log cleared');
  };

  const STATUS_CFG = {
    200: 'text-emerald-600', 201: 'text-emerald-600', 204: 'text-emerald-600',
    400: 'text-amber-600', 401: 'text-red-600', 403: 'text-red-600',
    404: 'text-amber-600', 409: 'text-amber-600', 429: 'text-orange-600',
    500: 'text-red-700', 502: 'text-red-700', 503: 'text-red-700', 504: 'text-red-700',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full bg-slate-900 rounded-t-3xl max-h-[85vh] flex flex-col max-w-lg mx-auto shadow-2xl">
        <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mt-3 mb-0 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-black text-white font-mono">DIAGNOSTICS</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleClear} className="h-8 px-3 rounded-lg bg-slate-800 text-slate-400 text-xs font-semibold flex items-center gap-1.5">
              <Trash2 className="h-3 w-3" /> Clear
            </button>
            <button onClick={handleCopy}
              className={cn('h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all',
                copied ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-200'
              )}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy Logs'}
            </button>
            <button onClick={onClose} className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center">
              <X className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Device + Net info */}
        <div className="px-5 pb-3 flex-shrink-0">
          <div className="bg-slate-800 rounded-xl p-3 font-mono text-[11px] space-y-1.5">
            <p><span className="text-slate-500">device_id: </span><span className="text-slate-200">{deviceId}</span></p>
            <p>
              <span className="text-slate-500">network: </span>
              <span className={net.online ? 'text-emerald-400' : 'text-red-400'}>
                {net.online ? '● online' : '● OFFLINE'}
              </span>
              <span className="text-slate-400 ml-2">{net.type} · {net.down}</span>
            </p>
            <p><span className="text-slate-500">ua: </span><span className="text-slate-400 break-all">{navigator.userAgent.slice(0, 60)}…</span></p>
          </div>
        </div>

        {/* HTTP error log */}
        <div className="px-5 pb-2 flex-shrink-0">
          <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-2">
            HTTP Errors ({log.length})
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-1.5">
          {log.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-slate-600 text-xs font-mono">no errors captured this session</p>
              <p className="text-slate-700 text-[10px] mt-1">errors will appear here as they occur</p>
            </div>
          ) : (
            log.map((entry, idx) => (
              <div key={idx} className="bg-slate-800 rounded-xl px-3 py-2.5 font-mono">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500">{format(new Date(entry.ts), 'HH:mm:ss')}</span>
                    <span className="text-[10px] font-bold text-slate-400">{entry.method}</span>
                  </div>
                  <span className={cn('text-[11px] font-black', STATUS_CFG[entry.status] || 'text-red-500')}>
                    {entry.status} {entry.statusText}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 break-all leading-snug">{entry.url}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}