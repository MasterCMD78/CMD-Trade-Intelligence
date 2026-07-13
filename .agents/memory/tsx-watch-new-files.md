---
name: tsx watch and newly-added source files
description: A dev workflow using `tsx watch` can serve a stale response shape after new files are added to the module graph, even though it appears to be running.
---

Observed on the api-server dev workflow (`tsx watch` via the `dev` script): after adding several new source files that a route/engine begins importing (e.g. a new `analysis/news/` module wired into `analysis/engine.ts`), the live server kept responding without the new field in its JSON output — even though `tsc --noEmit` was clean and the code was correct.

**Why:** file-watching restart triggers can behave inconsistently when the *set* of imported files changes (new modules added to the graph) versus when an already-watched file's contents change. The exact cause wasn't confirmed, but restarting the workflow immediately fixed it.

**How to apply:** after adding new files that get imported into an already-running `tsx watch`/similar dev server, restart the workflow explicitly and re-verify the live response before trusting hot-reload — don't assume file-watching alone caught the change.
