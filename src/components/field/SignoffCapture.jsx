import React, { useRef, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, PenTool, RotateCcw, Star } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { emitFeedbackEvent } from '@/lib/feedbackEvent';

export default function SignoffCapture({ job, onComplete }) {
  const { user } = useAuth();
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerTitle, setSignerTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [csat, setCsat] = useState(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSignature(true);
  };

  const endDraw = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const canvas = canvasRef.current;
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/png')
      );
      const file = new File([blob], 'signature.png', { type: 'image/png' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      await base44.entities.Job.update(job.id, {
        signoff_signer_name: signerName,
        signoff_signer_title: signerTitle,
        signoff_signature_url: file_url,
        signoff_csat: csat,
        signoff_notes: notes,
      });
      return { csatSnapshot: csat, notesSnapshot: notes };
    },
    onSuccess: async ({ csatSnapshot, notesSnapshot }) => {
      try {
        await emitFeedbackEvent({
          job,
          user,
          ratingValue: csatSnapshot > 0 ? csatSnapshot : null,
          complaintFlag: csatSnapshot > 0 && csatSnapshot <= 2,
          complimentFlag: csatSnapshot >= 4,
          feedbackNotes: notesSnapshot?.trim() || null,
          feedbackSource: 'signoff',
        });
      } catch (err) {
        console.warn('[feedback_event] enqueue failed after signoff', err);
      }
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Sign-off captured');
      onComplete?.();
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center">
          <PenTool className="h-4 w-4 text-indigo-600" />
        </div>
        <h3 className="font-semibold text-slate-900">Client Sign-Off</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Signer Name</Label>
          <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Full name" className="rounded-xl" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Title</Label>
          <Input value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} placeholder="Job title" className="rounded-xl" />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Signature</Label>
          {hasSignature && (
            <button onClick={clearSignature} className="text-xs text-slate-500 flex items-center gap-1 hover:text-slate-700">
              <RotateCcw className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
        <div className="border-2 border-dashed border-slate-200 rounded-xl overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            className="w-full h-32 cursor-crosshair touch-none"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Satisfaction Rating</Label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(s => (
            <button key={s} onClick={() => setCsat(s)} className="p-1">
              <Star className={cn('h-6 w-6', s <= csat ? 'text-amber-400 fill-amber-400' : 'text-slate-200')} />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Notes (optional)</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional notes..." className="rounded-xl resize-none" rows={2} />
      </div>

      <Button
        className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 h-12"
        disabled={!signerName || !hasSignature || submitMutation.isPending}
        onClick={() => submitMutation.mutate()}
      >
        {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Capture Sign-Off
      </Button>
    </div>
  );
}