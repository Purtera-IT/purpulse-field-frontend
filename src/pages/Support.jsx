/**
 * Support — 3-section field technician support hub:
 *   1. Help Center  — FAQs, SOPs, guides, downloadable artifacts
 *   2. Diagnostics  — sync status, queue, failed uploads, retry
 *   3. Contact      — support contact, emergency escalation
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen, Activity, Phone, ChevronDown, ChevronUp, ChevronRight,
  FileText, Download, Search, AlertTriangle, CheckCircle2, RefreshCw,
  WifiOff, Wifi, AlertOctagon, HelpCircle, Wrench, FileSearch,
  RotateCcw, UploadCloud, Clock, XCircle, PhoneCall, Mail, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Sheet, SheetContent } from '@/components/ui/sheet';

// ── Shared ──────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, subtitle, color = 'text-slate-600' }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center', color === 'text-blue-600' ? 'bg-blue-50' : color === 'text-emerald-600' ? 'bg-emerald-50' : color === 'text-red-600' ? 'bg-red-50' : 'bg-slate-100')}>
        <Icon className={cn('h-5 w-5', color)} />
      </div>
      <div>
        <p className="text-base font-black text-slate-900">{title}</p>
        {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, sub, badge, onClick, iconCls = 'text-slate-400', danger }) {
  return (
    <button onClick={onClick}
      className={cn('w-full flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 last:border-0 active:bg-slate-50 text-left', danger && 'active:bg-red-50')}>
      <div className={cn('h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-50')}>
        <Icon className={cn('h-4 w-4', iconCls)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold', danger ? 'text-red-600' : 'text-slate-800')}>{label}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
      {badge && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 flex-shrink-0">{badge}</span>}
      <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
    </button>
  );
}

// ── 1. Help Center ───────────────────────────────────────────────────
const FAQS = [
  { q: "How do I start/stop the work timer?", a: "Go to the Time tab and tap 'Start Work'. The timer runs in the background. Tap Stop when you're done — you'll get an 8-second undo window." },
  { q: "What happens to data when I'm offline?", a: "All actions are queued locally and sync automatically when you reconnect. You'll see a sync indicator in the top bar and Support > Diagnostics." },
  { q: "How do I escalate a job blocker?", a: "Inside any job, open the Tasks tab and tap 'Escalate' on the relevant task. You can also go to Chat > Contact PM and use the Escalate button." },
  { q: "Can I retake a photo that failed QC?", a: "Yes. Open the job, go to Tasks, find the task with the QC warning, and tap the 📷 icon to recapture the deliverable." },
  { q: "How do I edit a time entry after the fact?", a: "Go to the Time tab, expand the job section and tap the edit icon on any entry. A mandatory audit reason is required for all corrections." },
];

const FIELD_ARTIFACTS = [
  { name: 'Safety Pre-Work Checklist', type: 'PDF', size: '84 KB', tag: 'Safety' },
  { name: 'Tower Install SOP v3.2',    type: 'PDF', size: '1.2 MB', tag: 'SOP'    },
  { name: 'Ground System Spec Sheet',  type: 'PDF', size: '340 KB', tag: 'Spec'   },
  { name: 'Field Incident Report',     type: 'PDF', size: '56 KB',  tag: 'Form'   },
];

function HelpCenter({ onOpenArtifact }) {
  const [openFaq, setOpenFaq] = useState(null);
  const [search, setSearch]   = useState('');

  const filtered = FAQS.filter(f =>
    !search || f.q.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search FAQs & guides…"
          className="w-full h-11 pl-9 pr-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
      </div>

      {/* FAQs */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-50 flex items-center gap-2">
          <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">FAQs</p>
        </div>
        {filtered.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No results</p>}
        {filtered.map((faq, i) => (
          <div key={i} className="border-b border-slate-50 last:border-0">
            <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
              className="w-full flex items-center justify-between px-4 py-3.5 text-left active:bg-slate-50">
              <p className="text-sm font-semibold text-slate-800 flex-1 pr-3">{faq.q}</p>
              {openFaq === i ? <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />}
            </button>
            {openFaq === i && (
              <div className="px-4 pb-4">
                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-xl px-3 py-2.5">{faq.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* SOPs & Guides */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-50 flex items-center gap-2">
          <Wrench className="h-3.5 w-3.5 text-slate-400" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SOPs & Troubleshooting</p>
        </div>
        {[
          { title: 'Tower Foundation — Field SOP',      sub: 'Step-by-step installation protocol', icon: FileSearch, tag: 'SOP'   },
          { title: 'Grounding System Troubleshooting',  sub: 'Diagnose & resolve grounding issues',  icon: Wrench,     tag: 'Guide' },
          { title: 'GPS & Evidence QC Guide',           sub: 'How to pass photo QC checks',          icon: FileText,   tag: 'Guide' },
          { title: 'Offline Mode — Field Guide',        sub: 'Working without connectivity',         icon: WifiOff,    tag: 'Guide' },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <button key={i} onClick={() => toast.info(`${item.title} — opening document viewer`)}
              className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 last:border-0 active:bg-slate-50 text-left">
              <div className="h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Icon className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                <p className="text-[11px] text-slate-400">{item.sub}</p>
              </div>
              <span className="text-[9px] font-black px-2 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200 flex-shrink-0">{item.tag}</span>
              <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
            </button>
          );
        })}
      </div>

      {/* Downloadable artifacts */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-50 flex items-center gap-2">
          <Download className="h-3.5 w-3.5 text-slate-400" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Field Artifacts</p>
        </div>
        {FIELD_ARTIFACTS.map((a, i) => (
          <button key={i} onClick={() => onOpenArtifact?.(a)}
            className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 last:border-0 active:bg-slate-50 text-left">
            <div className="h-8 w-8 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <FileText className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{a.name}</p>
              <p className="text-[11px] text-slate-400">{a.type} · {a.size}</p>
            </div>
            <span className="text-[9px] font-black px-2 py-0.5 rounded border bg-slate-50 text-slate-500 border-slate-200 flex-shrink-0">{a.tag}</span>
            <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── 2. Diagnostics ───────────────────────────────────────────────────
function DiagnosticsSection({ isOnline, syncItems, deviceId, queryClient }) {
  const pending = syncItems.filter(s => ['pending','in_progress'].includes(s.status));
  const failed  = syncItems.filter(s => s.status === 'failed');
  const active  = syncItems.filter(s => s.status !== 'completed');

  const retryAll = useMutation({
    mutationFn: async () => Promise.all(failed.map(item =>
      base44.entities.SyncQueue.update(item.id, { status: 'pending', retry_count: (item.retry_count||0)+1, last_error: null })
    )),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-queue-all'] });
      toast.success(`${failed.length} item(s) queued for retry`);
    },
  });

  const lastError = [...failed].sort((a,b) => new Date(b.created_date||0) - new Date(a.created_date||0))[0];

  const statusColor = failed.length ? 'bg-red-50 border-red-200' : pending.length ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200';
  const statusIcon  = !isOnline ? WifiOff : failed.length ? AlertTriangle : pending.length ? RefreshCw : CheckCircle2;
  const StatusIcon  = statusIcon;
  const statusText  = !isOnline ? 'Offline' : failed.length ? `${failed.length} sync failed` : pending.length ? `${pending.length} syncing…` : 'All synced';
  const statusSub   = !isOnline ? 'Changes saved locally, will sync on reconnect' : failed.length ? 'Tap Retry All to reprocess' : pending.length ? 'Background sync running' : 'Queue is empty';

  return (
    <div className="space-y-3">
      {/* Sync status banner */}
      <div className={cn('rounded-2xl border p-4', statusColor)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusIcon className={cn('h-5 w-5 flex-shrink-0',
              failed.length ? 'text-red-600' : pending.length ? 'text-blue-500 animate-spin' : isOnline ? 'text-emerald-600' : 'text-red-600'
            )} />
            <div>
              <p className={cn('text-sm font-black', failed.length ? 'text-red-800' : pending.length ? 'text-blue-800' : 'text-emerald-800')}>{statusText}</p>
              <p className={cn('text-[11px]', failed.length ? 'text-red-600' : pending.length ? 'text-blue-600' : 'text-emerald-600')}>{statusSub}</p>
            </div>
          </div>
          {failed.length > 0 && isOnline && (
            <button onClick={() => retryAll.mutate()} disabled={retryAll.isPending}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-red-600 text-white text-xs font-bold active:opacity-80">
              <RotateCcw className="h-3.5 w-3.5" /> Retry All
            </button>
          )}
        </div>
        {lastError?.last_error && (
          <div className="mt-3 bg-red-100/60 rounded-xl px-3 py-2">
            <p className="text-[10px] font-bold text-red-600 mb-0.5">Last error</p>
            <p className="text-[10px] font-mono text-red-700 break-all leading-snug">{lastError.last_error}</p>
          </div>
        )}
      </div>

      {/* Queue stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Pending',   count: pending.length, cls: 'bg-blue-50  text-blue-700  border-blue-200'  },
          { label: 'Failed',    count: failed.length,  cls: failed.length ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-500 border-slate-200' },
          { label: 'Completed', count: syncItems.filter(s => s.status === 'completed').length, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-2xl border p-3 text-center', s.cls)}>
            <p className="text-xl font-black tabular-nums">{s.count}</p>
            <p className="text-[10px] font-semibold opacity-70 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Queued items */}
      {active.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-50">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Queued Items</p>
          </div>
          {active.slice(0, 8).map(item => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0">
              <div className={cn('h-2 w-2 rounded-full flex-shrink-0',
                item.status === 'failed'     ? 'bg-red-500'   :
                item.status === 'in_progress'? 'bg-blue-500 animate-pulse' :
                'bg-amber-400'
              )} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate capitalize">{item.entity_type?.replace(/_/g,' ')} · {item.action}</p>
                {item.last_error && <p className="text-[10px] text-red-500 font-mono truncate">{item.last_error}</p>}
              </div>
              <span className={cn('text-[9px] font-black px-2 py-0.5 rounded-full flex-shrink-0',
                item.status === 'failed'     ? 'bg-red-100 text-red-700'   :
                item.status === 'in_progress'? 'bg-blue-100 text-blue-700' :
                'bg-amber-100 text-amber-700'
              )}>{item.status}</span>
            </div>
          ))}
          {active.length > 8 && (
            <p className="px-4 py-2.5 text-xs text-slate-400 text-center">+{active.length - 8} more items</p>
          )}
        </div>
      )}

      {/* Device info */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Device & Network</p>
        <div className="bg-slate-50 rounded-xl p-3 font-mono space-y-2">
          {[
            { k: 'device_id',      v: deviceId },
            { k: 'network',        v: isOnline ? '● online' : '● offline', cls: isOnline ? 'text-emerald-600' : 'text-red-600' },
            { k: 'app_version',    v: '2.4.1' },
            { k: 'offline_queue',  v: `${JSON.parse(localStorage.getItem('purpulse_time_edit_queue')||'[]').length} items` },
            { k: 'ua',             v: navigator.userAgent.slice(0, 40) + '…' },
          ].map(({ k, v, cls }) => (
            <div key={k} className="flex items-center justify-between gap-3">
              <span className="text-[10px] text-slate-400">{k}</span>
              <span className={cn('text-[10px] text-slate-700 truncate max-w-[55%] text-right', cls)}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 3. Contact / Assistance ──────────────────────────────────────────
function ContactSection() {
  return (
    <div className="space-y-3">
      {/* Support */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-50">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Field Support</p>
        </div>
        <Row icon={Phone} label="Call Support Desk" sub="Mon–Fri, 06:00–22:00 PT" badge="Live" onClick={() => toast.info('Calling +1 (800) 555-0199…')} iconCls="text-blue-600" />
        <Row icon={Mail}  label="Email Support"      sub="support@purpulse.io"     onClick={() => toast.info('Opening email…')} iconCls="text-blue-600" />
        <Row icon={PhoneCall} label="Request Callback" sub="Average wait: 4 min"  onClick={() => toast.success('Callback requested — expect a call within 4 minutes')} iconCls="text-blue-600" />
      </div>

      {/* Emergency */}
      <div className="bg-red-50 rounded-2xl border border-red-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertOctagon className="h-5 w-5 text-red-600" />
          <p className="text-sm font-black text-red-800">Emergency Escalation</p>
        </div>
        <div className="space-y-2.5">
          {[
            { label: 'Site Emergency',       number: '911',           sub: 'Fire, injury, hazmat'       },
            { label: 'Purpulse Emergency',   number: '+1 (800) 555-0911', sub: '24/7 incident response' },
            { label: 'Safety Officer',       number: '+1 (510) 555-0144', sub: 'Workplace safety issues' },
          ].map((c, i) => (
            <a key={i} href={`tel:${c.number}`}
              className="flex items-center justify-between bg-white rounded-xl px-3.5 py-3 border border-red-200 active:bg-red-50">
              <div>
                <p className="text-sm font-bold text-red-800">{c.label}</p>
                <p className="text-[11px] text-red-500">{c.sub}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black font-mono text-red-700">{c.number}</span>
                <Phone className="h-4 w-4 text-red-600" />
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* About */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">App Info</p>
        <div className="space-y-1.5">
          {[
            ['Version',  '2.4.1 (build 241)'],
            ['Platform', 'Base44 Field Platform'],
            ['Env',      'Production'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-xs text-slate-400">{k}</span>
              <span className="text-xs font-semibold text-slate-600 font-mono">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────
const TABS = [
  { id: 'help',  Icon: BookOpen,  label: 'Help Center' },
  { id: 'diag',  Icon: Activity,  label: 'Diagnostics' },
  { id: 'contact', Icon: Phone,   label: 'Contact'     },
];

const DEVICE_ID_KEY = 'purpulse_device_id';
function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 6);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// ── Artifact viewer sheet ────────────────────────────────────────────
const ARTIFACT_CONTENT = {
  'Safety Pre-Work Checklist': {
    sections: [
      { title: 'Personal Protective Equipment', items: ['Hard hat worn', 'Safety glasses on', 'Hi-vis vest on', 'Steel-toe boots', 'Gloves if handling sharp edges'] },
      { title: 'Site Hazard Assessment', items: ['Identify electrical hazards', 'Confirm LOTO applied if required', 'Check fall hazard zones', 'Verify confined-space status', 'Weather conditions acceptable'] },
      { title: 'Tool & Equipment Check', items: ['Inspect all tools before use', 'Check torque wrench calibration', 'Verify ladders rated for load', 'Confirm fall arrest gear certified', 'First-aid kit accessible'] },
    ]
  },
  'Tower Install SOP v3.2': {
    sections: [
      { title: 'Phase 1 — Pre-Installation', items: ['Confirm site survey complete', 'Verify permits on-site', 'Perform ground resistance test (< 5 Ω)', 'Mark underground utilities'] },
      { title: 'Phase 2 — Foundation', items: ['Excavate to spec depth', 'Set anchor bolts per drawing', 'Pour concrete to spec (3000 PSI min)', 'Cure 72 hours before erection'] },
      { title: 'Phase 3 — Erection', items: ['Inspect all sections before lifting', 'Torque all bolts per spec table', 'Verify plumb ± 0.1° per section', 'Install climbing pegs at 18" intervals'] },
    ]
  },
};

function ArtifactSheet({ artifact, onClose }) {
  const content = ARTIFACT_CONTENT[artifact?.name];
  return (
    <div className="p-4 pb-8">
      <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <FileText className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">{artifact?.name}</h3>
            <p className="text-[11px] text-slate-400">{artifact?.type} · {artifact?.size} · {artifact?.tag}</p>
          </div>
        </div>
        <button onClick={onClose} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
          <X className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      {content ? (
        <div className="space-y-4">
          {content.sections.map((sec, i) => (
            <div key={i}>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{sec.title}</p>
              <div className="space-y-1.5">
                {sec.items.map((item, j) => (
                  <div key={j} className="flex items-center gap-2.5 px-3 py-2.5 bg-white rounded-xl border border-slate-100">
                    <div className="h-5 w-5 rounded-full border-2 border-slate-200 flex items-center justify-center flex-shrink-0">
                      <div className="h-2.5 w-2.5 rounded-full bg-slate-100" />
                    </div>
                    <span className="text-sm text-slate-700 font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-slate-400">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-semibold">Document preview unavailable</p>
          <p className="text-xs mt-1">Tap Download to open in your PDF viewer</p>
        </div>
      )}

      <button
        onClick={() => { toast.success(`Downloading ${artifact?.name}…`); onClose(); }}
        className="w-full h-12 rounded-2xl bg-slate-900 text-white font-bold text-sm mt-5 flex items-center justify-center gap-2"
      >
        <Download className="h-4 w-4" /> Download PDF
      </button>
    </div>
  );
}

export default function Support() {
  const [tab, setTab] = useState('help');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [openArtifact, setOpenArtifact] = useState(null);
  const deviceId = getOrCreateDeviceId();
  const queryClient = useQueryClient();

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const { data: syncItems = [] } = useQuery({
    queryKey: ['sync-queue-all'],
    queryFn: () => base44.entities.SyncQueue.list('-created_date', 100),
    refetchInterval: 5000,
  });

  const failedCount  = syncItems.filter(s => s.status === 'failed').length;
  const pendingCount = syncItems.filter(s => ['pending','in_progress'].includes(s.status)).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 pt-14 pb-28">

        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Support</h1>
          <p className="text-xs text-slate-400 mt-0.5">Help, diagnostics & emergency contacts</p>
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold',
            isOnline ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'
          )}>
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isOnline ? 'All systems operational' : 'Offline'}
          </div>
          {failedCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-red-50 border-red-200 text-xs font-bold text-red-700">
              <XCircle className="h-3 w-3" /> {failedCount} failed
            </div>
          )}
          {pendingCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-blue-50 border-blue-200 text-xs font-bold text-blue-700">
              <Clock className="h-3 w-3" /> {pendingCount} syncing
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex bg-white rounded-2xl border border-slate-100 p-1 gap-1 mb-4">
          {TABS.map(t => {
            const Icon = t.Icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn('flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-bold transition-all',
                  active ? 'bg-slate-900 text-white' : 'text-slate-500'
                )}>
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                {t.id === 'diag' && failedCount > 0 && (
                  <span className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-red-400' : 'bg-red-500')} />
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {tab === 'help'    && <HelpCenter onOpenArtifact={setOpenArtifact} />}
        {tab === 'diag'    && <DiagnosticsSection isOnline={isOnline} syncItems={syncItems} deviceId={deviceId} queryClient={queryClient} />}
        {tab === 'contact' && <ContactSection />}
      </div>

      {/* Artifact viewer sheet */}
      <Sheet open={!!openArtifact} onOpenChange={v => !v && setOpenArtifact(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto pb-safe">
          <ArtifactSheet artifact={openArtifact} onClose={() => setOpenArtifact(null)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}