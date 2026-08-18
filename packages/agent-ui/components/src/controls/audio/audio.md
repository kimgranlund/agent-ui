---
# audio.md frontmatter — the GENERATION SOURCE for ui-audio's `static props` block (ADR-0173; GH #1209).
# The machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# `audio.props.gen.ts` is GENERATED from `attributes[]` below (`node scripts/generate-props.mjs audio`).
# The fleet drift gate (descriptor/props-gen-driftwire.test.ts) keeps the two byte-identical.
#
# ADR ruling posture (GH #1209): ui-audio is a CONVENTIONAL component admission — the A2UI standard
# basic-catalog's own AudioPlayer shape realized as a NATIVE <audio controls>; no custom chrome (fenced as
# its own future intake); no new ADR file (the ui-image ruling's exact precedent, same wave as ui-video).
tag: ui-audio
description: A URL-sourced audio player — the native <audio controls>, no custom chrome, intrinsic UA player height.
tier: display          # Display band: the UA's audio bar has its own intrinsic height — no control-height
                        # ramp, no aspect box (audio has no visual canvas to reserve; contrast ui-video)
extends: UIElement     # non-form-associated display leaf; the NATIVE element carries all interaction

attributes:            # attributes-as-API — the GENERATION SOURCE for audio.ts's `static props` (ADR-0173)
  - name: src
    type: string
    default: ''
    reflect: false      # property-only render input (the image.md/video.md `src` posture); URL only
    description: The audio URL. Renders no <audio> at all when empty (never a dead player bar).
  - name: label
    type: string
    default: ''
    reflect: false
    description: REQUIRED in spirit (the a2ui catalog enforces it at admission, the Image `alt` discipline) — written as the interior <audio>'s aria-label, its accessible name. Never synthesized.
  - name: preload
    type: enum
    values: [none, metadata, auto]
    default: metadata
    reflect: false
    description: The native <audio preload> policy — metadata (default), none, or auto. Autoplay/loop are deliberately ABSENT at v1 (the ui-video fence, verbatim).

properties: []

events: []             # the NATIVE <audio controls> owns all interaction — this host emits nothing

slots: []              # no slotted content model at v1

parts:
  - name: media
    description: The control-built `<audio data-part="media" controls>` — created once in connected() and only ever mutated (src/preload/aria-label), never replaced (the ui-image persistent-media law). Absent entirely when `src` is empty.

customStates: []

face:
  formAssociated: false

aria:
  role: none              # the interior native <audio aria-label="..."> is the semantic element
  roleSource: none
  labelSource: interior audio aria-label

keyboard: []           # the NATIVE controls carry the whole keyboard contract

geometry:
  sizeClass: display
  # NO aspect box — the UA audio bar's intrinsic block-size IS the geometry (audio reserves no visual
  # canvas; the zero-CLS concern ui-video answers with --_aspect does not exist here).

forcedColors: The native audio controls are UA-rendered and handle forced-colors natively; the host paints no box of its own (no border minted — an audio bar is never a background-drawn void the way an unloaded video canvas is).
---

# ui-audio

`ui-audio` is the URL-sourced **audio player** primitive (GH #1209, the A2UI standard basic-catalog's
`AudioPlayer` type): the **native `<audio controls>`**, nothing more. No custom transport UI (a named future
intake), no aspect box (an audio bar has no visual canvas to reserve — the UA bar's intrinsic height is the
geometry), and the same media-leaf discipline as `ui-image`/`ui-video`: a persistent control-built native
element, created once and only ever mutated.

```html
<ui-audio src="/clips/welcome-message.mp3" label="Welcome message from your host, Maria"></ui-audio>
```

## Native player, native a11y

The interior `<audio data-part="media" controls>` is a real native element — playback, keyboard, focus and
forced-colors are the UA's own. `label` becomes its `aria-label` (the player's accessible name), required
**in spirit** per the Image `alt` discipline: never synthesized here; the catalog admission layer flags gaps.

## Deliberate v1 absences

`autoplay` and `loop` are absent by design (the `ui-video` fence, verbatim). Track/caption children are a
named future intake.

## Sizing

Display-class: the host defaults to `inline-size: 100%`; block size is the UA player bar's intrinsic height.
