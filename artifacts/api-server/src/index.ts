import http from "node:http";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { wsManager } from "./market-data/index.js";

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
  wsManager.close();
  server.close(() => process.exit(0));
});
