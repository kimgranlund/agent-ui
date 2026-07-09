# LLD — SPA Router v1 (`@agent-ui/router`)

> Status: proposed · v0.1 · 2026-07-09 · Layer: LLD (implementation plan)
> Implements: [`../spec/router.spec.md`](../spec/router.spec.md) (`SPEC-R1…R8`). Realizes [ADR-0115](../adr/0115-spa-router-v1-scope.md) (**proposed — NOT self-ratified**; forks F1–F5 resolved-by-recommendation; build dispatch waits on Kim's morning pass).
> Decomposition: [`../decompositions/router.decomp.json`](../decompositions/router.decomp.json) (coverage-clean, strict tier; nodes n1a…n7 ≈ the components below). Build-order edges are the decomposition's.
> Altitude: owns **how v1 is built** — file map, concrete interfaces, per-component failure/edge handling, and the build sequence. Behavior is the SPEC's; this doc never re-derives it.

## 1. Component map (LLD-C# → SPEC-R#, → decomp node)

| LLD-C | Component | Files | Implements | Decomp |
|---|---|---|---|---|
| **LLD-C1** | package skeleton | `packages/agent-ui/router/{package.json,tsconfig.json}` + root workspace row | SPEC-R1 | n1a |
| **LLD-C2** | layering trip-wire | `router/src/layering.test.ts` | SPEC-R1 | n1b |
| **LLD-C3** | route matcher | `router/src/core/matcher.ts` (+ `matcher.test.ts`) | SPEC-R3 | n2a |
| **LLD-C4** | memory history | `router/src/core/history.ts` (+ `history.test.ts`) | SPEC-R2 | n2b |
| **LLD-C5** | router instance + no-DOM gate | `router/src/core/router.ts` (+ `router.test.ts`, `headless.test.ts`) | SPEC-R2 | n2c |
| **LLD-C6** | URL reflection adapter | `router/src/url.ts` (+ `url-hash.test.ts`, `url-history.test.ts`) | SPEC-R4 | n3a, n3b, n3c |
| **LLD-C7** | `ui-router-outlet` | `router/src/controls/router-outlet/{router-outlet.ts,router-outlet.md,router-outlet.test.ts}` | SPEC-R5, R7 | n4a |
| **LLD-C8** | `ui-router-link` | `router/src/controls/router-link/{router-link.ts,router-link.css,router-link.md,router-link.test.ts}` | SPEC-R6, R7 | n4b |
| **LLD-C9** | browser legs + size + reviewer | `router/src/router.browser.test.ts` · `scripts/measure-size.mjs` row · reviewer record | SPEC-R6, R7 | n5b, n5c, n5d |
| **LLD-C10** | barrel/subpaths + doc page | `router/src/index.ts` · `package.json` exports · `site/router-doc.{html,ts}` | SPEC-R1, R8 | n7, n6a |

No orphan components (each traces to a SPEC-R); no SPEC-R without a component.

## 2. LLD-C1 — package skeleton (→ SPEC-R1)

`packages/agent-ui/router/package.json`:
```jsonc
{
  "name": "@agent-ui/router",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",                                        // headless core + types ONLY
    "./router-outlet": "./src/controls/router-outlet/router-outlet.ts",
    "./router-link":   "./src/controls/router-link/router-link.ts",
    "./router-link.css": "./src/controls/router-link/router-link.css"
  },
  "dependencies": { "@agent-ui/components": "*", "@agent-ui/shared": "*" }
}
```
`tsconfig.json` extends the repo strict base. Root workspace list gains the package.

**Failure/edge handling.**
- *Name collision / resolution failure* — `npm run check` errors at install; verify the name is free first.
- *Emit posture* — exports point at `.ts` source (the fleet's ADR-0080 pattern); the `dist/` flip rides the fleet-wide deferral.
- *Do NOT export the elements from the barrel* — the SPEC-R1 AC3 tree-shake proof depends on it; a
  future "convenience re-export" PR is the regression to watch (documented in the barrel header).

**Checkpoint:** `npm run check` exits 0; no other package.json changed.

## 3. LLD-C2 — layering trip-wire (→ SPEC-R1)

`router/src/layering.test.ts` mirrors `app/src/layering.test.ts`: every import specifier under
`router/src/**` resolves to `{@agent-ui/components, @agent-ui/shared}` or local; a repo grep asserts no
source under `components/src`, `a2ui/src`, `shared/src` imports `@agent-ui/router`.

**Failure/edge handling.**
- *Negative control (required)* — plant an upward import on a unique token in `a2ui/src`; grep-confirm applied; the test MUST go red; revert.
- *Dynamic-`import()` blind spot* — the static regex is blind to `import()` (the same documented gap as the app/components trip-wires); the outlet's lazy factories are CONSUMER code, not package imports, so no dynamic import exists under `router/src` at v1 — document, don't pretend coverage.

**Checkpoint:** `npm test` green incl. the trip-wire; NC bit and was reverted.

## 4. LLD-C3 — matcher (→ SPEC-R3)

```ts
// core/matcher.ts — pure functions; no state, no DOM.
export interface CompiledRoute { record: RouteRecord; segments: Segment[] }   // Segment = static | param(name) | wildcard
export function compile(routes: RouteRecord[]): CompiledRoute[]               // split('/'), classify; throws on '*' not-last
export function match(compiled: CompiledRoute[], path: string): RouteMatch | null
```
`match` normalizes (strip one trailing slash, split query off first), walks records **in declaration
order**, segment-compares (static exact; `:x` captures non-empty; trailing `*` captures the remainder
incl. `/`), parses query via `URLSearchParams` (available in Node ≥ 10 — NOT a DOM global; the headless
invariant holds).

**Failure/edge handling.**
- *`*` not in last position / empty pattern* — `compile` throws at router construction (developer error, loud + early, never at navigate time).
- *Empty `:param` segment* (`/items//x`) — no match for that record (a param never captures empty).
- *Duplicate param names in one pattern* — last-wins, documented (not an error; not worth a validator at v1).
- *URL-encoded segments* — params are `decodeURIComponent`-ed once; a malformed escape falls back to the raw segment (never throws — the model for hostile input is "no match or raw", not exceptions).

**Checkpoint:** matcher suite green incl. SPEC-R3 AC1's both-orders leg.

## 5. LLD-C4 — memory history (→ SPEC-R2)

```ts
// core/history.ts — a tiny class; no DOM.
export class MemoryHistory {
  entries: string[]; index: number
  push(path): void      // truncates forward tail, appends, index++
  replace(path): void   // swaps entries[index]
  go(delta): string | null   // clamps; null when out of range (caller no-ops)
  setIndex(i): string | null // the URL adapter's stamped-popstate re-point seam
}
```

**Failure/edge handling.**
- *`go` past either end* — returns `null`; the router no-ops (SPEC-R2 AC3's clamp leg).
- *`setIndex` out of range* (a stale/foreign stamp) — returns `null`; the adapter falls back to path adoption (SPEC-R4's un-stamped rule).
- *Unbounded growth* — v1 accepts it (a session's navigations are small); a max-length cap is named future work, not built.

**Checkpoint:** history suite green.

## 6. LLD-C5 — router instance (→ SPEC-R2)

```ts
// core/router.ts
export function createRouter(routes: RouteRecord[], options?: { initial?: string }): Router
```
Composition: `compile(routes)` once; a `MemoryHistory` seeded with `options.initial ?? '/'`; one
`signal<RouteMatch | null>` set via a single internal `commit(path)` (match → signal write). `navigate`
= push/replace + commit; `back`/`forward` = `go(±1)` + commit (skip on `null`). `dispose()` marks the
instance dead (subsequent navigations throw in dev — see edges). **Signals are created `unowned`** (the
kernel's module-singleton rule): a router constructed inside some component's connected scope must not
die with that component.

The **no-DOM gate** (`headless.test.ts`): a static scan asserting `core/*.ts` contains no
`window|document|location|history` token outside comments/strings — plus a functional leg running the
core with `globalThis` DOM entries deleted.

**Failure/edge handling.**
- *Identical-path re-navigate* — same resolved path ⇒ same match value? NO: a fresh `navigate` to the same path still pushes an entry (history semantics) but the signal write is cut off only if the produced `RouteMatch` is `Object.is`-equal — it never is (fresh object). Decision: `commit` short-circuits when path AND record AND param/query shape are equal, **reusing the previous match object** so the kernel cutoff fires and subscribers stay quiet (SPEC-R2's no-op contract). The equality helper is unit-locked.
- *Navigate after dispose* — dev-mode throw with the instance's creation site named; production no-op is NOT offered (fail loud — one behavior).
- *Throwing component factory* — not this layer's concern (the outlet owns it, LLD-C7).
- *Routes array mutated after construction* — `compile` snapshots; later mutations are inert, documented.

**Checkpoint:** router + headless suites green; the planted-DOM-token NC bit.

## 7. LLD-C6 — URL reflection (→ SPEC-R4) — the primary v1 risk

```ts
// url.ts — the only file that touches location/history APIs.
export function connectUrl(router: Router, opts?: { mode?: 'hash' | 'history' }): () => void
```
One adapter, two strategy objects behind a tiny interface `{ read(): string | null, write(path, replace), onExternal(cb): cleanup }`:
- **hash**: `read` = `location.hash.slice(1) || null`; `write` = set `location.hash` (replace via
  `location.replace('#…')` to avoid an extra entry); `onExternal` = `hashchange`.
- **history**: `read` = `location.pathname + location.search`; `write` = `pushState/replaceState` with
  `{ uiRouter: { index } }` (index read from the router's memory stack at write time); `onExternal` =
  `popstate` — stamped state → `router.setIndex`-path (via an internal seam on the instance), else
  adopt-as-push.

The sync core (mode-independent): an `effect` on `router.route` drives outbound writes; a **directional
lock** (`let writing = false` around outbound; inbound handler no-ops while set — the `coerceAttribute`
precedent) kills echo loops; adoption at connect implements deep-link-wins; all listeners ride ONE
`AbortController`; `cleanup()` aborts + disposes the effect + clears the router's `connected` mark
(second `connectUrl` while marked throws, SPEC-R4 AC5).

**Failure/edge handling.**
- *Echo loops* — the lock covers BOTH directions (outbound write → its own event; inbound adoption → its own reflected write). The jsdom legs assert navigate-count === 1 each way.
- *Foreign/stale `popstate` state* (another library's state object, a restored session) — treat as un-stamped: adopt the path as a push. Never throw on unrecognized state shapes.
- *Hash mode with a non-route hash* (`#section-anchor`) — reads as a candidate path, matches nothing → `route.value = null`… which would clobber an in-app anchor idiom. v1 rule: a hash NOT starting with `/` is **not ours** — ignored on read, and outbound writes only `#/…` forms. Documented; the doc page shows it.
- *`history` mode on a static host* — deep links 404 at the SERVER, invisible to us; the doc page and the descriptor carry the warning (this is exactly why hash is the default — ADR-0115 F2).
- *jsdom fidelity* — jsdom implements `pushState`/`popstate`/`hashchange` but does NOT fire `popstate` on programmatic `history.back()` in all versions; the jsdom legs dispatch synthetic `PopStateEvent`s with stamped state, and the REAL back/forward truth is a browser leg (LLD-C9). The instrument-bridge discipline: tool substituted, behavior proven cross-engine, re-test trigger named.
- *SSR/no-`location` host* — `connectUrl` throws immediately when `location` is absent (it is the URL adapter; headless hosts simply don't call it).

**Checkpoint:** both mode suites green incl. echo-lock, stamped-index, cleanup legs.

## 8. LLD-C7 — `ui-router-outlet` (→ SPEC-R5, R7)

`UIElement`, light DOM, **property-only** `router` prop (`prop.object`-class, no attribute). In
`connected()`: `this.effect(() => …)` reads `this.router?.route.value`, bumps a navigation token, and
resolves the record's factory — sync ⇒ swap now; async ⇒ `then(el => token-still-current && swap(el))`.
`swap` = remove previous child (platform disconnect runs the child's UIElement teardown), append next.
Descriptor `router-outlet.md`: `extends: UIElement`, no parts/states (a transparent container).

**Failure/edge handling.**
- *Stale async resolution* — the token guard discards it (SPEC-R5 AC2); the test bites with the guard removed (negative control).
- *Factory throws / rejects* — the outlet clears its child and logs a dev error naming the route path; it does NOT retry and does NOT render a partial. (An error-boundary seam is future work, named.)
- *Factory returns a non-Element* — dev throw with the record's path (developer error, loud).
- *`router` re-assigned* — the effect re-reads (a signal-backed prop); the old router's route stops driving; no residue (the ONE effect owns everything).
- *Outlet disconnect mid-async* — the connection scope disposes the effect; the token check ALSO fails (token bumped never matches) — belt and suspenders.

**Checkpoint:** outlet suite green; descriptor trip-wire green.

## 9. LLD-C8 — `ui-router-link` (→ SPEC-R6, R7)

`UIElement`, light DOM. Props: `to` (string, reflected) · `replace` (boolean, reflected) · `router`
(property-only, default `null` ⇒ falls back to `UIRouterLinkElement.defaultRouter` — a class static,
`null`-initialized). Render: stamps ONE child `<a>` (created imperatively in `connected()`, no `html``` needed),
re-applied on prop change via `this.effect`: `href` = strategy-derived (the router instance exposes its
attached strategy's `format(path)`; hash form when none), textContent/children stay the author's
(the anchor WRAPS the light content — the stamp pattern: the host's authored children are moved into
the anchor once at connect, the ADR-0078 stamp discipline adapted). Listeners via `this.listen`:
`click` → if plain primary click: `preventDefault(); router.navigate(to, {replace})`. `aria-current`:
an effect compares `router.route.value?.path` to the resolved `to`, sets/removes the attribute **on the
stamped anchor** (native link semantics; internals-ARIA is for hosts, the anchor is a real link).
`router-link.css`: underline + ink on the anchor; `[aria-current="page"]` leg adds a non-color cue
(weight or underline-thickness — build picks under ADR-0057) + forced-colors leg.

**Failure/edge handling.**
- *No router anywhere* (no instance, no default) — the link renders its anchor (hash-form href) and a
  plain click is NOT intercepted (native hash navigation proceeds — honest degradation, documented);
  a dev warning fires once.
- *Modified/middle clicks* — the guard checks `button !== 0 || ctrlKey || metaKey || shiftKey || altKey` FIRST and returns before any `preventDefault` (SPEC-R6 AC2's probe).
- *`to` changes while active* — the aria-current effect re-evaluates (both `to` and `route` are signals).
- *Enter key* — native anchor activation synthesizes a click; no separate keydown path (do NOT add one — double-fire risk; the checkbox lesson).
- *`defaultRouter` set after links connected* — the static is read per-activation (not cached at connect) so late wiring works; href re-derivation on late wiring is NOT reactive (a static isn't a signal) — documented: set the default before mounting links, or use instance props. The fenced provider extension is the real fix.
- *Nested interactive content* (a button inside a link) — the click guard ignores events whose target is an interactive element other than the stamp (`closest('a') !== stamp` check); documented as an authoring anti-pattern regardless.

**Checkpoint:** link suite green; descriptor trip-wire green.

## 10. LLD-C9 — browser legs · size · reviewer (→ SPEC-R6, R7)

`router.browser.test.ts` (Chromium + WebKit): real-click SPA guarantee (click → outlet swap, no
document navigation — a `beforeunload` probe + `location` assert) · modified-click fallthrough ·
`aria-current` visible + forced-colors legibility · whole-shape non-zero boxes for swapped content ·
**history-mode real back/forward** (the jsdom-bridged leg from LLD-C6, proven here on real engines).
`measure-size.mjs` gains ONE `@agent-ui/router` row (serial integration slice; provisional budget
**≤ 4.0 KB gz marginal**, recorded at kickoff). Reviewer: `component-reviewer` GO ≥4 both axes on both
elements BEFORE the v1 commit — non-optional (the ui-slider DOT lesson).

**Failure/edge handling.**
- *One-engine pass* — is a fail (the fleet's 18-bug Wave-4 lesson); every leg runs both engines.
- *Negative controls* — each new gate ships one: the SPA leg bites when interception is disabled; the size gate bites on a planted number; the race leg bites without the token guard.
- *WebKit `userEvent` quirks near overlays* — none expected (no popovers here); if hit, the instrument-bridge pattern applies (substitute tool, prove behavior, name the re-test trigger).

**Checkpoint:** browser suite green both engines; size row within budget; reviewer GO recorded.

## 11. LLD-C10 — barrel/subpaths + doc page (→ SPEC-R1, R8)

`src/index.ts`: `createRouter`, `connectUrl`, types — **not** the elements (tree-shake contract; header
comment names the regression). `site/router-doc.html` + `site/router-doc.ts`: a live memory-mode demo
(3 routes, links, outlet, back/forward buttons reading the same router), a reflection opt-in snippet,
the hash-vs-history guidance, the memory-only href degradation note. Site nav/toc rows added; the site
stays MPA (SPEC-R8).

**Failure/edge handling.**
- *Site drift gates* — the new page lands with its nav/toc rows in the same slice (the gates fail loudly otherwise — that's their job).
- *Demo double-router* — the page constructs its router once at module scope (`unowned` by construction — module scope has no owner); HMR re-runs are a dev-only artifact, documented in the page source.

**Checkpoint:** `check` (incl. site) + `build` + site gates green.

## 12. Build sequence (dependency-ordered — matches the decomp edges)

1. **LLD-C1** skeleton *(serial PREP; `check` 0)*
2. **LLD-C2** trip-wire + NC *(after C1)*
3. **LLD-C3 + LLD-C4** matcher · history *(parallel, file-disjoint, after C1)*
4. **LLD-C5** router instance + no-DOM gate *(after C3+C4)*
5. **LLD-C6** URL adapter *(after C5)*
6. **LLD-C7 + LLD-C8** outlet · link *(parallel, file-disjoint, after C5)*
7. **LLD-C10a** barrel/subpaths *(serial integration, after C6+C7+C8)*
8. **LLD-C9** browser legs *(after C7+C8)*; size row *(after C10a)*
9. **LLD-C10b** doc page *(after C7+C8; parallel with C9)*
10. **Reviewer gate** *(after C9; before the v1 commit)*

## 13. Risks & fork-overturn map (Kim's morning pass)

| Risk / fork overturned | Blast radius (surgical repair) |
|---|---|
| **F1 package home** (→ inside components) | LLD-C1/C2 die; C3–C8 relocate under `components/src/router/`; ADR-0040 barrel budget re-opens; SPEC-R1 rewrites — the ONE fork that reshapes the family; argued hardest in ADR-0115 |
| **F2 default mode** (→ history default) | One default constant + SPEC-R4 AC ordering + doc-page guidance; small |
| **F3 outlet seam** (→ declarative `<ui-route>`) | LLD-C7 re-specs; SPEC-R5 rewrites; matcher/history/reflection untouched |
| **F4 link wiring** (→ provider element) | LLD-C8's default-static paragraph swaps for an ADR-0050-clone provider component (new LLD-C); SPEC-R6 wiring sentence changes |
| **F5 link vehicle** (→ ui-text reuse) | Blocked on ADR-0114's `target` extension landing first; LLD-C8 would shrink to an interception adapter — flagged as the costlier path in ADR-0115 |
| Two-stack drift (history mode) | The stamped-index mechanism + SPEC-R4 AC4 + the real-engine leg (LLD-C9) — the highest-risk seam, triple-gated |
| jsdom popstate fidelity | Bridged synthetically in C6, proven real in C9 (instrument-bridge, trigger named) |
| Non-route hash collision (`#anchor`) | The `#/`-prefix ownership rule (LLD-C6); doc'd |
| Budget breach | Manual size gate + the C9 checkpoint; re-base needs its own ADR (the ADR-0049 precedent) |

## 14. Failure/edge summary (cross-cutting)

- **Hostile input never throws at navigate time** — bad escapes, foreign state, unknown paths all
  degrade to no-match/adoption; the ONLY construction-time throws are developer errors (`*` not-last,
  double `connectUrl`, non-Element factory).
- **Zero residue everywhere** — every listener rides an AbortController (element connection signal or
  the adapter's own); every effect is scope-owned or explicitly disposed; the SPEC's teardown ACs are
  the proof, not the intention.
- **Single-writer discipline** — only C10a writes the barrel; only C9 writes `measure-size.mjs`; the
  site slice owns its own files; everything else is file-disjoint per the decomp.
- **Negative-control discipline** — every new gate ships a biting NC, grep-confirmed applied before
  trusting green.
