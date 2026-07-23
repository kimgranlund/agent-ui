---
# surface-host.md frontmatter — the attributes-as-API descriptor for ui-surface-host (ADR-0004). The
# machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# The `attributes[]` block MUST mirror surface-host.ts `props` — the contract↔props trip-wire
# (surface-host.test.ts) targets this fence. Field set per .claude/docs/plan.md §10 / ADR-0004.
tag: ui-surface-host
# geometry size-class: the schema's SIZE_CLASSES has no literal "structural" member (the LLD's own informal
# label) — `container` is the closest real class: a passive artboard/mount region contributing no control
# height and no flex/grid distribution of AUTHORED children (it builds its own subtree; nothing is ever
# author-composed here), the app-shell-region.md/master-detail-pane.md precedent.
tier: container
extends: UIElement      # a plain structural base — NOT UIContainerElement: no surfaceProps/flexProps, this element owns no elevation/flex grammar of its own
# marginal: measured at the @agent-ui/app integration slice (scripts/measure-size.mjs, LLD-C9), after the M2 reference-app re-host — the M1/M4 kickoff discipline, never guessed in advance

attributes:             # attributes-as-API — mirrors surface-host.ts `props`
  - name: label
    type: string
    default: ''
    reflect: true       # TKT-0069 item 2 ruling: label reflects fleet-wide
  - name: wrap
    type: boolean
    default: false
    reflect: true       # TKT-0084: reflects to a `wrap` attribute → the CSS anatomy switch (surface-host.css); pure CSS hook, no JS behavior beyond reflection
  - name: bare
    type: boolean
    default: false
    reflect: true       # GH #241: reflects to a `bare` attribute → the chromeless-mount CSS hook (surface-host.css); pure CSS hook, no JS behavior beyond reflection

properties:
  - name: label
    description: An OPTIONAL accessible name for the artboard region. Meaningful only when this element is composed standalone (e.g. a2ui-live's Canvas tab panel) — `ui-conversation`'s inline per-surface usage never sets it, since the surrounding turn bubble already carries the accessible structure. When non-empty, `internals.role` is set to `region` and `internals.ariaLabel` to the label text (reactively); when empty (the default), NEITHER is set — an unlabelled landmark is noise to assistive tech, not a courtesy.
  - name: wrap
    description: TKT-0084 — opt-in content-hugging artboard, default false (the always-fill-the-container behavior stands unchanged for existing consumers, e.g. a2ui-live's persistent Canvas tab panel). When set, the artboard sizes to its mounted content on both axes instead of forcing a fixed size — the anatomy switches from absolute+translate centering to normal in-flow flex centering (an absolutely positioned box contributes no intrinsic size to its parent, so `wrap` cannot be a plain CSS override of `block-size` alone). Also drops `[data-part='surface']`'s `container-type: inline-size` (ADR-0100 cl.2's own named tradeoff — a content-derived inline size cannot validly be a query container); nested layout primitives inside a wrapped surface render their default/identity layout rather than corrupting to a 0px collapse. Oversized content still scrolls, capped by `--ui-surface-host-wrap-max-block-size`, with the hidden-but-scrollable treatment every `ui-surface-host` instance now carries (`--ui-surface-host-scrollbar-width`, default `none`) — "wrap and not overflow" covers the common case, not an unconditional no-scroll guarantee. `ui-conversation` sets this by default on the surfaces it mounts inline in a bubble.
  - name: bare
    description: GH #241 — opt-in CHROMELESS mount, default false (the checkered docs-preview artboard stands unchanged for existing consumers). Kim's ruling for the chat path — the A2UI render surface gets NO background (the checker gradients and stage color both drop), NO padding (the `[data-part='surface']` inset zeroes), and FULL available width (host and surface span 100% of the containing box) — the rendered payload's own components carry their chrome; the host wrapper is invisible. A pure CSS hook (`[bare]`, surface-host.css), composable with `wrap` — `wrap` keeps owning the block axis (content-hug + cap + hidden scrollbars), `bare` owns the inline axis + the chrome strip; with an externally-definite 100% inline-size the surface box also QUALIFIES as the ADR-0100 cl.2 query container again, so `bare` restores the `container-type: inline-size` that plain `wrap` drops. `ui-conversation` sets this (with `wrap`) on every surface it mounts inline in a turn.

events: []              # no DOM events — the mount/stream seam is exposed as imperative public methods (ingest/finalize/dispose) plus a callback registration (onClientMessage), never a CustomEvent (SPEC-R2; the closed six-event vocabulary has no streaming/client-message kind)

slots: []                # content model is NOT author-composed — the stage/surface artboard is built entirely by this element's own connect-time logic; no slotted children

parts:                   # NOT shadow-DOM ::part() (light-DOM only) — light-DOM markers this element's own JS creates; documented for completeness (compareDescriptorToSource does not mechanically check `parts:`, the master-detail.md precedent)
  - name: stage
    description: The checkered artboard box (`[data-part="stage"]`) — a positioning/measurement aid, decorative under forced-colors. Under `[bare]` (GH #241) the checker and stage color strip entirely — the chat path's chromeless mount.
  - name: surface
    description: The translate-centered mount point (`[data-part="surface"]`) the internal RendererHost mounts its rendered root into.

customStates: []          # no :state() hooks — this element carries no interaction state of its own

face:
  formAssociated: false   # NOT a FACE form control — a mount/stream seam contributes nothing to a form

aria:
  role: region (conditional) # set via internals ONLY when `label` is non-empty; absent otherwise
  roleSource: internals       # this.internals.role — never a host `role` attribute
  childModel: none — the stage/surface subtree is built entirely by this element's own connect-time logic; nothing is ever author-composed or slotted

keyboard: []              # no keyboard interaction of its own — the mounted A2UI surface's own controls carry their own keyboard behaviour

geometry:
  sizeClass: container              # Container band — no control height, no flex/grid distribution of authored children
  blockSize: consumer-supplied      # fills its containing box (100% inline/block) — give it a definite block-size in the surrounding layout (the canvas-surface.ts contract, unchanged); OR set [wrap] (TKT-0084) to size to mounted content instead, capped by --ui-surface-host-wrap-max-block-size
  paddingBlock: 0                   # the host itself adds no padding — the inner [data-part="surface"] carries its own 1rem inset (zeroed under [bare], GH #241)

forcedColors: The checkered `[data-part="stage"]` background is decorative (a positioning/measurement aid, not information-bearing) — it simplifies to the platform `Canvas` colour under `forced-colors: active` (surface-host.css), as long as the mounted A2UI surface's own controls keep their own forced-colors handling (proven per-control, not here).
---

# ui-surface-host

`ui-surface-host` is the M2 **mount/stream seam** (`@agent-ui/app`) — a structural, **non-form-associated**
`UIElement`, light-DOM by default. It wraps exactly ONE `@agent-ui/a2ui` `RendererHost`: at connect it
builds its own checkered artboard (a `stage` box nesting a translate-centered `surface` mount point,
promoted verbatim from `site/lib/canvas-surface.ts`) and mounts a fresh `createRenderer()` host into it.

```html
<ui-surface-host label="Rendered agent surface"></ui-surface-host>
```

```ts
const host = document.querySelector('ui-surface-host')
host.onClientMessage((message) => { /* route an action/response/error however the app likes */ })
host.ingest(jsonlLine) // one validated A2UI JSONL line at a time, as the app's OWN transport yields them
host.finalize()        // end of a batch — stretches a root ui-column to fill the artboard
host.dispose()         // tears down the RendererHost; idempotent-safe
```

## Mount + stream ONLY (ADR-0129 clause 1)

This element owns **only** the mount + stream seam — it never calls a transport, holds a model/provider
reference, or reads an API key. The app's own turn loop (its own transport, iterating an
`AsyncIterable<string>`) drives `ingest`/`finalize`/`dispose` imperatively; there is no
transport/provider-shaped prop anywhere on this element's public surface (SPEC-R8).

## Standalone-usable (SPEC-R3)

`ui-surface-host` holds no reference to any ancestor. Composed directly into a `ui-app-shell-region` (a
persistent, chat-external canvas, `a2ui-live`'s shape) it behaves identically to one nested inline inside
`ui-conversation`'s own per-surface registry (`ui-conversation` creates one instance per open A2UI
surface, ADR-0129 clause 2) — same class, same public methods, no conditional behaviour keyed on ancestry.

## Pre-connect calls are a documented no-op

`ingest`/`finalize`/`dispose`/`onClientMessage` called before this element has connected (no
`RendererHost` exists yet) are no-ops rather than throws — a single `console.warn` fires the first time
any of them is called pre-connect (not repeated per call), mirroring `ui-app-shell`'s connect-time-only
`isolated` precedent.

## Disconnect disposes the `RendererHost` (leak-safety)

A consumer that removes this element from the DOM WITHOUT calling `dispose()` itself must not leak the
`RendererHost`'s signals/listeners/surface scopes — `disconnected()` disposes it exactly as an explicit
`dispose()` call would (the select.ts/text-field.ts "heavyweight per-connection resource" precedent). The
internal references are also nulled and the (now-torn-down) stage/surface subtree is dropped, so a LATER
reconnect rebuilds a fresh, empty artboard via the same connect-time build path — never a duplicate
subtree, never a permanently-dead husk.

## Accessibility

Carries NO ARIA role by default — a landmark role with no accessible name is noise to assistive tech, not
a courtesy. Setting `label` gives the artboard a real `region` landmark (`internals.role`/`internals.
ariaLabel`, never a host attribute); leave it unset when this element is composed inline where the
surrounding structure (e.g. a chat turn's own bubble) already carries the accessible context.
