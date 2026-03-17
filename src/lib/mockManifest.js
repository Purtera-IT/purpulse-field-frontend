/**
 * lib/mockManifest.js
 *
 * Utilities for writing mock UploadManifest rows, AuditLog entries, and
 * computing a placeholder SHA-256 (Web Crypto — async).
 *
 * All field names are identical to what the real Azure Functions pipeline will expect.
 */

import { base44 } from '@/api/base44Client';

// ── SHA-256 (real Web Crypto, works in browser) ───────────────────────
export async function computeSha256(file) {
  try {
    const buf    = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    // Fallback: deterministic placeholder when file unavailable
    return 'sha256-placeholder-' + file.name.replace(/\s/g, '_') + '-' + file.size;
  }
}

// ── Read image dimensions (Promise<{w,h}>) ────────────────────────────
export function readImageDimensions(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img  = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ w: null, h: null }); };
    img.src = url;
  });
}

// ── Shallow EXIF placeholder (MediaDevices doesn't expose EXIF in-browser) ──
export function extractMockExif(file) {
  // Real implementation would use exifr or a WASM library.
  // Return placeholder values so the schema is populated.
  return {
    make:       'Apple',
    model:      'iPhone 15 Pro',
    iso:        64,
    focal_mm:   24,
    exposure_s: 0.008,
    orientation: 1,
  };
}

// ── Write one manifest row ────────────────────────────────────────────
export async function writeManifestRow({
  file,
  jobId,
  evidenceId,
  fileUrl,
  evidenceType,
  runbookStepId,
  geoLat,
  geoLon,
  geoAltitude,
  geoAccuracy,
  userEmail,
  deviceId,
}) {
  const [sha256, dims] = await Promise.all([
    computeSha256(file),
    readImageDimensions(file),
  ]);
  const exif = extractMockExif(file);

  await base44.entities.UploadManifest.create({
    job_id:             jobId,
    evidence_id:        evidenceId || null,
    filename:           file.name,
    sha256,
    file_url:           fileUrl || null,
    azure_blob_url:     fileUrl
      ? fileUrl.replace('https://', 'https://purpulse.blob.core.windows.net/evidence/')
      : null,
    content_type:       file.type,
    size_bytes:         file.size,
    width_px:           dims.w,
    height_px:          dims.h,
    exif_make:          exif.make,
    exif_model:         exif.model,
    exif_iso:           exif.iso,
    exif_focal_mm:      exif.focal_mm,
    exif_exposure_s:    exif.exposure_s,
    geo_lat:            geoLat   ?? null,
    geo_lon:            geoLon   ?? null,
    geo_altitude_m:     geoAltitude ?? null,
    geo_accuracy_m:     geoAccuracy ?? null,
    capture_ts:         new Date().toISOString(),
    upload_ts:          new Date().toISOString(),
    evidence_type:      evidenceType || 'general',
    runbook_step_id:    runbookStepId || null,
    technician_email:   userEmail || null,
    source_app_version: '2.4.1',
    device_id:          deviceId || localStorage.getItem('purpulse_device_id') || 'unknown',
    sync_status:        'synced',
    azure_indexed:      false,
    approved_for_training: false,
  });
}

// ── Write one audit log entry ─────────────────────────────────────────
export async function writeAuditLog({
  jobId,
  actionType,
  entityType,
  entityId,
  actorEmail,
  actorRole = 'technician',
  payloadSummary,
  result = 'success',
  errorMessage,
  durationMs,
}) {
  await base44.entities.AuditLog.create({
    job_id:          jobId   || null,
    action_type:     actionType,
    entity_type:     entityType || null,
    entity_id:       entityId  || null,
    actor_email:     actorEmail,
    actor_role:      actorRole,
    payload_summary: payloadSummary ? JSON.stringify(payloadSummary) : null,
    result,
    error_message:   errorMessage || null,
    client_ts:       new Date().toISOString(),
    server_ts:       new Date().toISOString(),
    session_id:      sessionStorage.getItem('purpulse_session_id') || 'sess-unknown',
    device_id:       localStorage.getItem('purpulse_device_id') || 'unknown',
    duration_ms:     durationMs || null,
  });
}

// ── CSV helpers ───────────────────────────────────────────────────────
export function rowsToCSV(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const header = keys.join(',');
  const body   = rows.map(row =>
    keys.map(k => {
      const v = row[k];
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s}"` : s;
    }).join(',')
  ).join('\n');
  return header + '\n' + body;
}

export function downloadCSV(csvString, filename) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}