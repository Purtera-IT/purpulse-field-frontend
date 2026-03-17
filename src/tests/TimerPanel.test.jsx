/**
 * tests/TimerPanel.test.jsx
 * Unit tests for TimerPanel component.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mocks ────────────────────────────────────────────────────────────
vi.mock('@/api/base44Client', () => ({
  base44: {
    entities: {
      TimeEntry: {
        filter: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'te-new' }),
      },
    },
  },
}));

vi.mock('@/lib/haptics', () => ({ haptic: vi.fn() }));

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), info: vi.fn() }) }));

import TimerPanel from '../src/components/field/TimerPanel';
import { base44 } from '@/api/base44Client';

function wrap(ui) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Seed empty entries
  qc.setQueryData(['time-entries', 'test-job'], []);
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('TimerPanel', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders in idle state with "00:00:00" and Start Work button', () => {
    wrap(<TimerPanel jobId="test-job" statusLabel="Ready" />);
    expect(screen.getByText('00:00:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start work/i })).toBeInTheDocument();
  });

  it('displays statusLabel in the state badge', () => {
    wrap(<TimerPanel jobId="test-job" statusLabel="Ready" />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('calls TimeEntry.create with work_start when Start Work is clicked', async () => {
    wrap(<TimerPanel jobId="test-job" statusLabel="Ready" />);
    fireEvent.click(screen.getByRole('button', { name: /start work/i }));
    expect(base44.entities.TimeEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ entry_type: 'work_start', job_id: 'test-job' })
    );
  });

  it('compact mode renders elapsed time inline without the full panel', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['time-entries', 'test-job'], []);
    const { container } = render(
      <QueryClientProvider client={qc}>
        <div className="bg-emerald-600 p-3">
          <TimerPanel jobId="test-job" statusLabel="In Progress" compact />
        </div>
      </QueryClientProvider>
    );
    // Compact timer should show time but not the stop-confirm panel
    expect(screen.getByText('00:00:00')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start work/i })).not.toBeInTheDocument();
  });

  it('shows Working state with Break and End Session buttons when work_start entry exists', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['time-entries', 'test-job'], [
      { id: 'e1', entry_type: 'work_start', timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
    ]);
    render(<QueryClientProvider client={qc}><TimerPanel jobId="test-job" statusLabel="In Progress" /></QueryClientProvider>);
    expect(screen.getByRole('button', { name: /break/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /end session/i })).toBeInTheDocument();
  });

  it('shows stop confirmation modal on End Session click', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['time-entries', 'test-job'], [
      { id: 'e1', entry_type: 'work_start', timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
    ]);
    render(<QueryClientProvider client={qc}><TimerPanel jobId="test-job" statusLabel="In Progress" /></QueryClientProvider>);
    fireEvent.click(screen.getByRole('button', { name: /end session/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/end work session/i)).toBeInTheDocument();
  });
});