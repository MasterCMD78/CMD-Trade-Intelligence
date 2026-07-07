import http from "node:http";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { wsManager, marketDataService } from "./market-data/index.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ─── Wire WebSocket streaming ─────────────────────────────────────────────────
//
// When the first WS client subscribes to a tick channel (e.g. "tick:EURUSD"),
// we start a provider subscription that broadcasts each tick to all channel
// subscribers.  When the last subscriber leaves, we stop the provider stream to
// avoid leaking intervals.
//
// This is the only place that couples wsManager ↔ marketDataService; both
// modules remain unaware of each other.

/** Active provider tick subscriptions keyed by WS channel name. */
const activeTickSubs = new Map<string, () => void>();

wsManager.setStreamingHooks(
  // onActive: a tick channel just got its first subscriber → start provider stream
  (channel) => {
    if (!channel.startsWith("tick:")) return;
    if (activeTickSubs.has(channel)) return; // guard against double-start

    const symbol = channel.slice(5); // strip "tick:" prefix

    const unsub = marketDataService.subscribeTicks(symbol, (tick) => {
      wsManager.broadcast(channel, {
        type: "tick",
        data: {
          symbol:       tick.symbol,
          bid:          tick.bid,
          ask:          tick.ask,
          mid:          tick.mid,
          spread:       tick.spread,
          change24h:    tick.change24h,
          changePct24h: tick.changePct24h,
          high24h:      tick.high24h,
          low24h:       tick.low24h,
          volume24h:    tick.volume24h,
          timestamp:    tick.timestamp.toISOString(),
          source:       tick.source,
        },
      });
    });

    activeTickSubs.set(channel, unsub);
    logger.debug({ channel }, "Tick stream started");
  },

  // onInactive: a tick channel just lost its last subscriber → stop provider stream
  (channel) => {
    const unsub = activeTickSubs.get(channel);
    if (unsub) {
      unsub();
      activeTickSubs.delete(channel);
      logger.debug({ channel }, "Tick stream stopped");
    }
  },
);

// ─── HTTP + WebSocket server ──────────────────────────────────────────────────

// Create a plain HTTP server so we can share it between Express and the
// WebSocket manager. app.listen() internally does this too, but we need the
// server handle before it starts listening.
const server = http.createServer(app);

// Attach the WebSocket manager to the HTTP server.
// All WS connections arrive at /ws (declared in artifact.toml paths).
wsManager.attach(server);

server.listen(port, () => {
  logger.info({ port }, "Server listening");
  logger.info({ path: "/ws" }, "WebSocket server ready");
});

server.on("error", (err) => {
  logger.error({ err }, "Error starting server");
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down");
  // wsManager.close() fires onInactive for all channels, cleaning up activeTickSubs
  wsManager.close();
  server.close(() => process.exit(0));
});
