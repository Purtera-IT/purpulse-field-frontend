import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import EvidenceTile from './EvidenceTile';
import EvidenceDetailSheet from './EvidenceDetailSheet';
import { Sheet, SheetContent } from '@/components/ui/sheet';

export default function EvidenceGallery({ items, jobId }) {
  const [detailItem, setDetailItem] = useState(null);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Evidence.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence', jobId] });
      toast.success('Evidence removed');
    },
  });

  if (!items?.length) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        No evidence captured yet
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {items.filter(i => i.status !== 'replaced').map((item) => (
          <EvidenceTile key={item.id} item={item} size={96} onTap={setDetailItem} />
        ))}
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