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

/**
 * A tick is considered stale when no update has been received within this
 * window.  Set conservatively at 5 s — forex streams fire every 1 s and
 * crypto every 0.5 s, so a 5 s gap reliably indicates a stalled feed.
 */
const STALE_THRESHOLD_MS = 5_000;

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Connects to the CMD Trade WebSocket market feed and maintains subscriptions
 * for the given symbols. Returns:
 *   ticks        — map of symbol → latest tick data
 *   status       — current WebSocket connection status
 *   staleSymbols — set of symbols whose last tick is older than STALE_THRESHOLD_MS
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
): { ticks: TickMap; status: WsStatus; staleSymbols: Set<string> } {
  const [ticks, setTicks] = useState<TickMap>({});
  const [status, setStatus] = useState<WsStatus>('disconnected');
  const [staleSymbols, setStaleSymbols] = useState<Set<string>>(new Set());

  const wsRef = useRef<WebSocket | null>(null);
  const prevSymbolsRef = useRef<string[]>([]);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  /** Per-symbol staleness timers: fired when no tick arrives within STALE_THRESHOLD_MS. */
  const staleTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const sendJson = useCallback((ws: WebSocket, payload: object) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  // ── Staleness helpers ────────────────────────────────────────────────────

  /** Reset the staleness timer for a symbol when a fresh tick arrives. */
  const markFresh = useCallback((sym: string) => {
    if (staleTimers.current[sym]) clearTimeout(staleTimers.current[sym]);
    // Remove from stale set if it was there.
    setStaleSymbols((prev) => {
      if (!prev.has(sym)) return prev; // already fresh — avoid re-render
      const next = new Set(prev);
      next.delete(sym);
      return next;
    });
    // Schedule staleness detection.
    staleTimers.current[sym] = setTimeout(() => {
      setStaleSymbols((prev) => {
        const next = new Set(prev);
        next.add(sym);
        return next;
      });
    }, STALE_THRESHOLD_MS);
  }, []);

  /** Cancel and remove staleness tracking for a list of symbols. */
  const clearStaleTracking = useCallback((syms: string[]) => {
    for (const sym of syms) {
      if (staleTimers.current[sym]) {
        clearTimeout(staleTimers.current[sym]);
        delete staleTimers.current[sym];
      }
    }
    setStaleSymbols((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const sym of syms) {
        if (next.delete(sym)) changed = true;
      }
      return changed ? next : prev;
    });
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
          markFresh(sym);
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
  }, [sendJson, markFresh]);

  // ── Effect: connect / disconnect based on enabled flag ───────────────────

  useEffect(() => {
    unmountedRef.current = false;

    if (!enabled) return;

    connect();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      // Clear all stale timers to prevent setState after unmount.
      for (const timer of Object.values(staleTimers.current)) {
        clearTimeout(timer);
      }
      staleTimers.current = {};
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
      // Also cancel staleness tracking for removed symbols.
      clearStaleTracking(removed);
    }

    prevSymbolsRef.current = symbols;
  }, [symbols, sendJson, clearStaleTracking]);

  return { ticks, status, staleSymbols };
}
