# PRD — SPA Router (`@agent-ui/router`: memory-first navigation + opt-in URL reflection)

> Status: **proposed · v0.1 (design intake) · Owner: agent-ui** — authored 2026-07-09 overnight by the design seat on Kim's verbatim ask ("a client-side SPA router — primarily memory-based, but with URL state reflection"); Kim was offline, so every fork is resolved with a firm argued recommendation in [ADR-0115](../adr/0115-spa-router-v1-scope.md) and this family proceeds to doc-review **unratified**. Ratification = doc-review + Kim's morning pass on ADR-0115.
> Altitude: this document owns **why + what-should-exist** for the router capability. The scope/architecture record is [ADR-0115](../adr/0115-spa-router-v1-scope.md); behavior contracts are [`../spec/router.spec.md`](../spec/router.spec.md); implementation is [`../lld/router.lld.md`](../lld/router.lld.md). Build decomp: [`../decompositions/router.decomp.json`](../decompositions/router.decomp.json) (coverage-clean, PLAN mode, strict tier).
> **Sibling-vs-extension ruling:** a **new sibling PRD**, not an extension of `agent-app-surfaces.prd.md` — that PRD's ratified §Out-of-scope explicitly excludes "a routing / SPA / data-fetching / state-management framework. App surfaces are UI chrome; the app brings its own router/store. — *this is a component tier, not an application framework*" (quoted in full; see ADR-0115 Context for the direct answer to the identity clause, not only the "router/store" half). This PRD does not reverse that non-goal: the router is a **separate opt-in package** the app tier never bundles — "bring your own" now includes ours, and no component-tier package acquires application-framework identity. The non-goal row gains a clarifying cross-link on ADR-0115's ratification; nothing else in that PRD changes.
> Grounding: grep 2026-07-08 — **no router exists anywhere in the repo** (the one mention is the non-goal above) · `packages/agent-ui/components/src/reactive/` (the signals kernel — route state is a signal, navigation a function; imports nothing) · `dom/element.ts` + `dom/index.ts` (UIElement lifetimes; `html``/render PRIVATE per ADR-0023 — the outlet seam constraint) · [ADR-0114](../adr/0114-text-hyperlink-href.md) (`ui-text as="a"` = fixed `_blank`/`rel` policy; its foreseen `target` extension is the named convergence) · [ADR-0082..0084](../adr/0082-app-shell-per-instance-isolation.md) + `m1-app-shell.decomp.json` (the new-package playbook this build clones) · CLAUDE.md (zero-dependency pillar; layering law).

## 1. Problem

An agent app built on this stack has **no way to switch surfaces**. The fleet ships the widgets
(`@agent-ui/components`), the generative layer renders agent payloads (`@agent-ui/a2ui`), and the app
tier frames them (`@agent-ui/app`) — but the moment an app has more than one screen (a console's
settings page, an agent workspace's per-conversation view, a gallery's per-item detail), the developer
hand-rolls navigation state: an ad-hoc "current view" variable, bespoke show/hide wiring, no history,
no deep links. The zero-dependency pillar forbids the obvious escape hatch (react-router/Vaadin-router
class libraries), so today the answer is "every app improvises."

**Why memory-first is the load-bearing framing** (Kim's exact ask: "primarily memory-based, but with
URL state reflection"): agent surfaces increasingly live where a URL is meaningless or unavailable — an
embedded canvas, a webview panel, a test harness. A router whose source of truth is the URL fails
those hosts and is untestable without DOM emulation. This stack already owns the right primitive: the
signals kernel. Route state as a **signal** + navigation as a **plain function** gives a router that
works in bare Node, in any embedded host, and in the browser identically — and URL reflection becomes
what it should have been all along: an **opt-in projection** of that state, never a second source of
truth.

**Who has the problem.** (1) *Consuming apps* on the stack — anything past one screen (the
agent-console class `agent-app-surfaces.prd.md` targets) currently improvises navigation. (2) *The repo
itself* — future multi-view demos and the app-shell tier's M2+ surfaces have no navigation primitive to
compose (the docs site stays MPA; it is a demo consumer, not the driver). (3) *Test authors* — no way
today to drive "the user navigated" as a plain state transition.

## 2. Goals & success metrics

Stable IDs; priority tiers; metrics baselined at **0 / not-possible-today** (nothing exists).
Milestones: **M1** = the package + core + reflection + elements + gates; **M2** = teaching/dogfood.
Downstream SPEC requirements trace to these IDs.

| ID | Priority | Outcome |
|---|---|---|
| **PRD-G1** | must (flagship) | An app switches surfaces **in memory**: route state is a signal, navigation/back/forward are function calls — zero URL coupling, zero DOM required |
| **PRD-G2** | must | **Opt-in URL reflection**: deep links, browser back/forward, shareable URLs — one source of truth (the signal), hash default + history opt-in |
| **PRD-G3** | must | A matched route becomes rendered content through `ui-router-outlet` (element-factory seam, lazy-loadable) |
| **PRD-G4** | must | Declarative in-app navigation through `ui-router-link` (real anchor semantics, modified-click passthrough, `aria-current`) |
| **PRD-G5** | must (cross-cutting) | The package holds every fleet pillar — zero-dep, layering law, size budget, descriptors, AT semantics, cross-engine proof |
| **PRD-G6** | should | Teaching + dogfood: a live docs/demo page; the A2UI catalog question answered by a **fence**, not silence |

**PRD-G1 — memory-first core (flagship).** `createRouter` + a route-table grammar (static · `:param` ·
trailing `*`), an in-memory history stack, `navigate`/`back`/`forward`, current route as
`ReadonlySignal` — with the **headless invariant**: core modules reference zero DOM globals.
- *Metric*: the core suite runs green with DOM globals absent/stubbed; the no-DOM gate bites on a
  planted `window` reference. *Baseline*: 0 (no router). *Target*: green. *Timeframe*: M1.

**PRD-G2 — URL reflection as projection.** `connectUrl(router, {mode})` — `'hash'` default (zero
server config), `'history'` opt-in (pushState + state-stamped stack sync); deep-link-wins adoption;
echo-loop directional lock; clean detach.
- *Metric*: reflection suite green both modes, incl. the echo-lock and stamped-index popstate legs; a
  router constructed WITHOUT the adapter never touches the URL (negative control).
- *Baseline*: 0. *Target*: green. *Timeframe*: M1.

**PRD-G3 — outlet.** Matched route → `component` factory (sync or lazy async) → child swap with
zero-residue teardown (the UIElement scope/abort contract) and last-navigation-wins race guard.
- *Metric*: outlet suite green incl. the stale-async-discard and disconnect-teardown legs.
- *Baseline*: 0. *Target*: green. *Timeframe*: M1.

**PRD-G4 — link.** A real stamped `<a>` (native semantics free), plain-activation intercept →
`navigate` (no page load), modified/middle-click native fallthrough, `aria-current="page"` on the
exact-active link, `href` derived from the attached URL strategy.
- *Metric*: cross-engine browser leg — a real click swaps outlet content with NO document navigation;
  a ctrl/cmd-click is untouched. *Baseline*: 0. *Target*: green in Chromium + WebKit. *Timeframe*: M1.

**PRD-G5 — fleet pillars (cross-cutting).** Zero-dep (hand-rolled, no history library);
`shared ← components ← {a2ui, router} ← app` with nothing importing upward (trip-wire); descriptors +
contract↔props trip-wires; forced-colors legibility; independent component-reviewer GO; size line-item
(provisional ≤ 4.0 KB gz marginal, manual gate) + tree-shake proof (core drags no elements).
- *Metric*: the fleet DoD gate set green. *Baseline*: n/a. *Target*: all green at M1. *Timeframe*: M1.

**PRD-G6 — teaching + the catalog fence.** A `router-doc` site page with a live memory-mode demo
(links + outlet + back/forward) and the reflection opt-in shown; the A2UI **catalog `Route`/`Router`
type is explicitly fenced** (ADR-0115 clause 7) with its trigger named — the question is answered, not
ignored. *Metric*: page ships, site gates green; the fence is recorded. *Baseline*: 0. *Target*:
shipped. *Timeframe*: M2.

## 3. Scope

**In scope (v1):**
- The `@agent-ui/router` package: headless core (matcher · memory history · router instance),
  the `connectUrl` reflection adapter (hash + history strategies), `ui-router-outlet`,
  `ui-router-link`, descriptors, gates, size line-item, doc/demo page.
- The route-match shape: `params` (from `:param`/`*`), `query` (parsed, not matched), the matched
  record, the resolved path.
- Lazy routes: async `component` factories (code-splitting seam), last-navigation-wins.

**Out of scope (v1) — each with reason + trigger:**
- **An A2UI catalog `Route`/`Router` type (agent-driven navigation).** Trust surface of its own — an
  agent redirecting the app wants the ADR-0034 gate posture and its own record. *Trigger*: a real
  agent-app consumer asks; intake cites ADR-0115 clause 7. The package DAG (a2ui has no router edge)
  enforces the fence structurally meanwhile.
- **Nested routes/layouts, route ranking, optional/regex segments.** v1 grammar is deliberately small;
  declaration-order is predictable. *Trigger*: a consumer with a real layout hierarchy.
- **Guards/redirects/middleware, data loaders.** Framework territory; the signal + a computed covers
  simple cases. *Trigger*: repeated consumer re-implementation (the ADR-0102 "taught idiom vs
  component-owned" test).
- **Scroll restoration · view transitions · keep-alive outlet state.** Real polish, real records —
  after the primitive proves itself. *Trigger*: dogfood friction on the doc page or first app.
- **Declarative `<ui-route>` children sugar + a provider/context discovery element.** Composition sugar
  over the v1 factory table and `defaultRouter` wiring (ADR-0115 forks F3/F4). *Trigger*: markup-heavy
  consumers; the provider clones ADR-0050.
- **Converting the docs site to an SPA.** The site stays MPA; it *demos* the router on one page.
  *Trigger*: none foreseen — the MPA is a deliberate architecture, not a gap.
- **`ui-text as="a"` in-app interception.** Blocked on ADR-0114's foreseen `target` extension; a
  separate intake when it lands (ADR-0115 fork F5).

## 4. Users & primary flows

1. **App developer, memory-only (embedded canvas/panel):** `createRouter([...routes])` →
   `outlet.router = router` + `UIRouterLinkElement.defaultRouter = router` → surfaces switch in-app;
   no URL is ever touched.
2. **App developer, URL-reflected SPA:** the same, plus `connectUrl(router)` (hash) or
   `connectUrl(router, {mode:'history'})` — deep links restore, browser back/forward work, URLs share.
3. **Test author:** construct a router in a bare test, `navigate('/x')`, assert on `route.value` — no
   DOM, no emulation.
4. **Agent-app shell (forward-looking, M2+ of the app tier):** `agent-app-shell`'s main region hosts an
   outlet; navigation stays developer-authored (the catalog fence holds).

## 5. Ratification state

All direction forks are **resolved-by-recommendation** in ADR-0115 (F1 package home · F2 hash default ·
F3 factory outlet seam · F4 link wiring · F5 dedicated link) — argued, documented, and awaiting Kim's
morning pass; the ADR stays `proposed` (never self-flipped). SPEC/LLD are authored against those
recommendations so the build is dispatch-ready the moment Kim ratifies; if he overturns a fork, the
SPEC/LLD sections that consume it are enumerated in the LLD's risk table for surgical repair.
