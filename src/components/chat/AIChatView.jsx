/**
 * AIChatView — Purpulse AI job assistant chat.
 * Streaming-style responses with job context suggestions.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { base44 } from '@/api/base44Client';
import { MOCK_AI_MESSAGES } from '../../lib/mockChatData';

const QUICK_PROMPTS = [
  "What torque specs apply here?",
  "How do I log a scope change?",
  "Closest hardware supplier?",
  "Safety checklist for this phase",
];

function AIBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={cn('flex gap-2.5', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="h-7 w-7 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
      )}
      <div className={cn(
        'max-w-[82%] rounded-2xl px-3.5 py-2.5',
        isUser
          ? 'bg-slate-900 text-white rounded-br-sm'
          : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'
      )}>
        {isUser ? (
          <p className="text-sm leading-relaxed">{msg.content}</p>
        ) : (
          <div className="text-sm leading-relaxed prose prose-sm max-w-none prose-slate
            [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>ul]:ml-4 [&>ol]:ml-4
            [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        )}
        <p className={cn('text-[10px] mt-1.5', isUser ? 'text-white/50 text-right' : 'text-slate-400')}>
          {format(new Date(msg.sent_at), 'HH:mm')}
        </p>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-2.5 justify-start">
      <div className="h-7 w-7 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center flex-shrink-0">
        <Sparkles className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-1.5 w-1.5 rounded-full bg-slate-400 motion-safe:animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AIChatView({ job }) {
  const [messages, setMessages] = useState(MOCK_AI_MESSAGES);
  const [draft,    setDraft]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text) => {
    const content = text || draft.trim();
    if (!content || loading) return;
    setDraft('');

    const userMsg = { id: `u-${Date.now()}`, role: 'user', content, sent_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const jobContext = job
        ? `Job: "${job.title}" at ${job.site_name}. Current task: ${job.current_task}. Status: ${job.status}.`
        : '';
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Purpulse, a field technician job assistant. Be concise and practical. ${jobContext}\n\nTechnician asks: ${content}`,
      });
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`, role: 'assistant',
        content: typeof result === 'string' ? result : result?.response || "I couldn't get a response right now.",
        sent_at: new Date().toISOString(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: `ai-err-${Date.now()}`, role: 'assistant',
        content: "I'm having trouble connecting right now. Try again in a moment.",
        sent_at: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
        {/* Quick prompts at top */}
        {messages.length <= 1 && (
          <div className="space-y-2 mb-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Suggested questions</p>
            {QUICK_PROMPTS.map((q, i) => (
              <button key={i} onClick={() => send(q)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 font-medium active:bg-slate-50 text-left">
                {q}
                <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        {messages.map(msg => <AIBubble key={msg.id} msg={msg} />)}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 bg-white border-t border-slate-100 px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask anything about this job…"
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 max-h-28"
            style={{ minHeight: 44 }}
          />
          <button
            onClick={() => send()}
            disabled={!draft.trim() || loading}
            className="h-11 w-11 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 text-white flex items-center justify-center flex-shrink-0 disabled:opacity-30 active:scale-95 transition-transform"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}