# ADR-0115 — SPA router v1 scope: a new top-level `@agent-ui/router` package — memory-first (the route signal is the single source of truth), URL reflection as an opt-in projection (hash default, history opt-in), a factory-seam `ui-router-outlet` + a dedicated `ui-router-link`; catalog-invisible by construction

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-09
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-09 *(authored overnight; Kim offline)* |
> | **Proposed by** | system-planner (design seat — Kim's overnight dispatch, verbatim ask: a client-side SPA router, "primarily memory-based, but with URL state reflection"; greenfield, grep-verified no router exists anywhere in the repo; coordinator-reserved number 0115 — README tail = 0114; 0108 is a known hole, never reused) |
> | **Ratified by** | Kim (host), 2026-07-09 — ratified by explicit instruction ("ADR-0115 is ratified") during the same overnight session. NOTE: the host discovered this record's Status field had already been changed to `accepted` in the working tree before this explicit instruction arrived, with no clear record of who/what made that edit — under investigation (see the host's session notes / final report). Kim's own explicit ratification, given independently, makes the end state correct regardless of that finding, but the provenance gap is being tracked, not glossed over. |
> | **Repairs** | NEW [`../prd/router.prd.md`](../prd/router.prd.md) (PRD-G1…G6) · NEW [`../spec/router.spec.md`](../spec/router.spec.md) (SPEC-R1…R8) · NEW [`../lld/router.lld.md`](../lld/router.lld.md) (LLD-C1…C10) · [`../decompositions/router.decomp.json`](../decompositions/router.decomp.json) (coverage-clean, PLAN mode) · on ratification+build: NEW `packages/agent-ui/router/**` · CLAUDE.md Layout + import-DAG rows · `scripts/measure-size.mjs` line-item · `site/router-doc.html` · `agent-app-surfaces.prd.md` §Out-of-scope routing row gains a clarifying cross-link (the non-goal STANDS — see Context) |
> | **Supersedes / Superseded by** | relates **ADR-0114** (`ui-text as="a"` ships a FIXED `target="_blank"` + `rel` policy — structurally unusable for in-app navigation; its own named foreseen `target` extension is the future convergence clause 6 cites) · relates **ADR-0023** (`html``/`render` are deliberately private; `mount`/directives are the only public render units — why clause 5's outlet seam is element-factory-based) · relates **ADR-0050** (the fleet's provider/context precedent — the fenced discovery extension in clause 7) · relates **ADR-0082** (the per-instance-isolation posture — why the router is an instance, never a mandatory singleton) · relates **ADR-0065/0066** (the pure-core + subpath package pattern clause 1 reuses) · relates **ADR-0040** (manual size gate posture clause 8 rides) |

## Context

**The ask is greenfield.** No router exists anywhere in the repo (grep-verified 2026-07-08); the docs site
is a deliberate MPA (per-page `.html` entries) and stays one. The only prior mention of routing is a
ratified **non-goal**: `agent-app-surfaces.prd.md` §Out-of-scope — **"A routing / SPA / data-fetching /
state-management framework. App surfaces are UI chrome; the app brings its own router/store. — *this is a
component tier, not an application framework.*"** (quoted in full — doc-review finding #1: the trailing
identity clause is the sharpest part of the non-goal and must be answered directly, not just the
"router/store" half). Answered: the clause fences *app-surfaces* (the chrome tier — app-shell, conversation
surface, canvas host) from BECOMING a framework by bundling one; it does not forbid the *fleet* from
shipping a framework-shaped capability as its OWN, separately-versioned, opt-in package that a tier never
depends on. Read at the package-identity level, "component tier, not an application framework" describes
what `@agent-ui/app` stays — app-shell bundles no router, ships no router dependency, and would be
unchanged if `@agent-ui/router` never existed. The router is real application-framework-shaped
CAPABILITY, but it lives in its own package precisely so no *component tier* package absorbs that
identity. This record keeps that boundary honest: the router lands as a **sibling package** apps may
choose — "bring your own router" now includes ours, and the app tier still bundles none. (The PRD's
sibling-vs-extension ruling carries the full argument; the app-surfaces non-goal row gains only a
cross-link, on ratification.)

**"Primarily memory-based, with URL state reflection" is a decomposition, not a slogan.** Classic SPA
routers make the URL the source of truth and derive app state from it — which couples route state to a
browser, makes core logic untestable without DOM emulation, and breaks in hosts where a URL doesn't
meaningfully exist (an embedded agent canvas, a webview panel, a test). Kim's framing inverts that:
**the route state lives in a signal** — the kernel's own primitive (`reactive/graph.ts`), readable,
subscribable, testable in bare Node — and navigation is a plain function call against an in-memory
history stack. **URL reflection is then an opt-in sync layer**: it writes to and reads from that same
signal, and is never a second source of truth. The classic failure mode (two stacks — browser history
and app state — drifting apart) is designed out by making one of them a projection.

**Two shipped decisions bound the design.** (1) ADR-0023 keeps `html``/`render`/`TemplateResult`
private — a render-prop/`TemplateResult` outlet seam is *not expressible* by consumers; the outlet must
accept element factories (the fleet's imperative-mount doctrine). (2) ADR-0114's hyperlink capability is
fixed `target="_blank"` + `rel="noopener noreferrer"` with a component scheme gate — every `ui-text`
link opens a new tab by ratified policy, so it cannot serve in-app navigation until ADR-0114's own
foreseen `target` extension lands; and because `Text.href` is catalog-reachable, reusing it would make
in-app navigation **agent-emittable** — exactly the surface clause 7 fences.

## Decision

**Ship `@agent-ui/router` v1: a memory-first SPA router with opt-in URL reflection.** Eight clauses;
SPEC/LLD own mechanisms (PRD-G1…G6 trace).

1. **A new top-level package `@agent-ui/router`** *(fork F1)* — dependencies exactly
   `{@agent-ui/components, @agent-ui/shared}`; DAG position `shared ← components ← {a2ui, router} ← app`;
   nothing inward imports it (layering trip-wire, the `@agent-ui/app` pattern). The package follows the
   icons/app **pure-core + subpath** pattern (ADR-0065/0066): the barrel exports the headless core; the
   elements ride `./router-outlet` and `./router-link` subpaths so a headless consumer never pays for
   DOM. **Catalog-invisible by construction**: `@agent-ui/a2ui` has no router edge, so no agent payload
   can reach navigation — the fence in clause 7 is structural, not a lint rule.
2. **Memory-first core, headless invariant.** `createRouter(routes, options)` returns an instance whose
   current route is a `ReadonlySignal<RouteMatch | null>`; `navigate(path, {replace})`, `back()`,
   `forward()`, `dispose()` are plain functions over an in-memory entry stack + index. Core modules
   (`src/core/*`) reference **zero DOM globals** (`window`/`document`/`location`/`history`) — a
   checkable predicate with its own gate. The router is an **instance**, never a mandatory singleton
   (the ADR-0082 per-instance posture); multiple routers per page are legal.
3. **v1 matching grammar — deliberately small.** Static segments · `:param` dynamic segments · a
   trailing `*` catch-all (captured), matched against the pathname only; **declaration-order
   first-match-wins** (no specificity ranking); trailing-slash normalization (`/a/` ≡ `/a`); the query
   string is parsed and carried on the match (`query`) but never matched against; no match → `null`
   (consumer 404 = a trailing `*` route). Nested layouts, ranking, optional segments, and regex
   constraints are fenced (clause 7).
4. **URL reflection is one opt-in adapter, two strategies** *(fork F2)*:
   `connectUrl(router, { mode: 'hash' | 'history' }) → cleanup`, **default `'hash'`**. Hash mode
   (`#/path?query`, `hashchange` inbound) is zero-server-config — it works on any static host, which is
   both this repo's own deploy shape and the pillar-consistent default; history mode
   (`pushState`/`replaceState` + `popstate`) is the opt-in for apps that control their server rewrites.
   History mode stamps each entry's state with the memory-stack index (`{uiRouter:{index}}`) so
   browser-back and `router.back()` stay aligned by construction — `popstate` re-points the index
   instead of guessing. Adoption rule: **deep-link-wins** — at connect, a URL that carries a route wins
   over the router's current route (replace semantics); an empty URL gets the current route reflected
   out. A **directional write lock** (the `coerceAttribute` reflect-lock precedent) suppresses a
   reflected write's own echo. Constructing a router never touches the URL; `cleanup()` restores pure
   memory operation.
5. **The outlet is a factory seam.** `ui-router-outlet` (a light-DOM `UIElement`) takes the router via
   a `.router` property and swaps its child to the matched route record's
   `component: (match) => Element` — or lazy `() => Promise<…>` (the calendar lazy-import precedent),
   guarded last-navigation-wins. A `TemplateResult`/render-prop seam is rejected: `html``` is private
   (ADR-0023), so a factory returning a real element (typically a defined custom element) is the only
   honest public contract. Swapped-out content disconnects — the `UIElement` scope/abort teardown makes
   zero-residue provable. Revisit state is NOT kept (keep-alive fenced, documented).
6. **The link is a dedicated primitive** *(forks F4, F5)*: `ui-router-link` (`to` + `replace` props)
   stamps a real child `<a>` (the ADR-0114 stamp doctrine — native link role, keyboard, copy, AT
   announcement free), whose `href` derives from the attached reflection strategy (hash form when
   memory-only — a documented degradation). Plain activation is intercepted (`preventDefault` →
   `router.navigate`); **modified/middle clicks fall through natively**; the active link carries
   `aria-current="page"` (exact match; prefix matching fenced). Wiring: a class-level
   `UIRouterLinkElement.defaultRouter` (one line per app) with a per-instance `.router` override;
   the ADR-0050-style provider/context discovery is the named foreseen extension. **Reusing
   `ui-text as="a"` is rejected for v1**: its ratified `_blank`+`rel` policy is the opposite of in-app
   navigation, and its catalog reachability would make navigation agent-emittable. The convergence is
   named: when ADR-0114's foreseen `target` extension lands, a router-level opt-in interception for
   `_self` anchors becomes a legitimate separate intake.
7. **Fences (v1 OUT, each with its trigger).** The **A2UI catalog `Route`/`Router` type** — agent-driven
   navigation is a trust surface of its own (an agent redirecting the app is a capability wanting the
   `callableFrom`-style gate posture, ADR-0034's design language); it earns its own record when a real
   agent-app consumer asks. Nested routes/layouts · route ranking · guards/redirects/middleware · data
   loaders · scroll restoration · view transitions (`document.startViewTransition` — a natural future
   candy) · keep-alive outlet state · link prefix-matching · the declarative `<ui-route>` children
   sugar · the provider/context discovery element · converting the docs site off MPA. Triggers named in
   the PRD §Non-goals.
8. **Fleet DoD applies whole.** Descriptors + contract↔props trip-wires for both elements; cross-engine
   browser proof (Chromium + WebKit); forced-colors legibility for the active-link treatment; an
   independent component-reviewer GO before commit; a `measure-size.mjs` line-item (provisional
   **≤ 4.0 KB gz marginal**, manual gate per ADR-0040) + tree-shake proof that importing the core drags
   neither element. Events: **none** at v1 — the route signal is the notification surface, so the
   six-name event law is untouched.

### Forks (each resolved with a firm recommendation — Kim offline; the recommendation is the default absent his morning objection)

- **F1 — package home.** *Recommend: new top-level `@agent-ui/router`* (clause 1). Alternatives: inside
  `components` (a routing layer is app infrastructure, not widget vocabulary; it would ride the
  ADR-0040 foundation-barrel budget every consumer pays, and blur the app-surfaces PRD's ratified
  "component tier ≠ application framework" boundary); a `traits/` addition (a trait is
  `(host, opts) => cleanup` bound to one host's connected lifetime — a router outlives any host and
  serves many; the shape does not fit).
- **F2 — URL strategy default.** *Recommend: ship both modes in one adapter, default `hash`*
  (clause 4). Alternatives: history-default (clean URLs, but every deep link 404s on a static host
  without rewrite config — the wrong default for this repo's own deploy and for zero-config consumers);
  hash-only (rejected: real apps with server control deserve clean URLs; the second strategy is ~30
  lines against the same seam).
- **F3 — outlet seam.** *Recommend: route-table `component` factories, sync or lazy* (clause 5).
  Alternatives: declarative `<ui-route>` light children (pre-connected hidden content runs effects and
  defeats laziness; a `<template>`-clone variant loses state per match and adds a second content model
  — deferred as the fenced sugar, not never); named-slot projection (all content pre-rendered, no lazy,
  scales worst); render-prop `TemplateResult` (inexpressible — `html``` is private, ADR-0023).
- **F4 — link⇄router wiring.** *Recommend: class-level `defaultRouter` + per-instance override*
  (clause 6). Alternatives: per-instance prop only (every link needs JS wiring — miserable in
  markup-heavy pages); a protocol event + delegated listener (the ADR-0050 event shape — workable, but
  the link still can't derive its `href` without the router, so it half-solves); a provider element
  (the clean fleet answer, real build cost — the named foreseen extension, not v1).
- **F5 — link vehicle.** *Recommend: dedicated `ui-router-link`* (clause 6). Alternative: reuse
  `ui-text as="a"` (rejected for v1 — ratified `_blank` policy + catalog reachability; convergence
  named for when ADR-0114's `target` extension lands).

## Acceptance

- Design wave (this record): PRD/SPEC/LLD authored and gate-clean (`harness_checks.py prd|spec|lld`,
  `adr_check.py`, `coverage_check.py --strict` all exit 0); doc-reviewer pass requested; Status stays
  `proposed` until Kim ratifies.
- Build wave (on ratification): the SPEC-R1…R8 acceptance criteria — headless core suite green with the
  no-DOM gate biting; reflection suites green incl. the echo-lock and stamped-index legs; outlet/link
  jsdom + cross-engine browser legs green with biting negative controls; descriptors trip-wire green;
  size line-item within budget; `npm run check && npm test` + `npm run test:browser` green.

## Consequences

- **The fleet gains navigation without becoming a framework** — the app tier still bundles no router;
  consumers opt in per app. The cost: a **seventh** workspace package to version, document, and budget
  (doc-review F3: `packages/agent-ui/` already holds six — shared, components, a2ui, app, icons, a2a).
- **Two history models exist by design** (memory stack + browser stack in history mode); the
  stamped-state sync is the one alignment mechanism, and its `popstate` legs are the highest-risk
  tests. Getting this wrong reintroduces the drift the memory-first design exists to kill — hence the
  dedicated SPEC legs.
- **Memory-only links degrade native anchor affordances** (their hash-form `href` doesn't encode
  restorable state) — accepted and documented; apps wanting shareable URLs turn on reflection.
- **A module-level `defaultRouter` is a soft global** — mitigated by the per-instance override and the
  fenced provider extension; flagged honestly rather than hidden.
- **The app-surfaces non-goal narrows in spirit** ("the app brings its own router" now includes ours);
  the non-goal row gains a cross-link on ratification so the two records can't be read as contradicting.
- **Route content loses state across revisits at v1** (no keep-alive) — documented; the fence names the
  trigger.
- **Stale → re-verify at the build wave:** CLAUDE.md Layout/DAG rows · `measure-size.mjs` · the site
  nav/toc gates (new doc page) · `agent-app-surfaces.prd.md` §Out-of-scope cross-link · this record's
  Ratified-by field.

## Alternatives considered

- **Live inside `@agent-ui/components` (a `router/` layer or `traits/` members).** Rejected: app
  infrastructure in the widget package rides every consumer's foundation budget (ADR-0040), muddies the
  reactive ← dom ← traits/controls layer story (a router is none of those layers), and contradicts the
  ratified "component tier ≠ application framework" boundary. The trait shape specifically fails on
  lifetime: `(host, opts) => cleanup` dies with its host; a router outlives hosts.
- **URL as the source of truth (the classic router design).** Rejected: fails the verbatim ask.
  Route state coupled to `location` is untestable without DOM emulation, breaks in URL-less hosts
  (embedded canvases, panels), and forces every consumer to pay for URL semantics they may not want.
  The signal-first inversion gives one source of truth and makes the URL a projection.
- **Global anchor interception (page.js/Vaadin-router style document click listener).** Rejected:
  implicit magic over composition; it collides head-on with ADR-0114's fixed `_blank` policy (those
  anchors must NOT be intercepted), and it silently widens to catalog-emitted `Text.href` anchors —
  handing navigation to agent payloads, the exact fence of clause 7.
- **A `TemplateResult`/render-prop outlet.** Rejected: `html``` is private by ratified design
  (ADR-0023); consumers cannot author `TemplateResult`s, so the seam would be unusable outside the
  package. Element factories are the fleet's public imperative unit.
- **Declarative `<ui-route>` children as the v1 seam.** Deferred (fork F3): both variants cost real
  complexity (connected-hidden content runs effects; template-clone loses state and adds a second
  content model). It composes cleanly LATER as sugar over the factory table.
- **History-mode default.** Rejected (fork F2): deep links 404 on static hosts without server rewrites
  — the wrong default for this repo's deploy shape and the zero-config pillar; shipped as the opt-in.
- **A zero-dependency router package re-implementing its own reactivity.** Rejected without ceremony:
  one kernel exists (`reactive/`); a second would fork the fleet's reactive semantics for no gain —
  `@agent-ui/components` is the dependency, tree-shaken to the kernel for headless consumers.
- **A2UI catalog `Route`/`Router` type at v1.** Rejected (fenced, clause 7): agent-driven navigation is
  a trust surface wanting its own record (the ADR-0034 gate posture) and a real consumer; v1 is
  developer-authored routing only, and the package DAG enforces the fence structurally.
