import React from 'react';
import JobCard from '../components/field/JobCard';
import { MOCK_JOBS } from '../lib/mockJobs';

export default {
  title: 'Field/JobCard',
  component: JobCard,
  parameters: { layout: 'padded' },
  args: { onStartTimer: () => {}, isStarting: false },
};

export const Assigned     = { args: { job: MOCK_JOBS.find(j => j.status === 'assigned') } };
export const EnRoute      = { args: { job: MOCK_JOBS.find(j => j.status === 'en_route') } };
export const InProgress   = { args: { job: MOCK_JOBS.find(j => j.status === 'in_progress') } };
export const Paused       = { args: { job: MOCK_JOBS.find(j => j.status === 'paused') } };
export const PendingClose = { args: { job: MOCK_JOBS.find(j => j.status === 'pending_closeout') } };
export const Approved     = { args: { job: MOCK_JOBS.find(j => j.status === 'approved') } };
export const UrgentPriority = {
  args: { job: MOCK_JOBS.find(j => j.priority === 'urgent') },
  name: 'Urgent Priority',
};
export const StartingSpinner = {
  args: { job: MOCK_JOBS.find(j => j.status === 'assigned'), isStarting: true },
  name: 'Starting (loading state)',
};
export const SyncError = {
  args: { job: MOCK_JOBS.find(j => j.sync_status === 'error') },
  name: 'Sync Error badge',
};