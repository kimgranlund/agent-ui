---
# attachment.md frontmatter — the attributes-as-API descriptor for ui-attachment (ADR-0004; LLD-C10,
# feed-family.lld.md §6; SPEC-R8/R9/R10; ADR-0112 Amendment 1 — the sizeBytes rename). The machine-checkable
# public surface lives HERE (frontmatter); the prose below the fence is the /site doc. The `attributes[]`
# block MUST mirror attachment.ts `static props` (filename/mimeType/sizeBytes/href) — the contract<->props
# trip-wire (attachment-descriptor.test.ts) targets this fence.
tag: ui-attachment
description: A non-interactive compact file card showing a category glyph, name, and formatted size for one attached file.
tier: display          # geometry size-class (Display band — NO control frame/height; SPEC-R20)
extends: UIElement     # a non-interactive, non-form-associated display LEAF (SPEC-R8)
# marginal: not yet measured — this folder-only wave (M1-a) ships ahead of the LLD-C11 shared-file
# integration slice (barrel export, component-styles.css import, package.json exports entry); the real
# `npm run size` figure lands with that slice, per feed-family.lld.md §11.

attributes:            # attributes-as-API — mirrors attachment.ts `static props` (filename, mimeType, sizeBytes, href)
  - name: filename
    type: string
    default: ''
    reflect: false      # NOT reflected — property-only render input; empty falls back to the category label
  - name: mimeType
    type: string
    default: ''
    reflect: false      # NOT reflected — drives fileCategory() (glyph + name fallback), never CSS-keyed.
                         # HTML attribute is `mime-type` (an explicit `attribute:` override in attachment.ts
                         # — load-bearing: a literal camelCase observed-attribute name would never match the
                         # always-lowercase real DOM attribute name in an HTML document).
  - name: sizeBytes
    type: number
    default: null       # String(null) = 'null' — bytes; NOT a wire field (A2aFilePart carries none) —
                         # embedder-supplied, e.g. computed from decoded bytes (SPEC-R8). null/non-finite/
                         # negative ⇒ the meta cell is absent, never a fabricated "0 B"/"NaN B". Named
                         # `sizeBytes`/`size-bytes`, NOT `size` (ADR-0112 Amendment 1): the fleet-wide law
                         # reserving a literal `size` attribute for the widget-tier [sm,md,lg] geometry enum
                         # (family-coherence.test.ts) was discovered post-design — renamed rather than
                         # carved-out, since nothing was yet consuming the original name. HTML attribute is
                         # `size-bytes` (an explicit `attribute:` override, same kebab discipline as `mimeType`).
    reflect: false      # NOT reflected — property-only render input
  - name: href
    type: string
    default: ''
    reflect: false      # NOT reflected — TEMPORARY-INERT (naming.md §3: a navigation-URL href REFLECTS;
                         # the LLD-C6 rendering wave flips this to reflect: true per that canon, TKT-0070).
                         # SPEC-R8's fourth wire-mirroring prop. Present in the CONTRACT now;
                         # its RENDERING leg (the name cell becoming a native <a> under the shared ADR-0114
                         # gate, controls/text/href.ts) is DEFERRED to LLD-C6 (a later, separately-dispatched
                         # M1-c wave) — this pass reads it into no effect and renders it nowhere. Do not
                         # treat its presence here as the link leg shipping; see attachment.ts's header note.

properties: []         # no manual accessors beyond the four typed props

events: []             # display-only — emits nothing (SPEC-R8: no events, no keyboard contract)

slots: []              # no author-slotted content model — render() stays the inherited no-op; every child
                        # is control-built (createElement + replaceChildren), never author-slotted.

parts:                  # data-part nodes the render effect builds (selected by attachment.css, not by name from TS)
  - name: glyph
    description: The `<ui-icon data-part="glyph">` — the category glyph (fileCategory→categoryGlyph, LLD-C4). Decorative by the icon's OWN default (no `label` is ever set on it, so its internals carry aria-hidden with no attachment-side ARIA work) — SPEC-R10, the glyph repeats what the name/mime already carry.
  - name: body
    description: The `<span data-part="body">` grid cell holding `name` (+ `meta` when present). `min-inline-size:0` is what lets the name cell actually shrink to trigger its ellipsis truncation inside the grid track.
  - name: name
    description: The `<span data-part="name">` — real, selectable text; `name` when non-empty, else the file category's label (SPEC-R8 AC2 — never an empty title). Single-line ellipsis truncation (SPEC-R9 AC3). The accessible datum (SPEC-R10) — no internals ARIA is minted for it. A plain `<span>` in THIS pass; becomes a native `<a>` only once LLD-C6's deferred href leg lands.
  - name: meta
    description: The `<span data-part="meta">` — `formatBytes(sizeBytes)` (LLD-C4); present ONLY when `sizeBytes` is a finite, non-negative number (SPEC-R9 AC2) — absent, not empty, otherwise.

customStates: []       # NO interaction state and NO motion gate — a display leaf has neither (no :state(); nothing to transition)

face:
  formAssociated: false  # a display leaf — extends UIElement, no value/validity participation

aria:
  role: none             # no internals ARIA is minted at all (no internals.role assignment in attachment.ts)
  roleSource: none
  labelSource: real-text  # the card's meaning is real, selectable DOM text — the name (+ meta) text nodes
                          # (SPEC-R10); the glyph is aria-hidden by ui-icon's own decorative default and
                          # carries no text — no internals.ariaLabel is ever set on the host, because there
                          # is nothing silent to name

keyboard: []           # NOT interactive and NOT focusable — no tabindex, no keyboard contract (SPEC-R8)

geometry:
  sizeClass: display
  minInlineSize: var(--ui-attachment-min-inline-size)  # 12em default — the whole-shape floor (SPEC-R18 AC1)
  # NO [size] attribute, NO [scale] geometry row, NO --md-sys-height-* consumption (SPEC-R20 AC2) — the glyph
  # rides the fixed content-icon register (--md-sys-icon-md, geometry.md's "Affordance vs content-icon" law);
  # rhythm (gap/padding) rides the space ladder, density-responsive for free (SPEC-R18 AC3).

forcedColors: An explicit `@media (forced-colors: active)` block repoints the card's border to `CanvasText` (the boxed identity survives, SPEC-R19). The glyph is a `<ui-icon>` (an inline SVG the icon adapter draws in `currentColor`) and the name/meta are real text — both survive WHCM with no dedicated rule in this file.
---

# ui-attachment

`ui-attachment` is the **Display**-class, FilePart-aligned compact file card (ADR-0112, feed family v1)
— a category glyph plus a name/size cell, real selectable DOM text throughout. It is **not** interactive
and **not** form-associated: no events, no keyboard contract, no `[size]`/`[scale]` control geometry.

```html
<ui-attachment filename="report.pdf" mime-type="application/pdf" size-bytes="48200"></ui-attachment>
<ui-attachment mime-type="image/png" size-bytes="12000"></ui-attachment> <!-- name falls back to "Image" -->
```

## Rendering

The card is component-built light DOM — a decorative glyph followed by a name (+ optional size) cell,
whole-swap rebuild on any prop change (the `ui-stat`/`ui-bar-chart` posture; there is no interior state
worth preserving on a four-node card). `mimeType` drives glyph derivation through a pure, DOM-free
`fileCategory` map (image · audio · video · pdf · text · archive · data · default) resolved to a vendored
file glyph through the icon adapter. An empty `name` falls back to the resolved category's label (e.g.
"Image", "PDF document") — the title is **never empty**.

## Size

`sizeBytes` (`size-bytes` attribute) is bytes and is **deliberately not a wire field** — `A2aFilePart`
carries none; it is embedder-supplied (e.g. computed from decoded bytes). Named `sizeBytes`, not `size` —
the fleet reserves a literal `size` attribute for the widget-tier `[sm,md,lg]` geometry enum every sized
control shares (ADR-0112 Amendment 1). A finite, non-negative `sizeBytes` formats through a pure module
(`Intl.NumberFormat`, decimal B/KB/MB/GB/TB steps); `null`, non-finite, or negative values mean the size
cell is **absent**, never a fabricated "0 B" or "NaN B".

## The `href` prop — present, not yet wired

`href` exists on the element now (the fourth prop the FilePart wire shape mirrors, SPEC-R8) but its
rendering leg — the name cell becoming a native, security-gated `<a>` — is a **deferred, separately-shipped
slice** (LLD-C6, reusing the shared `controls/text/href.ts` gate content-family owns). In this build the
name always renders as plain text regardless of `href`.

## Accessibility

The glyph is decorative (aria-hidden by `ui-icon`'s own default — no `label` is ever set on it); the name
and size are real DOM text and are the card's whole accessible meaning. The host mints no
`ElementInternals` ARIA of its own — there is nothing silent to name.

## Truncation & composability

The name cell truncates to a single line with an ellipsis in a narrow container (the fleet's shared
CSS-only mechanism); the full name remains the accessible/selectable text. The card is `inline-grid` +
`max-inline-size: 100%`, so several cards compose N-up in a `Row(wrap)` or as `ui-list` children with zero
extra code — list semantics stay in `ui-list`, never baked into this type.

## Sizing

The host floors at `--ui-attachment-min-inline-size` (`12em` default) in an unstyled flex row
(test-the-whole-shape). The glyph rides the fixed content-icon register (`--md-sys-icon-md`) — there is no
`[size]`/`[scale]` axis on this Display-class leaf.
