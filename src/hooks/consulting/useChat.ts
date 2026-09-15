import { useEffect, useRef, useCallback, useState } from 'react';
import { Client } from '@stomp/stompjs';
import type { ChatMessage } from '@/api/consulting/consultations';

interface UseChatOptions {
  consultationId: number;
  enabled?: boolean;
  onMessage?: (message: ChatMessage) => void;
}

export function useChat({ consultationId, enabled = true, onMessage }: UseChatOptions) {
  const clientRef = useRef<Client | null>(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled || !consultationId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = process.env.NEXT_PUBLIC_API_URL
      ? new URL(process.env.NEXT_PUBLIC_API_URL).host
      : window.location.host;

    const client = new Client({
      brokerURL: `${protocol}://${host}/ws`,
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        setConnected(true);
        client.subscribe(`/topic/consultation/${consultationId}`, (frame) => {
          try {
            const msg: ChatMessage = JSON.parse(frame.body);
            onMessageRef.current?.(msg);
          } catch {
            /* ignore parse errors */
          }
        });
      },
      onDisconnect: () => setConnected(false),
      onStompError: () => setConnected(false),
    });

    clientRef.current = client;
    client.activate();

    return () => {
      client.deactivate();
      clientRef.current = null;
      setConnected(false);
    };
  }, [consultationId, enabled]);

  const disconnect = useCallback(() => {
    clientRef.current?.deactivate();
  }, []);

  return { connected, disconnect };
}
