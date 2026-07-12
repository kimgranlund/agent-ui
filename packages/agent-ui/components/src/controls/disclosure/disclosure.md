---
# disclosure.md frontmatter — the attributes-as-API descriptor for ui-disclosure (ADR-0004; content-family
# LLD-C10 · SPEC-R14…R18 · ADR-0113 cl.4). The machine-checkable public surface lives HERE (frontmatter);
# the prose below the fence is the /site doc. The `attributes[]` block MUST mirror disclosure.ts
# `static props` (open/summary) — the contract↔props trip-wire (disclosure-descriptor.test.ts) and the
# frontmatter schema both target this fence. Field set per .claude/docs/plan.md §10 / ADR-0004; the
# native-<details> wrap per ADR-0113 cl.4/fork F3; the bindable `open` two-way per ADR-0019/ADR-0101.
tag: ui-disclosure
description: A one-line summary that expands or collapses its content, built on the native <details> element.
tier: pattern          # geometry.md Pattern band — "accordion" is named there: the summary row = control height, the shell rides the space scale
extends: UIElement     # NOT form-associated — a <details> participates in no form (the ADR-0017 <dialog> precedent; the no-native-form-elements law does not bind, ADR-0113 Context)
# marginal: measured at the LLD-C11 integration slice (the family barrel pass) — not guessed here (SPEC-N4)

attributes:            # attributes-as-API — mirrors disclosure.ts `static props`
  - name: open
    type: boolean
    default: false
    reflect: true      # reflects + BINDABLE — the catalog declares value:{prop:'open',event:'toggle'} (ADR-0019); prop-as-source-of-truth under the always-announce law (ADR-0101)
  - name: summary
    type: string
    default: ''
    reflect: true      # reflects so a JS-set value applies identically to an author-set attribute; the fold's one-line label (textContent-only, never markup)

properties:            # IDL beyond attributes-as-API — the reflected props read/write as element properties
  - name: open
    description: Whether the fold is expanded (boolean). Every ACTUAL transition — a user click on the summary, a data/model write, or a find-in-page auto-expand — settles this prop AND fires `toggle`; re-asserting the current value is a no-op (no event). Reflected + bindable (the two-way `open`, ADR-0019/ADR-0101).
  - name: summary
    description: The fold's one-line label (string, default ''). Written into the summary via textContent only — never markup. Updating it never perturbs `open`. A rich `slot=summary` child is the named foreseen extension (not v1).

events:
  - name: toggle
    detail: 'null'
    description: Fired on EVERY actual open-state transition — user click, a model-driven `open` write, or a platform find-in-page auto-expand — after `open` has already settled to its new value (ADR-0101 mechanic 3). The value:{event:'toggle'} two-way signal for the `open` bind.

slots:                 # no [slot=] attribute grammar (ADR-0113 cl.4) — the host's light-DOM children are ADOPTED into the component-owned body part, not attribute-slotted
  - name: body
    optional: true
    description: The host's light-DOM children — adopted into the component-owned `<div data-part="body">` (the "children = body" anatomy invariant, SPEC-R16). Children present at connect are adopted immediately; children streamed in after connect, or landing directly on the host from any later write, are healed into the body by a childList observer within a microtask. A destructive `host.textContent` write rebuilds the part fresh and re-lands the new content in the body.

parts:                 # the native <details>/<summary> is a component-owned PART, not a user slot (ADR-0113 cl.4)
  - name: details
    description: The control-created `<details data-part="details">` — the host's only element child, created ONCE (idempotent guard) and never re-rendered (render() stays the inherited no-op). Carries the platform's native disclosure behaviour (toggle, find-in-page auto-expand, the `name` exclusive-accordion substrate) for free.
  - name: summary
    description: The control-created `<summary data-part="summary">` inside the details part — a Pattern-class interactive CONTROL-height row ([chevron | label], flex). Natively focusable and activatable (Enter/Space, click) — no tabindex/keyboard machinery added.
  - name: chevron
    description: A `<span data-part="chevron" aria-hidden="true">` inside the summary, injected with the Phosphor `caret-right` glyph via `setIcon` (@agent-ui/icons). An inline affordance sized = font (geometry.md §"Affordance vs content-icon"). Rotates 90deg under `[open]` — orientation carries the state, never colour alone; NO transition (SPEC-R18 — cross-engine + reduced-motion honesty).
  - name: summary-text
    description: A `<span data-part="summary-text">` inside the summary, holding the `summary` prop's text (textContent-only, never markup). Updated by a scope-owned reactive effect; never touches `open`.
  - name: body
    description: The control-created `<div data-part="body">` inside the details part, holding the host's adopted light-DOM children (see slots above). Padding rides the `--ui-space` layout ladder (density-responsive) — the Pattern-class split from the summary row's density-invariant control-height frame.

customStates: []       # no :state() hooks — [open] is the native <details> attribute the platform + the model→platform effect drive; nothing here is a bespoke custom state

face:
  formAssociated: false  # NOT a FACE form control — a <details> submits nothing and carries no value (ADR-0113 Context)

aria:
  role: none             # the component sets NO internals role and no host ARIA (SPEC-R17) — the details/summary part IS the semantic element
  roleSource: native <details>/<summary> parts
  labelSource: n/a       # the summary's own text content is its accessible name (native semantics); no host/internals labelling seam exists
  expandedState: native  # the platform reports the summary's expanded/collapsed state from the <details> [open] attribute — never re-implemented via aria-expanded

keyboard:
  - keys: Enter / Space
    action: Toggles the fold when the summary is focused — native `<summary>` activation behaviour (platform, not reimplemented). Each actual transition fires exactly one `toggle`.
  - keys: Tab
    action: The summary is natively focusable (no tabbable trait needed) — reached in normal tab order like any interactive element.
  - note: Find-in-page (browser UA text search) auto-expands folded content containing a match — the platform's native `<details>` behaviour, one of ADR-0113's stated reasons for wrapping the native element rather than a bespoke build.

geometry:
  sizeClass: pattern
  summary:
    height: var(--ui-disclosure-height)   # Pattern-class interactive row — off the §1-row ramp; density-INVARIANT frame
    font: var(--ui-disclosure-font)
    glyph: var(--ui-disclosure-glyph)     # = font, the inline-affordance law (geometry.md)
    gap: var(--ui-disclosure-gap)         # the density-bearing chevron↔label rhythm
  body:
    shellClass: layout-shell
    padBlock: var(--ui-disclosure-body-pad-block)     # = --ui-space-sm, density-RESPONSIVE
    padInline: var(--ui-disclosure-body-pad-inline)   # = --ui-space-md, density-RESPONSIVE

forcedColors: A `@media (forced-colors: active)` block keeps the summary/body ink and the chevron (currentColor) visible as system inks (CanvasText); every value already resolves through a role carrying the WHCM mapping at the token layer, so this is explicit belt-and-suspenders, not new colour. The shared focus ring survives via `--md-sys-color-focus-ring → Highlight`.
---

# ui-disclosure

`ui-disclosure` folds content behind a one-line summary — a **Pattern-class** control (`UIElement`, not
form-associated) built on the native `<details>`/`<summary>` element (ADR-0113 cl.4). The no-native-form-
elements law does not bind: a `<details>` participates in no form, the same mechanical exemption `ui-modal`
takes for `<dialog>` (ADR-0017).

```html
<ui-disclosure summary="Full log">
  <ui-code language="sh">2026-07-08T12:00:00Z deploy started
2026-07-08T12:00:04Z deploy finished (ok)</ui-code>
</ui-disclosure>

<ui-disclosure summary="Details" open><p>Expanded on load.</p></ui-disclosure>
```

## Why native `<details>`

Chosen on mechanics over a bespoke button+region (ADR-0113 fork F3): the platform supplies the toggle
behaviour, the summary's button semantics + expanded/collapsed announcement, **find-in-page auto-expand**
of folded content, and the `name` exclusive-accordion substrate — all for free. A bespoke build would
re-implement every one against `ElementInternals`' limits (internals decorate the *host*, not a child
header) and get no searchability story. The cost, accepted: the native `::marker` must be replaced with a
fleet chevron, and fold animation stays out of v1 — `::details-content` interpolation is too fresh
cross-engine to ship honestly (ADR-0113 cl.4).

## Anatomy — children become the body

The host's light-DOM children are **adopted** into a component-owned `<div data-part="body">` inside the
`<details>` part — never a `slot=` attribute grammar (SPEC-R14): a prop-carried `summary` keeps the
adoption invariant simple ("children = body"). Children present at connect adopt immediately; children
streamed in afterward (parser streaming, or a later `appendChild`) are healed into the body within a
microtask by a childList observer — the same stamp/heal lineage `ui-text` and `ui-select`'s options-move
use (ADR-0078 cl.4). A destructive `host.textContent` write rebuilds the part fresh and re-lands the new
content in the body — the part is never reused once detached (it would hold stale content).

## `open` — two-way, always-announced

`open` is a reflected boolean and **prop-as-source-of-truth** (ADR-0101): a user click on the summary, a
data/model write, or a platform find-in-page auto-expand are all **actual transitions** — each settles the
prop (and the reflected attribute) and fires exactly one host **`toggle`**, with `open` already at its new
value when the listener runs. Re-asserting the current value is a no-op (native `<details>` never
re-fires `toggle` on a same-value write) — the loop-breaker the two-way bind relies on. The catalog spends
its one ADR-0019 seam slot here: `value: { prop: 'open', event: 'toggle' }` — the same pattern
`ui-modal`/`ui-select` use.

## `summary` — the one-line label

`summary` is a bindable string prop, written into the `[data-part="summary-text"]` span via `textContent`
only — never markup. Updating it never perturbs `open`. A rich `slot=summary` child (structured content in
the fold header) is a named foreseen extension, deliberately not v1 — a prop keeps the "children = body"
anatomy invariant simple.

## Styling

The native `::marker`/`::-webkit-details-marker` is hidden and replaced by a fleet **chevron** affordance —
sized `= font` (geometry.md's inline-affordance law, never the icon ramp), rotating 90deg under `[open]`.
**Orientation carries the state** — never colour alone (ADR-0057) — and the rotation is **not animated**
(no fold animation either): both are named v1 fences, not omissions (ADR-0113 cl.4). Geometry is Pattern-
class (geometry.md's own "accordion" row): the summary is an interactive **control-height** row
(density-invariant frame — height/font/glyph/gap all fixed at the `md` ramp step, no `[size]` axis), while
the body's padding rides the **`--ui-space`** layout ladder (density-responsive) — the two ledgers never
interchange.

## Accessibility

The component sets **no** internals role and **no** host ARIA (SPEC-R17) — the `<details>`/`<summary>`
part *is* the semantic element, carrying native button semantics and the expanded/collapsed announcement
the platform supplies. The summary is natively focusable; Enter/Space toggle it exactly like a native
`<button>`'s Space/Enter parity, with zero keyboard code in this control. A `forced-colors` block keeps
the summary/body ink and the chevron visible as system inks (belt-and-suspenders — every value already
resolves through a WHCM-mapped role at the token layer); the shared focus ring survives via
`--md-sys-color-focus-ring → Highlight`.
