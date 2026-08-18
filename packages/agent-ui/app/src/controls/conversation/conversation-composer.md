---
# conversation-composer.md frontmatter — the attributes-as-API descriptor for ui-conversation-composer
# (ADR-0004, TKT-0056 · TKT-0058 v2). The `attributes[]` block MUST mirror conversation-composer.ts
# `props` — the contract↔props trip-wire (conversation-composer.test.ts) targets this fence.
tag: ui-conversation-composer
tier: pattern            # a composed control with internal parts, no §1 control-height row of its own (the ui-command-modal precedent); the editor region rides ADR-0134's growable multi-line law instead
extends: UIElement       # the coordinator base — NOT form-associated (nobody submits this in a form; ui-conversation drives it imperatively, SPEC-R4), even though since TKT-0058 the host paints the field frame itself
# marginal: measured at the @agent-ui/app integration slice (scripts/measure-size.mjs), folded into ui-conversation's own family total (TKT-0056 extraction — no new package)
composes: [ui-menu, ui-button, ui-icon, ui-switch]  # ui-switch = GH #891's capabilities rows (SPEC-R11) — all JS-created internal children (the master-detail.ts → ui-split precedent), never author-composed — documentary only (component-descriptor.ts's FIELD_SHAPE has no `composes` key). The v1 ui-text-field child was unrolled (TKT-0058): the editor is this element's OWN contenteditable part now.

attributes:              # attributes-as-API — mirrors conversation-composer.ts `props`
  - name: value
    type: string          # the live message text — property-only: never author-composed, so no markup value to seed (unlike ui-text-field/ui-textarea, whose value ATTRIBUTE seeds a reset baseline)
    default: ''
    reflect: false
  - name: placeholder
    type: string          # the editor's ghost text (GH #672) — property-only, alongside `value` (never author-composed); mirrored onto the editor's `data-placeholder` attribute, the ui-textarea `placeholder` precedent
    default: 'Ask anything..'
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
  - name: mentionables
    type: json            # readonly ReferenceOption[] (composer-options.ts — {id,label,kind,description?,icon?}) — GH #849, the '@' roster (GH #891/SPEC-R9 added the optional `icon` glyph name)
    default: undefined    # undefined/empty ⇒ '@' is a PLAIN CHARACTER: no typeahead, no DOM, byte-identical to before
    reflect: false
  - name: invocables
    type: json            # readonly ReferenceOption[] — GH #849, the '/' roster (one menu, grouped by kind)
    default: undefined    # undefined/empty ⇒ '/' is a plain character; same default-off law as `mentionables`
    reflect: false
  - name: capabilities
    type: json            # readonly CapabilityRow[] (composer-options.ts — {id,label,kind,description?,icon?,included}) — GH #891/SPEC-R11, the capabilities panel's rows
    default: undefined    # undefined/empty ⇒ NO trigger, NO panel DOM: byte-identical to before (the models/mentionables default-off law)
    reflect: false
  - name: busy
    type: boolean
    default: false
    reflect: true          # reflects — `ui-conversation` sets this from its own turn-in-flight tracking (TKT-0034); `[busy]` on the host is the whole-composer dim hook, and the send/mic/picker-triggers disable + the editor becomes non-editable

properties:
  - name: value
    description: The live message text (TKT-0058) — the same two ADR-0014 wires as `ui-textarea` bind it to the editor surface (surface→model on `input`, IME-guarded; model→surface under the CARET GUARD). `#send()` reads and clears it; a programmatic write flows to the editor on the next flush.
  - name: placeholder
    description: The editor's ghost text, shown via `[data-empty]::before { content: attr(data-placeholder) }` (GH #672). Default `'Ask anything..'` — unchanged from the prior hard-coded literal, so a consumer that never sets this is byte-identical to before. A reactive effect mirrors it onto the editor's `data-placeholder` attribute on every change (not just at build time), the ui-textarea `placeholder` precedent.
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
    description: 'A `readonly {id, label, description?}[]` of dismissable chips shown above the text (e.g. "something selected elsewhere, attached to this turn''s context"). Default `undefined` — no chip row. A dismiss click fires `onContextDismiss(id)`; the consumer owns actually removing it from this list. GH #1211 — the OPTIONAL `description` renders a secondary line under the label (e.g. a file size, an "extracting…" state, a truncation notice); opaque free text to this element exactly like `label`, omitted entirely when absent (byte-identical to every pre-#1211 chip).'
  - name: mentionables
    description: OPTIONAL `readonly ReferenceOption[]` (composer-options.ts — `{id, label, kind, description?, icon?}`) — GH #849's `@` mention roster. Typing `@` at a TOKEN START (start of text, or after whitespace) opens a typeahead over it; committing an item removes the token text and mints a reference chip. Default `undefined` ⇒ `@` is a plain character (no typeahead, no panel DOM at all). `kind` is an OPAQUE string here — this element groups and displays it, never interprets it; a consumer (e.g. `ui-agent-admin`) owns the domain projection, exactly as it already owns `PickerOption`'s. GH #891 (SPEC-R9) — `icon` is an equally opaque `ui-icon` glyph NAME the consumer supplies per entry: it renders as the chip's leading kind mark and round-trips onto the committed `TurnReference`; this element never maps a `kind` to a glyph itself, and an entry without one renders a label-only chip.
  - name: invocables
    description: OPTIONAL `readonly ReferenceOption[]` — GH #849's `/` invocation roster, presented as ONE menu grouped by `kind` (group headers appear only when the visible set spans more than one kind), filtered directly by display name — never a two-stage `/tool <name>` grammar. Same default-off law as `mentionables`.
  - name: capabilities
    description: 'OPTIONAL `readonly CapabilityRow[]` (composer-options.ts — `{id, label, kind, description?, icon?, included}`) — GH #891''s capabilities panel: the BROWSE/STEER surface behind a third options-row trigger, sibling of the `@`/`/` typeahead''s keyboard-first quick path. Default `undefined` ⇒ no trigger and no panel DOM at all. Rows group by `kind` in first-appearance order; `kind`/`icon` are OPAQUE strings this element renders and never interprets (the `mentionables` law). `included` is CONSUMER-owned: each row renders a real `ui-switch` reflecting it, a flip fires `onCapabilityToggle(id, included)` and this element mutates NOTHING — the switch is re-asserted from the current prop, so the visible state moves only when the consumer hands a new array down. Handing back the same rows with one `included` changed updates the switches IN PLACE (no rebuild), so a keyboard user''s focus survives their own flip. What a flip MEANS (this turn only vs the persisted roster) is the consumer''s ruling, ADR-0190 — this contract is identical under either arm.'
  - name: busy
    description: Whether a turn is in flight (TKT-0034) — the editor becomes non-editable + pointer-inert, send/mic/picker-triggers disable, the whole composer dims via the reflected `[busy]`, and the host carries `ariaBusy`/`ariaDisabled` through `internals`. The composer's OWN send path also checks `busy` synchronously (not only via the batched disabling effect) as a backstop against a stray Enter racing the effect's flush — the guard is load-bearing behavior, not just styling.

events: []               # no DOM events — onSubmit/onModelChange/onEffortChange/onProviderChange/onModeChange/onContextDismiss/onCapabilityToggle/onMicClick/onAttach are ALL callback registrations, never CustomEvents (the fleet's CLOSED event vocabulary — owned solely by the ALLOWED_EVENTS constants in family-coherence.test.ts + naming-gates.test.ts, ADR-0153, never re-enumerated here — has no submission/picker-commit kind; inherited by lineage from ui-conversation, not re-derived). GH #849's reference typeahead adds NO event either: its internal listbox is control-created and no menu event escapes the host. GH #891's capabilities panel likewise: its embedded `ui-switch`es really do emit `change`, and that event is stopped at the panel boundary (the editor-`input` suppression discipline) so nothing crosses the host. GH #1211's attach path adds no event either: the native `drop`/`paste`/file-input `change` are all fully handled internally, never re-emitted.

slots: []                 # content model is NOT author-composed — every part is built entirely by this element's own connect-time logic; no slotted children

parts:                    # NOT shadow-DOM ::part() (light-DOM only) — light-DOM markers this element's own JS creates
  - name: context-chips
    description: The opt-in chip row (`[data-part="context-chips"]`), the tags row above the text — hidden (`[hidden]`) when `contextItems` is empty. One `[data-part="context-chip"]` per entry, each a `[data-part="context-chip-label"]` + a `[data-part="context-chip-dismiss"]` `ui-button` (icon-only, `x` glyph) firing `onContextDismiss`.
  - name: editor
    description: The message text (`[data-part="editor"]`) — this element's OWN contenteditable surface (TKT-0058; the ADR-0014 pattern via its multi-line sibling `ui-textarea`, ADR-0134): `contenteditable="plaintext-only"`, `role="textbox"`/`aria-multiline="true"`/`aria-label="Message"` on the PART (never the host), `data-placeholder` ghost text (from the `placeholder` prop, GH #672 — default `"Ask anything.."`) keyed by `data-empty`. Auto-grows from a one-line minimum, capped at `max-block-size: 6em`, then scrolls.
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
  - name: attach
    description: 'GH #1211 — the attach button (`[data-part="attach"]`, icon-only `ui-button`, `variant="ghost"`, `paperclip` glyph), a sibling of mic/send placed BEFORE them — OPT-IN: hidden (`[hidden]`) until a consumer calls `onAttach`. Clicking it opens the native file picker (`[data-part="attach-input"]` below). Once wired, `onAttach` also fires from a drop onto the composer host or a paste (of files, never plain text) into the editor — one call per gesture, carrying every `File` it produced. This element inspects NOTHING about a file (no type/size/content check) — validating and extracting is entirely the consumer''s job.'
  - name: attach-input
    description: 'GH #1211 — the attach button''s native vehicle: a `hidden` `<input type="file" multiple>`, never rendered (a control-created part). Reset to `''''` after every `change` so re-picking the SAME file still fires one.'
  - name: mic
    description: The microphone button (`[data-part="mic"]`, icon-only `ui-button`, `variant="ghost"`) — OPT-IN: hidden (`[hidden]`) until a consumer calls `onMicClick`. Fires `onMicClick`; this element has no speech-to-text mechanism of its own.
  - name: send
    description: The submit button (`[data-part="send"]`, icon-only `ui-button`, `variant="ghost"` retinted to the neutral family like the mic — the token-repoint pattern in `conversation-composer.css`; an arrow-up glyph).
  - name: reference-menu
    description: GH #849 — the reference typeahead panel (`[data-part="reference-menu"]`, `role="listbox"`, `popover="manual"`, `aria-label="References"`), built lazily on the first live `@`/`/` trigger and placed in the Popover API TOP LAYER with the overlay trait's own `computePosition` (preferring ABOVE the editor, flipping/shifting to stay on screen). `[data-open]` is its own state truth (set alongside `showPopover()`), the CSS/AX-visible signal that the typeahead is live. Focus NEVER moves here — the editor keeps DOM focus and carries `aria-expanded`/`aria-controls`/`aria-activedescendant` (the `ui-combo-box` active-descendant discipline, restated).
  - name: reference-group
    description: One kind's group inside the panel (`[data-part="reference-group"]`, `role="group"` + `aria-label`), with a sighted `[data-part="reference-group-label"]` header (`aria-hidden` — the group's own label is what AT announces). Rendered ONLY when the visible option set spans more than one `kind`, so the Resources-only `@` menu shows no redundant single header while the `/` menu groups Skills/Workflows/Tools.
  - name: reference-option
    description: One selectable roster entry (`[data-part="reference-option"]`, `role="option"`, a stable `id` for `aria-activedescendant`, plus `data-id`/`data-kind`), holding a `[data-part="reference-option-label"]` and — when the roster entry supplies one — a `[data-part="reference-option-description"]`. `[data-active]` marks the Enter target without moving DOM focus. A click commits it (the panel's own `pointerdown` is preventDefaulted so the editor keeps focus).
  - name: capabilities-trigger
    description: 'GH #891/SPEC-R11 — the capabilities panel''s trigger pill (`[data-picker="capabilities"]`, a `ui-button variant="soft"` with the pickers'' own leading-glyph + caret shape), shown only when `capabilities` is set and non-empty, busy-disabled with the other triggers. Unlike the four pickers it is NOT wrapped in a `ui-menu` — it opens this element''s own control-created panel — so it carries `aria-expanded`/`aria-controls` itself. Clicking it toggles the panel.'
  - name: capabilities-panel
    description: 'GH #891/SPEC-R11 — the capabilities panel (`[data-part="capabilities-panel"]`, `role="group"`, `popover="manual"`, `aria-label="Capabilities"`), built lazily on the first non-empty `capabilities` and placed in the Popover API TOP LAYER with the typeahead''s own `computePosition` (anchored to its trigger, preferring ABOVE it). `[data-open]` is its own state truth. It STAYS OPEN across toggles — multi-toggle in one visit is the point (which is why it is not a `ui-menu`: menuitem action semantics close on activate). Escape, an outside pointerdown, a send, `busy`, and disconnect all close it; Escape returns focus to the trigger.'
  - name: capability-row
    description: 'GH #891/SPEC-R11 — one capability (`[data-part="capability-row"]`, with `data-id`/`data-kind`): an optional leading `[data-part="capability-row-icon"]` `ui-icon`, a `[data-part="capability-row-text"]` column holding `[data-part="capability-row-label"]` + an optional `[data-part="capability-row-description"]`, and a trailing `[data-part="capability-switch"]` `ui-switch` whose `checked` reflects the row''s `included` and whose accessible name is the row''s label. Rows sharing a `kind` sit inside a `[data-part="capability-group"]` (`role="group"` + `aria-label`, with an `aria-hidden` `[data-part="capability-group-label"]` header) — rendered only when the set spans more than one kind, the typeahead''s own grouping law.'
  - name: reference-chip
    description: A committed mention/invocation (`[data-part="reference-chip"]`, `data-kind` for per-kind treatment) living in the SAME chip row as the consumer's `contextItems` chips — consumer chips first, reference chips after. Each holds — GH #891 (SPEC-R9) — an OPTIONAL leading `[data-part="reference-chip-icon"]` `ui-icon` (`data-role="icon"`, the glyph the roster entry's own `icon` named; absent ⇒ label-only, never a placeholder box), a `[data-part="reference-chip-label"]`, and a `[data-part="reference-chip-dismiss"]` `ui-button` that drops the reference from this turn. The chip renders NO `@`/`/` sigil: the trigger character is not part of the label (the pre-R9 `[data-part="reference-chip-sigil"]` node is removed) — kind identity is the consumer's glyph + `data-kind`, family identity is the accent ink. Composer-OWNED state (unlike `contextItems`): minted by a commit, cleared on a successful send.

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
    action: In the editor, sends the composer text (same as clicking Send) — unless the reference typeahead is open (then it COMMITS the highlighted item and never sends, GH #849), `busy` is true (the typed text is retained, never silently dropped), or an IME composition is finalizing (`isComposing` guards it).
  - keys: Shift+Enter
    action: Inserts a newline — the multi-line chat-composer inversion (LLD CVC-C7); this element deliberately sits between `ui-text-field` (every Enter submits) and `ui-textarea` (Enter never submits). Unaffected by the typeahead.
  - keys: '@'
    action: At a TOKEN START (start of text, or after whitespace) opens the mention typeahead over `mentionables`; further non-whitespace characters filter it case-insensitively over display names. Mid-word, or with no `mentionables` roster set, it is a plain character (GH #849).
  - keys: /
    action: At a token start opens the invocation typeahead over `invocables` (one menu grouped by kind). Otherwise a plain character (GH #849).
  - keys: ArrowDown / ArrowUp
    action: With the typeahead open, moves the highlight via `aria-activedescendant` on the editor, wrapping at both ends — DOM focus never leaves the editor (GH #849, the `ui-combo-box` active-descendant discipline).
  - keys: Escape
    action: With the typeahead open, closes it and leaves the typed characters as plain inert text; further typing inside that same token does NOT reopen it. With the capabilities panel open instead, closes THAT and returns focus to its trigger (GH #891). Either way the keydown is also stopped from propagating, so an ancestor overlay never light-dismisses on a composer-only Escape (GH #849).

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
composer.placeholder = 'Describe the agent you want…' // GH #672 — default 'Ask anything..' unless set
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

## GH #849 — `@` mentions, `/` invocations: chips + structured references

```ts
composer.mentionables = [{ id: 'res-1', label: 'Menu PDF', kind: 'resource', description: 'Tonight’s menu', icon: 'file-text' }]
composer.invocables = [
  { id: 'skill-1', label: 'House style', kind: 'skill', icon: 'star' },
  { id: 'svc:calc:*', label: 'Calculator', kind: 'tool', icon: 'gear' },
]
composer.onSubmit((text, references) => {
  // references: readonly TurnReference[] — [{ id: 'res-1', label: 'Menu PDF', kind: 'resource', icon: 'file-text' }, …]
  // A single-argument consumer is byte-unaffected: the extra argument is simply ignored.
})
```

Typing `@` (or `/`) at a **token start** — start of text, or after whitespace — opens a control-created
`[role="listbox"]` typeahead over that roster; more non-whitespace characters filter it case-insensitively
over display names. **Focus never leaves the editor**: Arrow moves `aria-activedescendant`, Enter commits
the highlighted item (and never sends), Escape closes and leaves the typed characters as plain inert text.
Dismissal by whitespace or blur behaves the same way — typed trigger text is NEVER captured, because the
only load-bearing representation of a mention/invocation is the structured `TurnReference`.

A commit removes the in-progress token from the text and adds a **chip** to the existing chip row (never an
inline pill — the editor is `contenteditable="plaintext-only"` by architecture, ADR-0014/ADR-0134). Chips
are dismissable before send and clear on a successful send alongside the text; consumer-owned `contextItems`
chips keep the row's leading positions, composer-owned reference chips follow them. Both rosters default to
`undefined`, and with neither set this element's DOM and behavior are exactly what they were before GH #849
(the `models`/`providers` default-off law) — including a single-argument `onSubmit` consumer.

**The chip's anatomy (GH #891/SPEC-R9).** A chip's visible text is exactly the entry's **label** — the `@`/`/`
the user typed is never part of it. What identifies a chip: the accent **ink** (family — this rides THIS turn,
against the neutral consumer context tags beside it), the `data-kind` attribute (a themed consumer's per-kind
CSS hook), and an OPTIONAL leading `ui-icon` whose glyph the **consumer** supplied on the roster entry
(`ReferenceOption.icon`, round-tripped onto the delivered `TurnReference`). No `icon` ⇒ label + dismiss only,
never a placeholder box. The composer maps nothing: there is no kind→glyph table in this element, by design.

The composer stays **generic**: it knows `ReferenceOption`/`TurnReference` and treats `kind` as an opaque
string it groups and displays. It never learns `Entry`, a store, or a kind's semantics — a consumer
(`ui-agent-admin`) owns that projection, exactly as it already owns the `PickerOption` lists.

## GH #891 — the capabilities panel: a third trigger, rows down, one callback up

```ts
composer.capabilities = [
  { id: 'skill-style', label: 'House style', kind: 'skill', icon: 'star', included: true },
  { id: 'svc:calc:*', label: 'Calculator', kind: 'tool', icon: 'gear', included: false },
]
composer.onCapabilityToggle((id, included) => {
  // The CONSUMER owns the state: persist/steer however its own semantics require, then hand a NEW
  // `capabilities` array down. This element wrote nothing — the switch is still showing the old value.
})
```

The trigger sits beside the Models/Effort pills; the panel it opens lists every row with a real `ui-switch`,
grouped by `kind`. It is the **browse/steer** surface — see everything's state at a glance, flip several in
one visit — while the `@`/`/` typeahead stays the keyboard-first quick path; they are siblings over the same
consumer-owned truth, not alternatives. The panel therefore **stays open** across toggles (deliberately not a
`ui-menu`, whose menuitem semantics commit-and-close); Escape, an outside pointerdown, a send, `busy`, and
disconnect close it, and a disconnect never orphans it in the top layer.

**Props down, callbacks up, verbatim** (the `onModelChange` law): a flip fires the callback and this element
mutates nothing — it re-asserts the switch from the current `capabilities`, so a row's visible state moves
only when the consumer hands a new array down. Answering with the same rows and one `included` changed
updates the switches in place, so the keyboard focus of the person who just flipped one survives. Unset
`capabilities` ⇒ no trigger, no panel, no DOM: byte-identical to before this feature. No new event name is
minted, and the embedded switches' own `change` never crosses the host (`events: []`).

What a flip MEANS — steering only this turn, or writing the agent's persisted roster — is deliberately NOT
this element's concern: it is the consumer-side fork of ADR-0190, and this contract is identical under either
arm because the composer never touches a store under either.

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
the committed choice back through the matching callback. All eight callbacks (`onSubmit`/`onModelChange`/
`onEffortChange`/`onProviderChange`/`onModeChange`/`onContextDismiss`/`onMicClick`/`onAttach`) are callback
REGISTRATIONS, never `CustomEvent`s (the fleet's closed event vocabulary — owned by the `ALLOWED_EVENTS`
constants in `family-coherence.test.ts`/`naming-gates.test.ts` per ADR-0153 — has no submission/picker-commit
kind) — and are safe to register before or after connect. The one exception to props-down is GH #849's
committed references: those are composer-OWNED state (there is no `references` prop), delivered up through
`onSubmit`'s second argument and cleared by the send that delivered them.

## GH #1211 — the attach path: drop, paste, or a picker button, all one callback

```ts
composer.onAttach((files) => { /* validate/extract/mint knowledge here — ALSO reveals the attach button */ })
```

`onAttach` fires with every `File` a drop onto the composer, a paste of files into the editor, or the
attach button's native picker produced — one call per gesture, never per-file. This element is entirely
STORE-BLIND and KIND-BLIND about what it hands up (the same TKT-0056/GH #849/#891 layering law every other
capability here follows): no type/size/content check, no `Entry`, no toast — a consumer (`ui-agent-admin`)
owns validating, extracting, and projecting a file into agent knowledge. A plain text paste (no files on
the clipboard) is never intercepted, falling through to the editor's native paste exactly as before this
feature existed; the SAME is true of drop/paste entirely when no consumer ever calls `onAttach`.

## Every capability is opt-in

`models`/`efforts`/`providers`/`modes`/`contextItems`/`mentionables`/`invocables` all default to
`undefined` — no picker, no chip row, no typeahead.
The mic button is ALSO opt-in: hidden until a consumer calls `onMicClick`, so a consumer that never wires
voice input never renders (or exposes to a naive "first `ui-button` in the composer" selector) a dead
button. The attach button follows the identical law, revealed only by `onAttach`. Only the editor and the
send button are always present.

## `busy` is load-bearing behavior, not just styling

The composer's own internal send path (the send-button click, the editor's Enter keydown) checks
`if (this.busy) return` **synchronously, before reading or clearing the value** — a backstop against a
stray Enter racing the disabling effect's own microtask-batched flush, so a busy-window Enter always
retains the typed text rather than silently discarding it.
