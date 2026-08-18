---
# image.md frontmatter — the GENERATION SOURCE for ui-image's `static props` block (ADR-0173; GH #1189 R1/R2).
# The machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# `image.props.gen.ts` is GENERATED from `attributes[]` below (`node scripts/generate-props.mjs image`) — the
# plain bare-`prop.*()` majority case (no bespoke codec). image.ts imports the generated module — never
# hand-edit it. The fleet drift gate (descriptor/props-gen-driftwire.test.ts) keeps the two byte-identical.
#
# ADR ruling (host, GH #1189): ui-image is a CONVENTIONAL component admission — matching the A2UI standard
# basic-catalog's own Image shape and this repo's ui-avatar <img>+object-fit precedent — NOT a novel
# architectural departure. No new ADR file.
tag: ui-image
description: A URL-sourced image with a reserved aspect-ratio box (zero CLS), native lazy-loading, and an optional bottom scrim for overlay caption content.
tier: display          # geometry size-class (Display band, geometry.md's "five size-classes" table: "non-text
                        # display ... intrinsic structural sizing" — a media box has no --md-sys-height-* control
                        # frame, no [size]/[scale] control-band row; its lever is aspect-ratio + the layout track
                        # sizing it, the SAME posture as ui-avatar's box-off-the-widget-ramp would be wrong here
                        # because ui-image's box is arbitrary/author-sized, not a small fixed compact-ramp step)
extends: UIElement     # a non-interactive, non-form-associated display LEAF (no events, no keyboard, no focus —
                        # the description-list/ui-stat posture; NOT a fallback-chain component like ui-avatar)
# marginal: measured via `npm run size` at integration time (leave-one-out) — see the build report for the
# actual delta; expected small (one render effect + two pure-math helpers, no interaction machinery).

attributes:            # attributes-as-API — the GENERATION SOURCE for image.ts's `static props` (ADR-0173)
  - name: src
    type: string
    default: ''
    reflect: false      # NOT reflected — property-only render input (the avatar.md `src` posture); a URL only,
                         # no upload/hosting (ADR-0073 trust boundary untouched)
    description: The image URL. Renders no <img> at all when empty (never a broken-image box).
  - name: alt
    type: string
    default: ''
    reflect: false      # NOT reflected — real content text, not a CSS hook
    description: REQUIRED in spirit (the a2ui catalog enforces it at admission; this component never coerces or hides an empty value) — the interior <img>'s accessible name. Never synthesized, never defaulted to decorative empty-alt (contrast with ui-avatar's own interior-node empty-alt posture, which is a DIFFERENT contract for a DIFFERENT component: avatar's img is one link in a decorative-by-default fallback chain; ui-image's img IS the content).
  - name: fit
    type: enum
    values: [cover, contain]
    default: cover
    reflect: true       # reflects so the [fit] object-fit repoint in image.css applies to JS-set values (the avatar [size] precedent)
    description: The interior <img>'s object-fit — cover (default, fills and crops) or contain (letterboxes, preserves the whole frame).
  - name: aspect
    type: string
    default: '16/9'
    reflect: false      # NOT reflected as a CSS-selected enum — an arbitrary ratio, applied via a per-instance
                         # style custom property (the ui-progress `--_pct` precedent), sanitized by
                         # image-model.ts's parseAspectRatio (malformed input never reaches CSS unsanitized)
    description: 'A "W/H" aspect ratio (e.g. "16/9", "1/1", "4/3") driving the host CSS aspect-ratio box. Malformed/omitted falls back to 16/9 — NEVER to "auto" — so space is reserved before the image loads regardless of its natural dimensions (zero CLS, by construction).'
  - name: usageHint
    type: enum
    values: [hero, thumb, avatar, inline]
    default: inline
    reflect: false      # property-only — a behavioral (loading-eagerness) lever, not a CSS-selected state
    attribute: usage-hint  # kebab HTML attribute — camelCase never matches the always-lowercase real DOM attribute (the button.md iconOnly precedent)
    description: A hint affecting loading defaults (image-model.ts usageHintDefaults) — hero is the likely LCP element (loading=eager, fetchpriority=high); thumb/avatar/inline (the default) all lazy-load (loading=lazy, decoding=async) — zero-dep, native, no IntersectionObserver.

properties: []         # no manual accessors beyond the five typed props

events: []             # display-only — emits nothing (a static media leaf, no keyboard/focus contract)

slots:                 # slots name a POSITION; "caption" is the default/unnamed-children position (the
                        # button.md "label" precedent — a documented slot the CSS does not select BY NAME,
                        # since it targets ":not([data-part='media'])" rather than a literal [slot=...] selector)
  - name: caption
    optional: true
    description: Optional default-slotted (unnamed) light-DOM content pinned to the bottom, over the scrim gradient (R2) — e.g. a <span> or <div> of caption text. Absent ⇒ no scrim box is painted at all (no phantom overlay on a caption-less image).

parts:                  # data-part nodes the render effect builds
  - name: media
    description: The control-built `<img data-part="media">` — created once in connected() and only ever mutated (src/alt/fit-driven object-fit/loading/decoding/fetchpriority), never replaced, so it never clobbers sibling caption content. Absent entirely when `src` is empty (no broken-image box).

customStates: []       # NO interaction state and NO motion gate — a display leaf has neither

face:
  formAssociated: false  # a display leaf — extends UIElement, no value/validity participation

aria:
  role: none              # no internals role is minted on the HOST — the interior real <img alt="..."> carries
                           # its own accessible name/semantics natively; duplicating it on the host would
                           # double-announce (unlike ui-avatar, whose interior img is decorative-by-default and
                           # so DOES need a host-level opt-in role)
  roleSource: none
  labelSource: interior img alt  # the real, native <img alt> IS the accessible name — no ElementInternals involved

keyboard: []           # NOT interactive and NOT focusable — no tabindex, no keyboard contract

geometry:
  sizeClass: display
  aspectRatio: var(--_aspect, 16 / 9)  # per-instance style property (image-model.ts parseAspectRatio), NOT a
                                        # --ui-image-* token — arbitrary numeric data, the ui-progress --_pct
                                        # precedent (private, instance-computed, outside the token contract)
  # NO --md-sys-height-* consumption, NO [size]/[scale] geometry row — the Display-band law (geometry.md):
  # the lever is aspect-ratio + the layout track sizing the box (host defaults to inline-size:100%, matching
  # the common responsive-image reset), not a control-height ramp.

forcedColors: An explicit `@media (forced-colors: active)` block adds a system-ink (CanvasText) border so the media box boundary stays visible under WHCM (the ui-avatar/ui-badge box-boundary precedent) — needed because a broken/slow-loading image or a caption-less box is otherwise a background-drawn area that can merge with the page. The scrim + caption ink are real painted content, not repointed under forced-colors (the caption text itself is real text and survives via the UA's own forced-colors text handling).
---

# ui-image

`ui-image` is the URL-sourced **content image** primitive (GH #1189 R1/R2, the A2UI standard basic-catalog's
`Image` type): a reserved-aspect-ratio box around a real `<img>`, with native lazy-loading and an optional
bottom scrim for overlay caption content. It is **not** interactive and **not** form-associated — no events, no
keyboard contract, no focus — and it is **not** a fallback-chain component like `ui-avatar`: there is no
initials/icon fallback here, just the `<img>` mechanics.

```html
<ui-image src="/photos/harbor.jpg" alt="Boats moored in the harbor at sunset" aspect="16/9" usage-hint="hero">
  <span>Sunset over the harbor, June 2026</span>
</ui-image>
```

## Zero CLS, by construction

The host's CSS `aspect-ratio` box is **always** a concrete ratio — driven by `aspect` (a `"W/H"` string, e.g.
`"16/9"`, `"1/1"`, `"4/3"`) when supplied, or the `16/9` default when omitted or malformed. It is **never**
`"auto"`: space is reserved before the browser has any natural image dimensions to report, so a Card-with-hero
payload shows zero layout shift whether or not the author specified `aspect` at all. Malformed input (parsed by
`image-model.ts`'s `parseAspectRatio`) falls back to the same `16/9` default rather than reaching CSS unsanitized.

## Lazy-loading, native

The interior `<img>` gets native `loading`/`decoding` (and, for one hint, `fetchpriority`) — zero-dep, browser
built-in, no `IntersectionObserver` machinery:

- `usage-hint="hero"` — the likely **LCP element**: `loading="eager"` (never lazy) + `fetchpriority="high"`.
- `thumb` / `avatar` / `inline` (the default) — `loading="lazy"` + `decoding="async"`, the common case for
  content images below the fold or repeated many-per-page (a gallery of thumbs, a list of avatars).

## The bottom scrim + caption content (R2)

Any **default-slotted** (unnamed) light-DOM children are treated as caption content, pinned to the bottom of
the image over a bottom gradient scrim. The caption's own background is a FLAT `--ui-image-scrim-color` wash
(not merely the gradient's fade) — a deterministic floor decoupled from the caption's height/line-count, paired
with `--ui-image-caption-ink` (a fixed light ink). Both tokens are deliberately **scheme-invariant** (identical
in light and dark — the same posture as `--md-sys-color-dialog-backdrop`): a scrim composites against PHOTO
CONTENT, not the app surface, so it does not travel with the page theme. A caption-less image paints no scrim
box at all.

**The pinned contrast fixture** (a solid `#FFFFFF` image behind the scrim, the worst realistic case): see
`image-model.test.ts` for the full compositing math and the exact contrast ratio in both themes.

## Sizing

`ui-image` is a Display-class leaf (geometry.md): no `[size]`/`[scale]` control-band row, no
`--md-sys-height-*` consumption — the box's lever is `aspect-ratio` plus the layout track sizing it. The host
defaults to `inline-size: 100%` (the common responsive-image reset), so a bare `<ui-image>` dropped into a card
or hero slot fills its container's inline size and derives its block size from `aspect-ratio` alone.

## Accessibility

The interior `<img alt="...">` is REAL, native `<img>` content — its `alt` IS the accessible name; no
`ElementInternals` role is minted on the host (unlike `ui-avatar`, whose interior image is decorative by
default and needs an opt-in host role). `alt` is required **in spirit**: this component never coerces, hides,
or defaults it to empty — an omitted `alt` is a real authoring gap, flagged at the A2UI catalog admission
layer, not silently repaired here.
