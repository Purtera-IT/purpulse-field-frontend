/**
 * handlers-upload.ts — MSW handlers for resumable uploads
 * Simulates chunked uploads with resume capability
 */

import { http, HttpResponse } from 'msw'
import { getMockScenario } from './handlers'

/**
 * In-memory store for upload sessions (simulates server state)
 */
const uploadSessions = new Map<
  string,
  {
    fileName: string
    totalSize: number
    totalChunks: number
    uploadedChunks: Set<number>
    metadata: Record<string, any>
  }
>()

/**
 * Simulate upload latency based on scenario
 */
async function simulateLatency() {
  const scenario = getMockScenario()
  if (scenario === 'slow') {
    await new Promise(resolve => setTimeout(resolve, 2000))
  } else if (scenario === 'error') {
    // Randomly fail some uploads
    if (Math.random() > 0.7) {
      throw new Error('Simulated upload error')
    }
  } else if (scenario === 'offline') {
    throw new Error('Network error')
  }
  // 'success' scenario: minimal delay (100ms)
  await new Promise(resolve => setTimeout(resolve, 100))
}

/**
 * POST /api/uploads/init — Initialize a resumable upload session
 */
const initUploadHandler = http.post('/api/uploads/init', async req => {
  try {
    await simulateLatency()

    const { sessionId, fileName, totalSize, totalChunks, metadata } = (await req.json()) as any

    uploadSessions.set(sessionId, {
      fileName,
      totalSize,
      totalChunks,
      uploadedChunks: new Set(),
      metadata,
    })

    return HttpResponse.json({
      sessionId,
      totalChunks,
    })
  } catch (error) {
    return HttpResponse.json(
      { error: error instanceof Error ? error.message : 'Upload init failed' },
      { status: 500 }
    )
  }
})

/**
 * POST /api/uploads/chunk — Upload a single chunk
 */
const uploadChunkHandler = http.post('/api/uploads/chunk', async req => {
  try {
    await simulateLatency()

    const { sessionId, chunkIndex, chunkData, totalChunks } = (await req.json()) as any

    const session = uploadSessions.get(sessionId)
    if (!session) {
      return HttpResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Mark chunk as uploaded
    session.uploadedChunks.add(chunkIndex)

    const progress = Math.round((session.uploadedChunks.size / totalChunks) * 100)

    return HttpResponse.json({
      sessionId,
      chunkIndex,
      progress,
      uploadedChunks: Array.from(session.uploadedChunks),
    })
  } catch (error) {
    return HttpResponse.json(
      { error: error instanceof Error ? error.message : 'Chunk upload failed' },
      { status: 500 }
    )
  }
})

/**
 * GET /api/uploads/status/:sessionId — Get upload session status
 */
const uploadStatusHandler = http.get('/api/uploads/status/:sessionId', async ({ params }) => {
  try {
    await simulateLatency()

    const { sessionId } = params as { sessionId: string }

    const session = uploadSessions.get(sessionId)
    if (!session) {
      return HttpResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const progress = Math.round((session.uploadedChunks.size / session.totalChunks) * 100)
    const isComplete = session.uploadedChunks.size === session.totalChunks

    return HttpResponse.json({
      sessionId,
      fileName: session.fileName,
      progress,
      uploadedChunks: Array.from(session.uploadedChunks),
      totalChunks: session.totalChunks,
      isComplete,
    })
  } catch (error) {
    return HttpResponse.json(
      { error: error instanceof Error ? error.message : 'Status check failed' },
      { status: 500 }
    )
  }
})

/**
 * POST /api/uploads/complete/:sessionId — Mark upload as complete
 */
const completeUploadHandler = http.post('/api/uploads/complete/:sessionId', async ({ params }) => {
  try {
    const { sessionId } = params as { sessionId: string }

    const session = uploadSessions.get(sessionId)
    if (!session) {
      return HttpResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.uploadedChunks.size !== session.totalChunks) {
      return HttpResponse.json(
        { error: 'Not all chunks uploaded' },
        { status: 400 }
      )
    }

    // Cleanup session from server memory
    uploadSessions.delete(sessionId)

    return HttpResponse.json({
      success: true,
      sessionId,
      fileName: session.fileName,
    })
  } catch (error) {
    return HttpResponse.json(
      { error: error instanceof Error ? error.message : 'Completion failed' },
      { status: 500 }
    )
  }
})

export const uploadHandlers = [
  initUploadHandler,
  uploadChunkHandler,
  uploadStatusHandler,
  completeUploadHandler,
]