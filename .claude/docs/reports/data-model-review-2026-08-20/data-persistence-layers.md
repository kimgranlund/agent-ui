# Data + persistence layers — sanctioned seams vs. real adoption

> Slice 1 of the data-model review (Kim's charter, 2026-08-20: "review our underlying data
> model/store, data workflows, context providing, signals, etc. there seems to be a mix of
> implementations now, and it is evident in how agent-admin-app is implemented").
> Read-only inventory by a dedicated reader session; file:line citations verified against main
> at the time of reading.

**Headline: `@agent-ui/data` (ADR-0192) is built-but-unadopted — zero real consumers. The
`StorageAdapter` seam (ADR-0193) is genuinely load-bearing — but six site-level modules still
bypass it with hand-rolled `localStorage`, including a full duplicate `SettingsStore`
implementation in `agent-admin-presets.ts`.**

## Sanctioned layers table

| Layer | Contract | ADR intent | Actual consumers |
|---|---|---|---|
| `@agent-ui/data` (`.`, `./gateway`, `./stream`) | `DataSource<T>` (optional CRUD verbs), signal-backed `resource()/mutation()/paginated()`, `DataError`, gateway onion client, `Streamed<T>` + `fromFetchStream/fromEventSource/fromWebSocket` | ADR-0192: a general SaaS CRUD/streaming seam every app-tier consumer would build on | **Zero real consumers.** No `package.json` in the monorepo declares a dependency on `@agent-ui/data`. Real imports of `resource/mutation/paginated/DataSource/gateway/*` exist ONLY in the package's own tests, `site/pages/data-doc.ts` (doc guide), and `site/pages/code-demo.ts` (a displayed, never-executed snippet). The `./stream` subpath has exactly one genuine cross-package consumer: `site/lib/ndjson-lines.ts` re-exports `readNdjsonLines` (ADR-0192 clause 5's hoist), used by six real `site/lib/*` transport modules (`arena-live-transport.ts`, `live-proxy-transport.ts`, `feed-live-transport.ts`, `admin-live-runner.ts`, + `components/status-stream` tests) — adoption of one hoisted function, not the `DataSource`/`resource`/`gateway` grammar the ADR was about. |
| `@agent-ui/shared` `StorageAdapter` seam (`storage/adapter.ts`, `local-storage-adapter.ts`, `indexed-db-adapter.ts`) | Async `get/set/delete/keys` + optional `subscribe`; localStorage tier (+ sync `getSync/keysSync` amendment) and IndexedDB tier | ADR-0193: the one persistence seam every `shared`-or-above consumer reaches for, replacing scattered hand-rolled `localStorage` touch points | **Real, multi-consumer adoption**, all in `packages/agent-ui/app/src/controls/`: `settings/memory-store.ts` (localStorage tier, full read+write via `SyncReadableStorageAdapter` per the 2026-08-17 amendment), `agent-admin/agent-team.ts` (localStorage tier, `AgentTeam` roster), `agent-admin/resource-idb-store.ts` (IndexedDB tier), `agent-admin/skill-pack-store.ts` (IndexedDB tier). Plus `site/pages/persistence.ts` (live doc-page dogfood). The one layer doing what its ADR promised. |

## Bypass inventory — direct `localStorage`/IndexedDB outside the StorageAdapter seam

All in `site/`, none inside `packages/agent-ui/*` proper (the app package's controls are clean):

| Where | What it stores |
|---|---|
| `site/pages/agent-admin-presets.ts:774,787,797,799,807,823-827,859,883,907,922,967,994` | A full hand-rolled `SettingsStore` implementation (`personaStore`/`presetStore`/`builderStore`) with direct `localStorage.getItem/setItem/removeItem` + a manual key-prefix scan (`localStorage.length`/`localStorage.key(i)`) for `seedVersion`/`modifiedAt` markers and persona reset. The exact bypass ADR-0193's own Context section named as "the second hand-rolled localStorage touch-point" — still present, unmigrated. |
| `site/lib/provider-mode-selection.ts:145,163` | Provider/model/mode/effort selection (`LS_KEY`), used across GenUI/agent-admin demo pages |
| `site/lib/theme-loader.ts:109,116,126,134` | Theme id + color scheme (`THEME_KEY`, `SCHEME_KEY`) |
| `site/pages/_page.ts:1480,1484` | Site shell's nav-collapsed flag |
| `site/pages/gen-ui-live.ts:108,115` | Page-local "use agent-ui components" dogfood toggle |
| `site/pages/agent-admin-app.ts:134,330` | Active-preset id (`ACTIVE_PRESET_KEY`) |
| `.claude/ops/mb-live-proof/mb-live-proof.harness.ts:58` | `localStorage.clear()` in an ops test harness (low-stakes, not app code) |

No `IDB`-shaped bypasses exist — the only non-`shared` IndexedDB touches are a test comment
(`resource-idb-store.test.ts`, notes jsdom lacks `indexedDB`) and `persistence.ts`'s doc prose.

## Other store/state modules (different vocabulary, not persistence bypasses)

- `app/src/controls/settings/store.ts` — `SettingsStore`, a deliberately SYNC, separate contract
  (LLD-C15 fork F7; ADR-0193 explicitly does not touch it). Its reference implementation
  `memory-store.ts` itself persists through `StorageAdapter`. A ratified parallel seam at a
  different altitude, not a bypass.
- `a2ui/src/corpus/store.ts` (`CorpusStore`) and `a2ui/src/renderer/surface.ts` (`SurfaceStore`)
  — pure in-memory, non-persistent object stores (parsed corpus shards; live render-surface
  lifecycle). Unrelated to persistence.
- `a2ui/tools/corpus/fs-store.ts` — Node-side build tool writing corpus shards via `fs`; not a
  browser storage seam.

## Adoption verdict

- **`@agent-ui/data` (ADR-0192): built-but-unadopted.** Ratified 2026-08-16, shipped with full
  core/gateway/stream surfaces, size budgets, tests — but nothing outside its own package and
  the docs site calls `resource()`, `mutation()`, `paginated()`, `DataSource`, or the gateway
  client for real application logic. agent-admin-app does not use it at all for its CRUD-shaped
  state (personas, teams, skill packs) — those hand-roll their own fetch/state logic. The
  layering tests only assert nothing imports it upward/sideways; no positive-adoption test
  exists because there is no real adoption to test.
- **`StorageAdapter` (ADR-0193): load-bearing, real.** Four production modules in agent-admin's
  app package genuinely persist through it (two localStorage, two IndexedDB); the 2026-08-17
  `SyncReadableStorageAdapter` amendment closed the one gap (`memory-store.ts` hydration) that
  used to bypass it. It is the one part of the "mixed implementations" picture that is NOT
  mixed — but it coexists with six site-level modules still hand-rolling `localStorage` for
  page-level concerns (theme, nav state, provider selection, dogfood flags, active-preset, and
  — most notably — the duplicate `SettingsStore` reimplementation in `agent-admin-presets.ts`
  that duplicates what `memory-store.ts` already does through the sanctioned seam).
