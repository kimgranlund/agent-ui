# T-0055 Design: make the whole renderer lazy at ui-surface-host (T-0026 Option D)

Spike output. No source edits. Every figure below was measured on main@39921d40 (`npm run size` exits 0) with the harness and scratch-clone
runs in `measure/`; the raw output is saved beside it. The prototype lives only in `measure/proto/` and in a scratch clone outside the repo.

## 0. Answer first

- Option D still works and is cheaper than T-0026 feared, but it is worth half of what T-0026 measured. The eager app row goes **57,878 to
  45,292 B gz (-12,586)**, not -26,695, because T-0029 and T-0042 already moved the catalog bodies out. The floor is the same (T-0026's stub
  44,536, today's ceiling 44,680); the starting point dropped.
- Who pays: every host that renders any surface fetches the whole saving back. A host that paints its first default surface fetches
  **22,890 B gz in 2 dynamic hops after the entry graph, against 9,288 B in 1 hop today** (whole first-surface set 88,584 B gz in 45 chunks against
  87,667 in 43): +917 B gz, +2 chunks, +1 hop. So D is a headroom lever for the barrel row, and a byte win only for a host that mounts no surface.
- Composition is clean. The facade is a `RendererHost`, so `ui-surface-host`'s settle seam (`pending`, `settled()`) and the warm memo work
  through it with no change to the derive logic. With function-level warm the 101-file jsdom candidate set needs **0 test edits** (V3).
- Recommendation: **defer**, with a build-ready design (section 7). The row is not red, headroom is 2,047 B, no roadmap or plan item names the row as a
  blocker, and the in-repo hosts that would benefit are one site page that can switch to a subpath today. Build D when an app-tier feature needs
  more than the 2,047 B headroom, or when Kim wants the barrel row to measure a renderer-free baseline (section 10).
- If Kim rules build: ADR-0242 (next free number; 0241 is the highest), four children, merge order ADR then A then B then C.

## 1. Premise check against T-0026

| T-0026 said (main@e3d03679) | State on main@39921d40 |
|---|---|
| Option D saves -26,695 B gz from 71,231 (stub, nothing added back) | -13,198 stub ceiling and -12,586 prototype, from 57,878 |
| D "does not split catalog data from the renderer" | The split is done (ADR-0241 and Amendment 1); D is now the renderer alone |
| `surface-host.ts:172` creates the renderer synchronously, `ingest`/`onClientMessage`/`dispose` assume it exists | Still true, now at `surface-host.ts:186`; the host already tolerates a not-yet-ready renderer through `pending` and `settled()` (T-0039) |
| A lazy renderer "needs its own ADR in the ADR-0197 mold" | Still true (section 9) |

## 2. Re-measure on current main

`measure/lib.mjs` is the T-0026 and T-0037 harness unchanged (Rolldown, ESM, minified, eager set = entry chunks plus their transitive static
imports, gzip 9, marginal = eager gz minus the components `.` barrel). Independence proof: row E0 prints 57,878, the number `npm run size` prints for
the app row (`measure/size-app-rows.out.txt`: marginal 57878 B gz, budget 59925, headroom 2,047); `prototype.mjs` throws if it does not.

`measure/prototype.mjs` patches `surface-host.ts` in memory (its `createRenderer` import becomes `createLazyRenderer`) and bundles the app entry. The
facade is real TypeScript (`measure/proto/lazy-renderer.template.ts`), and the same text typechecks in a scratch clone (`tsc` exit 0).

| Row | App marginal | Delta | What it is |
|---|---|---|---|
| E0 baseline | 57,878 | 0 | = `npm run size` |
| S0 | 44,680 | -13,198 | surface-host loses the renderer, nothing added back; ceiling, not buildable |
| Da | 45,269 | -12,609 | facade, `import('@agent-ui/a2ui')` (the whole barrel namespace) |
| Dc | 45,270 | -12,608 | facade, `import('renderer/index.ts')` (stand-in for a new narrow subpath) |
| Dd | 45,268 | -12,610 | app-owned facade, `import('renderer.ts')` |
| Db | 45,267 | -12,611 | a2ui-owned facade exported through the barrel, `import('renderer.ts')` |
| Dx | 45,293 | -12,585 | Db plus module-level warm (renderer.ts calls `provideRenderer` when it evaluates) |
| **Dy** | **45,292** | **-12,586** | Db plus function-level warm (`createRenderer()` calls `provideRenderer`); the shape this design proposes |

- The facade costs 612 B gz (Dy minus S0). After Dy no a2ui module remains in the eager closure except the facade itself; before, a2ui held 143,206 of
  the closure's 688,486 rendered bytes (renderer 110,695, catalog 30,919, protocol 1,592; `measure/remaining.out.txt`). Eager rendered bytes fall to 547,962.
- What stays eager after D is app controls (37.9%) and components controls (37.8%), so D is the last large a2ui lever on this row.
- Budget arithmetic if built: 45,292 plus the standing 2,047 gives 47,339 against today's 59,925, which is **14,633 B of headroom bought** (child B sets
  the real figure from the real facade).

Lazy bytes (standalone gz, `measure/prototype.out.txt`). The renderer chunk is the new cost; the barrel variant shows why the entry must be narrow:

| Variant | Renderer chunk | Lazy a2ui bytes outside the admin arm | Delta vs 13,606 today |
|---|---|---|---|
| Db, Dd (renderer.ts) | 12,012 and 12,011 | 27,213 and 27,218 | +13,607 and +13,612 |
| Dc (renderer/index.ts) | 12,782 | 27,989 | +14,383 |
| Da (the barrel) | 26,901 (`src-*.js`, 49 modules) | 31,935 | +18,329 |

Da drags the catalog documents and every other barrel export into the first-surface chunk, so a dynamic `import('@agent-ui/a2ui')` is rejected.
Dc over-exports (dispatch, parser, SurfaceTree, ActionDispatcher, validateA2ui): +770 B for nothing. The narrow entry is `renderer.ts` itself.

## 3. The import graph and the exact async seam

### 3.1 Import graph, app entry to the renderer

```
app/src/index.ts:29                 export { UISurfaceHostElement } from controls/surface-host/surface-host.ts
  (conversation.ts:103 side-effect-imports surface-host.ts, so index.ts:30 reaches it too)
surface-host.ts:80                  import { createRenderer } from '@agent-ui/a2ui'        the only runtime a2ui import in the eager app graph
surface-host.ts:186                 this.#host = createRenderer()                          inside connected(): one renderer PER host instance
  surface-host.ts:200               this.#host.preload('agent-ui').catch(() => {})         starts the default catalog body fetch
a2ui/src/index.ts:5                 export * from './renderer/index.ts'                    inert for the app: nothing else uses it
renderer/index.ts:5                 export { createRenderer } from './renderer.ts'
renderer/renderer.ts                dispatch, parser, tree, widget, binding, surface, validate, catalog/{registry,loader,records,...}
catalog/records.ts                  the lazy catalog records (T-0029, T-0042); bodies stay behind dynamic import()
```

The only other runtime a2ui import in `app/src` is `agent-admin-schema.ts:26` (`derivedCatalogId`, `derivedCatalogIdsFor`, `SHIPPED_PERSONA_CATALOGS`),
which sits in the lazy agent-admin arm. Rolldown hoists the modules both arms share (`naming.ts`, `catalog.ts`) into a shared lazy chunk (1,598 B), so
a host that opens the admin arm and a surface fetches it once.

### 3.2 What a lazy ui-surface-host loads, and when

`createLazyRenderer(options)` replaces `createRenderer()` in `connected()` (a two-line change in `surface-host.ts`; the artboard is still built
synchronously, so the `[data-part=stage]` and `[data-part=surface]` mount exist from the first frame). It returns one of two things:

- Warm (the renderer module is already on the page): the real renderer. First-paint streaming stays synchronous, ADR-0183's law holds for this host.
- Cold: a `LazyRenderer`, a `RendererHost` that records `register`, `mount`, `ingest`, `ingestMessage`, `onClientMessage`, `preload` and `finalize` calls in
  order and replays them onto the real renderer the moment the module lands. `loadRenderer()` is one memoized `import('./renderer.ts')`; a rejected load is
  dropped from the memo so the next host retries (the `loader.ts` and `loadAgentAdmin()` precedent).

Cold first surface, in order:

1. `connected()` builds the artboard, calls `createLazyRenderer()` (starts the renderer chunk fetch), then `mount`, `onClientMessage` and
   `preload('agent-ui')` are held.
2. The first `ingest(createSurface)` and `ingest(updateComponents)` and `finalize()` are held. `host.pending` is true (ops held), so surface-host's `#derive`
   runs its inline reads (no-ops on an empty mount), skips the terminal-empty verdict, and parks the four reads on `host.settled()`.
3. The module lands. The facade builds the real renderer, replays the held calls in order (`mount`, listeners, `preload` which starts the default body fetch,
   `createSurface` which gives the surface its catalog gate, the queued `updateComponents` and `finalize`), then releases `settled()` waiters through
   `real.settled()`.
4. The default body and the controls the message names load (unchanged ADR-0241 and ADR-0233 paths), the surface's queue drains, `real.settled()`
   resolves, and surface-host's deferred pass runs: stretch, `data-root-card`, superseded sweep, and the empty-final verdict on a real mount.

Probe (`measure/probe-cold.test.ts.txt`, output `measure/probe-cold.out.txt`, jsdom, facade only): the first host's `textContent` is empty
synchronously and `data-empty-final` is absent, then the surface paints after 9 to 15 `setTimeout(0)` ticks (two runs, load-dependent) with
`data-empty-final` still absent; a host built after that is synchronous. So the cold window is the existing one (Amendment 1 made the first host on a page
asynchronous for the default catalog) with one more hop in front of it.

### 3.3 Composition with settled(), pending and the warm memo

- `pending`: cold = at least one call held; warm or attached = `real.pending`. A cold facade with nothing held reports false, matching "nothing is held back".
- `settled()`: resolves at once when nothing is held; otherwise parks until the replay is done and `real.settled()` has resolved. It never rejects (the
  `RendererHost` contract). surface-host's `#derive` and `#generation` staleness check need no change; this is the same mechanism one level up.
- Warm memo, two layers. The catalog warm memo (A2 of Amendment 1) is unchanged and sits inside the real renderer. The renderer-module warm memo is the new
  `loaded` cell in the facade, set by `loadRenderer()` and by `provideRenderer()`. With both warm, a host is exactly as synchronous as today.
- `dispose()` before load drops the held calls, never builds the real renderer, and must resolve every parked `settled()` and `preload()` (the prototype leaves
  a cold `preload()` dangling; section 6).

### 3.4 Warm rules compared (measured, section 5 has the counts)

| Rule | What tells the facade the module is here | App marginal | jsdom candidate set, no test edits |
|---|---|---|---|
| Explicit memo only (V1) | only the facade's own load | 45,267 (Db) | 1 of 101 files red |
| Module-level (V2, Dx) | `renderer.ts` calls `provideRenderer` as it evaluates | 45,293 | 0 red |
| **Function-level (V3, Dy)** | `createRenderer()` calls `provideRenderer(createRenderer)` | **45,292** | **0 red** |

Recommended: function-level. It has the same effect on the candidate set and no module-level statement, so nothing depends on `a2ui`'s
`sideEffects` declaration (`["./src/agent/system-prompt.ts"]`) being honest about `renderer.ts`. Every existing suite and site entry that already
calls `createRenderer()` to warm the catalog (T-0040, T-0041: `site/lib/warm-catalog.ts` and the `createRenderer as warm` top-level awaits) warms the
facade for free.

The single V1 failure (`packages/agent-ui/app/src/controls/conversation/conversation.test.ts`, "expected '' to contain 'ready'") is a synchronous-assert
artifact, not a renderer bug: two turns ingest into one host before the module lands and the test reads the DOM in the same tick. The replay keeps the
order, so the final DOM is the same, only later; the warm hook makes it zero.

### 3.5 First-use cost

From `measure/waterfall.out.txt` (sum of standalone chunk gz, Rolldown output of the app entry):

| | Baseline | Dd (renderer lazy) |
|---|---|---|
| Eager closure, includes the components foundation | 78,379 | 65,694 |
| Fetched after the entry graph for the first default surface | 9,288 in 1 hop | 22,890 in 2 hops |
| Whole first-surface set | 87,667 in 43 chunks | 88,584 in 45 chunks |

The chain is entry, then the renderer chunk (12,011, static deps `graph-*.js` 1,099 and the shared `catalog-*.js` 1,598), then the default body (3,452)
with its `controls-*.js` (2,649), then the per-control chunks (ADR-0233, unchanged). The new hop cannot be parallelised without exposing the default body to
the app: the body is reachable only through the renderer's records. Wall-clock cost is not measured (no network here); the design assumption is one extra
round trip, hidden behind model latency when a conversation warms the module early (ruling R5).

## 4. Who benefits

The gate row is the `@agent-ui/app` `.` barrel, a worst-case ceiling. Real consumers mostly import subpaths. Runtime imports of the barrel in the repo:

- `site/pages/persona-library-pattern.ts:20` imports `createMemoryStore` from the barrel and mounts no surface or conversation (grep: no `ui-surface-host`,
  `ui-conversation`, `createRenderer`). It pays the full renderer today for nothing, and the subpath `@agent-ui/app/settings-memory-store` (five other site
  files already use it) removes it with no change to any control. That is a cheaper fix than D for this page.
- `site/pages/a2ui-live.ts:65` imports `createMemoryStore` from the barrel and renders surfaces; D gives it nothing.
- Every other barrel mention is `import type`, erased.
- Subpath users of `@agent-ui/app/surface-host` (6 site files) and `@agent-ui/app/conversation` (5) render surfaces by definition; they pay +917 B and a hop.

So D is a pure headroom lever for the barrel row, and a byte win for (a) barrel importers that mount no surface and (b) conversations that never reach a
surface (prose-only turns). Neither is a population the repo can show today. Per ADR-0197 cl.5, upward re-bases of this row are closed, so headroom
matters only when a feature needs more than 2,047 B at the app tier; I found no such item (grep of `.claude/docs/roadmap.md`, `plan.md`, `goals.md` for
headroom, `APP_MARGINAL`, app row, size budget: only historical mentions).

## 5. Every consumer and test that would change

Method: a scratch clone of main@39921d40 outside the repo (`git clone --local`, `scripts/bootstrap-scratch-clone.mjs`), the prototype applied by
`measure/scratch-apply.mjs`, vitest on the 101-file jsdom candidate set (`measure/candidate-tests.txt`: every non-browser test that mentions surface-host,
conversation, agent-admin or `@agent-ui/app`). Saved: `measure/churn-v0.out.txt` to `churn-v3.out.txt`.

| Run | Files red | Tests |
|---|---|---|
| V0 baseline, unflipped main | 0 of 101 | 2,139 passed of 2,145 |
| V1 facade, explicit memo only, no test edits | 1 of 101 | 1 red |
| V2 facade, module-level warm, no test edits | 0 of 101 | 2,139 passed |
| V3 facade, function-level warm, no test edits | 0 of 101 | 2,139 passed |

Real engine (chromium, scratch clone, V2): 3 distinct files, 81 tests, 0 red (`measure/churn-browser.out.txt`):
- `packages/agent-ui/app/src/controls/surface-host/surface-host.browser.test.ts`
- `packages/agent-ui/app/src/controls/surface-host/surface-host-working.browser.test.ts`
- `packages/agent-ui/app/src/controls/conversation/conversation.browser.test.ts`

Production code that creates or templates a `ui-surface-host`, audited for a synchronous read of the mount after `ingest`/`finalize`: none needs an edit,
because the facade keeps the public methods and the warm path synchronous (counts: 1 package, 5 site entries).
- `packages/agent-ui/app/src/controls/conversation/conversation.ts` (`createElement('ui-surface-host')` at 1048)
- `site/pages/a2ui-chat.ts`, `site/pages/a2ui-live.ts`, `site/pages/dashboard.ts`, `site/pages/surface-host-doc.ts`, `site/pages/workbench.ts`
- `site/pages/devtools-harness.ts` builds a `RendererHost` directly with `createRenderer()` and is unaffected.

Not run (35 real-engine files that mount a surface host, a conversation or the admin chat; the owning child runs its shard and edits a file only if it reds):
- A, a2ui (8): `packages/agent-ui/a2ui/src/catalog/personas/concierge/concierge.browser.test.ts`, `packages/agent-ui/a2ui/src/renderer/card-header-slot.browser.test.ts`,
  `packages/agent-ui/a2ui/src/renderer/catalog-loading.browser.test.ts`, `packages/agent-ui/a2ui/src/renderer/checkbox-group-layout.browser.test.ts`,
  `packages/agent-ui/a2ui/src/renderer/control-loading.browser.test.ts`, `packages/agent-ui/a2ui/src/renderer/date-field-a2ui-mount.browser.test.ts`,
  `packages/agent-ui/a2ui/src/renderer/input-multi-slot.browser.test.ts`, `packages/agent-ui/a2ui/src/renderer/tree.browser.test.ts`
- B, app (16): `packages/agent-ui/app/src/agent-admin-lazy.browser.test.ts`, `packages/agent-ui/app/src/controls/agent-admin/agent-admin-chat-surface.browser.test.ts`,
  `packages/agent-ui/app/src/controls/agent-admin/agent-admin-click-turn.browser.test.ts`, `packages/agent-ui/app/src/controls/agent-admin/agent-admin-edge-to-edge.browser.test.ts`,
  `packages/agent-ui/app/src/controls/agent-admin/agent-admin.browser.test.ts`, `packages/agent-ui/app/src/controls/agent-admin/agent-team-pane.browser.test.ts`,
  `packages/agent-ui/app/src/controls/agent-admin/document-ingest-docx.browser.test.ts`, `packages/agent-ui/app/src/controls/agent-admin/dogfood-lazy.browser.test.ts`,
  `packages/agent-ui/app/src/controls/agent-admin/follow-the-change.browser.test.ts`, `packages/agent-ui/app/src/controls/chat-shell/chat-shell.browser.test.ts`,
  `packages/agent-ui/app/src/controls/conversation/conversation-composer.browser.test.ts`, `packages/agent-ui/app/src/controls/conversation/conversation-composer.visual.browser.test.ts`,
  `packages/agent-ui/app/src/controls/conversation/conversation-dialog.browser.test.ts`, `packages/agent-ui/app/src/controls/conversation/conversation-header.browser.test.ts`,
  `packages/agent-ui/app/src/controls/entry-list/entry-list.browser.test.ts`, `packages/agent-ui/app/src/controls/super-shell/super-shell-bar-seam.browser.test.ts`
- B, components (1): `packages/agent-ui/components/src/controls/split/split.browser.test.ts`
- B, site (10): `site/lib/a2ui-gallery.browser.test.ts`, `site/lib/ask-registry.browser.test.ts`, `site/lib/canvas-surface.browser.test.ts`, `site/lib/component-preview.browser.test.ts`,
  `site/pages/a2a-artifact-feed-live.browser.test.ts`, `site/pages/a2ui-chat-click-turn.browser.test.ts`, `site/pages/a2ui-chat.browser.test.ts`,
  `site/pages/a2ui-live-conversation.browser.test.ts`, `site/pages/agent-admin-app-scroll.browser.test.ts`, `site/pages/agent-admin-app.browser.test.ts`

New tests the build adds (none of the 101 files is edited): the facade unit test with an injectable loader, cold-path cases in `surface-host.test.ts`, and the
bundle gate (section 7).

## 6. Risks

1. **Longer cold window on the hottest path.** The first host on a page paints after 2 hops, not 1 (section 3.5). The contract class is not new (Amendment 1), the
   window is longer. Mitigation: ruling R5 (warm at conversation connect).
2. **Focus timing.** `site/pages/a2ui-chat.browser.test.ts` runs in the `focus-timing` project (`vitest.browser.config.ts`, `FOCUS_TIMING_FILES`). Anything that focuses into a surface right after `ingest` is exposed to the second hop. Not run; child B runs `npm run test:browser:focus-timing`
   alone, per the repo's rerun-in-isolation rule.
3. **Flicker.** The artboard exists from the first frame, and the CSS `:empty` placeholder ("The rendered surface appears here.") shows through the cold
   window, as it does for a cold catalog today. `data-empty-final` is not set during it (probe). A load failure must still end in the verdict.
4. **Silent undo.** The saving survives only while no eager app module imports `createRenderer` from the barrel; tree-shaking, not the dynamic import,
   keeps `renderer.ts` out. Trip-wire: `app/src/renderer-lazy.bundle.test.ts` in the `catalog-lazy.bundle.test.ts` shape (a real Rolldown build of the app
   barrel; no renderer module in the eager closure; each in a non-eager chunk) with a negative control that injects a static import and expects red.
5. **Facade gaps in the prototype**, each under 100 B and required in the build: `dispose()` must resolve cold `preload()` waiters; a failed module load must emit
   one `RENDERER_LOAD` error to listeners (ruling R4) so the host verdict is not silent; `register()` before load is queued but never exercised by surface-host.
6. **Second `RendererHost` implementer.** A new interface member becomes a compile error in `lazy-host.ts`, which is the intent. Any record that says `Renderer` is
   the only implementer (T-0037 risk 7 did) is repaired by child A.
7. **Build warnings.** Site and tools bundles that statically import the renderer see the facade's `import()` as ineffective (Rolldown prints
   `INEFFECTIVE_DYNAMIC_IMPORT`, as `npm run size` already does for components); no saving there, no break.
8. **SSR-less pages.** Non-risk: grep of `site`, `scripts`, `vite.config.ts`, `wrangler.jsonc` for `renderToString|prerender|ssr|hydrate` finds only prose comments;
   the site is a client-rendered SPA on static assets, so the cold path exists only in the browser.
9. **A failed load is sticky per host.** A host whose facade failed is closed; a reconnect builds a new facade and retries through the dropped memo.
10. **Unmeasured:** wall-clock of the extra hop on a real network, per-host construction CPU (a cold facade defers `new Renderer` until attach, a likely win for
    chat threads with many surfaces), and the 35 unrun real-engine files above.

## 7. Decomposition (only if Kim rules build)

Merge order: 0 (ADR) first, then A, then B, then C. Files are pairwise disjoint (`measure/check-design.mjs` proves it). Sizes use the repo's S/M scale;
suggested levels: 0 and C solo L2, A and B solo L3 with an L3 verifier (public API plus an ADR law).

### Child 0 (S, docs): ADR-0242, the renderer loads on first use

Docs-only gate: `doc_lint` plus `npm run check`, plus the regenerated ADR index and sitemap files and `site/lib/sitemap.test.ts` (process.md section 1,
the 2026-08-30 carve-out, since an ADR title is added). Ratified by Kim before A builds.
Files:
- `.claude/docs/adr/0242-surface-host-loads-the-renderer-on-first-use.md` (new)
- `.claude/docs/adr/0129-app-surfaces-m2-composition-and-transport-boundary.md` (append-only pointer on cl.1)
- `.claude/docs/adr/0183-view-transitions-opt-in-family.md` (append-only pointer: a cold host's first paint waits for the module)
- `.claude/docs/adr/0197-app-barrel-agent-admin-lazy-split.md` (append-only pointer on cl.5, the downward re-base)
- `.claude/docs/adr/0241-lazy-catalog-bodies-behind-an-eager-manifest.md` (append-only pointer on the Option D row of its alternatives table)

### Child A (M): the a2ui seam, behavior-neutral

Adds `createLazyRenderer` and `loadRenderer`, exports the former through the barrel, makes `createRenderer()` call `provideRenderer`. No caller changes.
`(red)` controls: a unit test where a cold facade with a held loader reports `pending` true and `mount` has not reached the renderer (red before: no facade);
a dispose-before-load test where the real renderer is never built and the parked `preload()` resolves.
Gates: `npm run check`; vitest on `packages/agent-ui/a2ui`; `npm run size` exit 0 (eager change is small: the memo cell and `provideRenderer`; the facade body should tree-shake out until B adopts it, and A measures that);
`test:browser:packages:rest`.
Files:
- `packages/agent-ui/a2ui/src/renderer/lazy-host.ts` (new)
- `packages/agent-ui/a2ui/src/renderer/lazy-host.test.ts` (new)
- `packages/agent-ui/a2ui/src/renderer/index.ts`
- `packages/agent-ui/a2ui/src/renderer/renderer.ts`
- `packages/agent-ui/a2ui/src/protocol.ts`
- `.claude/docs/spec/a2ui-runtime.spec.md`
- `.claude/docs/lld/a2ui-renderer.lld.md`
- `packages/agent-ui/a2ui/README.md`
- `packages/agent-ui/a2ui/AGENTS.md`

### Child B (M): adopt in ui-surface-host, the bundle gate, the budget

Lands as one PR so the gate tightens in the same change. `(red)` controls: `renderer-lazy.bundle.test.ts` (renderer modules are eager on main: red before) and its
negative control. Size: eager about -12,586 measured (the 612 B facade cost lands here); `APP_MARGINAL_BUDGET` re-based DOWN to the measured figure plus 2,047 (ordinary under ADR-0197 cl.5).
Gates: `npm run check`; `npm test` (CI's suite); `npm run size` exit 0 at the new budget; `test:browser:packages:app`, `:rest`, `:site`, `:focus-timing`; the
35 files in section 5 by owner.
Files:
- `packages/agent-ui/app/src/controls/surface-host/surface-host.ts`
- `packages/agent-ui/app/src/controls/surface-host/surface-host.test.ts`
- `packages/agent-ui/app/src/controls/surface-host/surface-host.md`
- `packages/agent-ui/app/src/renderer-lazy.bundle.test.ts` (new)
- `scripts/measure-size.mjs`

### Child C (S, docs): repair the records that name the old timing

Stale context is a defect; rides with B. Docs-only gate.
Files:
- `.claude/docs/spec/app-surfaces-m2.spec.md`
- `.claude/docs/lld/app-surfaces-m2.lld.md`
- `packages/agent-ui/app/README.md`

## 8. What needs Kim

Always: **R0, the verdict.** Defer (recommended), build, or reject. If build, the rest:
- R1. Shape: an a2ui-owned `createLazyRenderer` exported through the barrel (recommended: identical bytes to an app-owned facade, no new package subpath, and
  `surface-host.test.ts`'s SPEC-R2 AC4 guard that surface-host imports only the bare `@agent-ui/a2ui` barrel stays literally true) versus an app-owned facade
  behind a new `@agent-ui/a2ui/renderer` subpath.
- R2. Warm rule: function-level (recommended) versus module-level versus explicit-only (one conversation test edit).
- R3. Public contract: a cold `ui-surface-host` paints after the module lands. This is a third relaxation of ADR-0183's first-paint law (after the catalog one),
  recorded in ADR-0242.
- R4. Failure code: a new `RENDERER_LOAD` `ErrorCode` (recommended; surface-scoped like `CONTROL_LOAD` and `CATALOG_LOAD`, never from the validator) versus reusing
  `CATALOG_LOAD`.
- R5. Warm trigger: on `ui-surface-host` connect (as the catalog preload does) versus also on `ui-conversation` connect, which hides the hop behind model latency
  but fetches the renderer for every conversation, including prose-only ones.

No ruling needed: the budget re-base (downward, ordinary under ADR-0197 cl.5).

## 9. The ADR route

Named, not drafted: a new ADR-0242, "ui-surface-host loads the renderer on first use" (the number to be claimed against the file tree, every sibling worktree under
`.claude/worktrees/`, the local and remote branches and the open PR list when child 0 starts). It relaxes ADR-0129 cl.1 ("wraps exactly one `RendererHost`,
mount at connect": still one host, but the real renderer may attach after connect), adds a third pointer to ADR-0183's first-paint law, relates ADR-0197 cl.5 (the
row re-bases downward) and ADR-0241 (its alternatives table rejected D "for this change" and said it needs its own ADR in the ADR-0197 mold). It decides: the
facade, the warm rule, the failure code, the warm trigger, and records the build trigger so a later flip is a measured ruling.

## 10. Recommendation: defer

Defer, and keep this design as the build-ready record.

- The saving is real (-12,586 B gz, the last large a2ui lever on the row) but half of what T-0026 priced, and every host that renders a surface fetches it back
  (+917 B gz, +1 hop). Unlike Option C, which saved bytes most hosts never fetched, D buys only headroom.
- Nothing needs the headroom now: the gate is green at 2,047 B and no ruled feature is blocked by it.
- The one in-repo host that pays for nothing (`site/pages/persona-library-pattern.ts`, barrel import for `createMemoryStore`) has a free fix. That is a new
  ticket, not part of this spike: switch it to the `@agent-ui/app/settings-memory-store` subpath.
- Build when any one holds: (1) an app-tier feature needs more than the 2,047 B headroom, since ADR-0197 cl.5 closes upward re-bases; (2) Kim wants the barrel row to
  measure a renderer-free baseline as policy; (3) a consumer report shows surface-less pages paying the renderer through the barrel. The cost then is four
  children, one ADR, and a longer cold window on the first surface; the measured test churn is zero.
- Reject only if Kim decides the first-surface hop is unacceptable on the hottest path; nothing measured says it is.

## 11. Rejected alternatives

| Alternative | Why not |
|---|---|
| `import('@agent-ui/a2ui')` in the facade (Da) | 26,901 B gz first-surface chunk; drags every catalog document back in (+18,329 lazy bytes) |
| `import('renderer/index.ts')` (Dc) | +770 B gz of exports no host needs; the narrow entry is `renderer.ts` |
| App-owned facade plus a new `@agent-ui/a2ui/renderer` subpath (Dd) | Same bytes as Db, but a new package export and a weaker SPEC-R2 AC4 guard |
| Module-level warm (Dx) | Same effect as function-level, but a top-level statement in a module the package declares side-effect-free |
| Buffer ingest in `ui-surface-host` behind a `#ready` promise | Warm hosts also go async (the flag flips a microtask late) and it duplicates the renderer's queue (T-0037 section 3.2) |
| Make `RendererHost.ingest` promise-returning | Breaking public signature across the 13 non-test `createRenderer()` callers counted in T-0037 |
| Barrel-importer fix only (switch one page to a subpath) | Right for that page, but does not move the barrel row; recorded as a separate ticket |
