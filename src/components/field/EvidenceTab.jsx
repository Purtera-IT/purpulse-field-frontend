import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import EvidenceCapture from './EvidenceCapture';
import EvidenceGallery from './EvidenceGallery';
import EvidenceTable from './EvidenceTable';
import EvidenceList from './EvidenceList';
import { Camera, CheckCircle2, Circle, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function EvidenceTab({ job }) {
  const [activeType,   setActiveType]   = useState(null);
  const [showCapture,  setShowCapture]  = useState(false);

  const { data: evidence = [] } = useQuery({
    queryKey: ['evidence', job?.id],
    queryFn: () => base44.entities.Evidence.filter({ job_id: job?.id }),
    enabled: !!job?.id,
    refetchInterval: 15000,
  });

  const requirements = job?.evidence_requirements || [];
  const displayEvidence = activeType
    ? evidence.filter(e => e.evidence_type === activeType)
    : evidence;

  return (
    <div className="space-y-3">

      {/* ── Requirements checklist ──────────────────────────── */}
      {requirements.length > 0 && (
        <div className="bg-white rounded-[8px] border border-slate-100 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-50">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Requirements</p>
          </div>
          <div className="divide-y divide-slate-50">
            {requirements.map((req, i) => {
              const count = evidence.filter(e => e.evidence_type === req.type && e.status === 'uploaded').length;
              const met   = count >= (req.min_count || 1);
              return (
                <button
                  key={i}
                  onClick={() => { setActiveType(activeType === req.type ? null : req.type); setShowCapture(!met); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
                >
                  {met
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    : <Circle       className="h-4 w-4 text-slate-300 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 capitalize">{req.label || req.type?.replace(/_/g, ' ')}</p>
                    <p className="text-[10px] text-slate-400">{count}/{req.min_count || 1} captured</p>
                  </div>
                  {activeType === req.type
                    ? <ChevronDown  className="h-3.5 w-3.5 text-slate-400" />
                    : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Evidence section header ──────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {activeType ? activeType.replace(/_/g, ' ') : 'All Evidence'}
          <span className="ml-2 font-normal normal-case text-slate-300">({displayEvidence.length})</span>
        </p>
        <button
          onClick={() => setShowCapture(v => !v)}
          className="h-8 px-2.5 rounded-md bg-[#0B2D5C] text-white text-[11px] font-semibold flex items-center gap-1.5 active:opacity-80"
        >
          <Camera className="h-3.5 w-3.5" />
          {showCapture ? 'Hide' : 'Capture'}
        </button>
      </div>

      {showCapture && (
        <div className="bg-white rounded-[8px] border border-slate-100 p-3">
          <EvidenceCapture
            jobId={job.id}
            evidenceType={activeType || 'general'}
            onCaptured={() => setShowCapture(false)}
          />
        </div>
      )}

      {/* ── Desktop: enterprise table / Mobile: gallery ────── */}
      {/* Desktop */}
      <div className="hidden lg:block">
        <EvidenceTable evidence={displayEvidence} jobId={job.id} />
      </div>

      {/* Mobile */}
      <div className="lg:hidden bg-white rounded-[8px] border border-slate-100 p-3">
        <EvidenceGallery items={displayEvidence} jobId={job.id} />
      </div>

    </div>
  );
}