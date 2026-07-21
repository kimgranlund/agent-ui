---
# app-shell.md frontmatter — the attributes-as-API descriptor for ui-app-shell (ADR-0004). The machine-
# checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc. The
# `attributes[]` block MUST mirror app-shell.ts `shellProps` — the contract↔props trip-wire
# (app-shell.test.ts) targets this fence. Field set per .claude/docs/plan.md §10 / ADR-0004. See
# app-shell-region.md for the region sub-element's own descriptor (LLD-C6 — one file per element).
tag: ui-app-shell
tier: layout            # geometry size-class (Container/layout band — a CSS-grid distributor, no control height; geometry.md)
extends: UIElement      # a plain structural base — NOT UIContainerElement: no surfaceProps/flexProps, the shell owns no elevation/flex grammar of its own (LLD-C3)
# marginal: not yet measured — the @agent-ui/app line-item in scripts/measure-size.mjs is LLD-C8 (a later, serial integration slice); the provisional M1 ceiling is ≤ ~3 KB gz for the whole package (PRD-G6 finding B)

attributes:             # attributes-as-API — mirrors app-shell.ts `shellProps`
  - name: isolated
    type: boolean
    default: false
    reflect: true        # reflects so the attribute mirrors the live value; opt-in style isolation (SPEC-R6/ADR-0082)

properties:             # `isolated` beyond the bare attributes-as-API row
  - name: isolated
    description: Opt-in style-isolation boundary (SPEC-R6, ADR-0082). Reflected boolean, default false (light-DOM, byte-identical composition to a shell with no isolation code path — SPEC-R6 AC1). When true, `connectedCallback` (overridden, LLD-C5 F3) attaches a shadow root BEFORE delegating to the base, injects `foundation-styles.css` + `component-styles.css` as `<link>`s INSIDE the boundary (foundation included so the universal `*` ramp + colour roles re-match shadow-tree elements), injects the F1b `:host` grid mirror (app-shell-isolation.css), and relocates the authored `ui-app-shell-region` children into the shadow tree (never `<slot>`-projected). Connect-time only — a shadow root cannot be detached, so toggling `isolated` after connect logs a dev warning and takes effect only on the next re-connect. Cross-engine proven (app-shell-isolation.browser.test.ts, Chromium + WebKit): tokens/colour pierce the boundary, the composed controls' own `@scope` styles apply, no host-page CSS leaks in, and the isolated grid-area placement + narrow reflow hold.

events: []              # a structural layout container fires no events of its own at M1 (SPEC §4)

slots: []               # content model is a ChildList of ui-app-shell-region children (docking = composition, SPEC-R4) — no NAMED slots on the shell itself

parts: []               # light-DOM, host-as-grid — no shadow parts exposed (render() stays void)
customStates:           # ui-app-shell ITSELF has no interaction state of its own — `collapsed` is genuinely
                        # ui-app-shell-region's state (see app-shell-region.md), NOT the shell's. It is listed
                        # here too ONLY because app-shell.ts/app-shell.css is ONE shared file pair for BOTH
                        # elements (LLD-C3) and the contract↔source trip-wire (compareDescriptorToSource)
                        # scans that shared source at FILE granularity, not per-class — so `collapsed`'s real
                        # `internals.states.add/delete` + `:state(collapsed)` usage (both on the REGION) would
                        # otherwise show as "used in source but undocumented" against THIS descriptor too.
  - collapsed


face:
  formAssociated: false  # NOT a FACE form control — a container contributes nothing to a form

aria:
  role: none            # the shell itself carries no landmark — semantics live on each ui-app-shell-region child (SPEC-R3)
  roleSource: none       # the host carries no role attribute and internals sets none
  childModel: ChildList — ui-app-shell-region children, docked by their OWN `region` prop (SPEC-R3/R4; regions = sub-elements, the ratified generic-element fork)

keyboard: []            # no keyboard interaction — the shell is a pure layout skeleton, not focusable

geometry:
  sizeClass: layout                 # Container/layout — NO control height (never reads --md-sys-height-*)
  blockSize: auto                   # content-driven — the grid's intrinsic size, no fixed frame
  paddingBlock: 0                   # the shell adds no padding of its own; a region owns any inset it wants
  gridTemplate: 'banner banner banner' auto / 'nav main aside' 1fr / 'footer footer footer' auto / auto 1fr auto   # the presence-driven region grid (LLD-C4) — an unoccupied named area's track collapses to 0 via ordinary CSS Grid auto-sizing, no :has() needed
  narrowThreshold: 40rem            # the @container inline-size threshold below which navigation/complementary hide (SPEC-R5) — a starting value, C7-reviewed, tunable

forcedColors: A `@media (forced-colors: active)` block repoints each region-facing divider border to CanvasText, so the chrome structure stays legible under high-contrast mode (SPEC-R7 AC2) — present in BOTH paths, at equivalent selector/specificity: the light-mode document sheet (app-shell.css, nested in its own `@scope (ui-app-shell)`) and the isolated-mode shadow-injected mirror (app-shell-isolation.css, `:host`-scoped), so isolation carries no forced-colors regression.
---

# ui-app-shell

`ui-app-shell` is the **grid container** of the M1 app-shell primitive (`@agent-ui/app`) — a structural,
**non-form-associated** `UIElement`, light-DOM by default. It composes the fleet's shipped layout family
into a persistent application frame: a presence-driven CSS grid of five named landmark **regions** —
**banner · navigation · main · complementary · contentinfo** — that reflows to its own container width and
can optionally (a later slice) isolate its styles behind a shadow boundary.

```html
<ui-app-shell>
  <ui-app-shell-region region="banner">Top bar</ui-app-shell-region>
  <ui-app-shell-region region="navigation">Side nav</ui-app-shell-region>
  <ui-app-shell-region region="main">Primary content</ui-app-shell-region>
  <ui-app-shell-region region="complementary">Aside</ui-app-shell-region>
  <ui-app-shell-region region="contentinfo">Footer</ui-app-shell-region>
</ui-app-shell>
```

## Region model — regions are sub-elements (the ratified generic fork)

A developer docks a surface into a named region by composing a **`ui-app-shell-region`** child and setting
its **own** `region` prop — there is no attribute-on-arbitrary-child mechanism, and no five named
`ui-app-shell-{region}` tags (Kim ratified the **generic** element over the fleet's `ui-card`-style
named-sub-element precedent — see `app-shell-region.md` for the full rationale). This collapses
**docking** (SPEC-R4) into **composition** (SPEC-R3): the child names its target region, the shell places
it via a `[region=…]` attribute-selector grid (`app-shell.css`).

## Presence-driven layout, no `:has()`

Unlike `ui-card`'s block-flow shell (which needs `:has()` to fake presence-driven padding), `ui-app-shell` is
a genuine CSS grid: `grid-template` fixes the five named areas + their `auto`/`1fr` tracks, and an area with
**no** region placed in it collapses to zero — ordinary CSS Grid auto-track sizing, no extra selector work.
`main` is the one **mandatory** region (a content contract, not an auto-injected empty band); a shell built
with no `main` region logs a developer-facing `console.warn` at connect rather than throwing.

**Duplicate regions** (two children both set `region="navigation"`) are allowed — both land in the same
grid-area and stack (the developer composed it; not repaired).

**`main`'s placement rule is an EXCLUSIONARY catch-all, not a match on the literal string `"main"`.** An
unrecognized `region` value fixes the JS *property* to `main` (`app-shell-region.md`'s codec fallback), but
the props-as-signals directional lock deliberately does **not** reflect that coercion back onto the DOM
*attribute* — `<ui-app-shell-region region="typo">` keeps the literal `region="typo"` attribute forever, even
though `.region` reads back `'main'`. An inclusion selector (`[region='main']`) would never match that
element; `app-shell.css` instead places anything that is **not** one of the other four named values into
`main` — which also covers a never-assigned region (no attribute at all) for free.

## Responsiveness — the shell's OWN container width

`ui-app-shell` establishes its own query container (`container-type: inline-size`) and reflows on **its**
width, never the viewport (SPEC-R5) — no breakpoint props. Below `40rem` inline-size the side regions
(`navigation`/`complementary`) hide by default and `main`/`banner`/`footer` collapse to a single column. A
region can opt OUT of hiding via its own reflected `collapse="stack"` prop (ADR-0084) — it stays visible and
stacks full-width into the single column instead, so essential interactive content (e.g. a chat composer)
never becomes unreachable narrow. See `app-shell-region.md` for `collapse` (and the related `landmark` ARIA
override, ADR-0083) — both are properties of the **region**, not the shell.

## Isolation — opt-in, per instance (SPEC-R6/ADR-0082)

`isolated` (reflected boolean, default `false`) encapsulates the shell's styles behind a shadow boundary.
Default (off) is exactly today's light-DOM composition, byte-identical to a shell with no isolation code at
all (SPEC-R6 AC1). When `true`, `ui-app-shell` overrides `connectedCallback` (LLD-C5 F3) to, in order: attach
a shadow root (`{mode:'open'}`, guarded so a reconnect is safe), inject the fleet's `foundation-styles.css` +
`component-styles.css` **inside** the shadow as `<link>` elements (foundation is included so the universal `*`
dimension ramp + colour roles re-match shadow-tree elements — a document `*` rule cannot reach across the
boundary), inject the F1b `:host`-shaped grid mirror (`app-shell-isolation.css`, since a document
`@scope (ui-app-shell)` sheet cannot style relocated in-shadow regions either), **relocate** the authored
`ui-app-shell-region` children into the shadow tree (never `<slot>`-projected — this is what keeps a host
`ui-button {…}` rule from reaching a composed control), and only then delegate to the base connect flow.

**Connect-time only, not reactive.** A shadow root cannot be detached once attached, so toggling `isolated`
after connect has no effect until the shell re-connects — a `console.warn` is logged when that happens rather
than silently no-op-ing. **Static composition at M1**: only children present at the moment of connect are
relocated; a region appended to an isolated shell afterward stays in light DOM (documented M1 limitation, an
M2 MutationObserver/slot-strategy concern).

**Cross-engine risk, not assumed.** `adoptedStyleSheets` support is not the fragile part; the genuinely
unproven surfaces are `@scope` evaluated inside a shadow-injected sheet (Safari 17.4) and the `*`-ramp custom-
property re-derivation across the shadow boundary — `app-shell-isolation.browser.test.ts` targets both,
Chromium AND WebKit, with the AC4 escalation path (light-only ships, decision returned to Kim with evidence)
as a first-class outcome if either fails cross-engine.

## Accessibility

The shell itself carries **no** ARIA role — landmark semantics live entirely on its `ui-app-shell-region`
children, each of which sets its own role through `ElementInternals` (never a host attribute). A
`forced-colors` block keeps the region dividers a system colour so the chrome structure stays legible under
high-contrast mode — in **both** light and isolated mode: the isolated shadow mirror carries the identical
divider + forced-colors rules, `:host`-scoped, so opting into style isolation never regresses SPEC-R7.

## Dispositions vs. the ui-super-shell family responsive system (GH #170 / ADR-0155 clause 5)

Two capabilities the `ui-super-shell` family gained under ADR-0155 are **deliberately NOT adopted** here —
named so the absence reads as a decision, not an omission (the build's `git diff --stat` shows zero hunks in
`app-shell.{ts,css}`):

- **The scrollbar seam (SPEC-R10) is vacuous here.** `ui-app-shell` owns **no** scroll region of its own —
  each region's scroll is consumer content, and `app-shell.css` declares no overflow scroller (verified). There
  is nothing for a `--ui-*-scrollbar-width` seam to hide, so none is added.
- **menu⇄X (SPEC-R9b) does not apply to the region-local disclosure.** The `app-surfaces-m4.lld.md` LLD-C11
  `collapse="toggle"` Show/Hide affordance is a **region-local** disclosure, a different altitude from a header
  **side** toggle that hides a whole side and restores it as an overlay. The menu⇄X glyph law governs the
  latter; adopting it for a region's own Show/Hide control would conflate the two altitudes, so it is not.
