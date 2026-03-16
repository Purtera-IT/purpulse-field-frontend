import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Camera, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import EvidenceTile from './EvidenceTile';
import EvidenceDetailSheet from './EvidenceDetailSheet';
import { Sheet, SheetContent } from '@/components/ui/sheet';



export default function EvidenceScroller({ job, onAddPhoto }) {
  const [detailItem, setDetailItem] = useState(null);

  const { data: evidence = [] } = useQuery({
    queryKey: ['evidence', job?.id],
    queryFn: () => base44.entities.Evidence.filter({ job_id: job?.id }),
    enabled: !!job?.id,
  });

  const visible = evidence.filter(e => e.status !== 'replaced');

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-100 p-3">
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Evidence</p>
          <span className="text-xs text-slate-400">{visible.length} items</span>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {/* Add button — always first */}
          <button
            onClick={onAddPhoto}
            className="flex-shrink-0 w-[88px] h-[88px] rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 active:bg-slate-50 transition-colors"
            aria-label="Add evidence photo"
          >
            <Camera className="h-5 w-5 text-slate-400" />
            <span className="text-[10px] text-slate-400 font-semibold">Add</span>
          </button>

          {visible.map(item => (
            <EvidenceTile key={item.id} item={item} size={88} onTap={setDetailItem} />
          ))}

          {visible.length === 0 && (
            <div className="flex-1 flex items-center py-4 pl-2">
              <p className="text-xs text-slate-400">No evidence yet — tap Add to start</p>
            </div>
          )}
        </div>
      </div>

      <Sheet open={!!detailItem} onOpenChange={v => !v && setDetailItem(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto pb-10">
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-5" />
          {detailItem && (
            <EvidenceDetailSheet item={detailItem} onClose={() => setDetailItem(null)} />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}