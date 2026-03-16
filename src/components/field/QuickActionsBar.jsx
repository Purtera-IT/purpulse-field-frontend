import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Camera, Paperclip, StickyNote, ShieldCheck, MoreHorizontal, RefreshCw, AlertTriangle, UserX } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import EvidenceCapture from './EvidenceCapture';
import BlockerForm from './BlockerForm';
import SafetyChecklistModal from './SafetyChecklistModal';

const STATUS_OPTIONS = [
  { value: 'en_route',         label: 'En Route' },
  { value: 'checked_in',       label: 'Checked In' },
  { value: 'in_progress',      label: 'In Progress' },
  { value: 'paused',           label: 'Paused' },
  { value: 'pending_closeout', label: 'Pending Closeout' },
];

function ActionBtn({ icon: Icon, label, onClick, color = 'text-slate-700', bg = 'bg-slate-100' }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 h-[60px] w-[60px] rounded-2xl flex-shrink-0 active:scale-95 transition-transform ${bg}`}
      aria-label={label}
      // min 44px touch target met (60px)
    >
      <Icon className={`h-5 w-5 ${color}`} />
      <span className="text-[10px] font-semibold text-slate-500 leading-none">{label}</span>
    </button>
  );
}

export default function QuickActionsBar({ job }) {
  const [sheet, setSheet] = useState(null); // 'photo' | 'note' | 'safety' | 'overflow' | 'blocker' | 'status'
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const handleFileAttach = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Evidence.create({
        job_id: job.id,
        evidence_type: 'attachment',
        file_url,
        content_type: file.type,
        size_bytes: file.size,
        captured_at: new Date().toISOString(),
        status: 'uploaded',
      });
      queryClient.invalidateQueries({ queryKey: ['evidence', job.id] });
      toast.success('File attached');
    } catch { toast.error('Upload failed'); }
  };

  const handleStatusChange = async (newStatus) => {
    await base44.entities.Job.update(job.id, { status: newStatus });
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
    queryClient.invalidateQueries({ queryKey: ['job', job.id] });
    toast.success('Status updated');
    setSheet(null);
  };

  return (
    <>
      {/* ── Quick Actions Row ─────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Quick Actions</p>
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          <ActionBtn icon={Camera}      label="Photo"    bg="bg-blue-50"    color="text-blue-600"   onClick={() => setSheet('photo')} />
          <ActionBtn icon={Paperclip}   label="Attach"   bg="bg-purple-50"  color="text-purple-600" onClick={() => fileInputRef.current?.click()} />
          <ActionBtn icon={StickyNote}  label="Note"     bg="bg-amber-50"   color="text-amber-600"  onClick={() => setSheet('note')} />
          <ActionBtn icon={ShieldCheck} label="Safety"   bg="bg-green-50"   color="text-green-600"  onClick={() => setSheet('safety')} />
          <ActionBtn icon={MoreHorizontal} label="More"  bg="bg-slate-100"  color="text-slate-600"  onClick={() => setSheet('overflow')} />
        </div>
      </div>

      {/* Hidden file input for Attach */}
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileAttach} />

      {/* ── Photo sheet ───────────────────────────────── */}
      <Sheet open={sheet === 'photo'} onOpenChange={v => !v && setSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-10 max-h-[80vh] overflow-y-auto">
          <div className="pt-2 pb-4">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
            <h3 className="text-base font-bold text-slate-900 mb-4 px-1">Capture Evidence</h3>
            <EvidenceCapture
              jobId={job.id}
              evidenceType="site_photo"
              onCaptured={() => { setSheet(null); toast.success('Evidence captured'); }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Note sheet ────────────────────────────────── */}
      <Sheet open={sheet === 'note'} onOpenChange={v => !v && setSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-10">
          <div className="pt-2">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
            <h3 className="text-base font-bold text-slate-900 mb-3 px-1">Add Note</h3>
            <NoteForm jobId={job.id} onDone={() => setSheet(null)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Safety Checklist sheet ────────────────────── */}
      <Sheet open={sheet === 'safety'} onOpenChange={v => !v && setSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-10 max-h-[80vh] overflow-y-auto">
          <div className="pt-2">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
            <SafetyChecklist onDone={() => setSheet(null)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Overflow menu ─────────────────────────────── */}
      <Sheet open={sheet === 'overflow'} onOpenChange={v => !v && setSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-10">
          <div className="pt-2">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
            <h3 className="text-base font-bold text-slate-900 mb-4 px-1">More Options</h3>
            <div className="space-y-2">
              <OverflowItem icon={RefreshCw}    label="Change Status" desc="Update job status" color="text-blue-600"   bg="bg-blue-50"   onClick={() => setSheet('status')} />
              <OverflowItem icon={AlertTriangle} label="Report Blocker" desc="Flag an issue"    color="text-red-600"   bg="bg-red-50"    onClick={() => setSheet('blocker')} />
              <OverflowItem icon={UserX}         label="Reassign Job"  desc="Assign to another tech" color="text-slate-600" bg="bg-slate-100" onClick={() => { toast.info('Reassignment requires dispatcher access'); setSheet(null); }} />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Change Status sheet ───────────────────────── */}
      <Sheet open={sheet === 'status'} onOpenChange={v => !v && setSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-10">
          <div className="pt-2">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
            <h3 className="text-base font-bold text-slate-900 mb-4 px-1">Change Status</h3>
            <div className="space-y-2">
              {STATUS_OPTIONS.map(s => (
                <button key={s.value} onClick={() => handleStatusChange(s.value)}
                  className={`w-full h-12 rounded-xl text-sm font-semibold text-left px-4 transition-colors ${job.status === s.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 active:bg-slate-200'}`}
                >
                  {s.label}
                  {job.status === s.value && <span className="float-right text-xs font-normal opacity-70">current</span>}
                </button>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Blocker sheet ─────────────────────────────── */}
      <Sheet open={sheet === 'blocker'} onOpenChange={v => !v && setSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[80vh] overflow-y-auto pb-10">
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-4" />
          <BlockerForm jobId={job.id} onClose={() => setSheet(null)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

// ── Internal sub-components ───────────────────────────────────────────

function OverflowItem({ icon: Icon, label, desc, color, bg, onClick }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-slate-50 active:bg-slate-100 transition-colors"
    >
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div className="text-left">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
    </button>
  );
}

function NoteForm({ jobId, onDone }) {
  const [text, setText] = useState('');
  const queryClient = useQueryClient();

  const save = async () => {
    if (!text.trim()) return;
    await base44.entities.ChatMessage.create({
      job_id: jobId,
      body: `📝 Note: ${text.trim()}`,
      sent_at: new Date().toISOString(),
      sync_status: 'pending',
    });
    queryClient.invalidateQueries({ queryKey: ['chat-messages', jobId] });
    toast.success('Note added');
    onDone();
  };

  return (
    <div className="px-1 space-y-3">
      <textarea
        value={text} onChange={e => setText(e.target.value)}
        placeholder="Type your note…"
        className="w-full h-28 rounded-xl border border-slate-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-300"
        autoFocus
      />
      <button onClick={save} disabled={!text.trim()}
        className="w-full h-12 rounded-xl bg-slate-900 text-white font-semibold text-sm disabled:opacity-40 active:opacity-80"
      >
        Save Note
      </button>
    </div>
  );
}

const SAFETY_ITEMS = [
  'PPE worn (hard hat, hi-vis, gloves)',
  'Site hazard briefing completed',
  'Emergency exits identified',
  'Ladder / equipment inspected',
  'Permit to work obtained',
  'Communication check-in confirmed',
];

function SafetyChecklist({ onDone }) {
  const [checked, setChecked] = useState({});
  const toggle = k => setChecked(p => ({ ...p, [k]: !p[k] }));
  const allDone = SAFETY_ITEMS.every((_, i) => checked[i]);

  return (
    <div className="px-1">
      <h3 className="text-base font-bold text-slate-900 mb-4">Safety Checklist</h3>
      <div className="space-y-2 mb-5">
        {SAFETY_ITEMS.map((item, i) => (
          <button key={i} onClick={() => toggle(i)}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 active:bg-slate-100 text-left"
            aria-checked={!!checked[i]} role="checkbox"
          >
            <div className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked[i] ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
              {checked[i] && <svg viewBox="0 0 12 10" className="h-3 w-3 text-white fill-none stroke-white stroke-2"><polyline points="1,5 4,8 11,1"/></svg>}
            </div>
            <span className={`text-sm ${checked[i] ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item}</span>
          </button>
        ))}
      </div>
      <button onClick={onDone} disabled={!allDone}
        className="w-full h-12 rounded-xl bg-emerald-600 text-white font-semibold text-sm disabled:opacity-40 active:opacity-80"
      >
        {allDone ? '✓ All Clear — Continue' : `${SAFETY_ITEMS.length - Object.values(checked).filter(Boolean).length} items remaining`}
      </button>
    </div>
  );
}