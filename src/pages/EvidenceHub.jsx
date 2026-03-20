import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import EvidenceGallery from '../components/field/EvidenceGallery';
import EvidenceCapture from '../components/field/EvidenceCapture';
import { Camera, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function EvidenceHub() {
  const [selectedJob, setSelectedJob] = useState('all');
  const [showCapture, setShowCapture] = useState(false);

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-updated_date', 100),
  });

  const { data: evidence = [], isLoading } = useQuery({
    queryKey: ['all-evidence'],
    queryFn: () => base44.entities.Evidence.list('-created_date', 200),
  });

  const activeJobs = jobs.filter(j => !['approved', 'submitted'].includes(j.status));

  const filtered = selectedJob === 'all'
    ? evidence
    : evidence.filter(e => e.job_id === selectedJob);

  const types = [...new Set(filtered.map(e => e.evidence_type).filter(Boolean))];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Evidence</h1>
            <p className="text-xs text-slate-400 mt-0.5">{filtered.length} items</p>
          </div>
          <Button
            onClick={() => setShowCapture(!showCapture)}
            className="rounded-full bg-slate-900 hover:bg-slate-800 h-10 px-4"
          >
            <Camera className="h-4 w-4 mr-2" />
            Capture
          </Button>
        </div>

        <div className="mb-4">
          <Select value={selectedJob} onValueChange={setSelectedJob}>
            <SelectTrigger className="rounded-xl bg-white">
              <SelectValue placeholder="Filter by job" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Jobs</SelectItem>
              {activeJobs.map(j => (
                <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showCapture && selectedJob !== 'all' && (
          <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
            <EvidenceCapture
              jobId={selectedJob}
              evidenceType="general"
              onCaptured={() => setShowCapture(false)}
            />
          </div>
        )}

        {showCapture && selectedJob === 'all' && (
          <div className="bg-amber-50 rounded-xl p-3 mb-4 text-xs text-amber-700">
            Select a specific job to capture evidence
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">No evidence yet</p>
            <p className="text-xs text-slate-400 mt-1">Photos and files will appear here</p>
          </div>
        ) : (
          <div className="space-y-6">
            {types.map(type => (
              <div key={type}>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2 capitalize">
                  {type.replace(/_/g, ' ')}
                </p>
                <div className="bg-white rounded-2xl border border-slate-100 p-3">
                  <EvidenceGallery
                    items={filtered.filter(e => e.evidence_type === type)}
                    jobId={selectedJob !== 'all' ? selectedJob : undefined}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}