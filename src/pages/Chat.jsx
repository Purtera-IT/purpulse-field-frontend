/**
 * Chat page — job-threaded messaging hub
 */
import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isToday, isYesterday } from 'date-fns';
import { Send, Paperclip, ChevronLeft, MessageCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MOCK_CHAT_THREADS, MOCK_CHAT_MESSAGES } from '@/lib/mockData';

function relativeDate(iso) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
}

// ── Thread list ──────────────────────────────────────────────────
function ThreadList({ threads, onSelect }) {
  return (
    <div className="flex-1 overflow-y-auto">
      {threads.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <MessageCircle className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm font-semibold">No messages yet</p>
          <p className="text-xs mt-1">Job threads appear here when dispatchers message you</p>
        </div>
      )}
      {threads.map(thread => (
        <button
          key={thread.id}
          onClick={() => onSelect(thread)}
          className="w-full flex items-start gap-3 px-4 py-3.5 border-b border-slate-100 hover:bg-slate-50 active:bg-slate-100 text-left transition-colors"
          aria-label={`Thread: ${thread.job_title}, last message from ${thread.last_sender}`}
        >
          {/* Avatar */}
          <div className={cn(
            'h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-sm font-black',
            thread.job_id ? 'bg-slate-900 text-white' : 'bg-blue-600 text-white'
          )}>
            {thread.job_title.slice(0, 2).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-900 truncate">{thread.job_title}</p>
              <span className="text-[10px] text-slate-400 flex-shrink-0">{relativeDate(thread.last_at)}</span>
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              <span className="font-semibold text-slate-600">{thread.last_sender}: </span>
              {thread.last_message}
            </p>
          </div>

          {thread.unread > 0 && (
            <span className="h-5 min-w-5 px-1.5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
              {thread.unread}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Message bubble ───────────────────────────────────────────────
function Bubble({ msg }) {
  const isMe = msg.is_me;
  return (
    <div className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[78%] rounded-2xl px-3.5 py-2.5',
        isMe ? 'bg-slate-900 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
      )}>
        {!isMe && (
          <p className="text-[10px] font-bold text-blue-600 mb-1">{msg.sender_name}</p>
        )}
        <p className="text-sm leading-relaxed">{msg.body}</p>
        <p className={cn('text-[10px] mt-1 text-right', isMe ? 'text-white/50' : 'text-slate-400')}>
          {format(new Date(msg.sent_at), 'HH:mm')}
        </p>
      </div>
    </div>
  );
}

// ── Thread view ──────────────────────────────────────────────────
function ThreadView({ thread, onBack }) {
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState(MOCK_CHAT_MESSAGES[thread.id] || []);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = () => {
    if (!draft.trim()) return;
    setMessages(prev => [...prev, {
      id: `msg-${Date.now()}`,
      sender_name: 'You',
      sender_email: 'me',
      body: draft.trim(),
      sent_at: new Date().toISOString(),
      is_me: true,
    }]);
    setDraft('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-white flex-shrink-0">
        <button onClick={onBack} className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center" aria-label="Back to threads">
          <ChevronLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">{thread.job_title}</p>
          {thread.job_id && <p className="text-[10px] text-slate-400">Job thread</p>}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
        {messages.length === 0 && (
          <p className="text-center text-xs text-slate-400 py-8">Start the conversation</p>
        )}
        {messages.map(msg => <Bubble key={msg.id} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 bg-white border-t border-slate-100 px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <div className="flex items-end gap-2">
          <button className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0" aria-label="Attach file">
            <Paperclip className="h-4 w-4 text-slate-500" />
          </button>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Type a message…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 max-h-32"
            style={{ minHeight: 40 }}
            aria-label="Message input"
          />
          <button
            onClick={send}
            disabled={!draft.trim()}
            className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0 disabled:opacity-30 active:scale-95 transition-transform"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────
export default function Chat() {
  const [activeThread, setActiveThread] = useState(null);

  return (
    <div className="flex flex-col h-[calc(100vh-112px)]">
      {activeThread ? (
        <ThreadView thread={activeThread} onBack={() => setActiveThread(null)} />
      ) : (
        <>
          <div className="px-4 pt-4 pb-2 flex-shrink-0">
            <h2 className="text-xl font-black text-slate-900">Messages</h2>
            <p className="text-xs text-slate-400 mt-0.5">{MOCK_CHAT_THREADS.reduce((a, t) => a + t.unread, 0)} unread</p>
          </div>
          <ThreadList threads={MOCK_CHAT_THREADS} onSelect={setActiveThread} />
        </>
      )}
    </div>
  );
}