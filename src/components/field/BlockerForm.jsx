import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Loader2, Camera } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { emitEscalationEvent } from '@/lib/escalationEvent';
import { fetchJobContextForArtifactEvent } from '@/lib/artifactEvent';
import EvidenceCapture from './EvidenceCapture';

const BLOCKER_TYPES = [
  { value: 'access_issue', label: 'Access Issue' },
  { value: 'equipment_missing', label: 'Equipment Missing' },
  { value: 'safety_concern', label: 'Safety Concern' },
  { value: 'weather', label: 'Weather' },
  { value: 'customer_unavailable', label: 'Customer Unavailable' },
  { value: 'scope_change', label: 'Scope Change' },
  { value: 'other', label: 'Other' },
];

const SEVERITY_LEVELS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

/**
 * @param {Object} props
 * @param {string} props.jobId
 * @param {'comms' | undefined} [props.variant] — comms: escalation copy + toasts for FieldJobDetail Comms tab
 * @param {() => void} [props.onClose]
 * @param {(payload?: { blocker: Record<string, unknown>; blockerType: string; severityLevel: string; noteText: string }) => void | Promise<void>} [props.onSubmitted]
 */
export default function BlockerForm({ jobId, variant, onClose, onSubmitted }) {
  const isComms = variant === 'comms';
  const { user } = useAuth();
  const [type, setType] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [note, setNote] = useState('');
  const [photoIds, setPhotoIds] = useState([]);
  const [showCapture, setShowCapture] = useState(false);
  const queryClient = useQueryClient();

  const createBlocker = useMutation({
    mutationFn: async () => {
      const jobCtx = await fetchJobContextForArtifactEvent(jobId);
      const jobForEvent = { id: jobId, ...jobCtx };
      try {
        await emitEscalationEvent({
          job: jobForEvent,
          user,
          reasonCategory: type,
          escalationSource: 'blocker_create',
          severity,
          escalationRecordId: null,
          notesPreview: note,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (import.meta.env.DEV) console.error('[BlockerForm] escalation_event', e);
        throw new Error(`Telemetry: ${msg}`);
      }
      try {
        const blocker = await base44.entities.Blocker.create({
          job_id: jobId,
          blocker_type: type,
          severity,
          note,
          photo_evidence_ids: photoIds,
          status: 'open',
          sync_status: 'pending',
        });
        return { blocker, blockerType: type, severityLevel: severity, noteText: note };
      } catch (createErr) {
        if (import.meta.env.DEV) {
          console.warn('[BlockerForm] Blocker.create failed after escalation_event queued', createErr);
        }
        toast.warning(
          'Escalation was queued, but saving the record failed. Try again or contact support if it persists.'
        );
        throw createErr;
      }
    },
    onSuccess: ({ blocker, blockerType, severityLevel, noteText }) => {
      queryClient.invalidateQueries({ queryKey: ['blockers', jobId] });
      if (isComms) {
        toast.success('Escalation saved for this job.');
      } else {
        toast.success('Blocker reported');
      }
      onSubmitted?.({ blocker, blockerType, severityLevel, noteText });
      onClose?.();
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.startsWith('Telemetry:')) {
        toast.error('Could not queue escalation — try again');
      }
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-8 w-8 rounded-full bg-red-50 flex items-center justify-center">
          <AlertTriangle className="h-4 w-4 text-red-600" />
        </div>
        <h3 className="font-semibold text-slate-900">{isComms ? 'Report escalation' : 'Report Blocker'}</h3>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-slate-600">{isComms ? 'Category' : 'Type'}</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="rounded-xl">
            <SelectValue placeholder={isComms ? 'Select category' : 'Select blocker type'} />
          </SelectTrigger>
          <SelectContent>
            {BLOCKER_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-slate-600">Severity</Label>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEVERITY_LEVELS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-slate-600">Description</Label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={isComms ? 'What needs follow-up?' : 'Describe the blocker...'}
          className="rounded-xl resize-none"
          rows={3}
        />
      </div>

      <div>
        <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => setShowCapture(!showCapture)}>
          <Camera className="h-3.5 w-3.5 mr-1.5" />
          Add Photo ({photoIds.length})
        </Button>
        {showCapture && (
          <div className="mt-2">
            <EvidenceCapture
              jobId={jobId}
              evidenceType="blocker_photo"
              onCaptured={(evidence) => {
                setPhotoIds([...photoIds, evidence.id]);
                setShowCapture(false);
              }}
            />
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="flex-1 rounded-xl bg-red-600 hover:bg-red-700"
          onClick={() => createBlocker.mutate()}
          disabled={!type || !note.trim() || createBlocker.isPending}
        >
          {createBlocker.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          {isComms ? 'Save escalation' : 'Report'}
        </Button>
      </div>
    </div>
  );
}
