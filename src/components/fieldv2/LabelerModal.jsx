/**
 * LabelerModal / QC Modal (F)
 * Label type, value dropdown + free text, confidence slider, notes.
 * Persists LabelRecord + AuditLog on submit.
 */
import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { uuidv4 } from '@/lib/uuid';
import { defaultAdapters } from '@/lib/fieldAdapters';

const LABEL_TYPES = ['pass','fail','defect','flag','skip','qc_fail','qc_pass','training_approved'];
const PRESET_VALUES = {
  defect:  ['corrosion','cable_loose','connector_bent','panel_damage','missing_hardware','water_ingress'],
  pass:    ['connector_ok','loto_compliant','cable_tray_clear','rack_cabling_complete','load_reading_normal'],
  flag:    ['needs_review','safety_concern','unclear_image','out_of_scope'],
  fail:    ['overexposed','blurry','wrong_subject','no_label_visible'],
  qc_pass: ['approved_by_qc'],
  qc_fail: ['qc_rejected'],
  skip:    ['pdf_not_labelable','duplicate','corrupted'],
  training_approved: ['high_quality','diverse_angle','good_lighting'],
};

export default function LabelerModal({
  evidence, jobId,
  adapter = defaultAdapters.label,
  onClose, onSuccess,
}) {
  const [labelType,          setLabelType]          = useState('pass');
  const [labelValue,         setLabelValue]         = useState('');
  const [confidence,         setConfidence]         = useState(0.9);
  const [notes,              setNotes]              = useState('');
  const [bboxStr,            setBboxStr]            = useState('');
  const [approvedForTraining,setApprovedForTraining] = useState(false);

  const presets = PRESET_VALUES[labelType] || [];

  const mutation = useMutation({
    mutationFn: () => adapter.createLabel({
      id:                   uuidv4(),
      evidence_id:          evidence.id,
      job_id:               jobId,
      label_type:           labelType,
      label_value:          labelValue || null,
      confidence:           +confidence,
      bbox:                 bboxStr || null,
      labeled_by:           'admin@purpulse.com',
      labeled_at:           new Date().toISOString(),
      approved_for_training: approvedForTraining || labelType === 'training_approved' || labelType === 'qc_pass',
      qc_status:            ['pass','qc_pass','training_approved'].includes(labelType) ? 'approved' : 'pending',
      notes:                notes || null,
    }, 'admin@purpulse.com'),
    onSuccess: () => {
      toast.success('Label saved');
      onSuccess?.();
    },
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center md:justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl md:rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-50">
          <h2 className="text-base font-black text-slate-900">Apply Label</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
            <X className="h-4 w-4 text-slate-600" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[80vh] overflow-y-auto pb-8">
          {/* Evidence mini-preview */}
          {evidence.file_url && evidence.content_type?.startsWith('image') && (
            <div className="h-24 rounded-xl overflow-hidden bg-slate-100">
              <img src={evidence.file_url} alt="evidence" className="h-full w-full object-cover" />
            </div>
          )}

          {/* Label Type */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Label Type</label>
            <div className="flex flex-wrap gap-1.5">
              {LABEL_TYPES.map(t => (
                <button key={t} onClick={() => { setLabelType(t); setLabelValue(''); }}
                  className={cn('h-7 px-2.5 rounded-full text-[11px] font-bold transition-colors capitalize',
                    labelType === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}>
                  {t.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Label Value */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Label Value</label>
            {presets.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {presets.map(p => (
                  <button key={p} onClick={() => setLabelValue(p)}
                    className={cn('h-6 px-2 rounded-full text-[10px] font-semibold transition-colors',
                      labelValue === p ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    )}>
                    {p.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            )}
            <input value={labelValue} onChange={e => setLabelValue(e.target.value)}
              placeholder="or type a custom value…"
              className="w-full h-9 rounded-lg border border-slate-200 text-xs px-3 focus:outline-none focus:ring-1 focus:ring-slate-400" />
          </div>

          {/* Confidence */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
              Confidence: <span className="text-slate-700 font-black">{(confidence * 100).toFixed(0)}%</span>
            </label>
            <input type="range" min="0" max="1" step="0.01" value={confidence}
              onChange={e => setConfidence(+e.target.value)}
              className="w-full accent-slate-900" />
            <div className="flex justify-between text-[10px] text-slate-300 mt-0.5"><span>0%</span><span>100%</span></div>
          </div>

          {/* BBox (optional) */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Bounding Box (optional)</label>
            <input value={bboxStr} onChange={e => setBboxStr(e.target.value)}
              placeholder='{"x":0.1,"y":0.2,"w":0.5,"h":0.4}'
              className="w-full h-9 rounded-lg border border-slate-200 text-[11px] font-mono px-3 focus:outline-none focus:ring-1 focus:ring-slate-400" />
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="QC notes, observations…"
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-slate-400" />
          </div>

          {/* Submit */}
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="w-full h-11 rounded-xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-700 disabled:opacity-50 transition-colors">
            {mutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <><CheckCircle2 className="h-4 w-4" /> Save Label</>}
          </button>
        </div>
      </div>
    </div>
  );
}