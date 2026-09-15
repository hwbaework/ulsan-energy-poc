'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { useChat } from '@/hooks/consulting/useChat';
import { useChatMessages, useSendChatMessage } from '@/hooks/consulting/useConsultations';
import type { ChatMessage } from '@/api/consulting/consultations';

interface ChatPanelProps {
  consultationId: number;
  className?: string;
}

export function ChatPanel({ consultationId, className }: ChatPanelProps) {
  const user = useAuthStore((s) => s.user);
  const [input, setInput] = useState('');
  const [realtimeMessages, setRealtimeMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: chatPage, isLoading } = useChatMessages(consultationId);
  const sendMessage = useSendChatMessage();

  const handleWsMessage = useCallback((msg: ChatMessage) => {
    setRealtimeMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  const { connected } = useChat({
    consultationId,
    enabled: !!consultationId,
    onMessage: handleWsMessage,
  });

  const historicMessages = (chatPage?.content ?? []).slice().reverse();
  const historicIds = new Set(historicMessages.map((m) => m.id));
  const uniqueRealtime = realtimeMessages.filter((m) => !historicIds.has(m.id));
  const allMessages = [...historicMessages, ...uniqueRealtime];

  useEffect(() => {
    setRealtimeMessages([]);
  }, [chatPage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages.length]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    sendMessage.mutate({ consultationId, content: text });
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border border-accent/20 bg-surface-card min-h-0 overflow-hidden',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-accent/20 px-4 py-3">
        <h3 className="text-md font-semibold text-white">채팅</h3>
        <div className="flex items-center gap-1.5">
          {connected ? (
            <Wifi size={12} className="text-emerald-400" />
          ) : (
            <WifiOff size={12} className="text-slate-500" />
          )}
          <span className={cn('text-[10px]', connected ? 'text-emerald-400' : 'text-slate-500')}>
            {connected ? '연결됨' : '연결 중...'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={20} className="animate-spin text-slate-400" />
          </div>
        ) : allMessages.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-xs text-slate-500">메시지가 없습니다. 대화를 시작해보세요.</p>
          </div>
        ) : (
          allMessages.map((msg) => {
            const isMine = user?.id === msg.senderId;
            return (
              <div key={msg.id} className={cn('flex flex-col', isMine ? 'items-end' : 'items-start')}>
                {!isMine && <span className="text-[10px] text-slate-500 mb-0.5 ml-1">{msg.senderName}</span>}
                <div
                  className={cn(
                    'max-w-[75%] rounded-lg px-3 py-2 text-xs leading-relaxed',
                    isMine
                      ? 'bg-primary/20 text-primary-foreground'
                      : 'bg-white/[0.04] text-slate-300 ring-1 ring-white/[0.06]',
                  )}
                >
                  {msg.content}
                </div>
                <span className="text-[9px] text-slate-600 mt-0.5 mx-1">{formatTime(msg.createdAt)}</span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-accent/20 px-3 py-2">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요..."
            className="flex-1 h-8 rounded-md border border-accent/30 bg-surface-dark px-3 text-xs text-white placeholder:text-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            disabled={sendMessage.isPending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
              input.trim()
                ? 'bg-primary text-white hover:bg-primary/80'
                : 'bg-white/[0.04] text-slate-500 cursor-not-allowed',
            )}
          >
            {sendMessage.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
