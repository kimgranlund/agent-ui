# SPEC — SPA Router v1 (`@agent-ui/router`)

> Status: proposed · v0.1 · 2026-07-09 · Layer: SPEC (execution contract)
> Refines: [`../prd/router.prd.md`](../prd/router.prd.md) — **PRD-G1** (memory-first core), **PRD-G2** (opt-in URL reflection), **PRD-G3** (outlet), **PRD-G4** (link), **PRD-G5** (fleet pillars), **PRD-G6** (teaching/fence); realizes [ADR-0115](../adr/0115-spa-router-v1-scope.md) clauses 1–8 (**proposed, NOT yet ratified** — authored overnight per the dispatch so the family is review-ready; forks resolved-by-recommendation).
> Refined by: [`../lld/router.lld.md`](../lld/router.lld.md). Decomposition: [`../decompositions/router.decomp.json`](../decompositions/router.decomp.json) (coverage-clean, strict).
> Altitude: owns the **v1 behavior contract** — the package boundary, the headless core semantics, the reflection sync rules, and the two elements' observable behavior. File map + mechanisms are the LLD's. Requirement IDs file-scoped (`SPEC-R1…`); cross-document references qualify by doc name.

---

## 1. Purpose

Define what `@agent-ui/router` is at v1: a **memory-first** client-side router — route state lives in a
kernel signal and navigation is a plain function over an in-memory history stack, in any host, with no
DOM required — plus an **opt-in** URL-reflection adapter (hash default / history opt-in) that projects
that same state onto the browser URL without ever becoming a second source of truth, and two light-DOM
elements (`ui-router-outlet`, `ui-router-link`) that turn matches into rendered content and markup into
navigation.

## 2. Definitions

- **Route record** — one entry of the developer-authored route table: `{ path, component }` where
  `path` is a v1 pattern and `component` an element factory (sync or async).
- **Route match** — the resolved current-route value: the matched record, extracted `params`
  (`:param` + `*` captures), parsed `query`, and the resolved path; or `null` when nothing matches.
- **Memory history** — the router-owned entry stack + index; the source of back/forward semantics in
  every mode.
- **Reflection** — the opt-in adapter (`connectUrl`) syncing route state ↔ browser URL. **Hash mode**:
  `#/path?query`, `hashchange` inbound. **History mode**: `pushState`/`replaceState` + `popstate`,
  entries state-stamped with the memory index.
- **Headless invariant** — core modules reference no DOM global (`window`, `document`, `location`,
  `history`).

---

## 3. Requirements

Normative per RFC 2119; each carries an ID, a PRD trace, and testable acceptance criteria.

### 3.1 Package boundary

**SPEC-R1 — `@agent-ui/router` joins the DAG as a components-consumer sibling; nothing imports it
inward.** The package MUST declare runtime dependencies of exactly
`{@agent-ui/components, @agent-ui/shared}`; MUST NOT be imported by `components`, `a2ui`, `shared`, or
any of their internals (`@agent-ui/app` MAY later consume it); MUST follow the strict TS posture
(`erasableSyntaxOnly`/`verbatimModuleSyntax`/`.ts` local imports); and MUST expose the elements on
subpaths (`./router-outlet`, `./router-link`) with the barrel exporting only the headless core + types,
so a core consumer never pays for DOM elements (the pure-core + subpath pattern, ADR-0065/0066).
*(→ PRD-G5; ADR-0115 cl.1)*
- **AC1** *Given* the package, *when* `router/src/layering.test.ts` runs, *then* every import under
  `router/src` resolves to `{@agent-ui/components, @agent-ui/shared}` or a local path, and the test
  goes RED under a planted upward import (negative control, unique token, grep-confirmed applied).
- **AC2** *Given* the repo, *when* grepped, *then* no source under `components/src`, `a2ui/src`, or
  `shared/src` imports `@agent-ui/router` — in particular the **catalog fence is structural**: the
  a2ui layer has no route to navigation.
- **AC3** *Given* a consumer importing only the barrel, *when* the tree-shake probe runs, *then*
  neither element class is in the output.

### 3.2 The headless core

**SPEC-R2 — Route state is a signal; navigation is a function; history is an in-memory stack.**
`createRouter(routes, options?)` MUST return an instance exposing: `route` (a
`ReadonlySignal<RouteMatch | null>`), `navigate(path, { replace? })`, `back()`, `forward()`, and
`dispose()`. `navigate` MUST push (or replace) an entry on the memory stack and update the signal
synchronously with kernel semantics — re-navigating to the identical resolved path is a no-op for
subscribers (doc-review F4: the observable contract; the kernel's `Object.is` cutoff alone is
insufficient since a freshly-constructed `RouteMatch` object never compares equal — the LLD owns the
mechanism via deliberate previous-match reuse, not restated here). `back()`/`forward()` MUST move the
stack index and MUST clamp silently at
the ends (no throw, no signal change). A push MUST truncate any forward tail (the platform's own
history semantics). `options.initial` seeds the first entry (default `'/'`). Core modules MUST satisfy
the headless invariant. The router is instance-scoped — multiple independent routers per host MUST
work. *(→ PRD-G1; ADR-0115 cl.2)*
- **AC1** *Given* a router in a DOM-less context, *when* the core suite runs with DOM globals absent,
  *then* construct/navigate/back/forward/read all pass (no reference error).
- **AC2** *Given* the static no-DOM gate, *when* a `window`/`document`/`location`/`history` reference
  is planted in `core/*.ts` (unique token), *then* the gate goes RED (negative control).
- **AC3** *Given* `navigate('/a') → navigate('/b') → back()`, *then* `route.value` matches `/a` and
  `forward()` returns to `/b`; *given* `back()` at index 0, *then* nothing changes and nothing throws;
  *given* back-then-push, *then* the old forward tail is gone.
- **AC4** *Given* two routers in one context, *when* one navigates, *then* the other's signal is
  untouched.

**SPEC-R3 — v1 matching grammar.** Patterns MUST support: static segments (`/settings`), `:param`
segments (`/items/:id` → `params.id`), and a trailing `*` catch-all (`/files/*` → the remainder as a
named capture). Matching MUST be against the pathname only, **declaration-order first-match-wins**,
with trailing-slash normalization (`/a/` ≡ `/a`; root `/` unaffected). The query string MUST be parsed
onto the match (`query`) and MUST NOT participate in matching. No record matching → `route.value` is
`null`. Anything beyond this grammar (nested, ranked, optional, regex) is OUT (PRD §3 fences).
*(→ PRD-G1; ADR-0115 cl.3)*
- **AC1** *Given* the table `[/items/new, /items/:id]` in that order, *then* `/items/new` matches the
  static record and `/items/7` yields `params.id === '7'`; *given* the reversed order, *then*
  `/items/new` matches `:id` (declaration order is the contract — the AC pins it, both directions).
- **AC2** *Given* `/files/*` and `navigate('/files/a/b.txt')`, *then* the capture is `'a/b.txt'`;
  *given* `navigate('/nope')` against a table without `*`, *then* `route.value === null`.
- **AC3** *Given* `navigate('/a/?x=1&y=2')`, *then* the match is the `/a` record with
  `query` `{x:'1', y:'2'}`; and a table has no way to express a query-dependent match.

### 3.3 URL reflection

**SPEC-R4 — Reflection is opt-in, one adapter, two strategies; the signal stays the single source of
truth.** Constructing a router MUST NOT touch the URL. `connectUrl(router, { mode? }) → cleanup` MUST
default to `mode:'hash'`. Outbound: a navigation MUST write the URL (hash form `#/path?query`; history
form via `pushState`, `replace` → `replaceState`). Inbound: at connect, a URL carrying a route MUST win
over the router's current route (**deep-link-wins**, replace semantics); an empty URL MUST get the
current route reflected out (`replaceState`-equivalent). External changes (`hashchange` / `popstate`)
MUST drive `navigate`. In history mode every written entry MUST be state-stamped with the memory index
(`{uiRouter:{index}}`), and a stamped `popstate` MUST re-point the memory index (browser back/forward
≡ `router.back()/forward()`); an un-stamped `popstate` falls back to path adoption (push semantics —
same rule as an external hash edit). A reflected write's own echo event MUST NOT re-navigate
(directional lock — the `coerceAttribute` reflect-lock precedent). `cleanup()` MUST remove all
listeners and restore pure memory operation. A second `connectUrl` on the same router without cleanup
MUST throw (two writers would fork the truth). *(→ PRD-G2; ADR-0115 cl.4)*
- **AC1** *Given* a router with NO adapter, *when* it navigates, *then* `location` is byte-unchanged
  (the memory-only negative control).
- **AC2** *Given* hash mode at `#/items/7`, *when* connected, *then* `route.value` matches `/items/7`
  (deep-link-wins); *given* an empty hash, *then* the hash becomes the current route without growing
  history length.
- **AC3** *Given* hash mode, *when* the user edits the hash externally, *then* the router navigates
  (push); *and* the adapter's own outbound write does not re-enter `navigate` (echo-lock leg: navigate
  count stays 1).
- **AC4** *Given* history mode, *when* `navigate('/a')` then `navigate('/b')` then **browser** back
  fires `popstate` with the stamped state, *then* `route.value` is `/a` AND `router.forward()` reaches
  `/b` (the stacks stayed aligned — the load-bearing leg).
- **AC5** *Given* `cleanup()`, *when* the router navigates again, *then* the URL is unchanged and no
  listener fires (zero residue); *given* a second `connectUrl` without cleanup, *then* it throws.
- **AC6** (doc-review F2 — the reload/restored-session path, previously LLD-only prose) *Given* a
  `popstate` whose stamped `{uiRouter:{index}}` index exceeds the current (freshly-constructed) memory
  stack's length — the shape a page reload or restored session produces, since the memory stack always
  starts at one entry while the browser stack may carry stamps from the prior page life — *then* the
  router MUST adopt the event's path as a new push (never throw, never desync) rather than attempt to
  resolve an index that does not exist in this session's stack.

### 3.4 The elements

**SPEC-R5 — `ui-router-outlet` renders the match through an element factory.** A light-DOM `UIElement`
with a property-only `router` (the instance; no attribute form). While attached to a router it MUST
render the matched record's `component(match)` element as its child; on route change it MUST swap —
the previous child removed (its `UIElement` teardown provably run: zero live effects/listeners). An
async factory (`Promise`) MUST resolve last-navigation-wins (a stale resolution is discarded, never
committed). A `null` match MUST render nothing. Un-assigned outlet renders nothing and MUST NOT throw.
Revisit does NOT restore prior child state (keep-alive is fenced; documented). *(→ PRD-G3; ADR-0115 cl.5)*
- **AC1** *Given* an outlet with `.router` assigned, *when* the route matches `/a`, *then* the `/a`
  factory's element is connected as the child; *when* the route changes to `/b`, *then* the `/a`
  element is disconnected (its connection scope disposed — assert via an effect probe) and `/b`'s
  renders.
- **AC2** *Given* a slow async factory for `/a` and a fast one for `/b`, *when* the user navigates
  `/a → /b` before `/a` resolves, *then* the committed child is `/b`'s and `/a`'s late resolution is
  discarded (the race leg; bites when the guard is removed).
- **AC3** *Given* `route.value === null`, *then* the outlet has no element child and does not throw.

**SPEC-R6 — `ui-router-link` navigates in-app with native anchor honesty.** A light-DOM `UIElement`
with `to` (string, reflected) and `replace` (boolean, reflected); router wiring via a class-level
`defaultRouter` static with per-instance `.router` override (provider discovery fenced). It MUST stamp
a real child `<a>` carrying an `href` derived from the router's attached URL strategy (hash form when
none — the documented memory-only degradation). Plain activation (unmodified click; Enter is native)
MUST `preventDefault` and call `navigate(to, {replace})` — **no document navigation**. Clicks with
`ctrl`/`meta`/`shift`/`alt` or a non-primary button MUST NOT be intercepted (native behavior).
The stamped anchor MUST carry `aria-current="page"` exactly when `to` equals the current resolved path
(exact match; prefix matching fenced), removed otherwise. No new public events (the route signal is
the notification surface); ARIA stays native-anchor (no internals override needed on the stamp).
*(→ PRD-G4; ADR-0115 cl.6)*
- **AC1** *Given* a wired link `to="/b"`, *when* plainly clicked (real click, browser leg), *then*
  outlet content swaps and the document does NOT navigate (no unload/beforeunload; `location`
  unchanged in memory mode) — Chromium AND WebKit.
- **AC2** *Given* the same link, *when* ctrl/cmd-clicked, *then* `preventDefault` was NOT called (the
  platform owns it) — asserted via a defaultPrevented probe.
- **AC3** *Given* hash reflection attached, *then* the stamp's `href` is `#/b`; *given* history mode,
  *then* `/b`; *given* memory-only, *then* the hash form (documented degradation) — and navigation
  still works via interception.
- **AC4** *Given* the current route `/b`, *then* only the `to="/b"` link's stamp carries
  `aria-current="page"`; navigating away removes it.

### 3.5 Fleet definition-of-done

**SPEC-R7 — The elements meet the standing component bar.** Both elements MUST ship `{name}.md`
descriptors (ADR-0004) with contract↔props trip-wires green; the active-link treatment MUST survive
`forced-colors: active` and MUST NOT rely on hue alone (the ADR-0057 non-color-signifier rule — the
`aria-current` state carries a non-color cue); an independent `component-reviewer` pass MUST record
COMPOSE ≥4 AND REALIZE ≥4 before the v1 commit; the package MUST carry a `measure-size.mjs` line-item
within the kickoff budget (provisional ≤ 4.0 KB gz marginal, manual gate per ADR-0040) and the
tree-shake proof of SPEC-R1 AC3. *(→ PRD-G5)*
- **AC1** *Given* the descriptors, *when* the trip-wires run, *then* they match
  `finalize(UIRouterOutletElement)`/`finalize(UIRouterLinkElement)` exactly.
- **AC2** *Given* `forced-colors: active` (browser), *then* the active-link indication remains legible
  (no ink vanish) and is not hue-only.
- **AC3** *Given* the finished elements, *then* component-reviewer records GO (both axes ≥4, zero
  blockers) before commit.
- **AC4** *Given* `npm run size`, *then* the `@agent-ui/router` line-item is within budget; a planted
  over-budget number fails (negative control).

### 3.6 Teaching

**SPEC-R8 — One live doc/demo page; the site stays MPA.** A `site/router-doc.html` page MUST demo
memory-mode navigation live (links + outlet + back/forward buttons) and show the one-line reflection
opt-in; the site nav/toc gates stay green; **no existing site page is converted to SPA routing**.
*(→ PRD-G6)*
- **AC1** *Given* the page, *when* `npm run check` (incl. `check:site`) + `npm run build` + the site
  gates run, *then* all green; the demo navigates without a page load (browser leg).

---

## 4. Typed contracts (behavioral — signatures normative in shape, not spelling; internals are the LLD's)

```ts
// headless core (the barrel)
interface RouteRecord  { path: string; component: (m: RouteMatch) => Element | Promise<Element> }
interface RouteMatch   { path: string; record: RouteRecord; params: Record<string,string>; query: Record<string,string> }
interface Router {
  readonly route: ReadonlySignal<RouteMatch | null>
  navigate(path: string, opts?: { replace?: boolean }): void
  back(): void
  forward(): void
  dispose(): void
}
declare function createRouter(routes: RouteRecord[], options?: { initial?: string }): Router
declare function connectUrl(router: Router, opts?: { mode?: 'hash' | 'history' }): () => void

// elements (subpaths only)
interface UIRouterOutletElement { router: Router | null }                    // property-only
interface UIRouterLinkElement   { to: string; replace: boolean; router: Router | null }
// + static UIRouterLinkElement.defaultRouter: Router | null
```

- **Events:** none at v1 — the route signal is the notification surface; the six-name event law is
  untouched. ARIA: the link's semantics live on the stamped native `<a>`; the outlet is a transparent
  container (no role).

## 5. Non-functionals

- **Cross-engine truth (gate):** SPEC-R6/R7/R8 browser legs pass in **Chromium AND WebKit**.
- **Budget (gate, manual):** the size line-item within the kickoff budget (SPEC-R7 AC4).
- **Layering (gate):** SPEC-R1 runs as a standing trip-wire.
- **Zero-dependency:** no runtime dependency beyond the two workspace packages; the history/matching
  logic is hand-rolled.

## 6. Traceability (this SPEC → PRD)

| SPEC-R | Requirement | Traces to |
|---|---|---|
| SPEC-R1 | package boundary, subpaths, structural catalog fence | PRD-G5 |
| SPEC-R2 | signal source of truth, memory stack, headless invariant | PRD-G1 |
| SPEC-R3 | v1 matching grammar | PRD-G1 |
| SPEC-R4 | opt-in reflection, two modes, one truth | PRD-G2 |
| SPEC-R5 | outlet factory seam, race guard, zero residue | PRD-G3 |
| SPEC-R6 | link interception, native honesty, aria-current | PRD-G4 |
| SPEC-R7 | fleet DoD + budget + reviewer | PRD-G5 |
| SPEC-R8 | doc/demo page, MPA preserved | PRD-G6 |

_All eight requirements trace to a PRD goal; every PRD-G is covered (G6's fence half lives in the PRD
§3 non-goals + ADR-0115 clause 7 — a deliberate non-requirement)._
