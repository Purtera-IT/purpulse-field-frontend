/**
 * processEvidence — Azure Function (Node.js 18, HTTP trigger)
 *
 * Evidence processing pipeline:
 *   1. Download original file from storage
 *   2. Generate thumbnail (sharp)
 *   3. Azure Computer Vision OCR
 *   4. Azure Face API — detect + optional redaction
 *   5. Azure OpenAI — generate embedding vector
 *   6. POST results to Purpulse API → /api/v1/evidence/{id}/process-result
 *
 * Required env vars (see azure-functions/README.md):
 *   AZURE_CV_KEY, AZURE_CV_ENDPOINT
 *   AZURE_FACE_KEY, AZURE_FACE_ENDPOINT
 *   AZURE_OPENAI_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT_ID
 *   AZURE_STORAGE_CONNECTION_STRING, AZURE_STORAGE_CONTAINER
 *   BACKEND_API_URL, BACKEND_API_TOKEN
 *
 * Retry policy: configure in function.json (retry.strategy = fixedDelay, maxRetryCount = 3)
 */

'use strict';

const { BlobServiceClient }       = require('@azure/storage-blob');
const { ComputerVisionClient }    = require('@azure/cognitiveservices-computervision');
const { FaceClient }              = require('@azure/cognitiveservices-face');
const { CognitiveServicesCredentials } = require('@azure/ms-rest-azure-js');
const { OpenAIClient, AzureKeyCredential } = require('@azure/openai');
const sharp  = require('sharp');
const axios  = require('axios');
const crypto = require('crypto');

// ── Client factories (lazy-init) ─────────────────────────────────────
let _cvClient, _faceClient, _openaiClient;

function getCvClient() {
  if (!_cvClient) {
    const creds = new CognitiveServicesCredentials(process.env.AZURE_CV_KEY);
    _cvClient = new ComputerVisionClient(creds, process.env.AZURE_CV_ENDPOINT);
  }
  return _cvClient;
}

function getFaceClient() {
  if (!_faceClient) {
    const creds = new CognitiveServicesCredentials(process.env.AZURE_FACE_KEY);
    _faceClient = new FaceClient(creds, process.env.AZURE_FACE_ENDPOINT);
  }
  return _faceClient;
}

function getOpenAIClient() {
  if (!_openaiClient) {
    _openaiClient = new OpenAIClient(
      process.env.AZURE_OPENAI_ENDPOINT,
      new AzureKeyCredential(process.env.AZURE_OPENAI_KEY)
    );
  }
  return _openaiClient;
}

// ── Helpers ──────────────────────────────────────────────────────────
async function downloadBlob(fileUrl) {
  const response = await axios.get(fileUrl, { responseType: 'arraybuffer', timeout: 30_000 });
  return Buffer.from(response.data);
}

async function generateThumbnail(buffer, evidenceId) {
  const thumb = await sharp(buffer)
    .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  const blobService  = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
  const container    = blobService.getContainerClient(process.env.AZURE_STORAGE_CONTAINER);
  const blobName     = `thumbnails/${evidenceId}.jpg`;
  const blockBlob    = container.getBlockBlobClient(blobName);
  await blockBlob.upload(thumb, thumb.length, { blobHTTPHeaders: { blobContentType: 'image/jpeg' } });

  return blockBlob.url;
}

async function runOcr(fileUrl) {
  const cv = getCvClient();
  try {
    const result = await cv.recognizePrintedTextInStream('true', Buffer.from(await downloadBlob(fileUrl)));
    const lines  = (result.regions || []).flatMap(r => r.lines || []).map(l => l.words.map(w => w.text).join(' '));
    return lines.join('\n').trim() || null;
  } catch (err) {
    console.warn('[processEvidence] OCR failed (non-fatal):', err.message);
    return null;
  }
}

async function detectAndRedactFaces(buffer, evidenceId, fileUrl) {
  const face = getFaceClient();
  let facesDetected = 0;
  let redacted = false;
  let redactedUrl = null;

  try {
    const detected = await face.face.detectWithUrl(fileUrl, {
      returnFaceId: false,
      detectionModel: 'detection_03',
    });
    facesDetected = detected.length;

    if (facesDetected > 0) {
      // Blur each detected face rectangle using sharp
      const metadata = await sharp(buffer).metadata();
      const composite = detected.map(f => {
        const r = f.faceRectangle;
        return {
          input: Buffer.alloc(r.width * r.height * 4, 0), // black rectangle
          top: r.top, left: r.left,
          blend: 'over',
        };
      });
      const redactedBuf = await sharp(buffer).composite(composite).toBuffer();

      const blobService = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
      const container   = blobService.getContainerClient(process.env.AZURE_STORAGE_CONTAINER);
      const blobName    = `redacted/${evidenceId}_redacted.jpg`;
      const blockBlob   = container.getBlockBlobClient(blobName);
      await blockBlob.upload(redactedBuf, redactedBuf.length, {
        blobHTTPHeaders: { blobContentType: 'image/jpeg' },
      });
      redactedUrl = blockBlob.url;
      redacted    = true;
    }
  } catch (err) {
    console.warn('[processEvidence] Face detection failed (non-fatal):', err.message);
  }

  return { faces_detected: facesDetected, redacted, redacted_url: redactedUrl };
}

async function generateEmbedding(text) {
  if (!text) return null;
  try {
    const client     = getOpenAIClient();
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_ID || 'text-embedding-3-small';
    const response   = await client.getEmbeddings(deployment, [text.slice(0, 2048)]);
    return response.data[0]?.embedding ?? null;
  } catch (err) {
    console.warn('[processEvidence] Embedding failed (non-fatal):', err.message);
    return null;
  }
}

function assessQuality(buffer) {
  // Placeholder: real implementation would use sharp stats or a CV model
  return { score: 75, flags: { blur: false, dark: false, obstructed: false } };
}

async function postResults(evidenceId, payload) {
  const url = `${process.env.BACKEND_API_URL}/api/v1/evidence/${evidenceId}/process-result`;
  await axios.post(url, payload, {
    headers: { Authorization: `Bearer ${process.env.BACKEND_API_TOKEN}` },
    timeout: 15_000,
  });
}

// ── Main handler ─────────────────────────────────────────────────────
module.exports = async function (context, req) {
  const { evidenceId, fileUrl } = req.body || {};

  if (!evidenceId || !fileUrl) {
    context.res = { status: 400, body: { error: 'evidenceId and fileUrl are required' } };
    return;
  }

  context.log(`[processEvidence] start — evidenceId=${evidenceId}`);

  try {
    // 1. Download original
    const buffer = await downloadBlob(fileUrl);
    context.log('[processEvidence] downloaded', buffer.length, 'bytes');

    // 2–5. Pipeline (all non-fatal; partial results are still saved)
    const [thumbnailUrl, ocrText, faceStatus, quality] = await Promise.allSettled([
      generateThumbnail(buffer, evidenceId),
      runOcr(fileUrl),
      detectAndRedactFaces(buffer, evidenceId, fileUrl),
      Promise.resolve(assessQuality(buffer)),
    ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : null));

    const embeddingVector = await generateEmbedding(ocrText);

    // 6. Post results back to API
    const resultPayload = {
      evidence_id:           evidenceId,
      thumbnail_url:         thumbnailUrl,
      ocr_text:              ocrText,
      embedding_vector:      embeddingVector,
      embedding_model:       embeddingVector ? (process.env.AZURE_OPENAI_DEPLOYMENT_ID || 'text-embedding-3-small') : null,
      quality_score:         quality?.score ?? null,
      quality_flags:         quality?.flags ?? null,
      face_redaction_status: faceStatus,
      status:                'processed',
    };
    await postResults(evidenceId, resultPayload);

    context.log(`[processEvidence] done — evidenceId=${evidenceId}`);
    context.res = { status: 200, body: { success: true, evidenceId } };

  } catch (err) {
    context.log.error(`[processEvidence] fatal — evidenceId=${evidenceId}`, err.message);
    // Notify API of failure so evidence can be marked accordingly
    await postResults(evidenceId, { evidence_id: evidenceId, status: 'failed', error: err.message }).catch(() => {});
    // Re-throw so Azure Functions retry policy kicks in
    throw err;
  }
};