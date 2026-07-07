---
name: Storage hardening for sandboxed iframe contexts
description: localStorage can throw SecurityError in Replit preview iframes; all access must go through a safe wrapper to prevent React tree crashes.
---

## Rule
Never call `localStorage.getItem/setItem/removeItem` directly in React components or hooks. Always use `src/lib/storage.ts` which wraps all access in try/catch and tests availability once at module load.

**Why:** The Replit preview pane is an iframe. In some configurations (private mode, browser settings, or sandboxed iframes) `localStorage` throws a `SecurityError`. An unhandled error inside `useEffect` or at module load time causes the React tree to fail to mount entirely, leaving a blank white page with no error visible to the user.

**How to apply:**
- `storage.get(key)` → replaces `localStorage.getItem(key)`
- `storage.set(key, value)` → replaces `localStorage.setItem(key, value)`
- `storage.remove(key)` → replaces `localStorage.removeItem(key)`
- `storage.clear(...keys)` → bulk remove
- `storage.available` → boolean, checked once on load

## Related patterns
- `AuthProvider` uses `try/finally` so `setIsReady(true)` is ALWAYS called even if storage throws — prevents permanent loading state.
- Replace `if (!isReady) return null` with a loading screen component — returning null causes a white flash AND can leave the page blank if effects never fire.
- `useMarketWebSocket` reads the token via `storage.get('cmd_token')`.
