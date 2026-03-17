/**
 * uploadClient — resilient upload wrapper around base44.integrations.Core.UploadFile.
 *
 * Features:
 *   - Retry with exponential backoff (configurable)
 *   - Upload timeout per attempt
 *   - Progress callback (simulated; set ENABLE_RESUMABLE_UPLOADS=true for future
 *     SAS/PUT-based chunked uploads when the SDK exposes that surface)
 *   - Respects AbortSignal for clean cancellation
 *
 * Usage:
 *   import { uploadFile } from '@/api/uploadClient';
 *   const { file_url } = await uploadFile(file, { onProgress, signal });
 */

import { base44 } from '@/api/base44Client';

// Feature flag — flip true when Base44 SDK exposes resumable SAS uploads
const ENABLE_RESUMABLE_UPLOADS = import.meta.env.VITE_ENABLE_RESUMABLE_UPLOADS === 'true';

const DEFAULT_CONFIG = {
  maxRetries:        4,
  timeoutMs:         60_000,
  initialDelayMs:    1_000,
  maxDelayMs:        30_000,
};

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); });
  });
}

/**
 * Upload a single file with retry + progress reporting.
 *
 * @param {File|Blob} file
 * @param {{ onProgress?: (pct: number) => void, signal?: AbortSignal, config?: object }} opts
 * @returns {Promise<{ file_url: string }>}
 */
export async function uploadFile(file, { onProgress, signal, config = {} } = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (ENABLE_RESUMABLE_UPLOADS) {
    // TODO: implement SAS/PUT chunked upload once Base44 SDK exposes endpoint
    console.info('[uploadClient] Resumable uploads enabled but not yet implemented; falling back.');
  }

  let attempt = 0;

  while (true) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    // Simulate upload progress from 0→82% (no XHR progress event from SDK)
    let prog = 0;
    const tick = setInterval(() => {
      prog = Math.min(prog + 10, 82);
      onProgress?.(prog);
    }, 300);

    try {
      const uploadPromise  = base44.integrations.Core.UploadFile({ file });
      const timeoutPromise = new Promise((_, rej) =>
        setTimeout(() => rej(new Error(`Upload timed out after ${cfg.timeoutMs}ms`)), cfg.timeoutMs)
      );
      const result = await Promise.race([uploadPromise, timeoutPromise]);
      clearInterval(tick);
      onProgress?.(100);
      return result; // { file_url }
    } catch (err) {
      clearInterval(tick);
      if (signal?.aborted || err.name === 'AbortError') throw err;

      attempt++;
      if (attempt > cfg.maxRetries) throw err;

      const delayMs = Math.min(cfg.maxDelayMs, Math.pow(2, attempt) * cfg.initialDelayMs);
      console.warn(`[uploadClient] Attempt ${attempt} failed (${err.message}). Retrying in ${delayMs}ms…`);
      await sleep(delayMs, signal);
    }
  }
}