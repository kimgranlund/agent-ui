---
# surface-host.md frontmatter — the attributes-as-API descriptor for ui-surface-host (ADR-0004). The
# machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# The `attributes[]` block MUST mirror surface-host.ts `props` — the contract↔props trip-wire
# (surface-host.test.ts) targets this fence. Field set per .claude/docs/plan.md §10 / ADR-0004.
tag: ui-surface-host
# geometry size-class: the schema's SIZE_CLASSES has no literal "structural" member (the LLD's own informal
# label) — `container` is the closest real class: a passive artboard/mount region contributing no control
# height and no flex/grid distribution of AUTHORED children (it builds its own subtree; nothing is ever
# author-composed here), the master-detail-pane.md precedent.
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
  - name: viewTransitions
    attribute: view-transitions
    type: boolean
    default: false
    reflect: true       # GH #742/ADR-0183 Amendment — opt-in View Transitions on RE-RENDERS (post-first-finalize ingest/finalize wrap in withViewTransition; first-paint streaming never transitions; default false / no API / reduced motion byte-identical)
  - name: working
    type: boolean
    default: false
    reflect: true       # ADR-0199 / GH #1104 — the live-surface-mutation state; mirrored into :state(working) by a connected() effect → the breathing inner-shadow overlay (surface-host.css)
  - name: superseded
    type: boolean
    default: false
    reflect: true       # GH #1164 — the settled-history state: a LATER turn shifted the live focus to a newer surface; mirrored into :state(superseded) + a REAL disable sweep over interactive descendants (own claim set, reversible)

properties:
  - name: label
    description: An OPTIONAL accessible name for the artboard region. Meaningful only when this element is composed standalone (e.g. a2ui-live's Canvas tab panel) — `ui-conversation`'s inline per-surface usage never sets it, since the surrounding turn bubble already carries the accessible structure. When non-empty, `internals.role` is set to `region` and `internals.ariaLabel` to the label text (reactively); when empty (the default), NEITHER is set — an unlabelled landmark is noise to assistive tech, not a courtesy.
  - name: wrap
    description: TKT-0084 — opt-in content-hugging artboard, default false (the always-fill-the-container behavior stands unchanged for existing consumers, e.g. a2ui-live's persistent Canvas tab panel). When set, the artboard sizes to its mounted content on both axes instead of forcing a fixed size — the anatomy switches from absolute+translate centering to normal in-flow flex centering (an absolutely positioned box contributes no intrinsic size to its parent, so `wrap` cannot be a plain CSS override of `block-size` alone). Also drops `[data-part='surface']`'s `container-type: inline-size` (ADR-0100 cl.2's own named tradeoff — a content-derived inline size cannot validly be a query container); nested layout primitives inside a wrapped surface render their default/identity layout rather than corrupting to a 0px collapse. Oversized content still scrolls, capped by `--ui-surface-host-wrap-max-block-size`, with the hidden-but-scrollable treatment every `ui-surface-host` instance now carries (`--ui-surface-host-scrollbar-width`, default `none`) — "wrap and not overflow" covers the common case, not an unconditional no-scroll guarantee. `ui-conversation` sets this by default on the surfaces it mounts inline in a bubble.
  - name: viewTransitions
    description: 'GH #742/ADR-0183 Amendment — opt-in View Transitions on RE-RENDERS. The grain ruling: the renderer paints progressively during ingest(), so the event worth a cross-fade is a wire line mutating an ALREADY-PAINTED surface — detected by this host''s own settled-once boundary (its first finalize()). When set, every post-settle ingest() applies inside `withViewTransition` (a root cross-fade; the platform skips superseded transitions, so an update burst shows at most ~one fade, and the spec''s FIFO update-callback queue keeps every line in order), and finalize() rides the SAME channel so validation + root-stretch land behind the last queued mutation. First-paint streaming NEVER transitions — progressive paint is the surface''s whole value. Default false / no startViewTransition API / prefers-reduced-motion: byte-identical to the unwrapped host (the ADR-0183 family law). The fleet ships no DEFAULT view-transition-names (ADR-0183 cl.4; the opt-in named-morph convention per GH #958 lives in `dom/view-transition.ts` and is applied only by surfaces whose own opt-in is set — this host sets none, and the A2UI catalog carries no `viewTransitionNames` opt-in), so a re-render here is still a single root cross-fade and the ADR-0022 moveBefore identity work runs invisibly inside the wrapped mutate — no double-animation, no identity conflicts. Reset on disconnect (a rebuilt artboard''s next stream is a first paint again).'
  - name: bare
    description: GH #241 — opt-in CHROMELESS mount, default false (the checkered docs-preview artboard stands unchanged for existing consumers). Kim's ruling for the chat path — the A2UI render surface gets NO background (the checker gradients and stage color both drop), NO padding (the `[data-part='surface']` inset zeroes), and FULL available width (host and surface span 100% of the containing box) — the rendered payload's own components carry their chrome; the host wrapper is invisible. A pure CSS hook (`[bare]`, surface-host.css), composable with `wrap` — `wrap` keeps owning the block axis (content-hug + cap + hidden scrollbars), `bare` owns the inline axis + the chrome strip; with an externally-definite 100% inline-size the surface box also QUALIFIES as the ADR-0100 cl.2 query container again, so `bare` restores the `container-type: inline-size` that plain `wrap` drops. `ui-conversation` sets this (with `wrap`) on every surface it mounts inline in a turn.

  - name: working
    description: ADR-0199 / GH #1104 — `true` while an in-flight producer turn is mutating THIS surface in place (the fleet-wide live-surface-mutation state, interaction-states.md §7 — the INVERSE of ADR-0191's `pending` stale-content message). Mirrored into `:state(working)` by a connected() effect (presentation-only, never AX-reflected — the turn's announced face stays the narration strip, ADR-0146); the treatment is a breathing diffused inner-shadow `::before` overlay on the surface part, opacity-only/compositor-only, riding the `--ui-working-*` constants through this control's own `--ui-surface-host-working-*` chain. `prefers-reduced-motion: reduce` holds the overlay static at the max rung — never nothing. The shipped flipper is `ui-conversation`'s turn handle (set on route, cleared at the guarded endTurn — finalize() AND fail() both clear); a host app driving this element directly may set it itself.

  - name: superseded
    description: GH #1164 — `true` once a LATER turn has shifted the conversation's live focus to a NEWER surface, so this one must stop reading as live (Kim's blackjack round-2 repro — two live-looking surfaces at once). Mirrored into `:state(superseded)` by a connected() effect; the visual settle is a pure-CSS opacity dim of the surface part to the fleet's stale-content rung (`--ui-surface-host-superseded-opacity`, riding `--ui-pending-opacity`), guarded below the disabled/pending/working rungs with zero-specificity `:where(:not(:state(…)))` exclusions. UNLIKE `working`, not presentation-only — flipping it true runs a real duck-typed disable sweep (the GH #805 walk with its OWN `WeakSet` claim set, so it composes with the action sweep and never touches a payload/checks-owned disabled literal), making the stale card's controls genuinely inert to pointer AND keyboard; flipping it false reverts exactly the claimed elements (the reuse case — a later turn updating this surface again un-supersedes). Each control's own `disabled` prop chain carries the ARIA/tabbable consequences — this host writes no ARIA of its own for this state. The shipped flipper is `ui-conversation`'s registry routing (a fresh createSurface supersedes every other open surface; a line routed to a known surface — or a turn resuming it via `intoSurface` — un-supersedes it); a host app driving this element directly may set it itself.

events: []              # no DOM events — the mount/stream seam is exposed as imperative public methods (ingest/finalize/dispose) plus a callback registration (onClientMessage), never a CustomEvent (SPEC-R2; the closed six-event vocabulary has no streaming/client-message kind)

slots: []                # content model is NOT author-composed — the stage/surface artboard is built entirely by this element's own connect-time logic; no slotted children

parts:                   # NOT shadow-DOM ::part() (light-DOM only) — light-DOM markers this element's own JS creates; documented for completeness (compareDescriptorToSource does not mechanically check `parts:`, the master-detail.md precedent)
  - name: stage
    description: The checkered artboard box (`[data-part="stage"]`) — a positioning/measurement aid, decorative under forced-colors. Under `[bare]` (GH #241) the checker and stage color strip entirely — the chat path's chromeless mount.
  - name: surface
    description: The translate-centered mount point (`[data-part="surface"]`) the internal RendererHost mounts its rendered root into.

customStates:             # ADR-0199 / GH #1104 — bare-scalar sequence (the descriptor grammar)
  - working               # mirrors the `working` prop — the live-surface-mutation state; keys the breathing inner-shadow overlay (surface-host.css); presentation-only, never AX-reflected; precedence `disabled > pending > working > answered > …` (interaction-states.md §7)
  - disabled              # NOT set by this element — appears only inside the working rule's `:not(:state(disabled))` mutual-exclusion guard (TKT-0062's law, the ADR-0199 cl.5 precedence slot)
  - pending               # NOT set by this element — appears only inside the working rule's `:not(:state(pending))` guard (pending > working, ADR-0199 cl.5)
  - superseded            # GH #1164 — mirrors the `superseded` prop: the settled-history state; keys the surface-part opacity dim (surface-host.css), sits BELOW working on the precedence ladder (its rule carries `:where(:not(:state(disabled/pending/working)))` guards)

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
host.setInteractiveDisabled(false) // GH #805 — re-enable a card after its own turn failed/aborted
```

## Answered cards disable their inputs (GH #805)

The moment this surface emits an outbound `action` client-message (a button/etc click) that ISN'T an
explicit `wantResponse:false` opt-out (ADR-0088 §3 — a fire-and-forget action, e.g. a Cancel button, that
no turn will ever run for), EVERY interactive descendant currently mounted disables — self-wired at
connect, before any consumer's own `onClientMessage(cb)` runs, so no consumer wiring is required for this
arm. Duck-typed (`'disabled' in el`), never a hardcoded tag list: today's fleet set is
ui-button/ui-checkbox/ui-radio-group/ui-select/ui-text-field/ui-slider/ui-combo-box/ui-calendar/
ui-color-picker/ui-multi-select/ui-range, and any future control that grows a `disabled` prop
participates for free. This is also the double-submit guard, for free — the disabled controls themselves
make a second click on the same card inert.

The sweep never touches an element that was ALREADY disabled when it ran (a payload-declared `disabled`
literal, or the renderer's own checks controller driving `disabled` off live validity, `renderer/
checks.ts`) — only elements it genuinely flips false→true are remembered (a `WeakSet`), and re-enable
ever only reverts THOSE, leaving payload/checks-owned disabled state exactly as it was.

`ingest()` re-enables unconditionally on entry: a NEW line arriving for this surface is the model
re-engaging the card (an in-place `updateComponents` re-render — TKT-0079's game loop) — it "comes back
live" the moment ANY new data arrives, never by inspecting which component ids the new line touches. An
ask-declared surface (GH #802/#803) never receives another line by contract, so it stays disabled as
answered history — exactly the wanted shape, no special-casing needed here.

The one arm this element cannot own itself — a FAILED/aborted turn's re-enable, since only the app
knows whether its own transport call ultimately succeeded — is the public
`setInteractiveDisabled(disabled: boolean)` method: a documented no-op pre-connect, callable any time
to force the disabled state either way (`ui-conversation`'s `AgentTurnHandle.fail()` is the one shipped
caller, conversation.ts).

## Mount + stream ONLY (ADR-0129 clause 1)

This element owns **only** the mount + stream seam — it never calls a transport, holds a model/provider
reference, or reads an API key. The app's own turn loop (its own transport, iterating an
`AsyncIterable<string>`) drives `ingest`/`finalize`/`dispose` imperatively; there is no
transport/provider-shaped prop anywhere on this element's public surface (SPEC-R8).

## Standalone-usable (SPEC-R3)

`ui-surface-host` holds no reference to any ancestor. Composed directly into an app frame's persistent,
chat-external canvas (e.g. a `ui-super-shell` content region — `a2ui-live`'s re-hosted shape, ADR-0156) it behaves identically to one nested inline inside
`ui-conversation`'s own per-surface registry (`ui-conversation` creates one instance per open A2UI
surface, ADR-0129 clause 2) — same class, same public methods, no conditional behaviour keyed on ancestry.

## Terminal-empty state at finalize (`data-empty-final`, ADR-0187 / GH 829)

The empty artboard's placeholder is **anticipatory** — "The rendered surface appears here." is honest only
while content might still arrive. When `finalize()` runs and nothing was ever mounted, the host sets a
`data-empty-final` attribute on itself and the stylesheet swaps that copy for a terminal
"Nothing was rendered for this surface." A silently blank artboard beside a working card, with no
indication anything went wrong, was the reported symptom of GH 802.

Three properties worth knowing:

- **It is a state READ, never a second verdict.** The validator is the sole judge of emptiness
  (a2ui-runtime SPEC-N6's one-implementation law); the wire error for such a surface is emitted by the
  renderer's own opted-in finalize and arrives through the ordinary `onClientMessage` channel. This
  element only presents facts it already holds — finalize happened, and the mount point holds no element.
  It exists because the producer-side guard (`produce()`) cannot protect streams it did not generate:
  recorded transcripts, the A2A bridge, and any third-party producer reach a mounted host raw.
- **The host stays mounted and addressable.** Unmounting was rejected: a later turn legitimately targets
  a known `surfaceId`, which the conversation routes to the ORIGINAL host (SPEC-R7).
- **`ingest()` clears it, unconditionally, on entry.** A new line for this surface means the stream is
  demonstrably not over, whatever the line contains — the same "the model came back" reasoning as the
  GH 805 re-enable arm. The next `finalize()` re-derives the state from the mount's real contents, so a
  surface that received real content stays clear and one still empty re-flags. A reconnect starts clean.

## Pre-connect calls are a documented no-op

`ingest`/`finalize`/`dispose`/`onClientMessage` called before this element has connected (no
`RendererHost` exists yet) are no-ops rather than throws — a single `console.warn` fires the first time
any of them is called pre-connect (not repeated per call), the warn-once-never-throw idiom first
established on the retired `ui-app-shell`'s connect-time-only `isolated` (ADR-0156).

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
