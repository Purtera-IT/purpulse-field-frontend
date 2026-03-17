import React from 'react';
import EvidenceTable from '../components/field/EvidenceTable';

const MOCK_EVIDENCE = [
  {
    id: 'ev-1',
    evidence_type: 'before_photo',
    file_url: 'https://images.unsplash.com/photo-1581092921461-39b9c0f1e1e8?w=400',
    thumbnail_url: 'https://images.unsplash.com/photo-1581092921461-39b9c0f1e1e8?w=80',
    content_type: 'image/jpeg',
    size_bytes: 204800,
    status: 'uploaded',
    quality_score: 92,
    captured_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    geo_lat: 30.2672,
    geo_lon: -97.7431,
    notes: 'Before installation',
  },
  {
    id: 'ev-2',
    evidence_type: 'after_photo',
    file_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400',
    thumbnail_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=80',
    content_type: 'image/jpeg',
    size_bytes: 315000,
    status: 'uploaded',
    quality_score: 78,
    quality_warning: 'Low sharpness',
    captured_at: new Date(Date.now() - 1800 * 1000).toISOString(),
    geo_lat: 30.2675,
    geo_lon: -97.7432,
  },
  {
    id: 'ev-3',
    evidence_type: 'equipment_label',
    file_url: null,
    status: 'error',
    upload_error: 'Network timeout',
    captured_at: new Date(Date.now() - 900 * 1000).toISOString(),
  },
  {
    id: 'ev-4',
    evidence_type: 'site_photo',
    file_url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400',
    thumbnail_url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=80',
    content_type: 'image/jpeg',
    size_bytes: 180000,
    status: 'uploaded',
    quality_score: 95,
    captured_at: new Date().toISOString(),
  },
];

export default {
  title: 'Field/EvidenceTable',
  component: EvidenceTable,
  parameters: { layout: 'padded' },
  args: { jobId: 'story-job-1' },
};

export const WithEvidence = {
  args: { evidence: MOCK_EVIDENCE },
  name: 'With evidence (4 items)',
};

export const Empty = {
  args: { evidence: [] },
  name: 'Empty state',
};

export const AllUploaded = {
  args: {
    evidence: MOCK_EVIDENCE.filter(e => e.status === 'uploaded'),
  },
  name: 'All uploaded',
};

export const WithErrors = {
  args: {
    evidence: MOCK_EVIDENCE.filter(e => ['error', 'uploaded'].includes(e.status)),
  },
  name: 'Mixed uploaded + errors',
};