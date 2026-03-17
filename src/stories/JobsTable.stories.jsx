import React, { useState } from 'react';
import JobsTable from '../components/field/JobsTable';
import { MOCK_JOBS } from '../lib/mockJobs';

export default {
  title: 'Field/JobsTable',
  component: JobsTable,
  parameters: { layout: 'fullscreen' },
};

function Controlled(args) {
  const [sort, setSort] = useState({ col: 'scheduled_date', dir: 'desc' });
  const [page, setPage] = useState(0);
  return (
    <div className="p-4 bg-slate-50 min-h-screen">
      <JobsTable
        {...args}
        sort={sort}
        page={page}
        onSort={(col) => setSort(prev => ({ col, dir: prev.col === col && prev.dir === 'asc' ? 'desc' : 'asc' }))}
        onPage={setPage}
        onBulkAction={(action, ids) => alert(`${action} on ${ids.length} jobs`)}
      />
    </div>
  );
}

export const FullDataset = {
  render: (args) => <Controlled {...args} />,
  args: { jobs: MOCK_JOBS, total: MOCK_JOBS.length, pageSize: 25 },
  name: 'Full dataset (8 jobs)',
};

export const SinglePage = {
  render: (args) => <Controlled {...args} />,
  args: { jobs: MOCK_JOBS.slice(0, 3), total: 3, pageSize: 25 },
  name: 'Single page (3 jobs)',
};

export const MultiPage = {
  render: (args) => <Controlled {...args} />,
  args: { jobs: MOCK_JOBS.slice(0, 5), total: 42, pageSize: 5 },
  name: 'Multi-page pagination',
};

export const EmptyState = {
  render: (args) => <Controlled {...args} />,
  args: { jobs: [], total: 0, pageSize: 25 },
  name: 'Empty (no results)',
};