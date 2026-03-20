import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function ChatView({ jobId }) {
  const [message, setMessage] = useState('');
  const scrollRef = useRef(null);
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chat-messages', jobId],
    queryFn: () => base44.entities.ChatMessage.filter({ job_id: jobId }, 'created_date'),
    refetchInterval: 4000,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useMutation({
    mutationFn: async (body) => {
      return base44.entities.ChatMessage.create({
        job_id: jobId,
        thread_id: jobId,
        client_message_id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        sender_email: currentUser?.email || '',
        sender_name: currentUser?.full_name || 'Technician',
        body,
        sent_at: new Date().toISOString(),
        sync_status: 'pending',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', jobId] });
      setMessage('');
    },
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessage.mutate(message.trim());
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            No messages yet. Start the conversation.
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_email === currentUser?.email || msg.created_by === currentUser?.email;
            return (
              <div key={msg.id} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[80%] rounded-2xl px-3.5 py-2.5',
                  isOwn ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'
                )}>
                  {!isOwn && (
                    <p className="text-xs font-medium text-slate-500 mb-0.5">{msg.sender_name || 'User'}</p>
                  )}
                  <p className="text-sm leading-relaxed">{msg.body}</p>
                  {msg.attachments?.map((att, i) => (
                    att.file_url && (
                      <img key={i} src={att.file_url} alt="attachment" className="mt-2 rounded-lg max-h-40 object-cover" />
                    )
                  ))}
                  <div className={cn(
                    'flex items-center gap-1.5 mt-1',
                    isOwn ? 'justify-end' : 'justify-start'
                  )}>
                    <span className={cn('text-xs', isOwn ? 'text-white/40' : 'text-slate-400')}>
                      {msg.sent_at ? format(new Date(msg.sent_at), 'h:mm a') : ''}
                    </span>
                    {msg.sync_status === 'pending' && (
                      <span className="text-xs text-amber-400">●</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-100 p-3 bg-white">
        <div className="flex items-center gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="rounded-full bg-slate-50 border-0 focus-visible:ring-1"
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          />
          <Button
            size="icon"
            className="rounded-full bg-slate-900 hover:bg-slate-800 h-10 w-10 flex-shrink-0"
            onClick={handleSend}
            disabled={!message.trim() || sendMessage.isPending}
          >
            {sendMessage.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}