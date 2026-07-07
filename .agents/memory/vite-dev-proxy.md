---
name: Vite dev proxy for API and WebSocket
description: Add server.proxy in vite.config.ts so /api and /ws calls work both through Replit reverse proxy AND when hitting Vite directly.
---

## Rule
`artifacts/cmd-trade/vite.config.ts` has a `server.proxy` block forwarding `/api` to `http://localhost:8080` and `/ws` to `ws://localhost:8080` (with `ws: true`).

**Why:** The Replit reverse proxy routes `/api/*` and `/ws` to port 8080 at the network level, but the Vite dev server itself doesn't know about this. Without the proxy, `fetch('/api/...')` from the browser would hit the Vite server and get a 404 in some access patterns (e.g. direct localhost access during development or curl tests against the Vite port).

**How to apply:**
```ts
server: {
  proxy: {
    '/api': { target: 'http://localhost:8080', changeOrigin: true },
    '/ws':  { target: 'ws://localhost:8080', ws: true, changeOrigin: true },
  },
}
```
This is development-only (not present in `preview` config or production build).
