---
# editor.md frontmatter — the attributes-as-API descriptor for ui-code-editor (ADR-0004 / ADR-0139 / ADR-0147).
# The machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc. The
# `attributes[]` block MUST mirror editor.ts `static props` (the ...UIFormElement.formProps spread —
# name/disabled/required — plus value/language/mode/label/placeholder/rows/readonly) — the contract↔props
# trip-wire (editor-descriptor.test.ts) and the frontmatter schema both target this fence. The element lives
# OUTSIDE @agent-ui/components, so it carries NO catalog row (ADR-0139 cl.4); the fleet DoD (descriptor,
# probes, states, forced-colors, reduced-motion) still applies.
tag: ui-code-editor
description: A form-associated, editable-first source editor with markdown syntax highlighting — a plain contenteditable surface that CodeMirror 6 progressively enhances (lazy-loaded, ADR-0139), with an opt-in richtext live-preview mode (decoration-rendered over the SAME document, ADR-0147); the editor counterpart of the display-only ui-code.
tier: control          # geometry size-class (Control band); the geometry LEVER is ADR-0134's multi-line law (rows × line-box + padding as a growable minimum), not the single-line (scale×size)→§1-row lookup
extends: UIFormElement  # FACE form-associated control (value/validity participation via ElementInternals; ADR-0013)

attributes:            # attributes-as-API — mirrors editor.ts `static props` (control-specific first, then the spread formProps)
  - name: value
    type: string
    default: ''
    reflect: false     # observed (seeds the reset baseline, native parity) but NOT reflected — the live value rides the surface, not a host attribute
  - name: language
    type: string
    default: ''
    reflect: true      # v1: `markdown` triggers CodeMirror + syntax highlighting; unknown/absent ⇒ plain, no highlight, no CM load (ADR-0139 cl.4). Reflects for [language] CSS hooks
  - name: mode
    type: string
    default: source
    reflect: true      # 'source' (default) | 'richtext' (ADR-0147). Unknown ⇒ treated as 'source'. Reflects for [mode] CSS hooks. `.value` stays the markdown string in BOTH modes — no serializer, no second document model
  - name: label
    type: string
    default: ''
    reflect: true      # → the editor's aria-label (the labelling SEAM; yields under a ui-field association)
  - name: placeholder
    type: string
    default: ''
    reflect: false     # shown via [data-empty]::before when the plain editor is empty; also the CodeMirror placeholder
  - name: rows
    type: number
    default: 4
    reflect: true      # native <textarea rows> parity — sets the CSS min-block-size lever (rows × line-box + 2·block-padding) as a MINIMUM, not a fixed height (ADR-0134); also mirrored onto an inline --ui-code-editor-rows custom property by editor.ts
  - name: readonly
    type: boolean
    default: false
    reflect: true      # reflects to a `readonly` attribute → CSS hook; the surface is not editable but still focusable + still submits (ADR-0014 dev#b, reused; CM mirrors it via a Compartment reconfigure)
  - name: name
    type: string
    default: ''
    reflect: true      # the form field name (FACE; UIFormElement.formProps) — reflects (native parity; FACE submission keys by the `name` content attribute)
  - name: disabled
    type: boolean
    default: false
    reflect: true      # reflects so the [disabled] state hook applies to JS-set values; effectiveDisabled = own || form-disabled channel (ADR-0013)
  - name: required
    type: boolean
    default: false
    reflect: true      # reflects to a `required` attribute; drives the valueMissing validity verdict + aria-required

properties:            # IDL beyond attributes-as-API: the value property + the FACE form IDL (delegated to ElementInternals by UIFormElement) + the caret-restoration seam
  - name: value
    description: The current source text (string), newlines included. The primary value property — tracked signal, source of truth for BOTH surfaces (the plain contenteditable and, once enhanced, CodeMirror), and seeds the form value via ElementInternals.setFormValue (the FACE value, ADR-0013).
  - name: form
    description: The owning <form>, or null (delegates to ElementInternals.form).
  - name: validity
    description: The live ValidityState (delegates to ElementInternals.validity).
  - name: validationMessage
    description: The current validation message (empty when valid).
  - name: willValidate
    description: Whether the control is a candidate for constraint validation.
  - name: checkValidity
    description: Method — runs constraint validation, firing an invalid event when invalid.
  - name: reportValidity
    description: Method — like checkValidity, additionally reporting the problem to the user (focuses the surface anchor).
  - name: selectToEnd
    description: Method — focuses the live surface and moves the caret to the end of its text (a CodeMirror selection when enhanced, else a Selection/Range on the plain editor part). The contenteditable-friendly equivalent of a native `<textarea>.setSelectionRange(len, len)` (ADR-0134's migration seam — used by ui-agent-admin's entry-list re-render to restore an in-progress edit's caret).

events:
  - name: input
    detail: 'null'
    description: Fired on each edit of the surface (surface→model) as the value tracks the plain editor or the CodeMirror document. Suppressed mid IME composition on the plain surface. Matches native <textarea> input semantics.
  - name: change
    detail: 'null'
    description: Fired on commit — blur-with-change ONLY (ADR-0134 — Enter inserts a newline and never commits). Byte-identical timing to ui-textarea's, on both the plain and CodeMirror surfaces. Matches native <textarea> change semantics.
  - name: toggle
    detail: 'null'
    description: Fired ONLY when the mode-toggle part is activated by the USER (click/Enter/Space) — flips `mode` between 'source' and 'richtext' (ADR-0147). A programmatic `mode` set is silent (the value/input symmetry) — never fired on prop-set.

slots: []              # no adornment machinery (the editable-source surface has no leading/trailing slots)

parts:                 # the editable surfaces are control-owned PARTS, not slots (ADR-0014 cl.1, reused)
  - name: editor
    description: The plain contenteditable editable surface (the editable-first fallback) — a control-created light-DOM `<div data-part="editor" contenteditable="plaintext-only" role="textbox" aria-multiline="true">`. Created ONCE (idempotent guard) and NEVER re-rendered; carries role=textbox (the host carries no role/aria-* attribute). Hidden (kept in the DOM) once CodeMirror enhances the control; restored on disconnect.
  - name: cm
    description: The CodeMirror mount host — a control-created `<div data-part="cm">` inserted before the plain editor and populated by the lazy-loaded CodeMirror 6 view when language="markdown" enhancement succeeds. Absent under jsdom / on load failure / for non-markdown languages (the plain editor stays the surface).
  - name: mode-toggle
    description: The built-in richtext mode toggle (ADR-0147) — a control-created `<div data-part="mode-toggle" role="button" tabindex="0" aria-pressed aria-label="Rendered markdown view">`, created ONLY once CodeMirror enhances AND the markdown language pack loaded (richtextAvailable) — the affordance appears WITH the capability, never before it. Absent under jsdom / on load failure / for non-markdown languages / while the optional markdown pack failed to load. Removed on disconnect, recreated on a reconnect's re-enhance. Placed first child of the host (sticky, inline-end corner) so tab order is toggle → editor surface. Disabled hosts render it non-operable (no tabindex, aria-disabled); readonly hosts keep it fully operable (a readonly rendered view is a legitimate reading surface).

customStates:          # :state() hooks the stylesheet keys off — set via internals.states, never host attrs
  - ready              # the motion gate (ADR-0008): armed one frame past first paint so the upgrade SNAPS and only subsequent state changes animate
  - disabled           # effectiveDisabled (own || form-disabled channel) — the form-control disabled channel, NOT host ariaDisabled (ADR-0014 dev#b)
  - user-invalid       # set only AFTER the first commit (blur) via the inline touched gate, gating the danger border

face:
  formAssociated: true   # a FACE form-associated control — value + validity participate via ElementInternals (ADR-0013)
  value: value           # the prop whose value is published to internals.setFormValue
  validity: valueMissing # required+empty; no codec/type validation (editable source text has no value-shape to mismatch)

aria:
  role: textbox          # set on the EDITOR part (data-part=editor), NOT the host — the host carries no role/aria-* attribute (form semantics ride internals)
  roleSource: editor part
  labelSource: label / aria-label   # bare usage: the `label` prop → the editor's aria-label; inside a ui-field, applyFieldLabelling overrides this (ADR-0051 seam, reused verbatim)
  disabledState: editor aria-disabled + the form-disabled channel   # effectiveDisabled = own disabled || form-disabled (ADR-0013); NOT host ariaDisabled — ADR-0014 dev#b
  describedBy: editor aria-describedby → a control-managed message node carrying validity().message under :state(user-invalid)   # the WCAG 1.4.1 non-colour validity cue

keyboard:
  - keys: Enter
    action: Inserts a newline (native <textarea> parity) — does NOT commit. Commit is blur-with-change only, on both surfaces.
  - keys: typing
    action: Edits the surface; each edit updates value (surface→model) and emits input (suppressed mid IME composition on the plain surface).
  - keys: Enter / Space (on the mode-toggle part)
    action: Flips `mode` between 'source' and 'richtext' and emits ONE `toggle` (ADR-0147). Space's default (page scroll) is prevented.
  - note: The plain editor is intrinsically focusable (contenteditable); CodeMirror's content DOM is focusable when enhanced. host.focus() forwards to the live surface. disabled removes focusability; readonly keeps it focusable and selectable but not editable.
  - note: CodeMirror's own `indentWithTab` captures Tab inside the editor content — Esc then Tab is CM's standing escape hatch to move focus onward (unchanged by richtext mode).

geometry:
  sizeClass: control
  blockSize: var(--ui-code-editor-min-block-size)   # a GROWABLE MINIMUM (rows × line-box + 2·block-padding), never a fixed §1-row height — ADR-0134's multi-line law
  paddingBlock: var(--ui-code-editor-padding-block)   # REAL block padding — the inversion of the single-line law's padding-block:0
  inlinePad: var(--ui-code-editor-padding-inline)
  gap: n/a                # no adornment slots — no slot↔editor gap
  radius: var(--md-sys-shape-corner-base)            # fixed rounded-rect — the container-fleet referent, entry-control class
  minInlineSize: var(--ui-code-editor-min-inline-size) (~20ch — entry-control typing-width floor, native <textarea> parity; ADR-0021)

forcedColors: A `@media (forced-colors: active)` block keeps the idle frame border, ink, and placeholder visible (CanvasText) and degrades every highlight token to plain ink (SPEC-C5 AC2 — a token is never invisible); the :focus-within outline ring survives via --md-sys-color-focus-ring → Highlight.
---

# ui-code-editor

`ui-code-editor` is a form-associated (`extends UIFormElement`, ADR-0013), **editable-first** source editor:
the editor counterpart of the display-only [`ui-code`](../../../components/src/controls/code/code.md). It is
`@agent-ui`'s first control to adopt a genuine third-party runtime dependency — **CodeMirror 6** — confined to
this opt-in `@agent-ui/code/editor` subpath and **lazy-loaded** (ADR-0139; every default barrel stays
CodeMirror-free).

```html
<ui-code-editor language="markdown" rows="6" placeholder="Write markdown…"></ui-code-editor>
<ui-code-editor language="markdown" value="## Heading" required></ui-code-editor>
```

## Editable-first — never read-only

On connect, the element renders a **plain, fully-working editable surface** (the ADR-0134 contenteditable
pattern) with **zero CodeMirror loaded**. Only for `language="markdown"` does it then attempt a dynamic
`import()` of the CodeMirror runtime behind a **10s ceiling**; on success CodeMirror **progressively
enhances** the surface — mounting alongside the plain editor, preserving the current value and focus/caret,
and hiding the plain editor. On load failure or timeout — or under jsdom, where CodeMirror cannot lay out —
the plain editable surface simply **stays, permanently**. It never becomes read-only: prompt fields must never
lose input capability (ADR-0139 cl.5, inverting gen-ui-kit's display-first `<pre>` fallback).

Because the CodeMirror mount, syntax highlighting, and the enhancement handoff need a real layout engine, they
are **browser-leg obligations** (both engines); the plain surface plus the full FACE contract are the
jsdom-tested part (ADR-0139 Consequences — "jsdom is blind to the CM path").

## `value` — one model, two surfaces

`value` is the single source of truth. Typing (plain surface **or** CodeMirror) flows **surface→model** and
emits `input`; a programmatic `value` write (or a form reset/restore) flows **model→surface** under a caret
guard — a plain `textContent` write, or a CodeMirror dispatch while it is unfocused — so a keystroke never
resets the caret. `change` fires on **blur-with-change only**, byte-identical to
[`ui-textarea`](../../../components/src/controls/textarea/textarea.md) on both surfaces — which is what makes
`ui-agent-admin`'s entry editors a drop-in swap.

## Syntax highlighting

For `language="markdown"`, CodeMirror's `lang-markdown` pack colours the markdown constructs. Colour rides
**class-based highlight tokens** (`tok-*`) mapped to `--ui-code-editor-token-*` roles fed by the fleet
`--md-sys-color-*` ladders — `EditorView.theme()` stays structural-only (ADR-0139 cl.4). Token colour is a
non-essential enhancement: the source is legible as plain ink with or without it.

## Richtext live preview (`mode`, ADR-0147)

`mode="richtext"` turns on an Obsidian-style **live preview**: CodeMirror decorations style the markdown
constructs (headings, **bold**, _emphasis_, `inline code`, links, bullets, blockquotes) and hide their raw
markup — except on the line(s) the selection touches, where the raw source reveals for editing (**reveal-near-
cursor**). This is a pure VIEW transform over the exact same `EditorView` and document as `mode="source"`:
there is no second DOM tree, no serializer, and no round-trip step — `.value` is the markdown string in BOTH
modes, byte-identical FACE participation and `input`/`change` timing. Fenced code blocks always render
verbatim (fences visible, contents keep their `tok-*` highlight — code inside markdown is source by nature);
tables, images, and task-list checkboxes are explicitly out of v1 scope and render as source.

**Availability is capability-gated (editable-first untouched, ADR-0139 cl.5).** Richtext needs the CodeMirror
mount AND the markdown language pack — no syntax tree, nothing to decorate. Wherever CM cannot or does not
mount (jsdom, load failure/timeout, a non-markdown `language`), `mode="richtext"` is **inert**: the attribute
stands, the plain source surface stays fully editable, and the built-in mode toggle never renders. The
affordance appears WITH the capability.

**The built-in toggle** (`[data-part="mode-toggle"]`) is keyboard-operable (click, Enter, Space), announces its
state via `aria-pressed`, and emits ONE `toggle` event — but only on a USER-initiated flip; a programmatic
`mode` set is silent (the same `value`/`input` symmetry). Disabled hosts render it non-operable; readonly
hosts keep it fully operable (a readonly rendered view is a legitimate reading surface).

Cmd/Ctrl+click on a decorated link opens its URL (`noopener`) — a plain click stays cursor placement, editing
remains primary. Only `http:`/`https:`/`mailto:`/relative URLs are ever opened.

## Validity, accessibility & form participation

`required` + an empty value raises a `valueMissing` constraint (anchored on the live surface); the danger
border and `aria-invalid` appear only **after the first commit** (blur). The editor points at a
control-managed message node via `aria-describedby` (WCAG 1.4.1). In bare usage the `label` prop becomes the
editor's `aria-label`; inside a [`ui-field`](../../../components/src/controls/field/field.md), the ADR-0051
seam id-references the field's own parts instead. `value` is published to the owning `<form>` via
`ElementInternals.setFormValue`, and `formResetCallback`/`formStateRestoreCallback` round-trip it — all without
a native `<textarea>`.

## `selectToEnd()`

`selectToEnd()` is ADR-0134's migration seam: it focuses the live surface and collapses the caret to the end
of its text — a CodeMirror selection when enhanced, else a `Selection`/`Range` on the plain editor part.
