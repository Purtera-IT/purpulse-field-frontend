/**
 * Dev-only: canonical telemetry queue + Iteration 2 location consent QA.
 * Shown when import.meta.env.DEV or VITE_SHOW_TELEMETRY_DEBUG=true
 */
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { buildPingEnvelope, buildCanonicalEnvelope } from '@/lib/telemetryEnvelope';
import {
  enqueueCanonicalEvent,
  flushTelemetryQueue,
  getQueueStats,
} from '@/lib/telemetryQueue';
import { getIngestionPostUrl } from '@/api/telemetryIngestion';
import { PURPULSE_PERM_LOCATION_KEY, getLocationConsentState } from '@/lib/locationConsent';
import { Radio } from 'lucide-react';

function devContext() {
  const technician_id =
    import.meta.env.VITE_DEV_TELEMETRY_TECHNICIAN_ID || 'dev-technician-unknown';
  const job_id = import.meta.env.VITE_DEV_TELEMETRY_JOB_ID || 'dev-job-unknown';
  const site_id = import.meta.env.VITE_DEV_TELEMETRY_SITE_ID || '';
  const device_id =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('purpulse_device_id') || undefined
      : undefined;
  return { technician_id, job_id, site_id: site_id || undefined, device_id };
}

export default function TelemetryIngestDebugPanel() {
  const [stats, setStats] = useState({ depth: 0, oldest_first_queued_utc: null, sample_errors: [] });
  const [busy, setBusy] = useState(false);
  const [consentState, setConsentState] = useState(() => getLocationConsentState());
  const ingestUrl = getIngestionPostUrl();

  const refreshStats = useCallback(async () => {
    try {
      const s = await getQueueStats();
      setStats(s);
    } catch (e) {
      console.warn('[TelemetryIngestDebugPanel] stats', e);
    }
  }, []);

  useEffect(() => {
    void refreshStats();
    const t = setInterval(() => {
      setConsentState(getLocationConsentState());
      void refreshStats();
    }, 3000);
    return () => clearInterval(t);
  }, [refreshStats]);

  const setSimConsent = (value) => {
    localStorage.setItem(PURPULSE_PERM_LOCATION_KEY, value);
    setConsentState(value);
    toast.info(`Simulated location consent: ${value}`);
  };

  const clearSimConsent = () => {
    localStorage.removeItem(PURPULSE_PERM_LOCATION_KEY);
    setConsentState(getLocationConsentState());
    toast.info('Cleared purpulse_perm_location (unknown)');
  };

  const onEnqueuePing = async () => {
    setBusy(true);
    try {
      const envelope = buildPingEnvelope(devContext());
      await enqueueCanonicalEvent(envelope);
      toast.success(`Queued ping ${envelope.event_id.slice(0, 8)}…`);
      await refreshStats();
      await flushTelemetryQueue();
      await refreshStats();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  /** Ping with mock coords — should appear on envelope only when consent is granted (check IndexedDB or network tab). */
  const onEnqueuePingMockLocation = async () => {
    setBusy(true);
    try {
      const envelope = buildCanonicalEnvelope({
        eventName: 'ping_event',
        payload: { note: 'canonical_ingest_test_mock_location' },
        context: {
          ...devContext(),
          location: { latitude: 44.9778, longitude: -93.265, accuracy_m: 12 },
        },
      });
      const hasLat =
        envelope.latitude != null ||
        (envelope.location &&
          typeof envelope.location === 'object' &&
          (envelope.location.latitude != null || envelope.location.lat != null));
      await enqueueCanonicalEvent(envelope);
      toast.success(
        `Queued mock-loc ping ${envelope.event_id.slice(0, 8)}… (coords in payload: ${hasLat ? 'yes' : 'no — stripped'})`
      );
      await refreshStats();
      await flushTelemetryQueue();
      await refreshStats();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onFlush = async () => {
    setBusy(true);
    try {
      const r = await flushTelemetryQueue();
      toast.info(
        `Flush: sent ${r.sent}, retry ${r.failedRetryable}, dropped ${r.failedPermanent}, no-URL wait ${r.skippedNoUrl}`
      );
      await refreshStats();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 space-y-3">
      <div className="flex items-center gap-2 text-amber-900">
        <Radio className="h-4 w-4" />
        <p className="text-[10px] font-black uppercase tracking-widest">Dev · Telemetry ingest (Iterations 1–2)</p>
      </div>
      <p className="text-[11px] text-amber-800/90 leading-relaxed">
        Canonical envelope → IndexedDB queue → POST with Bearer + <code className="text-[10px] bg-white/60 px-1 rounded">X-Client-Request-ID</code>.
        Precise GPS on canonical payloads only when <code className="text-[10px] bg-white/60 px-1 rounded">purpulse_perm_location</code> is{' '}
        <strong>granted</strong> (see Location onboarding).
      </p>
      <div className="text-[10px] text-amber-900/80 space-y-1 font-mono break-all">
        <p>
          <span className="font-bold">Location consent:</span> {consentState} · precise_allowed={String(consentState === 'granted')}
        </p>
        <p>
          <span className="font-bold">URL:</span> {ingestUrl || '(not set — queue only)'}
        </p>
        <p>
          <span className="font-bold">Queue depth:</span> {stats.depth}
          {stats.oldest_first_queued_utc ? ` · oldest ${stats.oldest_first_queued_utc}` : ''}
        </p>
        {stats.sample_errors.length > 0 && (
          <p>
            <span className="font-bold">Last errors:</span> {stats.sample_errors.join(' | ')}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[9px] font-bold text-amber-800/70 w-full">Simulate consent (localStorage):</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => setSimConsent('granted')}
          className="px-2 py-1 rounded-lg bg-white border border-amber-300 text-[10px] font-bold text-amber-900"
        >
          granted
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setSimConsent('limited')}
          className="px-2 py-1 rounded-lg bg-white border border-amber-300 text-[10px] font-bold text-amber-900"
        >
          limited
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setSimConsent('denied')}
          className="px-2 py-1 rounded-lg bg-white border border-amber-300 text-[10px] font-bold text-amber-900"
        >
          denied
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => clearSimConsent()}
          className="px-2 py-1 rounded-lg bg-white border border-amber-300 text-[10px] font-bold text-amber-900"
        >
          clear
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onEnqueuePing()}
          className="px-3 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold disabled:opacity-50"
        >
          Enqueue ping_event
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onEnqueuePingMockLocation()}
          className="px-3 py-2 rounded-xl bg-amber-700 text-white text-xs font-bold disabled:opacity-50"
        >
          Ping + mock GPS
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onFlush()}
          className="px-3 py-2 rounded-xl bg-white border border-amber-300 text-amber-900 text-xs font-bold disabled:opacity-50"
        >
          Flush queue
        </button>
      </div>
    </div>
  );
}

export function showTelemetryIngestDebug() {
  return import.meta.env.DEV || import.meta.env.VITE_SHOW_TELEMETRY_DEBUG === 'true';
}
