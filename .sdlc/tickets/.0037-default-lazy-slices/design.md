# T-0037 Design: make the default catalog lazy (option C) as ticketed children

Spike output. No source edits. Every number below was measured on main@f5b38eea (T-0029 merged) with the harness and
scratch-clone runs in `measure/`; the raw output is saved beside it. This document supersedes slice 6 of
`.sdlc/tickets/.0026-size-budget-split-design/design.md`, which was written before T-0029 and is now stale on the numbers, the caller list and the seam
(that file is a finished run record and is not edited).

## 0. Answer first

- Making the default `agent-ui` catalog a lazy record too measures **-9,452 B gz eager** (app row 67,203 to 57,751). It is smaller than the
  -14,064 the T-0026 design quoted because T-0029 already moved a2ui-basic and the personas out; what is left to move is the default document,
  the default factories and the 82-record control registry.
- A host that renders default surfaces fetches 6,100 B gz of it back on first use, so its real-world byte win is about 3.3 KB. The big
  effect is on the gate: headroom against today's 69,250 budget goes from 2,047 B to 11,499 B before the budget is re-based down, and a host that never renders a surface gets all 9.4 KB.
- The ADR-0241 cl.10 example trigger ("headroom under 2,048 B after this change lands") holds from the day T-0029 merged, because T-0029 set the budget at the measured figure plus 2,047, one byte under the clause's 2,048: 69,250 - 67,203 = 2,047. It is a consequence of that choice, not a new discovery.
- **Two things the old design missed, both found by running it.** (1) `ui-surface-host` cannot just "kick `preload`": its `finalize()`
  reads the mount synchronously right after `host.finalize()`, so a still-loading catalog leaves a spurious `data-empty-final` that never clears.
  This is **already live on main today for a2ui-basic** (a lazy record since T-0029): the cold probe in `measure/churn-extra.out.txt` shows
  `emptyFinal=true` before and after the surface renders. (2) The test and caller churn is smaller than the "26 files" figure only if a
  renderer built after the first load registers the default synchronously (the "warm-memo" rule, section 3.3): without it 17 of 72 candidate jsdom
  test files break; with it and a two-line top-level warm-up in 15 files (measured, V3), 2 do, and both are the intended semantic edits.
- Decomposition: **A** seam (a2ui + surface-host), **B** site callers, **C** a2ui tests and tool run as three parallel lanes with pairwise
  disjoint files, then **D** the flip last. A, B, C are behavior-neutral on today's main. A fixes the live a2ui-basic defect and carries the
  only `(red)` control besides D's.
- Needs Kim before B, C, D start: R1 to R3 (section 7). A can start on approval of this design, because its first deliverable is the live-defect fix.
- ADR: an Amendment to ADR-0241 (cl.2 and cl.10), or ADR-0242 if Kim prefers a separate record; not drafted here.

## 1. Premise check against T-0026 slice 6

| T-0026 slice 6 said | State on main@f5b38eea |
|---|---|
| Option C saves -14,064 B gz from 71,231 | -9,452 from 67,203 (T-0029 took the other 4.6 KB) |
| 13 non-test callers, 26 test files | 13 callers stand; 17 of 72 candidate jsdom files break unmodified, 2 with warm-memo; 26 more are browser files, unrun (section 3.5) |
| "`ui-surface-host.connected()` kicks `preload('agent-ui')`" | Not enough: the post-finalize reads need a settle seam (section 3.2) |
| `records.ts` gets "a record flip" | `records.ts` statically imports `defaultCatalog`, `defaultFactories`, `builtinControls`; the flip also needs a literal manifest and two body modules (section 3.1) |
| App budget 72,027 | 69,250 (re-based down by T-0029); headroom 2,047 |

## 2. Re-measure on current main

`measure/lib.mjs` is the T-0026 harness unchanged (Rolldown, ESM, minified, eager set = entry chunks plus their transitive static imports,
gzip 9, marginal = eager gz minus the components `.` barrel). Independence proof: row E0 prints 67,203, the number `npm run size` prints for the
app row (`measure/size-app-rows.out.txt`); `prototype.mjs` throws if it does not.

`measure/prototype.mjs` patches `renderer.ts` and `records.ts` in memory (`measure/patches.mjs`; each patch throws unless it matches exactly once)
and puts the default body behind `proto/default-body.ts`, the shape the real `catalog/default/body.ts` would have. Bodies are byte-identical.

| Row | App marginal | Delta | Kind |
|---|---|---|---|
| E0 baseline | 67,203 | 0 | = `npm run size` |
| P0 default removed, nothing added back | 57,686 | -9,517 | ceiling, not buildable |
| PC default behind a record + 5-function manifest + lazy body | 57,710 | -9,493 | prototype |
| PCW PC + warm-memo registration (section 3.3) | **57,751** | **-9,452** | prototype, the real shape |

The mechanism's whole cost is 24 B (PC minus P0) because T-0029 already built the records, loader and registry; warm-memo adds 41 B more.
Not in the prototype: the surface-host settle seam (section 3.2), estimated at +300 to 600 B gz; child A measures it and child D sets the budget from the measured figure.

Lazy chunks Rolldown cuts (standalone gz, `measure/prototype.out.txt`):

| Chunk | Baseline | After | Fetched when |
|---|---|---|---|
| `default-body` (default doc + index) | none | 3,452 | first surface on `agent-ui`, or on any `agent-ui--<persona>` |
| `controls` (default factories + `controls.ts` + registry bridge) | none | 2,648 | first surface on any built-in catalog |
| `basic-body` (a2ui-basic, both ids) | 4,528 | 4,553 | first surface on `a2ui-basic` or its URI |
| `personas` + persona `body` | 2,780 + 170 | 2,780 + 170 | first surface on a derived persona id |
| sum of catalog chunks | 7,478 | 13,603 | |

- Lazy catalog bytes grow by 6,125 against an eager saving of 9,452. A host that renders every catalog still nets about -3.3 KB; a default-only host fetches 3,452 + 2,648 = 6,100 and nets the same.
- The lazy agent-admin arm is unaffected: 33,645 to 33,648 B gz, and it holds no default-catalog or control-registry module itself.
- After PC the eager catalog modules are `naming, catalog, variant, functions, conformance, loader, registry, records` only. No `default/*`, no `controls.ts`: the a2ui `.` barrel's `export *` stays inert here too.
- `scripts/measure-size.mjs:793` `isCatalogBody` matches `a2ui-basic/`, `personas/` and `compose.ts` only; child D widens it (default and `controls.ts`) or the informational line (6,986 today) under-reports.

## 3. The exact async seam

### 3.1 Code path, app entry to the default body

Today the constructor does `registry.register(defaultCatalog, defaultFactories, undefined, builtinControls)` (`renderer.ts:238`) and `records.ts`
imports the same three modules statically for the `agent-ui` base of every `agent-ui--<persona>` record. The flip:

1. `renderer.ts`: drop the three imports and the eager `register`; the existing `registerLazy` loop over `BUILTIN_CATALOG_RECORDS` then records `agent-ui`.
2. `records.ts`: drop the three static imports; add a literal `DEFAULT_FUNCTIONS` manifest (5 functions, like `A2UI_BASIC_FUNCTIONS`), a `loadDefault` thunk, and
   an `agent-ui` record with `submitGate: ['ui-form-provider']`; the `BASES['agent-ui']` entry becomes `loadDefault`; `loadA2uiBasic` takes `controls` from its body instead of a static import.
3. New `catalog/default/body.ts`: re-exports `defaultCatalog`, `defaultFactories` and `builtinControls as controls` (the `a2ui-basic/body.ts` shape). `a2ui-basic/body.ts` gains the `controls` re-export.
4. `catalog/records.test.ts` bijection: ids now include `agent-ui`, `record.functions` deep-equals the loaded default `catalog.functions`, and the line `expect(ids).not.toContain(defaultCatalog.catalogId)` flips.

`callFunction` is already manifest-safe (`Registry.recordOf`), `submitGateSelector()` already unions record tags, and a rejected load already emits one `CATALOG_LOAD`
and removes the surface. No renderer queue code is new; this is the point of having built the mechanism first.

### 3.2 The surface-host seam (finding: live defect on main)

`ui-surface-host` creates one renderer per instance in `connected()` (`surface-host.ts:172`) and derives four things synchronously after `host.ingest` / `host.finalize`:
the root stretch, `data-root-card`, the superseded sweep, and the ADR-0187 `data-empty-final` verdict (`surface-host.ts:243-250`, `297-317`). The renderer
queues `updateComponents` and `finalize` behind a pending catalog (ADR-0241), so on a cold catalog those reads see no root.

Measured (`measure/churn-extra.out.txt`, scratch test on main's code, a2ui-basic surface, two sync ingests then `finalize()`):
`emptyFinal=true root=false` immediately, and `emptyFinal=true root=true` after the load settles. The verdict is wrong and never retracted. It is reachable today for any
cold a2ui-basic or persona surface. The default catalog would make it the first-surface path of every page.

Seam, in child A:

- `RendererHost` gains two additive members: `readonly pending: boolean` (true while any surface queue is non-empty, catalog or control gate) and `settled(): Promise<void>` (resolves when no queue remains; an already-resolved promise when `pending` is false). The renderer already deletes a queue in exactly one place (`#drain`), which is where waiters fire.
- `ui-surface-host.connected()` calls `host.preload('agent-ui')` (starts the fetch before the first line; the renderer would start it at `createSurface` anyway). `ingest` and `finalize` still forward synchronously; when `host.pending` is true after the forward they re-run the four derivations from `host.settled().then(...)`, with the existing staleness re-check; when false they run inline exactly as today.
- Net: warm hosts keep ADR-0183's "first-paint streaming stays synchronous, always"; only a cold host (first on the page, or a lazy id) paints after its chunk.

Rejected: (a) a host-level buffer behind a `#ready` promise: the flag flips a microtask late, so every warm host would also go async, and it duplicates the renderer queue; (b) a promise-returning
`RendererHost.finalize`: a breaking public signature for 14 callers; (c) kicking the fetch at app-barrel import: fetches the chunk for hosts that never render a surface.

### 3.3 Warm-memo sync registration

`loader.ts` memoizes the body promise module-wide, but every new renderer still reaches its body through `ensure()`, an async hop even after the chunk is in. Add a settled-body map and let `Registry.registerLazy` store a
body that is already loaded, at once (a throw falls back to the cold path). Then only the first renderer on a page is asynchronous; every later one is exactly as synchronous as today's constructor
(`registerLazy` pays the same `loadCatalog` validation that `register` paid). Cost 41 B gz (PCW minus PC). It is the lever that makes caller and test churn small: a test file warms once, before anything else runs, and everything after it is unchanged.

The prescribed test edit is two lines after the last import: `import { createRenderer as warm } from '@agent-ui/a2ui'` and a top-level `await warm().preload('agent-ui')`. It must be top-level, not a `beforeAll`: a renderer built at module or describe scope runs before any `beforeAll`, and with warm-memo a renderer built before the body lands stays cold. Measured as V3 (section 3.5).

Rejected for tests: a global vitest `setupFiles` warm-up (measured as V2, it works, but it costs more than it saves). It would import the 44 KB default document into each of the 694 jsdom test files, nearly all of which never build a renderer; one line in the files that need it is cheaper and says why.

### 3.4 Non-test callers (13: 12 audited for edits, `mount.ts` verified clean; `surface-host.ts` is the 14th and belongs to child A)

Production callers are not a mechanical one-line change. `await host.preload('agent-ui')` inside a synchronous function (`a2ui-gallery.ts` builds hosts in plain functions; `component-preview.ts` constructs in a method) makes it async and changes its return type and every caller, and inserts a microtask even when the id is already loaded. The renderer queue already handles a cold id correctly, so a caller that only ingests and finalizes needs no change. The rule for child B and for the tool in child C:

- Audit each file for a synchronous read of the mount (or a listener wired onto a rendered control) right after `ingest` or `finalize`; none of that was run, because only three site jsdom tests red in V1 and there is no jsdom coverage of most pages.
- Edit only a file that reads synchronously, and only by awaiting `preload('agent-ui')` in a function that is already async. If a synchronous function needs it, stop and report: that grows the child and is a public-shape decision, not B's.
- Adding `await host.preload('agent-ui')` is not the default; the default is no change.

Audited (child B unless marked), V1 red where noted:
- `site/lib/ask-registry.ts` (one host per ask; the `a2ui-live.ask-lifecycle` test reds in V1)
- `site/lib/a2ui-gallery.ts` (two `createRenderer()` sites, both in plain functions)
- `site/lib/component-preview.ts` (the `component-preview-catalog` test reds in V1)
- `site/pages/a2ui-list.ts`
- `site/pages/a2ui-stream.ts`
- `site/pages/a2ui-form.ts`
- `site/pages/devtools-harness.ts` (the `devtools-harness` test reds in V1)
- `site/pages/a2a-artifact-feed.ts` (two sites)
- `site/pages/a2ui-live.ts`
- `site/pages/a2ui-canvas.ts`
- `site/pages/a2ui-patterns.ts`
- `packages/agent-ui/a2ui/tools/agent/structural-transcript.ts` (child C; its two consumer tests red in V1)

No edit: `packages/agent-ui/a2ui/tools/testkit/mount.ts`. Its `settle()` already waits for unattached surfaces and in-flight control loads, and the whole tools project (31 files, 385 tests) passes under the flip with no edits. `ui-conversation` reaches the renderer only through `ui-surface-host`.

### 3.5 Tests

Method: a scratch clone of main@f5b38eea outside the repo, node_modules bootstrapped with `scripts/bootstrap-scratch-clone.mjs`, the flip applied by `measure/scratch-apply.mjs`, vitest on the 72-file candidate set
(`measure/candidate-tests.txt`: every non-browser jsdom test that mentions `createRenderer`, surface-host, conversation, the kit mount, the records or the a2ui barrel). Saved: `churn-v1.out.txt`, `churn-v2.out.txt`, `churn-extra.out.txt`.
The 17 failing files pass on the unflipped tree (V0: 775 of 775), so the flip causes every red.

V1, flip only, no test edits: **17 of 72 files fail** (102 of 2,183 tests). By owner:

Child A (app):
- `packages/agent-ui/app/src/controls/surface-host/surface-host.test.ts`
- `packages/agent-ui/app/src/controls/conversation/conversation.test.ts`

Child B (site):
- `site/lib/component-preview-catalog.test.ts`
- `site/pages/a2ui-live.ask-lifecycle.test.ts`
- `site/pages/devtools-harness.test.ts`

Child C (a2ui, warm-up only):
- `packages/agent-ui/a2ui/src/examples/backable-wizard.test.ts`
- `packages/agent-ui/a2ui/src/examples/examples.test.ts`
- `packages/agent-ui/a2ui/src/live-agent/round-trip.test.ts`
- `packages/agent-ui/a2ui/src/live-agent/structural-transcript.test.ts`
- `packages/agent-ui/a2ui/src/renderer/bound-text.test.ts`
- `packages/agent-ui/a2ui/src/renderer/card-header-slot.test.ts`
- `packages/agent-ui/a2ui/src/renderer/checkbox-group-layout.test.ts`
- `packages/agent-ui/a2ui/src/renderer/renderer-persona-catalogs.test.ts`
- `packages/agent-ui/a2ui/src/renderer/renderer.test.ts`
- `packages/agent-ui/a2ui/src/catalog/default/index.test.ts`

Child D (semantic, red even when warm):
- `packages/agent-ui/a2ui/src/catalog/records.test.ts`
- `packages/agent-ui/a2ui/src/renderer/builtin-controls.test.ts`

V2, flip + warm-memo + a global scratch setup file that warms once per test file: **2 of 72 fail**, exactly D's two.

V3, flip + warm-memo + the prescribed edit (section 3.3) applied to the 15 mechanical files, no global setup: **2 of 72 fail**, the same two. That is the shape the children ship, measured. It covers the jsdom candidate set only; the tools project is clean without edits.

The T-0026 "26 files" was a grep count of renderer-constructing files; the number that actually breaks, run and unmodified, is 17.

Not run (real-engine shards; load average was 28 during this spike). Each owning child runs its shard and edits a file only if it reds:
- A, surface-host and conversation:
  - `packages/agent-ui/app/src/controls/surface-host/surface-host.browser.test.ts`
  - `packages/agent-ui/app/src/controls/surface-host/surface-host-working.browser.test.ts`
  - `packages/agent-ui/app/src/controls/conversation/conversation.browser.test.ts`
  - `packages/agent-ui/app/src/controls/conversation/conversation-composer.browser.test.ts`
  - `packages/agent-ui/app/src/controls/conversation/conversation-composer.visual.browser.test.ts`
  - `packages/agent-ui/app/src/controls/conversation/conversation-dialog.browser.test.ts`
  - `packages/agent-ui/app/src/controls/conversation/conversation-header.browser.test.ts`
- A, agent-admin chat surfaces:
  - `packages/agent-ui/app/src/controls/agent-admin/agent-admin.browser.test.ts`
  - `packages/agent-ui/app/src/controls/agent-admin/agent-admin-chat-surface.browser.test.ts`
  - `packages/agent-ui/app/src/controls/agent-admin/agent-admin-click-turn.browser.test.ts`
- D, found by the full browser run (they mount a renderer through agent-admin helpers):
  - `packages/agent-ui/app/src/controls/agent-admin/document-ingest-docx.browser.test.ts`
  - `packages/agent-ui/app/src/controls/agent-admin/dogfood-lazy.browser.test.ts`
  - `packages/agent-ui/app/src/controls/agent-admin/follow-the-change.browser.test.ts`
- B:
  - `site/lib/canvas-surface.browser.test.ts`
  - `site/pages/a2a-artifact-feed-live.browser.test.ts`
  - `site/pages/a2ui-chat-click-turn.browser.test.ts`
  - `site/pages/a2ui-chat.browser.test.ts`
  - `site/pages/a2ui-live-conversation.browser.test.ts`
- C:
  - `packages/agent-ui/a2ui/src/catalog/personas/concierge/concierge.browser.test.ts`
  - `packages/agent-ui/a2ui/src/renderer/card-header-slot.browser.test.ts`
  - `packages/agent-ui/a2ui/src/renderer/catalog-loading.browser.test.ts`
  - `packages/agent-ui/a2ui/src/renderer/checkbox-group-layout.browser.test.ts`
  - `packages/agent-ui/a2ui/src/renderer/control-loading.browser.test.ts`
  - `packages/agent-ui/a2ui/src/renderer/date-field-a2ui-mount.browser.test.ts`
  - `packages/agent-ui/a2ui/src/renderer/input-multi-slot.browser.test.ts`
  - `packages/agent-ui/a2ui/src/renderer/tree.browser.test.ts`

## 4. Decomposition and merge order

```
        A seam (M)      B site callers (M)      C a2ui tests + tool (S)      <- parallel, pairwise disjoint files,
            \                 |                        /                        each green on today's main alone
             +----------------+-----------------------+
                              v
                     D the flip (M)   serial, last: depends on A for the seam and warm-memo, on B and C so its gates stay green
```

A, B and C are disjoint (checked by `measure/check-design.mjs`). D shares `renderer.ts` and two runtime docs with A and merges after it. In `renderer.ts` the regions are separate (A adds the settle members, D drops the default imports, the eager `register` and the header comment that says the default registers at construction). The spec and the renderer LLD say the default registers at construction, which D makes false, so D must be able to repair them; A edits them for the new members. Suggested levels: A solo L3 with an L3 verifier (public API plus an ADR law); B and C solo L2; D solo L3 with a verifier. Sizes use the repo's S/M scale.

### Child A (M): the settle seam, warm-memo, and the live a2ui-basic defect

Behavior-neutral for the default path. Fixes the live defect for lazy ids. Criterion `(red)`: `ui-surface-host` with a cold `a2ui-basic` surface, sync `ingest` x2 + `finalize()`, then `await settled`: `data-empty-final` absent and a root present (red on main today per the probe, green after). Also `(red)`: a cold renderer, `pending` true then false after `settled()`.
Size: eager +41 B (measured) plus the seam, estimated +300 to 600 B, to be measured. Gates: `npm run check`; vitest on the a2ui catalog and renderer, app surface-host and conversation; `npm run size` exit 0 (headroom 2,047 absorbs it); `test:browser:packages:app` and `:rest`.
Files:
- `packages/agent-ui/a2ui/src/catalog/loader.ts`
- `packages/agent-ui/a2ui/src/catalog/loader.test.ts`
- `packages/agent-ui/a2ui/src/catalog/registry.ts`
- `packages/agent-ui/a2ui/src/catalog/registry.test.ts`
- `packages/agent-ui/a2ui/src/renderer/renderer.ts`
- `packages/agent-ui/a2ui/src/renderer/catalog-loading.test.ts`
- `packages/agent-ui/app/src/controls/surface-host/surface-host.ts`
- `packages/agent-ui/app/src/controls/surface-host/surface-host.test.ts`
- `packages/agent-ui/app/src/controls/surface-host/surface-host.md`
- `packages/agent-ui/app/src/controls/conversation/conversation.test.ts`
- `.claude/docs/spec/a2ui-runtime.spec.md` (RendererHost additive members, SPEC-R9 AC4 timing)
- `.claude/docs/lld/a2ui-renderer.lld.md`
- `.claude/docs/adr/0183-view-transitions-opt-in-family.md` (append-only pointer: warm hosts stay synchronous, a cold host settles first)
- `.claude/docs/adr/0187-validator-finalize-signal.md` (append-only pointer: the empty-final verdict waits for the settle)

### Child B (M): site callers

No `(red)` control: it passes before and after the flip. Scope per section 3.4: the three site test files get the top-level warm-up (certain); the 11 production callers are audited and edited only where they read the mount synchronously, in functions that are already async. B runs the whole `site` vitest project and the `site` browser shard, and may grow if an audit finds a synchronous function that needs it (then it reports instead). Size: 0 on the gated row. Gates: `npm run check` (includes `check:site`); vitest on `site`; `test:browser:site`.
Files:
- `site/lib/ask-registry.ts`
- `site/lib/a2ui-gallery.ts`
- `site/lib/component-preview.ts`
- `site/pages/a2ui-list.ts`
- `site/pages/a2ui-stream.ts`
- `site/pages/a2ui-form.ts`
- `site/pages/devtools-harness.ts`
- `site/pages/a2a-artifact-feed.ts`
- `site/pages/a2ui-live.ts`
- `site/pages/a2ui-canvas.ts`
- `site/pages/a2ui-patterns.ts`
- `site/lib/component-preview-catalog.test.ts`
- `site/pages/a2ui-live.ask-lifecycle.test.ts`
- `site/pages/devtools-harness.test.ts`

### Child C (S): a2ui tests and the transcript tool

No `(red)` control, same reason. The edit per test file is the two-line top-level warm-up of section 3.3 (measured as V3); it is a no-op until A lands and keeps the file green after D. `tools/agent/structural-transcript.ts` follows the 3.4 audit rule. Size: 0. Gates: `npm run check`; vitest on the a2ui package and `--project tools packages/agent-ui/a2ui/tools`; `test:browser:packages:rest`.
Files:
- `packages/agent-ui/a2ui/tools/agent/structural-transcript.ts`
- `packages/agent-ui/a2ui/src/examples/backable-wizard.test.ts`
- `packages/agent-ui/a2ui/src/examples/examples.test.ts`
- `packages/agent-ui/a2ui/src/live-agent/round-trip.test.ts`
- `packages/agent-ui/a2ui/src/live-agent/structural-transcript.test.ts`
- `packages/agent-ui/a2ui/src/renderer/bound-text.test.ts`
- `packages/agent-ui/a2ui/src/renderer/card-header-slot.test.ts`
- `packages/agent-ui/a2ui/src/renderer/checkbox-group-layout.test.ts`
- `packages/agent-ui/a2ui/src/renderer/renderer-persona-catalogs.test.ts`
- `packages/agent-ui/a2ui/src/renderer/renderer.test.ts`
- `packages/agent-ui/a2ui/src/catalog/default/index.test.ts`

### Child D (M): the flip, the bundle gate and the budget

Lands as one PR so the gate tightens in the same change. `(red)` controls: `app/src/catalog-lazy.bundle.test.ts` with the default modules added to `BODY_MODULES` (red before: they are eager; green after), and `records.test.ts` expecting the `agent-ui` record (red before). Size: eager -9,452 measured plus child A's seam; `APP_MARGINAL_BUDGET` re-based DOWN to the measured figure plus 2,048 (ADR-0197 cl.5 downward re-base, ordinary; T-0029 used plus 2,047). The 57,751 prototype figure plus 2,048 is 59,799 before the seam; the child sets the real number.
Gates: `npm run check`; `npm test` (CI's full suite); `npm run size` exit 0 at the new budget; `test:browser:packages:app`, `:rest` and `:site`; `doc_lint` for the docs, plus sitemap regeneration and `site/lib/sitemap.test.ts` if the ADR log or a title changes (process.md section 1).
Files:
- `packages/agent-ui/a2ui/src/catalog/records.ts`
- `packages/agent-ui/a2ui/src/catalog/records.test.ts`
- `packages/agent-ui/a2ui/src/catalog/default/body.ts` (new)
- `packages/agent-ui/a2ui/src/catalog/a2ui-basic/body.ts`
- `packages/agent-ui/a2ui/src/renderer/renderer.ts`
- `packages/agent-ui/a2ui/src/renderer/builtin-controls.test.ts`
- `packages/agent-ui/app/src/catalog-lazy.bundle.test.ts` (header comment says "non-default" bodies: repaired too)
- `scripts/measure-size.mjs` (budget, ledger comment, `isCatalogBody` regex)
- `.claude/docs/adr/0241-lazy-catalog-bodies-behind-an-eager-manifest.md` (the Amendment)
- `.claude/docs/spec/a2ui-runtime.spec.md` (SPEC-R9 AC4: the default is a record too; A added the RendererHost members, D repairs the timing text A left true only for today)
- `.claude/docs/lld/a2ui-renderer.lld.md` (same reason)
- `.claude/docs/lld/a2ui-catalog.lld.md`
- `.claude/docs/spec/persona-catalog-composition.spec.md`
- `packages/agent-ui/a2ui/README.md`
- `packages/agent-ui/a2ui/AGENTS.md`
- `.claude/skills/a2ui-multi-catalog/SKILL.md`
- `.claude/skills/a2ui-multi-catalog/references/interop-patterns.md`

## 5. Risk list

1. **Live defect, independent of this design.** The cold-catalog `data-empty-final` misfire exists on main for a2ui-basic and persona surfaces. Child A fixes it; if Kim declines C, A still stands, B and C do not.
2. **Cold first host is asynchronous.** The first renderer per page paints after a 6.1 KB gz chunk. Callers and tests warm with `await preload`; production relies on `ui-surface-host.connected()` kicking the fetch.
3. **Bundle shape regresses silently.** One static import of `default/*` or `controls.ts` from an eager module (the `INEFFECTIVE_DYNAMIC_IMPORT` warning `npm run size` already prints for other files) undoes the saving; D's `BODY_MODULES` extension is the trip-wire.
4. **Manifest drift.** `DEFAULT_FUNCTIONS` and `submitGate` are copies; `records.test.ts` is the bijection gate and must stay red on a one-key drift.
5. **Warm-memo corner.** `registerLazy` storing a loaded body must fall back to the cold path on a throw, and must not mask a project `register('agent-ui', ...)` that follows (last-wins is unchanged).
6. **Unrun browser files.** 26 real-engine files could not be run here; each child must run its shard, and D runs all of them.
7. **Public additive API.** `RendererHost.pending` and `settled()` are new public members; no other class implements `RendererHost` (one implementer, `Renderer`), so `tsc` stays the check.
8. **Budget headroom is already 2,047 B.** A's seam spends some of it before D lands; the order A then D keeps the gate green, but a feature wave landing between them would not fit. Land A and D close together.
9. **Stale records.** D carries the repairs (ADR-0241 Amendment, the catalog LLD, the persona spec, README, AGENTS, the multi-catalog skill); A and D both touch the runtime spec and the renderer LLD (A for the new `RendererHost` members, D for the default's timing); A also carries the two ADR pointers.

## 6. Not measured

- The settle seam's bytes (estimate above); the wall-clock of the first lazy fetch on a real network; per-renderer construction CPU (the default no longer validates 80 types per renderer when it is not used).
- The 26 browser files and the full `npm test` under the flip; only the 72-file jsdom candidate set and the 31-file tools project were run. A file outside the candidate patterns that reaches the renderer through another helper could still break.
- Load average was 28 during the runs; the 17 reds are deterministic (they pass unflipped, fail flipped), but timing-sensitive browser shards should be rerun in isolation before a red is believed.

## 7. What needs Kim before any child starts

One `AskUserQuestion` round, recommendation first:

- **R1 (gates B, C, D).** Make the default catalog a lazy record: -9,452 B gz eager, at the price that the first renderer per page paints after a 6.1 KB gz chunk. Recommended yes: the cl.10 trigger holds at 2,047 B headroom.
- **R2 (gates A's API).** `RendererHost` gains `pending` and `settled()`, and `ui-surface-host` re-derives its post-ingest state after a pending load settles. This relaxes ADR-0183's "first-paint streaming stays synchronous, always" for the one cold host and moves the ADR-0187 verdict after the settle. Recommended yes; A starts first because it fixes a live defect.
- **R3 (gates A).** Warm-memo: a renderer built after any load of a body registers it synchronously. Recommended yes; it is the reason the churn is 2 semantic edits plus 15 one-line warm-ups instead of a rewrite.
- **R4.** ADR route: Amendment to ADR-0241 (recommended, same decision record, cl.2 and cl.10) or a new ADR-0242 (next free number).

No ruling needed: the budget re-base (ordinary under ADR-0197 cl.5, downward).

## 8. The ADR

Named, not drafted: Amendment 1 to `.claude/docs/adr/0241-lazy-catalog-bodies-behind-an-eager-manifest.md`. Decides: the default `agent-ui` catalog is a record too (cl.2 revised), the trigger in cl.10 is discharged, `RendererHost` carries `pending` and `settled()`, and the warm-memo registration rule. Relates ADR-0183 (first-paint law), ADR-0187 (finalize verdict timing), ADR-0197 cl.5 (downward re-base) and ADR-0233 cl.5 (the deferred-apply queue).

## 9. Rejected alternatives

| Alternative | Why not |
|---|---|
| Keep Option B and raise nothing | The cl.10 trigger holds; the next wave has 2,047 B |
| Host-level buffering in `ui-surface-host` | Warm hosts go async too; duplicates the renderer queue (section 3.2) |
| Promise-returning `RendererHost.finalize` | Breaking public signature across 14 callers |
| Global vitest warm-up | Imports the default body into 694 mostly unrelated files (section 3.3) |
| One big PR | Serializes everything behind a 40-file diff; the lanes above are disjoint |
| Lazy renderer inside `ui-surface-host` (T-0026 option D) | Different ticket; unchanged finding |
