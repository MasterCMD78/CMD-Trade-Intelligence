/**
 * WebSocketManager
 *
 * Manages WebSocket connections for real-time market data streaming.
 *
 * Architecture:
 *   - Clients must authenticate via a JWT Bearer token passed in the
 *     `Authorization` header OR as a `?token=<jwt>` query parameter on upgrade.
 *   - After connecting, clients send subscription messages to join named channels.
 *   - Channel naming convention: "<type>:<symbol>[:<timeframe>]"
 *     e.g. "tick:EURUSD", "candle:BTCUSDT:1H"
 *   - Channels are pruned from the internal map when their last subscriber leaves.
 *   - A keep-alive ping is sent every 30 s; clients that do not pong within 15 s
 *     are terminated.
 *
 * Streaming hooks:
 *   Call setStreamingHooks(onActive, onInactive) before attach() to be notified
 *   when a tick channel gains its first subscriber (→ start the provider stream)
 *   or loses its last subscriber (→ stop the provider stream).  This bridges the
 *   WS subscription layer with the market data provider without creating a
 *   circular dependency between the two modules.
 */

import { WebSocket, WebSocketServer } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { URL } from "url";
import { verifyAccessToken } from "../utils/tokens.js";

// ─── Message types ────────────────────────────────────────────────────────────

export type WsMessageType =
  | "subscribe"
  | "unsubscribe"
  | "ping"
  | "pong"
  | "snapshot"
  | "tick"
  | "candle"
  | "error"
  | "ack";

export interface WsMessage {
  type: WsMessageType;
  channel?: string;
  data?: unknown;
  error?: string;
  timestamp?: string;
}

// ─── Channel naming helpers ───────────────────────────────────────────────────

export const WsChannels = {
  tick(symbol: string): string {
    return `tick:${symbol.toUpperCase()}`;
  },
  candle(symbol: string, timeframe: string): string {
    return `candle:${symbol.toUpperCase()}:${timeframe}`;
  },
} as const;

// ─── Streaming hooks ──────────────────────────────────────────────────────────

/**
 * Called when a channel transitions:
 *   onActive  — 0 → 1 subscribers  (start provider stream)
 *   onInactive — 1 → 0 subscribers (stop  provider stream)
 */
type ChannelHook = (channel: string) => void;

// ─── Internal client state ────────────────────────────────────────────────────

interface ClientState {
  id: string;
  userId: number;
  ws: WebSocket;
  subscriptions: Set<string>;
  connectedAt: Date;
  /** Set when a ping is sent; cleared on pong. Non-null = waiting for pong. */
  pendingPongSince: number | null;
}

// ─── Manager ──────────────────────────────────────────────────────────────────

/** How long (ms) a client has to respond to a ping before being terminated. */
const PONG_TIMEOUT_MS = 15_000;

/** Maximum number of channel subscriptions a single client may hold at once. */
const MAX_SUBS_PER_CLIENT = 50;

/** Valid timeframe values — kept in sync with Timeframe enum in types.ts. */
const VALID_TIMEFRAMES = new Set(["1M", "5M", "15M", "30M", "1H", "4H", "1D", "1W"]);

/**
 * Validate a subscription channel string.
 * Valid forms:
 *   tick:<SYMBOL>                   — e.g. "tick:EURUSD"
 *   candle:<SYMBOL>:<TIMEFRAME>     — e.g. "candle:BTCUSDT:1H"
 *
 * SYMBOL: 3–12 uppercase alphanumeric characters.
 * TIMEFRAME: one of the known Timeframe enum values.
 *
 * This prevents authenticated clients from inflating the server's channelSubscribers
 * map with arbitrary strings (memory-based DoS vector).
 */
function validateChannel(channel: string): { valid: true } | { valid: false; error: string } {
  const parts = channel.split(":");
  if (parts.length < 2) {
    return { valid: false, error: "Invalid channel format. Use tick:<SYMBOL> or candle:<SYMBOL>:<TIMEFRAME>" };
  }

  const [type, symbol, timeframe] = parts;

  if (!/^[A-Z0-9]{3,12}$/.test(symbol ?? "")) {
    return { valid: false, error: "Invalid symbol format. Must be 3–12 uppercase alphanumeric characters" };
  }

  if (type === "tick") {
    if (parts.length !== 2) {
      return { valid: false, error: "Tick channel format: tick:<SYMBOL>" };
    }
    return { valid: true };
  }

  if (type === "candle") {
    if (parts.length !== 3) {
      return { valid: false, error: "Candle channel format: candle:<SYMBOL>:<TIMEFRAME>" };
    }
    if (!VALID_TIMEFRAMES.has(timeframe ?? "")) {
      return { valid: false, error: `Invalid timeframe '${timeframe}'. Must be one of: ${[...VALID_TIMEFRAMES].join(", ")}` };
    }
    return { valid: true };
  }

  return { valid: false, error: `Unknown channel type '${type}'. Must be 'tick' or 'candle'` };
}

export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients = new Map<string, ClientState>();
  /** channel → Set of client IDs. Empty channels are removed immediately. */
  private channelSubscribers = new Map<string, Set<string>>();

  private nextClientId = 1;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  /** Optional hooks fired on first/last subscriber transitions. */
  private onChannelActive: ChannelHook | null = null;
  private onChannelInactive: ChannelHook | null = null;

  // ─── Streaming bridge ────────────────────────────────────────────────────────

  /**
   * Register callbacks to bridge WS subscriptions with the market data provider.
   * Must be called before attach().
   *
   * onActive  — fired when a channel goes from 0 → 1 subscribers.
   * onInactive — fired when a channel goes from 1 → 0 subscribers.
   */
  setStreamingHooks(onActive: ChannelHook, onInactive: ChannelHook): void {
    this.onChannelActive = onActive;
    this.onChannelInactive = onInactive;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  /** Attach the manager to an existing HTTP server. */
  attach(server: Server): void {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      void this.handleConnection(ws, req);
    });

    // Keep-alive: ping every 30 s, terminate if no pong within 15 s.
    this.pingInterval = setInterval(() => this.pingAll(), 30_000);
  }

  /** Graceful shutdown. */
  close(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);

    // Fire onInactive for all live channels so the provider can clean up.
    for (const channel of this.channelSubscribers.keys()) {
      this.onChannelInactive?.(channel);
    }

    for (const client of this.clients.values()) {
      client.ws.terminate();
    }
    this.clients.clear();
    this.channelSubscribers.clear();
    this.wss?.close();
  }

  // ─── Outbound broadcast ─────────────────────────────────────────────────────

  /** Broadcast a message to all clients subscribed to a given channel. */
  broadcast(channel: string, message: WsMessage): void {
    const subscribers = this.channelSubscribers.get(channel);
    if (!subscribers || subscribers.size === 0) return;

    const payload = JSON.stringify({ ...message, channel, timestamp: new Date().toISOString() });

    for (const clientId of subscribers) {
      const client = this.clients.get(clientId);
      if (client?.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  /** Broadcast to every connected client (system messages). */
  broadcastAll(message: WsMessage): void {
    const payload = JSON.stringify({ ...message, timestamp: new Date().toISOString() });
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  // ─── Stats ──────────────────────────────────────────────────────────────────

  getStats() {
    return {
      connections:  this.clients.size,
      channels:     this.channelSubscribers.size,
      subscriptions: [...this.channelSubscribers.values()].reduce((n, s) => n + s.size, 0),
    };
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  private async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    // ── Authentication ────────────────────────────────────────────────────────
    const token = this.extractToken(req);

    if (!token) {
      this.sendRaw(ws, { type: "error", error: "Unauthorized: provide a Bearer token in the Authorization header or ?token= query parameter" });
      ws.close(4001, "Unauthorized");
      return;
    }

    let userId: number;
    try {
      const payload = verifyAccessToken(token);
      userId = payload.userId;
    } catch {
      this.sendRaw(ws, { type: "error", error: "Unauthorized: invalid or expired token" });
      ws.close(4001, "Unauthorized");
      return;
    }

    // ── Register client ───────────────────────────────────────────────────────
    const id = `client_${this.nextClientId++}`;
    const state: ClientState = {
      id,
      userId,
      ws,
      subscriptions:    new Set(),
      connectedAt:      new Date(),
      pendingPongSince: null,
    };
    this.clients.set(id, state);

    this.sendRaw(ws, {
      type: "ack",
      data: { clientId: id, message: "Connected to CMD Trade Intelligence market feed" },
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WsMessage;
        this.handleMessage(state, msg);
      } catch {
        this.sendRaw(ws, { type: "error", error: "Invalid JSON" });
      }
    });

    ws.on("pong", () => {
      state.pendingPongSince = null; // client responded — clear timeout marker
    });

    ws.on("close", () => this.removeClient(id));
    ws.on("error", () => this.removeClient(id));
  }

  private handleMessage(client: ClientState, msg: WsMessage): void {
    switch (msg.type) {
      case "ping":
        this.sendRaw(client.ws, { type: "pong" });
        break;

      case "subscribe":
        if (msg.channel) this.subscribe(client, msg.channel);
        break;

      case "unsubscribe":
        if (msg.channel) this.unsubscribe(client, msg.channel);
        break;

      default:
        this.sendRaw(client.ws, { type: "error", error: `Unknown message type: ${msg.type}` });
    }
  }

  private subscribe(client: ClientState, channel: string): void {
    // Validate channel format before accepting the subscription.
    const validation = validateChannel(channel);
    if (!validation.valid) {
      this.sendRaw(client.ws, { type: "error", error: validation.error });
      return;
    }

    // Enforce per-client subscription cap to prevent memory exhaustion.
    if (!client.subscriptions.has(channel) && client.subscriptions.size >= MAX_SUBS_PER_CLIENT) {
      this.sendRaw(client.ws, {
        type: "error",
        error: `Subscription limit reached (max ${MAX_SUBS_PER_CLIENT} channels per connection)`,
      });
      return;
    }

    // Determine whether this is the first subscriber (used to fire onActive).
    const existing = this.channelSubscribers.get(channel);
    const isFirstSubscriber = !existing || existing.size === 0;

    client.subscriptions.add(channel);

    if (!this.channelSubscribers.has(channel)) {
      this.channelSubscribers.set(channel, new Set());
    }
    this.channelSubscribers.get(channel)!.add(client.id);

    // Notify the streaming bridge that this channel is now active.
    if (isFirstSubscriber) {
      this.onChannelActive?.(channel);
    }

    this.sendRaw(client.ws, {
      type: "ack",
      channel,
      data: { message: `Subscribed to ${channel}` },
    });
  }

  private unsubscribe(client: ClientState, channel: string): void {
    client.subscriptions.delete(channel);
    this.pruneClientFromChannel(client.id, channel);

    this.sendRaw(client.ws, {
      type: "ack",
      channel,
      data: { message: `Unsubscribed from ${channel}` },
    });
  }

  private removeClient(id: string): void {
    const client = this.clients.get(id);
    if (!client) return;

    for (const channel of client.subscriptions) {
      this.pruneClientFromChannel(id, channel);
    }
    this.clients.delete(id);
  }

  /**
   * Remove a client from a channel's subscriber set.
   * Fires onInactive if the channel becomes empty.
   */
  private pruneClientFromChannel(clientId: string, channel: string): void {
    const subs = this.channelSubscribers.get(channel);
    if (!subs) return;

    subs.delete(clientId);

    if (subs.size === 0) {
      // Prune empty channel entries to prevent unbounded map growth.
      this.channelSubscribers.delete(channel);
      // Notify the streaming bridge that this channel is now inactive.
      this.onChannelInactive?.(channel);
    }
  }

  private pingAll(): void {
    const now = Date.now();
    for (const client of this.clients.values()) {
      if (client.ws.readyState !== WebSocket.OPEN) {
        this.removeClient(client.id);
        continue;
      }

      if (client.pendingPongSince !== null) {
        // Client did not respond to the previous ping within the timeout window.
        if (now - client.pendingPongSince >= PONG_TIMEOUT_MS) {
          client.ws.terminate();
          this.removeClient(client.id);
        }
        continue;
      }

      client.pendingPongSince = now;
      client.ws.ping();
    }
  }

  private sendRaw(ws: WebSocket, message: WsMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ ...message, timestamp: new Date().toISOString() }));
    }
  }

  /** Extract Bearer token from Authorization header or ?token= query param. */
  private extractToken(req: IncomingMessage): string | null {
    const authHeader = req.headers["authorization"];
    if (authHeader?.startsWith("Bearer ")) {
      return authHeader.slice(7);
    }

    try {
      // Node's URL constructor needs an absolute URL; use a dummy base.
      const url = new URL(req.url ?? "/", "http://localhost");
      const token = url.searchParams.get("token");
      if (token) return token;
    } catch {
      // Malformed URL — fall through
    }

    return null;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const wsManager = new WebSocketManager();
