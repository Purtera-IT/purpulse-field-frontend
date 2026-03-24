/**
 * POST /mock/api/uploads/tokens
 *
 * Request:  { workOrderId, filename, mimeType, clientGeneratedId }
 * Response: { uploadId, uploadUrl, blobPath, expiresAt, storageBackend }
 *
 * No DB write — pure token generation.
 * Real impl would call Azure SAS endpoint and return a pre-signed URL.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);
  const user   = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { workOrderId, filename, mimeType, clientGeneratedId } = body;

  if (!workOrderId || !filename) {
    return Response.json({ error: 'workOrderId and filename are required' }, { status: 400 });
  }

  const storageBackend = 'base44'; // swap to 'azure-placeholder' in prod
  const uploadId       = clientGeneratedId || crypto.randomUUID();
  const safeName       = encodeURIComponent(filename.replace(/\s+/g, '_'));
  const blobPath       = `evidence-prod/${workOrderId}/${uploadId}/${safeName}`;
  const uploadUrl      = storageBackend === 'azure-placeholder'
    ? `https://purpulse.blob.core.windows.net/${blobPath}?sv=2023-08-03&se=...&sr=b&sp=cw&sig=MOCK`
    : `https://mock-cdn.base44.app/${blobPath}`;

  const expiresAt = new Date(Date.now() + 3_600_000).toISOString(); // +1 h

  /*
   * Sample request:
   * {
   *   "workOrderId": "WO-2026-0001",
   *   "filename": "before_photo_001.jpg",
   *   "mimeType": "image/jpeg",
   *   "clientGeneratedId": "550e8400-e29b-41d4-a716-446655440000"
   * }
   *
   * Sample response:
   * {
   *   "uploadId": "550e8400-e29b-41d4-a716-446655440000",
   *   "uploadUrl": "https://mock-cdn.base44.app/evidence-prod/WO-2026-0001/...",
   *   "blobPath": "evidence-prod/WO-2026-0001/550e8400.../before_photo_001.jpg",
   *   "expiresAt": "2026-03-17T10:00:00.000Z",
   *   "storageBackend": "base44"
   * }
   */
  return Response.json({ uploadId, uploadUrl, blobPath, expiresAt, storageBackend });
});