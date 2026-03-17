import { http, HttpResponse, delay } from 'msw';
import jobs from './fixtures/jobs.json';
import technicians from './fixtures/technicians.json';
import assets from './fixtures/assets.json';

export type MockScenario = 'success' | 'slow' | 'error' | 'offline';

let currentScenario: MockScenario = 'success';

export function setMockScenario(scenario: MockScenario) {
  currentScenario = scenario;
  console.log(`[MSW] Mock scenario switched to: ${scenario}`);
}

export function getMockScenario() {
  return currentScenario;
}

// Scenario-aware response helper
async function scenarioDelay() {
  if (currentScenario === 'offline') {
    throw new Error('Network request failed');
  }
  if (currentScenario === 'slow') {
    await delay(3000);
  } else if (currentScenario === 'success') {
    await delay(100);
  }
}

export const handlers = [
  // GET /api/jobs — List all jobs
  http.get('/api/jobs', async () => {
    await scenarioDelay();

    if (currentScenario === 'error') {
      return HttpResponse.json(
        { error: 'Server error: Failed to fetch jobs' },
        { status: 500 }
      );
    }

    return HttpResponse.json(jobs);
  }),

  // GET /api/jobs/:id — Get single job
  http.get('/api/jobs/:id', async ({ params }) => {
    await scenarioDelay();

    if (currentScenario === 'error') {
      return HttpResponse.json(
        { error: `Job ${params.id} not found` },
        { status: 404 }
      );
    }

    const job = jobs.find(j => j.id === params.id);
    if (!job) {
      return HttpResponse.json(
        { error: `Job ${params.id} not found` },
        { status: 404 }
      );
    }

    return HttpResponse.json(job);
  }),

  // GET /api/jobs/:id/evidence — Get evidence for a job
  http.get('/api/jobs/:id/evidence', async ({ params }) => {
    await scenarioDelay();

    if (currentScenario === 'error') {
      return HttpResponse.json(
        { error: 'Failed to fetch evidence' },
        { status: 500 }
      );
    }

    const jobAssets = assets.filter(a => a.job_id === params.id);
    return HttpResponse.json(jobAssets);
  }),

  // POST /api/jobs/:id/evidence — Upload evidence
  http.post('/api/jobs/:id/evidence', async ({ params, request }) => {
    await scenarioDelay();

    if (currentScenario === 'error') {
      return HttpResponse.json(
        { error: 'Upload failed' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    return HttpResponse.json({
      id: `asset-${Date.now()}`,
      job_id: params.id,
      file_url: URL.createObjectURL(file),
      thumbnail_url: URL.createObjectURL(file),
      content_type: file.type,
      size_bytes: file.size,
      status: 'uploaded',
      quality_score: 85,
    });
  }),

  // GET /api/technicians — List technicians
  http.get('/api/technicians', async () => {
    await scenarioDelay();

    if (currentScenario === 'error') {
      return HttpResponse.json(
        { error: 'Failed to fetch technicians' },
        { status: 500 }
      );
    }

    return HttpResponse.json(technicians);
  }),

  // POST /api/sync — Sync pending changes
  http.post('/api/sync', async ({ request }) => {
    await scenarioDelay();

    if (currentScenario === 'error') {
      return HttpResponse.json(
        { error: 'Sync failed', synced: 0, failed: 1 },
        { status: 500 }
      );
    }

    const body = await request.json();
    return HttpResponse.json({
      synced: Array.isArray(body) ? body.length : 1,
      failed: 0,
      timestamp: new Date().toISOString(),
    });
  }),

  // POST /api/auth/login — Mock login
  http.post('/api/auth/login', async () => {
    await scenarioDelay();

    if (currentScenario === 'error') {
      return HttpResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }

    return HttpResponse.json({
      user: {
        id: 'user-001',
        email: 'tech01@company.com',
        name: 'Alex Thompson',
        role: 'technician',
      },
      token: 'mock-jwt-token',
    });
  }),

  // POST /api/auth/logout — Mock logout
  http.post('/api/auth/logout', async () => {
    await scenarioDelay();
    return HttpResponse.json({ success: true });
  }),

  ...uploadHandlers,
];