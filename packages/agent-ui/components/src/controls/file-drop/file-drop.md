---
# file-drop.md frontmatter — the attributes-as-API descriptor for ui-file-drop (ADR-0004 · ADR-0210 · GH
# #1391). The machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the
# /site doc. The `attributes[]` block MUST mirror file-drop.ts `static props` (the `...UIFormElement.formProps`
# spread first, then files/label/accept/multiple/maxSizeBytes/maxFiles verbatim off ADR-0210 cl.2's table) —
# the contract↔props trip-wire (file-drop.test.ts) targets this fence. Field set per .claude/docs/plan.md
# §10 / ADR-0004; form-value per UIFormElement / ADR-0013; the value model + trust boundary per ADR-0210
# cl.3/cl.4. `intake`/`isKnown` are NOT attributes-as-API rows: both are function-valued instance properties
# (callbacks cannot ride HTML attributes) — see file-drop.ts's own header for why they exist and their
# provisional status pending this control's own SPEC/LLD leg (ADR-0210 cl.7).
tag: ui-file-drop
tier: pattern          # geometry composite (geometry.md "Pattern" — container + control-height rows): the
                       # browse/remove buttons ride Control-band height via their OWN <ui-button> geometry;
                       # the shell (gap/padding) rides the --space-* ramp. No [size] attribute (ADR-0210
                       # cl.2's table has none) — nothing here is a single sized trigger the way select/
                       # multi-select's virtual row-height lever is.
extends: UIFormElement  # form-associated: formValue() = a JSON string of the committed descriptor array
                        # (or null when empty); formValidity() = required && files.length===0 → valueMissing
# marginal: not yet measured — tracked at the integration slice (npm run size), the fleet's own convention
# for a folder-only wave (the attachment.md M1-a precedent)

attributes:             # attributes-as-API — mirrors UIFileDropElement.props (formProps spread first, then ADR-0210 cl.2's table verbatim)
  - name: name
    type: string
    default: ''
    reflect: true       # reflects for native form-submission keying (FACE form-control parity)
  - name: disabled
    type: boolean
    default: false
    reflect: true       # reflects so [disabled] attribute-selector styling applies to JS-set values
  - name: required
    type: boolean
    default: false
    reflect: true       # reflects so [required] styling applies; drives formValidity() valueMissing
  - name: files
    type: json
    default: ''         # the LIVE default is `[]` — String([])==='' (the multi-select.ts `valueProp` precedent)
    reflect: false       # NOT reflected — the bindable committed-selection state (ADR-0210 cl.3), not an authored dimension
  - name: label
    type: string
    default: ''
    reflect: true       # the accessible name / instruction line (ADR-0210 cl.2) — never silent-empty; '' falls back to FALLBACK_LABEL at render
  - name: accept
    type: string
    default: ''
    reflect: true       # the native <input accept> grammar verbatim (comma-separated MIME types / .ext); '' ⇒ any. Structural literal — NOT bindable (ADR-0210 cl.2, the Swiper non-bindable-constraint precedent)
  - name: multiple
    type: boolean
    default: false
    reflect: true       # default false — the native default, and the conservative one. Structural literal — NOT bindable
  - name: maxSizeBytes
    type: number
    default: null       # String(null) = 'null' — bytes; per-file cap (ADR-0112 Amendment 1: never named `size`, the reserved widget-tier geometry enum). Structural literal — NOT bindable
    reflect: true        # HTML attribute is `max-size-bytes` (a literal camelCase observed-attribute name would never match the always-lowercase real DOM attribute — the attachment.md mimeType/sizeBytes kebab discipline, applied here too)
  - name: maxFiles
    type: number
    default: null       # meaningful only with `multiple`; absent (null) ⇒ host-policy cap only (ADR-0210 cl.2). Structural literal — NOT bindable
    reflect: true        # HTML attribute is `max-files` (same kebab discipline as maxSizeBytes)

properties:             # IDL beyond attributes-as-API
  - name: name
    description: The form-submission key (string). Reflects the `name` attribute.
  - name: disabled
    description: Whether the control is disabled (boolean). Reflects `disabled`. Combined with a missing `intake` seam into the effective-usable channel (own || ancestor <fieldset disabled> || no intake registered, ADR-0210 cl.4.5) that drives :state(disabled)/ariaDisabled/pointer-inertness — but NOT formValidity, which reads the author-set `disabled`/`required` only.
  - name: required
    description: Whether at least one committed file is required (boolean). Reflects `required`. Drives formValidity() → valueMissing when files.length === 0.
  - name: files
    description: The committed file descriptors ({id,name,mimeType,sizeBytes}[]), NEVER null/undefined — [] when nothing is committed. Bindable (two-way via the `change` event, ADR-0210 cl.3). A malformed member on external write is DROPPED, never coerced (the hardened codec, file-drop.ts). Read-direction descriptors an `isKnown` check rejects render as inert "unavailable" chips — rendered, never dropped (cl.3).
  - name: label
    description: The accessible name / instruction line ('' → the fallback "Drop files here, or browse", never silent-empty). Drives the bare-usage internals.ariaLabel (ADR-0085) and the idle hint-line text.
  - name: accept
    description: The native `<input accept>` grammar verbatim — comma-separated MIME types (`image/png`, `image/*`) or extensions (`.pdf`). '' ⇒ any file accepted. Enforced at the gesture with a visible rejection reason (UX only — the host intake seam is the real security boundary, ADR-0210 cl.2/cl.4.4).
  - name: multiple
    description: Whether more than one file may be committed (boolean, default false). false ⇒ every gesture REPLACES the current single file (native `<input type=file>` parity), never appends.
  - name: maxSizeBytes
    description: Per-file byte cap (number | null). A file exceeding it is rejected at the gesture with a visible reason. null ⇒ no component-side cap (the host seam may still enforce one, cl.4.4).
  - name: maxFiles
    description: Maximum committed-file count, meaningful only with `multiple` (number | null). Overflowing new files are rejected at the gesture with a visible reason. null ⇒ host-policy cap only.
  - name: intake
    description: 'NOT an attribute — a signal-backed instance property, `(files: readonly File[], ctx: {multiple: boolean}) => Promise<FileHandleDescriptor[]>`. The host-mediated mint seam (ADR-0210 cl.4.2, GH #1211''s onAttach shape made async) — one call per committed gesture. `null` (the default) ⇒ the control renders visibly disabled with a component-owned reason (cl.4.5) and every gesture is inert. PROVISIONAL: the exact signature/registry home/ctx contents are this control''s own SPEC/LLD leg''s to confirm or widen (ADR-0210 cl.7) — the renderer-side WIRING of this seam onto a real host registry is a SEPARATE, not-yet-built deliverable (ADR-0210''s Repairs list; GH #1391''s other half).'
  - name: isKnown
    description: 'NOT an attribute — a signal-backed instance property, `(id: string) => boolean`. The read-direction registry check (ADR-0210 cl.3): does the host still recognize this committed id? `null` (the default) ⇒ every externally-written descriptor renders as available (no registry to consult). PROVISIONAL, same status as `intake`.'

events:
  - name: change
    detail: 'null'
    description: Fired per COMMITTED mutation of the selection (ADR-0210 cl.3) — a mint landing (from a drop, a paste, or the browse picker) or a chip removed. Never fired per progress tick (upload/extraction progress is component-local UX, never data-model content, cl.3). Also drives the value two-way bind (value:{prop:'files',event:'change'}).

slots: []               # no author-slotted content model — every child is control-built (createElement + replaceChildren), matching attachment.ts's own no-slots posture. `render()` stays the inherited no-op.

parts:
  - name: icon
    description: The decorative `<ui-icon data-part="icon">` (aria-hidden — the hint line carries the real text).
  - name: hint
    description: The `<span data-part="hint">` — the instruction line (`label`, falling back to "Drop files here, or browse"), a transient rejection reason after a constraint-failed gesture, or the component-owned "not available here" reason when no `intake` seam is registered (ADR-0210 cl.4.5). Precedence in that order.
  - name: browse
    description: The `<ui-button data-part="browse">` trigger — clicks the hidden `picker` input. The control's real accessible activation surface for the OS-picker gesture (see `picker` below).
  - name: picker
    description: A HIDDEN, `aria-hidden`, un-tabbable native `<input type="file" data-part="picker">` — necessity-driven OS-picker plumbing (no ARIA-only substitute exists for opening the platform file dialog; the GH #1211 composer's own hidden-input shape). Never part of the control's own accessible surface; its `accept`/`multiple` mirror the CURRENT constraint props.
  - name: chips
    description: The `<div data-part="chips">` row holding one `chip` per committed file. Empty (no phantom gap) when `files` is empty.
  - name: chip
    description: One committed-file card — a composed `<ui-attachment>` (ADR-0210 Consequences' zero-mapping reuse of the shipped Display leaf, same `name`/`mimeType`/`sizeBytes` keys) + a `remove` affordance. Carries `data-unavailable` when the host's `isKnown` check rejects the id (cl.3 — rendered inert, never dropped).
  - name: unavailable-note
    description: A short "Unavailable" text note appended to a `chip` whose id `isKnown` rejected (cl.3). Absent on every recognized chip.
  - name: remove
    description: An icon-only `<ui-button data-part="remove">` (aria-label "Remove {name}") that drops the chip's descriptor from `files` and fires `change`.

customStates:
  - ready              # the motion gate (ADR-0008) — armed one frame past first paint (button.ts/toggle.ts precedent)
  - disabled            # the effective-usable channel: own `disabled` OR ancestor <fieldset disabled> OR no `intake` seam registered (ADR-0210 cl.4.5) — reused fleet vocabulary, no new state minted
  - dragging            # a file is being dragged over the dropzone (native dragenter/dragover) — the `ui-split` pane-resize precedent's state NAME reused for a distinct gesture (custom states are per-host-scoped; :state() never collides across unrelated controls)
  - user-invalid        # ADR-0051 — set only AFTER the first interaction (blur/change), via the trackUserInvalid controller, gating the danger outline

face:
  formAssociated: true  # form-associated FACE control — submits ONE JSON-string entry under `name` (the whole committed descriptor array), or nothing when empty
  formValue: A single JSON-stringified `files` array under `name` — metadata-only, bytes never ride this either (ADR-0210 cl.4.1). Empty selection → null, contributing no entry (native `<input type=file>` parity).
  formValidity: required && files.length === 0 → valueMissing. Default valid.
  formReset: Restores `files` to the array the `files` ATTRIBUTE held at connect time (the combo-box.md/multi-select.md "the attribute seeds the reset baseline" convention); also clears the transient rejection-reason override.

aria:
  role: group            # a labeled composite widget (dropzone + browse trigger + committed chips) — set via ElementInternals, never a host attribute
  roleSource: internals
  labelSource: label-prop-or-fielded   # bare usage: internals.ariaLabel from `label` (falling back to FALLBACK_LABEL, ADR-0085); inside a `ui-field`, the base's guarded `applyFieldLabelling` default wires `ariaLabelledByElements` instead (internals.role is set, so the guarded default fires for free)
  disabledState: internals.ariaDisabled   # mirrors the effective-usable channel (own/ancestor/unwired-seam) — never a host aria-disabled attribute

keyboard:
  - note: Focusable by default — the `tabbable` trait sets tabindex=0 while usable (own `disabled` OR no `intake` seam removes it from the tab order); this is what makes the host a genuine PASTE TARGET (Cmd/Ctrl+V while focused commits the clipboard's files, ADR-0210 cl.1's "paste target").
  - note: The `browse`/`remove` `<ui-button>` parts carry their OWN keyboard contract (Space/Enter activation) — delegated, not restated here.
  - note: Disabled (or unwired) is fully inert — no drag/drop/paste/browse gesture commits anything.

geometry:
  sizeClass: pattern
  # No [size] attribute/ramp (ADR-0210 cl.2's table has none) — the shell's padding/gap are minted
  # own-chain off the `--space-*` ladder (TKT-0066 item 5); the browse/remove buttons size themselves via
  # their OWN `<ui-button size='sm'>` geometry; committed chips ride the compact realm via `<ui-attachment>`'s
  # own Display-class sizing.
  paddingBlock: var(--ui-file-drop-padding)   # the whole shell's own padding — not a control-height row law (Pattern-class shell, geometry.md)
  gap: var(--ui-file-drop-gap)                 # icon/hint/browse row spacing
  rowGap: var(--ui-file-drop-row-gap)          # chips-row wrap spacing

forcedColors: An explicit `@media (forced-colors: active)` block keeps the dashed outline + text visible under WHCM (repainted to CanvasText), repaints the :state(dragging) active-target border to Highlight, and outlines each committed chip in CanvasText — the ON/no-hue-reliance discipline every fleet interactive surface follows.
---

# ui-file-drop

`ui-file-drop` is the fleet's file-**input** affordance (`extends UIFormElement`, ADR-0210 — the ADR-0112
cl.1 fence opened) — a dropzone + picker button + committed-file chips + a paste target, unifying the
conversation composer's three-gesture attach (GH #1211) into a standalone FACE control. It carries **no
bytes**: the bound `files` value is an array of host-minted `{id, name, mimeType, sizeBytes}` **handle
descriptors** only — the platform `File`/`Blob` objects a gesture produces never leave this control except
as arguments to the host's own `intake` seam, which hands back descriptors. See file-drop.ts's header for
the full trust-boundary rationale and the provisional `intake`/`isKnown` seam shape.

```html
<ui-file-drop label="Drop your CSV here" accept=".csv" name="dataset"></ui-file-drop>
<ui-file-drop multiple max-files="5" max-size-bytes="10485760" label="Attach supporting documents"></ui-file-drop>
```

```js
const drop = document.querySelector('ui-file-drop')
drop.intake = async (files, ctx) => files.map((f) => ({
  id: crypto.randomUUID(),
  name: f.name,
  mimeType: f.type,
  sizeBytes: f.size,
}))
drop.addEventListener('change', () => console.log(drop.files))
```

## The trust boundary — host-mediated handles, never bytes (ADR-0210 cl.4)

No endpoint prop exists anywhere on this control, by construction — it performs **zero network I/O**. A
gesture's raw `File`s are handed to the host-supplied `intake` function and then DISCARDED; only the
descriptors it returns ever reach `files`. An unwired host (`intake` unset) renders the control **visibly
disabled** with a stated reason — never a silently dead dropzone (cl.4.5, the ADR-0102 CSS-less-consumer
discipline: the correctness of "this control cannot work here" may not live in page CSS alone).

## Constraints are structural literals, not live bindings

`accept`/`multiple`/`maxSizeBytes`/`maxFiles` are **not** bindable — the `Swiper` structural-axis precedent
(ADR-0210 cl.2): a live-retargeted `accept` mid-selection is a desync generator, not a feature. A
non-conforming file is rejected **at the gesture with a visible reason** (the `hint` part) — this is UX
only; the host's own `intake` seam is the real security/policy authority (cl.4.4).

## Read-direction — unavailable chips (ADR-0210 cl.3)

An externally-written descriptor whose `id` the host's `isKnown` check rejects renders as an **inert
"Unavailable" chip** — rendered, never dropped, because silently dropping data-model content makes the
surface lie about its own state. It can still be removed (dropping it from `files` needs no byte access).

## Accessibility

- `role="group"` is set via `ElementInternals` — never a host attribute. The accessible name comes from
  `label` (bare usage) or the enclosing `ui-field`'s labelling (fielded usage, ADR-0085).
- The host itself is a real, focusable **paste target** (`tabbable`) — Cmd/Ctrl+V while focused commits the
  clipboard's files.
- Disabled (own, ancestor `<fieldset disabled>`, or an unwired `intake` seam) is announced via
  `ElementInternals.ariaDisabled` — never a host `aria-disabled` attribute.
- The hidden native `<input type="file">` the `browse` button clicks carries no ARIA/tab-stop of its own —
  it is OS-picker plumbing, not part of the control's accessible surface (see file-drop.ts's header for why
  a native element is unavoidable here specifically).
