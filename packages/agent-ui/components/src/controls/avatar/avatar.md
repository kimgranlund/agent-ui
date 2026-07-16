---
# avatar.md frontmatter — the attributes-as-API descriptor for ui-avatar (ADR-0004; LLD-C10,
# feed-family.lld.md §6). The machine-checkable public surface lives HERE (frontmatter); the prose below
# the fence is the /site doc. The `attributes[]` block MUST mirror avatar.ts `static props`
# (src/identity/label/size) — the contract<->props trip-wire (avatar-descriptor.test.ts) targets this fence.
tag: ui-avatar
description: A compact circular identity mark that shows a photo, initials, or a fallback glyph for one person.
tier: indicator        # geometry size-class — the F3 widget-box class (ADR-0041; SPEC-R20), NOT display:
                        # a small fixed painted box, same kin as checkbox/switch/tag, sized off the
                        # compact ramp — non-interactive is stated in prose (no keyboard/focus contract)
extends: UIElement     # a non-interactive, non-form-associated display LEAF (SPEC-R4)
# marginal: not yet measured — this folder-only wave (M1-a) ships ahead of the LLD-C11 shared-file
# integration slice (barrel export, component-styles.css import, package.json exports entry); the real
# `npm run size` figure lands with that slice, per feed-family.lld.md §6 (measured, never guessed).

attributes:            # attributes-as-API — mirrors avatar.ts `static props` (src, identity, label, size)
  - name: src
    type: string
    default: ''
    reflect: false      # NOT reflected — property-only render input; a load error falls back without ever
                         # exposing the failed URL as a host attribute
  - name: identity
    type: string
    default: ''
    reflect: false      # NOT reflected — the identity the initials derive from; NOT announced by default
                         # (SPEC-R6 — announcing it would duplicate the visible name the avatar sits beside)
  - name: label
    type: string
    default: ''
    reflect: true       # TKT-0069 item 2 ruling: label reflects fleet-wide
                         # itself the accessible name (role=img)
  - name: size
    type: enum
    values: [sm, md, lg]
    default: md
    reflect: true       # REFLECTED — the CSS `[size]` hook that repoints the widget-box ramp tier
                         # (the checkbox/badge precedent)

properties: []         # no manual accessors beyond the four typed props

events: []             # display-only — emits nothing (SPEC-R4: no events, no keyboard contract)

slots: []              # no light-DOM content model — render() stays the inherited no-op; every child
                        # (img / initials span / ui-icon) is control-built (createElement + replaceChildren),
                        # never author-slotted

parts:                  # data-part nodes the render effect builds (only the initials link carries one —
                         # the img and ui-icon fallback links are selected by TAG in avatar.css, not by name)
  - name: initials
    description: The `<span data-part="initials">` — present only when the fallback chain resolves to the initials link (no `src`, or `src` failed, AND `name` yields a non-empty derivation). Real, selectable text.

customStates: []       # NO interaction state and NO motion gate — a non-interactive leaf has neither
                        # (no :state(); nothing to transition)

face:
  formAssociated: false  # a display leaf — extends UIElement, no value/validity participation

aria:
  role: none              # decorative by default (SPEC-R6 — the ADR-0065 cl.4 default HOLDS here); a
                           # non-empty `label` flips this to `img`
  roleSource: internals    # a reactive connected() effect off `label` sets internals.role/.ariaLabel/
                            # .ariaHidden — NEVER a host role/aria-*/aria-hidden attribute (the FACE pattern)
  labelSource: label prop  # non-empty `label` IS the accessible name (internals.ariaLabel). AUTHOR-ERROR
                            # NOTE (SPEC-R6, binding): a label-less avatar placed beside NO visible name
                            # announces NOTHING — this is by contract, not a defect; the decorative default
                            # assumes a feed avatar sits beside its own name text. Supply `label` for the
                            # standalone case where the avatar IS the only identity signifier.

keyboard: []           # NOT interactive and NOT focusable — no tabindex, no keyboard contract

geometry:
  sizeClass: indicator
  boxSize: var(--ui-avatar-size)  # off the widget-box ramp `--ui-compact-{sm,md,lg}` (ADR-0041, fork F3);
                                    # `[size]` repoints the tier; `[scale]` on an ancestor re-tables the
                                    # ramp for the subtree for free — no avatar-local [scale] rule needed
  # NO --ui-height-* consumption (SPEC-R20 AC2) — a box, not a control-height row.

forcedColors: An explicit `@media (forced-colors: active)` block adds a system-ink (`CanvasText`) border so the circle boundary stays visible under WHCM (SPEC-R19 — a background-drawn plane can otherwise merge with the page). Initials are real text and survive untouched; the `ui-icon` glyph inherits the consuming context's forced-colors ink (icon.md's own posture).
---

# ui-avatar

`ui-avatar` is the **Indicator**-class compact identity mark (ADR-0112, feed family v1) — a circle-masked
widget box that walks a fallback chain: an image, then initials, then a generic person glyph. It is
**not** interactive and **not** form-associated: no events, no keyboard contract, no focus.

```html
<ui-avatar src="/users/42/photo.jpg" name="Ada Lovelace"></ui-avatar>
<ui-avatar identity="Grace Hopper" size="lg"></ui-avatar>
<ui-avatar label="Ada Lovelace"></ui-avatar>
```

## The fallback chain

Exactly one link renders at a time (SPEC-R5) — **never a broken-image box, never silent-empty**:

1. **Image** — a non-empty `src` that hasn't already failed. A load error falls back to initials (or the
   glyph, when `name` is empty) without a broken-image frame ever painting as the final state. Setting a
   NEW `src` after a failure re-attempts the image automatically; clearing `src` falls back immediately.
2. **Initials** — derived from `name` by a pure, grapheme-safe function (`avatar-initials.ts`): the first
   grapheme of the first word + the first grapheme of the last word (a single word yields one grapheme),
   locale-uppercased. Empty/whitespace `name` skips straight to the glyph.
3. **Glyph** — the vendored person icon (`<ui-icon glyph="user">`), decorative by its own default.

## Accessibility

**Decorative by default** (SPEC-R6, the ADR-0065 cl.4 posture): a feed avatar typically sits beside its
own visible name, so announcing the avatar too would repeat it. Default: `internals.ariaHidden = 'true'`,
no role. Supplying a non-empty `label` makes the avatar itself the accessible content: `role="img"` +
`internals.ariaLabel = label`, `ariaHidden` cleared — the same contract shape as `ui-icon`.

**A label-less avatar beside no visible name announces nothing — by contract.** This is a stated author
error, not a component defect: the decorative default assumes an adjacent name; a standalone avatar (the
sole identity signifier in its context) needs `label`.

## Identity: no hue coding

The fallback surface (initials and glyph states) is **one** neutral plane + on-surface ink pair — the
same for every `name` (SPEC-R7). Per-identity hash-picked hues are deliberately out of scope: they are a
hue-only signifier (the CVD posture, ADR-0057 forbids meaning carried by hue alone) and an unbounded AA
matrix (every generated hue × both color schemes would need independent verification). Identity is
carried by the initials/name text, never by color. A curated, AA-verified accent-pair palette is the
named foreseen extension if identity-at-a-glance proves needed.

## Sizing

`size` (`sm` / `md` / `lg`, default `md`, reflected) selects the widget-box tier off the ratified
`--ui-compact-{sm,md,lg}` ramp (ADR-0041) — the same ramp checkbox/switch/tag use, 12–28px depending on an
ancestor `[scale]`. The component token `--ui-avatar-size` is the page's override for larger chrome (a
profile header); a real fleet register above 28px is a named, separately-earned extension, not this
component's default.
