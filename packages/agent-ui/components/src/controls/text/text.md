---
# text.md frontmatter — the attributes-as-API descriptor for ui-text (ADR-0004 / ADR-0078). The machine-checkable
# public surface lives HERE (frontmatter); the prose below the fence is the /site doc. The `attributes[]` block
# MUST mirror text.ts `static props` (variant/size/as, in that order) — the contract↔props trip-wire
# (text-descriptor.test.ts) targets this fence. Field set per .claude/docs/plan.md §10 / ADR-0004.
tag: ui-text
tier: display          # geometry size-class (Display band — NO control frame/height; geometry.md "size-classes" + ADR-0025 cl.1: the typographic ramp is the lever, not --ui-height-*)
extends: UIElement     # a non-interactive display LEAF — NOT form-associated (face below), NOT a UIContainerElement surface
# marginal: ui-text adds 273 B gz to the self-defining ui-* family (22348 B gz WITH it vs 22075 B gz without — the
# `npm run size` delta, tree-shaken; up from 118 B pre-wave — the restamp effect + heal MutationObserver are new
# always-on machinery, ADR-0078 Consequences (b)). Family total 22348 B gz, within the 22528 B gz budget (180 B headroom)

attributes:            # attributes-as-API — mirrors text.ts `static props`, THREE orthogonal axes (ADR-0078 cl.1)
  - name: variant
    type: enum
    values: [display, headline, title, body, label, kicker, overline, quote, lead]   # the M3 type roles + four editorial extras (cl.2b); zero semantic effect
    default: body
    reflect: true      # reflects so the [variant] repoint in text.css applies to JS-set values (the button `size` precedent)
  - name: size
    type: enum
    values: [sm, md, lg]   # the row WITHIN the role — orthogonal to variant, md is the universal default
    default: md
    reflect: true      # reflects so the [size] repoint in text.css applies to JS-set values
  - name: as
    type: enum
    values: [none, h1, h2, h3, h4, h5, h6, p, span, blockquote]   # document SEMANTICS — the real element STAMPED around the light-DOM children
    default: none      # no wrapper — the host itself is the styled node (today's DOM shape, byte-identical)
    reflect: true      # reflects for consistency with variant/size — a JS-set `as` is inspectable/stylable too

properties: []         # no manual accessors — the displayed text is light-DOM children (textContent), NOT a prop (ADR-0025 cl.2 / Fork 1, the Button.label precedent)

events: []             # display-only — emits nothing (not interactive)

slots:                 # light-DOM, host-as-content (ADR-0006) — the default/unnamed children ARE the displayed text + the accessible name
  - name: text
    optional: false
    description: The displayed text — the default/unnamed children (textContent); the accessible name. When `as` is not `none` these children are MOVED (never cloned) into one real stamped element (ADR-0078 cl.4); render() stays void, so nothing the template system owns ever touches them.

parts: []              # light-DOM, host-as-content — no shadow parts exposed

customStates: []       # NO interaction state and NO motion gate — a display leaf has neither (no :state(ready); there is nothing to transition)

face:
  formAssociated: false  # a display leaf — extends UIElement, no value/validity participation

aria:
  # Semantics now live on the platform (ADR-0078 cl.4) — variant/size carry NONE. When `as` stamps a real
  # h1-h6/p/span/blockquote, that element supplies its own native role and name for free; ElementInternals
  # is never touched for role/level (the ADR-0025 internals-heading path is deleted outright).
  role: native role of the stamped element when as is set (h1-h6 heading char, p/span/blockquote generic); as=none gives no implicit role
  roleSource: stamped-element  # a REAL light-DOM element supplies the role natively — never internals, never a host role/aria-* attribute
  labelSource: textContent  # the light-DOM text is the accessible name (cl.2 gives this for free, stamped or not)

keyboard: []           # NOT interactive and NOT focusable — no tabindex, no `tabbable` trait, no keyboard contract. user-select stays ENABLED (display text is selectable — the deliberate inverse of ui-button, which disables it)

geometry:
  sizeClass: display
  blockSize: content   # NO control height (geometry.md Display class) — block-size is content-driven; no padding-block law, no frame
  fontSize: var(--ui-text-size)         # the --md-sys-typescale-{role}-{size}-size the [variant][size] matrix repoints to (ADR-0078 cl.3) — × var(--ui-scale), density-invariant
  fontWeight: var(--ui-text-weight)     # from --md-sys-typescale-{role}-{size}-weight (a :root constant)
  lineHeight: var(--ui-text-line-height)  # from --md-sys-typescale-{role}-{size}-line-height (a :root unitless constant)
  tracking: var(--ui-text-tracking)     # from --md-sys-typescale-{role}-{size}-tracking (a :root em constant); NEW — ADR-0025's ramp had no tracking leg

forcedColors: A `@media (forced-colors: active)` block keeps the text visible (CanvasText) so display text never vanishes in high-contrast.
---

# ui-text

`ui-text` is the **Display**-class text primitive — a light-DOM custom element rendering text on the fleet's
M3-derived type scale. It is **not** interactive and **not** form-associated: it carries no value, no focus,
and no keyboard contract; it styles its host and lets the user's light-DOM text flow through (host-as-content,
ADR-0006). It is the A2UI v1.0 `Text` component's live control (via a factory fan-out, ADR-0078 cl.5).

```html
<ui-text variant="display" size="lg" as="h1">Page title</ui-text>
<ui-text variant="headline" as="h3">Section</ui-text>
<ui-text>Body copy is the default — body/md, no wrapper.</ui-text>
<ui-text variant="label" size="sm">Secondary / meta text</ui-text>
```

## Three orthogonal axes

`ui-text` carries **three** independent props (ADR-0078 cl.1) — pick any combination; the fleet defines all
9 × 3 = 27 `variant`×`size` cells, and any `as` is legal with any visual pair:

- **`variant`** — the visual type ROLE: `display` · `headline` · `title` · `body` (default) · `label` (the
  five M3 roles), plus four editorial extras — `kicker` · `overline` · `quote` · `lead`. Selects *which*
  `--md-sys-typescale-*` block text.css repoints to.
- **`size`** — `sm` · `md` (default) · `lg`, the row *within* the role (M3's Small/Medium/Large). Orthogonal
  to `variant` — `md` is the universal default for every role, not a per-role recommendation.
- **`as`** — document SEMANTICS: `none` (default, no wrapper) · `h1`…`h6` · `p` · `span` · `blockquote`. The
  ONLY prop with any accessibility effect — see Stamping, below.

`as="h2" variant="body"` (a semantically-major, visually-modest heading) and `as="none" variant="display"
size="lg"` (huge text that is *not* a heading) are both first-class; that independence is the point of the
split (ADR-0078 supersedes ADR-0025's single conflated `variant="h4"`).

## Stamping (`as`)

When `as ≠ none`, `ui-text` wraps its light-DOM children in one real semantic element (the *stamp*) —
`<ui-text as="h4">Section</ui-text>` renders a real `<h4>Section</h4>` in light DOM. This is **not** the
template system: `render()` stays void (a template would clobber user-owned content), so the stamp is a
scope-owned DOM-adoption effect that *moves* the children in, never clones them. A childList
`MutationObserver` on the host heals the invariant whenever content lands directly on the host instead of
inside the stamp — a parser-streamed element whose children arrive after connect, or an external
`host.textContent` write (the A2UI bound-text path) that destroys everything, stamp included. Both cases
self-repair within a microtask; `as="none"` never installs a stamp (byte-identical DOM to a plain
`<ui-text>`). The stamp is visually transparent — it inherits all typography from the host (`font: inherit`
+ a `margin: 0` reset), so changing `as` changes semantics with **zero** layout delta.

## Content

The displayed text is the element's **light-DOM children**, not a property — `<ui-text>Hello</ui-text>` (the
`button` label precedent). The text is the element's accessible name whether or not a stamp exists. From the
A2UI catalog, the `Text.text` property (a string literal or a `{path}` binding) maps to the host's
`textContent` — safe even after a stamp exists, because the heal observer re-stamps around it.

## Typography & geometry

`ui-text` is the **Display** size-class (`geometry.md`): it has **no** control height, no `padding-block`
law, and no frame — its lever is the type scale, not `--ui-height-*`. It consumes only its component tokens
(`--ui-text-size`/`-weight`/`-line-height`/`-tracking`), which the `[variant][size]` matrix repoints from the
fleet `--md-sys-typescale-{role}-{size}-*` scale (ADR-0078 cl.2/cl.3) — the role-pure two-block pattern every
control uses; `ui-text` holds zero scale opinion. `kicker`/`overline` add `text-transform: uppercase`;
`quote` adds italic + an inline-start rule + an indent. Text is **selectable** (`user-select` is enabled —
the deliberate inverse of `ui-button`). A `forced-colors` block keeps the text visible (`CanvasText`).

## Accessibility

Semantics are now **opt-in and explicit**, carried by `as` alone (ADR-0078 cl.4) — `variant`/`size` have
zero accessibility effect. A stamped `<h1>`–`<h6>` IS a heading (name = its content, for free); `<p>`,
`<blockquote>`, and `<span>` carry their own native roles. `as="none"` (the default) implies no role — the
host is generic styled text, like today.

- Role/semantics come from the STAMPED element itself — never `ElementInternals`, never a host `role`/`aria-*`
  attribute (the ADR-0025 internals-heading path is deleted: keeping an internals role beside a real heading
  child would double-announce).
- The accessible name comes from the light-DOM text, stamped or not.
- `ui-text` is **not focusable** and has no keyboard contract (it is not interactive).
- A `forced-colors` block preserves the text colour so display text survives high-contrast modes.
