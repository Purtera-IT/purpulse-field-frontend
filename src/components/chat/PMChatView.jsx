/**
 * PMChatView — Contact PM mode with messaging, call, escalation, and attachment actions.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  Send, Phone, AlertOctagon, Paperclip, ClipboardList,
  Camera, StickyNote, X, CheckCircle2, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { MOCK_PM_MESSAGES } from '../../lib/mockChatData';

// ── Message bubble ────────────────────────────────────────────────
function PMBubble({ msg }) {
  const isMe = msg.role === 'me';
  return (
    <div className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
      {!isMe && (
        <div className="h-7 w-7 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5 text-[11px] font-black text-white">
          {msg.sender?.slice(0, 1)}
        </div>
      )}
      <div className={cn(
        'max-w-[78%] rounded-2xl px-3.5 py-2.5',
        isMe
          ? 'bg-slate-900 text-white rounded-br-sm'
          : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'
      )}>
        {!isMe && msg.sender && (
          <p className="text-[10px] font-black text-slate-500 mb-0.5">{msg.sender}</p>
        )}
        {msg.type === 'context' ? (
          <div className="space-y-1">
            <p className="text-[10px] font-black text-emerald-400 mb-1">📋 Task Context Sent</p>
            <p className="text-xs opacity-90 leading-relaxed">{msg.content}</p>
          </div>
        ) : msg.type === 'escalation' ? (
          <div className="space-y-1">
            <p className="text-[10px] font-black text-red-400 mb-1">🚨 Blocker Escalated</p>
            <p className="text-xs opacity-90 leading-relaxed">{msg.content}</p>
          </div>
        ) : (
          <p className="text-sm leading-relaxed">{msg.content}</p>
        )}
        <p className={cn('text-[10px] mt-1.5 text-right', isMe ? 'text-white/50' : 'text-slate-400')}>
          {format(new Date(msg.sent_at), 'HH:mm')}
          {isMe && <span className="ml-1">✓✓</span>}
        </p>
      </div>
    </div>
  );
}

// ── Escalation modal ──────────────────────────────────────────────
function EscalateModal({ job, onSend, onClose }) {
  const [type,  setType]  = useState('scope_change');
  const [note,  setNote]  = useState('');
  const TYPES = [
    { v: 'scope_change',      l: 'Scope Change'     },
    { v: 'equipment_missing', l: 'Missing Equipment' },
    { v: 'safety_concern',    l: 'Safety Concern'   },
    { v: 'access_issue',      l: 'Site Access Issue' },
    { v: 'other',             l: 'Other'            },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-auto bg-white rounded-t-3xl p-5 pb-10 shadow-2xl">
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertOctagon className="h-5 w-5 text-red-600" />
            <h3 className="text-base font-black text-slate-900">Escalate Blocker</h3>
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center">
            <X className="h-3.5 w-3.5 text-slate-500" />
          </button>
        </div>
        <div className="mb-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Blocker Type</p>
          <div className="grid grid-cols-2 gap-1.5">
            {TYPES.map(t => (
              <button key={t.v} onClick={() => setType(t.v)}
                className={cn('h-9 rounded-xl border text-xs font-bold transition-all',
                  type === t.v ? 'bg-red-600 text-white border-red-600' : 'bg-white border-slate-200 text-slate-600'
                )}>
                {t.l}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Details</p>
          <textarea value={note} onChange={e => setNote(e.target.value)}
            placeholder="Describe the blocker clearly so the PM can act fast…"
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-red-300"
          />
        </div>
        <button
          onClick={() => { onSend(type, note); onClose(); }}
          disabled={!note.trim()}
          className="w-full h-12 rounded-2xl bg-red-600 text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2 active:opacity-80"
        >
          <AlertOctagon className="h-4 w-4" /> Send Escalation to PM
        </button>
      </div>
    </div>
  );
}

// ── Attachment action sheet ───────────────────────────────────────
function AttachSheet({ onAttach, onClose }) {
  const fileRef = useRef(null);
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-auto bg-white rounded-t-3xl p-5 pb-10 shadow-2xl">
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
        <p className="text-sm font-black text-slate-900 mb-4">Attach to Message</p>
        <div className="space-y-2">
          <button onClick={() => { fileRef.current?.click(); }}
            className="w-full flex items-center gap-3 h-14 px-4 rounded-xl bg-slate-900 text-white font-semibold text-sm active:opacity-80">
            <Camera className="h-5 w-5" /> Camera / Gallery
          </button>
          <button onClick={() => { onAttach('note', 'Site note attached'); onClose(); }}
            className="w-full flex items-center gap-3 h-14 px-4 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm active:bg-slate-200">
            <StickyNote className="h-5 w-5 text-slate-500" /> Attach Note
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { if (e.target.files?.[0]) { onAttach('photo', 'Photo attached'); onClose(); } }} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function PMChatView({ job, pm }) {
  const [messages,     setMessages]     = useState(MOCK_PM_MESSAGES);
  const [draft,        setDraft]        = useState('');
  const [showEscalate, setShowEscalate] = useState(false);
  const [showAttach,   setShowAttach]   = useState(false);
  const [showActions,  setShowActions]  = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const pushMsg = (extra) => {
    setMessages(prev => [...prev, {
      id: `pm-${Date.now()}`, role: 'me',
      sent_at: new Date().toISOString(),
      ...extra,
    }]);
  };

  const send = () => {
    if (!draft.trim()) return;
    pushMsg({ content: draft.trim() });
    setDraft('');
  };

  const sendContext = () => {
    const ctx = job
      ? `📍 ${job.site_name} · ${job.title}\n📋 Current task: ${job.current_task}\n🔵 Status: ${job.status}`
      : 'No active job context';
    pushMsg({ type: 'context', content: ctx });
    setShowActions(false);
  };

  const handleEscalate = (type, note) => {
    pushMsg({
      type: 'escalation',
      content: `[${type.replace(/_/g, ' ').toUpperCase()}] ${note}`,
    });
  };

  return (
    <>
      <div className="flex flex-col h-full">
        {/* PM info bar */}
        <div className="bg-white border-b border-slate-100 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center text-white text-sm font-black">
              {pm?.name?.slice(0, 1) || 'P'}
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">{pm?.name || 'Project Manager'}</p>
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-slate-400">Online</span>
              </div>
            </div>
          </div>
          {pm?.phone && (
            <a href={`tel:${pm.phone}`}
              className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold active:opacity-80">
              <Phone className="h-3.5 w-3.5" /> Call
            </a>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
          {messages.map(msg => <PMBubble key={msg.id} msg={msg} />)}
          <div ref={bottomRef} />
        </div>

        {/* Action strip */}
        <div className="flex-shrink-0 bg-white border-t border-slate-100">
          {/* Quick actions */}
          <div className="flex gap-1.5 px-3 pt-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <button onClick={() => setShowEscalate(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold whitespace-nowrap active:opacity-70 flex-shrink-0">
              <AlertOctagon className="h-3.5 w-3.5" /> Escalate
            </button>
            <button onClick={sendContext}
              className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold whitespace-nowrap active:opacity-70 flex-shrink-0">
              <ClipboardList className="h-3.5 w-3.5" /> Send Task Context
            </button>
            <button onClick={() => setShowAttach(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold whitespace-nowrap active:opacity-70 flex-shrink-0">
              <Paperclip className="h-3.5 w-3.5" /> Attach
            </button>
          </div>

          {/* Composer */}
          <div className="flex items-end gap-2 px-4 py-2 pb-[calc(8px+env(safe-area-inset-bottom))]">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={`Message ${pm?.name || 'PM'}…`}
              rows={1}
              className="flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 max-h-28"
              style={{ minHeight: 44 }}
            />
            <button
              onClick={send}
              disabled={!draft.trim()}
              className="h-11 w-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0 disabled:opacity-30 active:scale-95 transition-transform"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {showEscalate && (
        <EscalateModal job={job} onSend={handleEscalate} onClose={() => setShowEscalate(false)} />
      )}
      {showAttach && (
        <AttachSheet
          onAttach={(type, label) => { pushMsg({ content: `📎 ${label}` }); }}
          onClose={() => setShowAttach(false)}
        />
      )}
    </>
  );
}