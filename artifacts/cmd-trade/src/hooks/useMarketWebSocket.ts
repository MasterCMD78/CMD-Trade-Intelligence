import { useEffect, useRef, useCallback, useState } from 'react';
import { storage } from '@/lib/storage';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TickData {
  symbol: string;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  change24h: number;
  changePct24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: string;
  source: string;
}

export type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface WsMessage {
  type: string;
  channel?: string;
  data?: unknown;
  timestamp?: string;
}

type TickMap = Record<string, TickData>;

// ── Constants ─────────────────────────────────────────────────────────────────

const RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_ATTEMPTS = 5;

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Connects to the CMD Trade WebSocket market feed and maintains subscriptions
 * for the given symbols. Returns a map of symbol → latest tick data and the
 * current connection status.
 *
 * Symbols added are subscribed automatically; symbols removed are unsubscribed
 * and their stale ticks are pruned from the returned map.
 *
 * @param symbols  List of symbols to subscribe to (e.g. ["EURUSD", "BTCUSDT"])
 * @param enabled  Set to false to skip connecting (e.g. when the component is
 *                 not visible). Defaults to true.
 */
export function useMarketWebSocket(
  symbols: string[],
  enabled = true,
): { ticks: TickMap; status: WsStatus } {
  const [ticks, setTicks] = useState<TickMap>({});
  const [status, setStatus] = useState<WsStatus>('disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  const prevSymbolsRef = useRef<string[]>([]);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const sendJson = useCallback((ws: WebSocket, payload: object) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    const token = storage.get('cmd_token');
    if (!token) {
      setStatus('error');
      return;
    }

    // Resolve the WS URL — works for both local dev and Replit proxy.
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;

    setStatus('connecting');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) { ws.close(); return; }
      reconnectCount.current = 0;
      setStatus('connected');
      // Subscribe to all currently tracked symbols.
      for (const sym of prevSymbolsRef.current) {
        sendJson(ws, { type: 'subscribe', channel: `tick:${sym}` });
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg: WsMessage = JSON.parse(event.data as string);
        if (msg.type === 'tick' && msg.channel && msg.data) {
          const sym = msg.channel.replace('tick:', '');
          setTicks((prev) => ({ ...prev, [sym]: msg.data as TickData }));
        }
      } catch {
        // Ignore malformed messages.
      }
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      setStatus('disconnected');
      wsRef.current = null;

      if (reconnectCount.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectCount.current += 1;
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
      } else {
        setStatus('error');
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror; let it handle reconnection.
      setStatus('error');
    };
  }, [sendJson]);

  // ── Effect: connect / disconnect based on enabled flag ───────────────────

  useEffect(() => {
    unmountedRef.current = false;

    if (!enabled) return;

    connect();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on intentional close.
        wsRef.current.close();
        wsRef.current = null;
      }
      setStatus('disconnected');
    };
  }, [enabled, connect]);

  // ── Effect: diff symbols list and send subscribe/unsubscribe deltas ───────

  useEffect(() => {
    const ws = wsRef.current;
    const prev = new Set(prevSymbolsRef.current);
    const next = new Set(symbols);

    // Subscribe to newly added symbols.
    for (const sym of next) {
      if (!prev.has(sym) && ws && ws.readyState === WebSocket.OPEN) {
        sendJson(ws, { type: 'subscribe', channel: `tick:${sym}` });
      }
    }

    // Unsubscribe from removed symbols and prune their stale ticks.
    const removed: string[] = [];
    for (const sym of prev) {
      if (!next.has(sym)) {
        removed.push(sym);
        if (ws && ws.readyState === WebSocket.OPEN) {
          sendJson(ws, { type: 'unsubscribe', channel: `tick:${sym}` });
        }
      }
    }
    if (removed.length > 0) {
      setTicks((prev) => {
        const next = { ...prev };
        for (const sym of removed) delete next[sym];
        return next;
      });
    }

    prevSymbolsRef.current = symbols;
  }, [symbols, sendJson]);

  return { ticks, status };
}
