---
# video.md frontmatter — the GENERATION SOURCE for ui-video's `static props` block (ADR-0173; GH #1209).
# The machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# `video.props.gen.ts` is GENERATED from `attributes[]` below (`node scripts/generate-props.mjs video`) — the
# plain bare-`prop.*()` majority case (no bespoke codec). video.ts imports the generated module — never
# hand-edit it. The fleet drift gate (descriptor/props-gen-driftwire.test.ts) keeps the two byte-identical.
#
# ADR ruling posture (GH #1209): ui-video is a CONVENTIONAL component admission — the A2UI standard
# basic-catalog's own Video shape realized as a NATIVE <video controls> wrapped in the ui-image media-leaf
# discipline (reserved aspect box, persistent control-built media element). NO custom player chrome — that
# would be a novel departure and is fenced as its own future intake; no new ADR file (the ui-image ruling's
# exact precedent).
tag: ui-video
description: A URL-sourced video player — the native <video controls> in a reserved aspect-ratio box (zero CLS), poster support, no custom chrome.
tier: display          # Display band (geometry.md): a media box has no control-height ramp; its lever is
                        # aspect-ratio + the layout track sizing it — the ui-image posture verbatim
extends: UIElement     # non-form-associated display leaf; the NATIVE element carries all interaction —
                        # this host mints no events, no keyboard contract, no focus of its own

attributes:            # attributes-as-API — the GENERATION SOURCE for video.ts's `static props` (ADR-0173)
  - name: src
    type: string
    default: ''
    reflect: false      # property-only render input (the image.md `src` posture); a URL only —
                         # no upload/hosting (ADR-0073 trust boundary untouched)
    description: The video URL. Renders no <video> at all when empty (never a dead player shell).
  - name: label
    type: string
    default: ''
    reflect: false      # real content text, not a CSS hook
    description: REQUIRED in spirit (the a2ui catalog enforces it at admission, the Image `alt` discipline) — written as the interior <video>'s aria-label, its accessible name. Never synthesized.
  - name: poster
    type: string
    default: ''
    reflect: false      # property-only render input, same posture as src
    description: Optional poster-frame URL shown before playback starts (the native <video poster> attribute, passed through verbatim; empty ⇒ no poster attribute at all).
  - name: aspect
    type: string
    default: '16/9'
    reflect: false      # per-instance style property (the ui-image/ui-progress `--_aspect`/`--_pct`
                         # precedent), sanitized by media-model.ts's parseAspectRatio
    description: 'A "W/H" aspect ratio driving the host CSS aspect-ratio box. Malformed/omitted falls back to 16/9 — NEVER to "auto" — so space is reserved before any metadata loads (zero CLS, by construction; the ui-image law).'
  - name: preload
    type: enum
    values: [none, metadata, auto]
    default: metadata
    reflect: false      # a behavioral loading lever, not a CSS-selected state (the image usageHint posture)
    description: The native <video preload> policy — metadata (default; dimensions/duration only), none, or auto. Autoplay/loop/muted are deliberately ABSENT at v1 (agent-driven autoplay is a UX hazard — a named future intake, never a silent default).

properties: []         # no manual accessors beyond the five typed props

events: []             # the NATIVE <video controls> owns all interaction — this host emits nothing
                        # (playback events stay native on the interior element, outside the fleet vocabulary)

slots: []              # no slotted content model at v1 — captions/tracks are a named future intake
                        # (a <track> child API needs its own design pass, not a silent passthrough)

parts:                  # data-part nodes the render effect builds
  - name: media
    description: The control-built `<video data-part="media" controls>` — created once in connected() and only ever mutated (src/poster/preload/aria-label), never replaced (the ui-image persistent-media law). Absent entirely when `src` is empty.

customStates: []       # a display leaf hosting a native player — no fleet interaction state minted

face:
  formAssociated: false

aria:
  role: none              # no internals role on the HOST — the interior native <video aria-label="..."> is
                           # the semantic element; doubling it on the host would double-announce
  roleSource: none
  labelSource: interior video aria-label

keyboard: []           # the NATIVE controls carry the whole keyboard contract; the host adds none

geometry:
  sizeClass: display
  aspectRatio: var(--_aspect, 16 / 9)  # per-instance style property (media-model.ts parseAspectRatio) —
                                        # the ui-image geometry law verbatim

forcedColors: An explicit `@media (forced-colors: active)` block adds a system-ink (CanvasText) border so the media box boundary stays visible under WHCM (the ui-image/ui-avatar box-boundary precedent) — a poster-less, not-yet-loaded player is otherwise a background-drawn area that can merge with the page. The native controls themselves are UA-rendered and handle forced-colors natively.
---

# ui-video

`ui-video` is the URL-sourced **video player** primitive (GH #1209, the A2UI standard basic-catalog's `Video`
type): the **native `<video controls>`** wrapped in the fleet's media-leaf discipline — a reserved
aspect-ratio box (zero CLS, the `ui-image` law), poster support, and native browser player chrome. It ships
**no custom player UI**: transport controls, scrubbing, volume, fullscreen are all the UA's own — custom
chrome is a named future intake, never a silent add.

```html
<ui-video src="/clips/tour.mp4" poster="/clips/tour-poster.jpg" label="Guided tour of the Alfama apartment" aspect="16/9"></ui-video>
```

## Zero CLS, by construction

Identical to `ui-image`: the host's CSS `aspect-ratio` is **always** a concrete ratio — `aspect` when supplied
and well-formed, the `16/9` default otherwise, never `"auto"` — so a Card-with-video payload reserves its box
before any media metadata arrives. Sanitized by the shared `media-model.ts` `parseAspectRatio`.

## Native player, native a11y

The interior `<video data-part="media" controls>` is a REAL native element: playback, keyboard, focus, and
forced-colors handling are all the UA's. `label` is written as its `aria-label` — the player's accessible
name — and is required **in spirit**: never synthesized or defaulted here; the A2UI catalog admission layer
flags the gap.

## Deliberate v1 absences

`autoplay`, `loop`, and `muted` are **absent by design** (agent-driven autoplay is a UX hazard); `<track>`
captions are a named future intake needing their own design pass. Each absence is a fence, not an oversight.

## Sizing

Display-class (geometry.md): no `[size]`/`[scale]` row, no `--md-sys-height-*` — the lever is `aspect-ratio`
plus the layout track. The host defaults to `inline-size: 100%` (the responsive-media reset).
