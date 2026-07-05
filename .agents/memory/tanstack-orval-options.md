---
name: TanStack Query v5 + Orval options typing
description: Typing issue when passing partial query options to Orval-generated hooks
---

## The problem

Orval-generated hooks (TanStack Query v5) type the `options.query` parameter as the full
`UseQueryOptions<...>` which in v5 requires `queryKey` as a non-optional field. Passing
a partial `{ refetchInterval, enabled }` object triggers TS2741.

## Fix

Cast with `as any` at the call site:

```tsx
useGetMarketQuote(symbol, { query: { refetchInterval: 30_000, enabled: !!symbol } as any })
```

**Why:** The generated `getGetXQueryOptions()` always supplies `queryKey` automatically, so the
runtime behavior is correct — this is purely a TypeScript structural mismatch between what
Orval generates (full `UseQueryOptions`) and what callers actually need to supply (partial override).

**How to apply:** Suppress with `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
on the line before the hook call, then `as any` on the options object.
