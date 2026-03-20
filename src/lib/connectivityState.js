/**
 * Navigator connectivity mapped to canonical telemetry enums (offline | cellular | wifi | unknown).
 * Shared by dispatch_event, travel_event, arrival_event.
 */

export function normalizeConnectivityState() {
  if (typeof navigator === 'undefined') return 'unknown';
  if (!navigator.onLine) return 'offline';
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const t = conn?.type;
  if (t === 'wifi' || t === 'ethernet') return 'wifi';
  if (t === 'cellular' || t === 'wimax') return 'cellular';
  if (navigator.onLine) return 'wifi';
  return 'unknown';
}
