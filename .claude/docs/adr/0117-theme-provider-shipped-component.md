# ADR-0117 — `ui-theme-provider`: promoting the docs-site theming wrapper to a shipped, fleet-law-compliant control

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-09
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-09 |
> | **Proposed by** | design intake (TKT-0003, Kim's directive 2026-07-09: *"add building a real, shipped theme-provider to the plan"* — an installing consumer gets no theming element at all today and must hand-roll the wrapper the theming guide describes) |
> | **Ratified by** | Kim, 2026-07-09 (hand-flipped in-tree; verbal "ratified" same day) |
> | **Repairs** | NEW `packages/agent-ui/components/src/controls/theme-provider/*` (on ratification+build) · NEW [`../spec/theme-provider.spec.md`](../spec/theme-provider.spec.md) · NEW [`../lld/theme-provider.lld.md`](../lld/theme-provider.lld.md) · [`../decompositions/theme-provider-ship.decomp.json`](../decompositions/theme-provider-ship.decomp.json) (coverage-clean, plan mode, exit 0). On ratification+build: `packages/agent-ui/a2ui/src/catalog/default/index.test.ts` `EXCLUSION_ALLOWLIST` (+`ThemeProvider`) · `site/pages/theming.ts` + `site/lib/component-gallery.ts` repointed at the shipped element · `site/lib/theme-provider.ts` DELETED · NEW `site/pages/theme-provider-{doc,demo}.ts` · `site/gallery.html`'s ADR-0079 LLD-C4 interface note corrected |
> | **Supersedes / Superseded by** | Extends ADR-0079 cl.3 (the site-local `<theme-provider>` design this promotes — reciprocal `Extended by` backlink lands on accept) · relates ADR-0050 (`ui-form-provider`, the sibling provider-primitive precedent this follows for the tag law + `UIElement` base) · relates ADR-0112 cl.6 (the permanent-catalog-exclusion allowlist pattern this reuses for the same reasoning class) |

## Context

`<theme-provider>` exists only as docs-site chrome (`site/lib/theme-provider.ts`, 25 lines — a passive
`HTMLElement` whose `scheme` attribute maps to its own `color-scheme` style; `scale`/`density`/`theme` are
pure attribute carriers the token CSS keys off; ADR-0079 cl.3, `component-gallery.lld.md` LLD-C4). It is a
real, working design — but it was built **for the gallery**, never intended to leave the docs site. A
consumer who installs `@agent-ui/components` today gets **no theming element at all**: `tokens.css`'s
`light-dark()` roles resolve per-subtree off the inherited `color-scheme` CSS property, and the only place
that mapping is wired up is 25 lines of site-local TypeScript nobody outside this repo can import. The
theming guide (`site/pages/theming.ts`) is honest about this — it describes the contract by pointing at its
own site-local source file, which is not a library any consumer can depend on.

The site element predates the fleet naming law's reach into what was, at the time, correctly judged pure
"docs meta-infra" (the ADR-0077 precedent that protects `<component-preview>`/`<component-gallery>` from
descriptor/coverage/budget obligations they have no business carrying). That precedent's test is *"is this
something a consumer ships"* — and theme-provider fails that test in the other direction from
component-gallery: nobody consumes a gallery, but every consumer of this library needs a way to flip
`color-scheme`/scale/density on a subtree. The gap is real product surface, not meta-infra, and TKT-0003
directs closing it.

Four forks decide the shape of the promotion; each is resolved below with a firm recommendation, none
self-ratified.

## Decision

We will ship **`ui-theme-provider`** — a real `UIElement`-based control in `packages/agent-ui/components`'s
`controls/` tier — promoting theme-provider's CONTRACT (not its file verbatim) to the fleet standard, with
one deliberate behavioral fix.

1. **F1 — the tag: `ui-theme-provider`, no site-local alias, clean cutover.** The fleet law is unconditional
   on shipped surface (`CLAUDE.md`: tags `ui-{name}`) — the ADR-0077 exception exists *only* for elements
   that are never shipped as library surface (the gallery, the preview). theme-provider is being promoted
   **out of** that exception, so it must comply. `ui-form-provider` is the direct precedent: another
   coordination/provider primitive with no widget geometry of its own, still `ui-*` — the "it's a provider,
   not a widget" argument was already tried and rejected there. Migration is a **clean cutover, no alias**:
   `site/lib/theme-provider.ts` is deleted outright and both consumers (`theming.ts`, `component-gallery.ts`)
   repoint to the shipped import in the same change. A transitional site-local alias was considered and
   rejected — there are exactly two in-repo consumers, both under active development in this same repo, and
   the fleet's own precedent for internal-only renames is hard cutover with zero survivors (ADR-0074/0078/
   ADR-0113's `ui-code`/`ui-disclosure` landed the same way). An alias would buy nothing and leave a second,
   silently-drifting definition of "what a theme provider is."

2. **F2 — package home: `controls/theme-provider/`, `UIElement`-based (not a bare `HTMLElement`).**
   scheme/scale/density/theme are the token system's own axes — squarely `@agent-ui/components` territory,
   not `shared` (which carries tokens, not elements) and not a new package (there is no reuse case outside
   the control fleet). Within `components`, `controls/` — not a kernel/base-class concern — mirroring
   `ui-form-provider`'s placement as the fleet's other pure-coordination primitive.
   **Base class, argued honestly:** the site version is a bare `HTMLElement` specifically to avoid "kernel
   involvement" — but that phrase in its own header comment means *reactive state* (signals/effects), not
   the base class itself. `UIElement`'s lifecycle (`connectedCallback`/`disconnectedCallback` plumbing,
   `this.effect`) costs nothing at rest for an element that establishes zero effects beyond the one scheme
   mapping, and it is the *only* way to get `static props` — which buys three things the bare-`HTMLElement`
   version does not have: (a) typed, reflected, attribute↔property-synced props (`el.scheme = 'dark'` and
   `setAttribute('scheme','dark')` behave identically — the site version only observes the attribute), (b)
   a live `PropsSchema` for the descriptor↔props contract trip-wire every other shipped control carries
   (`ui-form-provider`'s own `static props = {}` exists *for this reason alone*, per its header comment), and
   (c) participation in the standing `family-coherence.test.ts` gate. A bare-`HTMLElement` fleet control
   would be a first, bought for a savings (avoiding `UIElement`) that measures near zero for a
   four-attribute carrier. **Recommendation: `extends UIElement`, `static props` with all four axes typed.**
   Not `UIFormElement` (carries no value/validity) and not a `UIContainerElement` (paints no surface of its
   own) — same reasoning ADR-0050 already ratified for `ui-form-provider`.

3. **F3 — the contract: four reflected props, `scheme` gets the deliberate fix.** All four default to the
   empty string `''` and are ordered `values[0]`-default-first (the ADR-0030/ADR-0096 per-consumer-default
   doctrine) — **unset is a real, first-class, in-vocabulary state**, not a JS-level fallback:
   - **`scheme`** — `enum(['', 'light', 'dark'], '')`. **The load-bearing fix**: the site element's
     `next === 'dark' ? 'dark' : 'light'` collapses *any* non-`'dark'` value — including genuinely unset —
     to an explicit `light-dark()` override. That is correct for the gallery (which always sets all four
     axes explicitly) and wrong for a general-purpose shipped wrapper around an arbitrary subtree: an
     unwrapped or unset provider should impose **no** override and let `color-scheme` inherit normally (the
     page's own scheme, or an outer provider's, if nested). The shipped element maps `scheme` to
     `this.style.colorScheme` only when it is non-empty, and **clears** the inline style
     (`el.style.colorScheme = ''`) when it is unset — a one-line behavioral change from the site version,
     verified by a browser leg proving a nested unset provider still resolves its *ancestor's* scheme
     (§ decomp n24). A malformed attribute value now fails open to `''` (inherit) rather than failing closed
     to `'light'` — safer for a consumer who mistypes the attribute.
   - **`scale`** — `enum(['', ...the 6 ADR-0032 values], '')`. **Pure attribute carrier, no JS effect** —
     `dimensions.css`'s `[scale]` selectors key off the attribute directly (a custom-property repoint that
     inherits by CSS's own mechanism); the component does nothing beyond reflecting it.
   - **`density`** — `enum(['', 'compact', 'comfortable', 'spacious'], '')`. Same pure-carrier shape as `scale`.
   - **`theme`** — `string('')`. The RESERVED package seam ADR-0079 cl.3 fenced: today **inert** (no
     `[theme='<name>']` CSS layer exists anywhere in the fleet), kept a free string rather than an enum
     because a package name is an open, externally-registered vocabulary, not a fixed set like `scale`. The
     multi-theme package-SWAPPING system stays explicitly out of scope (ADR-0079's F2b next-tier scope
     dial) — this ADR ships the wired-but-inert attribute only, identical in effect to today's gallery usage.
   No enum here is `bindable` in the A2UI sense (moot — clause 4 keeps this control out of the catalog
   entirely), so ADR-0098's validator-enum-membership lane never engages.

4. **F4 — geometry + descriptor posture: `tier: container`; permanently excluded from the A2UI catalog.**
   **Geometry**: `sizeClass: container` — the `ui-form-provider` precedent for a coordination element with
   *zero* geometry lever of its own (no control height, no `--ui-space` opinion; `geometry.md`'s
   Container/layout band, minus even that band's own gap/margin concerns). The component owns exactly one
   CSS rule (`display: block` — an unstyled custom element defaults to `inline`, which would lay block-level
   slotted children out wrong) and declares **no** `--ui-theme-provider-*` token chain (nothing to theme —
   the fleet's `B`-group family-coherence invariant tolerates this the same way it tolerates
   `form-provider.css`'s documented absence).
   **Site pages owed**: `tier: container` mechanically requires `{doc, demo}` under `site-coverage.test.ts`
   (the same required set `ui-form-provider`/`ui-card` carry) — a new `theme-provider-doc.ts` (the standard
   derived API page) and `theme-provider-demo.ts` (a composition demo — nested providers / a per-subtree
   override, not a restatement of `theming.ts`'s existing content) ship alongside. `theming.ts` itself stays
   the narrative/conceptual guide (already exists, already the living demo the ticket names) and is
   repointed at the shipped element rather than replaced.
   **Catalog disposition: permanent exclusion, not deferred.** The moment `theme-provider.md` ships, ADR-0087's
   fleet-derived gate (`descriptor-glob → PascalCase minus the allowlist`) admits `ThemeProvider` into
   `FLEET_TYPES` and demands either a catalog row or an allowlist entry — silence is not an option, by
   construction (the exact gap ADR-0087 closed). A catalog row is wrong on the merits: theme-provider is
   **page/app-owner chrome that establishes a theming subtree**, structurally the same class as
   `Toast`/`ToastRegion` (ADR-0112 cl.6) — never something a generative-UI agent should be emitting inside a
   composed surface (an agent-authored subtree changing its own ambient color-scheme is a trust/consistency
   hazard the catalog has no business admitting, and there is no plausible generative use case for it). This
   ADR seeds `EXCLUSION_ALLOWLIST` with a **PERMANENT** `'ThemeProvider'` entry, reasoning cited verbatim from
   the ADR-0112 cl.6 precedent (never agent-emittable, page-owner chrome), mirrored in the SPEC.

## Consequences

- A consumer installing `@agent-ui/components` gets a real, importable theming element for the first time —
  the theming guide stops citing a file nobody outside this repo can use.
- The `scheme` unset-fix is a genuine, if small, behavior change from the site version: a bare
  `<theme-provider>` (no `scheme` attribute) today silently forces `color-scheme: light` on its subtree; the
  shipped element instead lets it inherit. This is corrected, not preserved — the site's two consumers
  (`theming.ts`, `component-gallery.ts`) both always set `scheme` explicitly today, so neither observes any
  behavior change; a future bare/unset usage is the one that now behaves correctly instead of surprisingly.
- The fleet gains its **second** `UIElement`-based pure-coordination/carrier primitive (after
  `ui-form-provider`) — `family-coherence.test.ts`'s tolerance for a token-chain-free `.css` file and a
  geometry-lever-free descriptor is now exercised by two controls instead of one, strengthening rather than
  special-casing that allowance.
- `EXCLUSION_ALLOWLIST` gains a second permanent (never-drained) member alongside Toast/ToastRegion — the
  residue-guard test (`index.test.ts`) already asserts every allowlist entry is genuinely absent from the
  catalog, so this stays honest by construction, not by discipline.
- Cost accepted: two new site pages (`theme-provider-doc.ts`/`-demo.ts`) for a component whose primary
  teaching surface (`theming.ts`) already exists — judged worth it for `site-coverage.test.ts` parity with
  every other shipped `tier: container` control, and because the demo page's job (composition/nesting) is
  genuinely distinct content from the guide's (the token/role system, the reserved seam).
- The TKT-0002 regression class (LightningCSS's production-minify pass silently defeating `light-dark()`)
  gets a **new, permanent build-level regression guard** scoped to this component specifically — proving the
  mechanism (an element's own `color-scheme` inline style driving a descendant's resolved token) survives
  the real build pipeline, complementing (not duplicating) `site/lib/light-dark-minify.test.ts`'s
  general-purpose proof.
- `ui-theme-provider` is the fleet's **first** control to declare `scale`/`density` as its own reflected
  `static props`. Every prior consumer of `dimensions.css`'s `[scale]`/`[density]` selectors set those
  attributes ambiently — bare attributes on any wrapper element, owned by no control's schema. This is
  intentional (F3): it buys the descriptor↔props trip-wire and typed property access for the two axes this
  component exists to carry, and it does not narrow the ambient mechanism — `[scale]`/`[density]` still work
  on any plain element exactly as before, unaffected by this component's own reflection of them. Verified
  clean against `family-coherence.test.ts`'s A2/A2b invariants (theme-provider declares no `size` attribute,
  so neither invariant engages) and worth naming as a fleet-first, not a silent precedent.

## Acceptance

The SPEC's requirements hold, end to end: `npm run check`(+site) and `npm test` green including
`family-coherence.test.ts` and the new `theme-provider` suite; the descriptor↔props trip-wire green; the
a2ui `EXCLUSION_ALLOWLIST` residue-guard green with `ThemeProvider` permanently seeded and never catalogued;
cross-engine browser legs proving scheme/scale/density visibly repaint a real nested control **and** that an
unset provider nested inside a scheme'd ancestor inherits correctly; a build-level `light-dark()`
per-subtree resolution proof against the production bundle; `site/lib/theme-provider.ts` deleted with zero
remaining site-local `theme-provider` references (`grep`-verified); `site-coverage.test.ts` green for the
new `{doc,demo}` pair; `npm run size` measured and, if material, pinned; independent `component-reviewer` GO
before the build commits.

## Alternatives considered

- **Keep the bare `theme-provider` tag (no `ui-` prefix), grandfathered as "docs-adjacent infra that shipped
  early"** — rejected. The fleet law has no such carve-out once an element leaves `site/` and enters
  `@agent-ui/components`'s public surface; `ui-form-provider` already establishes that a pure coordination
  element gets no exemption.
- **A site-local alias custom element (`theme-provider` still defined, delegating to `ui-theme-provider`)
  during a transition window** — rejected. Exactly two in-repo consumers, both edited in this same change;
  an alias buys nothing but a second, driftable definition surface, against the fleet's own hard-cutover
  precedent for internal renames.
- **Bare `HTMLElement`, matching the site version exactly (zero kernel cost)** — rejected. The "kernel cost"
  being avoided is reactive-effect machinery the shipped element still doesn't use beyond one scheme
  mapping; `UIElement` is the only path to typed reflected `static props`, which every other shipped control
  needs for the descriptor trip-wire and which buys real correctness (attribute↔property sync) for
  near-zero marginal cost on a four-attribute carrier.
- **`scheme` defaults to `'light'` (preserve the site element's behavior byte-for-byte)** — rejected on the
  merits for a general-purpose shipped wrapper: an unset provider silently forcing light mode on its subtree
  is a correctness bug waiting to surface the first time a consumer nests one without setting every axis
  explicitly (exactly the failure mode the gallery's own always-explicit usage happens to mask today).
- **A `ThemeProvider` catalog row (admit it into the generative-UI vocabulary)** — rejected. It is page/app-
  owner chrome establishing a theming subtree, not agent-emittable content; the ADR-0112 cl.6 Toast/
  ToastRegion reasoning applies verbatim — history-must-not-lie / payload↔DOM traceability concerns aside,
  there is no coherent story for an agent-composed surface changing its own ambient color-scheme.
- **Package home in `@agent-ui/shared`** — rejected. `shared` carries tokens and cross-cutting style/type
  utilities, never elements; theme-provider is a control (a custom element with lifecycle), squarely
  `components` territory regardless of how thin its behavior is.
- **Fold the multi-theme package-swapping system into this intake** ("since we're touching `theme` anyway")
  — rejected, out of scope by TKT-0003's own acceptance criteria and ADR-0079's F2b next-tier scope dial;
  this ADR ships the wired-but-inert seam only.
