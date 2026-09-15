'use client';

/* 전력거래 멀티채팅 — SPC 허브형 상대별 스레드.
 * threads 가 2개 이상이면(SPC) 탭으로 분리, 1개면(수용가/발전사) 단일 스레드. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { getTradingChat, sendTradingChat, type TradingChatMessage } from '@/api/trading/trading';

export interface ChatThread {
  counterpartyCompanyId: number;
  label: string;
}

export function TradingChatPanel({ requestId, threads }: { requestId: number; threads: ChatThread[] }) {
  const user = useAuthStore((s) => s.user);
  const [activeCp, setActiveCp] = useState<number | null>(threads[0]?.counterpartyCompanyId ?? null);
  const [messages, setMessages] = useState<TradingChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<Client | null>(null);

  // 상대 companyId 기준 중복 제거 (데이터에 0/중복이 와도 key 충돌 방지)
  const uniqueThreads = useMemo(() => {
    const seen = new Set<number>();
    return threads.filter((t) => {
      if (seen.has(t.counterpartyCompanyId)) return false;
      seen.add(t.counterpartyCompanyId);
      return true;
    });
  }, [threads]);

  // 스레드 목록이 바뀌고 active가 없으면 첫 스레드 선택
  useEffect(() => {
    if (activeCp == null && threads[0]) setActiveCp(threads[0].counterpartyCompanyId);
  }, [threads, activeCp]);

  // 히스토리 로드
  useEffect(() => {
    if (!requestId || activeCp == null) return;
    let alive = true;
    getTradingChat(requestId, activeCp)
      .then((res) => {
        if (!alive) return;
        const list = Array.isArray((res as any)?.content) ? (res as any).content : [];
        setMessages([...list].reverse()); // 최신 desc → 오름차순
      })
      .catch(() => alive && setMessages([]));
    return () => {
      alive = false;
    };
  }, [requestId, activeCp]);

  // 실시간 구독 (STOMP)
  useEffect(() => {
    if (!requestId || activeCp == null) return;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    const client = new Client({
      brokerURL: `${protocol}://${host}/ws`,
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        client.subscribe(`/topic/trading/${requestId}/${activeCp}`, (frame) => {
          try {
            const msg: TradingChatMessage = JSON.parse(frame.body);
            setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          } catch {
            /* ignore */
          }
        });
      },
    });
    clientRef.current = client;
    client.activate();
    return () => {
      client.deactivate();
      clientRef.current = null;
    };
  }, [requestId, activeCp]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async () => {
    const text = input.trim();
    if (!text || activeCp == null) return;
    setInput('');
    setSending(true);
    try {
      const saved = await sendTradingChat(requestId, { counterpartyCompanyId: activeCp, content: text });
      setMessages((prev) => (prev.some((m) => m.id === saved.id) ? prev : [...prev, saved]));
    } catch {
      setInput(text); // 실패 시 복원
    } finally {
      setSending(false);
    }
  };

  const myId = user?.id;
  const activeLabel = useMemo(
    () => threads.find((t) => t.counterpartyCompanyId === activeCp)?.label ?? '협의',
    [threads, activeCp],
  );

  return (
    <div className="flex flex-col rounded-xl bg-surface-card ring-1 ring-white/[0.08] overflow-hidden h-[560px]">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <h3 className="text-sm font-semibold text-white">협의 채팅</h3>
      </div>

      {/* 상대별 탭 (SPC 등 스레드 2개 이상일 때) */}
      {uniqueThreads.length > 1 && (
        <div className="flex gap-1 px-2 pt-2 flex-wrap">
          {uniqueThreads.map((t, i) => (
            <button
              key={`${t.counterpartyCompanyId}-${i}`}
              type="button"
              onClick={() => setActiveCp(t.counterpartyCompanyId)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs transition-colors',
                t.counterpartyCompanyId === activeCp
                  ? 'bg-primary/20 text-primary ring-1 ring-primary/40'
                  : 'text-slate-400 hover:bg-white/[0.05]',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.length === 0 ? (
          <p className="text-xs text-slate-500 text-center mt-8">{activeLabel} 대화를 시작하세요</p>
        ) : (
          messages.map((m) => {
            const mine = myId != null && m.senderId === myId;
            return (
              <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[80%]', mine ? 'items-end' : 'items-start')}>
                  {!mine && <p className="text-[10px] text-slate-500 mb-0.5">{m.senderName}</p>}
                  <div
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm',
                      mine ? 'bg-primary/20 text-white' : 'bg-white/[0.06] text-slate-200',
                    )}
                  >
                    {m.content}
                  </div>
                  <p className="text-[10px] text-slate-600 mt-0.5">{m.createdAt?.slice(11, 16)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* 입력 */}
      <div className="border-t border-white/[0.06] p-2 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="메시지 입력..."
          className="flex-1 h-9 rounded-md bg-white/[0.04] ring-1 ring-white/[0.06] px-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-primary"
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !input.trim()}
          className="h-9 w-9 shrink-0 flex items-center justify-center rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-40 transition-colors"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
