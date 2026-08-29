// site-storage.ts — GH #1544 (ADR-0227 clause 2's persistence rule): the docs site's ONE shared
// `StorageAdapter` localStorage tier under the `agent-ui` namespace. The tier's whole-namespace
// contract (local-storage-adapter.ts: "the WHOLE namespace belongs to this adapter") wants a single
// owner module, so every site-shell concern that persists under `agent-ui.*` — theme-loader.ts's
// `agent-ui.theme`/`agent-ui.scheme` and _page.ts's `agent-ui.site.nav-collapsed` — reaches storage
// through THIS instance, never a raw `localStorage` touch (the state-grammar ratchet gate,
// `packages/agent-ui/shared/src/storage/state-grammar-gates.test.ts`, reds on any bypass).
//
// The return type is the SYNC-READABLE extension (ADR-0193 Amendment): `getSync` keeps the
// pre-paint hydration reads (scheme/theme at shell build, nav-collapsed before first paint)
// same-tick, so no flash of the wrong scheme; `set`'s body is also same-tick up to the promise
// wrapper (the load-bearing property agent-roster-source.ts already states), so `void set(...)`
// preserves the old write timing exactly.
import { createLocalStorageAdapter, type SyncReadableStorageAdapter } from '@agent-ui/shared'

export const siteStorage: SyncReadableStorageAdapter = createLocalStorageAdapter({ namespace: 'agent-ui' })
