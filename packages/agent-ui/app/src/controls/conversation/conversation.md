---
# conversation.md frontmatter — the attributes-as-API descriptor for ui-conversation (ADR-0004). The
# machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# The `attributes[]` block MUST mirror conversation.ts `props` — the contract↔props trip-wire
# (conversation.test.ts) targets this fence. Field set per .claude/docs/plan.md §10 / ADR-0004.
tag: ui-conversation
# geometry size-class: the schema's SIZE_CLASSES has no literal "structural" member (the LLD's own informal
# label) — `layout` is the closest real class: a CSS-flex distributor of its OWN thread/composer bands, no
# control height of its own (the ui-master-detail precedent).
tier: layout
extends: UIElement      # a plain structural base — composes ui-surface-host/ui-status-stream/ui-conversation-composer rather than extending any of them (ADR-0129 clause 2)
composes: [ui-surface-host, ui-status-stream, ui-conversation-composer, ui-conversation-dialog, ui-conversation-header]  # ADR-0180 (GH #688) adds the two new tags — every one of the five is ADOPTED (if author-supplied) or JS-created, documentary only (component-descriptor.ts's FIELD_SHAPE has no `composes` key)
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
  - name: receipt
    type: boolean
    default: false
    reflect: true         # GH #239/ADR-0159 — opt-in receipt pattern for the per-turn narration strip: sets `oneline` + `receipt` on each turn's ui-status-stream. Default false ⇒ the always-expanded narration, byte-identical
  - name: sources
    type: boolean
    default: false
    reflect: true         # GH #240/ADR-0159 wave B — opt-in per-step SOURCE reveal: each narrated step carries the raw wire line(s) it stands for (StatusEntry.source → ui-status-stream's collapsed mono reveal). Default false ⇒ no source ever attached AND producer-attached progress sources dropped — byte-identical narration, fail-closed
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
  - name: providers
    type: json            # readonly ProviderOption[] (composer-options.ts — PickerOption + {models, defaultModel}) — GH #257, forwarded straight through to the composed child
    default: undefined    # undefined ⇒ no Provider picker; `models`/`model` keep working standalone, unchanged
    reflect: false
  - name: provider
    type: json
    default: undefined
    reflect: false
  - name: modes
    type: json            # readonly {id,label}[] — the Gen-UI Mode axis (GH #257), same shape/opt-in law as `efforts`
    default: undefined    # undefined ⇒ no Mode picker
    reflect: false
  - name: mode
    type: json
    default: undefined
    reflect: false
  - name: contextItems
    type: json            # readonly {id,label}[] (composer-options.ts's ContextItem) — the dismissable chip row
    default: undefined    # undefined ⇒ no chip row (coalesced to [] at the one read site — an array literal default cannot round-trip through this token)
    reflect: false
  - name: mentionables
    type: json            # readonly ReferenceOption[] (composer-options.ts) — GH #849, forwarded to the composed composer's '@' typeahead
    default: undefined    # undefined ⇒ '@' is a plain character in the composer; byte-identical for every existing consumer
    reflect: false
  - name: invocables
    type: json            # readonly ReferenceOption[] — GH #849, the composer's '/' typeahead roster (one menu, grouped by kind)
    default: undefined
    reflect: false
  - name: capabilities
    type: json            # readonly CapabilityRow[] (composer-options.ts — {id,label,kind,description?,icon?,included}) — GH #891/SPEC-R11, forwarded to the composed composer's capabilities panel
    default: undefined    # undefined ⇒ no trigger, no panel; byte-identical for every existing consumer
    reflect: false

properties:
  - name: disabled
    description: The whole-conversation AVAILABILITY gate (vision rev.5 — set by `ui-agent-admin` from its Agent master switch, "active/available or not"). While true the composed composer renders busy-disabled (the SAME visual/behavioral state as a turn in flight — one mechanism, `busy = disabled || turnsInFlight > 0`) and a submit no-ops before any bubble or callback. Orthogonal to the TKT-0034 in-flight count — flipping this mid-turn can never unstick or double-free the busy counter. Reflected boolean, default false.
  - name: disclosure
    description: OPT-IN raw-wire disclosure (ADR-0129 clause 3). Reflected boolean, default false. Narration itself (the per-turn `ui-status-stream`) ships UNCONDITIONALLY — this prop gates only the per-turn `<details>` wire dump of the turn's own raw JSONL lines, a debugging/inspection affordance most product surfaces should not show by default. Appended at `AgentTurnHandle.finalize()` time when true and the turn carried at least one line.
  - name: receipt
    description: OPT-IN receipt pattern (GH #239/ADR-0159, Kim's 2026-07-23 ruling) for the per-turn narration strip. When true, each agent turn's `ui-status-stream` gets BOTH stream-level opt-ins — `oneline` (one morphing line while the turn runs — current step's live label + ticking elapsed + shimmer, expandable mid-turn) and `receipt` (auto-collapse to "Agent activity · N steps · total" at finalize()/fail(), click to re-expand). Reflected boolean, default false — existing consumers keep the always-expanded narration byte-identically.
  - name: sources
    description: 'OPT-IN per-step source reveal (GH #240/ADR-0159 wave B — Kim''s receipt-pattern ruling, part 3). When true, each narrated step carries the raw wire line(s) it stands for as `StatusEntry.source`, rendered by ui-status-stream as a collapsed-by-default mono reveal (summary "Source", one deliberate developer level deep): a CATEGORY entry ("Opened a new surface") accumulates its own ingested A2UI JSONL (createSurface/updateDataModel/… — cumulative, newline-joined), and a PROGRESS entry ("Validating…"/"Self-correcting…") passes through whatever `TurnProgress.source` the producer attached under ITS `progressDetail:''source''` opt-in (the privacy gate — a default stream carries none). Sampled once per turn. Reflected boolean, default false — and fail-closed both ways: when false, no category line is ever attached AND a producer-attached progress source is DROPPED, so default narration stays byte-identical even against a source-carrying stream.'
  - name: models
    description: OPTIONAL `readonly {id, label}[]` (composer-options.ts's `PickerOption`) — when set (and non-empty), the composer renders a Models picker. Default `undefined` ⇒ no picker, the original field+Send composer shape, unchanged for any consumer that never sets this (a2ui-chat, a2ui-live).
  - name: model
    description: The Models picker's CURRENT selection (an id from `models`). The picker never writes this itself — a consumer supplies it (its own persisted selection) and reads the committed choice back via `onModelChange` (props down, callbacks up).
  - name: efforts
    description: OPTIONAL `readonly {id, label}[]` — same shape/opt-in law as `models`, for the Effort picker. `composer-options.ts` exports a ready-made `EFFORT_LEVELS` constant (low/medium/high/xhigh) a consumer may reuse verbatim rather than inventing its own scale.
  - name: effort
    description: The Effort picker's CURRENT selection. See `model` — same props-down/callbacks-up law, via `onEffortChange`.
  - name: providers
    description: OPTIONAL `readonly ProviderOption[]` (composer-options.ts's `PickerOption` + `{models, defaultModel}`, GH #257) — forwarded straight through to the composed child. When set (and non-empty), renders a Provider picker that narrows the Models picker to the selected provider's own model list. Default `undefined` ⇒ no Provider picker, `models`/`model` unaffected.
  - name: provider
    description: The Provider picker's CURRENT selection. See `model` — same props-down/callbacks-up law, via `onProviderChange`. Committing a new provider whose model list excludes the current `model` also fires `onModelChange` with that provider's own `defaultModel` (the composed child's own reset — see conversation-composer.md).
  - name: modes
    description: OPTIONAL `readonly {id, label}[]` (GH #257) — the Gen-UI Mode axis, same shape/opt-in law as `efforts`. `ui-conversation` never imports the a2ui-owned `GenUiMode` type — a consumer builds its own `modes` list.
  - name: mode
    description: The Mode picker's CURRENT selection. See `model` — same props-down/callbacks-up law, via `onModeChange`.
  - name: contextItems
    description: A `readonly {id, label}[]` of dismissable chips shown above the field (e.g. "something selected elsewhere, attached to this turn's context"). Default `undefined` — no chip row. A dismiss click fires `onContextDismiss(id)`; the consumer owns actually removing it from this list.
  - name: mentionables
    description: OPTIONAL `readonly ReferenceOption[]` (`{id, label, kind, description?}`) — GH #849's `@` mention roster, forwarded PASS-THROUGH to the composed composer (this element adds no semantics: `kind` stays the consumer's own opaque string). Default `undefined` ⇒ `@` is a plain character. Committed references come back up through `onSubmit`'s widened second argument. See `conversation-composer.md` for the grammar.
  - name: invocables
    description: OPTIONAL `readonly ReferenceOption[]` — GH #849's `/` invocation roster (ONE menu grouped by kind), forwarded pass-through like `mentionables`. Default `undefined` ⇒ `/` is a plain character.
  - name: capabilities
    description: 'OPTIONAL `readonly CapabilityRow[]` (`{id, label, kind, description?, icon?, included}`) — GH #891''s capabilities panel rows, forwarded PASS-THROUGH to the composed composer (this element adds no semantics: `kind`/`icon` stay opaque consumer strings). Default `undefined` ⇒ no trigger and no panel DOM at all. A flip fires `onCapabilityToggle(id, included)` and NOTHING mutates locally — the consumer owns the state and hands a new array down. What a flip MEANS is the consumer''s too: ADR-0190 rev.2 ruled it a GLOBAL enable/disable, and `ui-agent-admin` wires it to the named entry''s persisted `enabled` (SPEC-R13) — this contract is identical under either arm of that fork. See `conversation-composer.md` for the panel''s anatomy.'

events:                   # onSubmit/onClientMessage/onModelChange/onEffortChange/onProviderChange/onModeChange/onContextDismiss/onCapabilityToggle/onMicClick/setContentRenderer/setEmptyState are ALL callback/hook registrations, never CustomEvents (SPEC-R5/SPEC-R12; the closed vocabulary has no submission/picker-commit/client-message/render-hook kind). GH #291/ADR-0160 clause 3 adds the ONE real DOM event: `action`, fired from the settled-turn action-chip row — the SAME closed-vocabulary member ui-status-stream's inline retry button already uses (ADR-0153's seventh member), never an eighth.
  - name: action
    detail: '{ id: string }'
    description: Fired when the user clicks a settled agent turn's pre-hydrated action chip (rendered when `AgentTurnHandle.finalize()` was called with a non-empty `actions` list). `id` is the clicked `TurnAction.id` — the consumer's own vocabulary (e.g. `'helpful'`/`'not-helpful'`, or `'yes'`/`'no'`), never interpreted by this primitive. Clicking any chip in the row removes the WHOLE row first (one-shot commit — a settled turn's feedback/reply choice can never double-fire), then fires this event on `ui-conversation` itself (never on the button, never on the bubble). GH #291 review — a consumer must still discriminate by `event.target === conv` before treating an `action` event as this chip commit: a genui `ui-sandbox-frame`'s own game-loop `action` (SPEC-R8, `routeGenui`) is a DIFFERENT `action` shape (`{surfaceId, name, payload}`, not `{id}`) that this build stops from bubbling past its own frame (`stopPropagation()`), but a consumer listening directly on a mounted surface, or on any DOM ancestor of `ui-conversation`, can still observe it — `event.target` is the only reliable discriminant between the two closed-vocabulary `action` shapes sharing this fleet's seventh event name (ADR-0153/ADR-0160).

slots:                     # ADR-0180 (GH #688) — a RECOGNIZED-CHILDREN contract, superseding the old "no slotted children" line (this is still NOT a platform `<slot>` — light-DOM law; the fleet is light-DOM by construction). Every one is OPTIONAL, ADOPT-OR-CREATE: an author-supplied `:scope > {tag}` direct child is ADOPTED at connect (never a second imperative surface); absent, this element creates the dialog/composer itself exactly as before this ADR — the byte-identical default every existing consumer (a2ui-chat, a2ui-live, agent-admin) that authors no children keeps getting. Band order is normalized at connect (header → dialog → composer), regardless of authored order.
  - name: ui-conversation-header
    optional: true
    description: The family's ONE fully author-composed member (conversation-header.md) — recognized and seated first, never created. Absent means today's shape minus nothing; the imperative API never touches it (ADR-0180 clause 3).
  - name: ui-conversation-dialog
    optional: true
    description: The scrolling thread's mechanical role (conversation-dialog.md) — adopted as this element's own `#log` if authored, else created. Any author-authored initial content inside it is PRESERVED at adoption (turns append after it); `reset()` clears it, the empty-state node the one survivor (GH #666 parity, ADR-0180 clause 4).
  - name: ui-conversation-composer
    optional: true
    description: The message-composition UI (conversation-composer.md, TKT-0056) — adopted as this element's own `#composer` if authored, else created. The seven callback registrations forward identically either way (ADR-0180 clause 4 — path-blind by construction). GH #666's empty-log state is NOT one of these three — the consumer hands its node to `setEmptyState(node)` and this element seats it inside the (adopted-or-created) dialog (see the section below).

parts:                    # NOT shadow-DOM ::part() (light-DOM only) — light-DOM markers this element's own JS creates; documented for completeness (compareDescriptorToSource does not mechanically check `parts:`, the master-detail.md precedent)
  - name: log
    description: The scrolling thread region (`[data-part="log"]`, tag-agnostic — every shipped selector keys on the attribute, never the tagName). ADR-0180 (GH #688) — this is now a `<ui-conversation-dialog>` instance (adopted-or-created; see `slots:` above and conversation-dialog.md for its own `aria-live`/scroll-follow contract), promoted off a bare `div`. Owns its own scroll (SPEC-R4).
  - name: turn
    description: 'GH #306/ADR-0160 amendment (Kim''s 2026-07-27 revision) — the free-standing turn-chrome wrapper (`[data-part="turn"][data-role="user"|"agent"]`) a user/agent turn renders into: `[data-part="who"]` then (agent only) `[data-part="narration"]`, both OUTSIDE the bubble, followed by the bubble itself. Owns the log-level alignment (`align-self`) and the 92% width cap the bubble used to carry on its own. A system turn has no `who`/`narration` and so gets no wrapper — its bubble is still a direct child of `[data-part="log"]`, unchanged.'
  - name: bubble
    description: One turn's content container (`[data-part="bubble"][data-role="user"|"agent"|"system"]`) — a user/agent bubble is the last child of its `[data-part="turn"]` wrapper; a system bubble is a direct child of `[data-part="log"]` (no wrapper).
  - name: who
    description: 'GH #306/ADR-0160 amendment — the sender label ("You"/"Agent"), `[data-part="who"]`, the first child of a user/agent turn''s `[data-part="turn"]` wrapper (OUTSIDE the bubble). Absent for a system turn.'
  - name: narration
    description: 'The per-agent-turn `ui-status-stream` instance (`[data-part="narration"]`), composed fresh per turn. GH #306/ADR-0160 amendment — renders OUTSIDE the bubble, as the agent turn''s `[data-part="turn"]` wrapper''s second child (after `who`, before the bubble).'
  - name: reference-tags
    description: 'GH #891/SPEC-R10 — the SENT user turn''s attachment record (`[data-part="reference-tags"]`), appended INSIDE the user bubble after its `[data-part="body"]`, and ONLY when that turn actually carried references (`addUserMessage`''s optional second argument; an absent/empty list appends nothing at all, so a reference-less bubble is byte-identical to pre-R10). One `[data-part="reference-tag"][data-kind]` per reference — an optional leading `[data-part="reference-tag-icon"]` `ui-icon` (the `TurnReference.icon` glyph the consumer supplied, SPEC-R9) plus a `[data-part="reference-tag-label"]`. DISMISS-LESS by contract: the turn is sent, so there is nothing to remove (the pre-send dismiss affordance is the composer chip''s, and it clears with the text). DISPLAY-ONLY: the bubble body stays the typed text, and the FRAMED attachment text SPEC-R4 puts on the wire never renders in any bubble.'
  - name: mounts
    description: The container (`[data-part="mounts"]`) an agent bubble's OWN inline `ui-surface-host` children mount into.
  - name: annotation
    description: The visible "Closed." note (`[data-part="annotation"]`) appended to a surface's bubble on deletion (SPEC-R7).
  - name: disclosure
    description: The opt-in raw-wire `<details>` dump (`[data-part="disclosure"]`), shown only when `disclosure` is true.
  - name: actions
    description: 'GH #291/ADR-0160 clause 3 — the pre-hydrated action-chip row (`[data-part="actions"]`), appended to a settled agent turn''s bubble ONLY when `AgentTurnHandle.finalize()` was called with a non-empty `actions` list (after the wire disclosure, when both are present). One `ui-button` chip per `TurnAction`; see the `action` event.'

  Note (TKT-0056): the composer's own parts (`composer`, `context-chips`, `options`, the picker triggers,
  `mic`, `send`) moved to `ui-conversation-composer` — see `conversation-composer.md`'s own `parts:` block.
  `ui-conversation` composes it as a JS-created internal child; reach its parts via
  `ui-conversation ui-conversation-composer [data-part="…"]` (the `[data-part]` boundary is unaffected by
  the extra custom-element nesting).

customStates:             # this host SETS no state of its own — the one entry below is a CHILD's public state this stylesheet keys off (the tabs.md `selected` precedent)
  - settled               # GH #722 — set by the narration ui-status-stream's OWN finalize()/fail() (status-stream.md); conversation.css keys the settled-grow rule off it (the 9rem cap is a live-streaming bound; a settled, re-expanded trace grows to fit)

face:
  formAssociated: false   # NOT a FACE form control — a thread/composer primitive contributes nothing to a form

aria:
  role: none               # this element carries no ARIA role of its own
  roleSource: none
  childModel: ADR-0180 (GH #688) restates the pre-ADR-0180 "none" — the thread/composer/header are EITHER JS-created by this element's own connect-time logic (the byte-identical default) OR, opt-in, ADOPTED from an author-supplied `:scope > ui-conversation-{header,dialog,composer}` direct child (see `slots:` above); nothing is ever a platform `<slot>`, and the imperative API never changes shape between the two paths. The one consumer-owned node OUTSIDE that three-tag contract, GH #666's empty-log state, is handed over imperatively (`setEmptyState`) and seated inside the adopted-or-created dialog (`[data-part=log]`) — it is the consumer's own DOM, so its roles/labels are the consumer's to declare.

contentModel: 'GH #306/ADR-0160 amendment — [data-part=bubble] and (user/agent only) its owning [data-part=turn] wrapper both carry a [data-role=user|agent|system] speaker kind (references/naming.md §6 registry). A user/agent turn is [data-part=turn][data-role=…] > [data-part=who] ("You"/"Agent"), then (agent only) [data-part=narration], then [data-part=bubble][data-role=…] holding a [data-part=body] text cell (plain textContent by default; a registered setContentRenderer replaces its children instead, SPEC-R12 — never for the user bubble), then (GH #891/SPEC-R10, user only, and only for a turn that carried references) a [data-part=reference-tags] row, and (agent only) [data-part=mounts]/[data-part=annotation]/[data-part=disclosure]/[data-part=actions] children. A system turn has neither [data-part=who] nor [data-part=narration] nor a [data-part=turn] wrapper — its [data-part=bubble][data-role=system] is a direct child of [data-part=log], holding only [data-part=body]. None of this turn anatomy is EVER author-composed (SPEC-R4/SPEC-R13 unchanged) — ADR-0180 (GH #688) only widens WHICH ELEMENT seats the log/composer/header bands (adopted vs created, see slots: above), never who builds a turn'

keyboard:
  - keys: Enter
    action: In the composed ui-conversation-composer's own field, submits the composer text (same as clicking Send) — SPEC-R5 AC1; see conversation-composer.md.

geometry:
  sizeClass: layout                 # Container/layout band — a flex distributor of its own bands, no control height
  blockSize: consumer-supplied      # fills its containing box (100% inline/block) — give it a definite block-size in the surrounding layout (the ui-surface-host precedent)
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

## An explicit opt-in declarative composition mode (ADR-0180, GH #688)

By default (every example above) the DOM is never author-composed — the thread/composer are built entirely
by this element's own imperative API, exactly as before. An author MAY instead compose the three
recognized child tags directly; `ui-conversation` ADOPTS whichever it finds instead of creating it — never a
second imperative surface, and the whole turn/registry/narration/busy engine stays solely on
`ui-conversation` regardless of which path seated its parts:

```html
<ui-conversation>
  <ui-conversation-header><strong>Support Agent</strong></ui-conversation-header>
  <ui-conversation-dialog></ui-conversation-dialog>
  <ui-conversation-composer></ui-conversation-composer>
</ui-conversation>
```

Any subset works — a missing band is created exactly as it always was; band order is normalized at connect
(header → dialog → composer) regardless of authored order. The imperative API (`addUserMessage`/
`beginAgentTurn`/`reset`/…) is path-blind: it writes through whichever dialog/composer got seated, adopted
or created, with zero mode branches. See `conversation-dialog.md`/`conversation-header.md` for the two new
elements' own contracts, and the `slots:` field above for the full recognized-children detail (preserved
initial content, `reset()` lifecycle).

## Composes `ui-surface-host` internally, one per open surface (ADR-0129 clause 2)

For any agent-turn line carrying a `surfaceId`, `ui-conversation` routes it to a `ui-surface-host` instance
keyed by that id: a **fresh** id mounts a NEW host inline in that turn's own bubble; a **known** id (open
or closed) routes to that surface's ORIGINAL host, at its original bubble — never a new mount for the same
id (persistent identity across turns, SPEC-R7). A `deleteSurface` line disposes that ONE surface's host and
leaves a **visible**, non-removable "Closed." annotation — history is never silently removed.

## Composes `ui-sandbox-frame` internally, one per open GenUI surface (genui-surface.spec.md SPEC-R5/R8)

A PARALLEL mount mechanism, `AgentTurnHandle.mountGenui(surfaceId, html)` — never `ingestLine`, which
parses A2UI envelope keys a genui line never carries. A **fresh** `surfaceId` mounts a NEW
`ui-sandbox-frame` inline in that turn's own bubble; a **known** id rebuilds the EXISTING frame's `html`
in place (SPEC-R5's atomic replace — frame-internal state is lost by design). The frame's `action` event
(SPEC-R8, the fleet's seventh closed-vocabulary event, ADR-0153) bubbles through the SAME
`onClientMessage(cb)` callback `ui-surface-host` uses, framed as `{genuiAction: {surfaceId, name,
payload}}` — structurally distinct from an `A2uiClientMessage` (SPEC-R8's own reasoning: a GenUI action
isn't one), narrowed by the consumer at its own boundary.

```ts
const handle = conv.beginAgentTurn()
handle.mountGenui('q3-revenue', '<!DOCTYPE html>...')
handle.finalize()
```

## The reply affordance + outbound messages are callbacks, not events (SPEC-R5)

`onSubmit(cb)`/`onClientMessage(cb)` are callback registrations — a deliberate divergence from the closed
six-event vocabulary (`change · input · select · open · close · toggle`), matching the shipped
`RendererHost.onClientMessage` precedent. Both are safe to register before OR after this element connects.

## Narration is honest and unconditional; wire disclosure is opt-in (ADR-0129 clause 3)

Each agent turn renders a fresh `ui-status-stream` narrating the turn's own mechanical shape
(open/restructure/react/close, derived from the same envelope-key inspection `categoryOf` already proves
elsewhere in the fleet) — this ships **unconditionally** (ADR-0088's honest-narration law). The raw JSONL
`<details>` wire dump is an **opt-in** debugging affordance behind the `disclosure` prop (default `false`).

## The agent bubble is hidden until it has real content (GH #313/ADR-0160 amendment, Kim's 2026-07-28 ruling)

`beginAgentTurn()` creates the bubble up front, but a fresh one starts empty (no note, no mounts) and
stays hidden — the narration strip beside it (above) is the only thing visible during the pre-content
phase of a live turn. It reveals on the FIRST real content of any kind: a streamed `setNote()` token
(painted into the DOM immediately, not buffered for `finalize()` alone — a consumer may call `setNote`
repeatedly as text accretes), a fresh mounted surface (`ingestLine`/`mountGenui`), the settled-turn
action-chip row, or `finalize()`'s own fallback tally. A turn that ends via `fail()` without ever
producing content simply stays hidden — `fail()` never touches the agent bubble, it only adds a
separate system bubble carrying the error text. A **resumed** turn (`intoSurface`, TKT-0079) is
unaffected — it can only resume because its bubble already has content, so it stays visible throughout.

## Pre-hydrated action chips on a settled turn (GH #291/ADR-0160 clause 3, Kim's 2026-07-27 ruling)

`AgentTurnHandle.finalize(actions?: readonly TurnAction[])` accepts an OPTIONAL row of
consumer-defined `{ id, label }` chips — a GENERAL mechanism, never a hardcoded pair: "was this any
good?" → `[{id:'helpful', label:'Helpful 👍'}, {id:'not-helpful', label:'Not Helpful 👎'}]`, or a
question's quick replies → `[{id:'yes', label:'Yes'}, {id:'no', label:'No'}]`. Omitted or empty ⇒
byte-identical to every existing caller (no new DOM). When present, one `ui-button` chip per action
renders below the turn's note (after the wire disclosure, when both are present); clicking ANY chip
removes the WHOLE row (a one-shot commit) and fires this element's `action` event with `{ id }`
naming the chosen action — the SAME closed-vocabulary member `ui-status-stream`'s inline retry button
already uses (ADR-0153's seventh member), never an eighth.

```ts
handle.setNote('Task completed and here is the output')
handle.finalize([
  { id: 'helpful', label: 'Helpful 👍' },
  { id: 'not-helpful', label: 'Not Helpful 👎' },
])
// …
conv.addEventListener('action', (e) => {
  console.log((e as CustomEvent<{ id: string }>).detail.id) // 'helpful' | 'not-helpful'
})
```

## Answered A2UI cards disable their inputs (GH #805)

Every composed `ui-surface-host` self-disables its own interactive descendants the moment it emits an
outbound `action` client-message (excepting an explicit `wantResponse:false` opt-out, ADR-0088 §3 — no
turn will ever run for one, so this element mirrors the skip rather than disabling a card nothing will
ever re-enable) — zero wiring required here or at any consumer (surface-host.md owns the disable/
re-enable mechanism itself, including which elements are its own to revert). This element's own
contribution is the one arm a surface-host cannot own itself: `beginAgentTurn(opts)` accepts an OPTIONAL
`disabledSurfaceId` (defaulting to `intoSurface` when omitted — pass it explicitly only when it diverges,
e.g. GH #802/#803's ask-arm, where the answered surface routes to a FRESH bubble but is still owed a
re-enable on failure) naming the surface whose own action started this turn; `AgentTurnHandle.fail(
message)` re-enables that ONE surface if the turn never sent it another line — a dead card is never
stranded disabled. A surface that DID receive an update this turn already re-enabled itself the moment
that update arrived (`ui-surface-host.ingest()`'s own re-enable-on-entry, which also drops this
element's own bookkeeping for it, `routeLine`'s known-surface branch) — `fail()`'s call is a harmless
no-op for it. TKT-0079's in-place game loop is unaffected either way: the SAME surfaceId's host
re-renders live on its own next `updateComponents`, regardless of which bubble resumed.

The bookkeeping is a plain membership `Set`, deliberately keyed rather than FIFO-ordered: a `disabledSurfaceId`
is only ever claimed by the specific `beginAgentTurn()` call that names it (or its `intoSurface`
default) — never "whatever's oldest pending" — so an UNRELATED turn (a genui action's own turn, which
never disables anything through this element at all; a typed intent, which names neither field) can
never misclaim a click it has nothing to do with. A consumer that calls `beginAgentTurn()` with neither
field for a client-action turn (no TKT-0079 resume concept of its own) gets no automatic fail-reenable
for the narrow case where that turn fails before ever resending its own surfaceId — `ui-surface-host`'s
own update-reenable arm still covers the ordinary case for every consumer, unchanged. `reset()` clears
this bookkeeping along with the rest of the per-session registry.

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
unescaped/unmodified (SPEC-R4 AC1), deliberately unaffected by this hook. The same holds for GH #891's
reference tags: a tag's label is written as plain text, never through the renderer.

## The sent user turn shows what it attached (GH #891/SPEC-R10)

The composer's reference chips clear on send (SPEC-R6), so the record of "what rode this turn" moves onto
the SENT bubble: with references, a user bubble gains a `[data-part="reference-tags"]` row after its body —
one small, **dismiss-less** tag per reference (label + the consumer's kind glyph when the roster supplied
one). It arrives two ways, the same way: the composed composer's send forwards the turn's committed
references automatically, and `addUserMessage(text, references)` takes them directly for a consumer
replaying its own transcript. A turn with no references appends **nothing** — no empty row, no changed box.

The tags are **display-only** truth of what the user attached. The bubble body stays the TYPED text, and the
FRAMED attachment text (the labeled block a consumer like `ui-agent-admin` builds at send time, SPEC-R4)
never renders in any bubble — that wire truth lives in history, the turn log, and the Context views, exactly
where SPEC-R4 put it. `ui-conversation` interprets neither `kind` nor `icon`; both stay the consumer's own
opaque strings, as they already are on the roster props.

## The empty-log state is a consumer-owned node in the log area (GH #666)

A conversation with nothing in it yet is still this element's own card — border, log, composer pinned at
the bottom. `setEmptyState(node)` seats a consumer-owned node FIRST in `[data-part="log"]`, so the
"nothing here yet" copy lives inside the card instead of being a differently-shaped box the consumer
builds beside it:

```ts
conv.setEmptyState(myEmptyCopy) // headline + copy + whatever affordance the flow starts with
// …the flow earns its first turn:
conv.setEmptyState(null)
```

Placement only — this element never decides WHEN the state applies. A conversation can be legitimately
empty and live (the agent speaks first) or full and idle; only the consumer knows which, so the node stays
until `setEmptyState(null)` removes it. `reset()` KEEPS it (a reset conversation is empty again), which is
the same statement `reset()` already makes about turns. Safe before or after connect, exactly like
`setContentRenderer`; unset (the default) is byte-identical to before this seam existed.

## The composer is an adopted-or-composed child, `ui-conversation-composer` (TKT-0056, ADR-0180)

`ui-conversation` seats exactly ONE `<ui-conversation-composer>` — adopted from an author-supplied
`:scope > ui-conversation-composer` (ADR-0180) if present, else JS-created (the `master-detail.ts` →
`ui-split` precedent, the byte-identical default) — forwarding `models`/`model`/`efforts`/`effort`/`providers`/`provider`/
`modes`/`mode`/`contextItems`/`mentionables`/`invocables`/`capabilities` down as props and forwarding its eight callback registrations up to whatever
THIS element's own consumer registered. See `conversation-composer.md` for the composer's own full
contract (its parts, its `busy` prop, its opt-in mic/pickers/chips). Beyond the field + send button, the
composer can carry a **Provider picker**, a **Models picker**, an **Effort picker**, a **Mode picker**,
dismissable **context chips**, and a **mic button** — every one of them OFF by default, so an existing
consumer that never sets `models`/`efforts`/`providers`/`modes`/`contextItems` gets the ORIGINAL composer,
unchanged:

```ts
import { EFFORT_LEVELS } from '@agent-ui/app/composer-options'
conv.models = [{ id: 'claude-sonnet-5', label: 'Sonnet 5' }, /* … */]
conv.model = 'claude-sonnet-5'
conv.efforts = EFFORT_LEVELS
conv.effort = 'medium'
conv.onModelChange((id) => { /* persist the new selection, e.g. a settings store */ })
conv.onEffortChange((id) => { /* ephemeral — no persisted counterpart expected */ })
// GH #257 — the Provider axis narrows the SAME Models picker (a model belongs to exactly one provider);
// Mode is a plain flat picker mirroring Effort exactly.
conv.providers = [{ id: 'anthropic', label: 'Anthropic', defaultModel: 'claude-sonnet-5', models: conv.models }]
conv.provider = 'anthropic'
conv.onProviderChange((id) => { /* persist the new provider */ })
conv.modes = [{ id: 'default', label: 'Default' }]
conv.mode = 'default'
conv.onModeChange((id) => { /* persist the new mode */ })
conv.contextItems = [{ id: 'sel-1', label: 'Context Selection' }]
conv.onContextDismiss((id) => { /* remove `id` from contextItems */ })
// GH #849 — the composer's `@`/`/` reference typeahead, pass-through props; a committed reference rides
// `onSubmit`'s widened SECOND argument (a single-argument consumer is unaffected). GH #891/SPEC-R9 — an
// entry may also carry an `icon` glyph name, rendered on the chip and on the sent bubble's own tags.
// GH #1030/SPEC-R16 — a NON-committed reference can ALSO ride that argument: an exact `label` hit in the
// typed text (case/punctuation-normalized) auto-attaches one roster entry, at most, before either
// `addUserMessage` or this callback sees it — indistinguishable downstream from a committed chip. Empty/
// unset rosters (the default) match nothing, ever.
conv.mentionables = [{ id: 'res-1', label: 'Menu PDF', kind: 'resource', icon: 'file-text' }]
conv.invocables = [{ id: 'svc:calc:*', label: 'Calculator', kind: 'tool', icon: 'gear' }]
conv.onSubmit((text, references) => { /* resolve `references` by id at send time */ })
// GH #891/SPEC-R10 — the imperative twin: a consumer replaying a transcript passes the turn's references
// too, and the bubble shows the same display-only tags a live send produces (single-arg stays valid).
conv.addUserMessage('Total the dinner order', [{ id: 'res-1', label: 'Menu PDF', kind: 'resource', icon: 'file-text' }])
conv.onMicClick(() => { /* wire real voice input here — none is built in */ }) // ALSO reveals the mic button — hidden until this is called
// GH #891/SPEC-R11 — the capabilities panel: the BROWSE/STEER sibling of the `@`/`/` quick path. Rows down,
// one callback up, zero local mutation: the visible switch moves only when a new array comes back down.
conv.capabilities = [{ id: 'skill:house-style', label: 'House style', kind: 'skill', icon: 'star', included: true }]
conv.onCapabilityToggle((id, included) => { /* the consumer's own truth — e.g. persist it, then re-hand `capabilities` */ })
```

Every picker follows **props down, callbacks up** (the `onSubmit` precedent) — `ui-conversation` never
writes `model`/`effort`/`provider`/`mode` itself; a consumer supplies the current value and reads the
committed choice back through the matching callback. `models`/`efforts`/`modes` are generic `{id, label}`
option lists; `providers` additionally carries each provider's own `models`/`defaultModel` — `ui-conversation`
never hardcodes a model/provider catalog or invents Effort's/Mode's own semantics beyond the shared
`EFFORT_LEVELS` constant a consumer may reuse. All nine new callbacks (`onModelChange`/`onEffortChange`/
`onProviderChange`/`onModeChange`/`onContextDismiss`/`onCapabilityToggle`/`onMicClick`, alongside
`onSubmit`/`onClientMessage`) are safe to register before or after connect.

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
