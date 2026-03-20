/**
 * @vitest-environment jsdom
 *
 * tests/JobsTable.test.jsx
 * Unit tests for the JobsTable enterprise data grid.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import JobsTable from '@/components/field/JobsTable.jsx';
import { MOCK_JOBS } from '@/lib/mockJobs';

const DEFAULT_SORT = { col: 'scheduled_date', dir: 'desc' };

function renderTable(overrides = {}) {
  const props = {
    jobs:          MOCK_JOBS.slice(0, 5),
    total:         5,
    page:          0,
    pageSize:      25,
    sort:          DEFAULT_SORT,
    onSort:        vi.fn(),
    onPage:        vi.fn(),
    onBulkAction:  vi.fn(),
    ...overrides,
  };
  return render(<MemoryRouter><JobsTable {...props} /></MemoryRouter>);
}

describe('JobsTable', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  it('renders a table with correct ARIA role', () => {
    renderTable();
    expect(screen.getByRole('grid', { name: /jobs list/i })).toBeInTheDocument();
  });

  it('renders one row per job plus the header row', () => {
    renderTable();
    const grid = screen.getByRole('grid', { name: /jobs list/i });
    const rows = within(grid).getAllByRole('row');
    // 1 header row + 5 data rows
    expect(rows).toHaveLength(6);
  });

  it('displays job titles', () => {
    renderTable();
    const grid = screen.getByRole('grid', { name: /jobs list/i });
    MOCK_JOBS.slice(0, 5).forEach(job => {
      expect(within(grid).getByText(job.title)).toBeInTheDocument();
    });
  });

  it('calls onSort when a sortable column header is clicked', () => {
    const onSort = vi.fn();
    renderTable({ onSort });
    fireEvent.click(screen.getByRole('columnheader', { name: /status/i }));
    expect(onSort).toHaveBeenCalledWith('status');
  });

  it('calls onSort when Enter is pressed on a column header', () => {
    const onSort = vi.fn();
    renderTable({ onSort });
    const header = screen.getByRole('columnheader', { name: /priority/i });
    fireEvent.keyDown(header, { key: 'Enter' });
    expect(onSort).toHaveBeenCalledWith('priority');
  });

  it('sets aria-sort="descending" on the active sort column', () => {
    renderTable({ sort: { col: 'status', dir: 'desc' } });
    const header = screen.getByRole('columnheader', { name: /status/i });
    expect(header).toHaveAttribute('aria-sort', 'descending');
  });

  it('sets aria-sort="ascending" on active sort column with dir=asc', () => {
    renderTable({ sort: { col: 'title', dir: 'asc' } });
    const header = screen.getByRole('columnheader', { name: /^job$/i });
    expect(header).toHaveAttribute('aria-sort', 'ascending');
  });

  it('sets aria-sort="none" on non-active sortable columns', () => {
    renderTable({ sort: { col: 'status', dir: 'asc' } });
    const header = screen.getByRole('columnheader', { name: /^job$/i });
    expect(header).toHaveAttribute('aria-sort', 'none');
  });

  it('selects a row when checkbox is clicked and shows bulk bar', () => {
    renderTable();
    const grid = screen.getByRole('grid', { name: /jobs list/i });
    const [, firstDataRow] = within(grid).getAllByRole('row');
    const rowCheckbox = within(firstDataRow).getByRole('button', { name: /^select /i });
    fireEvent.click(rowCheckbox);
    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
  });

  it('select-all button selects all visible rows', () => {
    renderTable();
    const grid = screen.getByRole('grid', { name: /jobs list/i });
    const selectAll = within(grid).getByRole('button', { name: /select all rows/i });
    fireEvent.click(selectAll);
    expect(screen.getByText(/5 selected/i)).toBeInTheDocument();
  });

  it('calls onBulkAction when a bulk action button is clicked', () => {
    const onBulkAction = vi.fn();
    renderTable({ onBulkAction });
    const grid = screen.getByRole('grid', { name: /jobs list/i });
    const [, firstDataRow] = within(grid).getAllByRole('row');
    const rowCheckbox = within(firstDataRow).getByRole('button', { name: /^select /i });
    fireEvent.click(rowCheckbox);
    fireEvent.click(screen.getByRole('button', { name: /reassign/i }));
    expect(onBulkAction).toHaveBeenCalledWith('reassign', expect.any(Array));
  });

  it('renders empty state when no jobs', () => {
    renderTable({ jobs: [], total: 0 });
    expect(screen.getByText(/no jobs match/i)).toBeInTheDocument();
  });

  it('calls onPage with page-1 when Previous is clicked', () => {
    const onPage = vi.fn();
    renderTable({ page: 2, total: 75, pageSize: 25, onPage });
    fireEvent.click(screen.getByRole('button', { name: /previous page/i }));
    expect(onPage).toHaveBeenCalledWith(1);
  });

  it('calls onPage with page+1 when Next is clicked', () => {
    const onPage = vi.fn();
    renderTable({ page: 0, total: 75, pageSize: 25, onPage });
    fireEvent.click(screen.getByRole('button', { name: /next page/i }));
    expect(onPage).toHaveBeenCalledWith(1);
  });

  it('Previous button is disabled on first page', () => {
    renderTable({ page: 0 });
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
  });

  it('Next button is disabled on last page', () => {
    renderTable({ page: 0, total: 5, pageSize: 25 });
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });

  it('status pills have aria-label with full status text', () => {
    renderTable();
    const grid = screen.getByRole('grid', { name: /jobs list/i });
    const pill = within(grid).getAllByRole('status')[0];
    expect(pill).toHaveAttribute('aria-label', expect.stringMatching(/^Status:/));
  });
});