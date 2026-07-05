---
name: Orval codegen workflow
description: How to regenerate API clients from the OpenAPI spec in this monorepo
---

Run from the spec directory, not from root:

```bash
cd lib/api-spec && npx orval --config orval.config.ts
```

There is no npm/pnpm script alias for codegen at the workspace root or in any package.json.
Regenerates both `lib/api-client-react/src/generated/` and `lib/api-zod/src/generated/`.
Must re-run whenever `lib/api-spec/openapi.yaml` changes.

**Why:** Orval config uses `__dirname`-relative paths that only resolve correctly when run from `lib/api-spec/`.
