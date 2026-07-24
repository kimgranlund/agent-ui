---
# conversation-composer.md frontmatter — the attributes-as-API descriptor for ui-conversation-composer
# (ADR-0004, TKT-0056 · TKT-0058 v2). The `attributes[]` block MUST mirror conversation-composer.ts
# `props` — the contract↔props trip-wire (conversation-composer.test.ts) targets this fence.
tag: ui-conversation-composer
tier: pattern            # a composed control with internal parts, no §1 control-height row of its own (the ui-command-modal precedent); the editor region rides ADR-0134's growable multi-line law instead
extends: UIElement       # the coordinator base — NOT form-associated (nobody submits this in a form; ui-conversation drives it imperatively, SPEC-R4), even though since TKT-0058 the host paints the field frame itself
# marginal: measured at the @agent-ui/app integration slice (scripts/measure-size.mjs), folded into ui-conversation's own family total (TKT-0056 extraction — no new package)
composes: [ui-menu, ui-button, ui-icon]  # all JS-created internal children (the master-detail.ts → ui-split precedent), never author-composed — documentary only (component-descriptor.ts's FIELD_SHAPE has no `composes` key). The v1 ui-text-field child was unrolled (TKT-0058): the editor is this element's OWN contenteditable part now.

attributes:              # attributes-as-API — mirrors conversation-composer.ts `props`
  - name: value
    type: string          # the live message text — property-only: never author-composed, so no markup value to seed (unlike ui-text-field/ui-textarea, whose value ATTRIBUTE seeds a reset baseline)
    default: ''
    reflect: false
  - name: models
    type: json            # readonly {id,label}[] (composer-options.ts's PickerOption) — too structured to reflect
    default: undefined    # undefined ⇒ no Models picker; the original field+Send composer, unchanged
    reflect: false
  - name: model
    type: json             # a plain string id, but attribute:false alongside its list (the schema/store pairing precedent) — never reflected, so the codec never runs
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
    type: json            # readonly ProviderOption[] (composer-options.ts — PickerOption + {models, defaultModel}) — GH #257
    default: undefined    # undefined ⇒ no Provider picker; `models`/`model` keep working standalone, unchanged
    reflect: false
  - name: provider
    type: json            # a plain string id, attribute:false alongside its list (the models/model pairing precedent)
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
  - name: busy
    type: boolean
    default: false
    reflect: true          # reflects — `ui-conversation` sets this from its own turn-in-flight tracking (TKT-0034); `[busy]` on the host is the whole-composer dim hook, and the send/mic/picker-triggers disable + the editor becomes non-editable

properties:
  - name: value
    description: The live message text (TKT-0058) — the same two ADR-0014 wires as `ui-textarea` bind it to the editor surface (surface→model on `input`, IME-guarded; model→surface under the CARET GUARD). `#send()` reads and clears it; a programmatic write flows to the editor on the next flush.
  - name: models
    description: OPTIONAL `readonly {id, label}[]` (composer-options.ts's `PickerOption`) — when set (and non-empty), renders a Models picker. Default `undefined` ⇒ no picker, the original field+Send composer shape.
  - name: model
    description: The Models picker's CURRENT selection (an id from `models`). The picker never writes this itself — a consumer supplies it and reads the committed choice back via `onModelChange` (props down, callbacks up).
  - name: efforts
    description: OPTIONAL `readonly {id, label}[]` — same shape/opt-in law as `models`, for the Effort picker. `composer-options.ts` exports a ready-made `EFFORT_LEVELS` constant (low/medium/high/xhigh) a consumer may reuse verbatim.
  - name: effort
    description: The Effort picker's CURRENT selection. See `model` — same props-down/callbacks-up law, via `onEffortChange`.
  - name: providers
    description: OPTIONAL `readonly ProviderOption[]` (composer-options.ts's `PickerOption` + `{models, defaultModel}`) — when set (and non-empty), renders a Provider picker that narrows the Models picker to an INTERNALLY-DERIVED view of the selected provider's own `models` list (never a separate/fourth prop pair — a model belongs to exactly one provider). Default `undefined` ⇒ no Provider picker; `models`/`model` keep working exactly as before, unchanged.
  - name: provider
    description: The Provider picker's CURRENT selection (an id from `providers`). Never written by this element itself — a consumer supplies it and reads the committed choice back via `onProviderChange` (props down, callbacks up). Committing a NEW provider whose model list does not contain the CURRENT `model` also fires `onModelChange` with that provider's own `defaultModel`, in the same commit (mirrors `provider-switcher.ts`'s reset-on-provider-change exactly).
  - name: modes
    description: OPTIONAL `readonly {id, label}[]` — the Gen-UI Mode axis (GH #257), same shape/opt-in law as `efforts`/`models`. This element never imports the a2ui-owned `GenUiMode` type itself — a consumer builds its own `modes` list (e.g. from `gen-ui-mode.ts`'s `GEN_UI_MODES`).
  - name: mode
    description: The Mode picker's CURRENT selection. See `model` — same props-down/callbacks-up law, via `onModeChange`.
  - name: contextItems
    description: A `readonly {id, label}[]` of dismissable chips shown above the text (e.g. "something selected elsewhere, attached to this turn's context"). Default `undefined` — no chip row. A dismiss click fires `onContextDismiss(id)`; the consumer owns actually removing it from this list.
  - name: busy
    description: Whether a turn is in flight (TKT-0034) — the editor becomes non-editable + pointer-inert, send/mic/picker-triggers disable, the whole composer dims via the reflected `[busy]`, and the host carries `ariaBusy`/`ariaDisabled` through `internals`. The composer's OWN send path also checks `busy` synchronously (not only via the batched disabling effect) as a backstop against a stray Enter racing the effect's flush — the guard is load-bearing behavior, not just styling.

events: []               # no DOM events — onSubmit/onModelChange/onEffortChange/onProviderChange/onModeChange/onContextDismiss/onMicClick are ALL callback registrations, never CustomEvents (SPEC-R5's closed six-event vocabulary has no submission/picker-commit kind — inherited by lineage from ui-conversation, not re-derived)

slots: []                 # content model is NOT author-composed — every part is built entirely by this element's own connect-time logic; no slotted children

parts:                    # NOT shadow-DOM ::part() (light-DOM only) — light-DOM markers this element's own JS creates
  - name: context-chips
    description: The opt-in chip row (`[data-part="context-chips"]`), the tags row above the text — hidden (`[hidden]`) when `contextItems` is empty. One `[data-part="context-chip"]` per entry, each a `[data-part="context-chip-label"]` + a `[data-part="context-chip-dismiss"]` `ui-button` (icon-only, `x` glyph) firing `onContextDismiss`.
  - name: editor
    description: The message text (`[data-part="editor"]`) — this element's OWN contenteditable surface (TKT-0058; the ADR-0014 pattern via its multi-line sibling `ui-textarea`, ADR-0134): `contenteditable="plaintext-only"`, `role="textbox"`/`aria-multiline="true"`/`aria-label="Message"` on the PART (never the host), `data-placeholder="Ask anything.."` ghost text keyed by `data-empty`. Auto-grows from a one-line minimum, capped at `max-block-size: 6em`, then scrolls.
  - name: options
    description: The row below the text (`[data-part="options"]`) — `[data-part="options-leading"]` (the opt-in Provider/Models/Effort/Mode pickers) and `[data-part="options-trailing"]` (the opt-in mic + the always-present send button), space-between.
  - name: models-trigger
    description: The Models picker's trigger pill (`[data-picker="models"]`, a `ui-menu`'s `<ui-button variant="soft">`), shown only when `models` is set. Displays the current selection's label (falling back to "Models"), with a trailing caret. NOT `[data-part="models-trigger"]` — `ui-menu`'s own `connected()` unconditionally re-tags its trigger's `data-part` to the literal `"trigger"` the moment the menu connects, so `data-picker` (an attribute `ui-menu` never touches) is the stable selector instead (also reachable as `[data-part="models-menu"] [data-part="trigger"]`, scoped by the host).
  - name: effort-trigger
    description: The Effort picker's trigger pill (`[data-picker="effort"]`) — see `models-trigger`, shown only when `efforts` is set.
  - name: providers-trigger
    description: The Provider picker's trigger pill (`[data-picker="providers"]`) — see `models-trigger`, shown only when `providers` is set. Selecting a new provider narrows the Models picker to that provider's own model list.
  - name: mode-trigger
    description: The Mode picker's trigger pill (`[data-picker="mode"]`) — see `models-trigger`, shown only when `modes` is set.
  - name: mic
    description: The microphone button (`[data-part="mic"]`, icon-only `ui-button`, `variant="ghost"`) — OPT-IN: hidden (`[hidden]`) until a consumer calls `onMicClick`. Fires `onMicClick`; this element has no speech-to-text mechanism of its own.
  - name: send
    description: The submit button (`[data-part="send"]`, icon-only `ui-button`, `variant="ghost"` retinted to the neutral family like the mic — the token-repoint pattern in `conversation-composer.css`; an arrow-up glyph).

customStates:          # :state() hooks the stylesheet keys off — set via internals.states, never host attrs
  - ready              # the motion gate (interaction-states standard): armed one frame past first paint so the upgrade SNAPS and only subsequent border/bg/ink/dim state changes animate

face:
  formAssociated: false   # NOT a FACE form control — nothing submits this in a form; ui-conversation drives it imperatively (SPEC-R4). The field-frame LOOK (TKT-0058) is adopted from the entry-control law without adopting form participation.

aria:
  role: none               # the HOST carries no ARIA role of its own — `role="textbox"`/`aria-multiline`/`aria-label` ride the editor PART (the ui-textarea law), and busy-state ariaBusy/ariaDisabled ride `internals`
  roleSource: none
  childModel: none — every part is built entirely by this element's own connect-time logic; nothing is ever author-composed or slotted

contentModel: 'no author-facing content model — see `slots: []`'

keyboard:
  - keys: Enter
    action: In the editor, sends the composer text (same as clicking Send) — unless `busy` is true (the typed text is retained, never silently dropped) or an IME composition is finalizing (`isComposing` guards it).
  - keys: Shift+Enter
    action: Inserts a newline — the multi-line chat-composer inversion (LLD CVC-C7); this element deliberately sits between `ui-text-field` (every Enter submits) and `ui-textarea` (Enter never submits).

geometry:
  sizeClass: pattern                # composed control, no §1 control-height row of its own
  blockSize: content-driven         # chips row + the growable editor (one-line minimum → 6em cap, then scrolls; the ADR-0134 growable-minimum law, bounded) + options row, inside the host's own frame padding

forcedColors: The field frame + ink + placeholder stay legible under `forced-colors: active` (`conversation-composer.css` — `CanvasText`, `GrayText` while `[busy]`; the ui-textarea block adapted). The composed `ui-button`/`ui-menu` parts carry their own forced-colors handling; the focus ring survives for free via `--md-sys-color-focus-ring` → `Highlight`.
---

# ui-conversation-composer

`ui-conversation-composer` is the **message-composition UI** extracted out of `ui-conversation` (TKT-0056)
— and, since the TKT-0058 v2 unroll, **itself the field**: one ADR-0014 field frame (border ladder, focus
ring on the host, neutral-family ink/placeholder) whose content is a tags row above the text, this
element's OWN multi-line contenteditable editor (the `ui-textarea` ADR-0134 pattern — no nested
`ui-text-field` anymore), and an options row below it (up to four `ui-menu` pickers — Provider/Models/
Effort/Mode — + mic/send `ui-button`s). It has **no author-facing content model** — `ui-conversation`
composes it exactly like `master-detail.ts` composes `ui-split`: `document.createElement('ui-conversation-
composer')`, forwarding props down and listening for its callback registrations.

```ts
const composer = document.createElement('ui-conversation-composer')
composer.models = [{ id: 'claude-sonnet-5', label: 'Sonnet 5' }, /* … */]
composer.model = 'claude-sonnet-5'
composer.onSubmit((text) => { /* the consumer's own turn loop */ })
composer.onModelChange((id) => { /* persist the new selection */ })
composer.onMicClick(() => { /* wire real voice input here — none is built in; ALSO reveals the mic button */ })
composer.busy = true // disables editor/send/mic/picker-triggers; the composer's own send path also guards on this synchronously
```

## GH #257 — the Provider axis narrows Models; Mode is a plain flat picker

```ts
composer.providers = [
  { id: 'anthropic', label: 'Anthropic', defaultModel: 'claude-sonnet-5', models: [{ id: 'claude-sonnet-5', label: 'Sonnet 5' }] },
  { id: 'openai', label: 'OpenAI — coming soon', defaultModel: 'gpt-4.1', models: [{ id: 'gpt-4.1', label: 'GPT-4.1' }], disabled: true },
]
composer.provider = 'anthropic'
composer.onProviderChange((id) => { /* persist the new provider */ })
composer.modes = [{ id: 'default', label: 'Default' }, { id: 'specific', label: 'Specific' }]
composer.mode = 'default'
composer.onModeChange((id) => { /* persist the new mode */ })
```

`providers`/`provider` narrow the SAME Models picker to an internally-derived view of the selected
provider's own `models` — never a separate/fourth axis, since a model belongs to exactly one provider.
Committing a new provider whose model list doesn't contain the CURRENT `model` also fires `onModelChange`
with that provider's own `defaultModel`, in the same commit (mirroring the switcher precedent this axis
promotes from, `site/lib/provider-switcher.ts`, retired the same change). A `PickerOption`'s optional
`disabled` marks a non-committable, visible "coming soon" entry (ui-menu's own disabled-item skip). `modes`
is a plain flat `{id, label}[]`/selected-id pair — the same shape as `efforts`, no narrowing of its own;
this element never imports the a2ui-owned `GenUiMode` type — a consumer builds its own `modes` list.

## The composer IS the field (TKT-0058)

States and text formatting follow the text-input law, multi-line: the ADR-0014 border ladder (idle →
hover → transparent-under-focus with the shared outline ring as the sole indicator), prose line-height,
`data-empty`-keyed placeholder. **Enter sends, Shift+Enter inserts a newline** (IME-guarded) — the
chat-composer third shape between `ui-text-field` and `ui-textarea`. Clicking the component's own area
(not its tags, menus, or buttons) focuses the editor, and `host.focus()` forwards there too; the focus
ring renders on the host via `:has([data-part='editor']:focus)` — deliberately not `:focus-within`, so
focus on the send/mic buttons or inside a picker never lights the field frame. The editor auto-grows with
input from a one-line minimum up to `6em`, then scrolls.

## Props down, callbacks up — the `onSubmit` law, inherited by lineage

Every picker/dismiss/submit affordance follows **props down, callbacks up** — this element never writes
`model`/`effort`/`provider`/`mode`/`contextItems` itself; a consumer supplies the current value and reads
the committed choice back through the matching callback. All seven callbacks (`onSubmit`/`onModelChange`/
`onEffortChange`/`onProviderChange`/`onModeChange`/`onContextDismiss`/`onMicClick`) are callback
REGISTRATIONS, never `CustomEvent`s (SPEC-R5's closed six-event vocabulary has no submission/picker-commit
kind) — and are safe to register before or after connect.

## Every capability is opt-in

`models`/`efforts`/`providers`/`modes`/`contextItems` all default to `undefined` — no picker, no chip row.
The mic button is ALSO opt-in: hidden until a consumer calls `onMicClick`, so a consumer that never wires
voice input never renders (or exposes to a naive "first `ui-button` in the composer" selector) a dead
button. Only the editor and the send button are always present.

## `busy` is load-bearing behavior, not just styling

The composer's own internal send path (the send-button click, the editor's Enter keydown) checks
`if (this.busy) return` **synchronously, before reading or clearing the value** — a backstop against a
stray Enter racing the disabling effect's own microtask-batched flush, so a busy-window Enter always
retains the typed text rather than silently discarding it.
