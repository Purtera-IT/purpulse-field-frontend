import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import TimerPanel from '../components/field/TimerPanel';

// Seed the react-query cache so TimerPanel doesn't need a real network call
function withEntries(entries) {
  return (Story) => {
    const qc = useQueryClient();
    qc.setQueryData(['time-entries', 'story-job-1'], entries);
    return <Story />;
  };
}

export default {
  title: 'Field/TimerPanel',
  component: TimerPanel,
  args: { jobId: 'story-job-1' },
};

export const Idle = {
  args: { statusLabel: 'Ready' },
  decorators: [withEntries([])],
};

export const Working = {
  args: { statusLabel: 'In Progress' },
  decorators: [withEntries([
    { id: 'e1', entry_type: 'work_start', timestamp: new Date(Date.now() - 75 * 60 * 1000).toISOString() },
  ])],
};

export const OnBreak = {
  args: { statusLabel: 'On Break' },
  decorators: [withEntries([
    { id: 'e1', entry_type: 'work_start',  timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString() },
    { id: 'e2', entry_type: 'break_start', timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString() },
  ])],
};

export const Traveling = {
  args: { statusLabel: 'Traveling' },
  decorators: [withEntries([
    { id: 'e1', entry_type: 'work_start',    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
    { id: 'e2', entry_type: 'travel_start',  timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString() },
  ])],
};

export const CompactWorking = {
  args: { statusLabel: 'In Progress', compact: true },
  decorators: [withEntries([
    { id: 'e1', entry_type: 'work_start', timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
  ])],
  decorators: [
    withEntries([
      { id: 'e1', entry_type: 'work_start', timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
    ]),
    (Story) => <div className="bg-emerald-600 p-3 rounded-lg w-64"><Story /></div>,
  ],
};