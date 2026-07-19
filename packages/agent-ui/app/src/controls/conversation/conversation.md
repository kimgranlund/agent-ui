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
extends: UIElement      # a plain structural base — composes ui-surface-host/ui-status-stream/ui-conversation-composer rather than extending any of them (ADR-0129 clause 2)
composes: [ui-surface-host, ui-status-stream, ui-conversation-composer]  # all JS-created internal children — documentary only (component-descriptor.ts's FIELD_SHAPE has no `composes` key)
# marginal: measured at the @agent-ui/app integration slice (scripts/measure-size.mjs, LLD-C9), after the M2 reference-app re-host — the M1/M4 kickoff discipline, never guessed in advance

attributes:              # attributes-as-API — mirrors conversation.ts `props`
  - name: disclosure
    type: boolean
    default: false
    reflect: true         # reflects so a JS-set value applies identically to an author-set attribute (ADR-0129 clause 3)
  - name: disabled
    type: boolean
    default: false
    reflect: true         # vision rev.5 — the whole-conversation availability gate (agent-admin's Agent master switch)
  - name: models
    type: json            # readonly {id,label}[] (composer-options.ts's PickerOption) — too structured to reflect
    default: undefined    # undefined ⇒ no Models picker; the original field+Send composer, unchanged
    reflect: false
  - name: model
    type: json            # a plain string id, but attribute:false alongside its list (the schema/store pairing precedent) — never reflected, so the codec never runs
    default: undefined
    reflect: false
  - name: efforts
    type: json            # readonly {id,label}[] — same shape/opt-in law as `models`
    default: undefined    # undefined ⇒ no Effort picker
    reflect: false
  - name: effort
    type: json
    default: undefined
    reflect: false
  - name: contextItems
    type: json            # readonly {id,label}[] (composer-options.ts's ContextItem) — the dismissable chip row
    default: undefined    # undefined ⇒ no chip row (coalesced to [] at the one read site — an array literal default cannot round-trip through this token)
    reflect: false

properties:
  - name: disabled
    description: The whole-conversation AVAILABILITY gate (vision rev.5 — set by `ui-agent-admin` from its Agent master switch, "active/available or not"). While true the composed composer renders busy-disabled (the SAME visual/behavioral state as a turn in flight — one mechanism, `busy = disabled || turnsInFlight > 0`) and a submit no-ops before any bubble or callback. Orthogonal to the TKT-0034 in-flight count — flipping this mid-turn can never unstick or double-free the busy counter. Reflected boolean, default false.
  - name: disclosure
    description: OPT-IN raw-wire disclosure (ADR-0129 clause 3). Reflected boolean, default false. Narration itself (the per-turn `ui-status-stream`) ships UNCONDITIONALLY — this prop gates only the per-turn `<details>` wire dump of the turn's own raw JSONL lines, a debugging/inspection affordance most product surfaces should not show by default. Appended at `AgentTurnHandle.finalize()` time when true and the turn carried at least one line.
  - name: models
    description: OPTIONAL `readonly {id, label}[]` (composer-options.ts's `PickerOption`) — when set (and non-empty), the composer renders a Models picker. Default `undefined` ⇒ no picker, the original field+Send composer shape, unchanged for any consumer that never sets this (a2ui-chat, a2ui-live).
  - name: model
    description: The Models picker's CURRENT selection (an id from `models`). The picker never writes this itself — a consumer supplies it (its own persisted selection) and reads the committed choice back via `onModelChange` (props down, callbacks up).
  - name: efforts
    description: OPTIONAL `readonly {id, label}[]` — same shape/opt-in law as `models`, for the Effort picker. `composer-options.ts` exports a ready-made `EFFORT_LEVELS` constant (low/medium/high/xhigh) a consumer may reuse verbatim rather than inventing its own scale.
  - name: effort
    description: The Effort picker's CURRENT selection. See `model` — same props-down/callbacks-up law, via `onEffortChange`.
  - name: contextItems
    description: A `readonly {id, label}[]` of dismissable chips shown above the field (e.g. "something selected elsewhere, attached to this turn's context"). Default `undefined` — no chip row. A dismiss click fires `onContextDismiss(id)`; the consumer owns actually removing it from this list.

events: []               # no DOM events — onSubmit/onClientMessage/onModelChange/onEffortChange/onContextDismiss/onMicClick/setContentRenderer are ALL callback/hook registrations, never CustomEvents (SPEC-R5/SPEC-R12; the closed six-event vocabulary has no submission/picker-commit/client-message/render-hook kind)

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

  Note (TKT-0056): the composer's own parts (`composer`, `context-chips`, `options`, the picker triggers,
  `mic`, `send`) moved to `ui-conversation-composer` — see `conversation-composer.md`'s own `parts:` block.
  `ui-conversation` composes it as a JS-created internal child; reach its parts via
  `ui-conversation ui-conversation-composer [data-part="…"]` (the `[data-part]` boundary is unaffected by
  the extra custom-element nesting).

customStates: []          # no :state() hooks — a closed surface's dimmed bubble rides a plain `data-state` attribute, not a custom state (the master-detail.md `data-view` precedent)

face:
  formAssociated: false   # NOT a FACE form control — a thread/composer primitive contributes nothing to a form

aria:
  role: none               # this element carries no ARIA role of its own
  roleSource: none
  childModel: none — the thread is built entirely by this element's own connect-time logic and imperative API; the composer is a JS-created composed child (ui-conversation-composer, TKT-0056); nothing is ever author-composed or slotted

contentModel: '[data-part=bubble] children carry a [data-role=user|agent|system] speaker kind (references/naming.md §6 registry, added in this change); a user/agent bubble also carries a [data-part=who] label ("You"/"Agent"), a [data-part=body] text cell (plain textContent by default; a registered setContentRenderer replaces its children instead, SPEC-R12 — never for the user bubble), and (agent only) [data-part=narration]/[data-part=mounts]/[data-part=annotation]/[data-part=disclosure] children — none of these are author-composed (SPEC-R4)'

keyboard:
  - keys: Enter
    action: In the composed ui-conversation-composer's own field, submits the composer text (same as clicking Send) — SPEC-R5 AC1; see conversation-composer.md.

geometry:
  sizeClass: layout                 # Container/layout band — a flex distributor of its own bands, no control height
  blockSize: consumer-supplied      # fills its containing box (100% inline/block) — give it a definite block-size in the surrounding layout (the ui-surface-host/ui-app-shell precedent)
  paddingBlock: 0                    # the host itself adds no block padding — the log owns its own insets; the composed ui-conversation-composer owns its own

forcedColors: The bordered shell stays legible under `forced-colors: active` (`conversation.css`, `CanvasText`-repointed). The narration strip (`ui-status-stream`) and the composed `ui-conversation-composer` (its own field frame + `ui-button`/`ui-menu` parts) carry their own forced-colors handling; the "Closed." annotation and bubble text are plain text, legible for free under the platform's own forced-colors text/background repaint.
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

// TKT-0079 — an interaction turn (e.g. a surface action click) can RESUME the bubble that owns its
// surface instead of opening a new card: the owning bubble gets a fresh narration strip, its note is
// overwritten at finalize, and even a fresh surfaceId mounts into that same bubble. Anything
// non-resumable (unknown id, closed surface, disconnected bubble) falls through to a fresh bubble.
const followUp = conv.beginAgentTurn({ intoSurface: clickedMessage.action.surfaceId })
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

## Agent/system text renders through an optional content-render hook (SPEC-R12, TKT-0071)

By default, an agent turn's `note` and a system bubble's text render as plain `textContent` — literal,
unparsed. A consumer can register `setContentRenderer(fn)` to render that text through its own renderer
instead (e.g. `ui-markdown` from `@agent-ui/code`):

```ts
import { markdownToNode } from './my-markdown-adapter.ts' // consumer-owned; wraps @agent-ui/code's ui-markdown

conv.setContentRenderer((text) => markdownToNode(text))
```

`ui-conversation` itself imports nothing from `@agent-ui/code` — `app` stays outside that DAG branch
unchanged; the renderer function is entirely consumer-supplied code the app/site layer already has
permission to import. Unregistered (default `undefined`) behavior is byte-identical to before this hook
existed. **`addUserMessage`'s text never routes through this renderer** — user-authored text stays
unescaped/unmodified (SPEC-R4 AC1), deliberately unaffected by this hook.

## The composer is a composed child, `ui-conversation-composer` (TKT-0056)

`ui-conversation` JS-creates ONE `<ui-conversation-composer>` (the `master-detail.ts` → `ui-split`
precedent — never author-composed), forwarding `models`/`model`/`efforts`/`effort`/`contextItems` down as
props and forwarding its five callback registrations up to whatever THIS element's own consumer
registered. See `conversation-composer.md` for the composer's own full contract (its parts, its `busy`
prop, its opt-in mic/pickers/chips). Beyond the field + send button, the composer can carry a **Models
picker**, an **Effort picker**, dismissable **context chips**, and a **mic button** — every one of them
OFF by default, so an existing consumer that never sets `models`/`efforts`/`contextItems` gets the
ORIGINAL composer, unchanged:

```ts
import { EFFORT_LEVELS } from '@agent-ui/app/composer-options'
conv.models = [{ id: 'claude-sonnet-5', label: 'Sonnet 5' }, /* … */]
conv.model = 'claude-sonnet-5'
conv.efforts = EFFORT_LEVELS
conv.effort = 'medium'
conv.onModelChange((id) => { /* persist the new selection, e.g. a settings store */ })
conv.onEffortChange((id) => { /* ephemeral — no persisted counterpart expected */ })
conv.contextItems = [{ id: 'sel-1', label: 'Context Selection' }]
conv.onContextDismiss((id) => { /* remove `id` from contextItems */ })
conv.onMicClick(() => { /* wire real voice input here — none is built in */ }) // ALSO reveals the mic button — hidden until this is called
```

Every picker follows **props down, callbacks up** (the `onSubmit` precedent) — `ui-conversation` never
writes `model`/`effort` itself; a consumer supplies the current value and reads the committed choice back
through the matching callback. `models`/`efforts` are generic `{id, label}` option lists — `ui-conversation`
never hardcodes a model catalog or invents Effort's own semantics beyond the shared `EFFORT_LEVELS`
constant a consumer may reuse. All six new callbacks (`onModelChange`/`onEffortChange`/`onContextDismiss`/
`onMicClick`, alongside `onSubmit`/`onClientMessage`) are safe to register before or after connect.

The send/mic/caret glyphs need a registered `@agent-ui/icons` pack (`ui-icon`'s own requirement, not new
here) — a consumer that composes `ui-conversation` without one gets correctly-sized but BLANK icon-only
buttons (their `aria-label`s stay intact; nothing is inaccessible, just visually empty).

## Busy/re-entrancy guard — auto-tracked, zero consumer wiring (TKT-0034)

`ui-conversation` owns tracking its own in-flight turns: while one or more `beginAgentTurn()` handles exist
that have not yet `finalize()`d/`fail()`d, it sets the composed `ui-conversation-composer`'s own `busy`
prop to `true` — the composer's OWN send path (Enter or the Send click) is then a **no-op**, the typed
text **retained**, never cleared, and no `addUserMessage`/`onSubmit` callback fires (see
`conversation-composer.md`'s "busy is load-bearing behavior" note — the composer checks `busy`
synchronously, not only via the reflected disabled state). Every one of these releases the instant the
LAST open handle `finalize()`s or `fail()`s — no consumer wiring required; a consumer's own busy flag
(e.g. serializing its transport loop, the a2ui-chat.ts precedent) stays independently useful for
re-entrancy paths that never touch the composer (a click on a rendered A2UI surface triggering another
`beginAgentTurn()`), but is redundant-but-harmless for the composer send path, which this primitive now
guards unconditionally.

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

## The composer is its own field (TKT-0058)

The composed `ui-conversation-composer` is ITSELF the message field since the TKT-0058 v2 unroll: one
ADR-0014 field frame (focus ring on the composer host) containing the context-chip tags row, the
composer's OWN contenteditable multi-line editor (the `ui-textarea` ADR-0134 pattern — no nested
`ui-text-field`), and the options row. Its v1 nested native `<form>` (the former ADR-0017
native-form-ELEMENT carve-out) is gone — submission is driven entirely by the composer's own listeners
(Enter, the Send click). See `conversation-composer.md` for the full anatomy.
