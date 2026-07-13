---
# conversation.md frontmatter — the attributes-as-API descriptor for ui-conversation (ADR-0004). The
# machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# The `attributes[]` block MUST mirror conversation.ts `props` — the contract↔props trip-wire
# (conversation.test.ts) targets this fence. Field set per .claude/docs/plan.md §10 / ADR-0004.
tag: ui-conversation
# geometry size-class: the schema's SIZE_CLASSES has no literal "structural" member (the LLD's own informal
# label) — `layout` is the closest real class: a CSS-flex distributor of its OWN thread/composer bands, no
# control height of its own (the ui-app-shell/ui-master-detail precedent).
tier: layout
extends: UIElement      # a plain structural base — composes ui-surface-host/ui-status-stream rather than extending either (ADR-0129 clause 2)
# marginal: measured at the @agent-ui/app integration slice (scripts/measure-size.mjs, LLD-C9), after the M2 reference-app re-host — the M1/M4 kickoff discipline, never guessed in advance

attributes:              # attributes-as-API — mirrors conversation.ts `props`
  - name: disclosure
    type: boolean
    default: false
    reflect: true         # reflects so a JS-set value applies identically to an author-set attribute (ADR-0129 clause 3)

properties:
  - name: disclosure
    description: OPT-IN raw-wire disclosure (ADR-0129 clause 3). Reflected boolean, default false. Narration itself (the per-turn `ui-status-stream`) ships UNCONDITIONALLY — this prop gates only the per-turn `<details>` wire dump of the turn's own raw JSONL lines, a debugging/inspection affordance most product surfaces should not show by default. Appended at `AgentTurnHandle.finalize()` time when true and the turn carried at least one line.

events: []               # no DOM events — the reply affordance (onSubmit) and outbound client messages (onClientMessage) are callback registrations, never CustomEvents (SPEC-R5; the closed six-event vocabulary has no submission/client-message kind)

slots: []                 # content model is NOT author-composed — the thread/composer are built entirely by this element's own connect-time logic and imperative API; no slotted children

parts:                    # NOT shadow-DOM ::part() (light-DOM only) — light-DOM markers this element's own JS creates; documented for completeness (compareDescriptorToSource does not mechanically check `parts:`, the master-detail.md precedent)
  - name: log
    description: The scrolling thread region (`[data-part="log"]`), `aria-live="polite"`. Owns its own scroll (SPEC-R4).
  - name: bubble
    description: One turn (`[data-part="bubble"][data-role="user"|"agent"|"system"]`).
  - name: narration
    description: The per-agent-turn `ui-status-stream` instance (`[data-part="narration"]`), composed fresh per turn.
  - name: mounts
    description: The container (`[data-part="mounts"]`) an agent bubble's OWN inline `ui-surface-host` children mount into.
  - name: annotation
    description: The visible "Closed." note (`[data-part="annotation"]`) appended to a surface's bubble on deletion (SPEC-R7).
  - name: disclosure
    description: The opt-in raw-wire `<details>` dump (`[data-part="disclosure"]`), shown only when `disclosure` is true.
  - name: composer
    description: The reply form (`[data-part="composer"]`) — a `ui-text-field` + a `ui-button`.

customStates: []          # no :state() hooks — a closed surface's dimmed bubble rides a plain `data-state` attribute, not a custom state (the master-detail.md `data-view` precedent)

face:
  formAssociated: false   # NOT a FACE form control — a thread/composer primitive contributes nothing to a form

aria:
  role: none               # this element carries no ARIA role of its own
  roleSource: none
  childModel: none — the thread/composer are built entirely by this element's own connect-time logic and imperative API; nothing is ever author-composed or slotted

contentModel: '[data-part=bubble] children carry a [data-role=user|agent|system] speaker kind (references/naming.md §6 registry, added in this change); a user/agent bubble also carries a [data-part=who] label ("You"/"Agent"), a [data-part=body] text cell, and (agent only) [data-part=narration]/[data-part=mounts]/[data-part=annotation]/[data-part=disclosure] children — none of these are author-composed (SPEC-R4)'

keyboard:
  - keys: Enter
    action: In the composer's ui-text-field, submits the composer text (same as clicking Send) — SPEC-R5 AC1.

geometry:
  sizeClass: layout                 # Container/layout band — a flex distributor of its own bands, no control height
  blockSize: consumer-supplied      # fills its containing box (100% inline/block) — give it a definite block-size in the surrounding layout (the ui-surface-host/ui-app-shell precedent)
  paddingBlock: 0                    # the host itself adds no block padding — the log/composer own their own insets

forcedColors: The bordered shell + composer divider stay legible under `forced-colors: active` (`conversation.css`, `CanvasText`-repointed). The narration strip (`ui-status-stream`) and the composer's own `ui-text-field`/`ui-button` carry their own forced-colors handling; the "Closed." annotation and composer/bubble text are plain text, legible for free under the platform's own forced-colors text/background repaint.
---

# ui-conversation

`ui-conversation` is the M2 **thread + composer + per-turn narration** primitive (`@agent-ui/app`) — a
structural, **non-form-associated** `UIElement`, light-DOM by default. It presents a scrolling multi-turn
agent conversation with **zero** app-written chat chrome, generalizing `site/lib/surface-registry.ts`/
`site/lib/ask-registry.ts`'s per-surface lifecycle as its OWN internal mechanism (ADR-0129 clause 2).

```html
<ui-conversation disclosure></ui-conversation>
```

```ts
const conv = document.querySelector('ui-conversation')
conv.onSubmit((text) => { /* the app's own turn loop, fed by its own transport */ })
conv.onClientMessage((message) => { /* bubbled from whichever composed ui-surface-host emitted it */ })

const handle = conv.beginAgentTurn()
for await (const line of transport.turn(input)) handle.ingestLine(line)
handle.setNote('Built a settings form.')
handle.finalize()
```

## Composes `ui-surface-host` internally, one per open surface (ADR-0129 clause 2)

For any agent-turn line carrying a `surfaceId`, `ui-conversation` routes it to a `ui-surface-host` instance
keyed by that id: a **fresh** id mounts a NEW host inline in that turn's own bubble; a **known** id (open
or closed) routes to that surface's ORIGINAL host, at its original bubble — never a new mount for the same
id (persistent identity across turns, SPEC-R7). A `deleteSurface` line disposes that ONE surface's host and
leaves a **visible**, non-removable "Closed." annotation — history is never silently removed.

## The reply affordance + outbound messages are callbacks, not events (SPEC-R5)

`onSubmit(cb)`/`onClientMessage(cb)` are callback registrations — a deliberate divergence from the closed
six-event vocabulary (`change · input · select · open · close · toggle`), matching the shipped
`RendererHost.onClientMessage` precedent. Both are safe to register before OR after this element connects.

## Narration is honest and unconditional; wire disclosure is opt-in (ADR-0129 clause 3)

Each agent turn renders a fresh `ui-status-stream` narrating the turn's own mechanical shape
(open/restructure/react/close, derived from the same envelope-key inspection `categoryOf` already proves
elsewhere in the fleet) — this ships **unconditionally** (ADR-0088's honest-narration law). The raw JSONL
`<details>` wire dump is an **opt-in** debugging affordance behind the `disclosure` prop (default `false`).

## Transport-free by construction (SPEC-R8)

`ui-conversation` exposes **no** transport/provider-shaped type. The app's own turn loop (its own
transport, iterating an `AsyncIterable<string>`) drives `AgentTurnHandle.ingestLine()`/`finalize()`/
`fail()` imperatively; there is no `AgentTransport`/`AgentProvider`/API-key prop anywhere on this element.

## Pre-connect calls are a documented no-op

`addUserMessage`/`beginAgentTurn`/`reset` called before this element has connected (no thread exists yet)
are no-ops (a stub, all-no-op `AgentTurnHandle` for `beginAgentTurn`) rather than throws — a single
`console.warn` fires the first time, mirroring `ui-surface-host`'s own pre-connect discipline this same
wave. `onSubmit`/`onClientMessage` register regardless of connection state — they touch no DOM.

## Disconnect disposes every open surface host (leak-safety)

A consumer that removes this element from the DOM WITHOUT calling `reset()`/disposing its surfaces itself
must not leak every composed `ui-surface-host`'s `RendererHost` — `disconnected()` disposes each one
(idempotent-safe; also fired automatically per-host via the platform's own disconnect cascade). Unlike
`reset()`, the thread DOM itself is left untouched — this is resource teardown, not a user-facing "start
over" action.

## A native `<form>`, not a native form widget (ADR-0017)

The composer's `[data-part="composer"]` is a genuine native `<form>` element — this element's first native
form ELEMENT, as distinct from a native form WIDGET (`<input>`/`<button type=submit>`/`<select>`/etc.),
which ADR-0017 bans (every fleet control is its own FACE re-implementation of a widget's behavior). The
`<form>` contributes no widget semantics of its own; submission is driven entirely by this element's own
listeners (Enter, the Send click), never native form-submission/validation.
