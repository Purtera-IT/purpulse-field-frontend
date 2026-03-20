/**
 * Iteration 5b: optional single GPS sample for travel_start canonical events.
 * Never reads geolocation unless location consent is `granted` (Iteration 2).
 */

import { isPreciseLocationAllowedForCanonicalIngest } from '@/lib/locationConsent';

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<{ lat: number, lon: number, accuracy_m?: number } | null>}
 */
export async function getTravelStartLocationOptional(opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!isPreciseLocationAllowedForCanonicalIngest()) {
    return null;
  }
  if (typeof navigator === 'undefined' || !navigator.geolocation?.getCurrentPosition) {
    if (import.meta.env.DEV) {
      console.warn('[travelGps] Geolocation API not available');
    }
    return null;
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => {
      if (import.meta.env.DEV) {
        console.warn('[travelGps] getCurrentPosition timed out');
      }
      finish(null);
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        finish({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          ...(pos.coords.accuracy != null && Number.isFinite(pos.coords.accuracy)
            ? { accuracy_m: Math.round(pos.coords.accuracy) }
            : {}),
        });
      },
      (err) => {
        if (import.meta.env.DEV) {
          console.warn('[travelGps] getCurrentPosition error', err?.code, err?.message);
        }
        finish(null);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: timeoutMs,
      }
    );
  });
}
